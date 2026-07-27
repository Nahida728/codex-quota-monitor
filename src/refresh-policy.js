(function initializeRefreshPolicy() {
const ACTIVE_REFRESH_MS = 5_000;
const IDLE_REFRESH_MS = 60_000;
const ACTIVE_TASK_PROBE_MS = 5_000;

function activeTaskCount(value) {
  return Number.isFinite(value?.count) && value.count > 0
    ? Math.floor(value.count)
    : 0;
}

function getRefreshDelay(activeTasks) {
  return activeTaskCount(activeTasks) > 0
    ? ACTIVE_REFRESH_MS
    : IDLE_REFRESH_MS;
}

function shouldWakeForActiveTask(latestActiveTasks, probeResult) {
  return Boolean(
    probeResult?.available &&
    activeTaskCount(probeResult) > 0 &&
    activeTaskCount(latestActiveTasks) === 0
  );
}

const refreshPolicyApi = {
  ACTIVE_REFRESH_MS,
  ACTIVE_TASK_PROBE_MS,
  IDLE_REFRESH_MS,
  activeTaskCount,
  getRefreshDelay,
  shouldWakeForActiveTask
};

if (typeof module !== "undefined" && module.exports) module.exports = refreshPolicyApi;
if (typeof window !== "undefined") window.RefreshPolicy = refreshPolicyApi;
})();
