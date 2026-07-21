const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { AppServerClient, QuotaService } = require("../src/quota-service");

test("requests the account usage endpoint with the protocol's null params", async () => {
  const client = new AppServerClient();
  client.start = async () => {};
  let captured = null;
  client.request = async (method, params) => {
    captured = { method, params };
    return {};
  };
  await client.readTokenUsage();
  assert.deepEqual(captured, { method: "account/usage/read", params: null });
});

test("shares one app-server startup across parallel quota and usage reads", async () => {
  const client = new AppServerClient();
  let starts = 0;
  client.performStart = async () => {
    starts += 1;
    await new Promise(resolve => setTimeout(resolve, 5));
    client.process = {};
    client.initialized = true;
  };
  await Promise.all([client.start(), client.start()]);
  assert.equal(starts, 1);
});

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

test("returns normalized account token usage and retains it when only the usage endpoint fails", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-quota-monitor-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  let usageAvailable = true;
  const service = new QuotaService({
    appStatePath: path.join(directory, "quota-state.json"),
    client: {
      readRateLimits: async () => ({
        rateLimits: {
          planType: "plus",
          primary: { usedPercent: 10, windowDurationMins: 300, resetsAt: 2_000_000_000 },
          secondary: { usedPercent: 20, windowDurationMins: 10080, resetsAt: 2_000_000_000 }
        },
        rateLimitResetCredits: { availableCount: 0, credits: [] }
      }),
      readTokenUsage: async () => {
        if (!usageAvailable) throw new Error("USAGE_TEMPORARILY_UNAVAILABLE");
        return {
          summary: { lifetimeTokens: 123456, currentStreakDays: 9 },
          dailyUsageBuckets: [{ startDate: "2026-07-20", tokens: 4567 }]
        };
      },
      dispose: () => {}
    },
    versionDetector: { read: async () => null }
  });

  const live = await service.read();
  assert.equal(live.online, true);
  assert.equal(live.tokenUsage.lifetimeTokens, 123456);
  assert.equal(live.tokenUsage.currentStreakDays, 9);
  assert.equal(live.tokenUsage.cached, false);

  usageAvailable = false;
  const cached = await service.read();
  assert.equal(cached.online, true);
  assert.equal(cached.tokenUsage.lifetimeTokens, 123456);
  assert.equal(cached.tokenUsage.cached, true);
  service.dispose();
});
