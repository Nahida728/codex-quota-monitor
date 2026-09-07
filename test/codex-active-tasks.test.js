const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  ACTIVE_INACTIVITY_TIMEOUT_MS,
  CodexActiveTaskReader,
  normalizeActiveTaskResult,
  normalizeProjectName,
  summarizeActiveTaskLines,
  summarizeTaskWindow
} = require("../src/codex-active-tasks");

function taskStarted(turnId, startedAt) {
  return JSON.stringify({
    timestamp: new Date(startedAt * 1_000).toISOString(),
    type: "event_msg",
    payload: {
      type: "task_started",
      turn_id: turnId,
      started_at: startedAt
    }
  });
}

function taskComplete(turnId, startedAt, completedAt) {
  return JSON.stringify({
    timestamp: new Date(completedAt * 1_000).toISOString(),
    type: "event_msg",
    payload: {
      type: "task_complete",
      turn_id: turnId,
      started_at: startedAt,
      completed_at: completedAt
    }
  });
}

function turnAborted(turnId, startedAt, completedAt, reason = "interrupted") {
  return JSON.stringify({
    timestamp: new Date(completedAt * 1_000).toISOString(),
    type: "event_msg",
    payload: {
      type: "turn_aborted",
      turn_id: turnId,
      started_at: startedAt,
      completed_at: completedAt,
      duration_ms: (completedAt - startedAt) * 1_000,
      reason
    }
  });
}

function sessionMeta(cwd) {
  return JSON.stringify({
    type: "session_meta",
    payload: { cwd, prompt: "must never escape" }
  });
}

function turnContext(model) {
  return JSON.stringify({ type: "turn_context", payload: { model } });
}

function tokenCount(input, cached, output) {
  return JSON.stringify({
    type: "event_msg",
    payload: {
      type: "token_count",
      info: {
        total_token_usage: {
          input_tokens: input,
          cached_input_tokens: cached,
          output_tokens: output,
          total_tokens: input + output
        },
        last_token_usage: {
          input_tokens: input,
          cached_input_tokens: cached,
          output_tokens: output,
          total_tokens: input + output
        }
      }
    }
  });
}

test("identifies an explicit in-progress task and prices only that task", () => {
  const lines = [
    sessionMeta("C:\\Users\\person\\Desktop\\sample-project"),
    taskStarted("old-turn", 100),
    turnContext("gpt-5.6-sol"),
    tokenCount(1_000, 800, 10),
    taskComplete("old-turn", 100, 110),
    JSON.stringify({ type: "response_item", payload: { prompt: "private prompt" } }),
    taskStarted("current-turn", 200),
    turnContext("gpt-5.6-terra"),
    tokenCount(100_000, 80_000, 5_000)
  ];
  const task = summarizeActiveTaskLines(lines, 260_000);

  assert.equal(task.id, "current-turn");
  assert.equal(task.projectName, "sample-project");
  assert.equal(task.startedAt, 200);
  assert.equal(task.elapsedSeconds, 60);
  assert.equal(task.estimatedCostUsd, 0.116);
  assert.deepEqual(task.models.map(model => model.model), ["gpt-5.6-terra"]);
  assert.doesNotMatch(JSON.stringify(task), /private prompt|must never escape|Users|Desktop/);
});

test("does not report a task after its matching completion event", () => {
  const lines = [
    taskStarted("finished-turn", 100),
    sessionMeta("C:\\work\\finished"),
    turnContext("gpt-5.6-sol"),
    tokenCount(1_000, 800, 10),
    taskComplete("finished-turn", 100, 120)
  ];
  assert.equal(summarizeActiveTaskLines(lines, 200_000), null);
});

test("classifies an explicit interrupted turn as manual and freezes its duration", () => {
  const summary = summarizeTaskWindow([
    sessionMeta("C:\\work\\stopped-project"),
    taskStarted("stopped-turn", 100),
    turnContext("gpt-5.6-sol"),
    tokenCount(1_000, 800, 10),
    turnAborted("stopped-turn", 100, 125)
  ], 300_000);

  assert.equal(summary.task, null);
  assert.equal(summary.terminalTask.outcome, "manual-interrupted");
  assert.equal(summary.terminalTask.elapsedSeconds, 25);
  assert.equal(summary.terminalTask.endedAt, 125);
  assert.equal(summary.terminalTask.projectName, "stopped-project");
});

test("legacy completion replay without duration evidence does not inflate elapsed statistics", () => {
  const summary = summarizeTaskWindow([
    taskStarted("legacy-replayed-turn", 100),
    JSON.stringify({
      timestamp: new Date(200_000 * 1_000).toISOString(),
      type: "event_msg",
      payload: {
        type: "task_complete",
        turn_id: "legacy-replayed-turn"
      }
    })
  ], 200_001_000);

  assert.equal(summary.task, null);
  assert.equal(summary.terminalTask.outcome, "completed");
  assert.equal(summary.terminalTask.durationKnown, false);
  assert.equal(summary.terminalTask.elapsedSeconds, 0);
});

test("reads multiple active rollout files as concurrent tasks", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-active-tasks-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const day = path.join(root, "2026", "07", "27");
  fs.mkdirSync(day, { recursive: true });
  fs.writeFileSync(path.join(day, "rollout-one.jsonl"), [
    sessionMeta("C:\\work\\alpha"),
    taskStarted("turn-one", 1_000),
    turnContext("gpt-5.6-sol"),
    tokenCount(20_000, 15_000, 500)
  ].join("\n"));
  fs.writeFileSync(path.join(day, "rollout-two.jsonl"), [
    sessionMeta("C:\\work\\beta"),
    taskStarted("turn-two", 1_010),
    turnContext("gpt-5.6-terra"),
    tokenCount(10_000, 7_000, 250)
  ].join("\n"));
  fs.writeFileSync(path.join(day, "rollout-finished.jsonl"), [
    taskStarted("turn-three", 1_020),
    sessionMeta("C:\\work\\gamma"),
    taskComplete("turn-three", 1_020, 1_030)
  ].join("\n"));

  const now = Date.now();
  const result = await new CodexActiveTaskReader({ sessionsRoot: root }).read(now);
  assert.equal(result.available, true);
  assert.equal(result.count, 2);
  assert.deepEqual(result.tasks.map(task => task.projectName).sort(), ["alpha", "beta"]);
});

test("freezes an unclosed task after its rollout stops producing evidence", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-stale-task-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const now = Date.now();
  const startedAt = Math.floor((now - ACTIVE_INACTIVITY_TIMEOUT_MS - 60_000) / 1_000);
  const filePath = path.join(root, "rollout-stale.jsonl");
  fs.writeFileSync(filePath, [
    sessionMeta("C:\\work\\stale-project"),
    taskStarted("stale-turn", startedAt),
    turnContext("gpt-5.6-sol"),
    tokenCount(1_000, 800, 10)
  ].join("\n"));
  const staleMtime = new Date(now - ACTIVE_INACTIVITY_TIMEOUT_MS - 1_000);
  fs.utimesSync(filePath, staleMtime, staleMtime);

  const result = await new CodexActiveTaskReader({ sessionsRoot: root }).read(now);

  assert.equal(result.tasks.length, 0);
  assert.equal(result.terminalTasks.length, 1);
  assert.equal(result.terminalTasks[0].outcome, "abnormal-interrupted");
  assert.equal(result.terminalTasks[0].elapsedSeconds, 0);
});

test("retains only the project basename when session metadata is outside the active tail", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-active-project-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const day = path.join(root, "2026", "07", "27");
  fs.mkdirSync(day, { recursive: true });
  fs.writeFileSync(path.join(day, "rollout-large.jsonl"), [
    sessionMeta("C:\\Users\\person\\Desktop\\private-project"),
    " ".repeat(300 * 1024),
    taskStarted("turn-current", 1_000),
    turnContext("gpt-5.6-sol"),
    tokenCount(2_000, 1_500, 100)
  ].join("\n"));

  const result = await new CodexActiveTaskReader({ sessionsRoot: root }).read(Date.now());
  assert.equal(result.count, 1);
  assert.equal(result.tasks[0].projectName, "private-project");
  assert.doesNotMatch(JSON.stringify(result), /Users|Desktop|person/);
});

test("normalizes active-task snapshots without exposing full workspace paths", () => {
  assert.equal(normalizeProjectName("C:\\Users\\person\\Desktop\\project-name"), "project-name");
  const normalized = normalizeActiveTaskResult({
    available: true,
    tasks: [{
      id: "turn-one",
      projectName: "C:\\private\\full-path",
      startedAt: 100,
      estimatedCostUsd: 1,
      models: []
    }],
    observedAt: 200_000
  }, 200_000);

  assert.equal(normalized.tasks[0].projectName, "full-path");
  assert.doesNotMatch(JSON.stringify(normalized), /private/);
});

test("recovers completed and interrupted aggregate statistics from live and archived sessions", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-task-history-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sessionsRoot = path.join(root, "sessions");
  const archivedRoot = path.join(root, "archived_sessions");
  fs.mkdirSync(sessionsRoot, { recursive: true });
  fs.mkdirSync(archivedRoot, { recursive: true });
  const nowSeconds = Math.floor(Date.now() / 1_000);

  fs.writeFileSync(path.join(sessionsRoot, "completed.jsonl"), [
    taskStarted("done", nowSeconds - 80),
    turnContext("gpt-5.6-sol"),
    tokenCount(10_000, 8_000, 200),
    taskComplete("done", nowSeconds - 80, nowSeconds - 50)
  ].join("\n"));
  fs.writeFileSync(path.join(sessionsRoot, "manual.jsonl"), [
    taskStarted("manual", nowSeconds - 45),
    turnAborted("manual", nowSeconds - 45, nowSeconds - 30)
  ].join("\n"));
  fs.writeFileSync(path.join(archivedRoot, "abnormal.jsonl"), [
    taskStarted("abnormal", nowSeconds - 20)
  ].join("\n"));

  const reader = new CodexActiveTaskReader({
    sessionsRoot,
    archivedSessionsRoot: archivedRoot,
    historyCacheMs: 0
  });
  const result = await reader.read(Date.now());

  assert.equal(result.tasks.length, 0);
  assert.equal(result.history.totalTaskCount, 3);
  assert.equal(result.history.timedTaskCount, 3);
  assert.equal(result.history.completedTaskCount, 1);
  assert.equal(result.history.manualInterruptedTaskCount, 1);
  assert.equal(result.history.abnormalInterruptedTaskCount, 1);
  assert.ok(result.history.totalElapsedSeconds >= 45);
  assert.ok(result.history.totalEstimatedCostUsd > 0);
  assert.ok(result.terminalTasks.some(task => (
    task.id === "manual" && task.outcome === "manual-interrupted"
  )));
  assert.ok(result.terminalTasks.some(task => (
    task.id === "abnormal" && task.outcome === "abnormal-interrupted"
  )));
});

test("builds cumulative task statistics across bounded history batches", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-task-index-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sessionsRoot = path.join(root, "sessions");
  fs.mkdirSync(sessionsRoot, { recursive: true });
  const nowSeconds = Math.floor(Date.now() / 1_000);
  const paths = [];
  for (let index = 1; index <= 3; index += 1) {
    const filePath = path.join(sessionsRoot, `rollout-task-${index}.jsonl`);
    fs.writeFileSync(filePath, [
      taskStarted(`task-${index}`, nowSeconds - index * 20),
      taskComplete(`task-${index}`, nowSeconds - index * 20, nowSeconds - index * 10)
    ].join("\n"));
    paths.push(filePath);
  }
  const maxHistoryTotalBytes = Math.max(
    ...paths.map(filePath => fs.statSync(filePath).size)
  );
  const reader = new CodexActiveTaskReader({
    sessionsRoot,
    historyCacheMs: 0,
    maxHistoryTotalBytes
  });

  const first = await reader.read(Date.now(), null);
  const second = await reader.read(Date.now() + 1, first.history);
  const third = await reader.read(Date.now() + 2, second.history);

  assert.equal(first.history.indexComplete, false);
  assert.equal(first.history.rolloutIndex.length, 1);
  assert.equal(second.history.rolloutIndex.length, 2);
  assert.equal(third.history.rolloutIndex.length, 3);
  assert.equal(third.history.indexComplete, true);
  assert.equal(third.history.totalTaskCount, 3);
  assert.equal(third.history.completedTaskCount, 3);

  fs.rmSync(paths[0]);
  const afterDelete = await reader.read(Date.now() + 3, third.history);
  assert.equal(afterDelete.history.totalTaskCount, 3);
  assert.equal(afterDelete.history.rolloutIndex.length, 3);
});
