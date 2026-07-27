const {
  ACTIVE_TASK_PROBE_MS,
  getRefreshDelay,
  shouldWakeForActiveTask
} = window.RefreshPolicy;

const i18n = {
  zh: {
    appTitle: "Codex监测台",
    title: "Codex监测台",
    switchLanguage: "切换到英文",
    refreshNow: "立即刷新",
    quotaRegion: "额度",
    statusRegion: "状态提醒",
    checking: "正在连接 Codex…",
    connected: "Codex 已连接 · {plan}",
    offlineTitle: "Codex 当前离线",
    offlineMessage: "若你在中国大陆，请开启 VPN，并检查网络连接与 Codex 登录状态。",
    notInstalled: "未找到本机 Codex。请先安装并登录 Codex。",
    notLoggedIn: "Codex 尚未登录，请先在 Codex 中完成登录。",
    timeout: "连接 Codex 超时。若你在中国大陆，请开启 VPN 并检查网络。",
    fiveHour: "5 小时额度",
    weekly: "1 周额度",
    remaining: "剩余",
    used: "已使用 {value}%",
    restores: "{time} 恢复",
    unavailable: "暂停",
    unavailableDetail: "5 小时限额当前未由官方返回",
    noData: "暂无数据",
    resetCreditEyebrow: "RESET CREDITS",
    resetCreditTitle: "额度重置次数",
    resetCreditCardHint: "点击查看列表与收到记录",
    resetAvailableCount: "{count} 次可用",
    resetCreditDetailsLabel: "查看重置次数列表和收到记录",
    availableResetListTitle: "当前可用",
    receivedResetHistoryTitle: "收到记录",
    receivedResetHistoryEmpty: "尚未检测到新收到的重置次数",
    receivedResetHistoryCount: "共 {count} 条收到记录",
    receivedResetEntry: "收到 {count} 次重置额度",
    receivedResetLegacy: "旧版检测到新增重置额度",
    receivedResetAt: "检测于 {time}",
    resetType: "重置类型",
    expiresAt: "最近到期",
    fullReset: "完整额度重置",
    codexReset: "Codex 额度",
    unknown: "未知",
    noExpiry: "无到期时间",
    noCredits: "暂无可用次数",
    creditExpires: "{time} 到期",
    creditDetailsMissing: "另有 {count} 次明细暂未返回",
    resetListScrollable: "共 {count} 次，可滚动查看全部记录",
    newResetQuestion: "新重置次数",
    officialResetQuestion: "官方重置",
    clientUpdateQuestion: "Codex 客户端更新",
    detectedCount: "检测到新增 +{count}",
    notDetected: "本次未发现",
    resetDetected: "官方已重置所有限额",
    resetNotDetected: "未检测到",
    officialResetLatest: "最近一次：{time}",
    officialResetCardLatest: "{time}",
    officialResetNever: "暂无官方重置记录",
    officialResetHistoryTitle: "官方重置记录",
    officialResetHistoryHint: "记录检测器观察到双额度在正常恢复时间前同时恢复 100% 的时间，数据永久保存在本机。",
    officialResetHistoryEmpty: "尚未记录到符合条件的官方重置",
    officialResetHistoryCount: "共 {count} 次",
    officialResetNewest: "最近一次",
    officialResetDetectedAt: "检测于 {time}",
    officialResetModeAll: "双额度提前恢复",
    officialResetModeWeekly: "5 小时关闭 · 周额度提前恢复",
    officialResetModeLegacy: "旧版检测记录",
    manualResetExcluded: "检测到手动重置，未计入官方记录",
    manualResetCardExcluded: "手动重置已排除",
    openOfficialResetHistory: "查看官方重置记录",
    clientUpdateDetected: "检测到新版已安装",
    clientUpdateReady: "发现可用更新",
    clientUpdateNotDetected: "未发现新更新",
    clientUpdateUnknown: "版本状态不可用",
    clientUpdateVersion: "当前 v{version}",
    clientUpdateVersionChange: "新版 v{version}",
    clientUpdateTarget: "可更新至 v{version}",
    openClientUpdateHistory: "查看客户端版本更新时间线",
    clientUpdateHistoryTitle: "版本更新时间线",
    clientUpdateHistoryHint: "记录检测器观察到的 Codex 客户端版本升级，时间为本机首次检测到新版本的时间。",
    clientUpdateHistoryEmpty: "尚未检测到客户端版本升级",
    clientUpdateHistoryCount: "共 {count} 次版本升级",
    clientUpdateCurrentLabel: "当前版本",
    clientUpdatePendingLabel: "待安装版本",
    clientUpdateNoPending: "暂无",
    clientUpdateHistoryChange: "v{from} → v{to}",
    clientUpdateHistoryDetectedAt: "检测于 {time}",
    tokenUsageRegion: "Token 使用概览",
    tokenUsageTitle: "Token 使用量",
    tokenUsageCachedTitle: "Token 缓存",
    lifetimeTokens: "累计 Token",
    totalWorkDays: "累计工作",
    workDays: "{count} 天",
    estimatedApiCost: "API 等价金额",
    estimatedApiCostShort: "API 等价金额",
    estimatedTotalCost: "本机可统计调用",
    openCostDetails: "查看模型用量与 API 成本明细",
    costEstimateHint: "按 OpenAI 标准 API 价格估算，不代表 Codex 订阅的实际收费。只读取本机 Codex 使用记录中的模型与 Token 统计。",
    costCoverage: "{count} 个模型 · 定价更新 {date}",
    costCoveragePartial: "{count} 个模型 · 部分未计价 · {date}",
    costCoverageTruncated: "本机记录过多，仅统计可安全读取的部分",
    modelCostInput: "输入",
    modelCostCached: "缓存输入",
    modelCostOutput: "输出",
    modelCostHitRate: "命中率",
    modelCostUnpriced: "未提供 API 定价",
    modelCostUnknown: "未识别模型",
    modelCostEmpty: "暂无可统计的本机模型用量",
    modelCostRate: "每百万 Token：输入 ${input} · 缓存 ${cached} · 输出 ${output}",
    modelCostRequests: "{count} 次调用",
    modelCostCacheWrite: "缓存写入 {tokens}",
    modelCostLongContext: "{count} 次长上下文按官方倍率计价",
    activeTasksTitle: "进行中任务",
    activeTaskDetailsLabel: "查看进行中任务详情",
    activeTaskRunningCount: "{count} 个任务正在进行",
    activeTaskNone: "当前没有进行中的任务",
    activeTaskUnavailable: "任务状态暂不可用",
    activeTaskProjectFallback: "未命名项目",
    activeTaskProjectsMore: "{project} 等 {count} 个项目",
    activeTaskElapsedLabel: "已进行",
    activeTaskRunningStatus: "进行中",
    activeTaskRunningMetric: "正在运行",
    activeTaskLongestLabel: "最长",
    activeTaskTotalCostLabel: "API 等价",
    activeTaskMore: "另有 {count} 项",
    activeTaskCostLabel: "API 等价",
    activeTaskTimeLabel: "花费时间",
    activeTaskModelsLabel: "模型",
    activeTaskUnpriced: "含未定价模型",
    activeTaskPartialCost: "仅统计可读取部分",
    activeTaskDetailsHint: "按本机 Codex 当前回合的 Token 使用量与标准 API 价格估算，不代表 Codex 订阅实际收费。",
    activeTaskDetailCount: "当前 {count} 个任务",
    activeTaskLongest: "最长已进行 {time}",
    activeTaskEmptyDetail: "暂无正在进行的 Codex 任务",
    tokenUnavailable: "暂无数据",
    openTokenUsage: "查看 Token 使用趋势",
    tokenPeriodGroup: "统计周期",
    tokenPeriodDay: "日",
    tokenPeriodWeek: "周",
    tokenPeriodMonth: "月",
    tokenChartLabel: "Token 使用量折线图",
    tokenChartEmpty: "暂无 Token 历史数据",
    tokenChartTooltipValue: "{tokens} Token",
    tokenLive: "已同步账号数据",
    tokenCached: "显示最近缓存",
    tokenLatestValue: "{date} · {tokens}",
    waiting: "等待首次检测",
    checkedNow: "刚刚检测",
    checkedMinutes: "{count} 分钟前检测",
    autoRefresh: "每 60 秒自动刷新",
    autoRefreshActive: "任务期间每 5 秒自动刷新",
    reading: "读取 Codex 数据…",
    pinOn: "解锁位置",
    pinOff: "锁定位置",
    collapseToOrb: "收缩为悬浮球",
    expandFromOrb: "展开 Codex监测台",
    floatingOrb: "Codex 悬浮球，按住任意位置拖动，单击展开",
    minimize: "最小化",
    hide: "隐藏到托盘"
    ,
    backgroundTitle: "卡片背景",
    backgroundHint: "添加图片后，玻璃折射与层次会更加明显。",
    chooseBackground: "选择图片",
    clearBackground: "恢复默认",
    backgroundOpacity: "背景透明度",
    backgroundTooLarge: "图片不能超过 20 MB",
    backgroundSettings: "背景设置",
    close: "关闭",
    dropBackground: "拖入图片或点击选择",
    backgroundRequirement: "图片需大于 460 × 690",
    backgroundTooSmall: "图片尺寸不足，宽度需大于 460、高度需大于 690",
    unsupportedImage: "请选择 PNG、JPG、WebP 或 GIF 图片",
    cropTitle: "截取背景区域",
    cropHint: "拖动选框调整位置，拖动右下角改变选区大小。",
    cropResize: "调整裁剪区域",
    cancel: "取消",
    applyCrop: "使用此区域",
    cropSaving: "正在保存…"
  },
  en: {
    appTitle: "Codex Quota Monitor",
    title: "Quota Monitor",
    switchLanguage: "Switch to Chinese",
    refreshNow: "Refresh now",
    quotaRegion: "Quotas",
    statusRegion: "Status alerts",
    checking: "Connecting to Codex…",
    connected: "Codex connected · {plan}",
    offlineTitle: "Codex is offline",
    offlineMessage: "If you are in mainland China, enable your VPN and check your network and Codex sign-in.",
    notInstalled: "Codex was not found. Install and sign in to Codex first.",
    notLoggedIn: "Codex is not signed in. Sign in through Codex first.",
    timeout: "Codex timed out. Check your VPN and network connection.",
    fiveHour: "5-hour quota",
    weekly: "Weekly quota",
    remaining: "Remaining",
    used: "{value}% used",
    restores: "Resets {time}",
    unavailable: "Paused",
    unavailableDetail: "The official 5-hour limit is not currently returned",
    noData: "No data",
    resetCreditEyebrow: "RESET CREDITS",
    resetCreditTitle: "Available resets",
    resetCreditCardHint: "View available resets and received history",
    resetAvailableCount: "{count} available",
    resetCreditDetailsLabel: "View available resets and received history",
    availableResetListTitle: "Available now",
    receivedResetHistoryTitle: "Received history",
    receivedResetHistoryEmpty: "No newly received reset credits have been detected",
    receivedResetHistoryCount: "{count} received events",
    receivedResetEntry: "Received {count} reset credits",
    receivedResetLegacy: "New reset credits detected by an earlier version",
    receivedResetAt: "Detected {time}",
    resetType: "Reset type",
    expiresAt: "Nearest expiry",
    fullReset: "Full reset",
    codexReset: "Codex limits",
    unknown: "Unknown",
    noExpiry: "No expiry",
    noCredits: "No available resets",
    creditExpires: "Expires {time}",
    creditDetailsMissing: "{count} more reset details are unavailable",
    resetListScrollable: "{count} total; scroll to view every reset",
    newResetQuestion: "New reset credit",
    officialResetQuestion: "Official reset",
    clientUpdateQuestion: "Codex client update",
    detectedCount: "New reset +{count}",
    notDetected: "None detected",
    resetDetected: "Official full reset detected",
    resetNotDetected: "Not detected",
    officialResetLatest: "Latest: {time}",
    officialResetCardLatest: "{time}",
    officialResetNever: "No official reset recorded",
    officialResetHistoryTitle: "Official reset history",
    officialResetHistoryHint: "Records when both quota windows were observed returning to 100% before their scheduled reset. Data is stored permanently on this device.",
    officialResetHistoryEmpty: "No qualifying official reset has been recorded",
    officialResetHistoryCount: "{count} total",
    officialResetNewest: "Latest",
    officialResetDetectedAt: "Detected {time}",
    officialResetModeAll: "Both limits restored early",
    officialResetModeWeekly: "5-hour paused · Weekly restored early",
    officialResetModeLegacy: "Legacy detection record",
    manualResetExcluded: "Manual reset detected; excluded from official history",
    manualResetCardExcluded: "Manual reset excluded",
    openOfficialResetHistory: "View official reset history",
    clientUpdateDetected: "New version installed",
    clientUpdateReady: "Update available",
    clientUpdateNotDetected: "No new update found",
    clientUpdateUnknown: "Version unavailable",
    clientUpdateVersion: "Current v{version}",
    clientUpdateVersionChange: "Now v{version}",
    clientUpdateTarget: "Update to v{version}",
    openClientUpdateHistory: "View Codex client update timeline",
    clientUpdateHistoryTitle: "Version update timeline",
    clientUpdateHistoryHint: "Records Codex client upgrades observed by the monitor. Each time is when the new version was first detected on this device.",
    clientUpdateHistoryEmpty: "No client version upgrade has been detected",
    clientUpdateHistoryCount: "{count} version upgrades",
    clientUpdateCurrentLabel: "Current version",
    clientUpdatePendingLabel: "Pending version",
    clientUpdateNoPending: "None",
    clientUpdateHistoryChange: "v{from} → v{to}",
    clientUpdateHistoryDetectedAt: "Detected {time}",
    tokenUsageRegion: "Token usage overview",
    tokenUsageTitle: "Token usage",
    tokenUsageCachedTitle: "Cached usage",
    lifetimeTokens: "Lifetime tokens",
    totalWorkDays: "Total work",
    workDays: "{count} days",
    estimatedApiCost: "API-equivalent cost",
    estimatedApiCostShort: "API cost est.",
    estimatedTotalCost: "Locally measurable calls",
    openCostDetails: "View model usage and API cost details",
    costEstimateHint: "Estimated with standard OpenAI API prices; this is not an actual Codex subscription charge. Only model and Token statistics from local Codex usage records are read.",
    costCoverage: "{count} models · Pricing updated {date}",
    costCoveragePartial: "{count} models · Some unpriced · {date}",
    costCoverageTruncated: "Only a bounded portion of the local records could be safely scanned",
    modelCostInput: "Input",
    modelCostCached: "Cached input",
    modelCostOutput: "Output",
    modelCostHitRate: "Cache hit",
    modelCostUnpriced: "No API price",
    modelCostUnknown: "Unidentified model",
    modelCostEmpty: "No local model usage is available",
    modelCostRate: "Per 1M Tokens: input ${input} · cached ${cached} · output ${output}",
    modelCostRequests: "{count} calls",
    modelCostCacheWrite: "Cache writes {tokens}",
    modelCostLongContext: "{count} long-context calls use official multipliers",
    activeTasksTitle: "Active tasks",
    activeTaskDetailsLabel: "View active task details",
    activeTaskRunningCount: "{count} tasks running",
    activeTaskNone: "No active tasks",
    activeTaskUnavailable: "Task status unavailable",
    activeTaskProjectFallback: "Unnamed project",
    activeTaskProjectsMore: "{project} + {count} more",
    activeTaskElapsedLabel: "Elapsed",
    activeTaskRunningStatus: "Running",
    activeTaskRunningMetric: "Running",
    activeTaskLongestLabel: "Longest",
    activeTaskTotalCostLabel: "API equivalent",
    activeTaskMore: "{count} more",
    activeTaskCostLabel: "API equivalent",
    activeTaskTimeLabel: "Time spent",
    activeTaskModelsLabel: "Models",
    activeTaskUnpriced: "Includes unpriced models",
    activeTaskPartialCost: "Only the readable portion is counted",
    activeTaskDetailsHint: "Estimated from current local Codex turn Token usage and standard API prices; this is not an actual Codex subscription charge.",
    activeTaskDetailCount: "{count} active tasks",
    activeTaskLongest: "Longest running {time}",
    activeTaskEmptyDetail: "No Codex tasks are currently running",
    tokenUnavailable: "Unavailable",
    openTokenUsage: "View token usage trend",
    tokenPeriodGroup: "Aggregation period",
    tokenPeriodDay: "Day",
    tokenPeriodWeek: "Week",
    tokenPeriodMonth: "Month",
    tokenChartLabel: "Token usage line chart",
    tokenChartEmpty: "No token history available",
    tokenChartTooltipValue: "{tokens} Tokens",
    tokenLive: "Account data synced",
    tokenCached: "Showing recent cache",
    tokenLatestValue: "{date} · {tokens}",
    waiting: "Waiting for first check",
    checkedNow: "Checked just now",
    checkedMinutes: "Checked {count}m ago",
    autoRefresh: "Auto-refresh every 60s",
    autoRefreshActive: "Auto-refresh every 5s during tasks",
    reading: "Reading Codex data…",
    pinOn: "Unlock position",
    pinOff: "Lock position",
    collapseToOrb: "Collapse to floating orb",
    expandFromOrb: "Expand quota monitor",
    floatingOrb: "Codex floating orb. Hold anywhere to drag; click to expand.",
    minimize: "Minimize",
    hide: "Hide to tray",
    backgroundTitle: "Card background",
    backgroundHint: "Add an image to make the glass refraction and depth more visible.",
    chooseBackground: "Choose image",
    clearBackground: "Use default",
    backgroundOpacity: "Background opacity",
    backgroundTooLarge: "Images must be under 20 MB",
    backgroundSettings: "Background settings",
    close: "Close",
    dropBackground: "Drop an image or click to choose",
    backgroundRequirement: "Image must exceed 460 × 690",
    backgroundTooSmall: "Image is too small. Width must exceed 460 and height must exceed 690.",
    unsupportedImage: "Choose a PNG, JPG, WebP, or GIF image",
    cropTitle: "Crop background",
    cropHint: "Drag the frame to move it. Drag the lower-right handle to resize.",
    cropResize: "Resize crop area",
    cancel: "Cancel",
    applyCrop: "Use this area",
    cropSaving: "Saving…"
  }
};

const elements = Object.fromEntries([
  "app", "connectionStrip", "connectionLabel", "statusDot", "offlineNotice", "offlineMessage",
  "languageButton", "refreshButton", "pinButton", "collapseButton", "minimizeButton", "closeButton", "titlebar",
  "quotaSection", "statusSection",
  "backgroundButton", "backgroundPopover", "backgroundClose", "chooseBackground", "clearBackground",
  "opacitySlider", "opacityValue", "backgroundError", "customBackground", "backgroundDropZone",
  "cropModal", "cropClose", "cropCancel", "cropApply", "cropStage", "cropImage", "cropBox",
  "cropResizeHandle", "cropSourceInfo",
  "fiveHourPanel", "fiveHourReset", "fiveHourNumber", "fiveHourProgress", "fiveHourUsed",
  "weeklyPanel", "weeklyReset", "weeklyNumber", "weeklyProgress", "weeklyUsed",
  "resetCreditButton", "resetCreditIcon", "resetStatusCount", "resetCreditStatus",
  "resetCreditDetail", "resetCreditModal", "resetCreditClose", "resetCreditDone",
  "resetDetailCount", "resetCreditList", "receivedResetHistoryList",
  "officialResetButton", "officialResetStatus", "officialResetCheck", "officialResetHistoryModal",
  "officialResetHistoryClose", "officialResetHistoryDone", "officialResetHistoryList",
  "clientUpdateCard", "clientUpdateStatus", "clientUpdateVersion", "clientUpdateCheck", "clientUpdateIcon",
  "clientUpdateHistoryModal", "clientUpdateHistoryClose", "clientUpdateHistoryDone",
  "clientUpdateHistoryCurrent", "clientUpdateHistoryPending", "clientUpdateHistoryList",
  "tokenOverview", "tokenOverviewTitle", "lifetimeTokenValue", "totalWorkDaysValue",
  "estimatedCostValue", "tokenCostHelp", "tokenSparkline",
  "tokenUsageModal", "tokenUsageClose", "tokenUsageDone", "tokenModalLifetime", "tokenModalTotalWorkDays",
  "tokenPeriodSwitch", "tokenUsageFreshness", "tokenUsageChart", "tokenChartEmpty",
  "tokenChartRange", "tokenChartLatest", "tokenChartTooltip", "tokenChartTooltipDate",
  "tokenChartTooltipValue",
  "tokenCostModal", "tokenCostClose", "tokenCostDone", "tokenCostTotal",
  "tokenCostCoverage", "modelCostList",
  "activeTaskCard", "activeTaskCount", "activeTaskElapsed", "activeTaskTotalCost",
  "activeTaskPreviewList", "activeTaskMoreIndicator", "activeTaskModal",
  "activeTaskClose", "activeTaskDone",
  "activeTaskDetailCount", "activeTaskDetailLongest", "activeTaskList",
  "lastChecked", "autoRefreshLabel", "loadingLayer", "floatingOrb", "floatingOrbIcon", "floatingOrbOpen"
].map(id => [id, document.getElementById(id)]));

let language = "zh";
let alwaysOnTop = true;
let positionLocked = false;
let windowCollapsed = false;
let windowModeChanging = false;
let windowModeAnchor = { x: 358, y: 43 };
let latestSnapshot = null;
let refreshTimer = null;
let activeTaskProbeTimer = null;
let clockTimer = null;
let isRefreshing = false;
let backgroundDataUrl = null;
let backgroundOpacity = 0.34;
let cropSource = null;
let cropInteraction = null;
let cropFrame = null;
let officialResetHistory = [];
let receivedResetHistory = [];
let latestClientUpdate = {};
let tokenPeriod = "day";
let tokenChartSeries = [];
let tokenChartAnimationFrame = null;
let tokenChartAnimationActive = false;
let tokenChartHoverIndex = null;
let activeTasks = [];
let activeTasksAvailable = false;
let activeTaskObservedAt = null;
let activeTaskTimer = null;

const TOKEN_CHART_PADDING = Object.freeze({ left: 43, right: 13, top: 17, bottom: 28 });
const SECONDARY_DIALOG_SELECTOR = [
  ".crop-dialog",
  ".reset-dialog",
  ".history-dialog",
  ".token-dialog",
  ".cost-dialog",
  ".task-dialog"
].join(",");
const SECONDARY_MODAL_ENTER_FALLBACK_MS = 460;
const SECONDARY_MODAL_EXIT_FALLBACK_MS = 320;
const secondaryModalTransitions = new WeakMap();

function cancelSecondaryModalTransition(modal) {
  const transition = secondaryModalTransitions.get(modal);
  if (!transition) return;
  clearTimeout(transition.timer);
  transition.dialog?.removeEventListener("animationend", transition.onAnimationEnd);
  secondaryModalTransitions.delete(modal);
}

function openSecondaryModal(modal, focusTarget) {
  cancelSecondaryModalTransition(modal);
  modal.inert = false;
  modal.removeAttribute("aria-hidden");
  modal.classList.remove("is-entering", "is-closing");
  modal.hidden = false;

  // Restart the entrance sequence when a close is interrupted and the same
  // dialog is immediately reopened.
  void modal.offsetWidth;
  const dialog = modal.querySelector(SECONDARY_DIALOG_SELECTOR);
  const transition = {
    dialog,
    timer: null,
    onAnimationEnd: null
  };
  const finish = () => {
    if (secondaryModalTransitions.get(modal) !== transition) return;
    clearTimeout(transition.timer);
    dialog?.removeEventListener("animationend", transition.onAnimationEnd);
    secondaryModalTransitions.delete(modal);
    modal.classList.remove("is-entering");
  };
  transition.onAnimationEnd = event => {
    if (event.target === dialog && event.animationName === "secondary-dialog-enter") {
      finish();
    }
  };
  dialog?.addEventListener("animationend", transition.onAnimationEnd);
  transition.timer = setTimeout(finish, SECONDARY_MODAL_ENTER_FALLBACK_MS);
  secondaryModalTransitions.set(modal, transition);
  modal.classList.add("is-entering");
  requestAnimationFrame(() => {
    if (!modal.hidden && !modal.classList.contains("is-closing")) {
      focusTarget?.focus({ preventScroll: true });
    }
  });
}

function closeSecondaryModal(modal, restoreFocus, { onClose, onHidden } = {}) {
  if (!modal || modal.hidden || modal.classList.contains("is-closing")) return;

  cancelSecondaryModalTransition(modal);
  modal.classList.remove("is-entering");
  modal.classList.add("is-closing");
  modal.inert = true;
  onClose?.();

  const dialog = modal.querySelector(SECONDARY_DIALOG_SELECTOR);
  const transition = {
    dialog,
    timer: null,
    onAnimationEnd: null
  };

  const finish = () => {
    if (secondaryModalTransitions.get(modal) !== transition) return;
    clearTimeout(transition.timer);
    dialog?.removeEventListener("animationend", transition.onAnimationEnd);
    secondaryModalTransitions.delete(modal);
    modal.hidden = true;
    modal.classList.remove("is-closing");
    modal.inert = false;
    modal.removeAttribute("aria-hidden");
    onHidden?.();
    restoreFocus?.focus({ preventScroll: true });
  };

  transition.onAnimationEnd = event => {
    if (event.target === dialog && event.animationName === "secondary-dialog-exit") {
      finish();
    }
  };
  dialog?.addEventListener("animationend", transition.onAnimationEnd);
  transition.timer = setTimeout(finish, SECONDARY_MODAL_EXIT_FALLBACK_MS);
  secondaryModalTransitions.set(modal, transition);
}

function t(key, values = {}) {
  let text = i18n[language][key] ?? key;
  for (const [name, value] of Object.entries(values)) {
    text = text.replace(`{${name}}`, value);
  }
  return text;
}

function applyLanguage() {
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.title = t("appTitle");
  document.querySelectorAll("[data-i18n]").forEach(node => {
    node.textContent = t(node.dataset.i18n);
  });
  elements.languageButton.textContent = language === "zh" ? "EN" : "中";
  elements.languageButton.title = t("switchLanguage");
  elements.languageButton.setAttribute("aria-label", t("switchLanguage"));
  elements.refreshButton.title = t("refreshNow");
  elements.refreshButton.setAttribute("aria-label", t("refreshNow"));
  elements.quotaSection.setAttribute("aria-label", t("quotaRegion"));
  elements.statusSection.setAttribute("aria-label", t("statusRegion"));
  elements.resetCreditButton.setAttribute("aria-label", t("resetCreditDetailsLabel"));
  elements.clientUpdateCard.setAttribute("aria-label", t("openClientUpdateHistory"));
  elements.tokenOverview.setAttribute("aria-label", t("openTokenUsage"));
  elements.tokenCostHelp.title = t("openCostDetails");
  elements.tokenCostHelp.setAttribute("aria-label", t("openCostDetails"));
  elements.activeTaskCard.setAttribute("aria-label", t("activeTaskDetailsLabel"));
  elements.tokenPeriodSwitch.setAttribute("aria-label", t("tokenPeriodGroup"));
  elements.tokenUsageChart.setAttribute("aria-label", t("tokenChartLabel"));
  elements.pinButton.title = positionLocked ? t("pinOn") : t("pinOff");
  elements.pinButton.setAttribute("aria-label", elements.pinButton.title);
  elements.collapseButton.title = t("collapseToOrb");
  elements.collapseButton.setAttribute("aria-label", t("collapseToOrb"));
  elements.floatingOrbOpen.title = t("expandFromOrb");
  elements.floatingOrbOpen.setAttribute("aria-label", t("expandFromOrb"));
  elements.minimizeButton.title = t("minimize");
  elements.minimizeButton.setAttribute("aria-label", t("minimize"));
  elements.closeButton.title = t("hide");
  elements.closeButton.setAttribute("aria-label", t("hide"));
  elements.backgroundButton.title = t("backgroundSettings");
  elements.backgroundButton.setAttribute("aria-label", t("backgroundSettings"));
  elements.backgroundClose.setAttribute("aria-label", t("close"));
  elements.cropClose.setAttribute("aria-label", t("close"));
  elements.cropResizeHandle.setAttribute("aria-label", t("cropResize"));
  elements.officialResetHistoryClose.setAttribute("aria-label", t("close"));
  elements.clientUpdateHistoryClose.setAttribute("aria-label", t("close"));
  elements.resetCreditClose.setAttribute("aria-label", t("close"));
  elements.tokenUsageClose.setAttribute("aria-label", t("close"));
  elements.tokenCostClose.setAttribute("aria-label", t("close"));
  elements.activeTaskClose.setAttribute("aria-label", t("close"));
  elements.officialResetButton.setAttribute("aria-label", t("openOfficialResetHistory"));
  if (latestSnapshot) render(latestSnapshot);
}

function applyBackground() {
  elements.customBackground.style.backgroundImage = backgroundDataUrl ? `url("${backgroundDataUrl}")` : "none";
  elements.customBackground.style.opacity = backgroundDataUrl ? String(backgroundOpacity) : "0";
  elements.app.classList.toggle("has-custom-background", Boolean(backgroundDataUrl));
  elements.opacitySlider.value = String(Math.round(backgroundOpacity * 100));
  elements.opacityValue.textContent = `${Math.round(backgroundOpacity * 100)}%`;
  elements.clearBackground.disabled = !backgroundDataUrl;
}

function closeBackgroundPopover() {
  elements.backgroundPopover.hidden = true;
  elements.backgroundButton.classList.remove("is-active");
}

function showBackgroundError(messageKey) {
  elements.backgroundError.textContent = t(messageKey);
  elements.backgroundError.hidden = false;
}

function renderCropBox() {
  if (!cropSource?.crop) return;
  const { x, y, width, height } = cropSource.crop;
  Object.assign(elements.cropBox.style, {
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`
  });
}

function closeCropModal() {
  closeSecondaryModal(elements.cropModal, elements.backgroundButton, {
    onHidden() {
      elements.cropImage.removeAttribute("src");
      cropSource = null;
      cropInteraction = null;
    }
  });
}

function openCropper(dataUrl, name = "") {
  elements.backgroundError.hidden = true;
  const probe = new Image();
  probe.onload = () => {
    if (probe.naturalWidth <= 460 || probe.naturalHeight <= 690) {
      showBackgroundError("backgroundTooSmall");
      return;
    }
    cropSource = {
      dataUrl,
      name,
      naturalWidth: probe.naturalWidth,
      naturalHeight: probe.naturalHeight,
      displayedImage: null,
      crop: null
    };
    elements.cropImage.src = dataUrl;
    elements.cropSourceInfo.textContent = `${name ? `${name} · ` : ""}${probe.naturalWidth} × ${probe.naturalHeight}`;
    openSecondaryModal(elements.cropModal, elements.cropClose);
    requestAnimationFrame(() => {
      const displayedImage = window.CropGeometry.containedImageRect(
        elements.cropStage.clientWidth,
        elements.cropStage.clientHeight,
        probe.naturalWidth,
        probe.naturalHeight
      );
      cropSource.displayedImage = displayedImage;
      cropSource.crop = window.CropGeometry.initialCrop(displayedImage, 460 / 690);
      Object.assign(elements.cropImage.style, {
        left: `${displayedImage.x}px`,
        top: `${displayedImage.y}px`,
        width: `${displayedImage.width}px`,
        height: `${displayedImage.height}px`
      });
      renderCropBox();
    });
  };
  probe.onerror = () => showBackgroundError("unsupportedImage");
  probe.src = dataUrl;
}

function readDroppedImage(file) {
  elements.backgroundError.hidden = true;
  if (!file || !/^image\/(png|jpeg|webp|gif)$/i.test(file.type || "")) {
    showBackgroundError("unsupportedImage");
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    showBackgroundError("backgroundTooLarge");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => openCropper(reader.result, file.name);
  reader.onerror = () => showBackgroundError("unsupportedImage");
  reader.readAsDataURL(file);
}

function initializeCropper() {
  elements.cropBox.addEventListener("pointerdown", event => {
    if (!cropSource?.crop || event.button !== 0) return;
    cropInteraction = {
      pointerId: event.pointerId,
      mode: event.target === elements.cropResizeHandle ? "resize" : "move",
      x: event.clientX,
      y: event.clientY,
      crop: { ...cropSource.crop }
    };
    elements.cropBox.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  });

  elements.cropBox.addEventListener("pointermove", event => {
    if (!cropInteraction || event.pointerId !== cropInteraction.pointerId || cropFrame !== null) return;
    const clientX = event.clientX;
    const clientY = event.clientY;
    cropFrame = requestAnimationFrame(() => {
      cropFrame = null;
      if (!cropInteraction || !cropSource) return;
      const deltaX = clientX - cropInteraction.x;
      const deltaY = clientY - cropInteraction.y;
      cropSource.crop = cropInteraction.mode === "resize"
        ? window.CropGeometry.resizeCrop(
            cropInteraction.crop,
            deltaX,
            deltaY,
            cropSource.displayedImage,
            460 / 690
          )
        : window.CropGeometry.moveCrop(
            cropInteraction.crop,
            deltaX,
            deltaY,
            cropSource.displayedImage
          );
      renderCropBox();
    });
  });

  const endCropInteraction = event => {
    if (!cropInteraction || event.pointerId !== cropInteraction.pointerId) return;
    try { elements.cropBox.releasePointerCapture(event.pointerId); } catch {}
    cropInteraction = null;
  };
  elements.cropBox.addEventListener("pointerup", endCropInteraction);
  elements.cropBox.addEventListener("pointercancel", endCropInteraction);

  elements.cropClose.addEventListener("click", closeCropModal);
  elements.cropCancel.addEventListener("click", closeCropModal);
  elements.cropApply.addEventListener("click", async () => {
    if (!cropSource?.crop) return;
    const sourceRect = window.CropGeometry.toSourceRect(
      cropSource.crop,
      cropSource.displayedImage,
      cropSource.naturalWidth,
      cropSource.naturalHeight
    );
    const canvas = document.createElement("canvas");
    canvas.width = 460;
    canvas.height = 690;
    const context = canvas.getContext("2d", { alpha: false });
    context.drawImage(
      elements.cropImage,
      sourceRect.x,
      sourceRect.y,
      sourceRect.width,
      sourceRect.height,
      0,
      0,
      canvas.width,
      canvas.height
    );
    elements.cropApply.disabled = true;
    elements.cropApply.textContent = t("cropSaving");
    try {
      const result = await window.codexMonitor.saveCroppedBackground(canvas.toDataURL("image/png"));
      if (result?.dataUrl) {
        backgroundDataUrl = result.dataUrl;
        applyBackground();
        closeCropModal();
        closeBackgroundPopover();
      } else {
        showBackgroundError(result?.error === "FILE_TOO_LARGE" ? "backgroundTooLarge" : "unsupportedImage");
      }
    } finally {
      elements.cropApply.disabled = false;
      elements.cropApply.textContent = t("applyCrop");
    }
  });
}

function formatDate(timestamp, includeYear = false) {
  if (!Number.isFinite(timestamp)) return t("noData");
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    ...(includeYear ? { year: "numeric" } : {}),
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp * 1000));
}

function formatResetTime(timestamp) {
  if (!Number.isFinite(timestamp)) return t("noData");
  const now = Date.now();
  const target = timestamp * 1000;
  const diff = Math.max(0, target - now);
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const relative = language === "zh"
    ? (hours >= 24 ? `${Math.floor(hours / 24)} 天 ${hours % 24} 小时后` : `${hours} 小时 ${minutes} 分后`)
    : (hours >= 24 ? `in ${Math.floor(hours / 24)}d ${hours % 24}h` : `in ${hours}h ${minutes}m`);
  return `${formatDate(timestamp)} · ${relative}`;
}

function setQuota(panel, reset, number, progress, used, quotaWindow, unavailable = false) {
  panel.classList.toggle("is-unavailable", unavailable);
  if (unavailable) {
    reset.textContent = t("unavailableDetail");
    number.innerHTML = `<span class="unavailable-pill">${t("unavailable")}</span>`;
    progress.style.width = "0%";
    used.textContent = "—";
    return;
  }
  if (!quotaWindow) {
    reset.textContent = t("noData");
    number.innerHTML = "<span>--</span><small>%</small>";
    progress.style.width = "0%";
    used.textContent = "—";
    return;
  }
  reset.textContent = t("restores", { time: formatResetTime(quotaWindow.resetsAt) });
  number.innerHTML = `<span>${quotaWindow.remainingPercent}</span><small>%</small>`;
  progress.style.width = `${quotaWindow.remainingPercent}%`;
  used.textContent = t("used", { value: quotaWindow.usedPercent });
}

function setSignal(status, check, icon, detected, positiveText, negativeText) {
  status.textContent = detected ? positiveText : negativeText;
  check.classList.toggle("is-positive", detected);
  icon?.classList.toggle("is-positive", detected);
}

function getResetCreditTitle(credit) {
  if (credit?.resetType === "codexRateLimits") return t("fullReset");
  if (credit?.title) return credit.title;
  return t("codexReset");
}

function renderReceivedResetHistory(history = []) {
  receivedResetHistory = Array.isArray(history)
    ? history
        .filter(item => Number.isFinite(item?.detectedAt))
        .slice()
        .sort((a, b) => b.detectedAt - a.detectedAt)
    : [];
  elements.receivedResetHistoryList.replaceChildren();

  if (!receivedResetHistory.length) {
    const empty = document.createElement("div");
    empty.className = "received-reset-empty";
    empty.textContent = t("receivedResetHistoryEmpty");
    elements.receivedResetHistoryList.append(empty);
    return;
  }

  const count = document.createElement("div");
  count.className = "history-count";
  count.textContent = t("receivedResetHistoryCount", {
    count: formatTokenCount(receivedResetHistory.length)
  });
  elements.receivedResetHistoryList.append(count);

  receivedResetHistory.forEach(event => {
    const row = document.createElement("article");
    row.className = "received-reset-item";

    const marker = document.createElement("span");
    marker.className = "received-reset-marker";
    marker.textContent = `+${Math.max(1, Number(event.count) || 1)}`;

    const copy = document.createElement("div");
    const title = document.createElement("strong");
    const hasDetails = Array.isArray(event.items) && event.items.length > 0;
    title.textContent = hasDetails
      ? t("receivedResetEntry", { count: Math.max(1, Number(event.count) || event.items.length) })
      : t("receivedResetLegacy");

    const detail = document.createElement("span");
    const types = hasDetails
      ? [...new Set(event.items.map(getResetCreditTitle).filter(Boolean))]
      : [];
    detail.textContent = [
      t("receivedResetAt", { time: formatDate(event.detectedAt, true) }),
      types.join(" · ")
    ].filter(Boolean).join(" · ");

    copy.append(title, detail);
    row.append(marker, copy);
    elements.receivedResetHistoryList.append(row);
  });
}

function renderResetCredits(resets = {}, newResetEvent = {}) {
  const hasAvailableCount = Number.isFinite(resets.availableCount);
  const availableCount = hasAvailableCount ? resets.availableCount : 0;
  const items = Array.isArray(resets.items)
    ? resets.items
        .filter(Boolean)
        .slice()
        .sort((a, b) => {
          const left = Number.isFinite(a.expiresAt) ? a.expiresAt : Number.POSITIVE_INFINITY;
          const right = Number.isFinite(b.expiresAt) ? b.expiresAt : Number.POSITIVE_INFINITY;
          return left - right;
        })
    : [];
  const missingCount = Math.max(0, availableCount - items.length);
  const renderedRowCount = items.length + (missingCount ? 1 : 0);
  elements.resetStatusCount.textContent = hasAvailableCount ? availableCount : "--";
  elements.resetCreditStatus.textContent = hasAvailableCount
    ? t("resetAvailableCount", { count: formatTokenCount(availableCount) })
    : t("noData");
  elements.resetCreditDetail.textContent = newResetEvent.detected
    ? t("detectedCount", { count: newResetEvent.count })
    : t("resetCreditCardHint");
  elements.resetCreditIcon.classList.toggle("is-positive", availableCount > 0);
  elements.resetDetailCount.textContent = hasAvailableCount
    ? t("resetAvailableCount", { count: formatTokenCount(availableCount) })
    : t("noData");
  renderReceivedResetHistory(newResetEvent.history);
  elements.resetCreditList.replaceChildren();
  elements.resetCreditList.classList.toggle("is-overflowing", renderedRowCount > 6);
  elements.resetCreditList.style.setProperty(
    "--reset-visible-count",
    String(Math.max(1, Math.min(renderedRowCount, 6)))
  );

  if (renderedRowCount > 6) {
    elements.resetCreditList.tabIndex = 0;
    elements.resetCreditList.setAttribute(
      "aria-label",
      t("resetListScrollable", { count: availableCount })
    );
  } else {
    elements.resetCreditList.removeAttribute("tabindex");
    elements.resetCreditList.removeAttribute("aria-label");
  }

  if (!availableCount) {
    const empty = document.createElement("div");
    empty.className = "reset-credit-empty";
    empty.textContent = hasAvailableCount ? t("noCredits") : t("noData");
    elements.resetCreditList.append(empty);
    return;
  }

  items.forEach((credit, index) => {
    const row = document.createElement("article");
    row.className = "reset-credit-item";

    const marker = document.createElement("span");
    marker.className = "reset-credit-index";
    marker.textContent = String(index + 1).padStart(2, "0");

    const title = document.createElement("strong");
    title.textContent = getResetCreditTitle(credit);

    const expiry = document.createElement("span");
    expiry.className = "reset-credit-expiry";
    expiry.textContent = Number.isFinite(credit.expiresAt)
      ? t("creditExpires", { time: formatDate(credit.expiresAt, true) })
      : t("noExpiry");

    row.append(marker, title, expiry);
    elements.resetCreditList.append(row);
  });

  if (missingCount) {
    const missing = document.createElement("div");
    missing.className = "reset-credit-missing";
    missing.textContent = t("creditDetailsMissing", { count: missingCount });
    elements.resetCreditList.append(missing);
  }
}

function renderOfficialResetHistory(event = {}, manualReset = {}) {
  officialResetHistory = Array.isArray(event.history)
    ? event.history
        .filter(item => Number.isFinite(item?.detectedAt))
        .sort((a, b) => a.detectedAt - b.detectedAt)
    : [];
  const latestAt = Number.isFinite(event.latestAt)
    ? event.latestAt
    : officialResetHistory.at(-1)?.detectedAt;
  const hasHistory = Number.isFinite(latestAt);

  elements.officialResetStatus.textContent = manualReset.detected
    ? t("manualResetCardExcluded")
    : (hasHistory
        ? t("officialResetCardLatest", { time: formatDate(latestAt) })
        : t("officialResetNever"));
  elements.officialResetCheck.classList.toggle("is-positive", hasHistory);

  elements.officialResetHistoryList.replaceChildren();
  if (!officialResetHistory.length) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = t("officialResetHistoryEmpty");
    elements.officialResetHistoryList.append(empty);
    return;
  }

  const count = document.createElement("div");
  count.className = "history-count";
  count.textContent = t("officialResetHistoryCount", { count: officialResetHistory.length });
  elements.officialResetHistoryList.append(count);

  officialResetHistory.slice().reverse().forEach((record, index) => {
    const item = document.createElement("article");
    item.className = "history-item";

    const marker = document.createElement("span");
    marker.className = "history-marker";
    marker.textContent = String(officialResetHistory.length - index).padStart(2, "0");

    const copy = document.createElement("div");
    const title = document.createElement("strong");
    const modeLabel = {
      "all-limits": t("officialResetModeAll"),
      "weekly-only-five-hour-disabled": t("officialResetModeWeekly")
    }[record.detectionMode] || t("officialResetModeLegacy");
    title.textContent = index === 0
      ? `${modeLabel} · ${t("officialResetNewest")}`
      : modeLabel;
    const time = document.createElement("span");
    time.textContent = t("officialResetDetectedAt", {
      time: formatDate(record.detectedAt, true)
    });
    copy.append(title, time);
    item.append(marker, copy);
    elements.officialResetHistoryList.append(item);
  });
}

function renderClientUpdateHistory(clientUpdate = latestClientUpdate) {
  latestClientUpdate = clientUpdate || {};
  const history = Array.isArray(latestClientUpdate.history)
    ? latestClientUpdate.history.filter(record =>
        /^\d+(?:\.\d+){1,5}$/.test(String(record?.fromVersion || "")) &&
        /^\d+(?:\.\d+){1,5}$/.test(String(record?.toVersion || "")) &&
        Number.isFinite(record?.detectedAt)
      )
    : [];

  elements.clientUpdateHistoryCurrent.textContent = latestClientUpdate.currentVersion
    ? `v${latestClientUpdate.currentVersion}`
    : "—";
  elements.clientUpdateHistoryPending.textContent = latestClientUpdate.pendingVersion
    ? `v${latestClientUpdate.pendingVersion}`
    : t("clientUpdateNoPending");
  elements.clientUpdateHistoryList.replaceChildren();

  if (!history.length) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = t("clientUpdateHistoryEmpty");
    elements.clientUpdateHistoryList.append(empty);
    return;
  }

  const count = document.createElement("div");
  count.className = "history-count";
  count.textContent = t("clientUpdateHistoryCount", {
    count: formatTokenCount(history.length)
  });
  elements.clientUpdateHistoryList.append(count);

  history.forEach((record, index) => {
    const item = document.createElement("article");
    item.className = "history-item client-update-history-item";
    const marker = document.createElement("span");
    marker.className = "history-marker client-update-history-marker";
    marker.textContent = String(history.length - index).padStart(2, "0");

    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = t("clientUpdateHistoryChange", {
      from: record.fromVersion,
      to: record.toVersion
    });
    const time = document.createElement("span");
    time.textContent = t("clientUpdateHistoryDetectedAt", {
      time: formatDate(record.detectedAt / 1_000, true)
    });
    copy.append(title, time);
    item.append(marker, copy);
    elements.clientUpdateHistoryList.append(item);
  });
}

function renderClientUpdate(clientUpdate = {}) {
  latestClientUpdate = clientUpdate || {};
  const pending = Boolean(
    clientUpdate.pendingUpdate &&
    clientUpdate.currentVersion &&
    clientUpdate.pendingVersion
  );
  const installed = Boolean(
    !pending &&
    (clientUpdate.installedUpdateDetected || clientUpdate.status === "updated") &&
    clientUpdate.currentVersion
  );
  const available = Boolean(clientUpdate.available && clientUpdate.currentVersion);
  if (pending) {
    elements.clientUpdateStatus.textContent = t("clientUpdateReady");
    elements.clientUpdateVersion.textContent = t("clientUpdateTarget", {
      version: clientUpdate.pendingVersion
    });
  } else if (installed) {
    elements.clientUpdateStatus.textContent = t("clientUpdateDetected");
    elements.clientUpdateVersion.textContent = t("clientUpdateVersionChange", {
      version: clientUpdate.currentVersion
    });
  } else {
    elements.clientUpdateStatus.textContent = available
      ? t("clientUpdateNotDetected")
      : t("clientUpdateUnknown");
    elements.clientUpdateVersion.textContent = available
      ? t("clientUpdateVersion", { version: clientUpdate.currentVersion })
      : "—";
  }
  elements.clientUpdateCheck.classList.toggle("is-positive", pending || installed);
  elements.clientUpdateIcon.classList.toggle("is-positive", pending || installed);
  elements.clientUpdateCard.classList.toggle("has-update", pending || installed);
  renderClientUpdateHistory(clientUpdate);
}

function formatTokenCount(value, compact = false) {
  if (!Number.isFinite(value)) return t("tokenUnavailable");
  return new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en-US", compact ? {
    notation: "compact",
    maximumFractionDigits: 1
  } : {
    maximumFractionDigits: 0
  }).format(value);
}

function formatUsd(value) {
  if (!Number.isFinite(value)) return t("tokenUnavailable");
  const maximumFractionDigits = value > 0 && value < 0.01 ? 4 : 2;
  return `$${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits
  }).format(value)}`;
}

function formatApiEstimate(cost = {}) {
  if (!cost.available || !Number.isFinite(cost.estimatedCostUsd)) return t("tokenUnavailable");
  const partial = cost.hasUnpricedModels || cost.truncated;
  return `${partial ? "≥" : "≈"}${formatUsd(cost.estimatedCostUsd)}`;
}

function formatTaskDuration(value) {
  const totalSeconds = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (language === "zh") {
    if (hours > 0) return `${hours}时 ${String(minutes).padStart(2, "0")}分 ${String(seconds).padStart(2, "0")}秒`;
    return `${minutes}分 ${String(seconds).padStart(2, "0")}秒`;
  }
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function getTaskElapsedSeconds(task) {
  if (Number.isFinite(task?.startedAt)) {
    return Math.max(0, Math.floor(Date.now() / 1_000) - task.startedAt);
  }
  const observedDelta = Number.isFinite(activeTaskObservedAt)
    ? Math.max(0, Math.floor((Date.now() - activeTaskObservedAt) / 1_000))
    : 0;
  return Math.max(0, Number(task?.elapsedSeconds) || 0) + observedDelta;
}

function formatActiveTaskCost(task = {}) {
  if (!Number.isFinite(task.estimatedCostUsd)) return t("tokenUnavailable");
  return `${task.partial || task.hasUnpricedModels ? "≥" : "≈"}${formatUsd(task.estimatedCostUsd)}`;
}

function formatActiveTaskAggregateCost(tasks = []) {
  if (!tasks.length) return formatUsd(0);
  const pricedTasks = tasks.filter(task => Number.isFinite(task?.estimatedCostUsd));
  if (!pricedTasks.length) return t("tokenUnavailable");
  const total = pricedTasks.reduce((sum, task) => sum + task.estimatedCostUsd, 0);
  const partial = pricedTasks.length !== tasks.length ||
    tasks.some(task => task.partial || task.hasUnpricedModels);
  return `${partial ? "≥" : "≈"}${formatUsd(total)}`;
}

function getActiveTaskModelNames(task) {
  return Array.isArray(task?.models)
    ? [...new Set(task.models.map(model => model.model).filter(Boolean))]
    : [];
}

function formatPrice(value) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  }).format(Number(value) || 0);
}

function formatTokenDate(value, period = "day") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "—";
  const date = new Date(`${value}T00:00:00Z`);
  const locale = language === "zh" ? "zh-CN" : "en-US";
  return new Intl.DateTimeFormat(locale, period === "month" ? {
    year: "numeric",
    month: "short",
    timeZone: "UTC"
  } : {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function formatTokenTooltipDate(value, period = tokenPeriod) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "—";
  const date = new Date(`${value}T00:00:00Z`);
  const locale = language === "zh" ? "zh-CN" : "en-US";
  if (period === "month") {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      timeZone: "UTC"
    }).format(date);
  }
  const format = target => new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(target);
  if (period !== "week") return format(date);
  const end = new Date(date);
  end.setUTCDate(end.getUTCDate() + 6);
  return `${format(date)} — ${format(end)}`;
}

function prepareCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const pixelWidth = Math.round(width * ratio);
  const pixelHeight = Math.round(height * ratio);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width, height };
}

function chartPoints(series, width, height, padding, maximum) {
  const usableWidth = Math.max(1, width - padding.left - padding.right);
  const usableHeight = Math.max(1, height - padding.top - padding.bottom);
  return series.map((item, index) => ({
    x: padding.left + (series.length === 1 ? usableWidth / 2 : usableWidth * index / (series.length - 1)),
    y: padding.top + usableHeight * (1 - item.tokens / maximum)
  }));
}

function drawTokenLine(
  context,
  series,
  width,
  height,
  alpha = 1,
  compact = false,
  overview = false,
  highlightedIndex = null
) {
  if (!series.length || alpha <= 0) return;
  const padding = overview
    ? { left: 7, right: 7, top: 8, bottom: 8 }
    : (compact
    ? { left: 2, right: 2, top: 4, bottom: 4 }
    : TOKEN_CHART_PADDING);
  const maximum = Math.max(1, ...series.map(item => item.tokens));
  const points = chartPoints(series, width, height, padding, maximum);
  context.save();
  context.globalAlpha = alpha;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (!compact || overview) {
    const area = context.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    area.addColorStop(0, "rgba(120,234,213,.24)");
    area.addColorStop(1, "rgba(120,234,213,0)");
    context.beginPath();
    if (points.length === 1) {
      context.moveTo(padding.left, height - padding.bottom);
      context.lineTo(padding.left, points[0].y);
      context.lineTo(width - padding.right, points[0].y);
      context.lineTo(width - padding.right, height - padding.bottom);
    } else {
      context.moveTo(points[0].x, height - padding.bottom);
      points.forEach(point => context.lineTo(point.x, point.y));
      context.lineTo(points.at(-1).x, height - padding.bottom);
    }
    context.closePath();
    context.fillStyle = area;
    context.fill();
  }

  const gradient = context.createLinearGradient(padding.left, 0, width - padding.right, 0);
  gradient.addColorStop(0, "rgba(120,234,213,.72)");
  gradient.addColorStop(.68, "rgba(157,168,255,.92)");
  gradient.addColorStop(1, "rgba(120,234,213,1)");
  context.beginPath();
  if (points.length === 1) {
    context.moveTo(padding.left, points[0].y);
    context.lineTo(width - padding.right, points[0].y);
  } else {
    points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
  }
  context.strokeStyle = gradient;
  context.lineWidth = compact ? (overview ? 2 : 1.7) : 2.2;
  context.shadowColor = "rgba(120,234,213,.32)";
  context.shadowBlur = compact ? 5 : 9;
  context.stroke();

  if (!compact) {
    points.forEach((point, index) => {
      const highlighted = index === highlightedIndex;
      context.shadowBlur = highlighted ? 14 : 7;
      context.fillStyle = highlighted ? "#e5fff9" : "#8ff1de";
      context.beginPath();
      context.arc(
        point.x,
        point.y,
        highlighted ? 4.5 : (index === points.length - 1 ? 3.2 : 2.1),
        0,
        Math.PI * 2
      );
      context.fill();
      if (highlighted) {
        context.shadowBlur = 0;
        context.strokeStyle = "rgba(143,241,222,.42)";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(point.x, point.y, 7.5, 0, Math.PI * 2);
        context.stroke();
      }
    });
  } else if (overview) {
    const last = points.at(-1);
    context.shadowBlur = 10;
    context.fillStyle = "#8ff1de";
    context.beginPath();
    context.arc(last.x, last.y, 3.2, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawTokenAxes(context, series, width, height) {
  if (!series.length) return;
  const padding = TOKEN_CHART_PADDING;
  const maximum = Math.max(1, ...series.map(item => item.tokens));
  context.save();
  context.fillStyle = "rgba(206,226,237,.48)";
  context.font = '9px "Segoe UI Variable", sans-serif';
  context.textBaseline = "middle";
  context.textAlign = "right";
  for (const ratio of [1, .5, 0]) {
    const y = padding.top + (height - padding.top - padding.bottom) * (1 - ratio);
    context.fillText(formatTokenCount(maximum * ratio, true), padding.left - 7, y);
  }

  context.textBaseline = "alphabetic";
  const labelIndexes = [...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])];
  labelIndexes.forEach((index, labelIndex) => {
    const x = padding.left + (series.length === 1
      ? (width - padding.left - padding.right) / 2
      : (width - padding.left - padding.right) * index / (series.length - 1));
    context.textAlign = labelIndex === 0 ? "left" : (labelIndex === labelIndexes.length - 1 ? "right" : "center");
    context.fillText(formatTokenDate(series[index].startDate, tokenPeriod), x, height - 8);
  });
  context.restore();
}

function drawTokenChartFrame(previousSeries, currentSeries, progress) {
  const { context, width, height } = prepareCanvas(elements.tokenUsageChart);
  context.clearRect(0, 0, width, height);
  drawTokenAxes(context, currentSeries, width, height);
  const eased = 1 - Math.pow(1 - progress, 3);
  drawTokenLine(context, previousSeries, width, height, 1 - eased);
  drawTokenLine(
    context,
    currentSeries,
    width,
    height,
    eased,
    false,
    false,
    tokenChartHoverIndex
  );
}

function getTokenSeries(period = tokenPeriod) {
  const buckets = latestSnapshot?.tokenUsage?.dailyUsageBuckets || [];
  const aggregated = window.TokenUsage?.aggregateTokenUsage(buckets, period) || [];
  const limit = period === "day" ? 30 : (period === "week" ? 16 : 12);
  return aggregated.slice(-limit);
}

function hideTokenChartTooltip(redraw = true) {
  const hadHover = tokenChartHoverIndex !== null;
  tokenChartHoverIndex = null;
  elements.tokenChartTooltip.hidden = true;
  if (redraw && hadHover && tokenChartSeries.length && !tokenChartAnimationActive) {
    drawTokenChartFrame([], tokenChartSeries, 1);
  }
}

function updateTokenChartTooltip(event) {
  if (!tokenChartSeries.length || elements.tokenUsageModal.hidden) {
    hideTokenChartTooltip();
    return;
  }
  const rect = elements.tokenUsageChart.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const maximum = Math.max(1, ...tokenChartSeries.map(item => item.tokens));
  const points = chartPoints(
    tokenChartSeries,
    width,
    height,
    TOKEN_CHART_PADDING,
    maximum
  );
  const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  let nearestIndex = null;
  let nearestDistance = 15;
  points.forEach((point, index) => {
    const distance = Math.hypot(point.x - pointer.x, point.y - pointer.y);
    if (distance <= nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  if (nearestIndex === null) {
    hideTokenChartTooltip();
    return;
  }

  const point = points[nearestIndex];
  const item = tokenChartSeries[nearestIndex];
  const hoverChanged = tokenChartHoverIndex !== nearestIndex;
  tokenChartHoverIndex = nearestIndex;
  elements.tokenChartTooltipDate.textContent = formatTokenTooltipDate(item.startDate);
  elements.tokenChartTooltipValue.textContent = t("tokenChartTooltipValue", {
    tokens: formatTokenCount(item.tokens)
  });
  elements.tokenChartTooltip.hidden = false;

  const tooltipWidth = elements.tokenChartTooltip.offsetWidth;
  const tooltipHeight = elements.tokenChartTooltip.offsetHeight;
  const halfWidth = tooltipWidth / 2;
  const left = Math.max(halfWidth + 7, Math.min(width - halfWidth - 7, point.x));
  const placeBelow = point.y - tooltipHeight - 12 < 6;
  elements.tokenChartTooltip.style.left = `${left}px`;
  elements.tokenChartTooltip.style.top = `${
    placeBelow ? point.y + 12 : point.y - tooltipHeight - 12
  }px`;
  if (hoverChanged && !tokenChartAnimationActive) {
    drawTokenChartFrame([], tokenChartSeries, 1);
  }
}

function renderTokenChart(animate = true) {
  const nextSeries = getTokenSeries();
  const previousSeries = tokenChartSeries;
  tokenChartSeries = nextSeries;
  cancelAnimationFrame(tokenChartAnimationFrame);
  tokenChartAnimationActive = false;
  hideTokenChartTooltip(false);
  elements.tokenChartEmpty.hidden = nextSeries.length > 0;

  if (!nextSeries.length) {
    const { context, width, height } = prepareCanvas(elements.tokenUsageChart);
    context.clearRect(0, 0, width, height);
    elements.tokenChartRange.textContent = "—";
    elements.tokenChartLatest.textContent = "—";
    return;
  }

  const first = nextSeries[0];
  const last = nextSeries.at(-1);
  elements.tokenChartRange.textContent = `${formatTokenDate(first.startDate, tokenPeriod)} — ${formatTokenDate(last.startDate, tokenPeriod)}`;
  elements.tokenChartLatest.textContent = t("tokenLatestValue", {
    date: formatTokenDate(last.startDate, tokenPeriod),
    tokens: formatTokenCount(last.tokens, true)
  });

  if (!animate || !previousSeries.length) {
    drawTokenChartFrame([], nextSeries, 1);
    return;
  }

  const startedAt = performance.now();
  tokenChartAnimationActive = true;
  const animateFrame = now => {
    const progress = Math.min(1, (now - startedAt) / 360);
    drawTokenChartFrame(previousSeries, nextSeries, progress);
    if (progress < 1) {
      tokenChartAnimationFrame = requestAnimationFrame(animateFrame);
    } else {
      tokenChartAnimationActive = false;
    }
  };
  tokenChartAnimationFrame = requestAnimationFrame(animateFrame);
}

function drawTokenSparkline() {
  const series = getTokenSeries("day").slice(-16);
  const { context, width, height } = prepareCanvas(elements.tokenSparkline);
  context.clearRect(0, 0, width, height);
  drawTokenLine(
    context,
    series,
    width,
    height,
    1,
    true,
    elements.tokenOverview.classList.contains("is-expanded")
  );
}

function renderTokenUsageModal(animate = false) {
  const usage = latestSnapshot?.tokenUsage || {};
  elements.tokenModalLifetime.textContent = formatTokenCount(usage.lifetimeTokens);
  elements.tokenModalTotalWorkDays.textContent = Number.isFinite(usage.totalWorkDays)
    ? t("workDays", { count: formatTokenCount(usage.totalWorkDays) })
    : t("tokenUnavailable");
  elements.tokenUsageFreshness.textContent = usage.available
    ? t(usage.cached ? "tokenCached" : "tokenLive")
    : t("tokenUnavailable");
  elements.tokenPeriodSwitch.querySelectorAll("[data-token-period]").forEach(button => {
    button.classList.toggle("is-active", button.dataset.tokenPeriod === tokenPeriod);
    button.setAttribute("aria-pressed", button.dataset.tokenPeriod === tokenPeriod ? "true" : "false");
  });
  renderTokenChart(animate);
}

function renderTokenUsage(usage = {}) {
  elements.tokenOverviewTitle.textContent = t(usage.cached ? "tokenUsageCachedTitle" : "tokenUsageTitle");
  elements.lifetimeTokenValue.textContent = formatTokenCount(usage.lifetimeTokens);
  elements.totalWorkDaysValue.textContent = Number.isFinite(usage.totalWorkDays)
    ? t("workDays", { count: formatTokenCount(usage.totalWorkDays) })
    : t("tokenUnavailable");
  elements.tokenOverview.classList.toggle("is-unavailable", !usage.available);
  requestAnimationFrame(drawTokenSparkline);
  setTimeout(drawTokenSparkline, 340);
  if (!elements.tokenUsageModal.hidden) requestAnimationFrame(() => renderTokenUsageModal(false));
}

function appendModelCostStat(container, label, value) {
  const item = document.createElement("div");
  const caption = document.createElement("span");
  const strong = document.createElement("strong");
  caption.textContent = label;
  strong.textContent = value;
  item.append(caption, strong);
  container.append(item);
}

function renderTokenCostDetails(cost = latestSnapshot?.tokenCost || {}) {
  elements.tokenCostTotal.textContent = formatApiEstimate(cost);
  const modelCount = Array.isArray(cost.models) ? cost.models.length : 0;
  const coverageKey = cost.hasUnpricedModels ? "costCoveragePartial" : "costCoverage";
  const coverage = t(coverageKey, {
    count: modelCount,
    date: cost.pricingDate || "—"
  });
  elements.tokenCostCoverage.textContent = cost.truncated
    ? `${coverage} · ${t("costCoverageTruncated")}`
    : coverage;
  elements.modelCostList.replaceChildren();

  if (!cost.available || !modelCount) {
    const empty = document.createElement("div");
    empty.className = "cost-empty";
    empty.textContent = t("modelCostEmpty");
    elements.modelCostList.append(empty);
    return;
  }

  cost.models.forEach(model => {
    const item = document.createElement("article");
    item.className = "model-cost-item";
    const heading = document.createElement("div");
    heading.className = "model-cost-heading";
    const modelName = document.createElement("strong");
    modelName.textContent = model.model === "unknown" ? t("modelCostUnknown") : model.model;
    const modelCost = document.createElement("span");
    modelCost.textContent = model.priced
      ? `≈${formatUsd(model.estimatedCostUsd)}`
      : t("modelCostUnpriced");
    modelCost.classList.toggle("is-unpriced", !model.priced);
    heading.append(modelName, modelCost);

    const stats = document.createElement("div");
    stats.className = "model-cost-stats";
    appendModelCostStat(stats, t("modelCostInput"), formatTokenCount(model.inputTokens, true));
    appendModelCostStat(
      stats,
      t("modelCostCached"),
      formatTokenCount(model.cachedInputTokens, true)
    );
    appendModelCostStat(stats, t("modelCostOutput"), formatTokenCount(model.outputTokens, true));
    appendModelCostStat(stats, t("modelCostHitRate"), `${Number(model.cacheHitRate || 0).toFixed(1)}%`);
    item.append(heading, stats);

    const details = [t("modelCostRequests", {
      count: formatTokenCount(model.requestCount)
    })];
    if (model.pricing) {
      details.unshift(t("modelCostRate", {
        input: formatPrice(model.pricing.input),
        cached: formatPrice(model.pricing.cachedInput),
        output: formatPrice(model.pricing.output)
      }));
    }
    if (model.cacheWriteInputTokens > 0) {
      details.push(t("modelCostCacheWrite", {
        tokens: formatTokenCount(model.cacheWriteInputTokens, true)
      }));
    }
    if (model.longContextRequests > 0) {
      details.push(t("modelCostLongContext", {
        count: formatTokenCount(model.longContextRequests)
      }));
    }
    const rate = document.createElement("div");
    rate.className = "model-cost-rate";
    rate.textContent = details.join(" · ");
    item.append(rate);
    elements.modelCostList.append(item);
  });
}

function renderTokenCost(cost = {}) {
  elements.estimatedCostValue.textContent = formatApiEstimate(cost);
  if (!elements.tokenCostModal.hidden) renderTokenCostDetails(cost);
}

function openTokenCost(event) {
  event?.stopPropagation();
  renderTokenCostDetails();
  openSecondaryModal(elements.tokenCostModal, elements.tokenCostClose);
}

function closeTokenCost() {
  closeSecondaryModal(elements.tokenCostModal, elements.tokenCostHelp);
}

function appendActiveTaskStat(container, label, value, elapsedIndex = null) {
  const item = document.createElement("div");
  const caption = document.createElement("span");
  const strong = document.createElement("strong");
  caption.textContent = label;
  strong.textContent = value;
  if (elapsedIndex !== null) strong.dataset.taskElapsedIndex = String(elapsedIndex);
  item.append(caption, strong);
  container.append(item);
}

function renderActiveTaskClock() {
  if (!activeTasksAvailable || !activeTasks.length) return;
  elements.activeTaskElapsed.textContent = formatTaskDuration(getTaskElapsedSeconds(activeTasks[0]));
  elements.activeTaskDetailLongest.textContent = t("activeTaskLongest", {
    time: formatTaskDuration(getTaskElapsedSeconds(activeTasks[0]))
  });
  elements.activeTaskList.querySelectorAll("[data-task-elapsed-index]").forEach(node => {
    const task = activeTasks[Number(node.dataset.taskElapsedIndex)];
    if (task) node.textContent = formatTaskDuration(getTaskElapsedSeconds(task));
  });
  elements.activeTaskPreviewList.querySelectorAll("[data-task-preview-elapsed-index]").forEach(node => {
    const task = activeTasks[Number(node.dataset.taskPreviewElapsedIndex)];
    if (task) node.textContent = formatTaskDuration(getTaskElapsedSeconds(task));
  });
}

function renderActiveTaskPreview() {
  elements.activeTaskPreviewList.replaceChildren();
  elements.activeTaskPreviewList.classList.toggle("is-single", activeTasks.length === 1);

  if (!activeTasksAvailable || !activeTasks.length) {
    const empty = document.createElement("div");
    empty.className = "active-task-preview-empty";
    empty.textContent = activeTasksAvailable
      ? t("activeTaskNone")
      : t("activeTaskUnavailable");
    elements.activeTaskPreviewList.append(empty);
    return;
  }

  activeTasks.slice(0, 2).forEach((task, index) => {
    const row = document.createElement("div");
    row.className = "active-task-preview-row";
    const dot = document.createElement("span");
    dot.className = "active-task-preview-dot";
    dot.setAttribute("aria-hidden", "true");

    const identity = document.createElement("div");
    identity.className = "active-task-preview-identity";
    const project = document.createElement("strong");
    project.textContent = task.projectName || t("activeTaskProjectFallback");
    const model = document.createElement("span");
    const modelNames = getActiveTaskModelNames(task);
    model.textContent = modelNames.length ? modelNames.slice(0, 2).join(" · ") : "—";
    identity.append(project, model);

    const elapsed = document.createElement("strong");
    elapsed.className = "active-task-preview-elapsed";
    elapsed.dataset.taskPreviewElapsedIndex = String(index);
    elapsed.textContent = formatTaskDuration(getTaskElapsedSeconds(task));

    const cost = document.createElement("strong");
    cost.className = "active-task-preview-cost";
    cost.textContent = formatActiveTaskCost(task);
    row.append(dot, identity, elapsed, cost);
    elements.activeTaskPreviewList.append(row);
  });
}

function renderActiveTaskDetails() {
  elements.activeTaskList.replaceChildren();
  elements.activeTaskDetailCount.textContent = activeTasksAvailable
    ? t("activeTaskDetailCount", { count: activeTasks.length })
    : t("activeTaskUnavailable");
  elements.activeTaskDetailLongest.textContent = activeTasks.length
    ? t("activeTaskLongest", {
        time: formatTaskDuration(getTaskElapsedSeconds(activeTasks[0]))
      })
    : "—";

  if (!activeTasksAvailable || !activeTasks.length) {
    const empty = document.createElement("div");
    empty.className = "active-task-empty";
    empty.textContent = activeTasksAvailable
      ? t("activeTaskEmptyDetail")
      : t("activeTaskUnavailable");
    elements.activeTaskList.append(empty);
    return;
  }

  activeTasks.forEach((task, index) => {
    const item = document.createElement("article");
    item.className = "active-task-item is-running";

    const heading = document.createElement("div");
    heading.className = "active-task-item-heading";
    const projectName = document.createElement("strong");
    projectName.textContent = task.projectName || t("activeTaskProjectFallback");
    const status = document.createElement("span");
    status.textContent = t("activeTaskRunningStatus");
    heading.append(projectName, status);

    const stats = document.createElement("div");
    stats.className = "active-task-item-stats";
    appendActiveTaskStat(
      stats,
      t("activeTaskTimeLabel"),
      formatTaskDuration(getTaskElapsedSeconds(task)),
      index
    );
    appendActiveTaskStat(stats, t("activeTaskCostLabel"), formatActiveTaskCost(task));

    const models = document.createElement("div");
    models.className = "active-task-models";
    const modelNames = getActiveTaskModelNames(task);
    models.textContent = `${t("activeTaskModelsLabel")} · ${modelNames.length ? modelNames.join(" · ") : "—"}`;

    item.append(heading, stats, models);
    if (task.hasUnpricedModels || task.partial) {
      const note = document.createElement("small");
      note.className = "active-task-note";
      note.textContent = [
        task.hasUnpricedModels ? t("activeTaskUnpriced") : null,
        task.partial ? t("activeTaskPartialCost") : null
      ].filter(Boolean).join(" · ");
      item.append(note);
    }
    elements.activeTaskList.append(item);
  });
}

function renderActiveTasks(result = {}) {
  activeTasksAvailable = Boolean(result.available);
  activeTasks = activeTasksAvailable && Array.isArray(result.tasks)
    ? result.tasks.slice().sort((left, right) => left.startedAt - right.startedAt)
    : [];
  activeTaskObservedAt = Number.isFinite(result.observedAt) ? result.observedAt : null;

  elements.activeTaskCard.classList.toggle("is-running", activeTasks.length > 0);
  elements.activeTaskCard.classList.toggle("is-single-task", activeTasks.length === 1);
  elements.activeTaskCard.classList.toggle("is-unavailable", !activeTasksAvailable);
  elements.activeTaskCount.textContent = activeTasksAvailable ? String(activeTasks.length) : "—";
  elements.activeTaskElapsed.textContent = activeTasks.length
    ? formatTaskDuration(getTaskElapsedSeconds(activeTasks[0]))
    : "—";
  elements.activeTaskTotalCost.textContent = activeTasksAvailable
    ? formatActiveTaskAggregateCost(activeTasks)
    : "—";
  const hiddenTaskCount = Math.max(0, activeTasks.length - 2);
  elements.activeTaskMoreIndicator.hidden = hiddenTaskCount === 0;
  elements.activeTaskMoreIndicator.textContent = hiddenTaskCount
    ? t("activeTaskMore", { count: hiddenTaskCount })
    : "";
  elements.autoRefreshLabel.textContent = t(activeTasks.length ? "autoRefreshActive" : "autoRefresh");
  renderActiveTaskPreview();

  if (activeTasks.length) renderActiveTaskClock();

  if (!elements.activeTaskModal.hidden) renderActiveTaskDetails();
}

function openActiveTasks() {
  renderActiveTaskDetails();
  openSecondaryModal(elements.activeTaskModal, elements.activeTaskClose);
}

function closeActiveTasks() {
  closeSecondaryModal(elements.activeTaskModal, elements.activeTaskCard);
}

function openResetCredits() {
  openSecondaryModal(elements.resetCreditModal, elements.resetCreditClose);
}

function closeResetCredits() {
  closeSecondaryModal(elements.resetCreditModal, elements.resetCreditButton);
}

function openTokenUsage() {
  tokenChartSeries = [];
  openSecondaryModal(elements.tokenUsageModal, elements.tokenUsageClose);
  requestAnimationFrame(() => renderTokenUsageModal(false));
}

function closeTokenUsage() {
  closeSecondaryModal(elements.tokenUsageModal, elements.tokenOverview, {
    onClose() {
      cancelAnimationFrame(tokenChartAnimationFrame);
      tokenChartAnimationActive = false;
      hideTokenChartTooltip(false);
    }
  });
}

function openOfficialResetHistory() {
  openSecondaryModal(elements.officialResetHistoryModal, elements.officialResetHistoryClose);
}

function closeOfficialResetHistory() {
  closeSecondaryModal(elements.officialResetHistoryModal, elements.officialResetButton);
}

function openClientUpdateHistory() {
  renderClientUpdateHistory();
  openSecondaryModal(elements.clientUpdateHistoryModal, elements.clientUpdateHistoryClose);
}

function closeClientUpdateHistory() {
  closeSecondaryModal(elements.clientUpdateHistoryModal, elements.clientUpdateCard);
}

function renderOnline(snapshot) {
  const { data } = snapshot;
  elements.app.classList.remove("is-offline-state");
  elements.connectionStrip.className = "connection-strip is-online";
  elements.connectionLabel.textContent = t("connected", { plan: String(data.planType).toUpperCase() });
  elements.offlineNotice.hidden = true;

  setQuota(
    elements.fiveHourPanel,
    elements.fiveHourReset,
    elements.fiveHourNumber,
    elements.fiveHourProgress,
    elements.fiveHourUsed,
    data.windows.fiveHour,
    !data.windows.fiveHour
  );
  setQuota(
    elements.weeklyPanel,
    elements.weeklyReset,
    elements.weeklyNumber,
    elements.weeklyProgress,
    elements.weeklyUsed,
    data.windows.weekly
  );

  renderResetCredits(data.resets, data.events.newReset);
  renderOfficialResetHistory(data.events.officialReset, data.events.manualReset);
  renderClientUpdate(snapshot.clientUpdate);
}

function renderOffline(snapshot) {
  elements.app.classList.add("is-offline-state");
  elements.connectionStrip.className = "connection-strip is-offline";
  elements.connectionLabel.textContent = t("offlineTitle");
  elements.offlineNotice.hidden = false;
  const messageKey = {
    CODEX_NOT_INSTALLED: "notInstalled",
    NOT_LOGGED_IN: "notLoggedIn",
    TIMEOUT: "timeout"
  }[snapshot.errorCode] || "offlineMessage";
  elements.offlineMessage.textContent = t(messageKey);
  renderResetCredits({}, { history: snapshot.receivedResetHistory });
  renderClientUpdate(snapshot.clientUpdate);
}

function updateLastChecked() {
  if (!latestSnapshot?.checkedAt) {
    elements.lastChecked.textContent = t("waiting");
    return;
  }
  const minutes = Math.floor((Date.now() - latestSnapshot.checkedAt) / 60_000);
  elements.lastChecked.textContent = minutes < 1 ? t("checkedNow") : t("checkedMinutes", { count: minutes });
}

function render(snapshot) {
  if (snapshot.online) renderOnline(snapshot);
  else renderOffline(snapshot);
  renderTokenUsage(snapshot.tokenUsage);
  renderTokenCost(snapshot.tokenCost);
  renderActiveTasks(snapshot.activeTasks);
  updateLastChecked();
}

function scheduleNextRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(
    () => refresh({ silent: true }),
    getRefreshDelay(latestSnapshot?.activeTasks)
  );
}

async function probeForActiveTask() {
  if (isRefreshing || latestSnapshot?.activeTasks?.count > 0) return;
  try {
    const status = await window.codexMonitor.readActiveTaskStatus();
    if (shouldWakeForActiveTask(latestSnapshot?.activeTasks, status)) {
      await refresh({ silent: true });
    }
  } catch {}
}

async function refresh({ initial = false, silent = false } = {}) {
  if (isRefreshing) return false;
  isRefreshing = true;
  clearTimeout(refreshTimer);
  refreshTimer = null;
  if (!silent) elements.refreshButton.classList.add("is-spinning");
  if (initial) elements.loadingLayer.classList.remove("is-hidden");
  try {
    latestSnapshot = await window.codexMonitor.readQuota();
    render(latestSnapshot);
  } catch {
    latestSnapshot = {
      online: false,
      checkedAt: Date.now(),
      errorCode: "NETWORK_ERROR",
      data: null
    };
    render(latestSnapshot);
  } finally {
    isRefreshing = false;
    elements.refreshButton.classList.remove("is-spinning");
    elements.loadingLayer.classList.add("is-hidden");
    scheduleNextRefresh();
  }
  return true;
}

function normalizeWindowModeResult(result, fallbackCollapsed, fallbackAnchor) {
  if (typeof result === "boolean") {
    return { collapsed: result, anchor: fallbackAnchor };
  }
  return {
    collapsed: result?.collapsed ?? fallbackCollapsed,
    anchor: result?.anchor && Number.isFinite(result.anchor.x) && Number.isFinite(result.anchor.y)
      ? result.anchor
      : fallbackAnchor
  };
}

function getCollapseButtonAnchor() {
  const bounds = elements.collapseButton.getBoundingClientRect();
  return {
    x: Math.round(bounds.left + bounds.width / 2),
    y: Math.round(bounds.top + bounds.height / 2)
  };
}

function applyWindowModeVisual(collapsed, anchor = windowModeAnchor) {
  windowCollapsed = Boolean(collapsed);
  windowModeAnchor = anchor || windowModeAnchor;
  document.documentElement.style.setProperty("--orb-anchor-x", `${windowModeAnchor.x}px`);
  document.documentElement.style.setProperty("--orb-anchor-y", `${windowModeAnchor.y}px`);
  document.body.classList.toggle("is-window-collapsed", windowCollapsed);
}

function waitForWindowModePaint() {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

async function collapseToFloatingOrb() {
  if (windowModeChanging || windowCollapsed) return;
  windowModeChanging = true;
  windowModeAnchor = getCollapseButtonAnchor();
  applyWindowModeVisual(true, windowModeAnchor);
  await waitForWindowModePaint();

  try {
    const result = normalizeWindowModeResult(
      await window.codexMonitor.setCollapsed(true, windowModeAnchor),
      false,
      windowModeAnchor
    );
    windowCollapsed = result.collapsed;
    windowModeAnchor = result.anchor;
    applyWindowModeVisual(windowCollapsed, windowModeAnchor);
  } finally {
    windowModeChanging = false;
  }
}

async function expandFromFloatingOrb() {
  if (windowModeChanging || !windowCollapsed) return;
  windowModeChanging = true;

  try {
    const result = normalizeWindowModeResult(
      await window.codexMonitor.setCollapsed(false, windowModeAnchor),
      true,
      windowModeAnchor
    );
    windowCollapsed = result.collapsed;
    windowModeAnchor = result.anchor;
    applyWindowModeVisual(windowCollapsed, windowModeAnchor);
  } finally {
    windowModeChanging = false;
  }
}

async function initialize() {
  const settings = await window.codexMonitor.readSettings();
  language = settings.language;
  alwaysOnTop = settings.alwaysOnTop;
  positionLocked = settings.positionLocked;
  windowCollapsed = settings.windowCollapsed === true;
  windowModeAnchor = settings.windowModeAnchor || windowModeAnchor;
  if (settings.appIconDataUrl) elements.floatingOrbIcon.src = settings.appIconDataUrl;
  backgroundDataUrl = settings.backgroundDataUrl;
  backgroundOpacity = settings.backgroundOpacity;
  elements.pinButton.classList.toggle("is-active", positionLocked);
  elements.app.classList.toggle("is-position-locked", positionLocked);
  document.body.classList.toggle("is-position-locked", positionLocked);
  applyWindowModeVisual(windowCollapsed, windowModeAnchor);
  applyLanguage();
  applyBackground();
  initializeCropper();
  renderOfficialResetHistory();
  renderClientUpdate();
  renderTokenUsage();
  renderTokenCost();
  renderActiveTasks();

  elements.languageButton.addEventListener("click", async () => {
    language = language === "zh" ? "en" : "zh";
    await window.codexMonitor.setLanguage(language);
    applyLanguage();
  });
  elements.pinButton.addEventListener("click", async () => {
    positionLocked = !positionLocked;
    positionLocked = await window.codexMonitor.setPositionLocked(positionLocked);
    elements.pinButton.classList.toggle("is-active", positionLocked);
    elements.app.classList.toggle("is-position-locked", positionLocked);
    document.body.classList.toggle("is-position-locked", positionLocked);
    applyLanguage();
  });
  elements.collapseButton.addEventListener("click", collapseToFloatingOrb);
  elements.floatingOrbOpen.addEventListener("click", expandFromFloatingOrb);
  elements.floatingOrb.addEventListener("pointerdown", event => {
    if (event.button !== 0 || !windowCollapsed || windowModeChanging) return;
    event.preventDefault();
    window.codexMonitor.beginOrbGesture();
  });
  elements.minimizeButton.addEventListener("click", () => window.codexMonitor.minimize());
  elements.closeButton.addEventListener("click", () => window.codexMonitor.hide());
  elements.refreshButton.addEventListener("click", () => refresh());
  elements.officialResetButton.addEventListener("click", openOfficialResetHistory);
  elements.officialResetButton.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openOfficialResetHistory();
    }
  });
  elements.officialResetHistoryClose.addEventListener("click", closeOfficialResetHistory);
  elements.officialResetHistoryDone.addEventListener("click", closeOfficialResetHistory);
  elements.officialResetHistoryModal.addEventListener("click", event => {
    if (event.target === elements.officialResetHistoryModal) closeOfficialResetHistory();
  });
  elements.clientUpdateCard.addEventListener("click", openClientUpdateHistory);
  elements.clientUpdateCard.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openClientUpdateHistory();
    }
  });
  elements.clientUpdateHistoryClose.addEventListener("click", closeClientUpdateHistory);
  elements.clientUpdateHistoryDone.addEventListener("click", closeClientUpdateHistory);
  elements.clientUpdateHistoryModal.addEventListener("click", event => {
    if (event.target === elements.clientUpdateHistoryModal) closeClientUpdateHistory();
  });
  elements.tokenOverview.addEventListener("click", openTokenUsage);
  elements.tokenOverview.addEventListener("keydown", event => {
    if (event.target !== elements.tokenOverview) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openTokenUsage();
    }
  });
  elements.tokenUsageClose.addEventListener("click", closeTokenUsage);
  elements.tokenUsageDone.addEventListener("click", closeTokenUsage);
  elements.tokenUsageModal.addEventListener("click", event => {
    if (event.target === elements.tokenUsageModal) closeTokenUsage();
  });
  elements.resetCreditButton.addEventListener("click", openResetCredits);
  elements.resetCreditButton.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openResetCredits();
    }
  });
  elements.resetCreditClose.addEventListener("click", closeResetCredits);
  elements.resetCreditDone.addEventListener("click", closeResetCredits);
  elements.resetCreditModal.addEventListener("click", event => {
    if (event.target === elements.resetCreditModal) closeResetCredits();
  });
  elements.tokenCostHelp.addEventListener("click", openTokenCost);
  elements.tokenCostClose.addEventListener("click", closeTokenCost);
  elements.tokenCostDone.addEventListener("click", closeTokenCost);
  elements.tokenCostModal.addEventListener("click", event => {
    if (event.target === elements.tokenCostModal) closeTokenCost();
  });
  elements.activeTaskCard.addEventListener("click", openActiveTasks);
  elements.activeTaskCard.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openActiveTasks();
    }
  });
  elements.activeTaskClose.addEventListener("click", closeActiveTasks);
  elements.activeTaskDone.addEventListener("click", closeActiveTasks);
  elements.activeTaskModal.addEventListener("click", event => {
    if (event.target === elements.activeTaskModal) closeActiveTasks();
  });
  elements.tokenPeriodSwitch.addEventListener("click", event => {
    const button = event.target.closest("[data-token-period]");
    if (!button || button.dataset.tokenPeriod === tokenPeriod) return;
    tokenPeriod = button.dataset.tokenPeriod;
    renderTokenUsageModal(true);
  });
  elements.tokenUsageChart.addEventListener("pointermove", updateTokenChartTooltip);
  elements.tokenUsageChart.addEventListener("pointerleave", () => hideTokenChartTooltip());
  elements.backgroundButton.addEventListener("click", () => {
    const shouldOpen = elements.backgroundPopover.hidden;
    elements.backgroundPopover.hidden = !shouldOpen;
    elements.backgroundButton.classList.toggle("is-active", shouldOpen);
    elements.backgroundError.hidden = true;
  });
  elements.backgroundClose.addEventListener("click", closeBackgroundPopover);
  const chooseBackgroundFile = async () => {
    elements.backgroundError.hidden = true;
    const result = await window.codexMonitor.chooseBackground();
    if (result?.error === "FILE_TOO_LARGE") {
      showBackgroundError("backgroundTooLarge");
      return;
    }
    if (result?.error) {
      showBackgroundError("unsupportedImage");
      return;
    }
    if (!result?.canceled && result?.dataUrl) {
      openCropper(result.dataUrl, result.name);
    }
  };
  elements.chooseBackground.addEventListener("click", chooseBackgroundFile);
  elements.backgroundDropZone.addEventListener("click", chooseBackgroundFile);
  elements.backgroundDropZone.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      chooseBackgroundFile();
    }
  });
  for (const eventName of ["dragenter", "dragover"]) {
    elements.backgroundDropZone.addEventListener(eventName, event => {
      event.preventDefault();
      event.stopPropagation();
      elements.backgroundDropZone.classList.add("is-dragging");
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    });
  }
  for (const eventName of ["dragleave", "drop"]) {
    elements.backgroundDropZone.addEventListener(eventName, event => {
      event.preventDefault();
      event.stopPropagation();
      elements.backgroundDropZone.classList.remove("is-dragging");
      if (eventName === "drop") readDroppedImage(event.dataTransfer?.files?.[0]);
    });
  }
  document.addEventListener("dragover", event => event.preventDefault());
  document.addEventListener("drop", event => event.preventDefault());
  elements.clearBackground.addEventListener("click", async () => {
    await window.codexMonitor.clearBackground();
    backgroundDataUrl = null;
    applyBackground();
  });
  elements.opacitySlider.addEventListener("input", event => {
    backgroundOpacity = Number(event.target.value) / 100;
    applyBackground();
  });
  elements.opacitySlider.addEventListener("change", async () => {
    backgroundOpacity = await window.codexMonitor.setBackgroundOpacity(backgroundOpacity);
    applyBackground();
  });
  window.codexMonitor.onRefresh(() => refresh());
  window.codexMonitor.onAlwaysOnTop(enabled => {
    alwaysOnTop = enabled;
  });
  window.codexMonitor.onWindowModeChanged((collapsed, anchor) => {
    applyWindowModeVisual(collapsed, anchor);
    windowModeChanging = false;
    if (!collapsed) renderTokenUsage(latestSnapshot?.tokenUsage);
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (!elements.tokenCostModal.hidden) closeTokenCost();
    else if (!elements.activeTaskModal.hidden) closeActiveTasks();
    else if (!elements.tokenUsageModal.hidden) closeTokenUsage();
    else if (!elements.resetCreditModal.hidden) closeResetCredits();
    else if (!elements.clientUpdateHistoryModal.hidden) closeClientUpdateHistory();
    else if (!elements.officialResetHistoryModal.hidden) closeOfficialResetHistory();
  });

  await refresh({ initial: true });
  activeTaskProbeTimer = setInterval(probeForActiveTask, ACTIVE_TASK_PROBE_MS);
  clockTimer = setInterval(() => {
    if (latestSnapshot?.online) renderOnline(latestSnapshot);
    updateLastChecked();
  }, 30_000);
  activeTaskTimer = setInterval(renderActiveTaskClock, 1_000);
}

window.addEventListener("DOMContentLoaded", initialize);
window.addEventListener("beforeunload", () => {
  clearTimeout(refreshTimer);
  clearInterval(activeTaskProbeTimer);
  clearInterval(clockTimer);
  clearInterval(activeTaskTimer);
  cancelAnimationFrame(tokenChartAnimationFrame);
});
