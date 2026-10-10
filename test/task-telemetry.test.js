const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeTaskTelemetry, normalizeTaskTelemetry } = require("../src/task-telemetry");
const { summarizeTaskWindow, normalizeActiveTaskResult } = require("../src/codex-active-tasks");

const startedAt = 1791590400;
function counter(seconds, total, last = total) {
  return JSON.stringify({ timestamp: new Date((startedAt + seconds) * 1000).toISOString(), type: "event_msg",
    payload: { type: "token_count", info: {
      total_token_usage: { input_tokens: 160, cached_input_tokens: 20, output_tokens: total, total_tokens: 160 + total },
      last_token_usage: { input_tokens: 100, cached_input_tokens: 10, output_tokens: last, total_tokens: 100 + last }
    } } });
}
const terminal = { startedAt, eventAt: startedAt + 30, durationMs: 30000, firstTokenMs: 1250 };
const cost = { models: [{ inputTokens: 170, cachedInputTokens: 120, outputTokens: 130 }] };

test("turn telemetry separates total tokens, interval extrema, and whole-turn average", () => {
  const result = summarizeTaskTelemetry([counter(10, 40), counter(12, 40), counter(20, 130, 90)], terminal, cost);
  assert.equal(result.firstTokenMs, 1250);
  assert.equal(result.totalTokens, 300); // cached input is already included
  assert.equal(result.peakTokensPerSecond, 9);
  assert.equal(result.minTokensPerSecond, 4);
  assert.equal(result.averageTokensPerSecond, 130 / 30); // terminal tool/wait time stays in denominator
  assert.equal(result.intervalCount, 2); // replay is not a zero-speed sample
});

test("missing timestamps and incomplete scans never invent interval speeds", () => {
  const withoutTime = JSON.parse(counter(10, 130));
  delete withoutTime.timestamp;
  const result = summarizeTaskTelemetry([JSON.stringify(withoutTime)], terminal, cost);
  assert.equal(result.peakTokensPerSecond, null);
  assert.equal(result.minTokensPerSecond, null);
  assert.equal(result.averageTokensPerSecond, 130 / 30);
  const partial = summarizeTaskTelemetry([counter(10, 130)], terminal, cost, true);
  assert.equal(partial.totalTokens, 300);
  assert.equal(partial.partial, true);
  assert.equal(partial.averageTokensPerSecond, null);
  assert.equal(partial.peakTokensPerSecond, null);
  const missing = summarizeTaskTelemetry([], terminal, cost);
  assert.equal(missing.totalTokens, null);
  assert.equal(missing.averageTokensPerSecond, null);
});

test("invalid and reset counters invalidate extrema; unsafe numeric fields stay unavailable", () => {
  const result = summarizeTaskTelemetry([counter(10, 130), counter(20, 10)], terminal, cost);
  assert.equal(result.minTokensPerSecond, null);
  assert.deepEqual(normalizeTaskTelemetry({ firstTokenMs: -1, totalTokens: "100", peakTokensPerSecond: Infinity }).firstTokenMs, null);
  assert.equal(normalizeTaskTelemetry({ totalTokens: "100" }).totalTokens, null);
});

test("completed-task latency and numeric telemetry cross the public normalization boundary", () => {
  const lines = [JSON.stringify({ type: "event_msg", timestamp: new Date(startedAt * 1000).toISOString(),
    payload: { type: "task_started", turn_id: "turn-1", started_at: startedAt } }),
    JSON.stringify({ type: "turn_context", payload: { model: "gpt-6.1-sol" } }),
    counter(10, 40), counter(20, 130, 90),
    JSON.stringify({ type: "event_msg", timestamp: new Date((startedAt + 30) * 1000).toISOString(),
      payload: { type: "task_complete", turn_id: "turn-1", started_at: startedAt, completed_at: startedAt + 30,
        duration_ms: 30000, time_to_first_token_ms: 1250, last_agent_message: "private content" } })];
  const task = summarizeTaskWindow(lines, (startedAt + 40) * 1000).terminalTask;
  assert.equal(task.telemetry.firstTokenMs, 1250);
  assert.equal(task.telemetry.outputTokens, 130);
  assert.equal(task.telemetry.peakTokensPerSecond, 9);
  const result = normalizeActiveTaskResult({ available: true, tasks: [], terminalTasks: [
    { ...task, id: "later-abort", endedAt: startedAt + 39, outcome: "abnormal-interrupted" }, task
  ] });
  assert.equal(result.latestTask.id, "turn-1");
  assert.equal(result.latestTask.telemetry.firstTokenMs, 1250);
  assert.ok(!JSON.stringify(result).includes("private content"));
});
