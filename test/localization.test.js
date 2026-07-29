const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const renderer = fs.readFileSync(path.join(root, "src", "renderer", "renderer.js"), "utf8");
const html = fs.readFileSync(path.join(root, "src", "renderer", "index.html"), "utf8");
const main = fs.readFileSync(path.join(root, "src", "main.js"), "utf8");

function dictionaryKeys(language, followingToken) {
  const start = renderer.indexOf(`  ${language}: {`);
  const end = renderer.indexOf(followingToken, start);
  assert.ok(start >= 0 && end > start, `Could not locate ${language} dictionary`);
  return [...renderer.slice(start, end).matchAll(/^    ([A-Za-z0-9_]+):/gm)]
    .map(match => match[1])
    .sort();
}

test("Chinese and English dictionaries expose exactly the same keys", () => {
  const chineseKeys = dictionaryKeys("zh", "\n  en: {");
  const englishKeys = dictionaryKeys("en", "\n};");
  assert.deepEqual(englishKeys, chineseKeys);
});

test("language switching updates document and accessibility-only copy", () => {
  assert.match(renderer, /appTitle:\s*"Codex监测台"/);
  assert.match(renderer, /title:\s*"Codex监测台"/);
  assert.match(main, /const APP_NAME = "Codex监测台"/);
  assert.match(html, /<title>Codex监测台<\/title>/);
  for (const key of [
    "appTitle",
    "switchLanguage",
    "refreshNow",
    "openSubscription",
    "openConnectionStatus",
    "connectionDisconnectedTitle",
    "connectionOnlineTitle",
    "connectionAcknowledge",
    "quotaRegion",
    "statusRegion",
    "tokenUsageRegion",
    "openCostDetails",
    "tokenPeriodGroup",
    "tokenChartLabel",
    "cropResize"
  ]) {
    assert.match(renderer, new RegExp(`${key}:\\s*\"[^\"]+\"`, "g"));
  }
  assert.match(renderer, /document\.title\s*=\s*t\("appTitle"\)/);
  assert.match(renderer, /languageButton\.setAttribute\("aria-label",\s*t\("switchLanguage"\)\)/);
  assert.match(renderer, /refreshButton\.setAttribute\("aria-label",\s*t\("refreshNow"\)\)/);
  assert.match(renderer, /connectionLabel\.setAttribute\("aria-label",\s*t\("openSubscription"\)\)/);
  assert.match(renderer, /connectionStatusButton\.setAttribute\("aria-label",\s*t\("openConnectionStatus"\)\)/);
  assert.match(renderer, /quotaSection\.setAttribute\("aria-label",\s*t\("quotaRegion"\)\)/);
  assert.match(renderer, /statusSection\.setAttribute\("aria-label",\s*t\("statusRegion"\)\)/);
  assert.match(renderer, /tokenOverview\.setAttribute\("aria-label",\s*t\("openTokenUsage"\)\)/);
  assert.match(renderer, /tokenCostHelp\.setAttribute\("aria-label",\s*t\("openCostDetails"\)\)/);
  assert.match(renderer, /tokenPeriodSwitch\.setAttribute\("aria-label",\s*t\("tokenPeriodGroup"\)\)/);
  assert.match(renderer, /tokenUsageChart\.setAttribute\("aria-label",\s*t\("tokenChartLabel"\)\)/);
  assert.match(renderer, /cropResizeHandle\.setAttribute\("aria-label",\s*t\("cropResize"\)\)/);
  assert.match(html, /id="quotaSection"/);
  assert.match(html, /id="statusSection"/);
});

test("known reset credit types use localized copy before server titles", () => {
  const functionStart = renderer.indexOf("function getResetCreditTitle");
  const functionEnd = renderer.indexOf("\n}", functionStart);
  const functionBody = renderer.slice(functionStart, functionEnd);
  assert.ok(functionBody.indexOf('resetType === "codexRateLimits"') < functionBody.indexOf("credit?.title"));
});

test("tray tooltip and file chooser filter follow the selected language", () => {
  assert.match(main, /tray\.setToolTip\(getLocalizedAppName\(\)\)/);
  assert.match(main, /name:\s*zh\s*\?\s*"图片"\s*:\s*"Images"/);
});
