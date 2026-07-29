const test = require("node:test");
const assert = require("node:assert/strict");

const {
  isTrustedCodexExecutable,
  selectCodexWindow
} = require("../src/codex-window-focus");

test("trusts only the installed OpenAI Codex or ChatGPT Store executable", () => {
  assert.equal(
    isTrustedCodexExecutable(
      "C:\\Program Files\\WindowsApps\\OpenAI.Codex_26.721.4979.0_x64__2p2nqsd0c76g0\\app\\ChatGPT.exe"
    ),
    true
  );
  assert.equal(
    isTrustedCodexExecutable(
      "C:\\Program Files\\WindowsApps\\OpenAI.ChatGPT_26.721.4979.0_x64__2p2nqsd0c76g0\\app\\ChatGPT.exe"
    ),
    true
  );
  assert.equal(
    isTrustedCodexExecutable("C:\\Users\\Public\\ChatGPT.exe"),
    false
  );
  assert.equal(
    isTrustedCodexExecutable("C:\\Program Files\\Microsoft\\Edge\\msedge.exe"),
    false
  );
});

test("prefers a visible non-minimized Codex window with the largest area", () => {
  const selected = selectCodexWindow([
    { hwnd: 1, visible: false, iconic: false, area: 900_000 },
    { hwnd: 2, visible: true, iconic: true, area: 800_000 },
    { hwnd: 3, visible: true, iconic: false, area: 700_000 },
    { hwnd: 4, visible: true, iconic: false, area: 600_000 }
  ]);
  assert.equal(selected.hwnd, 3);
});
