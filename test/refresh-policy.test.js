const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ACTIVE_REFRESH_MS,
  ACTIVE_TASK_PROBE_MS,
  IDLE_REFRESH_MS,
  getRefreshDelay,
  shouldWakeForActiveTask
} = require("../src/refresh-policy");

test("refreshes every five seconds while a task is active and every minute while idle", () => {
  assert.equal(ACTIVE_REFRESH_MS, 5_000);
  assert.equal(ACTIVE_TASK_PROBE_MS, 5_000);
  assert.equal(IDLE_REFRESH_MS, 60_000);
  assert.equal(getRefreshDelay({ count: 2 }), 5_000);
  assert.equal(getRefreshDelay({ count: 0 }), 60_000);
  assert.equal(getRefreshDelay(null), 60_000);
});

test("a lightweight probe wakes the full refresh only when a new task appears", () => {
  assert.equal(
    shouldWakeForActiveTask({ available: true, count: 0 }, { available: true, count: 1 }),
    true
  );
  assert.equal(
    shouldWakeForActiveTask({ available: true, count: 1 }, { available: true, count: 1 }),
    false
  );
  assert.equal(
    shouldWakeForActiveTask({ available: true, count: 0 }, { available: false, count: 1 }),
    false
  );
});
