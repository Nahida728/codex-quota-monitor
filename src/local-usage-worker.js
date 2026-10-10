const { parentPort } = require("node:worker_threads");
const { CodexActiveTaskReader } = require("./codex-active-tasks");
const { CodexCostUsageReader } = require("./codex-cost-usage");

// Historical JSON parsing runs off the Electron main thread, in bounded passes.
const tasks = new CodexActiveTaskReader({ maxHistoryTotalBytes: 64 * 1024 * 1024 });
const cost = new CodexCostUsageReader({ cacheMs: 30000, maxTotalBytes: 64 * 1024 * 1024 });
let queue = Promise.resolve();
parentPort.on("message", request => {
  queue = queue.then(async () => {
    try {
      const reader = request.kind === "tasks" ? tasks : request.kind === "cost" ? cost : null;
      if (!reader) throw new Error("INVALID_READER");
      const result = await reader.read(request.now, request.previous);
      parentPort.postMessage({ id: request.id, result });
    } catch { parentPort.postMessage({ id: request.id, failed: true }); }
  });
});
