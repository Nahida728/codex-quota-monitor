const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

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

function parseRelevantRecord(line) {
  if (typeof line !== "string" || !line) return null;
  const isLifecycle = line.includes('"type":"task_started"') ||
    line.includes('"type":"task_complete"');
  const isSession = line.includes('"type":"session_meta"');
  if (!isLifecycle && !isSession) return null;
  try {
    const record = JSON.parse(line);
    if (
      record?.type === "event_msg" &&
      (record?.payload?.type === "task_started" || record?.payload?.type === "task_complete")
    ) {
      return {
        kind: record.payload.type,
        startedAt: normalizeTimestampSeconds(record.payload.started_at, record.timestamp),
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

function findLastLifecycle(lines) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const record = parseRelevantRecord(lines[index]);
    if (record?.kind === "task_started" || record?.kind === "task_complete") {
      return { index, record };
    }
  }
  return null;
}

function summarizeActiveTaskLines(lines, now = Date.now(), metadata = {}) {
  const safeLines = Array.isArray(lines) ? lines : [];
  const lifecycle = findLastLifecycle(safeLines);
  if (!lifecycle || lifecycle.record.kind !== "task_started") return null;

  const startedAt = lifecycle.record.startedAt;
  const nowSeconds = Math.floor(now / 1_000);
  if (!Number.isFinite(startedAt) || startedAt <= 0 || startedAt > nowSeconds + 300) return null;

  const activeLines = safeLines.slice(lifecycle.index);
  let projectName = normalizeProjectName(metadata.projectName);
  for (const line of safeLines) {
    const record = parseRelevantRecord(line);
    if (record?.kind === "session_meta" && record.projectName) {
      projectName = record.projectName;
    }
  }

  const cost = summarizeRolloutLines([{ lines: activeLines }], now);
  return {
    id: lifecycle.record.turnId,
    projectName,
    startedAt,
    elapsedSeconds: Math.max(0, nowSeconds - startedAt),
    estimatedCostUsd: cost.estimatedCostUsd,
    hasUnpricedModels: cost.hasUnpricedModels,
    models: cost.models.map(model => ({
      model: model.model,
      estimatedCostUsd: model.estimatedCostUsd,
      priced: model.priced,
      inputTokens: model.inputTokens,
      cachedInputTokens: model.cachedInputTokens,
      outputTokens: model.outputTokens
    })),
    partial: Boolean(metadata.partial),
    pricingDate: PRICING_DATE
  };
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

async function listRecentRolloutFiles(root, now) {
  const files = [];
  async function visit(directory) {
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
        await visit(candidate);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        const stat = await fs.stat(candidate);
        if (now - stat.mtimeMs <= ACTIVE_LOOKBACK_MS) {
          files.push({
            path: candidate,
            size: stat.size,
            mtimeMs: Math.floor(stat.mtimeMs)
          });
        }
      }
    }
  }
  await visit(root);
  return files
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .slice(0, MAX_CANDIDATE_FILES);
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
      if (lifecycle) {
        const head = lifecycle.record.kind === "task_started"
          ? await readProjectNameFromHead(
              handle,
              file.size,
              Math.max(0, byteBudget - bytesReadTotal)
            )
          : { projectName: null, bytesRead: 0 };
        bytesReadTotal += head.bytesRead;
        return {
          lines,
          bytesRead: bytesReadTotal,
          partial: false,
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

class CodexActiveTaskReader {
  constructor({ sessionsRoot } = {}) {
    this.sessionsRoot = sessionsRoot || path.join(os.homedir(), ".codex", "sessions");
  }

  async read(now = Date.now()) {
    const files = await listRecentRolloutFiles(this.sessionsRoot, now);
    const tasks = [];
    let scannedBytes = 0;
    let truncated = files.length >= MAX_CANDIDATE_FILES;

    for (const file of files) {
      if (tasks.length >= MAX_ACTIVE_TASKS || scannedBytes >= MAX_TOTAL_SCAN_BYTES) {
        truncated = true;
        break;
      }
      const remainingBudget = MAX_TOTAL_SCAN_BYTES - scannedBytes;
      const window = await readTaskWindow(file, remainingBudget);
      scannedBytes += window.bytesRead;
      const task = summarizeActiveTaskLines(window.lines, now, {
        partial: window.partial,
        projectName: window.projectName
      });
      if (task) tasks.push(task);
    }

    tasks.sort((left, right) => left.startedAt - right.startedAt);
    return {
      available: true,
      tasks,
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
  const models = Array.isArray(value?.models)
    ? value.models.slice(0, 32).map(model => ({
        model: typeof model?.model === "string" ? model.model.slice(0, 128) : "unknown",
        estimatedCostUsd: Number.isFinite(model?.estimatedCostUsd)
          ? Math.max(0, model.estimatedCostUsd)
          : null,
        priced: Boolean(model?.priced),
        inputTokens: Number.isFinite(model?.inputTokens) ? Math.max(0, Math.floor(model.inputTokens)) : 0,
        cachedInputTokens: Number.isFinite(model?.cachedInputTokens)
          ? Math.max(0, Math.floor(model.cachedInputTokens))
          : 0,
        outputTokens: Number.isFinite(model?.outputTokens)
          ? Math.max(0, Math.floor(model.outputTokens))
          : 0
      }))
    : [];
  return {
    id: normalizeTurnId(value?.id),
    projectName: normalizeProjectName(value?.projectName),
    startedAt,
    elapsedSeconds: Math.max(0, Math.floor(now / 1_000) - startedAt),
    estimatedCostUsd: Number.isFinite(value?.estimatedCostUsd)
      ? Math.max(0, value.estimatedCostUsd)
      : null,
    hasUnpricedModels: Boolean(value?.hasUnpricedModels),
    models,
    partial: Boolean(value?.partial),
    pricingDate: typeof value?.pricingDate === "string" ? value.pricingDate : PRICING_DATE
  };
}

function normalizeActiveTaskResult(raw, now = Date.now()) {
  if (!raw?.available || !Array.isArray(raw.tasks)) {
    return {
      available: false,
      tasks: [],
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
  return {
    available: true,
    tasks,
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
  summarizeActiveTaskLines
};
