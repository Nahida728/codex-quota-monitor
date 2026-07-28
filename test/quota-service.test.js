const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { AppServerClient, QuotaService } = require("../src/quota-service");

const emptyCostUsageReader = {
  read: async now => ({
    scanned: true,
    pricingDate: "2026-07-26",
    estimatedCostUsd: 0,
    hasUnpricedModels: false,
    models: [],
    filesScanned: 0,
    observedAt: now
  })
};
const emptyActiveTaskReader = {
  read: async now => ({
    available: true,
    tasks: [],
    count: 0,
    observedAt: now
  })
};

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

test("provides a lightweight normalized active-task probe without reading quota", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-task-probe-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let activeReads = 0;
  const service = new QuotaService({
    appStatePath: path.join(directory, "quota-state.json"),
    client: {
      readRateLimits: async () => {
        throw new Error("quota read must not run");
      },
      dispose: () => {}
    },
    versionDetector: { read: async () => null },
    costUsageReader: emptyCostUsageReader,
    activeTaskReader: {
      read: async now => {
        activeReads += 1;
        await new Promise(resolve => setTimeout(resolve, 5));
        return {
          available: true,
          observedAt: now,
          tasks: [{
            id: "turn-probe",
            projectName: "probe-project",
            startedAt: Math.floor(now / 1_000) - 10,
            estimatedCostUsd: 0,
            models: []
          }]
        };
      }
    }
  });

  const [left, right] = await Promise.all([
    service.readActiveTasks(20_000),
    service.readActiveTasks(20_000)
  ]);
  assert.equal(activeReads, 1);
  assert.equal(left.count, 1);
  assert.deepEqual(left, right);
  service.dispose();
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
    },
    costUsageReader: emptyCostUsageReader,
    activeTaskReader: emptyActiveTaskReader
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

test("keeps normalized received-reset history available while quota service is offline", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-quota-monitor-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const appStatePath = path.join(directory, "quota-state.json");
  fs.writeFileSync(appStatePath, JSON.stringify({
    receivedResetHistory: [{
      detectedAt: 1234,
      count: 1,
      items: [{
        id: "credit-one",
        resetType: "codexRateLimits",
        expiresAt: 5678,
        title: "Full reset",
        ignored: "must not escape"
      }]
    }]
  }));

  const service = new QuotaService({
    appStatePath,
    client: {
      readRateLimits: async () => {
        throw new Error("CODEX_REQUEST_TIMEOUT");
      },
      dispose: () => {}
    },
    versionDetector: { read: async () => null },
    costUsageReader: emptyCostUsageReader,
    activeTaskReader: emptyActiveTaskReader
  });

  const snapshot = await service.read();
  assert.equal(snapshot.online, false);
  assert.deepEqual(snapshot.receivedResetHistory, [{
    detectedAt: 1234,
    count: 1,
    items: [{
      id: "credit-one",
      resetType: "codexRateLimits",
      grantedAt: null,
      expiresAt: 5678,
      title: "Full reset"
    }]
  }]);
  service.dispose();
});

test("keeps official-reset history available while quota service is offline", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-quota-monitor-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const appStatePath = path.join(directory, "quota-state.json");
  fs.writeFileSync(appStatePath, JSON.stringify({
    officialResetHistory: [{
      detectedAt: 1234,
      detectionMode: "all-limits",
      previousFiveHourResetAt: 5678,
      previousWeeklyResetAt: 9012
    }]
  }));

  const service = new QuotaService({
    appStatePath,
    client: {
      readRateLimits: async () => {
        throw new Error("CODEX_REQUEST_TIMEOUT");
      },
      dispose: () => {}
    },
    versionDetector: { read: async () => null },
    costUsageReader: emptyCostUsageReader,
    activeTaskReader: emptyActiveTaskReader
  });

  const snapshot = await service.read();
  assert.equal(snapshot.online, false);
  assert.deepEqual(snapshot.officialResetHistory, [{
    detectedAt: 1234,
    detectionMode: "all-limits",
    previousFiveHourResetAt: 5678,
    previousWeeklyResetAt: 9012
  }]);
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
    versionDetector: { read: async () => null },
    subscriptionReader: {
      read: async () => ({
        planType: "plus",
        activeStart: "2098-07-20T00:00:00Z",
        activeUntil: "2099-07-20T00:00:00Z",
        lastCheckedAt: "2098-07-20T00:00:00Z"
      })
    },
    activeTaskReader: {
      read: async now => ({
        available: true,
        observedAt: now,
        tasks: [{
          id: "turn-one",
          projectName: "project-one",
          startedAt: Math.floor(now / 1000) - 60,
          estimatedCostUsd: 0.02,
          models: []
        }]
      })
    },
    costUsageReader: {
      read: async now => ({
        scanned: true,
        pricingDate: "2026-07-26",
        models: [{
          model: "gpt-5.6-sol",
          inputTokens: 1000,
          cachedInputTokens: 800,
          outputTokens: 50,
          estimatedCostUsd: 0.0025
        }],
        filesScanned: 1,
        observedAt: now
      })
    }
  });

  const live = await service.read();
  assert.equal(live.online, true);
  assert.equal(live.tokenUsage.lifetimeTokens, 123456);
  assert.equal(live.tokenUsage.totalWorkDays, 1);
  assert.equal(live.tokenUsage.currentStreakDays, 9);
  assert.equal(live.tokenUsage.cached, false);
  assert.equal(live.subscription.planType, "plus");
  assert.equal(live.subscription.assistedWorkDays, 1);
  assert.equal(live.subscription.expiresAt, Math.floor(Date.parse("2099-07-20T00:00:00Z") / 1000));
  assert.equal(live.subscription.projected, false);
  assert.equal(live.tokenCost.models[0].model, "gpt-5.6-sol");
  assert.equal(live.tokenCost.estimatedCostUsd, 0.0025);
  assert.equal(live.activeTasks.count, 1);
  assert.equal(live.activeTasks.tasks[0].projectName, "project-one");

  usageAvailable = false;
  const cached = await service.read();
  assert.equal(cached.online, true);
  assert.equal(cached.tokenUsage.lifetimeTokens, 123456);
  assert.equal(cached.tokenUsage.totalWorkDays, 1);
  assert.equal(cached.tokenUsage.cached, true);
  service.dispose();
});
