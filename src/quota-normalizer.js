const FIVE_HOURS_MINUTES = 300;
const ONE_WEEK_MINUTES = 10080;
const WINDOW_TOLERANCE_MINUTES = 60;
const EVENT_TTL_SECONDS = 7 * 24 * 60 * 60;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function normalizeWindow(window) {
  if (!window) return null;
  const usedPercent = clamp(window.usedPercent, 0, 100);
  return {
    usedPercent,
    remainingPercent: 100 - usedPercent,
    windowDurationMins: Number.isFinite(window.windowDurationMins) ? window.windowDurationMins : null,
    resetsAt: Number.isFinite(window.resetsAt) ? window.resetsAt : null
  };
}

function distanceToDuration(window, target) {
  if (!window || !Number.isFinite(window.windowDurationMins)) return Number.POSITIVE_INFINITY;
  return Math.abs(window.windowDurationMins - target);
}

function identifyWindows(rateLimit) {
  const candidates = [rateLimit?.primary, rateLimit?.secondary]
    .filter(Boolean)
    .map(normalizeWindow);

  let fiveHour = candidates.find(window => distanceToDuration(window, FIVE_HOURS_MINUTES) <= WINDOW_TOLERANCE_MINUTES) || null;
  let weekly = candidates.find(window => distanceToDuration(window, ONE_WEEK_MINUTES) <= WINDOW_TOLERANCE_MINUTES) || null;

  if (!weekly && candidates.length === 1 && candidates[0].windowDurationMins > 24 * 60) {
    weekly = candidates[0];
  }
  if (!fiveHour && candidates.length === 1 && candidates[0].windowDurationMins !== null && candidates[0].windowDurationMins <= 12 * 60) {
    fiveHour = candidates[0];
  }
  return { fiveHour, weekly };
}

function normalizeCredits(summary) {
  const credits = Array.isArray(summary?.credits) ? summary.credits : [];
  const available = credits.filter(credit => credit.status === "available");
  const detailRows = available.map(credit => ({
    id: credit.id,
    resetType: credit.resetType || "unknown",
    status: credit.status,
    grantedAt: Number.isFinite(credit.grantedAt) ? credit.grantedAt : null,
    expiresAt: Number.isFinite(credit.expiresAt) ? credit.expiresAt : null,
    title: credit.title || null,
    description: credit.description || null
  }));

  return {
    availableCount: Number.isFinite(summary?.availableCount) ? summary.availableCount : detailRows.length,
    items: detailRows,
    earliestExpiresAt: detailRows
      .map(credit => credit.expiresAt)
      .filter(Number.isFinite)
      .sort((a, b) => a - b)[0] || null
  };
}

function getRateLimit(raw) {
  return raw?.rateLimitsByLimitId?.codex || raw?.rateLimits || null;
}

function didUnexpectedReset(previous, current, nowSeconds, creditCountDecreased) {
  if (!previous || !current || creditCountDecreased) return false;
  if (current.usedPercent > previous.usedPercent - 10) return false;
  const previousScheduledReset = previous.resetsAt;
  const naturalReset = Number.isFinite(previousScheduledReset) && nowSeconds >= previousScheduledReset - 90;
  return !naturalReset;
}

function didOfficialFullReset(previousWindows, currentWindows, nowSeconds) {
  const previousFiveHour = previousWindows?.fiveHour;
  const previousWeekly = previousWindows?.weekly;
  const currentFiveHour = currentWindows?.fiveHour;
  const currentWeekly = currentWindows?.weekly;

  // A full official reset can only be established when both official windows
  // are present, both are completely restored, and there was usage to reset.
  if (!previousFiveHour || !previousWeekly || !currentFiveHour || !currentWeekly) return false;
  if (currentFiveHour.remainingPercent !== 100 || currentWeekly.remainingPercent !== 100) return false;
  if (previousFiveHour.usedPercent <= 0 || previousWeekly.usedPercent <= 0) return false;

  const beforeFiveHourReset = Number.isFinite(previousFiveHour.resetsAt) &&
    nowSeconds < previousFiveHour.resetsAt - 90;
  const beforeWeeklyReset = Number.isFinite(previousWeekly.resetsAt) &&
    nowSeconds < previousWeekly.resetsAt - 90;
  return beforeFiveHourReset && beforeWeeklyReset;
}

function deriveEvents(previousState, normalized, nowSeconds) {
  const knownIds = new Set(previousState?.knownCreditIds || []);
  const currentIds = normalized.resets.items.map(item => item.id);
  const isFirstSnapshot = !previousState?.hasBaseline;
  const newlyGranted = isFirstSnapshot ? [] : normalized.resets.items.filter(item => !knownIds.has(item.id));
  const previousWindows = previousState?.lastSnapshot?.windows || {};
  const officialFullReset = didOfficialFullReset(previousWindows, normalized.windows, nowSeconds);

  const lastNewResetAt = newlyGranted.length ? nowSeconds : previousState?.lastNewResetAt || null;
  const lastNewResetCount = newlyGranted.length ? newlyGranted.length : previousState?.lastNewResetCount || 0;
  const officialResetAt = officialFullReset ? nowSeconds : previousState?.officialResetAt || null;

  return {
    newReset: {
      detected: Boolean(lastNewResetAt && nowSeconds - lastNewResetAt <= EVENT_TTL_SECONDS),
      count: lastNewResetAt && nowSeconds - lastNewResetAt <= EVENT_TTL_SECONDS ? lastNewResetCount : 0,
      detectedAt: lastNewResetAt
    },
    officialReset: {
      detected: Boolean(officialResetAt && nowSeconds - officialResetAt <= EVENT_TTL_SECONDS),
      detectedAt: officialResetAt
    },
    persistence: {
      hasBaseline: true,
      knownCreditIds: [...new Set([...(previousState?.knownCreditIds || []), ...currentIds])],
      lastNewResetAt,
      lastNewResetCount,
      officialResetAt,
      lastSnapshot: {
        windows: normalized.windows,
        resets: { availableCount: normalized.resets.availableCount }
      }
    }
  };
}

function normalizeQuotaResponse(raw, previousState = {}, nowSeconds = Math.floor(Date.now() / 1000)) {
  const rateLimit = getRateLimit(raw);
  if (!rateLimit) throw new Error("Codex rate-limit data is unavailable.");

  const normalized = {
    planType: rateLimit.planType || "unknown",
    limitReached: Boolean(rateLimit.rateLimitReachedType),
    limitReachedType: rateLimit.rateLimitReachedType || null,
    windows: identifyWindows(rateLimit),
    resets: normalizeCredits(raw.rateLimitResetCredits)
  };
  const events = deriveEvents(previousState, normalized, nowSeconds);
  return {
    ...normalized,
    events: {
      newReset: events.newReset,
      officialReset: events.officialReset
    },
    persistence: events.persistence
  };
}

module.exports = {
  identifyWindows,
  normalizeCredits,
  normalizeQuotaResponse,
  didUnexpectedReset,
  didOfficialFullReset
};
