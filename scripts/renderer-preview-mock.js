const params = new URLSearchParams(location.search);
const nowSeconds = Math.floor(Date.now() / 1000);
const creditCount = Number.parseInt(params.get("credits") || "6", 10);
const offline = params.get("offline") === "1";
const updateDetected = params.get("update") === "1";
const updatePending = params.get("pending") === "1";
const updateHistoryEmpty = params.get("history") === "0";
const activeTaskCount = Math.max(0, Number.parseInt(params.get("tasks") || "2", 10) || 0);
const previewBackground = params.get("bg") === "1"
  ? `data:image/svg+xml,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="460" height="690">
        <defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#54683b"/><stop offset=".5" stop-color="#275f77"/><stop offset="1" stop-color="#312b78"/></linearGradient></defs>
        <rect width="460" height="690" fill="url(#g)"/>
        <circle cx="85" cy="170" r="120" fill="#d8a741" opacity=".55"/>
        <circle cx="380" cy="520" r="170" fill="#4ba86a" opacity=".48"/>
        <path d="M0 530 Q130 390 250 530 T500 470 V690 H0Z" fill="#253c8f" opacity=".72"/>
      </svg>
    `)}`
  : null;
const tokenStart = new Date();
tokenStart.setDate(tokenStart.getDate() - 19);

const credits = Array.from({ length: creditCount }, (_, index) => ({
  resetType: "codexRateLimits",
  title: "Full reset",
  expiresAt: nowSeconds + (index + 1) * 86_400
}));
const previewReceivedResetHistory = [{
  detectedAt: nowSeconds - 86_400,
  count: 2,
  items: [{
    id: "received-one",
    resetType: "codexRateLimits",
    grantedAt: nowSeconds - 86_400,
    expiresAt: nowSeconds + 86_400,
    title: "Full reset"
  }, {
    id: "received-two",
    resetType: "codexRateLimits",
    grantedAt: nowSeconds - 86_400,
    expiresAt: nowSeconds + 2 * 86_400,
    title: "Full reset"
  }]
}, {
  detectedAt: nowSeconds - 12 * 86_400,
  count: 1,
  items: [{
    id: "received-three",
    resetType: "codexRateLimits",
    grantedAt: nowSeconds - 12 * 86_400,
    expiresAt: nowSeconds - 5 * 86_400,
    title: "Full reset"
  }]
}];
const previewActiveTasks = Array.from({ length: activeTaskCount }, (_, index) => ({
  id: `preview-turn-${index + 1}`,
  projectName: ["codex-quota-monitor", "nahida-website", "release-tools"][index] || `project-${index + 1}`,
  startedAt: nowSeconds - (734 + index * 463),
  elapsedSeconds: 734 + index * 463,
  estimatedCostUsd: 1.2846 + index * 0.739,
  hasUnpricedModels: index === 2,
  partial: false,
  pricingDate: "2026-07-26",
  models: [{
    model: index % 2 ? "gpt-5.6-terra" : "gpt-5.6-sol",
    estimatedCostUsd: 1.2846 + index * 0.739,
    priced: true,
    inputTokens: 438420 + index * 13500,
    cachedInputTokens: 402100 + index * 12100,
    outputTokens: 8280 + index * 710
  }]
}));

const snapshot = {
  online: !offline,
  checkedAt: Date.now(),
  lastSuccessfulAt: offline ? Date.now() - 60_000 : Date.now(),
  errorCode: offline ? "NETWORK_ERROR" : null,
  subscription: {
    available: !offline,
    planType: "plus",
    assistedWorkDays: 24,
    activeStart: nowSeconds - 32 * 86_400,
    expiresAt: nowSeconds + 28 * 86_400,
    renewalAt: nowSeconds + 28 * 86_400,
    projected: false,
    sourceCheckedAt: nowSeconds
  },
  clientUpdate: {
    available: true,
    detected: updatePending || updateDetected,
    status: updatePending ? "update-ready" : (updateDetected ? "updated" : "current"),
    pendingUpdate: updatePending,
    pendingVersion: updatePending ? "26.716.1010.0" : null,
    installedUpdateDetected: updateDetected,
    currentVersion: updateDetected ? "26.716.1010.0" : "26.715.2305.0",
    previousVersion: updateDetected ? "26.715.2305.0" : null,
    detectedAt: updateDetected ? Date.now() : null,
    checkedLocally: true,
    history: updateHistoryEmpty ? [] : [
      ...(updateDetected ? [{
        fromVersion: "26.715.2305.0",
        toVersion: "26.716.1010.0",
        detectedAt: Date.now() - 2 * 86_400_000
      }] : []),
      {
        fromVersion: "26.714.3210.0",
        toVersion: "26.715.2305.0",
        detectedAt: Date.now() - 16 * 86_400_000
      }, {
        fromVersion: "26.713.1802.0",
        toVersion: "26.714.3210.0",
        detectedAt: Date.now() - 35 * 86_400_000
      }
    ]
  },
  tokenUsage: {
    available: true,
    cached: offline,
    lifetimeTokens: 671910282,
    totalWorkDays: 24,
    currentStreakDays: 16,
    longestStreakDays: 16,
    peakDailyTokens: 70052553,
    observedAt: Date.now(),
    dailyUsageBuckets: Array.from({ length: 20 }, (_, index) => {
      const date = new Date(tokenStart);
      date.setDate(tokenStart.getDate() + index);
      return {
        startDate: date.toISOString().slice(0, 10),
        tokens: Math.round(8_000_000 + Math.sin(index * .72) * 5_000_000 + index * 520_000)
      };
    })
  },
  tokenCost: {
    available: true,
    cached: false,
    pricingDate: "2026-07-26",
    estimatedCostUsd: 409.369696,
    hasUnpricedModels: true,
    filesScanned: 37,
    truncated: false,
    observedAt: Date.now(),
    models: [{
      model: "gpt-5.6-sol",
      inputTokens: 454743518,
      cachedInputTokens: 435264512,
      cacheWriteInputTokens: 0,
      outputTokens: 1815517,
      reasoningOutputTokens: 603100,
      requestCount: 3689,
      longContextRequests: 21,
      cacheHitRate: 95.72,
      estimatedCostUsd: 374.507444,
      priced: true,
      pricing: { input: 5, cachedInput: 0.5, cacheWrite: 6.25, output: 30 }
    }, {
      model: "gpt-5.6-terra",
      inputTokens: 3974484,
      cachedInputTokens: 3369216,
      cacheWriteInputTokens: 0,
      outputTokens: 30242,
      reasoningOutputTokens: 8200,
      requestCount: 55,
      longContextRequests: 0,
      cacheHitRate: 84.77,
      estimatedCostUsd: 2.809104,
      priced: true,
      pricing: { input: 2.5, cachedInput: 0.25, cacheWrite: 3.125, output: 15 }
    }, {
      model: "deepseek-v4-pro",
      inputTokens: 714873,
      cachedInputTokens: 355001,
      cacheWriteInputTokens: 0,
      outputTokens: 186839,
      reasoningOutputTokens: 0,
      requestCount: 316,
      longContextRequests: 0,
      cacheHitRate: 49.66,
      estimatedCostUsd: null,
      priced: false,
      pricing: null
    }]
  },
  activeTasks: {
    available: true,
    tasks: previewActiveTasks,
    count: previewActiveTasks.length,
    truncated: false,
    observedAt: Date.now(),
    pricingDate: "2026-07-26"
  },
  receivedResetHistory: previewReceivedResetHistory,
  data: offline ? null : {
    planType: "plus",
    windows: {
      fiveHour: null,
      weekly: {
        remainingPercent: 91,
        usedPercent: 9,
        resetsAt: nowSeconds + 4 * 86_400 + 23 * 3_600
      }
    },
    resets: {
      availableCount: creditCount,
      items: credits
    },
    events: {
      newReset: {
        detected: params.get("newReset") === "1",
        count: 2,
        history: previewReceivedResetHistory
      },
      manualReset: { detected: false },
      officialReset: {
        detected: true,
        latestAt: nowSeconds - 7_200,
        history: [{
          detectedAt: nowSeconds - 7_200,
          detectionMode: "weekly-only-five-hour-disabled"
        }]
      }
    }
  }
};

window.codexMonitor = {
  readQuota: async () => snapshot,
  readActiveTaskStatus: async () => ({
    available: snapshot.activeTasks.available,
    count: snapshot.activeTasks.count,
    observedAt: Date.now()
  }),
  readSettings: async () => ({
    language: params.get("lang") === "en" ? "en" : "zh",
    alwaysOnTop: true,
    positionLocked: false,
    windowCollapsed: params.get("orb") === "1",
    windowModeAnchor: { x: 358, y: 43 },
    appIconDataUrl: null,
    backgroundDataUrl: previewBackground,
    backgroundOpacity: 0.34
  }),
  setLanguage: async language => language,
  setAlwaysOnTop: async enabled => enabled,
  setPositionLocked: async locked => locked,
  setCollapsed: async (collapsed, anchor) => ({ collapsed, anchor }),
  chooseBackground: async () => ({ canceled: true }),
  saveCroppedBackground: async () => ({}),
  setBackgroundOpacity: async opacity => opacity,
  clearBackground: async () => true,
  minimize: () => {},
  hide: () => {},
  updateTransitionSnapshot: () => {},
  onRefresh: () => {},
  onAlwaysOnTop: () => {},
  onWindowModeChanged: () => {}
};
