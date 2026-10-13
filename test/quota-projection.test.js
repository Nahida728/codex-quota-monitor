const test = require("node:test");
const assert = require("node:assert/strict");
const { projectWeeklyQuota } = require("../src/quota-projection");
const { normalizeQuotaResponse } = require("../src/quota-normalizer");
const { buildCalendar, localDay, dayKey } = require("../src/renderer/reset-calendar");

const now = 1791800000;
const windows = (five, week, fiveReset = now + 10000, weekReset = now + 600000) => ({
  fiveHour: { usedPercent: five, resetsAt: fiveReset, windowDurationMins: 300 },
  weekly: { usedPercent: week, resetsAt: weekReset }
});

test("projects only same-window deltas and preserves a mid-window anchor across restart", () => {
  const initial = projectWeeklyQuota(windows(20, 30), {}, now);
  assert.equal(initial.projection.available, false);
  const persisted = JSON.parse(JSON.stringify({ quotaProjectionBaseline: initial.baseline }));
  const next = projectWeeklyQuota(windows(40, 34), persisted, now + 60);
  assert.equal(next.projection.remainingPercent, 54); // 34 + (60 * 4/20) used
  assert.equal(next.projection.fiveHourDelta, 20);
  assert.equal(next.projection.weeklyDelta, 4);
  const exhausted = projectWeeklyQuota(windows(100, 46), { quotaProjectionBaseline: next.baseline }, now + 120);
  assert.equal(exhausted.projection.remainingPercent, 54);
  const raw = (five, week) => ({ rateLimits: {
    primary: windows(five, week).fiveHour,
    secondary: { ...windows(five, week).weekly, windowDurationMins: 10080 }
  }, rateLimitResetCredits: { availableCount: 0, credits: [] } });
  const normalized = normalizeQuotaResponse(raw(20, 30), {}, now);
  const restored = JSON.parse(JSON.stringify(normalized.persistence));
  assert.equal(normalizeQuotaResponse(raw(40, 34), restored, now + 60).weeklyProjection.remainingPercent, 54);
  assert.equal(restored.quotaProjectionBaseline.fiveUsed, 20);
  let state = {};
  for (const [five, week, drift] of [[44, 61, 0], [45, 61, 1], [45, 61, 0], [46, 62, 1]]) {
    const result = projectWeeklyQuota(windows(five, week, now + 10000 + drift, now + 600000 + drift), state, now + five);
    state = { quotaProjectionBaseline: JSON.parse(JSON.stringify(result.baseline)) };
    assert.equal(state.quotaProjectionBaseline.fiveUsed, 44);
    if (five === 45) assert.equal(result.projection.reason, "waiting-weekly");
    if (five === 46) assert.equal(result.projection.reason, "low-sample");
  }
  // Compare against the original reset timestamp, preventing slow drift from
  // turning into an unlimited tolerance. A genuinely expired anchor is invalid.
  assert.equal(projectWeeklyQuota(windows(47, 63, now + 10006), state, now + 100).projection.available, false);
  assert.equal(projectWeeklyQuota(windows(47, 63, now + 10001), state, now + 10000).projection.available, false);
});

test("small rounded changes cannot assert weekly exhaustion; ambiguous zero estimates are hidden", () => {
  const initial = projectWeeklyQuota(windows(0, 67), {}, now);
  const screenshot = projectWeeklyQuota(windows(2, 68), { quotaProjectionBaseline: initial.baseline }, now + 60);
  assert.equal(screenshot.projection.available, false);
  assert.equal(screenshot.projection.reason, "low-sample");
  assert.equal(screenshot.projection.remainingPercent, undefined);
  assert.equal(screenshot.baseline.fiveUsed, 0);
  const nearLimit = projectWeeklyQuota(windows(40, 88), {}, now);
  const ambiguous = projectWeeklyQuota(windows(60, 93), { quotaProjectionBaseline: nearLimit.baseline }, now + 60);
  assert.equal(ambiguous.projection.available, false);
  assert.equal(ambiguous.projection.reason, "uncertain");
  assert.ok(ambiguous.projection.remainingUpperPercent > 0);
  const stable = projectWeeklyQuota(windows(40, 73), { quotaProjectionBaseline: screenshot.baseline }, now + 120);
  assert.equal(stable.projection.available, true);
  assert.equal(stable.projection.remainingPercent, 18);
  assert.ok(stable.projection.remainingLowerPercent < 18);
  assert.ok(stable.projection.remainingUpperPercent > 18);
});

test("discard reset/rollback samples, missing windows and renewal crossings; cap weekly exhaustion", () => {
  const old = projectWeeklyQuota(windows(20, 30), {}, now).baseline;
  const newer = projectWeeklyQuota(windows(40, 34), { quotaProjectionBaseline: old }, now + 60).baseline;
  for (const value of [windows(30, 35), windows(50, 32), windows(50, 35, now + 12000)]) {
    assert.equal(projectWeeklyQuota(value, { quotaProjectionBaseline: newer }, now + 120).projection.available, false);
  }
  assert.equal(projectWeeklyQuota({ weekly: windows(0, 0).weekly }, {}, now).baseline, null);
  assert.equal(projectWeeklyQuota(windows(20, 30, now + 10000, now + 9000), {}, now).projection.reason, "weekly-renews");
  const high = projectWeeklyQuota(windows(40, 90), { quotaProjectionBaseline: old }, now + 60);
  assert.equal(high.projection.remainingPercent, 0);
  assert.equal(high.projection.weeklyLimitFirst, true);
  assert.equal(high.projection.remainingLowerPercent, 0);
  assert.equal(high.projection.remainingUpperPercent, 0);
});

test("calendar aggregates local-day credits, retains older years and excludes future/invalid records", () => {
  const seconds = new Date(2026, 9, 13, 12).getTime() / 1000;
  const records = [{ at: seconds - 3600, count: 2 }, { at: seconds - 7200, count: 3 },
    { at: new Date(2024, 1, 29, 12).getTime() / 1000, count: 1 },
    { at: seconds + 86400, count: 9 }, { at: NaN, count: 9 }];
  const calendar = buildCalendar(records, null, seconds);
  assert.equal(calendar.byDay.get(dayKey(localDay(seconds))).count, 5);
  assert.deepEqual(calendar.years, [2026, 2024]);
  assert.equal(calendar.days.length % 7, 0);
  assert.ok(calendar.days.length <= 378);
  const older = buildCalendar(records, 2024, seconds);
  assert.equal(older.days.filter(day => !day.outside).length, 366);
  assert.equal(older.days.find(day => day.key === "2024-02-29").count, 1);
  assert.equal(calendar.byDay.size, 2);
});
