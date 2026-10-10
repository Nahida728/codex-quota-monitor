const { Worker } = require("node:worker_threads");
const path = require("node:path");

class LocalUsageClient {
  constructor() { this.pending = new Map(); this.inFlight = new Map(); this.nextId = 1; this.retryAt = 0; }
  start() {
    if (this.worker) return;
    if (this.disposed || Date.now() < this.retryAt) throw new Error("LOCAL_READER_UNAVAILABLE");
    const worker = new Worker(path.join(__dirname, "local-usage-worker.js"), {
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 }
    });
    this.worker = worker;
    worker.unref();
    worker.on("message", message => {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id); clearTimeout(pending.timer);
      message.failed ? pending.reject(new Error("LOCAL_READER_FAILED")) : pending.resolve(message.result);
    });
    const closed = () => {
      if (this.worker !== worker) return;
      this.worker = null; this.retryAt = Date.now() + 30000;
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer); pending.reject(new Error("LOCAL_READER_UNAVAILABLE"));
      }
      this.pending.clear();
    };
    worker.on("error", closed); worker.on("exit", closed);
  }
  read(kind, now, previous) {
    if (this.inFlight.has(kind)) return this.inFlight.get(kind);
    const promise = Promise.resolve().then(() => {
      this.start();
      return new Promise((resolve, reject) => {
        const id = this.nextId++;
        const timer = setTimeout(() => {
          this.pending.delete(id); reject(new Error("LOCAL_READER_TIMEOUT"));
          this.worker?.terminate();
        }, 45000);
        timer.unref?.();
        this.pending.set(id, { resolve, reject, timer });
        this.worker.postMessage({ id, kind, now, previous });
      });
    }).finally(() => this.inFlight.delete(kind));
    this.inFlight.set(kind, promise);
    return promise;
  }
  dispose() {
    this.disposed = true;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new Error("LOCAL_READER_CLOSED")); }
    this.pending.clear(); this.worker?.terminate(); this.worker = null;
  }
}
module.exports = { LocalUsageClient };
