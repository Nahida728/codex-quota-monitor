const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { version: appVersion } = require("../package.json");
const { JsonStore } = require("./store");
const { normalizeQuotaResponse } = require("./quota-normalizer");
const {
  CodexDesktopVersionDetector,
  evaluateClientUpdate
} = require("./codex-update-service");

const REQUEST_TIMEOUT_MS = 15_000;

class AppServerClient {
  constructor() {
    this.process = null;
    this.buffer = "";
    this.nextId = 1;
    this.pending = new Map();
    this.initialized = false;
  }

  findExecutable() {
    const home = os.homedir();
    const candidates = process.platform === "win32"
      ? [
          path.join(home, ".codex", "plugins", ".plugin-appserver", "codex.exe"),
          path.join(home, ".codex", ".sandbox-bin", "codex.exe")
        ]
      : [
          path.join(home, ".codex", "plugins", ".plugin-appserver", "codex"),
          "codex"
        ];
    return candidates.find(candidate => candidate === "codex" || fs.existsSync(candidate)) || null;
  }

  async start() {
    if (this.process && this.initialized) return;
    const executable = this.findExecutable();
    if (!executable) throw new Error("CODEX_NOT_INSTALLED");

    this.process = spawn(executable, ["app-server", "--stdio"], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" }
    });
    this.process.stdout.on("data", chunk => this.onData(chunk));
    this.process.stderr.on("data", () => {});
    this.process.on("error", error => this.onClosed(error));
    this.process.on("exit", code => this.onClosed(new Error(`CODEX_APP_SERVER_EXIT_${code}`)));

    await this.request("initialize", {
      clientInfo: {
        name: "codex-quota-monitor",
        title: "Codex Quota Monitor",
        version: appVersion
      }
    });
    this.initialized = true;
  }

  onData(chunk) {
    this.buffer += chunk.toString("utf8");
    while (true) {
      const newline = this.buffer.indexOf("\n");
      if (newline === -1) break;
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      try {
        const message = JSON.parse(line);
        if (message.id !== undefined && this.pending.has(message.id)) {
          const pending = this.pending.get(message.id);
          this.pending.delete(message.id);
          clearTimeout(pending.timer);
          if (message.error) {
            pending.reject(new Error(message.error.message || message.error.code || "CODEX_REQUEST_FAILED"));
          } else {
            pending.resolve(message.result);
          }
        }
      } catch {
        // Ignore non-protocol output. Tokens and payloads are never logged.
      }
    }
  }

  onClosed(error) {
    this.process = null;
    this.initialized = false;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  request(method, params = {}) {
    if (!this.process?.stdin?.writable) return Promise.reject(new Error("CODEX_APP_SERVER_OFFLINE"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("CODEX_REQUEST_TIMEOUT"));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.process.stdin.write(`${JSON.stringify({ method, id, params })}\n`);
    });
  }

  async readRateLimits() {
    await this.start();
    return this.request("account/rateLimits/read", {});
  }

  dispose() {
    this.process?.kill();
    this.process = null;
  }
}

class QuotaService {
  constructor({ appStatePath, client, versionDetector } = {}) {
    this.client = client || new AppServerClient();
    this.versionDetector = versionDetector || new CodexDesktopVersionDetector();
    this.state = new JsonStore(appStatePath);
    this.inFlight = null;
  }

  async read() {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.performRead().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  async performRead() {
    const checkedAt = Date.now();
    const versionPromise = this.versionDetector.read(checkedAt).catch(() => null);
    try {
      const [raw, installedVersion] = await Promise.all([
        this.client.readRateLimits(),
        versionPromise
      ]);
      const normalized = normalizeQuotaResponse(raw, this.state.data);
      const persisted = normalized.persistence;
      delete normalized.persistence;
      const clientUpdate = evaluateClientUpdate(installedVersion, this.state.data, checkedAt);
      Object.assign(this.state.data, persisted, clientUpdate.persistence);
      this.state.set("lastSuccessfulAt", checkedAt);
      return {
        online: true,
        checkedAt,
        lastSuccessfulAt: checkedAt,
        data: normalized,
        clientUpdate,
        errorCode: null
      };
    } catch (error) {
      this.client.dispose();
      const installedVersion = await versionPromise;
      const clientUpdate = evaluateClientUpdate(installedVersion, this.state.data, checkedAt);
      Object.assign(this.state.data, clientUpdate.persistence);
      this.state.set("lastClientVersionCheckAt", checkedAt);
      const message = String(error?.message || error);
      let errorCode = "NETWORK_ERROR";
      if (message.includes("CODEX_NOT_INSTALLED")) errorCode = "CODEX_NOT_INSTALLED";
      else if (/not logged|unauthor|auth|account/i.test(message)) errorCode = "NOT_LOGGED_IN";
      else if (/timeout/i.test(message)) errorCode = "TIMEOUT";
      return {
        online: false,
        checkedAt,
        lastSuccessfulAt: this.state.get("lastSuccessfulAt", null),
        data: null,
        clientUpdate,
        errorCode
      };
    }
  }

  dispose() {
    this.client.dispose();
  }
}

module.exports = { QuotaService, AppServerClient };
