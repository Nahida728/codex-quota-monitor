const test = require("node:test");
const assert = require("node:assert/strict");
const {
  identifyWindows,
  normalizeQuotaResponse,
  restoreCachedCreditDetails,
  didUnexpectedReset,
  didOfficialFullReset
} = require("../src/quota-normalizer");

test("keeps all available reset credit details and their individual expiries", () => {
  const credits = Array.from({ length: 6 }, (_, index) => ({
    id: `credit-${index + 1}`,
    resetType: "codexRateLimits",
    status: "available",
    expiresAt: 2000 + index,
    title: "Full reset"
  }));
  const normalized = normalizeQuotaResponse({
    rateLimits: {
      primary: { usedPercent: 4, windowDurationMins: 10080, resetsAt: 9000 },
      secondary: null
    },
    rateLimitResetCredits: { availableCount: 6, credits }
  }, {}, 1000);

  assert.equal(normalized.resets.items.length, 6);
  assert.deepEqual(
    normalized.resets.items.map(item => item.expiresAt),
    [2000, 2001, 2002, 2003, 2004, 2005]
  );
  assert.equal(normalized.persistence.resetCreditDetails.length, 6);
});

test("restores the last complete credit details when a response only has the count", () => {
  const cached = [
    { id: "one", status: "available", title: "Full reset", expiresAt: 2000 },
    { id: "two", status: "available", title: "Full reset", expiresAt: 3000 }
  ];
  const restored = restoreCachedCreditDetails({
    availableCount: 2,
    items: [],
    earliestExpiresAt: null
  }, {
    resetCreditDetails: cached
  });

  assert.equal(restored.items.length, 2);
  assert.equal(restored.earliestExpiresAt, 2000);
});

test("does not restore stale credit details after the available count changes", () => {
  const restored = restoreCachedCreditDetails({
    availableCount: 1,
    items: [],
    earliestExpiresAt: null
  }, {
    resetCreditDetails: [
      { id: "one", expiresAt: 2000 },
      { id: "two", expiresAt: 3000 }
    ]
  });

  assert.equal(restored.items.length, 0);
});

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
  assert.deepEqual(normalized.events.newReset.history, []);
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
  assert.equal(normalized.events.newReset.history.length, 1);
  assert.equal(normalized.events.newReset.history[0].detectedAt, 1000);
  assert.equal(normalized.events.newReset.history[0].items[0].id, "two");
  assert.deepEqual(
    normalized.persistence.receivedResetHistory,
    normalized.events.newReset.history
  );
});

test("permanently retains received-reset history and migrates the legacy latest event", () => {
  const normalized = normalizeQuotaResponse({
    rateLimits: {
      primary: { usedPercent: 10, windowDurationMins: 10080, resetsAt: 9000 },
      secondary: null
    },
    rateLimitResetCredits: {
      availableCount: 1,
      credits: [{ id: "one", resetType: "codexRateLimits", status: "available" }]
    }
  }, {
    hasBaseline: true,
    knownCreditIds: ["one"],
    lastNewResetAt: 500,
    lastNewResetCount: 2,
    lastSnapshot: { windows: {}, resets: { availableCount: 1 } }
  }, 10_000_000);

  assert.equal(normalized.events.newReset.detected, false);
  assert.deepEqual(normalized.events.newReset.history, [{
    detectedAt: 500,
    count: 2,
    items: []
  }]);
  assert.deepEqual(
    normalized.persistence.receivedResetHistory,
    normalized.events.newReset.history
  );
});

test("uses a stable fallback identity when reset credit IDs are absent", () => {
  const raw = {
    rateLimits: {
      primary: { usedPercent: 10, windowDurationMins: 10080, resetsAt: 9000 },
      secondary: null
    },
    rateLimitResetCredits: {
      availableCount: 1,
      credits: [{
        resetType: "codexRateLimits",
        status: "available",
        grantedAt: 900,
        expiresAt: 5000
      }]
    }
  };
  const baseline = normalizeQuotaResponse(raw, {}, 1000);
  const refreshed = normalizeQuotaResponse(raw, baseline.persistence, 1100);

  assert.equal(refreshed.events.newReset.detected, false);
  assert.deepEqual(refreshed.events.newReset.history, []);
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

test("detects an early weekly reset while the five-hour window is officially disabled", () => {
  assert.equal(didOfficialFullReset({
    fiveHour: null,
    weekly: { usedPercent: 50, remainingPercent: 50, resetsAt: 9000 }
  }, {
    fiveHour: null,
    weekly: { usedPercent: 0, remainingPercent: 100, resetsAt: 12000 }
  }, 2000), true);
});

test("does not treat the natural weekly recovery as official while five-hour is disabled", () => {
  assert.equal(didOfficialFullReset({
    fiveHour: null,
    weekly: { usedPercent: 50, remainingPercent: 50, resetsAt: 2000 }
  }, {
    fiveHour: null,
    weekly: { usedPercent: 0, remainingPercent: 100, resetsAt: 12000 }
  }, 2000), false);
});

test("appends a detected official reset to permanent history", () => {
  const normalized = normalizeQuotaResponse({
    rateLimits: {
      primary: { usedPercent: 0, windowDurationMins: 10080, resetsAt: 12000 },
      secondary: { usedPercent: 0, windowDurationMins: 300, resetsAt: 6000 }
    },
    rateLimitResetCredits: { availableCount: 0, credits: [] }
  }, {
    hasBaseline: true,
    lastSnapshot: {
      windows: {
        fiveHour: { usedPercent: 65, remainingPercent: 35, resetsAt: 4000 },
        weekly: { usedPercent: 42, remainingPercent: 58, resetsAt: 9000 }
      },
      resets: { availableCount: 0 }
    }
  }, 2000);

  assert.equal(normalized.events.officialReset.detected, true);
  assert.equal(normalized.events.officialReset.detectedNow, true);
  assert.equal(normalized.events.officialReset.latestAt, 2000);
  assert.deepEqual(normalized.persistence.officialResetHistory, [{
    detectedAt: 2000,
    detectionMode: "all-limits",
    previousFiveHourResetAt: 4000,
    previousWeeklyResetAt: 9000
  }]);
});

test("records the five-hour-disabled detection mode in official reset history", () => {
  const normalized = normalizeQuotaResponse({
    rateLimits: {
      primary: { usedPercent: 0, windowDurationMins: 10080, resetsAt: 12000 },
      secondary: null
    },
    rateLimitResetCredits: { availableCount: 0, credits: [] }
  }, {
    hasBaseline: true,
    lastSnapshot: {
      windows: {
        fiveHour: null,
        weekly: { usedPercent: 42, remainingPercent: 58, resetsAt: 9000 }
      },
      resets: { availableCount: 0 }
    }
  }, 2000);

  assert.equal(normalized.events.officialReset.detectedNow, true);
  assert.equal(
    normalized.persistence.officialResetHistory[0].detectionMode,
    "weekly-only-five-hour-disabled"
  );
});

test("keeps official reset history permanently instead of expiring it", () => {
  const detectedAt = 100;
  const normalized = normalizeQuotaResponse({
    rateLimits: {
      primary: { usedPercent: 20, windowDurationMins: 10080, resetsAt: 9999999 },
      secondary: { usedPercent: 10, windowDurationMins: 300, resetsAt: 9999999 }
    },
    rateLimitResetCredits: { availableCount: 0, credits: [] }
  }, {
    hasBaseline: true,
    officialResetHistory: [{ detectedAt }],
    lastSnapshot: {
      windows: {
        fiveHour: { usedPercent: 9, remainingPercent: 91, resetsAt: 9999999 },
        weekly: { usedPercent: 19, remainingPercent: 81, resetsAt: 9999999 }
      },
      resets: { availableCount: 0 }
    }
  }, detectedAt + 365 * 24 * 60 * 60);

  assert.equal(normalized.events.officialReset.detected, true);
  assert.equal(normalized.events.officialReset.detectedNow, false);
  assert.equal(normalized.events.officialReset.latestAt, detectedAt);
  assert.equal(normalized.persistence.officialResetHistory.length, 1);
});

test("migrates the legacy official reset timestamp into permanent history", () => {
  const normalized = normalizeQuotaResponse({
    rateLimits: {
      primary: { usedPercent: 20, windowDurationMins: 10080, resetsAt: 9000 },
      secondary: null
    },
    rateLimitResetCredits: { availableCount: 0, credits: [] }
  }, {
    hasBaseline: true,
    officialResetAt: 1234,
    lastSnapshot: { windows: {}, resets: { availableCount: 0 } }
  }, 5000);

  assert.deepEqual(normalized.persistence.officialResetHistory, [{ detectedAt: 1234 }]);
  assert.equal(normalized.events.officialReset.latestAt, 1234);
});

test("does not duplicate the same official reset during adjacent refreshes", () => {
  const normalized = normalizeQuotaResponse({
    rateLimits: {
      primary: { usedPercent: 0, windowDurationMins: 10080, resetsAt: 12000 },
      secondary: { usedPercent: 0, windowDurationMins: 300, resetsAt: 6000 }
    },
    rateLimitResetCredits: { availableCount: 0, credits: [] }
  }, {
    hasBaseline: true,
    officialResetHistory: [{ detectedAt: 1950 }],
    lastSnapshot: {
      windows: {
        fiveHour: { usedPercent: 65, remainingPercent: 35, resetsAt: 4000 },
        weekly: { usedPercent: 42, remainingPercent: 58, resetsAt: 9000 }
      },
      resets: { availableCount: 0 }
    }
  }, 2000);

  assert.equal(normalized.events.officialReset.detectedNow, false);
  assert.equal(normalized.persistence.officialResetHistory.length, 1);
});

test("does not misclassify a user-consumed reset credit as an official reset", () => {
  const normalized = normalizeQuotaResponse({
    rateLimits: {
      primary: { usedPercent: 0, windowDurationMins: 10080, resetsAt: 12000 },
      secondary: { usedPercent: 0, windowDurationMins: 300, resetsAt: 6000 }
    },
    rateLimitResetCredits: {
      availableCount: 1,
      credits: [{ id: "remaining", status: "available", resetType: "codexRateLimits" }]
    }
  }, {
    hasBaseline: true,
    knownCreditIds: ["used", "remaining"],
    resetCreditDetails: [
      {
        id: "used",
        resetType: "codexRateLimits",
        grantedAt: 1000,
        expiresAt: 8000,
        title: "Used credit"
      },
      {
        id: "remaining",
        resetType: "codexRateLimits",
        grantedAt: 1100,
        expiresAt: 9000,
        title: "Remaining credit"
      }
    ],
    lastSnapshot: {
      windows: {
        fiveHour: { usedPercent: 65, remainingPercent: 35, resetsAt: 4000 },
        weekly: { usedPercent: 42, remainingPercent: 58, resetsAt: 9000 }
      },
      resets: { availableCount: 2 }
    }
  }, 2000);

  assert.equal(normalized.events.manualReset.detected, false);
  assert.equal(normalized.persistence.consumedResetHistory.length, 0);
  assert.deepEqual(normalized.persistence.pendingConsumedReset, {
    observedAt: 2000,
    count: 1,
    previousAvailableCount: 2,
    availableCount: 1,
    items: [{
      id: "used",
      resetType: "codexRateLimits",
      grantedAt: 1000,
      expiresAt: 8000,
      title: "Used credit"
    }],
    detectionMode: "all-limits",
    previousFiveHourResetAt: 4000,
    previousWeeklyResetAt: 9000
  });
  assert.equal(normalized.events.officialReset.detectedNow, false);
  assert.equal(normalized.events.officialReset.history.length, 0);

  const confirmed = normalizeQuotaResponse({
    rateLimits: {
      primary: { usedPercent: 0, windowDurationMins: 10080, resetsAt: 12000 },
      secondary: { usedPercent: 0, windowDurationMins: 300, resetsAt: 6000 }
    },
    rateLimitResetCredits: {
      availableCount: 1,
      credits: [{ id: "remaining", status: "available", resetType: "codexRateLimits" }]
    }
  }, normalized.persistence, 2100);

  assert.equal(confirmed.events.manualReset.detected, true);
  assert.equal(confirmed.events.manualReset.detectedAt, 2000);
  assert.equal(confirmed.events.manualReset.count, 1);
  assert.deepEqual(confirmed.events.manualReset.items, [{
    id: "used",
    resetType: "codexRateLimits",
    grantedAt: 1000,
    expiresAt: 8000,
    title: "Used credit"
  }]);
  assert.deepEqual(confirmed.persistence.consumedResetHistory, [{
    detectedAt: 2000,
    count: 1,
    previousAvailableCount: 2,
    availableCount: 1,
    items: [{
      id: "used",
      resetType: "codexRateLimits",
      grantedAt: 1000,
      expiresAt: 8000,
      title: "Used credit"
    }]
  }]);
  assert.equal(confirmed.persistence.pendingConsumedReset, null);
  assert.equal(confirmed.events.officialReset.detectedNow, false);
  assert.equal(confirmed.events.officialReset.history.length, 0);

  const retained = normalizeQuotaResponse({
    rateLimits: {
      primary: { usedPercent: 0, windowDurationMins: 10080, resetsAt: 12000 },
      secondary: { usedPercent: 0, windowDurationMins: 300, resetsAt: 6000 }
    },
    rateLimitResetCredits: {
      availableCount: 1,
      credits: [{ id: "remaining", status: "available", resetType: "codexRateLimits" }]
    }
  }, confirmed.persistence, 2200);
  assert.equal(retained.events.manualReset.detected, false);
  assert.deepEqual(
    retained.events.manualReset.history,
    confirmed.persistence.consumedResetHistory
  );
});

test("does not misclassify a user reset while the five-hour window is disabled", () => {
  const normalized = normalizeQuotaResponse({
    rateLimits: {
      primary: { usedPercent: 0, windowDurationMins: 10080, resetsAt: 12000 },
      secondary: null
    },
    rateLimitResetCredits: {
      availableCount: 0,
      credits: []
    }
  }, {
    hasBaseline: true,
    lastSnapshot: {
      windows: {
        fiveHour: null,
        weekly: { usedPercent: 42, remainingPercent: 58, resetsAt: 9000 }
      },
      resets: { availableCount: 1 }
    }
  }, 2000);

  assert.equal(normalized.events.manualReset.detected, false);
  assert.equal(normalized.persistence.consumedResetHistory.length, 0);
  assert.equal(normalized.persistence.pendingConsumedReset.count, 1);
  assert.equal(normalized.events.officialReset.detectedNow, false);
  assert.equal(normalized.persistence.officialResetHistory.length, 0);

  const confirmed = normalizeQuotaResponse({
    rateLimits: {
      primary: { usedPercent: 0, windowDurationMins: 10080, resetsAt: 12000 },
      secondary: null
    },
    rateLimitResetCredits: {
      availableCount: 0,
      credits: []
    }
  }, normalized.persistence, 2100);

  assert.equal(confirmed.events.manualReset.detected, true);
  assert.equal(confirmed.events.manualReset.count, 1);
  assert.deepEqual(confirmed.events.manualReset.items, []);
  assert.equal(confirmed.persistence.consumedResetHistory.length, 1);
  assert.equal(confirmed.events.officialReset.detectedNow, false);
  assert.equal(confirmed.persistence.officialResetHistory.length, 0);
});

test("records a consumed reset when the available count drops without a full quota reset", () => {
  const normalized = normalizeQuotaResponse({
    rateLimits: {
      primary: { usedPercent: 35, windowDurationMins: 10080, resetsAt: 12000 },
      secondary: { usedPercent: 55, windowDurationMins: 300, resetsAt: 6000 }
    },
    rateLimitResetCredits: {
      availableCount: 1,
      credits: [{ id: "remaining", status: "available", resetType: "codexRateLimits" }]
    }
  }, {
    hasBaseline: true,
    resetCreditDetails: [
      { id: "used", resetType: "codexRateLimits", expiresAt: 8000 },
      { id: "remaining", resetType: "codexRateLimits", expiresAt: 9000 }
    ],
    lastSnapshot: {
      windows: {
        fiveHour: { usedPercent: 65, remainingPercent: 35, resetsAt: 4000 },
        weekly: { usedPercent: 42, remainingPercent: 58, resetsAt: 9000 }
      },
      resets: { availableCount: 2 }
    }
  }, 2000);

  assert.equal(normalized.events.manualReset.detected, false);
  assert.equal(normalized.persistence.consumedResetHistory.length, 0);
  assert.equal(normalized.persistence.pendingConsumedReset.count, 1);
  assert.equal(normalized.events.officialReset.detectedNow, false);

  const confirmed = normalizeQuotaResponse({
    rateLimits: {
      primary: { usedPercent: 35, windowDurationMins: 10080, resetsAt: 12000 },
      secondary: { usedPercent: 55, windowDurationMins: 300, resetsAt: 6000 }
    },
    rateLimitResetCredits: {
      availableCount: 1,
      credits: [{ id: "remaining", status: "available", resetType: "codexRateLimits" }]
    }
  }, normalized.persistence, 2100);

  assert.equal(confirmed.events.manualReset.detected, true);
  assert.equal(confirmed.events.manualReset.count, 1);
  assert.equal(confirmed.events.manualReset.items[0].id, "used");
  assert.equal(confirmed.events.officialReset.detectedNow, false);
  assert.equal(confirmed.persistence.consumedResetHistory.length, 1);
});

test("discards a transient zero credit count instead of recording nonexistent usage", () => {
  const previousState = {
    hasBaseline: true,
    knownCreditIds: ["credit-1", "credit-2"],
    resetCreditDetails: [
      { id: "credit-1", resetType: "codexRateLimits", expiresAt: 8000 },
      { id: "credit-2", resetType: "codexRateLimits", expiresAt: 9000 }
    ],
    lastSnapshot: {
      windows: {
        fiveHour: { usedPercent: 65, remainingPercent: 35, resetsAt: 4000 },
        weekly: { usedPercent: 42, remainingPercent: 58, resetsAt: 9000 }
      },
      resets: { availableCount: 2 }
    }
  };
  const transient = normalizeQuotaResponse({
    rateLimits: {
      primary: { usedPercent: 0, windowDurationMins: 10080, resetsAt: 12000 },
      secondary: { usedPercent: 0, windowDurationMins: 300, resetsAt: 6000 }
    },
    rateLimitResetCredits: {
      availableCount: 0,
      credits: []
    }
  }, previousState, 2000);

  assert.equal(transient.events.manualReset.detected, false);
  assert.equal(transient.persistence.consumedResetHistory.length, 0);
  assert.equal(transient.persistence.pendingConsumedReset.count, 2);
  assert.equal(transient.events.officialReset.detectedNow, false);

  const recovered = normalizeQuotaResponse({
    rateLimits: {
      primary: { usedPercent: 0, windowDurationMins: 10080, resetsAt: 12000 },
      secondary: { usedPercent: 0, windowDurationMins: 300, resetsAt: 6000 }
    },
    rateLimitResetCredits: {
      availableCount: 2,
      credits: [
        { id: "credit-1", status: "available", resetType: "codexRateLimits" },
        { id: "credit-2", status: "available", resetType: "codexRateLimits" }
      ]
    }
  }, transient.persistence, 2100);

  assert.equal(recovered.events.manualReset.detected, false);
  assert.equal(recovered.persistence.consumedResetHistory.length, 0);
  assert.equal(recovered.persistence.pendingConsumedReset, null);
  assert.equal(recovered.events.officialReset.detectedNow, true);
  assert.equal(recovered.events.officialReset.latestAt, 2000);
  assert.equal(recovered.persistence.officialResetHistory.length, 1);
});

test("does not record complete credit details that prove a natural expiry", () => {
  const normalized = normalizeQuotaResponse({
    rateLimits: {
      primary: { usedPercent: 42, windowDurationMins: 10080, resetsAt: 12000 },
      secondary: { usedPercent: 65, windowDurationMins: 300, resetsAt: 6000 }
    },
    rateLimitResetCredits: {
      availableCount: 1,
      credits: [{ id: "remaining", status: "available", resetType: "codexRateLimits" }]
    }
  }, {
    hasBaseline: true,
    resetCreditDetails: [
      { id: "expired", resetType: "codexRateLimits", expiresAt: 2050 },
      { id: "remaining", resetType: "codexRateLimits", expiresAt: 9000 }
    ],
    lastSnapshot: {
      windows: {
        fiveHour: { usedPercent: 65, remainingPercent: 35, resetsAt: 4000 },
        weekly: { usedPercent: 42, remainingPercent: 58, resetsAt: 9000 }
      },
      resets: { availableCount: 2 }
    }
  }, 2000);

  assert.equal(normalized.events.manualReset.detected, false);
  assert.equal(normalized.events.manualReset.count, 0);
  assert.deepEqual(normalized.events.manualReset.history, []);
});
