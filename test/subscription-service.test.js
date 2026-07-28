const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  CodexSubscriptionReader,
  extractSubscriptionClaims,
  normalizeSubscriptionDetails
} = require("../src/subscription-service");

function jwt(payload) {
  return [
    Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    "signature"
  ].join(".");
}

test("extracts only normalized subscription metadata from the local signed-in account claim", () => {
  const claims = extractSubscriptionClaims({
    auth_mode: "chatgpt",
    OPENAI_API_KEY: "must-not-escape",
    tokens: {
      access_token: "must-not-escape",
      id_token: jwt({
        email: "private@example.com",
        "https://api.openai.com/auth": {
          chatgpt_account_id: "private-account",
          chatgpt_plan_type: "plus",
          chatgpt_subscription_active_start: "2026-06-27T16:24:43Z",
          chatgpt_subscription_active_until: "2026-07-27T16:24:38Z",
          chatgpt_subscription_last_checked: "2026-06-27T16:35:03Z"
        }
      })
    }
  });

  assert.deepEqual(claims, {
    planType: "plus",
    activeStart: 1782577483,
    activeUntil: 1785169478,
    lastCheckedAt: 1782578103
  });
  assert.equal(JSON.stringify(claims).includes("private"), false);
  assert.equal(JSON.stringify(claims).includes("token"), false);
});

test("projects a stale monthly period only while Codex still reports a paid plan", () => {
  const raw = {
    planType: "plus",
    activeStart: "2026-06-27T16:24:43Z",
    activeUntil: "2026-07-27T16:24:38Z",
    lastCheckedAt: "2026-06-27T16:35:03Z"
  };
  const now = Math.floor(Date.parse("2026-07-29T00:00:00Z") / 1000);

  const current = normalizeSubscriptionDetails(raw, {
    planType: "plus",
    totalWorkDays: 23
  }, now);
  assert.equal(current.planType, "plus");
  assert.equal(current.assistedWorkDays, 23);
  assert.equal(current.expiresAt, Math.floor(Date.parse("2026-08-27T16:24:38Z") / 1000));
  assert.equal(current.renewalAt, current.expiresAt);
  assert.equal(current.projected, true);

  const free = normalizeSubscriptionDetails(raw, {
    planType: "free",
    totalWorkDays: 23
  }, now);
  assert.equal(free.expiresAt, Math.floor(Date.parse("2026-07-27T16:24:38Z") / 1000));
  assert.equal(free.projected, false);
});

test("reads a bounded auth file without returning credentials or unrelated identity fields", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codex-subscription-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const authPath = path.join(directory, "auth.json");
  fs.writeFileSync(authPath, JSON.stringify({
    auth_mode: "chatgpt",
    tokens: {
      id_token: jwt({
        "https://api.openai.com/auth": {
          chatgpt_plan_type: "pro",
          chatgpt_subscription_active_start: "2026-07-01T00:00:00Z",
          chatgpt_subscription_active_until: "2026-08-01T00:00:00Z"
        }
      }),
      refresh_token: "must-not-escape"
    }
  }));

  const result = new CodexSubscriptionReader({ authPath }).read();
  assert.deepEqual(result, {
    planType: "pro",
    activeStart: 1782864000,
    activeUntil: 1785542400,
    lastCheckedAt: null
  });
  assert.equal(JSON.stringify(result).includes("must-not-escape"), false);
});
