const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const MAX_STATE_BYTES = 4 * 1024 * 1024;
const DEFAULT_BACKUP_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_MAX_BACKUPS = 192;
const MAX_BACKUP_CANDIDATES = 512;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readJsonObject(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_STATE_BYTES) return null;
    const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return isPlainObject(value) ? value : null;
  } catch {
    return null;
  }
}

function writeFileDurably(filePath, contents, { exclusive = false } = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const handle = fs.openSync(filePath, exclusive ? "wx" : "w", 0o600);
  try {
    fs.writeFileSync(handle, contents, "utf8");
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
}

function writeJsonAtomically(filePath, value) {
  const contents = JSON.stringify(value, null, 2);
  const temporary = `${filePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
  try {
    writeFileDurably(temporary, contents, { exclusive: true });
    fs.renameSync(temporary, filePath);
  } finally {
    try {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    } catch {}
  }
}

function normalizeDetectedAt(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function normalizeOfficialResetHistory(states) {
  const records = new Map();
  for (const state of states) {
    const history = Array.isArray(state?.officialResetHistory)
      ? state.officialResetHistory
      : [];
    const migrated = history.length
      ? history
      : (Number.isFinite(state?.officialResetAt) ? [state.officialResetAt] : []);
    for (const value of migrated) {
      const detectedAt = normalizeDetectedAt(
        Number.isFinite(value) ? value : value?.detectedAt
      );
      if (!detectedAt) continue;
      const record = Number.isFinite(value)
        ? { detectedAt }
        : {
            detectedAt,
            detectionMode: typeof value.detectionMode === "string"
              ? value.detectionMode
              : null,
            previousFiveHourResetAt: Number.isFinite(value.previousFiveHourResetAt)
              ? value.previousFiveHourResetAt
              : null,
            previousWeeklyResetAt: Number.isFinite(value.previousWeeklyResetAt)
              ? value.previousWeeklyResetAt
              : null
          };
      const existing = records.get(detectedAt);
      if (!existing || Object.values(record).filter(item => item !== null).length >
        Object.values(existing).filter(item => item !== null).length) {
        records.set(detectedAt, record);
      }
    }
  }
  return [...records.values()].sort((left, right) => left.detectedAt - right.detectedAt);
}

function normalizeReceivedResetHistory(states) {
  const records = new Map();
  for (const state of states) {
    const history = Array.isArray(state?.receivedResetHistory)
      ? state.receivedResetHistory
      : [];
    const migrated = history.length
      ? history
      : (Number.isFinite(state?.lastNewResetAt)
          ? [{
              detectedAt: state.lastNewResetAt,
              count: state.lastNewResetCount,
              items: []
            }]
          : []);
    for (const value of migrated) {
      const detectedAt = normalizeDetectedAt(value?.detectedAt);
      if (!detectedAt) continue;
      const items = Array.isArray(value.items)
        ? value.items.filter(isPlainObject).map(item => ({ ...item }))
        : [];
      const count = Number.isFinite(value.count)
        ? Math.max(1, Math.floor(value.count))
        : Math.max(1, items.length);
      const identity = item => String(item.id ?? [
          item.resetType,
          item.grantedAt,
          item.expiresAt,
          item.title
        ].join(":"));
      const key = `${detectedAt}:${count}`;
      const existing = records.get(key);
      if (!existing) {
        records.set(key, { detectedAt, count, items });
        continue;
      }
      const mergedItems = new Map(
        existing.items.map(item => [identity(item), item])
      );
      for (const item of items) mergedItems.set(identity(item), item);
      existing.items = [...mergedItems.values()];
    }
  }
  return [...records.values()].sort((left, right) => left.detectedAt - right.detectedAt);
}

function normalizeVersion(value) {
  const version = String(value || "").trim();
  return /^\d+(?:\.\d+){1,5}$/.test(version) ? version : null;
}

function compareVersions(left, right) {
  const leftParts = String(left || "").split(".").map(part => Number.parseInt(part, 10) || 0);
  const rightParts = String(right || "").split(".").map(part => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }
  return 0;
}

function normalizeClientUpdateHistory(states) {
  const records = new Map();
  for (const state of states) {
    const history = Array.isArray(state?.codexClientUpdateHistory)
      ? state.codexClientUpdateHistory
      : [];
    const migrated = [
      ...history,
      {
        fromVersion: state?.codexClientPreviousVersion,
        toVersion: state?.codexClientUpdatedVersion,
        detectedAt: state?.codexClientUpdateAt
      }
    ];
    for (const value of migrated) {
      const fromVersion = normalizeVersion(value?.fromVersion);
      const toVersion = normalizeVersion(value?.toVersion);
      const detectedAt = normalizeDetectedAt(value?.detectedAt);
      if (
        !fromVersion ||
        !toVersion ||
        !detectedAt ||
        compareVersions(toVersion, fromVersion) <= 0
      ) continue;
      const key = `${fromVersion}>${toVersion}`;
      const existing = records.get(key);
      if (!existing || detectedAt < existing.detectedAt) {
        records.set(key, { fromVersion, toVersion, detectedAt });
      }
    }
  }
  return [...records.values()].sort((left, right) => left.detectedAt - right.detectedAt);
}

function newestSnapshot(states, key) {
  return states
    .map(state => state?.[key])
    .filter(isPlainObject)
    .sort((left, right) => (
      (Number(right.observedAt) || 0) - (Number(left.observedAt) || 0)
    ))[0] || null;
}

function normalizeTaskPerformanceRecords(states) {
  const result = {
    longestElapsedSeconds: 0,
    longestRecordedAt: null,
    highestEstimatedCostUsd: 0,
    highestCostRecordedAt: null
  };
  for (const state of states) {
    const records = isPlainObject(state?.taskPerformanceRecords)
      ? state.taskPerformanceRecords
      : {};
    const elapsed = Number(records.longestElapsedSeconds);
    const elapsedRecordedAt = normalizeDetectedAt(records.longestRecordedAt);
    if (
      Number.isFinite(elapsed) &&
      elapsed >= 0 &&
      (elapsed > result.longestElapsedSeconds ||
        (elapsed === result.longestElapsedSeconds &&
          !result.longestRecordedAt && elapsedRecordedAt))
    ) {
      result.longestElapsedSeconds = Math.floor(elapsed);
      result.longestRecordedAt = elapsedRecordedAt;
    }
    const cost = Number(records.highestEstimatedCostUsd);
    const costRecordedAt = normalizeDetectedAt(records.highestCostRecordedAt);
    if (
      Number.isFinite(cost) &&
      cost >= 0 &&
      (cost > result.highestEstimatedCostUsd ||
        (cost === result.highestEstimatedCostUsd &&
          !result.highestCostRecordedAt && costRecordedAt))
    ) {
      result.highestEstimatedCostUsd = cost;
      result.highestCostRecordedAt = costRecordedAt;
    }
  }
  return result;
}

function reconcileQuotaStates(primary, candidates = []) {
  const states = [primary, ...candidates].filter(isPlainObject);
  const result = { ...(isPlainObject(primary) ? primary : (states[0] || {})) };

  const officialResetHistory = normalizeOfficialResetHistory(states);
  const receivedResetHistory = normalizeReceivedResetHistory(states);
  const clientUpdateHistory = normalizeClientUpdateHistory(states);
  result.officialResetHistory = officialResetHistory;
  result.officialResetAt = officialResetHistory.at(-1)?.detectedAt || null;
  result.receivedResetHistory = receivedResetHistory;
  result.codexClientUpdateHistory = clientUpdateHistory;

  const knownCreditIds = new Set();
  for (const state of states) {
    if (!Array.isArray(state.knownCreditIds)) continue;
    for (const id of state.knownCreditIds) {
      if (typeof id === "string" || Number.isFinite(id)) knownCreditIds.add(id);
    }
  }
  result.knownCreditIds = [...knownCreditIds];
  if (states.some(state => state.hasBaseline === true)) result.hasBaseline = true;

  const latestReceived = receivedResetHistory.at(-1);
  if (latestReceived) {
    result.lastNewResetAt = latestReceived.detectedAt;
    result.lastNewResetCount = latestReceived.count;
  }

  const latestClientUpdate = clientUpdateHistory.at(-1);
  if (latestClientUpdate) {
    result.codexClientPreviousVersion = latestClientUpdate.fromVersion;
    result.codexClientUpdatedVersion = latestClientUpdate.toVersion;
    result.codexClientUpdateAt = latestClientUpdate.detectedAt;
  }

  if (!Object.prototype.hasOwnProperty.call(result, "codexClientVersion")) {
    const version = states
      .map(state => normalizeVersion(state.codexClientVersion))
      .find(Boolean);
    if (version) result.codexClientVersion = version;
  }

  if (!Object.prototype.hasOwnProperty.call(result, "codexClientPendingVersion")) {
    const pending = states
      .filter(state => (
        normalizeVersion(state.codexClientPendingVersion) &&
        Number.isFinite(state.codexClientPendingAt)
      ))
      .sort((left, right) => right.codexClientPendingAt - left.codexClientPendingAt)[0];
    if (pending) {
      result.codexClientPendingVersion = pending.codexClientPendingVersion;
      result.codexClientPendingAt = pending.codexClientPendingAt;
    }
  }

  for (const key of ["lastSuccessfulAt", "lastClientVersionCheckAt"]) {
    const values = states.map(state => state[key]).filter(Number.isFinite);
    if (values.length) result[key] = Math.max(...values);
  }

  for (const key of ["tokenUsageSnapshot", "tokenCostSnapshot"]) {
    const snapshot = newestSnapshot(states, key);
    if (snapshot) result[key] = snapshot;
  }
  result.taskPerformanceRecords = normalizeTaskPerformanceRecords(states);

  if (!isPlainObject(result.lastSnapshot)) {
    const source = states
      .filter(state => isPlainObject(state.lastSnapshot))
      .sort((left, right) => (
        (Number(right.lastSuccessfulAt) || 0) - (Number(left.lastSuccessfulAt) || 0)
      ))[0];
    if (source) result.lastSnapshot = source.lastSnapshot;
  }

  if (!Object.prototype.hasOwnProperty.call(result, "resetCreditDetails")) {
    const cached = states.find(state => (
      Array.isArray(state.resetCreditDetails) && state.resetCreditDetails.length
    ));
    if (cached) result.resetCreditDetails = cached.resetCreditDetails;
  }

  return result;
}

function quotaHistoryFingerprint(state) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({
      officialResetHistory: normalizeOfficialResetHistory([state]),
      receivedResetHistory: normalizeReceivedResetHistory([state]),
      codexClientUpdateHistory: normalizeClientUpdateHistory([state]),
      knownCreditIds: Array.isArray(state?.knownCreditIds)
        ? [...new Set(state.knownCreditIds)].sort()
        : []
    }))
    .digest("hex");
}

class JsonStore {
  constructor(filePath, {
    backupDirectory = null,
    backupIntervalMs = DEFAULT_BACKUP_INTERVAL_MS,
    maxBackups = DEFAULT_MAX_BACKUPS,
    reconcile = null,
    protectedFingerprint = null,
    now = () => Date.now()
  } = {}) {
    this.filePath = filePath;
    this.data = {};
    this.backupDirectory = backupDirectory;
    this.backupIntervalMs = Math.max(1_000, Number(backupIntervalMs) || DEFAULT_BACKUP_INTERVAL_MS);
    this.maxBackups = Math.max(2, Math.floor(Number(maxBackups) || DEFAULT_MAX_BACKUPS));
    this.reconcile = typeof reconcile === "function" ? reconcile : null;
    this.protectedFingerprint = typeof protectedFingerprint === "function"
      ? protectedFingerprint
      : null;
    this.now = now;
    this.lastBackupAt = 0;
    this.lastProtectedFingerprint = null;
    this.protectedState = {};
    this.load();
  }

  listRecoveryFiles() {
    if (!this.backupDirectory) return [];
    const files = [];
    try {
      for (const entry of fs.readdirSync(this.backupDirectory, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const absolute = path.join(this.backupDirectory, entry.name);
        try {
          const stat = fs.statSync(absolute);
          files.push({ path: absolute, mtimeMs: stat.mtimeMs });
        } catch {}
      }
    } catch {}

    const directory = path.dirname(this.filePath);
    const basename = path.basename(this.filePath);
    try {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.startsWith(`${basename}.tmp`)) continue;
        const absolute = path.join(directory, entry.name);
        try {
          const stat = fs.statSync(absolute);
          files.push({ path: absolute, mtimeMs: stat.mtimeMs });
        } catch {}
      }
    } catch {}

    return files
      .sort((left, right) => right.mtimeMs - left.mtimeMs)
      .slice(0, MAX_BACKUP_CANDIDATES);
  }

  load() {
    const primary = readJsonObject(this.filePath);
    if (!this.backupDirectory) {
      this.data = primary || {};
      return;
    }

    const recoveryFiles = this.listRecoveryFiles();
    const candidates = recoveryFiles
      .map(file => ({ ...file, data: readJsonObject(file.path) }))
      .filter(file => file.data);
    const candidateStates = candidates.map(file => file.data);
    const base = primary && Object.keys(primary).length
      ? primary
      : (candidateStates[0] || primary || {});
    this.data = this.reconcile
      ? this.reconcile(base, candidateStates)
      : (primary || candidateStates[0] || {});
    this.protectedState = this.reconcile
      ? this.reconcile({}, [this.data, ...candidateStates])
      : { ...this.data };
    this.lastBackupAt = candidates
      .filter(file => file.path.startsWith(`${this.backupDirectory}${path.sep}`))
      .reduce((latest, file) => Math.max(latest, file.mtimeMs), 0);
    this.lastProtectedFingerprint = this.protectedFingerprint?.(this.protectedState) || null;

    const primaryChanged = !primary ||
      JSON.stringify(primary) !== JSON.stringify(this.data);
    if (primaryChanged && (primary || candidates.length)) {
      writeJsonAtomically(this.filePath, this.data);
    }
  }

  get(key, fallback = undefined) {
    return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : fallback;
  }

  createBackup(now, force = false) {
    if (!this.backupDirectory) return false;
    const fingerprint = this.protectedFingerprint?.(this.data) || null;
    const protectedChanged = Boolean(
      fingerprint && fingerprint !== this.lastProtectedFingerprint
    );
    const intervalElapsed = now < this.lastBackupAt ||
      now - this.lastBackupAt >= this.backupIntervalMs;
    if (!force && !protectedChanged && !intervalElapsed) return false;

    const contents = JSON.stringify(this.data, null, 2);
    const digest = crypto.createHash("sha256").update(contents).digest("hex").slice(0, 16);
    const filename = `${String(Math.floor(now)).padStart(16, "0")}-${digest}.json`;
    const destination = path.join(this.backupDirectory, filename);
    try {
      fs.mkdirSync(this.backupDirectory, { recursive: true });
      writeFileDurably(destination, contents, { exclusive: true });
      this.lastBackupAt = now;
      this.lastProtectedFingerprint = fingerprint;
      return true;
    } catch (error) {
      if (error?.code === "EEXIST") {
        this.lastBackupAt = now;
        this.lastProtectedFingerprint = fingerprint;
      }
      return false;
    }
  }

  pruneBackups() {
    if (!this.backupDirectory) return;
    let files;
    try {
      files = fs.readdirSync(this.backupDirectory, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
        .map(entry => ({
          name: entry.name,
          path: path.join(this.backupDirectory, entry.name)
        }))
        .filter(file => readJsonObject(file.path))
        .sort((left, right) => right.name.localeCompare(left.name));
    } catch {
      return;
    }
    for (const file of files.slice(this.maxBackups)) {
      if (
        path.resolve(path.dirname(file.path)) !== path.resolve(this.backupDirectory)
      ) continue;
      try {
        fs.unlinkSync(file.path);
      } catch {}
    }
  }

  set(key, value, { forceBackup = false } = {}) {
    this.data[key] = value;
    if (this.reconcile) {
      this.data = this.reconcile(this.data, [this.protectedState]);
      this.protectedState = this.reconcile({}, [this.protectedState, this.data]);
    }
    const now = this.now();
    const backedUp = this.createBackup(now, forceBackup);
    writeJsonAtomically(this.filePath, this.data);
    if (backedUp) this.pruneBackups();
  }
}

function createQuotaStateStore(filePath, options = {}) {
  return new JsonStore(filePath, {
    backupDirectory: `${filePath}.archive`,
    backupIntervalMs: DEFAULT_BACKUP_INTERVAL_MS,
    maxBackups: DEFAULT_MAX_BACKUPS,
    reconcile: reconcileQuotaStates,
    protectedFingerprint: quotaHistoryFingerprint,
    ...options
  });
}

module.exports = {
  DEFAULT_BACKUP_INTERVAL_MS,
  DEFAULT_MAX_BACKUPS,
  JsonStore,
  createQuotaStateStore,
  normalizeTaskPerformanceRecords,
  quotaHistoryFingerprint,
  readJsonObject,
  reconcileQuotaStates,
  writeJsonAtomically
};
