const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  CodexCostUsageReader,
  calculateUsageCost,
  normalizeCodexCostUsageResult,
  reconcileCostSnapshots,
  summarizeRolloutLines
} = require("../src/codex-cost-usage");

function turnContext(model) {
  return JSON.stringify({ type: "turn_context", payload: { model } });
}

function tokenCount({
  input,
  cached,
  cacheWrite = 0,
  output,
  totalInput = input,
  totalCached = cached,
  totalOutput = output
}) {
  return JSON.stringify({
    type: "event_msg",
    payload: {
      type: "token_count",
      info: {
        total_token_usage: {
          input_tokens: totalInput,
          cached_input_tokens: totalCached,
          cache_write_input_tokens: cacheWrite,
          output_tokens: totalOutput,
          reasoning_output_tokens: 0,
          total_tokens: totalInput + totalOutput
        },
        last_token_usage: {
          input_tokens: input,
          cached_input_tokens: cached,
          cache_write_input_tokens: cacheWrite,
          output_tokens: output,
          reasoning_output_tokens: 0,
          total_tokens: input + output
        }
      }
    }
  });
}

test("aggregates only model context and token-count records without exposing other content", () => {
  const duplicate = tokenCount({
    input: 1_000_000,
    cached: 800_000,
    output: 10_000
  });
  const result = summarizeRolloutLines([
    {
      lines: [
        JSON.stringify({ type: "response_item", payload: { prompt: "must never escape" } }),
        turnContext("gpt-5.6-sol"),
        duplicate,
        duplicate,
        turnContext("private-model"),
        tokenCount({
          input: 50_000,
          cached: 10_000,
          output: 2_000,
          totalInput: 1_050_000,
          totalCached: 810_000,
          totalOutput: 12_000
        })
      ]
    }
  ], 123);

  assert.equal(result.models.length, 2);
  assert.equal(result.models[0].model, "gpt-5.6-sol");
  assert.equal(result.models[0].inputTokens, 1_000_000);
  assert.equal(result.models[0].cachedInputTokens, 800_000);
  assert.equal(result.models[0].outputTokens, 10_000);
  assert.equal(result.models[0].cacheHitRate, 80);
  assert.equal(result.models[1].model, "private-model");
  assert.equal(result.models[1].estimatedCostUsd, null);
  assert.equal(result.hasUnpricedModels, true);
  assert.equal(result.duplicateEvents, 1);
  assert.doesNotMatch(JSON.stringify(result), /must never escape/);
});

test("de-duplicates replayed counters within one rollout but not across distinct rollouts", () => {
  const sameCounters = tokenCount({
    input: 1_000_000,
    cached: 800_000,
    output: 10_000
  });
  const result = summarizeRolloutLines([
    { lines: [turnContext("gpt-5.6-sol"), sameCounters, sameCounters] },
    { lines: [turnContext("gpt-5.6-sol"), sameCounters] }
  ], 123);

  assert.equal(result.models[0].requestCount, 2);
  assert.equal(result.models[0].inputTokens, 2_000_000);
  assert.equal(result.duplicateEvents, 1);
});

test("de-duplicates replayed Token counters across turn contexts in one rollout", () => {
  const sameCounters = tokenCount({
    input: 1_000_000,
    cached: 800_000,
    output: 10_000
  });
  const result = summarizeRolloutLines([{
    lines: [
      turnContext("gpt-5.6-sol"),
      sameCounters,
      sameCounters,
      turnContext("gpt-5.6-sol"),
      sameCounters
    ]
  }], 123);

  assert.equal(result.models[0].requestCount, 1);
  assert.equal(result.models[0].inputTokens, 1_000_000);
  assert.equal(result.duplicateEvents, 2);
});

test("keeps equal per-call usage when cumulative counters differ", () => {
  const result = summarizeRolloutLines([{
    lines: [
      turnContext("gpt-5.6-sol"),
      tokenCount({
        input: 1_000_000,
        cached: 800_000,
        output: 10_000,
        totalInput: 1_000_000,
        totalCached: 800_000,
        totalOutput: 10_000
      }),
      turnContext("gpt-5.6-sol"),
      tokenCount({
        input: 1_000_000,
        cached: 800_000,
        output: 10_000,
        totalInput: 2_000_000,
        totalCached: 1_600_000,
        totalOutput: 20_000
      })
    ]
  }], 123);

  assert.equal(result.models[0].requestCount, 2);
  assert.equal(result.models[0].inputTokens, 2_000_000);
  assert.equal(result.duplicateEvents, 0);
});

test("excludes Token events without direct model context from model totals", () => {
  const result = summarizeRolloutLines([{
    lines: [
      tokenCount({ input: 2_000_000, cached: 1_500_000, output: 20_000 }),
      turnContext("gpt-5.6-sol"),
      tokenCount({
        input: 1_000_000,
        cached: 800_000,
        output: 10_000,
        totalInput: 3_000_000,
        totalCached: 2_300_000,
        totalOutput: 30_000
      })
    ]
  }], 123);

  assert.equal(result.models.length, 1);
  assert.equal(result.models[0].model, "gpt-5.6-sol");
  assert.equal(result.models[0].inputTokens, 1_000_000);
  assert.equal(result.hasUnattributedUsage, true);
  assert.equal(result.unattributedRequestCount, 1);
  assert.equal(result.unattributedInputTokens, 2_000_000);
});

test("prices cached, uncached, cache-write, output, and long-context tokens", () => {
  const regular = calculateUsageCost("gpt-5.6-sol", {
    inputTokens: 1_000_000,
    cachedInputTokens: 800_000,
    cacheWriteInputTokens: 100_000,
    outputTokens: 10_000
  });
  assert.equal(regular.isLongContext, true);
  assert.equal(regular.cost, 2.74);

  const short = calculateUsageCost("gpt-5.6-terra", {
    inputTokens: 100_000,
    cachedInputTokens: 80_000,
    outputTokens: 5_000
  });
  assert.equal(short.isLongContext, false);
  assert.equal(short.cost, 0.116);
  const latest = calculateUsageCost("gpt-6-astra-2026-09-03", {
    inputTokens: 100_000,
    cachedInputTokens: 80_000,
    cacheWriteInputTokens: 10_000,
    outputTokens: 5_000
  });
  assert.equal(latest.isLongContext, false);
  assert.equal(latest.cost, 0.555);
  assert.equal(calculateUsageCost("private-vendor-model", {
    inputTokens: 100,
    outputTokens: 20
  }), null);
});

test("prices every current and historical native Codex model and dated snapshot", () => {
  const pricedModels = [
    "codex-mini-latest",
    "gpt-5",
    "gpt-5-codex",
    "gpt-5-codex-mini",
    "gpt-5.0-codex-mini",
    "gpt-5.1",
    "gpt-5.1-codex",
    "gpt-5.1-codex-max",
    "gpt-5.1-codex-mini",
    "gpt-5.2",
    "gpt-5.2-codex",
    "gpt-5.3-codex",
    "codex-auto-review",
    "gpt-5.4",
    "gpt-5.4-mini",
    "gpt-5.5",
    "gpt-5.5-cyber",
    "gpt-5.6",
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-5.6-luna",
    "gpt-6-astra",
    "gpt-6-sol",
    "gpt-6-luna",
    "gpt-6-astra-2026-09-03",
    "gpt-5-2025-08-07",
    "gpt-5.4-2026-03-05",
    "gpt-5.4-mini-2026-03-17",
    "gpt-5.5-2026-04-23"
  ];

  for (const model of pricedModels) {
    const result = calculateUsageCost(model, {
      inputTokens: 1_000,
      cachedInputTokens: 100,
      outputTokens: 100
    });
    assert.ok(result, `${model} should have a price`);
    assert.ok(result.cost > 0, `${model} should produce a positive cost`);
  }

  assert.equal(calculateUsageCost("gpt-5.3-codex-spark", {
    inputTokens: 1_000,
    outputTokens: 100
  }), null);
});

test("prices GPT-6 Sol/Luna and GPT Reserve at the Luna-equivalent rate", () => {
  const usage = { inputTokens: 100_000, cachedInputTokens: 50_000, outputTokens: 10_000 };
  assert.equal(calculateUsageCost("gpt-6-sol", usage).cost, 0.21);
  assert.equal(calculateUsageCost("gpt-6-luna", usage).cost, 0.0105);
  assert.equal(calculateUsageCost("gptreverse", usage).cost,
    calculateUsageCost("gpt-5.6-luna", usage).cost);
});

test("matches decorated Codex++ third-party model names and counts exclusive cache tokens", () => {
  const result = summarizeRolloutLines([{ lines: [
    turnContext("router/z-ai/glm-5.3-flash-free"),
    tokenCount({ input: 100, cached: 900, output: 50 }),
    turnContext("openrouter/qwen-qwen3.8-max-free"),
    tokenCount({ input: 200, cached: 800, output: 40 }),
    turnContext("vendor-deepseek-v4-pro-preview"),
    tokenCount({ input: 300, cached: 700, output: 30 }),
    turnContext("proxy/minimax-m2.7-highspeed-latest"),
    tokenCount({ input: 400, cached: 600, output: 20 }),
    turnContext("gateway/moonshot-kimi-k3-turbo"),
    tokenCount({ input: 500, cached: 500, output: 10 })
  ] }]);

  assert.deepEqual(
    result.models.map(model => model.model).sort(),
    [
      "openrouter/qwen-qwen3.8-max-free",
      "proxy/minimax-m2.7-highspeed-latest",
      "router/z-ai/glm-5.3-flash-free",
      "gateway/moonshot-kimi-k3-turbo",
      "vendor-deepseek-v4-pro-preview"
    ].sort()
  );
  assert.ok(result.models.every(model => model.priced));
  assert.ok(result.models.every(model => model.inputTokens === 1_000));
  assert.equal(result.hasUnpricedModels, false);
});

test("official account calibration does not discard Codex++ third-party usage", () => {
  const openAiModel = {
    model: "gpt-5.6-sol",
    inputTokens: 1_000,
    cachedInputTokens: 800,
    outputTokens: 10,
    requestCount: 1,
    estimatedCostUsd: 0.0024
  };
  const glmModel = {
    model: "z-ai/glm-5.3-free",
    inputTokens: 1_000,
    cachedInputTokens: 900,
    outputTokens: 20,
    requestCount: 1,
    estimatedCostUsd: 0.000067
  };
  const raw = {
    scanned: true,
    schemaVersion: 6,
    pricingDate: "2026-09-27",
    models: [openAiModel, glmModel],
    dailyUsage: [{ date: "2026-09-01", models: [openAiModel, glmModel] }],
    observedAt: 1_000
  };
  const normalized = normalizeCodexCostUsageResult(raw, {}, Date.now(), {
    lifetimeTokens: 500,
    dailyUsageBuckets: [{ startDate: "2026-09-01", tokens: 500 }]
  });
  const openAi = normalized.models.find(model => model.model === "gpt-5.6-sol");
  const glm = normalized.models.find(model => model.model === "z-ai/glm-5.3-free");

  assert.equal(openAi.inputTokens, 500);
  assert.equal(glm.inputTokens, 1_000);
  assert.equal(normalized.calibratedInputTokens, 1_500);
  assert.equal(normalized.replayExcludedInputTokens, 500);
});

test("retains the last normalized local cost snapshot after a scan failure", () => {
  const live = normalizeCodexCostUsageResult({
    scanned: true,
    pricingDate: "2026-09-27",
    estimatedCostUsd: 1,
    models: [{
      model: "gpt-5.6-sol",
      inputTokens: 100_000,
      cachedInputTokens: 50_000,
      cacheWriteInputTokens: 0,
      outputTokens: 1_000,
      reasoningOutputTokens: 200,
      requestCount: 2,
      longContextRequests: 0,
      estimatedCostUsd: 0.305
    }],
    dailyUsage: [],
    filesScanned: 2,
    observedAt: 100
  }, {}, 100);

  assert.equal(live.available, true);
  assert.equal(live.cached, false);
  assert.equal(live.persistence.tokenCostSnapshot.models[0].model, "gpt-5.6-sol");

  const cached = normalizeCodexCostUsageResult(null, {
    tokenCostSnapshot: live.persistence.tokenCostSnapshot
  }, 200);
  assert.equal(cached.available, true);
  assert.equal(cached.cached, true);
  assert.equal(cached.models[0].estimatedCostUsd, 0.305);
});

test("reuses a recent persisted scan instead of repeatedly walking large rollout files", async () => {
  const reader = new CodexCostUsageReader({
    sessionsRoot: "Z:\\path-that-must-not-be-read",
    cacheMs: 15 * 60 * 1000
  });
  const restored = await reader.read(1_000_000, {
    schemaVersion: 6,
    pricingDate: "2026-09-27",
    estimatedCostUsd: 0.305,
    models: [{
      model: "gpt-5.6-sol",
      inputTokens: 100_000,
      cachedInputTokens: 50_000,
      outputTokens: 1_000,
      estimatedCostUsd: 0.305
    }],
    dailyUsage: [],
    filesScanned: 2,
    indexComplete: true,
    observedAt: 999_000
  });
  assert.equal(restored.scanned, true);
  assert.equal(restored.models[0].model, "gpt-5.6-sol");
});

test("keeps archived rollout usage in the cumulative API-equivalent estimate", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-cost-archive-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sessionsRoot = path.join(root, "sessions");
  const archivedSessionsRoot = path.join(root, "archived_sessions");
  fs.mkdirSync(sessionsRoot, { recursive: true });
  fs.mkdirSync(archivedSessionsRoot, { recursive: true });

  const activePath = path.join(
    sessionsRoot,
    "rollout-2026-07-30T10-00-00-active.jsonl"
  );
  const archivedPath = path.join(
    archivedSessionsRoot,
    "rollout-2026-07-29T10-00-00-archived.jsonl"
  );
  fs.writeFileSync(activePath, [
    turnContext("gpt-5.6-sol"),
    tokenCount({ input: 1_000_000, cached: 800_000, output: 10_000 })
  ].join("\n"));
  fs.writeFileSync(archivedPath, [
    turnContext("gpt-5.5"),
    tokenCount({ input: 2_000_000, cached: 1_500_000, output: 20_000 })
  ].join("\n"));

  const result = await new CodexCostUsageReader({
    sessionsRoot,
    archivedSessionsRoot,
    cacheMs: 0
  }).read(1_000, null);

  assert.equal(result.filesScanned, 2);
  assert.deepEqual(
    result.models.map(model => model.model).sort(),
    ["gpt-5.5", "gpt-5.6-sol"]
  );
});

test("moving a rollout into the archive does not lower its recorded cost", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-cost-move-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sessionsRoot = path.join(root, "sessions");
  const archivedSessionsRoot = path.join(root, "archived_sessions");
  fs.mkdirSync(sessionsRoot, { recursive: true });
  fs.mkdirSync(archivedSessionsRoot, { recursive: true });

  const filename = "rollout-2026-07-30T10-00-00-move.jsonl";
  const activePath = path.join(sessionsRoot, filename);
  fs.writeFileSync(activePath, [
    turnContext("gpt-5.5"),
    tokenCount({ input: 2_000_000, cached: 1_500_000, output: 20_000 })
  ].join("\n"));

  const reader = new CodexCostUsageReader({
    sessionsRoot,
    archivedSessionsRoot,
    cacheMs: 0
  });
  const before = await reader.read(1_000, null);
  fs.renameSync(activePath, path.join(archivedSessionsRoot, filename));
  const after = await reader.read(2_000, null);

  assert.equal(after.filesScanned, before.filesScanned);
  assert.equal(after.estimatedCostUsd, before.estimatedCostUsd);
  assert.deepEqual(after.models, before.models);
});

test("de-duplicates rollout copies and prefers the more complete readable copy", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-cost-dedupe-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sessionsRoot = path.join(root, "sessions");
  const archivedSessionsRoot = path.join(root, "archived_sessions");
  fs.mkdirSync(sessionsRoot, { recursive: true });
  fs.mkdirSync(archivedSessionsRoot, { recursive: true });

  const filename = "rollout-2026-07-30T10-00-00-duplicate.jsonl";
  const archivedContents = [
    turnContext("gpt-5.6-sol"),
    tokenCount({ input: 1_000_000, cached: 800_000, output: 10_000 })
  ].join("\n");
  const activeContents = [
    archivedContents,
    tokenCount({
      input: 200_000,
      cached: 100_000,
      output: 5_000,
      totalInput: 1_200_000,
      totalCached: 900_000,
      totalOutput: 15_000
    })
  ].join("\n");
  fs.writeFileSync(path.join(sessionsRoot, filename), activeContents);
  fs.writeFileSync(path.join(archivedSessionsRoot, filename), archivedContents);

  const result = await new CodexCostUsageReader({
    sessionsRoot,
    archivedSessionsRoot,
    cacheMs: 0
  }).read(1_000, null);

  assert.equal(result.filesScanned, 1);
  assert.equal(result.models[0].requestCount, 2);
  assert.equal(result.models[0].inputTokens, 1_200_000);
});

test("builds a persistent rollout index in bounded batches without lowering prior totals", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-cost-index-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sessionsRoot = path.join(root, "sessions");
  fs.mkdirSync(sessionsRoot, { recursive: true });

  const paths = [];
  for (let index = 1; index <= 3; index += 1) {
    const filePath = path.join(
      sessionsRoot,
      `rollout-2026-08-15T00-00-0${index}-index.jsonl`
    );
    fs.writeFileSync(filePath, [
      turnContext("gpt-5.6-sol"),
      tokenCount({
        input: index * 1_000_000,
        cached: index * 800_000,
        output: index * 10_000
      })
    ].join("\n"));
    paths.push(filePath);
  }
  const maxTotalBytes = Math.max(...paths.map(filePath => fs.statSync(filePath).size));
  const reader = new CodexCostUsageReader({
    sessionsRoot,
    cacheMs: 0,
    maxTotalBytes
  });

  const first = await reader.read(1_000, null);
  const second = await reader.read(2_000, first);
  const third = await reader.read(3_000, second);

  assert.equal(first.indexComplete, false);
  assert.equal(first.rolloutIndex.length, 1);
  assert.equal(second.rolloutIndex.length, 2);
  assert.ok(second.estimatedCostUsd >= first.estimatedCostUsd);
  assert.equal(third.indexComplete, true);
  assert.equal(third.rolloutIndex.length, 3);
  assert.ok(third.estimatedCostUsd >= second.estimatedCostUsd);

  fs.rmSync(paths[0]);
  const afterDelete = await reader.read(4_000, third);
  assert.equal(afterDelete.rolloutIndex.length, 3);
  assert.equal(afterDelete.estimatedCostUsd, third.estimatedCostUsd);
});

test("rebuilds an old aggregate instead of keeping it as a permanent floor", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-cost-floor-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sessionsRoot = path.join(root, "sessions");
  fs.mkdirSync(sessionsRoot, { recursive: true });
  fs.writeFileSync(path.join(sessionsRoot, "rollout-new.jsonl"), [
    turnContext("gpt-5.6-sol"),
    tokenCount({ input: 100_000, cached: 50_000, output: 1_000 })
  ].join("\n"));
  const previous = {
    pricingDate: "2026-09-27",
    estimatedCostUsd: 100,
    models: [{
      model: "gpt-5.6-sol",
      inputTokens: 10_000_000,
      cachedInputTokens: 5_000_000,
      outputTokens: 1_000_000,
      estimatedCostUsd: 100
    }],
    filesScanned: 20,
    observedAt: 900
  };
  const raw = await new CodexCostUsageReader({
    sessionsRoot,
    cacheMs: 0
  }).read(1_000, previous);
  const normalized = normalizeCodexCostUsageResult(raw, { tokenCostSnapshot: previous }, 1_000);

  assert.equal(raw.estimatedCostUsd, 0.24);
  assert.equal(raw.schemaVersion, 6);
  assert.equal(normalized.estimatedCostUsd, 0.24);
  assert.equal(normalized.rolloutIndex, undefined);
  assert.equal(normalized.persistence.tokenCostSnapshot.rolloutIndex.length, 1);
  assert.equal(
    normalized.persistence.tokenCostSnapshot.models.some(model => model.model === "unknown"),
    false
  );
});

test("does not merge incompatible archived aggregates into the current ledger", () => {
  const oldSnapshot = {
    schemaVersion: 2,
    models: [{
      model: "unknown",
      inputTokens: 200_000_000,
      cachedInputTokens: 190_000_000,
      outputTokens: 2_000_000,
      requestCount: 2_000
    }],
    observedAt: 900
  };
  const currentSnapshot = {
    schemaVersion: 6,
    pricingDate: "2026-09-27",
    models: [{
      model: "gpt-5.6-sol",
      inputTokens: 100_000,
      cachedInputTokens: 50_000,
      outputTokens: 1_000,
      estimatedCostUsd: 0.305
    }],
    dailyUsage: [{
      date: "2026-08-12",
      models: [{
        model: "gpt-5.6-sol",
        inputTokens: 100_000,
        cachedInputTokens: 50_000,
        outputTokens: 1_000,
        estimatedCostUsd: 0.305
      }]
    }],
    rolloutIndex: [{
      id: "a".repeat(64),
      fingerprint: "b".repeat(64),
      size: 1_000,
      models: [{
        model: "gpt-5.6-sol",
        inputTokens: 100_000,
        cachedInputTokens: 50_000,
        outputTokens: 1_000,
        estimatedCostUsd: 0.305
      }],
      dailyUsage: [{
        date: "2026-08-12",
        models: [{
          model: "gpt-5.6-sol",
          inputTokens: 100_000,
          cachedInputTokens: 50_000,
          outputTokens: 1_000,
          estimatedCostUsd: 0.305
        }]
      }],
      observedAt: 1_000
    }],
    indexComplete: true,
    observedAt: 1_000
  };

  const reconciled = reconcileCostSnapshots([oldSnapshot, currentSnapshot]);
  assert.equal(reconciled.schemaVersion, 6);
  assert.equal(reconciled.models.length, 1);
  assert.equal(reconciled.models[0].model, "gpt-5.6-sol");
  assert.equal(reconciled.estimatedCostUsd, 0.305);
  assert.equal(reconciled.hasUnattributedUsage, false);
});

test("caps replay-inflated daily model usage to the official Token ledger", () => {
  const model = {
    model: "gpt-5.6-sol",
    inputTokens: 200_000,
    cachedInputTokens: 160_000,
    outputTokens: 2_000,
    requestCount: 20,
    estimatedCostUsd: 0.5
  };
  const result = normalizeCodexCostUsageResult({
    scanned: true,
    schemaVersion: 6,
    pricingDate: "2026-09-27",
    models: [model],
    dailyUsage: [{
      date: "2026-08-12",
      models: [model]
    }],
    observedAt: 1_000
  }, {}, 1_000, {
    lifetimeTokens: 100_000,
    dailyUsageBuckets: [{ startDate: "2026-08-12", tokens: 100_000 }]
  });

  assert.equal(result.calibratedToOfficialUsage, true);
  assert.equal(result.models[0].inputTokens, 100_000);
  assert.equal(result.models[0].cachedInputTokens, 80_000);
  assert.equal(result.models[0].requestCount, 10);
  assert.equal(result.estimatedCostUsd, 0.25);
  assert.equal(result.replayExcludedInputTokens, 100_000);
  assert.equal(result.officialUnmappedInputTokens, 0);
  assert.equal(result.persistence.tokenCostSnapshot.models[0].inputTokens, 200_000);
});

test("does not invent model usage when the official Token ledger is larger", () => {
  const model = {
    model: "gpt-5.6-sol",
    inputTokens: 100_000,
    cachedInputTokens: 80_000,
    outputTokens: 1_000,
    requestCount: 10,
    estimatedCostUsd: 0.25
  };
  const result = normalizeCodexCostUsageResult({
    scanned: true,
    schemaVersion: 6,
    models: [model],
    dailyUsage: [{ date: "2026-08-12", models: [model] }],
    observedAt: 1_000
  }, {}, 1_000, {
    lifetimeTokens: 150_000,
    dailyUsageBuckets: [{ startDate: "2026-08-12", tokens: 150_000 }]
  });

  assert.equal(result.models[0].inputTokens, 100_000);
  assert.equal(result.replayExcludedInputTokens, 0);
  assert.equal(result.officialUnmappedInputTokens, 50_000);
});
