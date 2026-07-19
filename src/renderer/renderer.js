const AUTO_REFRESH_MS = 60_000;

const i18n = {
  zh: {
    title: "额度检测器",
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
    unavailable: "官方暂未启用",
    unavailableDetail: "5 小时限额当前未由官方返回",
    noData: "暂无数据",
    resetCreditEyebrow: "RESET CREDITS",
    resetCreditTitle: "额度重置次数",
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
    newResetQuestion: "收到新的重置次数",
    officialResetQuestion: "官方额度重置",
    detectedCount: "检测到新增 +{count}",
    notDetected: "本次未发现",
    resetDetected: "官方已重置所有限额",
    resetNotDetected: "未检测到",
    officialResetLatest: "最近一次：{time}",
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
    openOfficialResetHistory: "查看官方重置记录",
    waiting: "等待首次检测",
    checkedNow: "刚刚检测",
    checkedMinutes: "{count} 分钟前检测",
    autoRefresh: "每 60 秒自动刷新",
    reading: "读取 Codex 额度…",
    pinOn: "解锁位置",
    pinOff: "锁定位置",
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
    cancel: "取消",
    applyCrop: "使用此区域",
    cropSaving: "正在保存…"
  },
  en: {
    title: "Quota Monitor",
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
    unavailable: "5h limit paused",
    unavailableDetail: "The official 5-hour limit is not currently returned",
    noData: "No data",
    resetCreditEyebrow: "RESET CREDITS",
    resetCreditTitle: "Available resets",
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
    newResetQuestion: "New reset received",
    officialResetQuestion: "Official quota reset",
    detectedCount: "New reset +{count}",
    notDetected: "None detected",
    resetDetected: "Official full reset detected",
    resetNotDetected: "Not detected",
    officialResetLatest: "Latest: {time}",
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
    openOfficialResetHistory: "View official reset history",
    waiting: "Waiting for first check",
    checkedNow: "Checked just now",
    checkedMinutes: "Checked {count}m ago",
    autoRefresh: "Auto-refresh every 60s",
    reading: "Reading Codex quota…",
    pinOn: "Unlock position",
    pinOff: "Lock position",
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
    cancel: "Cancel",
    applyCrop: "Use this area",
    cropSaving: "Saving…"
  }
};

const elements = Object.fromEntries([
  "app", "connectionStrip", "connectionLabel", "statusDot", "offlineNotice", "offlineMessage",
  "languageButton", "refreshButton", "pinButton", "minimizeButton", "closeButton", "titlebar",
  "backgroundButton", "backgroundPopover", "backgroundClose", "chooseBackground", "clearBackground",
  "opacitySlider", "opacityValue", "backgroundError", "customBackground", "backgroundDropZone",
  "cropModal", "cropClose", "cropCancel", "cropApply", "cropStage", "cropImage", "cropBox",
  "cropResizeHandle", "cropSourceInfo",
  "fiveHourPanel", "fiveHourReset", "fiveHourNumber", "fiveHourProgress", "fiveHourUsed",
  "weeklyPanel", "weeklyReset", "weeklyNumber", "weeklyProgress", "weeklyUsed",
  "resetCount", "resetCreditList", "newResetStatus", "newResetCheck", "newResetIcon",
  "officialResetButton", "officialResetStatus", "officialResetCheck", "officialResetHistoryModal",
  "officialResetHistoryClose", "officialResetHistoryDone", "officialResetHistoryList",
  "lastChecked", "loadingLayer"
].map(id => [id, document.getElementById(id)]));

let language = "zh";
let alwaysOnTop = true;
let positionLocked = false;
let latestSnapshot = null;
let refreshTimer = null;
let clockTimer = null;
let isRefreshing = false;
let backgroundDataUrl = null;
let backgroundOpacity = 0.34;
let cropSource = null;
let cropInteraction = null;
let cropFrame = null;
let officialResetHistory = [];

function t(key, values = {}) {
  let text = i18n[language][key] ?? key;
  for (const [name, value] of Object.entries(values)) {
    text = text.replace(`{${name}}`, value);
  }
  return text;
}

function applyLanguage() {
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach(node => {
    node.textContent = t(node.dataset.i18n);
  });
  elements.languageButton.textContent = language === "zh" ? "EN" : "中";
  elements.pinButton.title = positionLocked ? t("pinOn") : t("pinOff");
  elements.pinButton.setAttribute("aria-label", elements.pinButton.title);
  elements.minimizeButton.title = t("minimize");
  elements.minimizeButton.setAttribute("aria-label", t("minimize"));
  elements.closeButton.title = t("hide");
  elements.closeButton.setAttribute("aria-label", t("hide"));
  elements.backgroundButton.title = t("backgroundSettings");
  elements.backgroundButton.setAttribute("aria-label", t("backgroundSettings"));
  elements.backgroundClose.setAttribute("aria-label", t("close"));
  elements.cropClose.setAttribute("aria-label", t("close"));
  elements.officialResetHistoryClose.setAttribute("aria-label", t("close"));
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
  elements.cropModal.hidden = true;
  elements.cropImage.removeAttribute("src");
  cropSource = null;
  cropInteraction = null;
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
    elements.cropModal.hidden = false;
    elements.cropImage.src = dataUrl;
    elements.cropSourceInfo.textContent = `${name ? `${name} · ` : ""}${probe.naturalWidth} × ${probe.naturalHeight}`;
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
  if (credit?.title) return credit.title;
  if (credit?.resetType === "codexRateLimits") return t("fullReset");
  return t("codexReset");
}

function renderResetCredits(resets = {}) {
  const availableCount = Number.isFinite(resets.availableCount) ? resets.availableCount : 0;
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

  elements.resetCount.textContent = availableCount;
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
    empty.textContent = t("noCredits");
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
    ? t("manualResetExcluded")
    : (hasHistory
        ? t("officialResetLatest", { time: formatDate(latestAt, true) })
        : t("officialResetNever"));
  elements.officialResetCheck.classList.toggle("is-positive", hasHistory);
  elements.officialResetButton.classList.toggle("has-history", hasHistory);

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

function openOfficialResetHistory() {
  elements.officialResetHistoryModal.hidden = false;
  elements.officialResetHistoryClose.focus();
}

function closeOfficialResetHistory() {
  elements.officialResetHistoryModal.hidden = true;
  elements.officialResetButton.focus();
}

function renderOnline(snapshot) {
  const { data } = snapshot;
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

  renderResetCredits(data.resets);

  setSignal(
    elements.newResetStatus,
    elements.newResetCheck,
    elements.newResetIcon,
    data.events.newReset.detected,
    t("detectedCount", { count: data.events.newReset.count }),
    t("notDetected")
  );
  renderOfficialResetHistory(data.events.officialReset, data.events.manualReset);
}

function renderOffline(snapshot) {
  elements.connectionStrip.className = "connection-strip is-offline";
  elements.connectionLabel.textContent = t("offlineTitle");
  elements.offlineNotice.hidden = false;
  const messageKey = {
    CODEX_NOT_INSTALLED: "notInstalled",
    NOT_LOGGED_IN: "notLoggedIn",
    TIMEOUT: "timeout"
  }[snapshot.errorCode] || "offlineMessage";
  elements.offlineMessage.textContent = t(messageKey);
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
  updateLastChecked();
}

async function refresh({ initial = false } = {}) {
  if (isRefreshing) return;
  isRefreshing = true;
  elements.refreshButton.classList.add("is-spinning");
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
  }
}

async function initialize() {
  const settings = await window.codexMonitor.readSettings();
  language = settings.language;
  alwaysOnTop = settings.alwaysOnTop;
  positionLocked = settings.positionLocked;
  backgroundDataUrl = settings.backgroundDataUrl;
  backgroundOpacity = settings.backgroundOpacity;
  elements.pinButton.classList.toggle("is-active", positionLocked);
  elements.app.classList.toggle("is-position-locked", positionLocked);
  document.body.classList.toggle("is-position-locked", positionLocked);
  applyLanguage();
  applyBackground();
  initializeCropper();
  renderOfficialResetHistory();

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
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !elements.officialResetHistoryModal.hidden) {
      closeOfficialResetHistory();
    }
  });

  await refresh({ initial: true });
  refreshTimer = setInterval(refresh, AUTO_REFRESH_MS);
  clockTimer = setInterval(() => {
    if (latestSnapshot?.online) renderOnline(latestSnapshot);
    updateLastChecked();
  }, 30_000);
}

window.addEventListener("DOMContentLoaded", initialize);
window.addEventListener("beforeunload", () => {
  clearInterval(refreshTimer);
  clearInterval(clockTimer);
});
