const params = new URLSearchParams(location.search);
const nowSeconds = Math.floor(Date.now() / 1000);
const creditCount = Number.parseInt(params.get("credits") || "6", 10);
const offline = params.get("offline") === "1";
const updateDetected = params.get("update") === "1";
const updatePending = params.get("pending") === "1";

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
    backgroundDataUrl: null,
    backgroundOpacity: 0.34
  }),
  setLanguage: async language => language,
  setAlwaysOnTop: async enabled => enabled,
  setPositionLocked: async locked => locked,
  chooseBackground: async () => ({ canceled: true }),
  saveCroppedBackground: async () => ({}),
  setBackgroundOpacity: async opacity => opacity,
  clearBackground: async () => true,
  minimize: () => {},
  hide: () => {},
  onRefresh: () => {},
  onAlwaysOnTop: () => {}
};
