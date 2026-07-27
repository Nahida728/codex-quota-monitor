const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rendererRoot = path.join(__dirname, "..", "src", "renderer");
const html = fs.readFileSync(path.join(rendererRoot, "index.html"), "utf8");
const css = fs.readFileSync(path.join(rendererRoot, "styles.css"), "utf8");
const renderer = fs.readFileSync(path.join(rendererRoot, "renderer.js"), "utf8");
const main = fs.readFileSync(path.join(rendererRoot, "..", "main.js"), "utf8");
const preload = fs.readFileSync(path.join(rendererRoot, "..", "preload.js"), "utf8");

test("lays out the two quota panels in equal side-by-side columns", () => {
  assert.match(
    css,
    /\.quota-section\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
  );
  assert.match(html, /id="fiveHourPanel"/);
  assert.match(html, /id="weeklyPanel"/);
});

test("renders every reset credit into a dedicated list row", () => {
  assert.match(html, /id="resetCreditList"/);
  assert.match(renderer, /items\.forEach\(\(credit,\s*index\)\s*=>/);
  assert.match(renderer, /className\s*=\s*"reset-credit-item"/);
});

test("places the reset-credit entry in the three-card status row", () => {
  const quotaIndex = html.indexOf('class="quota-section"');
  const signalsIndex = html.indexOf('class="signals"');
  const tokenIndex = html.indexOf('class="token-overview');
  const taskIndex = html.indexOf('class="active-task-card');
  assert.ok(quotaIndex >= 0 && quotaIndex < signalsIndex);
  assert.ok(signalsIndex < tokenIndex && tokenIndex < taskIndex);
  assert.equal((html.match(/class="status-card(?:\s[^"]*)?"/g) || []).length, 3);
  assert.match(html, /id="resetCreditButton"/);
  assert.match(html, /id="resetStatusCount"/);
  assert.doesNotMatch(html, /class="reset-section"/);
  assert.match(html, /id="clientUpdateStatus"/);
  assert.match(html, /id="clientUpdateVersion"/);
  assert.match(
    css,
    /\.signals\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/
  );
});

test("places the expanded token overview before the active-task card", () => {
  const signalsIndex = html.indexOf('class="signals"');
  const tokenIndex = html.indexOf('class="token-overview');
  const taskIndex = html.indexOf('class="active-task-card');
  assert.ok(signalsIndex >= 0 && signalsIndex < tokenIndex);
  assert.ok(tokenIndex < taskIndex);
  assert.match(html, /id="lifetimeTokenValue"/);
  assert.match(html, /id="totalWorkDaysValue"/);
  assert.match(html, /id="tokenModalTotalWorkDays"/);
  assert.match(renderer, /usage\.totalWorkDays/);
  assert.match(html, /id="estimatedCostValue"/);
  assert.match(html, /id="tokenCostHelp"/);
  assert.match(css, /\.token-overview\s*\{[\s\S]*?height:\s*190px/);
  assert.match(css, /\.active-task-card\s*\{[\s\S]*?height:\s*126px/);
  assert.match(
    css,
    /\.is-offline-state \.active-task-card\s*\{[\s\S]*?height:\s*70px[\s\S]*?flex-basis:\s*70px/
  );
});

test("shows concurrent Codex tasks with live elapsed time and per-project API estimates", () => {
  assert.match(html, /id="activeTaskCard"/);
  assert.match(html, /id="activeTaskCount"/);
  assert.match(html, /id="activeTaskElapsed"/);
  assert.match(html, /id="activeTaskTotalCost"/);
  assert.match(html, /id="activeTaskPreviewList"/);
  assert.match(html, /id="activeTaskMoreIndicator"/);
  assert.match(html, /id="activeTaskModal"/);
  assert.match(html, /id="activeTaskList"/);
  assert.match(renderer, /function renderActiveTasks/);
  assert.match(renderer, /function renderActiveTaskPreview/);
  assert.match(renderer, /function renderActiveTaskDetails/);
  assert.match(renderer, /formatActiveTaskAggregateCost\(activeTasks\)/);
  assert.match(renderer, /activeTasks\.slice\(0,\s*2\)/);
  assert.match(renderer, /formatActiveTaskCost\(task\)/);
  assert.match(renderer, /setInterval\(renderActiveTaskClock,\s*1_000\)/);
  assert.match(renderer, /activeTaskCard\.addEventListener\("click",\s*openActiveTasks\)/);
  assert.match(css, /@keyframes active-task-time-pulse/);
  assert.match(
    css,
    /\.active-task-card\.is-running \.active-task-metric-longest strong\s*\{[\s\S]*?animation:\s*active-task-time-pulse/
  );
  assert.match(css, /\.active-task-preview-row\s*\{[\s\S]*?grid-template-columns:/);
  assert.match(css, /\.active-task-preview-list\.is-single \.active-task-preview-row/);
});

test("shows API-equivalent cost with an independent model-detail dialog", () => {
  assert.match(html, /id="tokenCostModal"/);
  assert.match(html, /id="modelCostList"/);
  assert.match(renderer, /function renderTokenCostDetails/);
  assert.match(renderer, /model\.inputTokens/);
  assert.match(renderer, /model\.cachedInputTokens/);
  assert.match(renderer, /model\.outputTokens/);
  assert.match(renderer, /model\.cacheHitRate/);
  assert.match(renderer, /tokenCostHelp\.addEventListener\("click",\s*openTokenCost\)/);
  assert.match(renderer, /event\?\.stopPropagation\(\)/);
  assert.match(css, /\.token-cost-help\s*\{[\s\S]*?border-radius:\s*50%/);
});

test("keeps the Token Pulse brand on one line in compact and expanded layouts", () => {
  assert.match(css, /\.token-overview-heading \.eyebrow\s*\{[\s\S]*?white-space:\s*nowrap/);
  assert.match(css, /\.token-overview\s*\{[\s\S]*?grid-template-columns:\s*84px/);
  assert.match(css, /\.token-overview\.is-expanded\s*\{[\s\S]*?grid-template-columns:\s*88px/);
});

test("token chart supports animated day, week, and month aggregation", () => {
  assert.match(html, /data-token-period="day"/);
  assert.match(html, /data-token-period="week"/);
  assert.match(html, /data-token-period="month"/);
  assert.match(html, /id="tokenUsageChart"/);
  assert.match(renderer, /aggregateTokenUsage\(buckets,\s*period\)/);
  assert.match(renderer, /requestAnimationFrame\(animateFrame\)/);
  assert.match(renderer, /\(now\s*-\s*startedAt\)\s*\/\s*360/);
});

test("token chart exposes every node through a bounded hover tooltip", () => {
  assert.match(html, /id="tokenChartTooltip"/);
  assert.match(css, /\.token-chart-tooltip\s*\{[\s\S]*?pointer-events:\s*none/);
  assert.match(renderer, /function updateTokenChartTooltip/);
  assert.match(renderer, /Math\.hypot\(point\.x - pointer\.x,\s*point\.y - pointer\.y\)/);
  assert.match(renderer, /addEventListener\("pointermove",\s*updateTokenChartTooltip\)/);
  assert.match(renderer, /highlighted \? 4\.5/);
  assert.match(renderer, /end\.setUTCDate\(end\.getUTCDate\(\) \+ 6\)/);
  assert.match(renderer, /if \(period === "month"\)/);
});

test("client update copy is bilingual and does not rely on ellipsis", () => {
  assert.match(renderer, /clientUpdateDetected:\s*"检测到新版已安装"/);
  assert.match(renderer, /clientUpdateDetected:\s*"New version installed"/);
  assert.match(renderer, /clientUpdateReady:\s*"发现可用更新"/);
  assert.match(renderer, /clientUpdateReady:\s*"Update available"/);
  assert.doesNotMatch(
    css,
    /\.status-card[\s\S]{0,1200}text-overflow:\s*ellipsis/
  );
});

test("client update card opens a permanent installed-version timeline", () => {
  assert.match(
    html,
    /class="status-card status-card-button no-drag" id="clientUpdateCard" role="button" tabindex="0"/
  );
  assert.match(html, /id="clientUpdateHistoryModal"/);
  assert.match(html, /id="clientUpdateHistoryCurrent"/);
  assert.match(html, /id="clientUpdateHistoryPending"/);
  assert.match(html, /id="clientUpdateHistoryList"/);
  assert.match(renderer, /function renderClientUpdateHistory/);
  assert.match(renderer, /clientUpdateHistoryChange/);
  assert.match(renderer, /record\.detectedAt\s*\/\s*1_000/);
  assert.match(renderer, /clientUpdateCard\.addEventListener\("click",\s*openClientUpdateHistory\)/);
  assert.match(css, /\.client-update-history-list\s*\{[\s\S]*?overflow-y:\s*auto/);
});

test("caps the visible reset list at six rows and scrolls larger counts", () => {
  assert.match(renderer, /renderedRowCount\s*>\s*6/);
  assert.match(renderer, /Math\.min\(renderedRowCount,\s*6\)/);
  assert.match(
    css,
    /\.reset-credit-list\.is-overflowing\s*\{[\s\S]*?grid-auto-rows:\s*28px/
  );
  assert.match(
    css,
    /\.reset-credit-list\s*\{[\s\S]*?overflow-y:\s*hidden/
  );
  assert.match(
    css,
    /\.reset-credit-list\.is-overflowing\s*\{[\s\S]*?overflow-y:\s*auto/
  );
});

test("keeps reset details in a scrollable secondary view", () => {
  assert.match(
    css,
    /\.reset-credit-list\s*\{[\s\S]*?grid-template-rows:\s*repeat\(var\(--reset-visible-count\),\s*28px\)/
  );
  assert.match(css, /\.reset-credit-list\s*\{[\s\S]*?align-content:\s*start/);
  assert.match(html, /id="resetCreditModal"/);
  assert.match(html, /id="receivedResetHistoryList"/);
  assert.match(renderer, /function renderReceivedResetHistory/);
  assert.match(renderer, /resetCreditButton\.addEventListener\("click",\s*openResetCredits\)/);
  assert.match(css, /\.reset-detail-list\s*\{[\s\S]*?max-height:\s*186px/);
  assert.doesNotMatch(renderer, /updateUsageSectionBalance/);
});

test("secondary views preserve glass backgrounds and native drag regions", () => {
  assert.doesNotMatch(html, /class="(?:crop|reset|history|token|cost|task)-modal no-drag"/);
  assert.match(
    css,
    /\.crop-modal,[\s\S]*?\.task-modal\s*\{[\s\S]*?background:\s*rgba\(4,11,18,.26\)/
  );
  assert.match(
    css,
    /\.crop-heading,[\s\S]*?\.history-heading\s*\{[\s\S]*?-webkit-app-region:\s*drag/
  );
  assert.match(
    css,
    /\.is-position-locked \.crop-heading,[\s\S]*?\.is-position-locked \.history-heading:active\s*\{[\s\S]*?-webkit-app-region:\s*no-drag/
  );
  assert.match(css, /\.drag-edge\s*\{[\s\S]*?z-index:\s*80/);
});

test("secondary dialogs use interruptible reduced-motion-safe entrance and exit animations", () => {
  assert.match(
    css,
    /\.crop-modal\.is-entering:not\(\[hidden\]\),[\s\S]*?\.task-modal\.is-entering:not\(\[hidden\]\)\s*\{[\s\S]*?animation:\s*secondary-overlay-enter/
  );
  assert.match(
    css,
    /\.crop-modal\.is-entering:not\(\[hidden\]\) \.crop-dialog,[\s\S]*?\.task-modal\.is-entering:not\(\[hidden\]\) \.task-dialog\s*\{[\s\S]*?animation:\s*secondary-dialog-enter/
  );
  assert.match(css, /@keyframes secondary-dialog-enter\s*\{[\s\S]*?translateY\(14px\) scale\(\.965\)[\s\S]*?translateY\(-2px\) scale\(1\.006\)/);
  assert.match(css, /@keyframes secondary-content-enter/);
  assert.match(css, /\.task-modal\.is-entering:not\(\[hidden\]\) \.task-dialog > \*\s*\{[\s\S]*?secondary-content-enter/);
  assert.match(css, /\.crop-modal\.is-closing:not\(\[hidden\]\),[\s\S]*?\.task-modal\.is-closing:not\(\[hidden\]\)\s*\{[\s\S]*?secondary-overlay-exit/);
  assert.match(css, /@keyframes secondary-dialog-exit\s*\{[\s\S]*?translateY\(8px\) scale\(\.982\)/);
  assert.match(renderer, /function openSecondaryModal\(modal,\s*focusTarget\)/);
  assert.match(renderer, /function closeSecondaryModal\(modal,\s*restoreFocus/);
  assert.match(renderer, /setTimeout\(finish,\s*SECONDARY_MODAL_ENTER_FALLBACK_MS\)/);
  assert.match(renderer, /event\.animationName === "secondary-dialog-exit"/);
  assert.match(renderer, /setTimeout\(finish,\s*SECONDARY_MODAL_EXIT_FALLBACK_MS\)/);
  assert.match(renderer, /modal\.inert = true/);
  assert.match(renderer, /openSecondaryModal\(elements\.cropModal,\s*elements\.cropClose\)/);
  assert.match(renderer, /closeSecondaryModal\(elements\.tokenUsageModal,\s*elements\.tokenOverview/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

test("uses five-second full refreshes during tasks and a lightweight idle probe", () => {
  assert.match(html, /<script src="\.\.\/refresh-policy\.js"><\/script>/);
  assert.match(renderer, /getRefreshDelay\(latestSnapshot\?\.activeTasks\)/);
  assert.match(renderer, /setInterval\(probeForActiveTask,\s*ACTIVE_TASK_PROBE_MS\)/);
  assert.match(renderer, /readActiveTaskStatus\(\)/);
  assert.match(renderer, /shouldWakeForActiveTask\(latestSnapshot\?\.activeTasks,\s*status\)/);
  assert.match(renderer, /autoRefreshActive:\s*"任务期间每 5 秒自动刷新"/);
  assert.match(renderer, /autoRefreshActive:\s*"Auto-refresh every 5s during tasks"/);
  assert.doesNotMatch(renderer, /setInterval\(refresh,\s*AUTO_REFRESH_MS\)/);
  assert.match(main, /ipcMain\.handle\("tasks:active-status"/);
  assert.match(preload, /readActiveTaskStatus:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("tasks:active-status"\)/);
});

test("collapse and expand clip one persistent native window without a surface swap", () => {
  assert.match(html, /id="collapseButton"/);
  assert.match(html, /id="floatingOrb"/);
  assert.match(html, /id="floatingOrbIcon"/);
  assert.match(html, /id="floatingOrbOpen"/);
  assert.match(html, /class="connection-actions no-drag"[\s\S]*?id="collapseButton"/);
  const titlebarMarkup = html.slice(html.indexOf('id="titlebar"'), html.indexOf("</header>"));
  assert.doesNotMatch(titlebarMarkup, /id="collapseButton"/);
  const floatingOrbRule = css.slice(css.indexOf(".floating-orb {"), css.indexOf(".floating-orb::before"));
  assert.match(floatingOrbRule, /-webkit-app-region:\s*no-drag/);
  assert.match(css, /\.floating-orb-open\s*\{[\s\S]*?inset:\s*0[\s\S]*?pointer-events:\s*none/);
  assert.match(css, /body\.is-window-collapsed \.floating-orb\s*\{[\s\S]*?opacity:\s*1[\s\S]*?-webkit-app-region:\s*no-drag/);
  assert.match(css, /body\.is-window-collapsed \.floating-orb-open\s*\{[\s\S]*?-webkit-app-region:\s*no-drag/);
  assert.doesNotMatch(html, /floating-orb-open no-drag/);
  assert.match(renderer, /getCollapseButtonAnchor\(\)/);
  assert.match(renderer, /applyWindowModeVisual\(true,\s*windowModeAnchor\)/);
  assert.match(renderer, /await waitForWindowModePaint\(\)/);
  assert.match(renderer, /setCollapsed\(true,\s*windowModeAnchor\)/);
  assert.match(main, /const ORB_SIZE\s*=\s*76/);
  assert.match(main, /windowModeAnchor/);
  assert.match(main, /window\s*=\s*new BrowserWindow\(\{/);
  assert.doesNotMatch(main, /orbWindow\s*=\s*new BrowserWindow/);
  assert.match(main, /function createRectangularWindowShape\(width,\s*height,\s*offsetX\s*=\s*0,\s*offsetY\s*=\s*0\)/);
  assert.match(main, /window\.setShape\(createRectangularWindowShape\(\s*ORB_SIZE,\s*ORB_SIZE/);
  assert.match(main, /window\.setShape\(createRectangularWindowShape\(WINDOW_WIDTH,\s*WINDOW_HEIGHT\)\)/);
  assert.doesNotMatch(main, /createCircularWindowShape|ORB_SHAPE_OVERSCAN|window\.setShape\(\[\]\)/);
  assert.match(css, /\.floating-orb\s*\{[\s\S]*?clip-path:\s*circle\(50% at 50% 50%\)/);
  assert.match(css, /body\.is-window-collapsed \.glass-card\s*\{[\s\S]*?visibility:\s*hidden/);
  assert.match(main, /function positionWindow\(target,\s*position\)/);
  assert.doesNotMatch(main, /transitionWindow|capturePage\(|window-transition/);
  assert.doesNotMatch(renderer, /TransitionSnapshot|transitionSnapshot|updateTransitionSnapshot/);
  const modeChangeSource = main.slice(
    main.indexOf("async function setWindowMode"),
    main.indexOf("function buildTrayMenu")
  );
  assert.doesNotMatch(modeChangeSource, /setTimeout|requestAnimationFrame|prepareWindowModeTransition/);
  assert.doesNotMatch(modeChangeSource, /\.(?:show|showInactive|hide)\(/);
  assert.doesNotMatch(modeChangeSource, /setBounds|setPosition|setOpacity/);
  assert.doesNotMatch(main, /window\.on\("focus",\s*scheduleOrbClickExpand\)/);
  assert.doesNotMatch(modeChangeSource, /window\.blur\(\)|window\.setFocusable\(/);
  assert.doesNotMatch(main, /suppressOrbFocusExpandUntil|orbClickCandidateTimer/);
  assert.doesNotMatch(main, /handleOrbPointer|orbClickFallback|hookWindowMessage/);
  assert.match(main, /require\("\.\/native-window-drag"\)/);
  assert.match(main, /startSystemWindowMove\(window\.getNativeWindowHandle\(\)\)/);
  assert.match(main, /didWindowMove\(startBounds,\s*endBounds\)/);
  assert.match(main, /ipcMain\.on\("window:beginOrbGesture",\s*handleOrbNativeGesture\)/);
  assert.match(preload, /beginOrbGesture:\s*\(\)\s*=>\s*ipcRenderer\.send\("window:beginOrbGesture"\)/);
  assert.equal(fs.existsSync(path.join(rendererRoot, "window-transition.html")), false);
  assert.equal(fs.existsSync(path.join(rendererRoot, "window-transition.css")), false);
  assert.equal(fs.existsSync(path.join(rendererRoot, "window-transition.js")), false);
  assert.match(main, /ipcMain\.handle\("window:setCollapsed"/);
  assert.match(main, /app\.requestSingleInstanceLock\(\)/);
  assert.match(main, /app\.on\("second-instance"/);
  assert.ok(
    main.indexOf('window.once("ready-to-show"') < main.indexOf('window.loadFile(path.join(__dirname, "renderer", "index.html"))')
  );
  assert.match(main, /window\.webContents\.once\("did-finish-load",\s*showInitialWindow\)/);
  assert.match(main, /if\s*\(initialWindowShown\s*\|\|[\s\S]*?\)\s*return;\s*initialWindowShown\s*=\s*true/);
  assert.match(renderer, /floatingOrbOpen\.addEventListener\("click",\s*expandFromFloatingOrb\)/);
  assert.doesNotMatch(renderer, /officialResetButton\.classList\.toggle\("has-history"/);
  assert.doesNotMatch(css, /\.status-card-button\.has-history/);
  assert.match(css, /\.floating-orb\s*\{[\s\S]*?will-change:\s*opacity/);
  assert.match(css, /\.titlebar\s*\{[\s\S]*?-webkit-app-region:\s*no-drag/);
  assert.match(css, /\.brand\s*\{[\s\S]*?flex:\s*1[\s\S]*?-webkit-app-region:\s*drag/);
  assert.match(css, /\.window-actions\s*\{[\s\S]*?-webkit-app-region:\s*no-drag/);
  assert.match(renderer, /Math\.round\(bounds\.left\s*\+\s*bounds\.width\s*\/\s*2\)/);
  assert.match(main, /function readLargestPngFromIco\(iconPath\)/);
  assert.match(main, /largestPng\.toString\("base64"\)/);
  assert.match(main, /image\.resize\(\{\s*width:\s*64,\s*height:\s*64,\s*quality:\s*"best"\s*\}\)/);
  const orbImageRule = css.slice(
    css.indexOf(".floating-orb img"),
    css.indexOf("body.is-window-collapsed .floating-orb")
  );
  assert.doesNotMatch(orbImageRule, /filter:/);
});

test("full-card and orb movement remain native without per-frame bound writes", () => {
  assert.doesNotMatch(renderer, /setBounds\s*\(|setPosition\s*\(/);
  assert.match(main, /resizable:\s*false/);
  assert.match(main, /thickFrame:\s*false/);
  assert.match(main, /window\.setMinimumSize\(WINDOW_WIDTH,\s*WINDOW_HEIGHT\)/);
  assert.match(main, /window\.setMaximumSize\(WINDOW_WIDTH,\s*WINDOW_HEIGHT\)/);
  assert.match(main, /finally\s*\{\s*isChangingWindowMode\s*=\s*false/);
  assert.match(main, /window\.on\("will-resize",\s*event\s*=>\s*\{[\s\S]*?event\.preventDefault\(\)/);
  assert.match(main, /window\.on\("move"/);
  assert.match(main, /window\.on\("moved"[\s\S]*?markOrbNativeMove/);
  assert.doesNotMatch(main, /orbPointerStartBounds|handleOrbPointer/);
  assert.match(main, /if\s*\(nextCollapsed\)[\s\S]*?window\.setMovable\(true\)/);
  assert.match(main, /else\s*\{[\s\S]*?window\.setMovable\(!store\.get\("positionLocked"/);
  assert.doesNotMatch(main, /setInterval\(/);
  assert.match(renderer, /floatingOrb\.addEventListener\("pointerdown"[\s\S]*?beginOrbGesture\(\)/);
  assert.doesNotMatch(renderer, /floatingOrb\.addEventListener\("pointermove"/);
});
