const { app } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const archive = path.resolve(__dirname, "../release/win-unpacked/resources/app.asar");
const { LocalUsageClient } = require(path.join(archive, "src/local-usage-client.js"));
const { RealtimeSync } = require(path.join(archive, "src/realtime-sync.js"));
app.whenReady().then(async () => {
  const client = new LocalUsageClient();
  const guard = new RealtimeSync({ service: { client: {} }, setTimer: () => ({ unref() {} }), clearTimer() {} });
  const samples = [];
  let previous, sharedMemorySelfWakeups = 0;
  const watcher = fs.watch(path.join(require("node:os").homedir(), ".codex"), { recursive: true }, (_event, name) => {
    if (String(name) === "goals_1.sqlite-shm") {
      const wasDirty = guard.localDirty;
      guard.changed(name);
      if (wasDirty !== guard.localDirty) sharedMemorySelfWakeups++;
    }
  });
  try {
    for (let index = 0; index < 3; index++) {
      const start = performance.now();
      const result = await client.read("tasks", Date.now(), previous);
      previous = result.history;
      samples.push({ ms: Math.round(performance.now() - start), running: result.count, available: result.available });
    }
    const cost = await client.read("cost", Date.now(), null);
    console.log(JSON.stringify({ packagedWorker: true, samples, costScanned: cost.scanned,
      costPartial: cost.truncated, sharedMemorySelfWakeups, rssMiB: Math.round(process.memoryUsage().rss / 1048576) }));
    if (sharedMemorySelfWakeups) process.exitCode = 1;
  } catch {
    console.log("PACKAGED_WORKER_FAILED");
    process.exitCode = 1;
  } finally {
    watcher.close(); client.dispose(); guard.dispose(); app.quit();
  }
});
