const test = require("node:test");
const assert = require("node:assert/strict");
const {
  identifyWindows,
  normalizeQuotaResponse,
  didUnexpectedReset,
  didOfficialFullReset
} = require("../src/quota-normalizer");

test("identifies five-hour and weekly windows by duration rather than field name", () => {
  const windows = identifyWindows({
    primary: { usedPercent: 55, windowDurationMins: 10080, resetsAt: 2000 },
    secondary: { usedPercent: 20, windowDurationMins: 300, resetsAt: 1000 }
  });
  assert.equal(windows.fiveHour.usedPercent, 20);
  assert.equal(windows.weekly.usedPercent, 55);
});

test("supports the official state where the five-hour window is absent", () => {
  const normalized = normalizeQuotaResponse({
    rateLimits: {
      primary: { usedPercent: 59, windowDurationMins: 10080, resetsAt: 2000 },
      secondary: null,
      planType: "plus"
    },
    rateLimitResetCredits: { availableCount: 0, credits: [] }
  }, {}, 1000);
  assert.equal(normalized.windows.fiveHour, null);
  assert.equal(normalized.windows.weekly.remainingPercent, 41);
});

test("does not label the initial reset credits as newly received", () => {
  const normalized = normalizeQuotaResponse({
    rateLimits: {
      primary: { usedPercent: 10, windowDurationMins: 10080, resetsAt: 9000 },
      secondary: null
    },
    rateLimitResetCredits: {
      availableCount: 1,
      credits: [{ id: "one", resetType: "codexRateLimits", status: "available", grantedAt: 900 }]
    }
  }, {}, 1000);
  assert.equal(normalized.events.newReset.detected, false);
});

test("detects a newly granted reset after a baseline exists", () => {
  const normalized = normalizeQuotaResponse({
    rateLimits: {
      primary: { usedPercent: 10, windowDurationMins: 10080, resetsAt: 9000 },
      secondary: null
    },
    rateLimitResetCredits: {
      availableCount: 2,
      credits: [
        { id: "one", resetType: "codexRateLimits", status: "available", grantedAt: 900 },
        { id: "two", resetType: "codexRateLimits", status: "available", grantedAt: 990 }
      ]
    }
  }, {
    hasBaseline: true,
    knownCreditIds: ["one"],
    lastSnapshot: { windows: {}, resets: { availableCount: 1 } }
  }, 1000);
  assert.equal(normalized.events.newReset.detected, true);
  assert.equal(normalized.events.newReset.count, 1);
});

test("detects a usage drop before the scheduled reset as unexpected", () => {
  assert.equal(
    didUnexpectedReset(
      { usedPercent: 80, resetsAt: 5000 },
      { usedPercent: 5, resetsAt: 9000 },
      2000,
      false
    ),
    true
  );
  assert.equal(
    didUnexpectedReset(
      { usedPercent: 80, resetsAt: 2000 },
      { usedPercent: 5, resetsAt: 9000 },
      2000,
      false
    ),
    false
  );
});

test("official full reset requires both windows at 100% before their scheduled reset", () => {
  const previous = {
    fiveHour: { usedPercent: 65, remainingPercent: 35, resetsAt: 4000 },
    weekly: { usedPercent: 42, remainingPercent: 58, resetsAt: 9000 }
  };
  const bothRestored = {
    fiveHour: { usedPercent: 0, remainingPercent: 100, resetsAt: 6000 },
    weekly: { usedPercent: 0, remainingPercent: 100, resetsAt: 12000 }
  };
  assert.equal(didOfficialFullReset(previous, bothRestored, 2000), true);
  assert.equal(didOfficialFullReset(previous, {
    ...bothRestored,
    weekly: { usedPercent: 1, remainingPercent: 99, resetsAt: 12000 }
  }, 2000), false);
  assert.equal(didOfficialFullReset(previous, bothRestored, 4000), false);
});

test("official full reset cannot be inferred while the five-hour window is disabled", () => {
  assert.equal(didOfficialFullReset({
    fiveHour: null,
    weekly: { usedPercent: 50, remainingPercent: 50, resetsAt: 9000 }
  }, {
    fiveHour: null,
    weekly: { usedPercent: 0, remainingPercent: 100, resetsAt: 12000 }
  }, 2000), false);
});
