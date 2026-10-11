const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createQuotaStateStore, reconcileQuotaStates } = require("../src/store");
const { CodexActiveTaskReader, summarizeTaskWindow } = require("../src/codex-active-tasks");

function workspace(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "quota-recovery-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test("a state above the old 4 MiB limit survives restart and archive recovery", t => {
  const file = path.join(workspace(t), "quota-state.json");
  const store = createQuotaStateStore(file);
  store.set("numericHistoryFixture", "0".repeat(5 * 1024 * 1024));
  store.set("taskPerformanceRecords", { totalTaskCount: 2450, totalElapsedSeconds: 1904843 }, { forceBackup: true });
  assert.ok(fs.statSync(file).size > 4 * 1024 * 1024);
  assert.equal(createQuotaStateStore(file).data.taskPerformanceRecords.totalTaskCount, 2450);
  fs.writeFileSync(file, "{}");
  assert.equal(createQuotaStateStore(file).data.taskPerformanceRecords.totalElapsedSeconds, 1904843);
});

test("task recovery excludes the reset scan lineage but preserves unrelated histories", () => {
  const recovered = reconcileQuotaStates({
    tokenCostSnapshot: { ledgerGeneration: 0 },
    taskPerformanceRecords: { totalElapsedSeconds: 30676795 },
    knownCreditIds: ["new-credit"]
  }, [{
    tokenCostSnapshot: { ledgerGeneration: 100 },
    taskPerformanceRecords: { totalElapsedSeconds: 1904843, totalTaskCount: 2450 }
  }]);
  assert.equal(recovered.taskLedgerGeneration, 100);
  assert.equal(recovered.taskPerformanceRecords.totalElapsedSeconds, 1904843);
  assert.ok(recovered.knownCreditIds.includes("new-credit"));
  const next = reconcileQuotaStates(recovered, [{taskLedgerGeneration: 0,
    taskPerformanceRecords: { totalElapsedSeconds: 30676795 }}]);
  assert.equal(next.taskPerformanceRecords.totalElapsedSeconds, 1904843);
});

const start = JSON.stringify({ timestamp: "2026-08-29T05:34:02.987Z", type: "event_msg",
  payload: { type: "task_started", turn_id: "replay", started_at: 1787425802 } });
const final = JSON.stringify({ timestamp: "2026-08-29T05:34:03.005Z", type: "response_item",
  payload: { type: "message", role: "assistant", phase: "final_answer", content: [] } });
const complete = JSON.stringify({ timestamp: "2026-08-29T05:34:03.005Z", type: "event_msg",
  payload: { type: "task_complete", turn_id: "replay", completed_at: 1787426451, duration_ms: 649143 } });

test("history prefers explicit duration after a replayed final answer", async t => {
  const root = workspace(t);
  fs.writeFileSync(path.join(root, "replay.jsonl"), [start, final, complete].join("\n") + "\n");
  const reader = new CodexActiveTaskReader({ sessionsRoot: root, archivedSessionsRoot: path.join(root, "none"), goalContextReader: () => new Map() });
  const result = await reader.read(Date.now());
  assert.equal(result.history.totalTaskCount, 1);
  assert.equal(result.history.totalElapsedSeconds, 649);
  assert.equal(result.history.completedTaskCount, 1);
});

test("a replayed final answer without duration has an unknown duration", () => {
  const result = summarizeTaskWindow([start, final]);
  assert.equal(result.terminalTask.durationKnown, false);
  assert.equal(result.terminalTask.elapsedSeconds, 0);
  assert.equal(result.terminalTask.outcome, "completed");
});
