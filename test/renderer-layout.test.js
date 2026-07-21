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

test("places three status cards between quota cards and reset credits", () => {
  const quotaIndex = html.indexOf('class="quota-section"');
  const signalsIndex = html.indexOf('class="signals"');
  const resetIndex = html.indexOf('class="reset-section"');
  assert.ok(quotaIndex >= 0 && quotaIndex < signalsIndex);
  assert.ok(signalsIndex < resetIndex);
  assert.equal((html.match(/class="status-card(?:\s[^"]*)?"/g) || []).length, 3);
  assert.match(html, /id="clientUpdateStatus"/);
  assert.match(html, /id="clientUpdateVersion"/);
  assert.match(
    css,
    /\.signals\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/
  );
});

test("places a compact token overview before the final reset-credit section", () => {
  const signalsIndex = html.indexOf('class="signals"');
  const tokenIndex = html.indexOf('class="token-overview');
  const resetIndex = html.indexOf('class="reset-section"');
  assert.ok(signalsIndex >= 0 && signalsIndex < tokenIndex);
  assert.ok(tokenIndex < resetIndex);
  assert.match(html, /id="lifetimeTokenValue"/);
  assert.match(html, /id="currentStreakValue"/);
  assert.match(css, /\.token-overview\s*\{[\s\S]*?height:\s*var\(--token-overview-height,\s*56px\)/);
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

test("keeps sparse reset rows compact and gives their unused height to token usage", () => {
  assert.match(
    css,
    /\.reset-credit-list\s*\{[\s\S]*?grid-template-rows:\s*repeat\(var\(--reset-visible-count\),\s*28px\)/
  );
  assert.match(css, /\.reset-credit-list\s*\{[\s\S]*?align-content:\s*start/);
  assert.match(renderer, /66\s*\+\s*visibleRows\s*\*\s*28\s*\+\s*\(visibleRows\s*-\s*1\)\s*\*\s*4/);
  assert.match(renderer, /const tokenHeight\s*=\s*\(offline\s*\?\s*232\s*:\s*316\)\s*-\s*resetHeight/);
  assert.match(renderer, /classList\.toggle\("is-expanded",\s*tokenHeight\s*>=\s*124\)/);
});

test("secondary views preserve glass backgrounds and native drag regions", () => {
  assert.doesNotMatch(html, /class="(?:crop|history|token)-modal no-drag"/);
  assert.match(
    css,
    /\.crop-modal,[\s\S]*?\.token-modal\s*\{[\s\S]*?background:\s*rgba\(4,11,18,.26\)/
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
