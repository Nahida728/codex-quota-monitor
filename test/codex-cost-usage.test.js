const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CodexCostUsageReader,
  calculateUsageCost,
  normalizeCodexCostUsageResult,
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

test("prices cached, uncached, cache-write, output, and long-context tokens", () => {
  const regular = calculateUsageCost("gpt-5.6-sol", {
    inputTokens: 1_000_000,
    cachedInputTokens: 800_000,
    cacheWriteInputTokens: 100_000,
    outputTokens: 10_000
  });
  assert.equal(regular.isLongContext, true);
  assert.equal(regular.cost, 3.5);

  const short = calculateUsageCost("gpt-5.6-terra", {
    inputTokens: 100_000,
    cachedInputTokens: 80_000,
    outputTokens: 5_000
  });
  assert.equal(short.isLongContext, false);
  assert.equal(short.cost, 0.145);
  assert.equal(calculateUsageCost("deepseek-v4-pro", {
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

test("retains the last normalized local cost snapshot after a scan failure", () => {
  const live = normalizeCodexCostUsageResult({
    scanned: true,
    pricingDate: "2026-07-26",
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
    pricingDate: "2026-07-26",
    estimatedCostUsd: 0.305,
    models: [{
      model: "gpt-5.6-sol",
      inputTokens: 100_000,
      cachedInputTokens: 50_000,
      outputTokens: 1_000,
      estimatedCostUsd: 0.305
    }],
    filesScanned: 2,
    observedAt: 999_000
  });
  assert.equal(restored.scanned, true);
  assert.equal(restored.models[0].model, "gpt-5.6-sol");
});
