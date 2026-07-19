const FIVE_HOURS_MINUTES = 300;
const ONE_WEEK_MINUTES = 10080;
const WINDOW_TOLERANCE_MINUTES = 60;
const NEW_RESET_EVENT_TTL_SECONDS = 7 * 24 * 60 * 60;
const OFFICIAL_RESET_DEDUP_SECONDS = 2 * 60;

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

function restoreCachedCreditDetails(resets, previousState) {
  const cachedItems = Array.isArray(previousState?.resetCreditDetails)
    ? previousState.resetCreditDetails
    : [];
  const shouldRestore = resets.availableCount > 0 &&
    resets.items.length === 0 &&
    cachedItems.length === resets.availableCount;
  if (!shouldRestore) return resets;

  const items = cachedItems.map(item => ({ ...item }));
  return {
    ...resets,
    items,
    earliestExpiresAt: items
      .map(item => item.expiresAt)
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

function getOfficialResetDetectionMode(previousWindows, currentWindows, nowSeconds) {
  const previousFiveHour = previousWindows?.fiveHour;
  const previousWeekly = previousWindows?.weekly;
  const currentFiveHour = currentWindows?.fiveHour;
  const currentWeekly = currentWindows?.weekly;

  // The weekly window must always provide a before/after proof. When the
  // official response omits the five-hour window, the weekly proof is the
  // only meaningful signal available.
  if (!previousWeekly || !currentWeekly) return null;
  if (currentWeekly.remainingPercent !== 100 || previousWeekly.usedPercent <= 0) return null;
  const beforeWeeklyReset = Number.isFinite(previousWeekly.resetsAt) &&
    nowSeconds < previousWeekly.resetsAt - 90;
  if (!beforeWeeklyReset) return null;

  if (!currentFiveHour) {
    return "weekly-only-five-hour-disabled";
  }

  if (!previousFiveHour) return null;
  if (currentFiveHour.remainingPercent !== 100 || previousFiveHour.usedPercent <= 0) return null;
  const beforeFiveHourReset = Number.isFinite(previousFiveHour.resetsAt) &&
    nowSeconds < previousFiveHour.resetsAt - 90;
  return beforeFiveHourReset ? "all-limits" : null;
}

function didOfficialFullReset(previousWindows, currentWindows, nowSeconds) {
  return Boolean(getOfficialResetDetectionMode(previousWindows, currentWindows, nowSeconds));
}

function normalizeOfficialResetHistory(previousState) {
  const rawHistory = Array.isArray(previousState?.officialResetHistory)
    ? previousState.officialResetHistory
    : [];
  const migratedHistory = rawHistory.length
    ? rawHistory
    : (Number.isFinite(previousState?.officialResetAt) ? [previousState.officialResetAt] : []);
  const uniqueByDetectedAt = new Map();

  for (const entry of migratedHistory) {
    const detectedAt = Number.isFinite(entry) ? entry : entry?.detectedAt;
    if (!Number.isFinite(detectedAt) || detectedAt <= 0) continue;
    const normalizedEntry = Number.isFinite(entry)
      ? { detectedAt }
      : {
          detectedAt,
          detectionMode: typeof entry.detectionMode === "string" ? entry.detectionMode : null,
          previousFiveHourResetAt: Number.isFinite(entry.previousFiveHourResetAt)
            ? entry.previousFiveHourResetAt
            : null,
          previousWeeklyResetAt: Number.isFinite(entry.previousWeeklyResetAt)
            ? entry.previousWeeklyResetAt
            : null
        };
    uniqueByDetectedAt.set(detectedAt, normalizedEntry);
  }

  return [...uniqueByDetectedAt.values()].sort((a, b) => a.detectedAt - b.detectedAt);
}

function deriveEvents(previousState, normalized, nowSeconds) {
  const knownIds = new Set(previousState?.knownCreditIds || []);
  const currentIds = normalized.resets.items.map(item => item.id);
  const isFirstSnapshot = !previousState?.hasBaseline;
  const newlyGranted = isFirstSnapshot ? [] : normalized.resets.items.filter(item => !knownIds.has(item.id));
  const previousWindows = previousState?.lastSnapshot?.windows || {};
  const previousResetCount = previousState?.lastSnapshot?.resets?.availableCount;
  const resetCreditCountDecreased = Number.isFinite(previousResetCount) &&
    normalized.resets.availableCount < previousResetCount;
  const resetPatternMode = getOfficialResetDetectionMode(previousWindows, normalized.windows, nowSeconds);
  const manualResetDetected = Boolean(resetPatternMode && resetCreditCountDecreased);
  const officialResetMode = manualResetDetected ? null : resetPatternMode;
  const officialFullReset = Boolean(officialResetMode);

  const lastNewResetAt = newlyGranted.length ? nowSeconds : previousState?.lastNewResetAt || null;
  const lastNewResetCount = newlyGranted.length ? newlyGranted.length : previousState?.lastNewResetCount || 0;
  const officialResetHistory = normalizeOfficialResetHistory(previousState);
  const lastOfficialReset = officialResetHistory.at(-1);
  const isDuplicateOfficialReset = lastOfficialReset &&
    Math.abs(nowSeconds - lastOfficialReset.detectedAt) <= OFFICIAL_RESET_DEDUP_SECONDS;

  if (officialFullReset && !isDuplicateOfficialReset) {
    officialResetHistory.push({
      detectedAt: nowSeconds,
      detectionMode: officialResetMode,
      previousFiveHourResetAt: Number.isFinite(previousWindows.fiveHour?.resetsAt)
        ? previousWindows.fiveHour.resetsAt
        : null,
      previousWeeklyResetAt: Number.isFinite(previousWindows.weekly?.resetsAt)
        ? previousWindows.weekly.resetsAt
        : null
    });
  }

  const officialResetAt = officialResetHistory.at(-1)?.detectedAt || null;

  return {
    newReset: {
      detected: Boolean(lastNewResetAt && nowSeconds - lastNewResetAt <= NEW_RESET_EVENT_TTL_SECONDS),
      count: lastNewResetAt && nowSeconds - lastNewResetAt <= NEW_RESET_EVENT_TTL_SECONDS ? lastNewResetCount : 0,
      detectedAt: lastNewResetAt
    },
    officialReset: {
      detected: Boolean(officialResetHistory.length),
      detectedNow: officialFullReset && !isDuplicateOfficialReset,
      detectedAt: officialResetAt,
      latestAt: officialResetAt,
      history: officialResetHistory
    },
    manualReset: {
      detected: manualResetDetected,
      detectedAt: manualResetDetected ? nowSeconds : null
    },
    persistence: {
      hasBaseline: true,
      knownCreditIds: [...new Set([...(previousState?.knownCreditIds || []), ...currentIds])],
      lastNewResetAt,
      lastNewResetCount,
      officialResetAt,
      officialResetHistory,
      resetCreditDetails: normalized.resets.items.length === normalized.resets.availableCount
        ? normalized.resets.items
        : [],
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
    resets: restoreCachedCreditDetails(
      normalizeCredits(raw.rateLimitResetCredits),
      previousState
    )
  };
  const events = deriveEvents(previousState, normalized, nowSeconds);
  return {
    ...normalized,
    events: {
      newReset: events.newReset,
      officialReset: events.officialReset,
      manualReset: events.manualReset
    },
    persistence: events.persistence
  };
}

module.exports = {
  identifyWindows,
  normalizeCredits,
  restoreCachedCreditDetails,
  normalizeQuotaResponse,
  didUnexpectedReset,
  didOfficialFullReset,
  getOfficialResetDetectionMode
};
