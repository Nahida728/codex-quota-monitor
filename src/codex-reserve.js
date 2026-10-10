const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { identifyWindows } = require("./quota-normalizer");
const { readBoundedText } = require("./reset-checkpoints");

function normalizeReserveUsage(raw) {
  const bucket = (Array.isArray(raw?.additional_rate_limits) ? raw.additional_rate_limits : []).find(item => item?.limit_name === "gpt-reserve");
  if (!bucket?.rate_limit) return null;
  const rate = bucket.rate_limit;
  const convert = value => value && Number.isFinite(value.used_percent) &&
    Number.isFinite(value.limit_window_seconds) && value.limit_window_seconds > 0 ? {
      usedPercent: value.used_percent,
      windowDurationMins: value.limit_window_seconds / 60,
      resetsAt: Number.isFinite(value.reset_at) ? value.reset_at : null
    } : null;
  const weekly = identifyWindows({ primary: convert(rate.primary_window), secondary: convert(rate.secondary_window) }).weekly;
  return weekly ? { ...weekly, source: "official-desktop-usage" } : null;
}

async function readUsageSnapshot(response) {
  if (!response.ok) throw new Error("RESERVE_UNAVAILABLE");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "", bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 512 * 1024) throw new Error("RESERVE_TOO_LARGE");
      buffered = (buffered + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");
      let boundary;
      while ((boundary = buffered.indexOf("\n\n")) >= 0) {
        const frame = buffered.slice(0, boundary);
        buffered = buffered.slice(boundary + 2);
        if (!/^event:\s*usage\.snapshot\s*$/m.test(frame)) continue;
        const data = frame.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
        return normalizeReserveUsage(JSON.parse(data)?.usage);
      }
    }
    return null;
  } finally { await reader.cancel().catch(() => {}); }
}

// The desktop usage route exposes additional_rate_limits even when the CLI
// app-server's capability-gated response omits Reserve. Credentials stay inside
// this reader, never in snapshots, state, errors, logs, or renderer IPC.
class CodexReserveReader {
  constructor({ fetchImpl = globalThis.fetch, authPath = path.join(os.homedir(), ".codex", "auth.json") } = {}) {
    this.fetch = fetchImpl; this.authPath = authPath;
    this.streamRetryAt = 0;
  }
  async read() {
    try {
      if ((await fs.stat(this.authPath)).size > 256 * 1024) return null;
      const auth = JSON.parse(await fs.readFile(this.authPath, "utf8"));
      if (auth.auth_mode !== "chatgpt" || typeof auth.tokens?.access_token !== "string" ||
          !auth.tokens.access_token || auth.tokens.access_token.length > 32000) return null;
      const headers = { Authorization: `Bearer ${auth.tokens.access_token}`,
        "OAI-App-Brand": "chatgpt", "x-openai-codex-pricing-chooser": "1" };
      if (typeof auth.tokens.account_id === "string" && auth.tokens.account_id.length < 256) {
        headers["ChatGPT-Account-ID"] = auth.tokens.account_id;
      }
      if (Date.now() >= this.streamRetryAt) {
        try {
          const stream = await this.fetch("https://chatgpt.com/backend-api/wham/usage/stream", {
            headers, redirect: "error", signal: AbortSignal.timeout(4500)
          });
          if (stream.ok && stream.headers.get("content-type")?.includes("text/event-stream")) {
            const reserve = await readUsageSnapshot(stream);
            if (reserve) return reserve;
          } else await stream.body?.cancel().catch(() => {});
        } catch {}
        // Some official account routes do not offer SSE. Avoid retrying an
        // unsupported stream on every five-second refresh.
        this.streamRetryAt = Date.now() + 15 * 60000;
      }
      const response = await this.fetch("https://chatgpt.com/backend-api/wham/usage", {
        headers, redirect: "error", signal: AbortSignal.timeout(4500)
      });
      return normalizeReserveUsage(JSON.parse(await readBoundedText(response, 512 * 1024)));
    } catch { return null; }
  }
}
module.exports = { CodexReserveReader, normalizeReserveUsage, readUsageSnapshot };
