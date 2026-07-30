const fsSync = require("node:fs");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const readline = require("node:readline");

const {
  PRICING_DATE,
  summarizeRolloutLines
} = require("./codex-cost-usage");

const ACTIVE_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1_000;
const PROJECT_HEAD_BYTES = 64 * 1024;
const INITIAL_TAIL_BYTES = 256 * 1024;
const MAX_ACTIVE_TURN_BYTES = 64 * 1024 * 1024;
const MAX_CANDIDATE_FILES = 96;
const MAX_ACTIVE_TASKS = 32;
const MAX_TOTAL_SCAN_BYTES = 256 * 1024 * 1024;
const MAX_HISTORY_FILES = 1_000;
const MAX_HISTORY_FILE_BYTES = 512 * 1024 * 1024;
const MAX_HISTORY_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
const HISTORY_CACHE_MS = 15 * 60 * 1_000;

const TASK_OUTCOMES = new Set([
  "completed",
  "manual-interrupted",
  "abnormal-interrupted"
]);

function normalizeTimestampSeconds(value, fallback) {
  if (Number.isFinite(value) && value > 0) return Math.floor(value);
  const parsed = typeof fallback === "string" ? Date.parse(fallback) : NaN;
  return Number.isFinite(parsed) ? Math.floor(parsed / 1_000) : null;
}

function normalizeTurnId(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 128 || !/^[a-zA-Z0-9._:-]+$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeProjectName(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/[\\/]+$/, "");
  if (!trimmed || trimmed.length > 1_024) return null;
  const basename = path.win32.basename(trimmed) || path.posix.basename(trimmed);
  const normalized = basename
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 80);
  return normalized || null;
}

function normalizeTaskOutcome(value) {
  return TASK_OUTCOMES.has(value) ? value : "abnormal-interrupted";
}

function parseRelevantRecord(line) {
  if (typeof line !== "string" || !line) return null;
  const isLifecycle = line.includes('"type":"task_started"') ||
    line.includes('"type":"task_complete"') ||
    line.includes('"type":"turn_aborted"');
  const isSession = line.includes('"type":"session_meta"');
  if (!isLifecycle && !isSession) return null;
  try {
    const record = JSON.parse(line);
    const payloadType = record?.payload?.type;
    if (
      record?.type === "event_msg" &&
      ["task_started", "task_complete", "turn_aborted"].includes(payloadType)
    ) {
      const durationMs = Number(record.payload.duration_ms);
      const reason = typeof record.payload.reason === "string" &&
        record.payload.reason.length <= 64
        ? record.payload.reason.trim().toLowerCase()
        : null;
      return {
        kind: payloadType,
        startedAt: normalizeTimestampSeconds(record.payload.started_at),
        eventAt: normalizeTimestampSeconds(
          record.payload.completed_at,
          record.timestamp
        ),
        durationSeconds: Number.isFinite(durationMs) && durationMs >= 0
          ? Math.floor(durationMs / 1_000)
          : null,
        completedAtExplicit: Number.isFinite(record.payload.completed_at),
        reason,
        turnId: normalizeTurnId(record.payload.turn_id)
      };
    }
    if (record?.type === "session_meta") {
      return {
        kind: "session_meta",
        projectName: normalizeProjectName(record?.payload?.cwd)
      };
    }
  } catch {
    return null;
  }
  return null;
}

function terminalDuration(startRecord, terminalRecord, syntheticEvidence = false) {
  if (Number.isFinite(terminalRecord?.durationSeconds)) {
    return {
      elapsedSeconds: Math.max(0, terminalRecord.durationSeconds),
      durationKnown: true
    };
  }
  if (
    terminalRecord?.completedAtExplicit &&
    Number.isFinite(terminalRecord.eventAt) &&
    Number.isFinite(startRecord?.startedAt)
  ) {
    return {
      elapsedSeconds: Math.max(0, terminalRecord.eventAt - startRecord.startedAt),
      durationKnown: true
    };
  }
  const evidenceStartedAt = startRecord?.eventAt ?? startRecord?.startedAt;
  if (
    syntheticEvidence &&
    Number.isFinite(terminalRecord?.eventAt) &&
    Number.isFinite(evidenceStartedAt)
  ) {
    return {
      elapsedSeconds: Math.max(0, terminalRecord.eventAt - evidenceStartedAt),
      durationKnown: true
    };
  }
  return { elapsedSeconds: 0, durationKnown: false };
}

function isLifecycleRecord(record) {
  return Boolean(record && [
    "task_started",
    "task_complete",
    "turn_aborted"
  ].includes(record.kind));
}

function findLastLifecycle(lines) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const record = parseRelevantRecord(lines[index]);
    if (isLifecycleRecord(record)) return { index, record };
  }
  return null;
}

function findMatchingStart(lines, terminalIndex, turnId) {
  for (let index = terminalIndex - 1; index >= 0; index -= 1) {
    const record = parseRelevantRecord(lines[index]);
    if (record?.kind !== "task_started") continue;
    if (!turnId || !record.turnId || record.turnId === turnId) {
      return { index, record };
    }
  }
  return null;
}

function projectNameFromLines(lines, fallback) {
  let projectName = normalizeProjectName(fallback);
  for (const line of lines) {
    const record = parseRelevantRecord(line);
    if (record?.kind === "session_meta" && record.projectName) {
      projectName = record.projectName;
    }
  }
  return projectName;
}

function timestampFromLine(line) {
  if (typeof line !== "string") return null;
  const match = line.match(/"timestamp":"([^"]{10,40})"/);
  return match ? normalizeTimestampSeconds(null, match[1]) : null;
}

function latestTimestampFromLines(lines, fallback = null) {
  let latest = Number.isFinite(fallback) ? fallback : null;
  for (const line of Array.isArray(lines) ? lines : []) {
    const timestamp = timestampFromLine(line);
    if (timestamp && (!latest || timestamp > latest)) latest = timestamp;
  }
  return latest;
}

function normalizeCostModels(models) {
  return (Array.isArray(models) ? models : []).slice(0, 32).map(model => ({
    model: typeof model?.model === "string" ? model.model.slice(0, 128) : "unknown",
    estimatedCostUsd: Number.isFinite(model?.estimatedCostUsd)
      ? Math.max(0, model.estimatedCostUsd)
      : null,
    priced: Boolean(model?.priced),
    inputTokens: Number.isFinite(model?.inputTokens)
      ? Math.max(0, Math.floor(model.inputTokens))
      : 0,
    cachedInputTokens: Number.isFinite(model?.cachedInputTokens)
      ? Math.max(0, Math.floor(model.cachedInputTokens))
      : 0,
    outputTokens: Number.isFinite(model?.outputTokens)
      ? Math.max(0, Math.floor(model.outputTokens))
      : 0
  }));
}

function summarizeTaskCost(lines, now) {
  const cost = summarizeRolloutLines([{ lines }], now);
  return {
    estimatedCostUsd: cost.estimatedCostUsd,
    hasUnpricedModels: cost.hasUnpricedModels,
    models: normalizeCostModels(cost.models)
  };
}

function summarizeTaskWindow(lines, now = Date.now(), metadata = {}) {
  const safeLines = Array.isArray(lines) ? lines : [];
  const lifecycle = findLastLifecycle(safeLines);
  if (!lifecycle) return { task: null, terminalTask: null, lifecycleKey: null };

  const nowSeconds = Math.floor(now / 1_000);
  const projectName = projectNameFromLines(safeLines, metadata.projectName);
  if (lifecycle.record.kind === "task_started") {
    const startedAt = lifecycle.record.startedAt;
    if (!Number.isFinite(startedAt) || startedAt <= 0 || startedAt > nowSeconds + 300) {
      return { task: null, terminalTask: null, lifecycleKey: null };
    }
    const cost = summarizeTaskCost(safeLines.slice(lifecycle.index), now);
    return {
      task: {
        id: lifecycle.record.turnId,
        projectName,
        startedAt,
        elapsedSeconds: Math.max(0, nowSeconds - startedAt),
        ...cost,
        partial: Boolean(metadata.partial),
        pricingDate: PRICING_DATE
      },
      terminalTask: null,
      lifecycleKey: `started:${lifecycle.record.turnId || startedAt}`
    };
  }

  const start = findMatchingStart(
    safeLines,
    lifecycle.index,
    lifecycle.record.turnId
  );
  const startedAt = lifecycle.record.startedAt || start?.record?.startedAt;
  const endedAt = lifecycle.record.eventAt;
  if (!Number.isFinite(startedAt) || startedAt <= 0) {
    return {
      task: null,
      terminalTask: null,
      lifecycleKey: `${lifecycle.record.kind}:${lifecycle.record.turnId || endedAt || "unknown"}`
    };
  }
  const duration = terminalDuration(start?.record, lifecycle.record);
  const cost = summarizeTaskCost(
    safeLines.slice(start?.index ?? 0, lifecycle.index + 1),
    now
  );
  const outcome = lifecycle.record.kind === "task_complete"
    ? "completed"
    : (
        lifecycle.record.reason === "interrupted"
          ? "manual-interrupted"
          : "abnormal-interrupted"
      );
  return {
    task: null,
    terminalTask: {
      id: lifecycle.record.turnId || start?.record?.turnId,
      projectName,
      startedAt,
      endedAt: Number.isFinite(endedAt)
        ? endedAt
        : startedAt + duration.elapsedSeconds,
      completedAt: (
        Number.isFinite(endedAt) ? endedAt : startedAt + duration.elapsedSeconds
      ) * 1_000,
      elapsedSeconds: duration.elapsedSeconds,
      durationKnown: duration.durationKnown,
      outcome,
      ...cost,
      partial: Boolean(metadata.partial),
      pricingDate: PRICING_DATE
    },
    lifecycleKey: `${outcome}:${lifecycle.record.turnId || startedAt}:${
      Number.isFinite(endedAt) ? endedAt : duration.elapsedSeconds
    }`
  };
}

function summarizeActiveTaskLines(lines, now = Date.now(), metadata = {}) {
  return summarizeTaskWindow(lines, now, metadata).task;
}

async function readProjectNameFromHead(handle, fileSize, byteBudget) {
  const size = Math.min(fileSize, PROJECT_HEAD_BYTES, byteBudget);
  if (size <= 0) return { projectName: null, bytesRead: 0 };
  const buffer = Buffer.alloc(size);
  const { bytesRead } = await handle.read(buffer, 0, size, 0);
  const lines = buffer.subarray(0, bytesRead).toString("utf8").split(/\r?\n/);
  for (const line of lines) {
    const record = parseRelevantRecord(line);
    if (record?.kind === "session_meta" && record.projectName) {
      return { projectName: record.projectName, bytesRead };
    }
  }
  return { projectName: null, bytesRead };
}

function rolloutFileIdentity(file) {
  return path.basename(file?.path || "").toLowerCase();
}

function preferMoreCompleteRollout(left, right) {
  if (right.size !== left.size) return right.size > left.size ? right : left;
  if (right.mtimeMs !== left.mtimeMs) return right.mtimeMs > left.mtimeMs ? right : left;
  return right.path.localeCompare(left.path) < 0 ? right : left;
}

async function listRolloutFiles(roots, now, lookbackMs = null) {
  const found = [];
  async function visit(root, directory, archived) {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(root, candidate, archived);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        const stat = await fs.stat(candidate);
        if (Number.isFinite(lookbackMs) && now - stat.mtimeMs > lookbackMs) continue;
        found.push({
          path: candidate,
          size: stat.size,
          mtimeMs: Math.floor(stat.mtimeMs),
          archived
        });
      }
    }
  }
  for (let index = 0; index < roots.length; index += 1) {
    await visit(roots[index], roots[index], index > 0);
  }
  const unique = new Map();
  for (const file of found) {
    const identity = rolloutFileIdentity(file);
    const existing = unique.get(identity);
    unique.set(identity, existing ? preferMoreCompleteRollout(existing, file) : file);
  }
  return [...unique.values()];
}

async function readTaskWindow(file, byteBudget) {
  const handle = await fs.open(file.path, "r");
  let windowBytes = Math.min(file.size, INITIAL_TAIL_BYTES, byteBudget);
  let bytesReadTotal = 0;
  try {
    while (windowBytes > 0) {
      const start = Math.max(0, file.size - windowBytes);
      const buffer = Buffer.alloc(file.size - start);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
      bytesReadTotal += bytesRead;
      const rawLines = buffer.subarray(0, bytesRead).toString("utf8").split(/\r?\n/);
      const lines = start > 0 ? rawLines.slice(1) : rawLines;
      const lifecycle = findLastLifecycle(lines);
      const hasRequiredStart = lifecycle?.record?.kind === "task_started" ||
        Boolean(lifecycle && findMatchingStart(
          lines,
          lifecycle.index,
          lifecycle.record.turnId
        ));
      if (lifecycle && (hasRequiredStart || start === 0)) {
        const head = await readProjectNameFromHead(
          handle,
          file.size,
          Math.max(0, byteBudget - bytesReadTotal)
        );
        bytesReadTotal += head.bytesRead;
        return {
          lines,
          bytesRead: bytesReadTotal,
          partial: !hasRequiredStart,
          projectName: head.projectName
        };
      }
      if (start === 0 || windowBytes >= MAX_ACTIVE_TURN_BYTES || windowBytes >= byteBudget) {
        return { lines: [], bytesRead: bytesReadTotal, partial: start > 0 };
      }
      windowBytes = Math.min(
        file.size,
        windowBytes * 2,
        MAX_ACTIVE_TURN_BYTES,
        byteBudget
      );
    }
  } finally {
    await handle.close();
  }
  return { lines: [], bytesRead: bytesReadTotal, partial: false };
}

function createTaskHistory(observedAt, truncated = false) {
  return {
    available: true,
    totalTaskCount: 0,
    timedTaskCount: 0,
    totalElapsedSeconds: 0,
    totalEstimatedCostUsd: 0,
    completedTaskCount: 0,
    manualInterruptedTaskCount: 0,
    abnormalInterruptedTaskCount: 0,
    longestElapsedSeconds: 0,
    highestEstimatedCostUsd: 0,
    observedAt,
    truncated
  };
}

function addTaskToHistory(history, task) {
  if (!task) return;
  const elapsedSeconds = Math.max(0, Math.floor(Number(task.elapsedSeconds) || 0));
  const cost = Number(task.estimatedCostUsd);
  history.totalTaskCount += 1;
  if (task.durationKnown) {
    history.timedTaskCount += 1;
    history.totalElapsedSeconds += elapsedSeconds;
    history.longestElapsedSeconds = Math.max(
      history.longestElapsedSeconds,
      elapsedSeconds
    );
  }
  if (Number.isFinite(cost) && cost >= 0) {
    history.totalEstimatedCostUsd += cost;
    history.highestEstimatedCostUsd = Math.max(history.highestEstimatedCostUsd, cost);
  }
  if (task.outcome === "completed") history.completedTaskCount += 1;
  else if (task.outcome === "manual-interrupted") history.manualInterruptedTaskCount += 1;
  else history.abnormalInterruptedTaskCount += 1;
}

function finalizeHistory(history) {
  history.totalTaskCount = Math.max(0, Math.floor(history.totalTaskCount));
  history.timedTaskCount = Math.max(0, Math.floor(history.timedTaskCount));
  history.totalElapsedSeconds = Math.max(0, Math.floor(history.totalElapsedSeconds));
  history.totalEstimatedCostUsd = Number(history.totalEstimatedCostUsd.toFixed(6));
  history.highestEstimatedCostUsd = Number(history.highestEstimatedCostUsd.toFixed(6));
  return history;
}

async function scanTaskHistoryFile(file, history, now) {
  let projectName = null;
  let active = null;
  let lastObservedAt = null;
  const stream = fsSync.createReadStream(file.path, { encoding: "utf8" });
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });

  function finishActive(
    terminal,
    outcomeOverride = null,
    syntheticDurationEvidence = false
  ) {
    if (!active) return;
    const endedAt = Number.isFinite(terminal?.eventAt)
      ? terminal.eventAt
      : Math.max(active.startedAt, Math.floor(file.mtimeMs / 1_000));
    const duration = terminalDuration(
      {
        startedAt: active.startedAt,
        eventAt: active.eventAt
      },
      terminal,
      syntheticDurationEvidence
    );
    const cost = summarizeTaskCost(active.costLines, now);
    addTaskToHistory(history, {
      elapsedSeconds: duration.elapsedSeconds,
      durationKnown: duration.durationKnown,
      estimatedCostUsd: cost.estimatedCostUsd,
      outcome: outcomeOverride || (
        terminal?.kind === "task_complete"
          ? "completed"
          : (
              terminal?.reason === "interrupted"
                ? "manual-interrupted"
                : "abnormal-interrupted"
            )
      )
    });
    active = null;
  }

  for await (const line of lines) {
    const lineTimestamp = timestampFromLine(line);
    if (lineTimestamp && (!lastObservedAt || lineTimestamp > lastObservedAt)) {
      lastObservedAt = lineTimestamp;
    }
    const record = parseRelevantRecord(line);
    if (record?.kind === "session_meta") {
      if (record.projectName) projectName = record.projectName;
      continue;
    }
    if (record?.kind === "task_started") {
      if (active) {
        finishActive({
          eventAt: record.eventAt || record.startedAt,
          durationSeconds: null
        }, "abnormal-interrupted", true);
      }
      if (Number.isFinite(record.startedAt) && record.startedAt > 0) {
        active = {
          turnId: record.turnId,
          startedAt: record.startedAt,
          eventAt: record.eventAt,
          projectName,
          costLines: []
        };
      }
      continue;
    }
    if (
      active &&
      record &&
      (record.kind === "task_complete" || record.kind === "turn_aborted") &&
      (!record.turnId || !active.turnId || record.turnId === active.turnId)
    ) {
      finishActive(record);
      continue;
    }
    if (
      active &&
      (
        line.includes('"type":"turn_context"') ||
        (
          line.includes('"type":"event_msg"') &&
          line.includes('"type":"token_count"')
        )
      )
    ) {
      active.costLines.push(line);
    }
  }

  if (active && file.archived) {
    finishActive({
      eventAt: lastObservedAt,
      durationSeconds: null
    }, "abnormal-interrupted", true);
  }
}

function selectHistoryFiles(files) {
  const sorted = files.sort((left, right) => (
    rolloutFileIdentity(left).localeCompare(rolloutFileIdentity(right))
  ));
  let truncated = sorted.length > MAX_HISTORY_FILES;
  const candidates = sorted.slice(-MAX_HISTORY_FILES);
  const selected = [];
  let totalBytes = 0;
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const file = candidates[index];
    if (
      file.size > MAX_HISTORY_FILE_BYTES ||
      totalBytes + file.size > MAX_HISTORY_TOTAL_BYTES
    ) {
      truncated = true;
      continue;
    }
    selected.push(file);
    totalBytes += file.size;
  }
  selected.reverse();
  return { files: selected, truncated };
}

function normalizeTerminalTask(value) {
  const startedAt = normalizeTimestampSeconds(value?.startedAt);
  if (!startedAt) return null;
  const endedAt = normalizeTimestampSeconds(value?.endedAt) ||
    Math.max(startedAt, Math.floor(Number(value?.completedAt) / 1_000) || startedAt);
  return {
    id: normalizeTurnId(value?.id),
    projectName: normalizeProjectName(value?.projectName),
    startedAt,
    endedAt,
    completedAt: endedAt * 1_000,
    elapsedSeconds: Number.isFinite(value?.elapsedSeconds)
      ? Math.max(0, Math.floor(value.elapsedSeconds))
      : Math.max(0, endedAt - startedAt),
    durationKnown: value?.durationKnown !== false,
    outcome: normalizeTaskOutcome(value?.outcome),
    estimatedCostUsd: Number.isFinite(value?.estimatedCostUsd)
      ? Math.max(0, value.estimatedCostUsd)
      : null,
    hasUnpricedModels: Boolean(value?.hasUnpricedModels),
    models: normalizeCostModels(value?.models),
    partial: Boolean(value?.partial),
    pricingDate: typeof value?.pricingDate === "string" ? value.pricingDate : PRICING_DATE
  };
}

function normalizeTaskHistory(value, now = Date.now()) {
  if (!value?.available) {
    return {
      ...createTaskHistory(null, false),
      available: false,
      observedAt: null
    };
  }
  const count = key => Number.isFinite(value[key])
    ? Math.max(0, Math.floor(value[key]))
    : 0;
  const money = key => Number.isFinite(value[key]) ? Math.max(0, value[key]) : 0;
  return {
    available: true,
    totalTaskCount: count("totalTaskCount"),
    timedTaskCount: count("timedTaskCount"),
    totalElapsedSeconds: count("totalElapsedSeconds"),
    totalEstimatedCostUsd: money("totalEstimatedCostUsd"),
    completedTaskCount: count("completedTaskCount"),
    manualInterruptedTaskCount: count("manualInterruptedTaskCount"),
    abnormalInterruptedTaskCount: count("abnormalInterruptedTaskCount"),
    longestElapsedSeconds: count("longestElapsedSeconds"),
    highestEstimatedCostUsd: money("highestEstimatedCostUsd"),
    observedAt: Number.isFinite(value.observedAt) ? value.observedAt : now,
    truncated: Boolean(value.truncated)
  };
}

class CodexActiveTaskReader {
  constructor({
    sessionsRoot,
    archivedSessionsRoot,
    sessionRoots,
    historyCacheMs = HISTORY_CACHE_MS
  } = {}) {
    const codexRoot = path.join(os.homedir(), ".codex");
    const primaryRoot = sessionsRoot || path.join(codexRoot, "sessions");
    const defaultArchivedRoot = sessionsRoot
      ? path.join(path.dirname(primaryRoot), "archived_sessions")
      : path.join(codexRoot, "archived_sessions");
    const configuredRoots = Array.isArray(sessionRoots) && sessionRoots.length
      ? sessionRoots
      : [primaryRoot, archivedSessionsRoot || defaultArchivedRoot];
    this.sessionRoots = [...new Set(
      configuredRoots
        .filter(root => typeof root === "string" && root.trim())
        .map(root => path.resolve(root))
    )];
    this.historyCacheMs = historyCacheMs;
    this.cachedHistory = null;
    this.cachedHistoryAt = 0;
    this.cachedLifecycleFingerprint = null;
  }

  async readHistory(now, lifecycleFingerprint) {
    if (
      this.cachedHistory &&
      this.cachedLifecycleFingerprint === lifecycleFingerprint &&
      now - this.cachedHistoryAt >= 0 &&
      now - this.cachedHistoryAt < this.historyCacheMs
    ) {
      return this.cachedHistory;
    }
    const inventory = await listRolloutFiles(this.sessionRoots, now);
    const bounded = selectHistoryFiles(inventory);
    const history = createTaskHistory(now, bounded.truncated);
    for (const file of bounded.files) await scanTaskHistoryFile(file, history, now);
    this.cachedHistory = finalizeHistory(history);
    this.cachedHistoryAt = now;
    this.cachedLifecycleFingerprint = lifecycleFingerprint;
    return this.cachedHistory;
  }

  async read(now = Date.now()) {
    const inventory = await listRolloutFiles(
      this.sessionRoots,
      now,
      ACTIVE_LOOKBACK_MS
    );
    const recentFiles = inventory
      .sort((left, right) => right.mtimeMs - left.mtimeMs)
      .slice(0, MAX_CANDIDATE_FILES);
    const tasks = [];
    const terminalTasks = [];
    const lifecycleParts = [];
    let scannedBytes = 0;
    let truncated = inventory.length > MAX_CANDIDATE_FILES;

    for (const file of recentFiles) {
      if (scannedBytes >= MAX_TOTAL_SCAN_BYTES) {
        truncated = true;
        break;
      }
      const remainingBudget = MAX_TOTAL_SCAN_BYTES - scannedBytes;
      const window = await readTaskWindow(file, remainingBudget);
      scannedBytes += window.bytesRead;
      const summary = summarizeTaskWindow(window.lines, now, {
        partial: window.partial,
        projectName: window.projectName
      });
      lifecycleParts.push(
        `${rolloutFileIdentity(file)}:${file.archived ? "a" : "s"}:${
          summary.lifecycleKey || "none"
        }`
      );
      if (summary.task) {
        if (file.archived) {
          const endedAt = Math.max(
            summary.task.startedAt,
            latestTimestampFromLines(window.lines, summary.task.startedAt)
          );
          terminalTasks.push({
            ...summary.task,
            endedAt,
            completedAt: endedAt * 1_000,
            elapsedSeconds: Math.max(0, endedAt - summary.task.startedAt),
            durationKnown: true,
            outcome: "abnormal-interrupted"
          });
        } else if (tasks.length < MAX_ACTIVE_TASKS) {
          tasks.push(summary.task);
        } else {
          truncated = true;
        }
      } else if (summary.terminalTask) {
        terminalTasks.push(summary.terminalTask);
      }
    }

    tasks.sort((left, right) => left.startedAt - right.startedAt);
    terminalTasks.sort((left, right) => right.completedAt - left.completedAt);
    const lifecycleFingerprint = lifecycleParts.sort().join("|");
    let history;
    try {
      history = await this.readHistory(now, lifecycleFingerprint);
    } catch {
      history = this.cachedHistory || normalizeTaskHistory(null, now);
    }
    return {
      available: true,
      tasks,
      terminalTasks: terminalTasks.slice(0, MAX_CANDIDATE_FILES),
      history,
      count: tasks.length,
      truncated,
      observedAt: now,
      pricingDate: PRICING_DATE
    };
  }
}

function normalizeActiveTask(value, now) {
  const startedAt = normalizeTimestampSeconds(value?.startedAt);
  if (!startedAt) return null;
  return {
    id: normalizeTurnId(value?.id),
    projectName: normalizeProjectName(value?.projectName),
    startedAt,
    elapsedSeconds: Math.max(0, Math.floor(now / 1_000) - startedAt),
    estimatedCostUsd: Number.isFinite(value?.estimatedCostUsd)
      ? Math.max(0, value.estimatedCostUsd)
      : null,
    hasUnpricedModels: Boolean(value?.hasUnpricedModels),
    models: normalizeCostModels(value?.models),
    partial: Boolean(value?.partial),
    pricingDate: typeof value?.pricingDate === "string" ? value.pricingDate : PRICING_DATE
  };
}

function normalizeActiveTaskResult(raw, now = Date.now()) {
  if (!raw?.available || !Array.isArray(raw.tasks)) {
    return {
      available: false,
      tasks: [],
      terminalTasks: [],
      history: normalizeTaskHistory(null, now),
      count: 0,
      truncated: false,
      observedAt: null,
      pricingDate: PRICING_DATE
    };
  }
  const tasks = raw.tasks
    .map(task => normalizeActiveTask(task, now))
    .filter(Boolean)
    .slice(0, MAX_ACTIVE_TASKS)
    .sort((left, right) => left.startedAt - right.startedAt);
  const terminalTasks = (Array.isArray(raw.terminalTasks) ? raw.terminalTasks : [])
    .map(normalizeTerminalTask)
    .filter(Boolean)
    .slice(0, MAX_CANDIDATE_FILES);
  return {
    available: true,
    tasks,
    terminalTasks,
    history: normalizeTaskHistory(raw.history, now),
    count: tasks.length,
    truncated: Boolean(raw.truncated),
    observedAt: Number.isFinite(raw.observedAt) ? raw.observedAt : now,
    pricingDate: typeof raw.pricingDate === "string" ? raw.pricingDate : PRICING_DATE
  };
}

module.exports = {
  ACTIVE_LOOKBACK_MS,
  CodexActiveTaskReader,
  normalizeActiveTaskResult,
  normalizeProjectName,
  normalizeTaskHistory,
  summarizeActiveTaskLines,
  summarizeTaskWindow
};
