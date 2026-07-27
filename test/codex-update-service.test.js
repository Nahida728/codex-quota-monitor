const test = require("node:test");
const assert = require("node:assert/strict");

const {
  UPDATE_NOTICE_MS,
  compareVersions,
  evaluateClientUpdate,
  normalizeClientUpdateHistory,
  normalizeVersion,
  parseInstalledPackageInfo,
  parseInstalledVersion,
  parseWindowsStoreUpdateEvents,
  readLatestWindowsStoreUpdate
} = require("../src/codex-update-service");

test("normalizes Appx versions and rejects unrelated command output", () => {
  assert.equal(normalizeVersion(" 26.715.2305.0\r\n"), "26.715.2305.0");
  assert.equal(normalizeVersion("Codex 26.715"), null);
  assert.equal(parseInstalledVersion("\r\n26.715.2305.0\r\n"), "26.715.2305.0");
  assert.equal(parseInstalledVersion("Get-AppxPackage failed"), null);
  assert.deepEqual(
    parseInstalledPackageInfo("26.715.2305.0|OpenAI.Codex_2p2nqsd0c76g0\r\n"),
    {
      version: "26.715.2305.0",
      packageFamilyName: "OpenAI.Codex_2p2nqsd0c76g0"
    }
  );
});

test("compares dotted versions numerically", () => {
  assert.equal(compareVersions("26.715.2305.0", "26.715.999.0"), 1);
  assert.equal(compareVersions("26.715.2305.0", "26.715.2305"), 0);
  assert.equal(compareVersions("26.714.9.0", "26.715.1.0"), -1);
});

test("first observation establishes a baseline without a false update alert", () => {
  const result = evaluateClientUpdate("26.715.2305.0", {}, 1_000);
  assert.equal(result.available, true);
  assert.equal(result.detected, false);
  assert.equal(result.currentVersion, "26.715.2305.0");
  assert.deepEqual(result.persistence, {
    codexClientVersion: "26.715.2305.0"
  });
});

test("a higher installed version creates a persistent seven-day reminder", () => {
  const now = 2_000;
  const result = evaluateClientUpdate("26.716.10.0", {
    codexClientVersion: "26.715.2305.0"
  }, now);
  assert.equal(result.detected, true);
  assert.equal(result.previousVersion, "26.715.2305.0");
  assert.equal(result.detectedAt, now);
  assert.deepEqual(result.persistence, {
    codexClientPreviousVersion: "26.715.2305.0",
    codexClientUpdatedVersion: "26.716.10.0",
    codexClientUpdateAt: now,
    codexClientUpdateHistory: [{
      fromVersion: "26.715.2305.0",
      toVersion: "26.716.10.0",
      detectedAt: now
    }],
    codexClientVersion: "26.716.10.0"
  });
  assert.deepEqual(result.history, [{
    fromVersion: "26.715.2305.0",
    toVersion: "26.716.10.0",
    detectedAt: now
  }]);

  const persisted = { codexClientVersion: "26.716.10.0", ...result.persistence };
  assert.equal(
    evaluateClientUpdate(null, persisted, now + UPDATE_NOTICE_MS - 1).detected,
    true
  );
  assert.equal(
    evaluateClientUpdate(null, persisted, now + UPDATE_NOTICE_MS + 1).detected,
    false
  );
});

test("a rollback changes the baseline without being reported as a new update", () => {
  const result = evaluateClientUpdate("26.714.1.0", {
    codexClientVersion: "26.715.2305.0"
  }, 3_000);
  assert.equal(result.detected, false);
  assert.deepEqual(result.persistence, {
    codexClientVersion: "26.714.1.0"
  });
});

test("keeps a permanent newest-first installed-version timeline", () => {
  const result = evaluateClientUpdate("26.717.2.0", {
    codexClientVersion: "26.716.10.0",
    codexClientUpdateHistory: [{
      fromVersion: "26.715.2305.0",
      toVersion: "26.716.10.0",
      detectedAt: 2_000
    }]
  }, 4_000);

  assert.deepEqual(result.history, [{
    fromVersion: "26.716.10.0",
    toVersion: "26.717.2.0",
    detectedAt: 4_000
  }, {
    fromVersion: "26.715.2305.0",
    toVersion: "26.716.10.0",
    detectedAt: 2_000
  }]);
  assert.deepEqual(result.persistence.codexClientUpdateHistory, [...result.history].reverse());

  const expiredNotice = evaluateClientUpdate(null, {
    codexClientVersion: "26.717.2.0",
    codexClientPreviousVersion: "26.716.10.0",
    codexClientUpdatedVersion: "26.717.2.0",
    codexClientUpdateAt: 4_000,
    codexClientUpdateHistory: result.persistence.codexClientUpdateHistory
  }, 4_000 + UPDATE_NOTICE_MS + 1);
  assert.equal(expiredNotice.installedUpdateDetected, false);
  assert.equal(expiredNotice.history.length, 2);
});

test("migrates the legacy latest update into history without duplicates", () => {
  const state = {
    codexClientVersion: "26.716.10.0",
    codexClientPreviousVersion: "26.715.2305.0",
    codexClientUpdatedVersion: "26.716.10.0",
    codexClientUpdateAt: 2_000
  };
  const migrated = evaluateClientUpdate(null, state, 3_000);
  assert.deepEqual(migrated.persistence.codexClientUpdateHistory, [{
    fromVersion: "26.715.2305.0",
    toVersion: "26.716.10.0",
    detectedAt: 2_000
  }]);
  assert.deepEqual(normalizeClientUpdateHistory({
    ...state,
    codexClientUpdateHistory: [
      migrated.persistence.codexClientUpdateHistory[0],
      migrated.persistence.codexClientUpdateHistory[0]
    ]
  }), migrated.history);
});

test("parses the same Windows Store update-ready signal used by the Codex client", () => {
  const events = parseWindowsStoreUpdateEvents([
    "2026-07-17T22:49:50.253Z info [windows-store-updater] Checking Windows Store for package updates buildVersion=26.715.2305.0 manifestBuildVersion=26.715.3651.0 packageIdentity=OpenAI.Codex",
    "2026-07-17T22:49:54.902Z info [windows-store-updater] Windows Store package update check completed canSilentlyDownload=true completed=false hasUpdate=false overallState=NoUpdates",
    "2026-07-17T23:19:50.281Z info [windows-store-updater] Checking Windows Store for package updates buildVersion=26.715.2305.0 manifestBuildVersion=26.715.3651.0 packageIdentity=OpenAI.Codex",
    "2026-07-17T23:20:59.626Z info [windows-store-updater] Windows Store package update check completed canSilentlyDownload=true completed=true hasUpdate=true overallState=Completed"
  ].join("\n"));
  assert.equal(events.length, 2);
  assert.equal(events[1].currentVersion, "26.715.2305.0");
  assert.equal(events[1].targetVersion, "26.715.3651.0");
  assert.equal(events[1].hasUpdate, true);
  assert.equal(events[1].completed, true);
});

test("finds the latest completed pending update from Codex logs", async t => {
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-update-log-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, "codex-desktop.log"), [
    "2026-07-17T23:19:50.281Z info [windows-store-updater] Checking Windows Store for package updates buildVersion=26.715.2305.0 manifestBuildVersion=26.715.3651.0 packageIdentity=OpenAI.Codex",
    "2026-07-17T23:20:59.626Z info [windows-store-updater] Windows Store package update check completed canSilentlyDownload=true completed=true hasUpdate=true overallState=Completed"
  ].join("\n"));
  const signal = await readLatestWindowsStoreUpdate(
    directory,
    "26.715.2305.0",
    Date.parse("2026-07-20T00:00:00.000Z")
  );
  assert.equal(signal.updateReady, true);
  assert.equal(signal.targetVersion, "26.715.3651.0");
});

test("reports a downloaded update before it is installed and persists the reminder", () => {
  const detectedAt = Date.parse("2026-07-17T23:20:59.626Z");
  const result = evaluateClientUpdate({
    installedVersion: "26.715.2305.0",
    updateReady: true,
    checkedVersion: "26.715.2305.0",
    targetVersion: "26.715.3651.0",
    detectedAt
  }, {}, detectedAt + 1_000);
  assert.equal(result.status, "update-ready");
  assert.equal(result.pendingUpdate, true);
  assert.equal(result.pendingVersion, "26.715.3651.0");
  assert.equal(result.installedUpdateDetected, false);
  assert.equal(result.persistence.codexClientVersion, "26.715.2305.0");
  assert.equal(result.persistence.codexClientPendingVersion, "26.715.3651.0");
  assert.equal(result.persistence.codexClientPendingAt, detectedAt);
});

test("clears the pending reminder after the target version is installed", () => {
  const result = evaluateClientUpdate({
    installedVersion: "26.715.3651.0",
    updateReady: null
  }, {
    codexClientVersion: "26.715.2305.0",
    codexClientPendingVersion: "26.715.3651.0",
    codexClientPendingAt: 1_000
  }, 2_000);
  assert.equal(result.pendingUpdate, false);
  assert.equal(result.installedUpdateDetected, true);
  assert.equal(result.status, "updated");
  assert.equal(result.persistence.codexClientPendingVersion, null);
  assert.equal(result.persistence.codexClientPendingAt, null);
});
