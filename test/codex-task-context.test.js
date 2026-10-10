const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { readGoalContexts, normalizeTaskContext } = require("../src/codex-task-context");

test("goal context reads only status and budget counters, omitting objectives", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "goal-context-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const db = new DatabaseSync(path.join(root, "goals_1.sqlite"));
  db.exec("CREATE TABLE thread_goals(thread_id TEXT, status TEXT, token_budget INTEGER, tokens_used INTEGER, time_used_seconds INTEGER, updated_at_ms INTEGER, objective TEXT)");
  db.prepare("INSERT INTO thread_goals VALUES (?, ?, ?, ?, ?, ?, ?)").run("thread-one", "active", 10000, 1200, 10, 100, "private objective");
  db.close();
  const contexts = readGoalContexts(root);
  assert.equal(contexts.get("thread-one").goalStatus, "active");
  assert.equal(contexts.get("thread-one").goalTokenBudget, 10000);
  assert.doesNotMatch(JSON.stringify([...contexts]), /objective|private/);
  assert.equal(normalizeTaskContext({ ...contexts.get("thread-one"), taskKind: "subagent" }).taskKind, "subagent");
  assert.equal(normalizeTaskContext({ parentThreadId: "<unsafe>" }).parentThreadId, null);
  assert.equal(readGoalContexts(path.join(root, "missing")).size, 0);
});
