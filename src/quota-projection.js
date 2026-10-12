// Percent deltas must come from the same quota windows, never lifetime usage.
// The server can round an unchanged recovery timestamp one second either way.
const RESET_TIMESTAMP_TOLERANCE_SECONDS = 5;
function point(windows, observedAt) {
  const five = windows?.fiveHour;
  const week = windows?.weekly;
  if (![five?.usedPercent, week?.usedPercent, five?.resetsAt, week?.resetsAt, observedAt]
    .every(Number.isFinite) || five.usedPercent < 0 || five.usedPercent > 100 ||
      week.usedPercent < 0 || week.usedPercent > 100 ||
      five.resetsAt <= observedAt || week.resetsAt <= observedAt) return null;
  return { fiveResetAt: five.resetsAt, weeklyResetAt: week.resetsAt,
    fiveUsed: five.usedPercent, weeklyUsed: week.usedPercent, observedAt };
}

function projectWeeklyQuota(windows, state = {}, nowSeconds = Date.now() / 1000) {
  const current = point(windows, nowSeconds);
  const unavailable = reason => ({ projection: { available: false, reason }, baseline: null });
  if (!current) return unavailable("unavailable");
  if (current.weeklyResetAt <= current.fiveResetAt) return unavailable("weekly-renews");
  let baseline = state.quotaProjectionBaseline;
  if (!baseline) baseline = point(state.lastSnapshot?.windows, state.lastSuccessfulAt / 1000);
  const start = current.fiveResetAt - (windows.fiveHour.windowDurationMins || 300) * 60;
  const valid = baseline && [baseline.fiveUsed, baseline.weeklyUsed, baseline.observedAt,
    baseline.lastFiveUsed ?? baseline.fiveUsed, baseline.lastWeeklyUsed ?? baseline.weeklyUsed].every(Number.isFinite) &&
    baseline.fiveUsed >= 0 && baseline.fiveUsed <= 100 && baseline.weeklyUsed >= 0 && baseline.weeklyUsed <= 100 &&
    Math.abs(baseline.fiveResetAt - current.fiveResetAt) <= RESET_TIMESTAMP_TOLERANCE_SECONDS &&
    Math.abs(baseline.weeklyResetAt - current.weeklyResetAt) <= RESET_TIMESTAMP_TOLERANCE_SECONDS &&
    nowSeconds < baseline.fiveResetAt && nowSeconds < baseline.weeklyResetAt &&
    baseline.observedAt >= start - RESET_TIMESTAMP_TOLERANCE_SECONDS && baseline.observedAt <= nowSeconds &&
    current.fiveUsed >= (baseline.lastFiveUsed ?? baseline.fiveUsed) &&
    current.weeklyUsed >= (baseline.lastWeeklyUsed ?? baseline.weeklyUsed);
  if (!valid) baseline = current;
  const fiveDelta = current.fiveUsed - baseline.fiveUsed;
  const weeklyDelta = current.weeklyUsed - baseline.weeklyUsed;
  const persistence = { ...baseline, lastFiveUsed: current.fiveUsed, lastWeeklyUsed: current.weeklyUsed };
  if (fiveDelta < 1 || weeklyDelta <= 0) {
    return { projection: { available: false, reason: fiveDelta >= 1 ? "waiting-weekly" : "collecting",
      fiveHourDelta: fiveDelta, weeklyDelta }, baseline: persistence };
  }
  const addedWeeklyPercent = (100 - current.fiveUsed) * weeklyDelta / fiveDelta;
  const projectedUsedPercent = Math.min(100, current.weeklyUsed + addedWeeklyPercent);
  return { baseline: persistence, projection: { available: true,
    remainingPercent: Math.round((100 - projectedUsedPercent) * 10) / 10,
    usedPercent: Math.round(projectedUsedPercent * 10) / 10,
    fiveHourDelta: fiveDelta, weeklyDelta, addedWeeklyPercent: Math.round(addedWeeklyPercent * 10) / 10,
    weeklyLimitFirst: current.weeklyUsed + addedWeeklyPercent > 100,
    observedFrom: baseline.observedAt, observedAt: nowSeconds,
    fiveResetAt: current.fiveResetAt, weeklyResetAt: current.weeklyResetAt } };
}

module.exports = { projectWeeklyQuota };
