const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { version: appVersion } = require("../package.json");
const {
  createQuotaStateStore,
  normalizeTaskPerformanceRecords
} = require("./store");
const {
  normalizeQuotaResponse,
  identifyWindows,
  normalizeReceivedResetHistory,
  normalizeConsumedResetHistory
} = require("./quota-normalizer");
const { normalizeTokenUsageResponse } = require("./token-usage");
const {
  CodexSubscriptionReader,
  normalizeSubscriptionDetails
} = require("./subscription-service");
const {
  CodexCostUsageReader,
  normalizeCodexCostUsageResult
} = require("./codex-cost-usage");
const {
  CodexActiveTaskReader,
  normalizeActiveTaskResult
} = require("./codex-active-tasks");
const {
  CodexDesktopVersionDetector,
  evaluateClientUpdate
} = require("./codex-update-service");

const REQUEST_TIMEOUT_MS = 15_000;
const { ResetCheckpointReader } = require("./reset-checkpoints");
const { CodexReserveReader } = require("./codex-reserve");
const { LocalUsageClient } = require("./local-usage-client");

function activeTaskIdentity(task) {
  if (typeof task?.id === "string" && task.id) return `id:${task.id}`;
  return `fallback:${Number(task?.startedAt) || 0}:${String(task?.projectName || "")}`;
}

function updateTaskPerformanceRecords(
  previous,
  tasks,
  now,
  history = null,
  newlyTerminalTasks = []
) {
  const records = normalizeTaskPerformanceRecords([{
    taskPerformanceRecords: previous
  }]);
  let changed = false;
  let historyChanged = false;

  if (history?.available) {
    const integerFields = [
      "totalTaskCount",
      "timedTaskCount",
      "totalElapsedSeconds",
      "completedTaskCount",
      "manualInterruptedTaskCount",
      "abnormalInterruptedTaskCount",
      "managedStoppedTaskCount"
    ];
    for (const key of integerFields) {
      const value = Math.max(0, Math.floor(Number(history[key]) || 0));
      if (value > records[key]) {
        records[key] = value;
        changed = true;
        historyChanged = true;
      }
    }
    const totalCost = Number(history.totalEstimatedCostUsd);
    if (
      Number.isFinite(totalCost) &&
      totalCost >= 0 &&
      totalCost > records.totalEstimatedCostUsd
    ) {
      records.totalEstimatedCostUsd = totalCost;
      changed = true;
      historyChanged = true;
    }
    const historyLongest = Math.max(
      0,
      Math.floor(Number(history.longestElapsedSeconds) || 0)
    );
    if (historyLongest > records.longestElapsedSeconds) {
      records.longestElapsedSeconds = historyLongest;
      records.longestRecordedAt = now;
      changed = true;
      historyChanged = true;
    }
    const historyHighestCost = Number(history.highestEstimatedCostUsd);
    if (
      Number.isFinite(historyHighestCost) &&
      historyHighestCost >= 0 &&
      historyHighestCost > records.highestEstimatedCostUsd
    ) {
      records.highestEstimatedCostUsd = historyHighestCost;
      records.highestCostRecordedAt = now;
      changed = true;
      historyChanged = true;
    }
    if (
      Number.isFinite(history.observedAt) &&
      (
        !Number.isFinite(records.historyObservedAt) ||
        history.observedAt > records.historyObservedAt
      )
    ) {
      records.historyObservedAt = history.observedAt;
      records.historyTruncated = Boolean(history.truncated);
      changed = true;
    }
  }

  if ((!history?.available || history.deferred) && newlyTerminalTasks.length) {
    for (const task of newlyTerminalTasks) {
      const elapsed = Math.max(0, Math.floor(Number(task?.elapsedSeconds) || 0));
      const cost = Number(task?.estimatedCostUsd);
      records.totalTaskCount += 1;
      if (task?.durationKnown !== false) {
        records.timedTaskCount += 1;
        records.totalElapsedSeconds += elapsed;
      }
      if (Number.isFinite(cost) && cost >= 0) {
        records.totalEstimatedCostUsd += cost;
      }
      if (task?.outcome === "completed") records.completedTaskCount += 1;
      else if (task?.outcome === "manual-interrupted") {
        records.manualInterruptedTaskCount += 1;
      } else if (task?.outcome === "managed-stopped") {
        records.managedStoppedTaskCount += 1;
      } else {
        records.abnormalInterruptedTaskCount += 1;
      }
    }
    records.historyObservedAt = now;
    changed = true;
    historyChanged = true;
  }

  for (const task of tasks) {
    const elapsed = Math.max(0, Math.floor(Number(task?.elapsedSeconds) || 0));
    if (elapsed > records.longestElapsedSeconds) {
      records.longestElapsedSeconds = elapsed;
      records.longestRecordedAt = now;
      changed = true;
    }
    const cost = Number(task?.estimatedCostUsd);
    if (Number.isFinite(cost) && cost >= 0 && cost > records.highestEstimatedCostUsd) {
      records.highestEstimatedCostUsd = cost;
      records.highestCostRecordedAt = now;
      changed = true;
    }
  }
  return { records, changed, historyChanged };
}

class AppServerClient {
  constructor() {
    this.process = null;
    this.buffer = "";
    this.nextId = 1;
    this.pending = new Map();
    this.initialized = false;
    this.startPromise = null;
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
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.performStart().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  async performStart() {
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
        if (message.id === undefined && ["account/rateLimits/updated", "account/updated"].includes(message.method)) {
          this.onChange?.();
        }
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
    return this.request("account/rateLimits/read", { supportsLunaReserve: true });
  }

  async readTokenUsage() {
    await this.start();
    return this.request("account/usage/read", null);
  }

  dispose() {
    this.process?.kill();
    this.process = null;
  }
}

class QuotaService {
  constructor({
    appStatePath,
    client,
    versionDetector,
    costUsageReader,
    activeTaskReader,
    subscriptionReader,
    checkpointReader,
    reserveReader,
    fetchImpl
  } = {}) {
    this.client = client || new AppServerClient();
    this.versionDetector = versionDetector || new CodexDesktopVersionDetector();
    this.costUsageReader = costUsageReader || new CodexCostUsageReader();
    this.activeTaskReader = activeTaskReader || new CodexActiveTaskReader();
    if (!client && !costUsageReader && !activeTaskReader) {
      this.localUsage = new LocalUsageClient();
      this.costUsageReader = { read: (now, previous) => this.localUsage.read("cost", now, previous) };
      this.activeTaskReader = { read: (now, previous) => this.localUsage.read("tasks", now, previous) };
    }
    this.subscriptionReader = subscriptionReader || new CodexSubscriptionReader();
    this.checkpointReader = checkpointReader || (!client ? new ResetCheckpointReader({ fetchImpl }) : null);
    this.reserveReader = reserveReader || (!client ? new CodexReserveReader({ fetchImpl }) : null);
    this.state = createQuotaStateStore(appStatePath);
    // Retire the old local inference permanently; immutable archives are kept,
    // but their inferred official resets cannot return through reconciliation.
    this.state.data.officialResetSource = "community";
    this.state.data.officialResetHistory = [];
    this.state.data.officialResetAt = null;
    this.inFlight = null;
    this.activeTaskInFlight = null;
    this.activeTaskBaselineEstablished = false;
    this.previousActiveTasks = new Map();
    this.missingTaskCandidates = new Map();
    this.lastTaskRecordWriteAt = 0;
  }

  async read() {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.performRead().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  async readActiveTasks(now = Date.now()) {
    if (this.activeTaskInFlight) return this.activeTaskInFlight;
    const previousHistorySnapshot = this.state.data.taskHistorySnapshot || {
      legacyFloor: this.state.data.taskPerformanceRecords || null
    };
    this.activeTaskInFlight = Promise.resolve()
      .then(() => this.activeTaskReader?.read?.(now, previousHistorySnapshot))
      .then(raw => normalizeActiveTaskResult(raw, now))
      .then(result => {
        const pendingTasks = [];
        if (result.available) {
          const currentTasks = new Map(
            result.tasks.map(task => [activeTaskIdentity(task), task])
          );
          const terminalTasks = new Map(
            result.terminalTasks.map(task => [activeTaskIdentity(task), task])
          );
          if (this.activeTaskBaselineEstablished && !result.truncated) {
            for (const [identity, previous] of this.previousActiveTasks) {
              if (currentTasks.has(identity)) continue;
              const terminal = terminalTasks.get(identity);
              // A brief scan/move race is not terminal evidence. Require a second
              // complete read, while freezing the first disappearance's clock.
              if (!terminal && !this.missingTaskCandidates.has(identity)) {
                this.missingTaskCandidates.set(identity, previous);
                continue;
              }
              const frozen = this.missingTaskCandidates.get(identity) || previous;
              const elapsedSeconds = terminal && terminal.durationKnown !== false
                ? terminal.elapsedSeconds
                : Math.max(0, Math.floor(Number(frozen.elapsedSeconds) || 0));
              const endedAt = terminal?.endedAt ||
                previous.startedAt + elapsedSeconds;
              pendingTasks.push(terminal
                ? {
                    ...terminal,
                    elapsedSeconds,
                    durationKnown: true
                  }
                : {
                    ...previous,
                    endedAt,
                    completedAt: endedAt * 1_000,
                    elapsedSeconds,
                    durationKnown: true,
                    outcome: previous.goalStatus ? "managed-stopped" : "abnormal-interrupted"
                  });
              this.missingTaskCandidates.delete(identity);
            }
          }
          for (const identity of currentTasks.keys()) this.missingTaskCandidates.delete(identity);
          this.previousActiveTasks = result.truncated
            ? new Map([...this.previousActiveTasks, ...currentTasks])
            : new Map([...this.missingTaskCandidates, ...currentTasks]);
          this.activeTaskBaselineEstablished = true;
        }

        const recordUpdate = updateTaskPerformanceRecords(
          this.latestTaskRecords || this.state.data.taskPerformanceRecords,
          [...result.tasks, ...pendingTasks],
          now,
          result.history,
          pendingTasks
        );
        const historySnapshotChanged = result.historySnapshot && (
          JSON.stringify(this.state.data.taskHistorySnapshot || null) !==
          JSON.stringify(result.historySnapshot)
        );
        this.latestTaskRecords = recordUpdate.records;
        if (historySnapshotChanged) {
          this.state.data.taskHistorySnapshot = result.historySnapshot;
        }
        if (recordUpdate.changed && (pendingTasks.length || historySnapshotChanged || now - this.lastTaskRecordWriteAt >= 30000)) {
          try {
            this.state.set(
              "taskPerformanceRecords",
              recordUpdate.records,
              {
                forceBackup: pendingTasks.length > 0 ||
                  recordUpdate.historyChanged
              }
            );
            this.lastTaskRecordWriteAt = now;
          } catch {}
        } else if (historySnapshotChanged) {
          try {
            this.state.set("taskHistorySnapshot", result.historySnapshot);
          } catch {}
        }
        const { terminalTasks, history, historySnapshot, ...publicResult } = result;
        return {
          ...publicResult,
          pendingTasks,
          completedTasks: pendingTasks,
          records: recordUpdate.records
        };
      })
      .catch(() => ({
        ...normalizeActiveTaskResult(null, now),
        pendingTasks: [],
        completedTasks: [],
        records: this.latestTaskRecords || normalizeTaskPerformanceRecords([this.state.data])
      }))
      .finally(() => {
        this.activeTaskInFlight = null;
      });
    return this.activeTaskInFlight;
  }

  async performRead() {
    const checkedAt = Date.now();
    const checkpointPromise = this.checkpointReader?.read(checkedAt, this.state.data.resetCheckpointSnapshot)
      .catch(() => null) || Promise.resolve(null);
    const quotaPromise = Promise.resolve().then(() => this.client.readRateLimits());
    const reservePromise = quotaPromise.then(raw => {
      const buckets = raw?.rateLimitsByLimitId;
      const reserve = buckets?.["gpt-reserve"] || buckets?.gpt_reserve ||
        (buckets && Object.values(buckets).find(bucket => bucket?.limitId === "gpt-reserve"));
      const hasReserve = Boolean(identifyWindows(reserve).weekly);
      return !hasReserve && this.reserveReader ? this.reserveReader.read() : null;
    }).catch(() => null);
    const saveCheckpoints = checkpoint => {
      if (checkpoint?.available) this.state.set("resetCheckpointSnapshot", checkpoint);
      return checkpoint;
    };
    const versionPromise = this.versionDetector.read(checkedAt).catch(() => null);
    const tokenUsagePromise = typeof this.client.readTokenUsage === "function"
      ? Promise.resolve().then(() => this.client.readTokenUsage()).catch(() => null)
      : Promise.resolve(null);
    const tokenCostPromise = typeof this.costUsageReader?.read === "function"
      ? Promise.resolve()
        .then(() => this.costUsageReader.read(checkedAt, this.state.data.tokenCostSnapshot))
        .catch(() => null)
      : Promise.resolve(null);
    const activeTasksPromise = this.readActiveTasks(checkedAt);
    const subscriptionPromise = typeof this.subscriptionReader?.read === "function"
      ? Promise.resolve().then(() => this.subscriptionReader.read()).catch(() => null)
      : Promise.resolve(null);
    try {
      const [
        raw,
        tokenUsageRaw,
        tokenCostRaw,
        activeTasksRaw,
        installedVersion,
        subscriptionRaw
      ] = await Promise.all([
        quotaPromise,
        tokenUsagePromise,
        tokenCostPromise,
        activeTasksPromise,
        versionPromise,
        subscriptionPromise
      ]);
      const normalized = normalizeQuotaResponse(raw, this.state.data, Math.floor(checkedAt / 1000), { officialResetSource: "community" });
      if (!normalized.reserve) normalized.reserve = await reservePromise;
      const resetCheckpoints = saveCheckpoints(await checkpointPromise);
      const persisted = normalized.persistence;
      delete normalized.persistence;
      const tokenUsage = normalizeTokenUsageResponse(tokenUsageRaw, this.state.data, checkedAt);
      const tokenCost = normalizeCodexCostUsageResult(
        tokenCostRaw,
        this.state.data,
        checkedAt,
        tokenUsage
      );
      const activeTasks = activeTasksRaw;
      const clientUpdate = evaluateClientUpdate(installedVersion, this.state.data, checkedAt);
      const subscription = normalizeSubscriptionDetails(subscriptionRaw, {
        planType: normalized.planType,
        totalWorkDays: tokenUsage.totalWorkDays
      }, Math.floor(checkedAt / 1000));
      Object.assign(
        this.state.data,
        persisted,
        tokenUsage.persistence,
        tokenCost.persistence,
        clientUpdate.persistence
      );
      this.state.set("lastSuccessfulAt", checkedAt);
      return {
        online: true,
        resetCheckpoints,
        checkedAt,
        lastSuccessfulAt: checkedAt,
        data: normalized,
        receivedResetHistory: normalized.events.newReset.history,
        consumedResetHistory: normalized.events.manualReset.history,
        tokenUsage: withoutPersistence(tokenUsage),
        tokenCost: withoutPersistence(tokenCost),
        activeTasks,
        subscription,
        clientUpdate,
        errorCode: null
      };
    } catch (error) {
      this.client.dispose();
      const tokenUsage = normalizeTokenUsageResponse(null, this.state.data, checkedAt);
      const tokenCostRaw = await tokenCostPromise;
      const tokenCost = normalizeCodexCostUsageResult(
        tokenCostRaw,
        this.state.data,
        checkedAt,
        tokenUsage
      );
      const activeTasksRaw = await activeTasksPromise;
      const activeTasks = activeTasksRaw;
      const installedVersion = await versionPromise;
      const subscriptionRaw = await subscriptionPromise;
      const clientUpdate = evaluateClientUpdate(installedVersion, this.state.data, checkedAt);
      const subscription = normalizeSubscriptionDetails(subscriptionRaw, {
        totalWorkDays: tokenUsage.totalWorkDays
      }, Math.floor(checkedAt / 1000));
      Object.assign(this.state.data, tokenCost.persistence, clientUpdate.persistence);
      this.state.set("lastClientVersionCheckAt", checkedAt);
      const message = String(error?.message || error);
      let errorCode = "NETWORK_ERROR";
      if (message.includes("CODEX_NOT_INSTALLED")) errorCode = "CODEX_NOT_INSTALLED";
      else if (/not logged|unauthor|auth|account/i.test(message)) errorCode = "NOT_LOGGED_IN";
      else if (/timeout/i.test(message)) errorCode = "TIMEOUT";
      return {
        online: false,
        resetCheckpoints: saveCheckpoints(await checkpointPromise),
        checkedAt,
        lastSuccessfulAt: this.state.get("lastSuccessfulAt", null),
        data: null,
        receivedResetHistory: normalizeReceivedResetHistory(this.state.data),
        consumedResetHistory: normalizeConsumedResetHistory(this.state.data),
        officialResetHistory: [],
        tokenUsage: withoutPersistence(tokenUsage),
        tokenCost: withoutPersistence(tokenCost),
        activeTasks,
        subscription,
        clientUpdate,
        errorCode
      };
    }
  }

  dispose() {
    if (this.latestTaskRecords) {
      try { this.state.set("taskPerformanceRecords", this.latestTaskRecords); } catch {}
    }
    this.client.dispose();
    this.localUsage?.dispose();
  }
}

function withoutPersistence(value) {
  const result = { ...value };
  delete result.persistence;
  return result;
}

module.exports = { QuotaService, AppServerClient };
