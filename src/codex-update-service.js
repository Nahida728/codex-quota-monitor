const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const VERSION_CACHE_MS = 15 * 60 * 1000;
const UPDATE_NOTICE_MS = 7 * 24 * 60 * 60 * 1000;
const UPDATE_LOG_LOOKBACK_MS = 45 * 24 * 60 * 60 * 1000;
const MAX_LOG_FILES = 128;
const MAX_LOG_BYTES = 64 * 1024 * 1024;

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

function normalizeClientUpdateHistory(state = {}) {
  const records = [];
  const seen = new Set();
  const append = value => {
    const fromVersion = normalizeVersion(value?.fromVersion);
    const toVersion = normalizeVersion(value?.toVersion);
    const detectedAt = Number.isFinite(value?.detectedAt) && value.detectedAt > 0
      ? Math.floor(value.detectedAt)
      : null;
    if (
      !fromVersion ||
      !toVersion ||
      !detectedAt ||
      compareVersions(toVersion, fromVersion) <= 0
    ) return false;
    const key = `${fromVersion}>${toVersion}`;
    if (seen.has(key)) return false;
    seen.add(key);
    records.push({ fromVersion, toVersion, detectedAt });
    return true;
  };

  if (Array.isArray(state.codexClientUpdateHistory)) {
    for (const record of state.codexClientUpdateHistory) append(record);
  }
  append({
    fromVersion: state.codexClientPreviousVersion,
    toVersion: state.codexClientUpdatedVersion,
    detectedAt: state.codexClientUpdateAt
  });
  return records.sort((left, right) => left.detectedAt - right.detectedAt);
}

function parseInstalledVersion(stdout) {
  return String(stdout || "")
    .split(/\r?\n/)
    .map(normalizeVersion)
    .find(Boolean) || null;
}

function parseInstalledPackageInfo(stdout) {
  const line = String(stdout || "")
    .split(/\r?\n/)
    .map(value => value.trim())
    .find(Boolean);
  if (!line) return null;
  const [versionValue, packageFamilyNameValue] = line.split("|");
  const version = normalizeVersion(versionValue);
  const packageFamilyName = String(packageFamilyNameValue || "").trim();
  if (!version) return null;
  return {
    version,
    packageFamilyName: /^[A-Za-z0-9._-]+$/.test(packageFamilyName)
      ? packageFamilyName
      : null
  };
}

function parseWindowsStoreUpdateEvents(contents) {
  const events = [];
  let lastCheck = null;
  for (const line of String(contents || "").split(/\r?\n/)) {
    const checked = line.match(
      /^(\S+)\s+info\s+\[windows-store-updater\]\s+Checking Windows Store for package updates\s+buildVersion=(\S+)\s+manifestBuildVersion=(\S+)\s+packageIdentity=(\S+)/
    );
    if (checked) {
      lastCheck = {
        checkedAt: Date.parse(checked[1]),
        currentVersion: normalizeVersion(checked[2]),
        targetVersion: normalizeVersion(checked[3]),
        packageIdentity: checked[4]
      };
      continue;
    }

    const completed = line.match(
      /^(\S+)\s+info\s+\[windows-store-updater\]\s+Windows Store package update check completed\s+canSilentlyDownload=(true|false)\s+completed=(true|false)\s+hasUpdate=(true|false)\s+overallState=(\S+)/
    );
    if (!completed || !lastCheck) continue;
    const detectedAt = Date.parse(completed[1]);
    if (!Number.isFinite(detectedAt) || !lastCheck.currentVersion) continue;
    events.push({
      ...lastCheck,
      detectedAt,
      canSilentlyDownload: completed[2] === "true",
      completed: completed[3] === "true",
      hasUpdate: completed[4] === "true",
      overallState: completed[5]
    });
  }
  return events;
}

async function collectUpdateLogFiles(root, now = Date.now()) {
  const files = [];
  async function visit(directory) {
    let entries;
    try {
      entries = await fs.promises.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
        continue;
      }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".log")) continue;
      try {
        const stat = await fs.promises.stat(absolute);
        if (now - stat.mtimeMs <= UPDATE_LOG_LOOKBACK_MS) {
          files.push({ path: absolute, mtimeMs: stat.mtimeMs, size: stat.size });
        }
      } catch {}
    }
  }
  await visit(root);
  return files.sort((left, right) => right.mtimeMs - left.mtimeMs);
}

async function readLatestWindowsStoreUpdate(logRoot, installedVersion, now = Date.now()) {
  if (!logRoot || !normalizeVersion(installedVersion)) return null;
  const files = await collectUpdateLogFiles(logRoot, now);
  let latest = null;
  let bytesRead = 0;
  let filesRead = 0;

  for (const file of files) {
    if (filesRead >= MAX_LOG_FILES || bytesRead + file.size > MAX_LOG_BYTES) break;
    if (latest && file.mtimeMs < latest.detectedAt) break;
    filesRead += 1;
    bytesRead += file.size;
    try {
      const contents = await fs.promises.readFile(file.path, "utf8");
      for (const event of parseWindowsStoreUpdateEvents(contents)) {
        if (!latest || event.detectedAt > latest.detectedAt) latest = event;
      }
    } catch {}
  }

  if (!latest) return null;
  const sameInstalledBuild = compareVersions(latest.currentVersion, installedVersion) === 0;
  const newerTarget = latest.targetVersion
    ? compareVersions(latest.targetVersion, installedVersion) > 0
    : true;
  return {
    updateReady: Boolean(
      sameInstalledBuild &&
      newerTarget &&
      latest.hasUpdate &&
      latest.completed &&
      latest.canSilentlyDownload
    ),
    checkedVersion: latest.currentVersion,
    targetVersion: latest.targetVersion,
    detectedAt: latest.detectedAt,
    overallState: latest.overallState
  };
}

function evaluateClientUpdate(observation, state = {}, now = Date.now()) {
  const observed = typeof observation === "string"
    ? { installedVersion: observation }
    : (observation || {});
  const detectedVersion = normalizeVersion(observed.installedVersion);
  const storedVersion = normalizeVersion(state.codexClientVersion);
  let currentVersion = detectedVersion || storedVersion;
  let previousVersion = normalizeVersion(state.codexClientPreviousVersion);
  let updatedVersion = normalizeVersion(state.codexClientUpdatedVersion);
  let detectedAt = Number.isFinite(state.codexClientUpdateAt)
    ? state.codexClientUpdateAt
    : null;
  let pendingVersion = normalizeVersion(state.codexClientPendingVersion);
  let pendingDetectedAt = Number.isFinite(state.codexClientPendingAt)
    ? state.codexClientPendingAt
    : null;
  const updateHistory = normalizeClientUpdateHistory(state);
  const persistence = {};
  const storedHistory = Array.isArray(state.codexClientUpdateHistory)
    ? state.codexClientUpdateHistory
    : [];
  if (JSON.stringify(storedHistory) !== JSON.stringify(updateHistory)) {
    persistence.codexClientUpdateHistory = updateHistory;
  }

  if (detectedVersion && detectedVersion !== storedVersion) {
    if (storedVersion && compareVersions(detectedVersion, storedVersion) > 0) {
      previousVersion = storedVersion;
      updatedVersion = detectedVersion;
      detectedAt = now;
      Object.assign(persistence, {
        codexClientPreviousVersion: previousVersion,
        codexClientUpdatedVersion: updatedVersion,
        codexClientUpdateAt: detectedAt
      });
      const historyKey = `${previousVersion}>${updatedVersion}`;
      if (!updateHistory.some(record => `${record.fromVersion}>${record.toVersion}` === historyKey)) {
        updateHistory.push({
          fromVersion: previousVersion,
          toVersion: updatedVersion,
          detectedAt
        });
        updateHistory.sort((left, right) => left.detectedAt - right.detectedAt);
      }
      persistence.codexClientUpdateHistory = updateHistory;
    }
    currentVersion = detectedVersion;
    persistence.codexClientVersion = detectedVersion;
  }

  const observedTargetVersion = normalizeVersion(observed.targetVersion);
  const observedCheckedVersion = normalizeVersion(observed.checkedVersion);
  const observedMatchesCurrent = Boolean(
    currentVersion &&
    (!observedCheckedVersion || compareVersions(observedCheckedVersion, currentVersion) === 0)
  );
  if (
    observed.updateReady === true &&
    observedMatchesCurrent &&
    observedTargetVersion &&
    compareVersions(observedTargetVersion, currentVersion) > 0
  ) {
    pendingVersion = observedTargetVersion;
    pendingDetectedAt = Number.isFinite(observed.detectedAt) ? observed.detectedAt : now;
    persistence.codexClientPendingVersion = pendingVersion;
    persistence.codexClientPendingAt = pendingDetectedAt;
  } else if (observed.updateReady === false && observedMatchesCurrent) {
    pendingVersion = null;
    pendingDetectedAt = null;
    persistence.codexClientPendingVersion = null;
    persistence.codexClientPendingAt = null;
  }

  if (
    currentVersion &&
    pendingVersion &&
    compareVersions(currentVersion, pendingVersion) >= 0
  ) {
    pendingVersion = null;
    pendingDetectedAt = null;
    persistence.codexClientPendingVersion = null;
    persistence.codexClientPendingAt = null;
  }

  const installedUpdateDetected = Boolean(
    currentVersion &&
    updatedVersion === currentVersion &&
    Number.isFinite(detectedAt) &&
    now >= detectedAt &&
    now - detectedAt <= UPDATE_NOTICE_MS
  );
  const pendingUpdate = Boolean(
    currentVersion &&
    pendingVersion &&
    compareVersions(pendingVersion, currentVersion) > 0
  );

  return {
    available: Boolean(currentVersion),
    detected: pendingUpdate || installedUpdateDetected,
    status: pendingUpdate
      ? "update-ready"
      : (installedUpdateDetected ? "updated" : (currentVersion ? "current" : "unavailable")),
    pendingUpdate,
    pendingVersion: pendingUpdate ? pendingVersion : null,
    pendingDetectedAt: pendingUpdate ? pendingDetectedAt : null,
    installedUpdateDetected,
    currentVersion,
    previousVersion: installedUpdateDetected ? previousVersion : null,
    detectedAt: installedUpdateDetected ? detectedAt : null,
    checkedLocally: Boolean(detectedVersion),
    history: updateHistory.slice().sort((left, right) => right.detectedAt - left.detectedAt),
    persistence
  };
}

class CodexDesktopVersionDetector {
  constructor({ cacheMs = VERSION_CACHE_MS } = {}) {
    this.cacheMs = cacheMs;
    this.cachedAt = 0;
    this.cachedState = null;
    this.inFlight = null;
  }

  async read(now = Date.now()) {
    if (this.cachedAt && now - this.cachedAt < this.cacheMs) {
      return this.cachedState;
    }
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.readInstalledState()
      .then(state => {
        this.cachedAt = now;
        this.cachedState = state;
        return state;
      })
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight;
  }

  async readInstalledVersion() {
    return (await this.readInstalledPackageInfo())?.version || null;
  }

  async readInstalledPackageInfo() {
    if (process.platform !== "win32") return null;
    const command = [
      "$packages = @()",
      "$packages += Get-AppxPackage -Name OpenAI.Codex -ErrorAction SilentlyContinue",
      "$packages += Get-AppxPackage -Name OpenAI.ChatGPT -ErrorAction SilentlyContinue",
      "$package = $packages | Sort-Object Version -Descending | Select-Object -First 1",
      "if ($null -ne $package) { Write-Output (\"{0}|{1}\" -f $package.Version.ToString(), $package.PackageFamilyName) }"
    ].join("; ");
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", command],
      {
        encoding: "utf8",
        timeout: 8_000,
        windowsHide: true,
        maxBuffer: 64 * 1024
      }
    );
    return parseInstalledPackageInfo(stdout);
  }

  async readInstalledState() {
    const packageInfo = await this.readInstalledPackageInfo();
    if (!packageInfo) return {
      installedVersion: null,
      updateReady: null,
      targetVersion: null
    };
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    const logRoot = packageInfo.packageFamilyName
      ? path.join(
          localAppData,
          "Packages",
          packageInfo.packageFamilyName,
          "LocalCache",
          "Local",
          "Codex",
          "Logs"
        )
      : null;
    const update = await readLatestWindowsStoreUpdate(logRoot, packageInfo.version);
    return {
      installedVersion: packageInfo.version,
      updateReady: update?.updateReady ?? null,
      checkedVersion: update?.checkedVersion ?? null,
      targetVersion: update?.targetVersion ?? null,
      detectedAt: update?.detectedAt ?? null
    };
  }
}

module.exports = {
  CodexDesktopVersionDetector,
  UPDATE_NOTICE_MS,
  compareVersions,
  evaluateClientUpdate,
  normalizeClientUpdateHistory,
  normalizeVersion,
  parseInstalledPackageInfo,
  parseInstalledVersion,
  parseWindowsStoreUpdateEvents,
  readLatestWindowsStoreUpdate
};
