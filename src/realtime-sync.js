const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { getRefreshDelay, ACTIVE_REFRESH_MS } = require("./refresh-policy");

class RealtimeSync {
  constructor({ service, onSnapshot, onTasks, root = path.join(os.homedir(), ".codex"),
    watch = fs.watch, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    Object.assign(this, { service, onSnapshot, onTasks, root, watch, now, setTimer, clearTimer });
    this.lastRemoteAt = -Infinity; this.lastLocalAt = -Infinity; this.localWorkMs = 0;
    this.localDirty = false; this.remoteDirty = false; this.watchers = [];
  }
  start() {
    if (this.started || this.stopped) return;
    this.started = true;
    try {
      const watcher = this.watch(this.root, { recursive: true, persistent: false }, (_event, filename) => this.changed(filename));
      watcher.on?.("error", () => {}); this.watchers.push(watcher);
    } catch {} // Fallback reads cover unsupported watches and missing directories.
    this.service.client.onChange = () => this.requestRemote();
    this.scheduleFallback();
  }
  changed(filename) {
    const name = String(filename || "").replace(/\\/g, "/");
    if (!name || /^(?:sessions|archived_sessions)\//.test(name) && name.endsWith(".jsonl")) {
      this.localDirty = true; this.scheduleLocal(); this.requestRemote();
    } else if (/^goals_1\.sqlite(?:-wal)?$/.test(name)) {
      // SQLite readers update -shm read marks even in read-only mode. Watching
      // that file turns our own query into an endless notification loop.
      this.localDirty = true; this.scheduleLocal();
    } else if (name === "auth.json") this.requestRemote();
  }
  scheduleLocal() {
    if (this.stopped || this.localTimer || this.localInFlight || !this.localDirty) return;
    // At most ~20% of a core's wall time, one coalesced follow-up, no growing queue.
    const delay = Math.max(180, Math.min(15000, this.localWorkMs * 4) - (this.now() - this.lastLocalAt));
    this.localTimer = this.setTimer(() => { this.localTimer = null; this.readLocal(); }, delay);
    this.localTimer.unref?.();
  }
  async readLocal() {
    if (this.stopped || this.localInFlight) return;
    this.localDirty = false; this.localInFlight = true;
    const started = this.now();
    try {
      const result = await this.service.readActiveTasks(started);
      this.latestTasks = result;
      const stableTask = task => { const { elapsedSeconds, ...stable } = task; return stable; };
      const fingerprint = JSON.stringify({
        tasks: (result.tasks || []).map(stableTask), latestTask: result.latestTask,
        pendingTasks: result.pendingTasks, available: result.available, truncated: result.truncated,
        records: Object.fromEntries(Object.entries(result.records || {}).filter(([key]) => !/At$/.test(key)))
      });
      if (!this.stopped && fingerprint !== this.lastLocalFingerprint) {
        this.lastLocalFingerprint = fingerprint; this.onTasks?.(result);
      }
    } catch {} finally {
      this.localWorkMs = Math.max(0, this.now() - started); this.lastLocalAt = this.now();
      this.localInFlight = false; this.scheduleLocal();
    }
  }
  requestRemote() {
    if (this.stopped) return;
    this.remoteDirty = true;
    if (this.remoteTimer || this.remoteInFlight) return;
    const delay = Math.max(250, 3000 - (this.now() - this.lastRemoteAt));
    this.remoteTimer = this.setTimer(() => { this.remoteTimer = null; this.refresh().catch(() => {}); }, delay);
    this.remoteTimer.unref?.();
  }
  async refresh({ forceCheckpoints = false } = {}) {
    if (this.stopped) return null;
    if (forceCheckpoints) this.forceCheckpointsPending = true;
    if (this.remoteInFlight) {
      if (forceCheckpoints) this.remoteDirty = true;
      return this.remoteInFlight;
    }
    if (this.remoteTimer) this.clearTimer(this.remoteTimer);
    this.remoteTimer = null; this.remoteDirty = false;
    const force = Boolean(this.forceCheckpointsPending);
    this.forceCheckpointsPending = false;
    this.remoteInFlight = this.service.read({ forceCheckpoints: force }).then(snapshot => {
      this.latest = snapshot;
      if (!this.stopped) this.onSnapshot?.(snapshot);
      return snapshot;
    }).finally(() => {
      this.lastRemoteAt = this.now(); this.remoteInFlight = null;
      if (this.remoteDirty) this.requestRemote();
      this.scheduleFallback();
    });
    return this.remoteInFlight;
  }
  scheduleFallback() {
    if (this.stopped) return;
    if (this.fallbackTimer) this.clearTimer(this.fallbackTimer);
    const delay = this.latest?.online ? getRefreshDelay(this.latest.activeTasks) : ACTIVE_REFRESH_MS;
    this.fallbackTimer = this.setTimer(() => {
      this.fallbackTimer = null;
      this.localDirty = true; this.scheduleLocal(); this.requestRemote();
    }, delay);
    this.fallbackTimer.unref?.();
  }
  dispose() {
    this.stopped = true;
    for (const timer of [this.localTimer, this.remoteTimer, this.fallbackTimer]) if (timer) this.clearTimer(timer);
    for (const watcher of this.watchers) watcher.close();
    this.service.client.onChange = null;
  }
}
module.exports = { RealtimeSync };
