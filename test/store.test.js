const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  createQuotaStateStore,
  readJsonObject
} = require("../src/store");

function createWorkspace(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-state-store-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return {
    directory,
    filePath: path.join(directory, "quota-state.json"),
    backupDirectory: path.join(directory, "quota-state-archive")
  };
}

function durableState() {
  return {
    hasBaseline: true,
    knownCreditIds: ["credit-one"],
    officialResetAt: 1_000,
    officialResetHistory: [{
      detectedAt: 1_000,
      detectionMode: "all-limits"
    }],
    receivedResetHistory: [{
      detectedAt: 1_100,
      count: 1,
      items: [{ id: "credit-one", resetType: "codexRateLimits" }]
    }],
    codexClientVersion: "26.721.4979.0",
    codexClientPreviousVersion: "26.720.1000.0",
    codexClientUpdatedVersion: "26.721.4979.0",
    codexClientUpdateAt: 2_000,
    codexClientUpdateHistory: [{
      fromVersion: "26.720.1000.0",
      toVersion: "26.721.4979.0",
      detectedAt: 2_000
    }]
  };
}

function backupFiles(directory) {
  try {
    return fs.readdirSync(directory)
      .filter(name => name.endsWith(".json"))
      .sort();
  } catch {
    return [];
  }
}

test("periodically creates immutable quota-state archives", t => {
  const workspace = createWorkspace(t);
  let now = 10_000;
  const store = createQuotaStateStore(workspace.filePath, {
    backupDirectory: workspace.backupDirectory,
    backupIntervalMs: 60_000,
    maxBackups: 8,
    now: () => now
  });
  Object.assign(store.data, durableState());
  store.set("lastSuccessfulAt", now);

  const firstFiles = backupFiles(workspace.backupDirectory);
  assert.equal(firstFiles.length, 1);
  const firstContents = fs.readFileSync(
    path.join(workspace.backupDirectory, firstFiles[0]),
    "utf8"
  );

  now += 30_000;
  store.set("lastSuccessfulAt", now);
  assert.deepEqual(backupFiles(workspace.backupDirectory), firstFiles);
  assert.equal(
    fs.readFileSync(path.join(workspace.backupDirectory, firstFiles[0]), "utf8"),
    firstContents
  );

  now += 31_000;
  store.set("lastSuccessfulAt", now);
  assert.equal(backupFiles(workspace.backupDirectory).length, 2);
});

test("restores a corrupt primary file from the newest valid archive", t => {
  const workspace = createWorkspace(t);
  let now = 20_000;
  const store = createQuotaStateStore(workspace.filePath, {
    backupDirectory: workspace.backupDirectory,
    backupIntervalMs: 60_000,
    now: () => now
  });
  Object.assign(store.data, durableState());
  store.set("lastSuccessfulAt", now);
  fs.writeFileSync(workspace.filePath, "{\"officialResetHistory\":", "utf8");

  now += 1_000;
  const recovered = createQuotaStateStore(workspace.filePath, {
    backupDirectory: workspace.backupDirectory,
    backupIntervalMs: 60_000,
    now: () => now
  });
  assert.equal(recovered.data.officialResetHistory.length, 1);
  assert.equal(recovered.data.codexClientUpdateHistory.length, 1);
  assert.deepEqual(
    readJsonObject(workspace.filePath).officialResetHistory.map(record => ({
      detectedAt: record.detectedAt,
      detectionMode: record.detectionMode
    })),
    durableState().officialResetHistory
  );
});

test("repairs a valid but reset primary without allowing histories to go backwards", t => {
  const workspace = createWorkspace(t);
  let now = 30_000;
  const store = createQuotaStateStore(workspace.filePath, {
    backupDirectory: workspace.backupDirectory,
    backupIntervalMs: 60_000,
    now: () => now
  });
  Object.assign(store.data, durableState());
  store.set("lastSuccessfulAt", now);

  fs.writeFileSync(workspace.filePath, JSON.stringify({
    hasBaseline: true,
    officialResetHistory: [],
    codexClientVersion: "26.721.4979.0"
  }), "utf8");

  now += 1_000;
  const recovered = createQuotaStateStore(workspace.filePath, {
    backupDirectory: workspace.backupDirectory,
    backupIntervalMs: 60_000,
    now: () => now
  });
  assert.equal(recovered.data.officialResetHistory.length, 1);
  assert.equal(recovered.data.receivedResetHistory.length, 1);
  assert.equal(recovered.data.codexClientUpdateHistory.length, 1);

  recovered.data.officialResetHistory = [];
  recovered.data.receivedResetHistory = [];
  recovered.data.codexClientUpdateHistory = [];
  now += 61_000;
  recovered.set("lastSuccessfulAt", now);

  const primary = readJsonObject(workspace.filePath);
  assert.equal(primary.officialResetHistory.length, 1);
  assert.equal(primary.receivedResetHistory.length, 1);
  assert.equal(primary.codexClientUpdateHistory.length, 1);
  for (const name of backupFiles(workspace.backupDirectory)) {
    const backup = readJsonObject(path.join(workspace.backupDirectory, name));
    assert.ok(backup);
    assert.equal(backup.officialResetHistory.length, 1);
    assert.equal(backup.codexClientUpdateHistory.length, 1);
  }
});

test("ignores a corrupt newest archive and recovers from an older valid generation", t => {
  const workspace = createWorkspace(t);
  let now = 40_000;
  const store = createQuotaStateStore(workspace.filePath, {
    backupDirectory: workspace.backupDirectory,
    backupIntervalMs: 60_000,
    now: () => now
  });
  Object.assign(store.data, durableState());
  store.set("lastSuccessfulAt", now);

  now += 61_000;
  store.set("lastSuccessfulAt", now);
  const files = backupFiles(workspace.backupDirectory);
  assert.equal(files.length, 2);
  fs.writeFileSync(
    path.join(workspace.backupDirectory, files.at(-1)),
    "{\"broken\":",
    "utf8"
  );
  fs.writeFileSync(workspace.filePath, "", "utf8");

  now += 1_000;
  const recovered = createQuotaStateStore(workspace.filePath, {
    backupDirectory: workspace.backupDirectory,
    backupIntervalMs: 60_000,
    now: () => now
  });
  assert.equal(recovered.data.officialResetHistory.length, 1);
  assert.equal(recovered.data.codexClientUpdateHistory.length, 1);
  assert.ok(readJsonObject(workspace.filePath));
});

test("backs up a newly appended permanent event immediately", t => {
  const workspace = createWorkspace(t);
  let now = 50_000;
  const store = createQuotaStateStore(workspace.filePath, {
    backupDirectory: workspace.backupDirectory,
    backupIntervalMs: 60_000,
    now: () => now
  });
  Object.assign(store.data, durableState());
  store.set("lastSuccessfulAt", now);
  assert.equal(backupFiles(workspace.backupDirectory).length, 1);

  now += 1_000;
  store.data.officialResetHistory.push({
    detectedAt: 3_000,
    detectionMode: "weekly-only-five-hour-disabled"
  });
  store.set("officialResetAt", 3_000);
  assert.equal(backupFiles(workspace.backupDirectory).length, 2);

  const latest = readJsonObject(path.join(
    workspace.backupDirectory,
    backupFiles(workspace.backupDirectory).at(-1)
  ));
  assert.equal(latest.officialResetHistory.length, 2);
});

test("history protection does not block legitimate volatile state changes", t => {
  const workspace = createWorkspace(t);
  let now = 60_000;
  const store = createQuotaStateStore(workspace.filePath, {
    backupDirectory: workspace.backupDirectory,
    backupIntervalMs: 60_000,
    now: () => now
  });
  Object.assign(store.data, durableState(), {
    codexClientPendingVersion: "26.722.1000.0",
    codexClientPendingAt: 3_000,
    resetCreditDetails: [{ id: "credit-one" }]
  });
  store.set("lastSuccessfulAt", now);

  store.data.codexClientVersion = "26.720.500.0";
  store.data.codexClientPendingVersion = null;
  store.data.codexClientPendingAt = null;
  store.data.resetCreditDetails = [];
  now += 1_000;
  store.set("lastSuccessfulAt", now);

  const persisted = readJsonObject(workspace.filePath);
  assert.equal(persisted.codexClientVersion, "26.720.500.0");
  assert.equal(persisted.codexClientPendingVersion, null);
  assert.equal(persisted.codexClientPendingAt, null);
  assert.deepEqual(persisted.resetCreditDetails, []);
  assert.equal(persisted.officialResetHistory.length, 1);
  assert.equal(persisted.codexClientUpdateHistory.length, 1);
});
