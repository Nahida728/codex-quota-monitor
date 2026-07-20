const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rendererRoot = path.join(__dirname, "..", "src", "renderer");
const html = fs.readFileSync(path.join(rendererRoot, "index.html"), "utf8");
const css = fs.readFileSync(path.join(rendererRoot, "styles.css"), "utf8");
const renderer = fs.readFileSync(path.join(rendererRoot, "renderer.js"), "utf8");

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
    /\.reset-credit-list\.is-overflowing\s*\{[\s\S]*?grid-auto-rows:\s*30px/
  );
  assert.match(
    css,
    /\.reset-credit-list\s*\{[\s\S]*?overflow-y:\s*auto/
  );
});
