const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { CodexReserveReader, normalizeReserveUsage } = require("../src/codex-reserve");
const usage = { additional_rate_limits: [{ limit_name: "gpt-reserve", rate_limit: {
  primary_window: { used_percent: 14, limit_window_seconds: 604800, reset_at: 1791956596 }
} }] };

test("Reserve accepts the independent weekly primary window and never substitutes Codex", () => {
  assert.equal(normalizeReserveUsage(usage).remainingPercent, 86);
  assert.equal(normalizeReserveUsage({ rate_limit: usage.additional_rate_limits[0].rate_limit }), null);
  assert.equal(normalizeReserveUsage({ additional_rate_limits: [{ ...usage.additional_rate_limits[0], limit_name: "some-reserve" }] }), null);
  assert.equal(normalizeReserveUsage({ additional_rate_limits: [{ limit_name: "gpt-reserve", rate_limit: { primary_window: { used_percent: null, limit_window_seconds: 604800 } } }] }), null);
});

test("Reserve HTTPS fallback stays on the official origin and returns only safe quota numbers", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "reserve-auth-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const authPath = path.join(directory, "auth.json");
  fs.writeFileSync(authPath, JSON.stringify({ auth_mode: "chatgpt", tokens: { access_token: "secret-for-test", account_id: "account-for-test" } }));
  let called;
  const reader = new CodexReserveReader({ authPath, fetchImpl: async (url, options) => {
    called = { url, options }; return new Response(`event: usage.heartbeat\ndata: {}\n\nevent: usage.snapshot\ndata: ${JSON.stringify({ usage })}\n\n`, { headers: { "content-type": "text/event-stream" } });
  } });
  const result = await reader.read();
  assert.equal(called.url, "https://chatgpt.com/backend-api/wham/usage/stream");
  assert.equal(called.options.redirect, "error");
  assert.equal(called.options.headers["OAI-App-Brand"], "chatgpt");
  assert.equal(result.remainingPercent, 86);
  assert.doesNotMatch(JSON.stringify(result), /secret|account|tokens|additional_rate_limits/);
  reader.fetch = async () => { throw new Error("network details secret-for-test"); };
  assert.equal(await reader.read(), null);
});

test("an unsupported usage stream falls back to ordinary official usage without repeated probes", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "reserve-fallback-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const authPath = path.join(directory, "auth.json");
  fs.writeFileSync(authPath, JSON.stringify({ auth_mode: "chatgpt", tokens: { access_token: "test-secret" } }));
  const calls = [];
  const reader = new CodexReserveReader({ authPath, fetchImpl: async url => {
    calls.push(url);
    return url.endsWith("stream") ? new Response("{}", { status: 404 }) : new Response(JSON.stringify(usage));
  } });
  assert.equal((await reader.read()).remainingPercent, 86);
  assert.equal((await reader.read()).remainingPercent, 86);
  assert.equal(calls.filter(url => url.endsWith("stream")).length, 1);
});

test("a usage snapshot omitting Reserve still allows the ordinary usage fallback", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "reserve-empty-stream-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const authPath = path.join(directory, "auth.json");
  fs.writeFileSync(authPath, JSON.stringify({ auth_mode: "chatgpt", tokens: { access_token: "test-secret" } }));
  const reader = new CodexReserveReader({ authPath, fetchImpl: async url => url.endsWith("stream")
    ? new Response('event: usage.snapshot\ndata: {"usage":{}}\n\n', { headers: { "content-type": "text/event-stream" } })
    : new Response(JSON.stringify(usage)) });
  assert.equal((await reader.read()).remainingPercent, 86);
});
