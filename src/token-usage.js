const MAX_DAILY_BUCKETS = 400;

function normalizeCount(value) {
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value));
}

function parseDateKey(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return match[0];
}

function dateFromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(key, days) {
  const date = dateFromKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

function normalizeDailyBuckets(value) {
  if (!Array.isArray(value)) return [];
  const totals = new Map();
  for (const bucket of value.slice(0, MAX_DAILY_BUCKETS)) {
    const startDate = parseDateKey(bucket?.startDate);
    const tokens = normalizeCount(bucket?.tokens);
    if (!startDate || tokens === null) continue;
    totals.set(
      startDate,
      Math.min(Number.MAX_SAFE_INTEGER, (totals.get(startDate) || 0) + tokens)
    );
  }
  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([startDate, tokens]) => ({ startDate, tokens }));
}

function normalizeSnapshot(value) {
  if (!value || typeof value !== "object") return null;
  const dailyUsageBuckets = normalizeDailyBuckets(value.dailyUsageBuckets);
  const snapshot = {
    lifetimeTokens: normalizeCount(value.lifetimeTokens),
    currentStreakDays: normalizeCount(value.currentStreakDays),
    longestStreakDays: normalizeCount(value.longestStreakDays),
    peakDailyTokens: normalizeCount(value.peakDailyTokens),
    longestRunningTurnSec: normalizeCount(value.longestRunningTurnSec),
    dailyUsageBuckets,
    observedAt: normalizeCount(value.observedAt)
  };
  const hasSummary = [
    snapshot.lifetimeTokens,
    snapshot.currentStreakDays,
    snapshot.longestStreakDays,
    snapshot.peakDailyTokens,
    snapshot.longestRunningTurnSec
  ].some(item => item !== null);
  return hasSummary || dailyUsageBuckets.length ? snapshot : null;
}

function normalizeTokenUsageResponse(raw, previousState = {}, now = Date.now()) {
  const current = normalizeSnapshot({
    ...(raw?.summary || {}),
    dailyUsageBuckets: raw?.dailyUsageBuckets,
    observedAt: now
  });

  if (current) {
    return {
      available: true,
      cached: false,
      ...current,
      persistence: { tokenUsageSnapshot: current }
    };
  }

  const cached = normalizeSnapshot(previousState?.tokenUsageSnapshot);
  if (cached) {
    return {
      available: true,
      cached: true,
      ...cached,
      persistence: {}
    };
  }

  return {
    available: false,
    cached: false,
    lifetimeTokens: null,
    currentStreakDays: null,
    longestStreakDays: null,
    peakDailyTokens: null,
    longestRunningTurnSec: null,
    dailyUsageBuckets: [],
    observedAt: null,
    persistence: {}
  };
}

function startOfWeek(key) {
  const date = dateFromKey(key);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  return dateKey(date);
}

function startOfMonth(key) {
  return `${key.slice(0, 7)}-01`;
}

function addUtcMonths(key, months) {
  const date = dateFromKey(key);
  date.setUTCMonth(date.getUTCMonth() + months, 1);
  return dateKey(date);
}

function aggregateTokenUsage(value, period = "day") {
  const buckets = normalizeDailyBuckets(value);
  if (!buckets.length) return [];
  const mode = ["day", "week", "month"].includes(period) ? period : "day";
  const grouped = new Map();

  for (const bucket of buckets) {
    const key = mode === "week"
      ? startOfWeek(bucket.startDate)
      : (mode === "month" ? startOfMonth(bucket.startDate) : bucket.startDate);
    grouped.set(
      key,
      Math.min(Number.MAX_SAFE_INTEGER, (grouped.get(key) || 0) + bucket.tokens)
    );
  }

  const keys = [...grouped.keys()].sort();
  const output = [];
  let cursor = keys[0];
  const last = keys.at(-1);
  while (cursor <= last && output.length <= MAX_DAILY_BUCKETS) {
    output.push({ startDate: cursor, tokens: grouped.get(cursor) || 0 });
    cursor = mode === "month"
      ? addUtcMonths(cursor, 1)
      : addUtcDays(cursor, mode === "week" ? 7 : 1);
  }
  return output;
}

const api = {
  aggregateTokenUsage,
  normalizeDailyBuckets,
  normalizeTokenUsageResponse,
  parseDateKey
};

if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.TokenUsage = api;
