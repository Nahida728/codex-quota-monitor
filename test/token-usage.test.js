const test = require("node:test");
const assert = require("node:assert/strict");

const {
  aggregateTokenUsage,
  normalizeDailyBuckets,
  normalizeTokenUsageResponse
} = require("../src/token-usage");

test("normalizes account lifetime tokens, cumulative work days, and sorted daily buckets", () => {
  const result = normalizeTokenUsageResponse({
    summary: {
      lifetimeTokens: 671910282,
      currentStreakDays: 16,
      longestStreakDays: 18,
      peakDailyTokens: 70052553
    },
    dailyUsageBuckets: [
      { startDate: "2026-07-20", tokens: 20 },
      { startDate: "invalid", tokens: 99 },
      { startDate: "2026-07-19", tokens: 10 }
    ]
  }, {}, 1234);

  assert.equal(result.available, true);
  assert.equal(result.cached, false);
  assert.equal(result.lifetimeTokens, 671910282);
  assert.equal(result.totalWorkDays, 2);
  assert.equal(result.currentStreakDays, 16);
  assert.deepEqual(result.dailyUsageBuckets, [
    { startDate: "2026-07-19", tokens: 10 },
    { startDate: "2026-07-20", tokens: 20 }
  ]);
  assert.deepEqual(result.persistence.tokenUsageSnapshot.dailyUsageBuckets, result.dailyUsageBuckets);
});

test("retains the last normalized usage snapshot when the endpoint is temporarily unavailable", () => {
  const result = normalizeTokenUsageResponse(null, {
    tokenUsageSnapshot: {
      lifetimeTokens: 42,
      currentStreakDays: 3,
      dailyUsageBuckets: [{ startDate: "2026-07-20", tokens: 12 }],
      observedAt: 1000
    }
  }, 2000);

  assert.equal(result.available, true);
  assert.equal(result.cached, true);
  assert.equal(result.lifetimeTokens, 42);
  assert.equal(result.totalWorkDays, 1);
  assert.equal(result.observedAt, 1000);
  assert.deepEqual(result.persistence, {});
});

test("a fresh official account snapshot replaces an older higher cached value", () => {
  const result = normalizeTokenUsageResponse({
    summary: {
      lifetimeTokens: 900,
      totalWorkDays: 2,
      currentStreakDays: 1,
      longestStreakDays: 3,
      peakDailyTokens: 80,
      longestRunningTurnSec: 20
    },
    dailyUsageBuckets: [
      { startDate: "2026-07-02", tokens: 40 },
      { startDate: "2026-07-03", tokens: 30 }
    ]
  }, {
    tokenUsageSnapshot: {
      lifetimeTokens: 1_000,
      totalWorkDays: 3,
      currentStreakDays: 5,
      longestStreakDays: 7,
      peakDailyTokens: 100,
      longestRunningTurnSec: 60,
      dailyUsageBuckets: [
        { startDate: "2026-07-01", tokens: 20 },
        { startDate: "2026-07-02", tokens: 50 }
      ],
      observedAt: 1_000
    }
  }, 2_000);

  assert.equal(result.lifetimeTokens, 900);
  assert.equal(result.totalWorkDays, 2);
  assert.equal(result.currentStreakDays, 1);
  assert.equal(result.longestStreakDays, 3);
  assert.equal(result.peakDailyTokens, 80);
  assert.equal(result.longestRunningTurnSec, 20);
  assert.deepEqual(result.dailyUsageBuckets, [
    { startDate: "2026-07-02", tokens: 40 },
    { startDate: "2026-07-03", tokens: 30 }
  ]);
  assert.deepEqual(result.persistence.tokenUsageSnapshot, {
    lifetimeTokens: 900,
    totalWorkDays: 2,
    currentStreakDays: 1,
    longestStreakDays: 3,
    peakDailyTokens: 80,
    longestRunningTurnSec: 20,
    dailyUsageBuckets: [
      { startDate: "2026-07-02", tokens: 40 },
      { startDate: "2026-07-03", tokens: 30 }
    ],
    observedAt: 2_000
  });
});

test("aggregates token buckets by day, Monday-based week, and month with empty gaps", () => {
  const buckets = normalizeDailyBuckets([
    { startDate: "2026-06-30", tokens: 5 },
    { startDate: "2026-07-01", tokens: 7 },
    { startDate: "2026-07-13", tokens: 11 }
  ]);

  const daily = aggregateTokenUsage(buckets, "day");
  assert.equal(daily.length, 14);
  assert.equal(daily[2].tokens, 0);

  assert.deepEqual(aggregateTokenUsage(buckets, "week"), [
    { startDate: "2026-06-29", tokens: 12 },
    { startDate: "2026-07-06", tokens: 0 },
    { startDate: "2026-07-13", tokens: 11 }
  ]);

  assert.deepEqual(aggregateTokenUsage(buckets, "month"), [
    { startDate: "2026-06-01", tokens: 5 },
    { startDate: "2026-07-01", tokens: 18 }
  ]);
});
