const os = require("node:os");
const path = require("node:path");

const GOAL_STATUSES = new Set(["active", "paused", "blocked", "usage_limited", "budget_limited", "complete"]);
function readGoalContexts(codexRoot = path.join(os.homedir(), ".codex")) {
  let db;
  try {
    const { DatabaseSync } = require("node:sqlite");
    db = new DatabaseSync(path.join(codexRoot, "goals_1.sqlite"), { readOnly: true, timeout: 50 });
    // Deliberately omit objective, conversation text and identity/account data.
    const rows = db.prepare("SELECT thread_id, status, token_budget, tokens_used, time_used_seconds, updated_at_ms FROM thread_goals ORDER BY updated_at_ms DESC LIMIT 256").all();
    return new Map(rows.filter(row => GOAL_STATUSES.has(row.status)).map(row => [row.thread_id, {
      goalStatus: row.status,
      goalTokenBudget: Number.isFinite(row.token_budget) && row.token_budget > 0 ? row.token_budget : null,
      goalTokensUsed: Math.max(0, Number(row.tokens_used) || 0),
      goalUpdatedAtMs: Number.isSafeInteger(row.updated_at_ms) && row.updated_at_ms > 0 ? row.updated_at_ms : null,
      goalTimeUsedSeconds: Number.isFinite(row.time_used_seconds) ? Math.max(0, row.time_used_seconds) : null
    }]));
  } catch { return new Map(); }
  finally { db?.close(); }
}

function normalizeTaskContext(value = {}) {
  return {
    taskKind: value.taskKind === "subagent" ? "subagent" : value.goalStatus ? "goal" : "task",
    goalStatus: GOAL_STATUSES.has(value.goalStatus) ? value.goalStatus : null,
    goalTokenBudget: Number.isFinite(value.goalTokenBudget) && value.goalTokenBudget > 0 ? value.goalTokenBudget : null,
    goalTokensUsed: Number.isFinite(value.goalTokensUsed) ? Math.max(0, value.goalTokensUsed) : 0,
    goalTimeUsedSeconds: Number.isFinite(value.goalTimeUsedSeconds) ? Math.max(0, value.goalTimeUsedSeconds) : null,
    goalUpdatedAtMs: Number.isSafeInteger(value.goalUpdatedAtMs) && value.goalUpdatedAtMs > 0 ? value.goalUpdatedAtMs : null,
    parentThreadId: typeof value.parentThreadId === "string" && /^[a-zA-Z0-9._:-]{1,128}$/.test(value.parentThreadId) ? value.parentThreadId : null
  };
}
module.exports = { readGoalContexts, normalizeTaskContext };
