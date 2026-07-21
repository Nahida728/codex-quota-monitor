const params = new URLSearchParams(location.search);
const nowSeconds = Math.floor(Date.now() / 1000);
const creditCount = Number.parseInt(params.get("credits") || "6", 10);
const offline = params.get("offline") === "1";
const updateDetected = params.get("update") === "1";
const updatePending = params.get("pending") === "1";
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

const snapshot = {
  online: !offline,
  checkedAt: Date.now(),
  lastSuccessfulAt: offline ? Date.now() - 60_000 : Date.now(),
  errorCode: offline ? "NETWORK_ERROR" : null,
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
    checkedLocally: true
  },
  tokenUsage: {
    available: true,
    cached: offline,
    lifetimeTokens: 671910282,
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
      newReset: { detected: params.get("newReset") === "1", count: 2 },
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
