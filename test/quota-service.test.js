const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { QuotaService } = require("../src/quota-service");

test("keeps local Codex client update detection available while quota service is offline", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-quota-monitor-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  let installedVersion = "26.715.2305.0";
  const service = new QuotaService({
    appStatePath: path.join(directory, "quota-state.json"),
    client: {
      readRateLimits: async () => {
        throw new Error("CODEX_REQUEST_TIMEOUT");
      },
      dispose: () => {}
    },
    versionDetector: {
      read: async () => installedVersion
    }
  });

  const baseline = await service.read();
  assert.equal(baseline.online, false);
  assert.equal(baseline.clientUpdate.available, true);
  assert.equal(baseline.clientUpdate.detected, false);

  installedVersion = "26.716.1010.0";
  const updated = await service.read();
  assert.equal(updated.online, false);
  assert.equal(updated.clientUpdate.detected, true);
  assert.equal(updated.clientUpdate.previousVersion, "26.715.2305.0");
  assert.equal(updated.clientUpdate.currentVersion, "26.716.1010.0");
  service.dispose();
});
