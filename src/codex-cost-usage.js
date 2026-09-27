const fs = require("node:fs");
const fsp = require("node:fs/promises");
const crypto = require("node:crypto");
const os = require("node:os");
const path = require("node:path");
const readline = require("node:readline");

const MAX_ROLLOUT_FILES = 1_000;
const MAX_ROLLOUT_FILE_BYTES = 512 * 1024 * 1024;
const MAX_ROLLOUT_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
const SCAN_CACHE_MS = 15 * 60 * 1_000;
const COST_SNAPSHOT_SCHEMA_VERSION = 6;
const MAX_PERSISTED_ROLLOUTS = 1_000;
const PRICING_DATE = "2026-09-27";
const LONG_CONTEXT_THRESHOLD = 272_000;

// Standard API text-token prices in USD per one million tokens.
// Unknown slugs are deliberately left unpriced; recognized third-party models
// are resolved through the bounded rules below.
const MODEL_PRICING = Object.freeze({
  "codex-mini-latest": {
    input: 1.5,
    cachedInput: 0.375,
    cacheWrite: 1.5,
    output: 6
  },
  "gpt-5": {
    input: 1.25,
    cachedInput: 0.125,
    cacheWrite: 1.25,
    output: 10
  },
  "gpt-5-codex": {
    input: 1.25,
    cachedInput: 0.125,
    cacheWrite: 1.25,
    output: 10
  },
  "gpt-5-codex-mini": {
    input: 0.25,
    cachedInput: 0.025,
    cacheWrite: 0.25,
    output: 2
  },
  "gpt-5.1": {
    input: 1.25,
    cachedInput: 0.125,
    cacheWrite: 1.25,
    output: 10
  },
  "gpt-5.1-codex": {
    input: 1.25,
    cachedInput: 0.125,
    cacheWrite: 1.25,
    output: 10
  },
  "gpt-5.1-codex-max": {
    input: 1.25,
    cachedInput: 0.125,
    cacheWrite: 1.25,
    output: 10
  },
  "gpt-5.1-codex-mini": {
    input: 0.25,
    cachedInput: 0.025,
    cacheWrite: 0.25,
    output: 2
  },
  "gpt-5.2": {
    input: 1.75,
    cachedInput: 0.175,
    cacheWrite: 1.75,
    output: 14
  },
  "gpt-5.2-codex": {
    input: 1.75,
    cachedInput: 0.175,
    cacheWrite: 1.75,
    output: 14
  },
  "gpt-5.3-codex": {
    input: 1.75,
    cachedInput: 0.175,
    cacheWrite: 1.75,
    output: 14
  },
  "gpt-5.4": {
    input: 2.5,
    cachedInput: 0.25,
    cacheWrite: 2.5,
    output: 15,
    longContext: true
  },
  "gpt-5.4-mini": {
    input: 0.75,
    cachedInput: 0.075,
    cacheWrite: 0.75,
    output: 4.5
  },
  "gpt-5.5": {
    input: 5,
    cachedInput: 0.5,
    cacheWrite: 5,
    output: 30,
    longContext: true
  },
  // GPT-5.5 Cyber's public Codex rate card is 4x GPT-5.5 for every
  // token class, so this is the corresponding standard-API equivalent.
  "gpt-5.5-cyber": {
    input: 20,
    cachedInput: 2,
    cacheWrite: 20,
    output: 120
  },
  "gpt-5.6-sol": {
    input: 4,
    cachedInput: 0.4,
    cacheWrite: 5,
    output: 20,
    longContext: true
  },
  "gpt-5.6-terra": {
    input: 2,
    cachedInput: 0.2,
    cacheWrite: 2.5,
    output: 12,
    longContext: true
  },
  "gpt-5.6-luna": {
    input: 0.2,
    cachedInput: 0.02,
    cacheWrite: 0.25,
    output: 1.2,
    longContext: true
  },
  "gpt-6-astra": {
    input: 10,
    cachedInput: 1,
    cacheWrite: 12.5,
    output: 50,
    longContext: true
  },
  "gpt-6-sol": {
    input: 2,
    cachedInput: 0.2,
    cacheWrite: 2.5,
    output: 10,
    longContext: true
  },
  "gpt-6-luna": {
    input: 0.1,
    cachedInput: 0.01,
    cacheWrite: 0.125,
    output: 0.5,
    longContext: true
  },
  "gpt-reserve": {
    input: 0.2,
    cachedInput: 0.02,
    cacheWrite: 0.25,
    output: 1.2,
    longContext: true
  },
  "deepseek-v4-pro": {
    input: 0.435,
    cachedInput: 0.003625,
    cacheWrite: 0.435,
    output: 0.87
  },
  "deepseek-v4-flash": {
    input: 0.14,
    cachedInput: 0.0028,
    cacheWrite: 0.14,
    output: 0.28
  },
  "deepseek-reasoner": {
    input: 0.55,
    cachedInput: 0.14,
    cacheWrite: 0.55,
    output: 2.19
  },
  "deepseek-chat": {
    input: 0.27,
    cachedInput: 0.07,
    cacheWrite: 0.27,
    output: 1.1
  },
  "glm-5.3": {
    input: 1.4,
    cachedInput: 0.26,
    cacheWrite: 1.4,
    output: 4.4
  },
  "glm-5.3-flash": {
    input: 0.15,
    cachedInput: 0.03,
    cacheWrite: 0.15,
    output: 0.5
  },
  "glm-5.2": {
    input: 1.4,
    cachedInput: 0.26,
    cacheWrite: 1.4,
    output: 4.4
  },
  "qwen3.8-max": {
    input: 1.65,
    cachedInput: 0.206,
    cacheWrite: 2.063,
    output: 4.951
  },
  "minimax-m3": {
    input: 0.6,
    cachedInput: 0.12,
    cacheWrite: 0.6,
    output: 2.4
  },
  "minimax-m2.7": {
    input: 0.3,
    cachedInput: 0.06,
    cacheWrite: 0.375,
    output: 1.2
  },
  "minimax-m2.7-highspeed": {
    input: 0.6,
    cachedInput: 0.06,
    cacheWrite: 0.375,
    output: 2.4
  },
  "minimax-m2.5": {
    input: 0.3,
    cachedInput: 0.03,
    cacheWrite: 0.375,
    output: 1.2
  },
  "minimax-m2.5-highspeed": {
    input: 0.6,
    cachedInput: 0.03,
    cacheWrite: 0.375,
    output: 2.4
  },
  "kimi-k3": {
    input: 3,
    cachedInput: 3,
    cacheWrite: 3,
    output: 15
  },
  "kimi-k2.7-code": {
    input: 0.95,
    cachedInput: 0.95,
    cacheWrite: 0.95,
    output: 4
  },
  "kimi-k2.6": {
    input: 0.8939,
    cachedInput: 0.8939,
    cacheWrite: 0.8939,
    output: 3.7131
  },
  "kimi-k2.5": {
    input: 0.574,
    cachedInput: 0.574,
    cacheWrite: 0.574,
    output: 3.011
  }
});

// Codex++ gateways commonly add provider names, routing tiers, or availability
// suffixes. Match a bounded family/version token inside those decorated slugs,
// with the most specific variants first.
const THIRD_PARTY_MODEL_RULES = Object.freeze([
  [/^(?:.*[/_.:-])?deepseek[-_.:/]*v?4[-_.:/]*pro(?:$|[-_.:/])/, "deepseek-v4-pro"],
  [/^(?:.*[/_.:-])?deepseek[-_.:/]*v?4[-_.:/]*flash(?:$|[-_.:/])/, "deepseek-v4-flash"],
  [/^(?:.*[/_.:-])?deepseek[-_.:/]*(?:r1|reasoner)(?:$|[-_.:/])/, "deepseek-reasoner"],
  [/^(?:.*[/_.:-])?deepseek[-_.:/]*(?:v?3(?:\.\d+)?|chat)(?:$|[-_.:/])/, "deepseek-chat"],
  [/^(?:.*[/_.:-])?(?:z-ai[-_.:/]*)?glm[-_.:/]*5\.3[-_.:/]*flash(?:$|[-_.:/])/, "glm-5.3-flash"],
  [/^(?:.*[/_.:-])?(?:z-ai[-_.:/]*)?glm[-_.:/]*5\.3(?:$|[-_.:/])/, "glm-5.3"],
  [/^(?:.*[/_.:-])?(?:z-ai[-_.:/]*)?glm[-_.:/]*5\.2(?:$|[-_.:/])/, "glm-5.2"],
  [/^(?:.*[/_.:-])?qwen(?:[-_.:/]*qwen)?[-_.:/]*3\.8[-_.:/]*max(?:$|[-_.:/])/, "qwen3.8-max"],
  [/^(?:.*[/_.:-])?minimax[-_.:/]*m?2\.7[-_.:/]*highspeed(?:$|[-_.:/])/, "minimax-m2.7-highspeed"],
  [/^(?:.*[/_.:-])?minimax[-_.:/]*m?2\.7(?:$|[-_.:/])/, "minimax-m2.7"],
  [/^(?:.*[/_.:-])?minimax[-_.:/]*m?2\.5[-_.:/]*highspeed(?:$|[-_.:/])/, "minimax-m2.5-highspeed"],
  [/^(?:.*[/_.:-])?minimax[-_.:/]*m?2\.5(?:$|[-_.:/])/, "minimax-m2.5"],
  [/^(?:.*[/_.:-])?minimax[-_.:/]*m?3(?:$|[-_.:/])/, "minimax-m3"],
  [/^(?:.*[/_.:-])?(?:moonshot[-_.:/]*)?kimi[-_.:/]*k?2\.7[-_.:/]*code(?:$|[-_.:/])/, "kimi-k2.7-code"],
  [/^(?:.*[/_.:-])?(?:moonshot[-_.:/]*)?kimi[-_.:/]*k?2\.6(?:$|[-_.:/])/, "kimi-k2.6"],
  [/^(?:.*[/_.:-])?(?:moonshot[-_.:/]*)?kimi[-_.:/]*k?2\.5(?:$|[-_.:/])/, "kimi-k2.5"],
  [/^(?:.*[/_.:-])?(?:moonshot[-_.:/]*)?kimi[-_.:/]*k?3(?:$|[-_.:/])/, "kimi-k3"]
]);

const MODEL_ALIASES = Object.freeze({
  "gptreverse": "gpt-reserve",
  "gptreserve": "gpt-reserve",
  "codex-auto-review": "gpt-5.3-codex",
  "gpt-5.0": "gpt-5",
  "gpt-5.0-codex": "gpt-5-codex",
  "gpt-5.0-codex-mini": "gpt-5-codex-mini",
  "gpt-5.6": "gpt-5.6-sol"
});

const SNAPSHOT_MODEL_PATTERN = /-\d{4}-\d{2}-\d{2}$/;

function normalizeCount(value) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value));
}

function safeAdd(left, right) {
  return Math.min(Number.MAX_SAFE_INTEGER, normalizeCount(left) + normalizeCount(right));
}

function normalizeModelName(value) {
  if (typeof value !== "string") return "unknown";
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > 128 || !/^[a-z0-9._:/-]+$/.test(normalized)) {
    return "unknown";
  }
  return normalized;
}

function canonicalModelName(value) {
  const model = normalizeModelName(value);
  const aliased = MODEL_ALIASES[model] || model;
  if (MODEL_PRICING[aliased]) return aliased;
  const thirdParty = THIRD_PARTY_MODEL_RULES.find(([pattern]) => pattern.test(aliased));
  if (thirdParty) return thirdParty[1];
  if (!SNAPSHOT_MODEL_PATTERN.test(aliased)) return aliased;
  const base = aliased.replace(SNAPSHOT_MODEL_PATTERN, "");
  return MODEL_ALIASES[base] || base;
}

function isThirdPartyModel(value) {
  return THIRD_PARTY_MODEL_RULES.some(([pattern]) => pattern.test(normalizeModelName(value)));
}

function getModelPricing(value) {
  return MODEL_PRICING[canonicalModelName(value)] || null;
}

function normalizeUsage(value, cachedInputIsExclusive = false) {
  const reportedInputTokens = normalizeCount(value?.input_tokens ?? value?.inputTokens);
  const reportedCachedInputTokens = normalizeCount(
    value?.cached_input_tokens ?? value?.cachedInputTokens
  );
  const inputTokens = cachedInputIsExclusive
    ? safeAdd(reportedInputTokens, reportedCachedInputTokens)
    : reportedInputTokens;
  const cachedInputTokens = Math.min(inputTokens, reportedCachedInputTokens);
  const cacheWriteInputTokens = Math.min(
    Math.max(0, inputTokens - cachedInputTokens),
    normalizeCount(value?.cache_write_input_tokens ?? value?.cacheWriteInputTokens)
  );
  return {
    inputTokens,
    cachedInputTokens,
    cacheWriteInputTokens,
    outputTokens: normalizeCount(value?.output_tokens ?? value?.outputTokens),
    reasoningOutputTokens: normalizeCount(
      value?.reasoning_output_tokens ?? value?.reasoningOutputTokens
    )
  };
}

function calculateUsageCost(model, value) {
  const pricing = getModelPricing(model);
  if (!pricing) return null;
  const usage = normalizeUsage(
    value,
    isThirdPartyModel(model) && Object.hasOwn(value || {}, "input_tokens")
  );
  const uncachedInputTokens = Math.max(
    0,
    usage.inputTokens - usage.cachedInputTokens - usage.cacheWriteInputTokens
  );
  const isLongContext = pricing.longContext && usage.inputTokens > LONG_CONTEXT_THRESHOLD;
  const inputMultiplier = isLongContext ? 2 : 1;
  const outputMultiplier = isLongContext ? 1.5 : 1;
  const cost = (
    uncachedInputTokens * pricing.input * inputMultiplier +
    usage.cachedInputTokens * pricing.cachedInput * inputMultiplier +
    usage.cacheWriteInputTokens * pricing.cacheWrite * inputMultiplier +
    usage.outputTokens * pricing.output * outputMultiplier
  ) / 1_000_000;
  return {
    cost,
    isLongContext,
    pricing
  };
}

function usageSignature(info) {
  const total = info?.total_token_usage;
  const last = info?.last_token_usage;
  if (!total || !last) return null;
  const keys = [
    "input_tokens",
    "cached_input_tokens",
    "cache_write_input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
    "total_tokens"
  ];
  return keys.flatMap(key => [normalizeCount(total[key]), normalizeCount(last[key])]).join(":");
}

function normalizedUsageDay(value) {
  if (typeof value !== "string") return null;
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const timestamp = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === day
    ? day
    : null;
}

function createUnattributedUsage() {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
    requestCount: 0
  };
}

function createAccumulator() {
  return {
    activeModel: "unknown",
    seenUsage: new Set(),
    models: new Map(),
    unattributedUsage: createUnattributedUsage(),
    dailyUsage: new Map(),
    invalidLines: 0,
    duplicateEvents: 0
  };
}

function getDailyUsage(accumulator, day) {
  if (!day) return null;
  const existing = accumulator.dailyUsage.get(day);
  if (existing) return existing;
  const created = {
    date: day,
    models: new Map(),
    unattributedUsage: createUnattributedUsage()
  };
  accumulator.dailyUsage.set(day, created);
  return created;
}

function addUnattributedToTarget(target, usage) {
  target.inputTokens = safeAdd(target.inputTokens, usage.inputTokens);
  target.cachedInputTokens = safeAdd(target.cachedInputTokens, usage.cachedInputTokens);
  target.cacheWriteInputTokens = safeAdd(target.cacheWriteInputTokens, usage.cacheWriteInputTokens);
  target.outputTokens = safeAdd(target.outputTokens, usage.outputTokens);
  target.reasoningOutputTokens = safeAdd(
    target.reasoningOutputTokens,
    usage.reasoningOutputTokens
  );
  target.requestCount = safeAdd(target.requestCount, 1);
}

function addUnattributedUsage(accumulator, rawUsage, day = null) {
  const usage = normalizeUsage(rawUsage);
  if (!usage.inputTokens && !usage.outputTokens && !usage.cacheWriteInputTokens) return;
  addUnattributedToTarget(accumulator.unattributedUsage, usage);
  const daily = getDailyUsage(accumulator, day);
  if (daily) addUnattributedToTarget(daily.unattributedUsage, usage);
}

function addUsageToModels(models, modelName, usage) {
  const entry = models.get(modelName) || {
    model: modelName,
    inputTokens: 0,
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
    requestCount: 0,
    longContextRequests: 0,
    estimatedCostUsd: 0,
    priced: Boolean(getModelPricing(modelName))
  };
  entry.inputTokens = safeAdd(entry.inputTokens, usage.inputTokens);
  entry.cachedInputTokens = safeAdd(entry.cachedInputTokens, usage.cachedInputTokens);
  entry.cacheWriteInputTokens = safeAdd(
    entry.cacheWriteInputTokens,
    usage.cacheWriteInputTokens
  );
  entry.outputTokens = safeAdd(entry.outputTokens, usage.outputTokens);
  entry.reasoningOutputTokens = safeAdd(
    entry.reasoningOutputTokens,
    usage.reasoningOutputTokens
  );
  entry.requestCount = safeAdd(entry.requestCount, 1);
  const cost = calculateUsageCost(modelName, usage);
  if (cost) {
    entry.estimatedCostUsd += cost.cost;
    if (cost.isLongContext) entry.longContextRequests += 1;
  }
  models.set(modelName, entry);
}

function addUsage(accumulator, model, rawUsage, day = null) {
  const usage = normalizeUsage(rawUsage, isThirdPartyModel(model));
  if (!usage.inputTokens && !usage.outputTokens && !usage.cacheWriteInputTokens) return;
  const modelName = normalizeModelName(model);
  addUsageToModels(accumulator.models, modelName, usage);
  const daily = getDailyUsage(accumulator, day);
  if (daily) addUsageToModels(daily.models, modelName, usage);
}

function consumeRolloutLine(accumulator, line) {
  if (typeof line !== "string" || !line) return;

  if (line.includes('"type":"turn_context"')) {
    try {
      const record = JSON.parse(line);
      if (record?.type === "turn_context") {
        accumulator.activeModel = normalizeModelName(record?.payload?.model);
      }
    } catch {
      accumulator.invalidLines += 1;
    }
    return;
  }

  if (!line.includes('"type":"event_msg"') || !line.includes('"type":"token_count"')) {
    return;
  }

  try {
    const record = JSON.parse(line);
    if (record?.type !== "event_msg" || record?.payload?.type !== "token_count") return;
    const info = record?.payload?.info;
    const signature = usageSignature(info);
    if (signature && accumulator.seenUsage.has(signature)) {
      accumulator.duplicateEvents += 1;
      return;
    }
    if (signature) accumulator.seenUsage.add(signature);
    const day = normalizedUsageDay(record?.timestamp);
    if (accumulator.activeModel === "unknown") {
      addUnattributedUsage(accumulator, info?.last_token_usage, day);
    } else {
      addUsage(accumulator, accumulator.activeModel, info?.last_token_usage, day);
    }
  } catch {
    accumulator.invalidLines += 1;
  }
}

function finalizeModels(models) {
  return [...models.values()].map(entry => {
    const pricing = getModelPricing(entry.model);
    const cacheHitRate = entry.inputTokens
      ? entry.cachedInputTokens / entry.inputTokens * 100
      : 0;
    return {
      ...entry,
      estimatedCostUsd: pricing ? Number(entry.estimatedCostUsd.toFixed(6)) : null,
      cacheHitRate: Number(cacheHitRate.toFixed(2)),
      pricing: pricing ? {
        input: pricing.input,
        cachedInput: pricing.cachedInput,
        cacheWrite: pricing.cacheWrite,
        output: pricing.output
      } : null
    };
  }).sort((left, right) => {
    if (left.priced !== right.priced) return left.priced ? -1 : 1;
    const costDifference = (right.estimatedCostUsd || 0) - (left.estimatedCostUsd || 0);
    if (costDifference) return costDifference;
    return (right.inputTokens + right.outputTokens) - (left.inputTokens + left.outputTokens);
  });
}

function prefixedUnattributedUsage(value) {
  return {
    unattributedInputTokens: normalizeCount(value?.inputTokens),
    unattributedCachedInputTokens: normalizeCount(value?.cachedInputTokens),
    unattributedCacheWriteInputTokens: normalizeCount(value?.cacheWriteInputTokens),
    unattributedOutputTokens: normalizeCount(value?.outputTokens),
    unattributedReasoningOutputTokens: normalizeCount(value?.reasoningOutputTokens),
    unattributedRequestCount: normalizeCount(value?.requestCount)
  };
}

function finalizeAccumulator(accumulator, metadata = {}) {
  const models = finalizeModels(accumulator.models);
  const dailyUsage = [...accumulator.dailyUsage.values()]
    .map(row => ({
      date: row.date,
      models: finalizeModels(row.models),
      ...prefixedUnattributedUsage(row.unattributedUsage)
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
  const estimatedCostUsd = models.reduce(
    (total, model) => total + (model.estimatedCostUsd || 0),
    0
  );
  return {
    scanned: true,
    pricingDate: PRICING_DATE,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
    hasUnpricedModels: models.some(model => !model.priced),
    hasUnattributedUsage: accumulator.unattributedUsage.requestCount > 0,
    unattributedInputTokens: accumulator.unattributedUsage.inputTokens,
    unattributedCachedInputTokens: accumulator.unattributedUsage.cachedInputTokens,
    unattributedCacheWriteInputTokens: accumulator.unattributedUsage.cacheWriteInputTokens,
    unattributedOutputTokens: accumulator.unattributedUsage.outputTokens,
    unattributedReasoningOutputTokens: accumulator.unattributedUsage.reasoningOutputTokens,
    unattributedRequestCount: accumulator.unattributedUsage.requestCount,
    models,
    dailyUsage,
    filesScanned: normalizeCount(metadata.filesScanned),
    truncated: Boolean(metadata.truncated),
    duplicateEvents: normalizeCount(accumulator.duplicateEvents),
    observedAt: normalizeCount(metadata.observedAt ?? Date.now())
  };
}

function modelEvidence(value) {
  const model = normalizeCostModel(value);
  if (model.priced) return model.estimatedCostUsd || 0;
  return model.inputTokens + model.outputTokens + model.cacheWriteInputTokens;
}

function combineModels(modelCollections, mode = "sum") {
  const combined = new Map();
  for (const models of Array.isArray(modelCollections) ? modelCollections : []) {
    for (const rawModel of Array.isArray(models) ? models : []) {
      const model = normalizeCostModel(rawModel);
      const existing = combined.get(model.model);
      if (mode === "max") {
        if (!existing || modelEvidence(model) > modelEvidence(existing)) {
          combined.set(model.model, model);
        }
        continue;
      }
      const entry = existing || {
        ...model,
        inputTokens: 0,
        cachedInputTokens: 0,
        cacheWriteInputTokens: 0,
        outputTokens: 0,
        reasoningOutputTokens: 0,
        requestCount: 0,
        longContextRequests: 0,
        estimatedCostUsd: model.priced ? 0 : null
      };
      entry.inputTokens = safeAdd(entry.inputTokens, model.inputTokens);
      entry.cachedInputTokens = safeAdd(entry.cachedInputTokens, model.cachedInputTokens);
      entry.cacheWriteInputTokens = safeAdd(
        entry.cacheWriteInputTokens,
        model.cacheWriteInputTokens
      );
      entry.outputTokens = safeAdd(entry.outputTokens, model.outputTokens);
      entry.reasoningOutputTokens = safeAdd(
        entry.reasoningOutputTokens,
        model.reasoningOutputTokens
      );
      entry.requestCount = safeAdd(entry.requestCount, model.requestCount);
      entry.longContextRequests = safeAdd(
        entry.longContextRequests,
        model.longContextRequests
      );
      if (entry.priced) {
        entry.estimatedCostUsd += model.estimatedCostUsd || 0;
      }
      combined.set(model.model, entry);
    }
  }
  return [...combined.values()].map(model => normalizeCostModel({
    ...model,
    estimatedCostUsd: model.priced
      ? Number((model.estimatedCostUsd || 0).toFixed(6))
      : null
  })).sort((left, right) => {
    if (left.priced !== right.priced) return left.priced ? -1 : 1;
    const costDifference = (right.estimatedCostUsd || 0) - (left.estimatedCostUsd || 0);
    if (costDifference) return costDifference;
    return (right.inputTokens + right.outputTokens) - (left.inputTokens + left.outputTokens);
  });
}

function modelsContainAtLeast(candidateModels, floorModels) {
  const candidates = new Map(
    combineModels([candidateModels], "max").map(model => [model.model, model])
  );
  return combineModels([floorModels], "max").every(floor => {
    const candidate = candidates.get(floor.model);
    return candidate && modelEvidence(candidate) >= modelEvidence(floor);
  });
}

function sumUnattributedUsage(values) {
  const total = {
    unattributedInputTokens: 0,
    unattributedCachedInputTokens: 0,
    unattributedCacheWriteInputTokens: 0,
    unattributedOutputTokens: 0,
    unattributedReasoningOutputTokens: 0,
    unattributedRequestCount: 0
  };
  for (const value of Array.isArray(values) ? values : []) {
    for (const key of Object.keys(total)) {
      total[key] = safeAdd(total[key], value?.[key]);
    }
  }
  return total;
}

function summarizeRolloutLines(files, now = Date.now()) {
  const snapshots = [];
  for (const file of Array.isArray(files) ? files : []) {
    const accumulator = createAccumulator();
    for (const line of Array.isArray(file?.lines) ? file.lines : []) {
      consumeRolloutLine(accumulator, line);
    }
    snapshots.push(finalizeAccumulator(accumulator, { observedAt: now }));
  }
  const models = combineModels(snapshots.map(snapshot => snapshot.models));
  const unattributedUsage = sumUnattributedUsage(snapshots);
  return {
    scanned: true,
    pricingDate: PRICING_DATE,
    estimatedCostUsd: Number(models.reduce(
      (total, model) => total + (model.estimatedCostUsd || 0),
      0
    ).toFixed(6)),
    hasUnpricedModels: models.some(model => !model.priced),
    hasUnattributedUsage: unattributedUsage.unattributedRequestCount > 0,
    ...unattributedUsage,
    models,
    filesScanned: Array.isArray(files) ? files.length : 0,
    truncated: false,
    duplicateEvents: snapshots.reduce(
      (total, snapshot) => safeAdd(total, snapshot.duplicateEvents),
      0
    ),
    observedAt: now
  };
}

function rolloutFileIdentity(file) {
  return path.basename(file?.path || file?.relativePath || "").toLowerCase();
}

function persistedRolloutId(file) {
  return crypto
    .createHash("sha256")
    .update(rolloutFileIdentity(file))
    .digest("hex");
}

function rolloutFingerprint(file) {
  return crypto
    .createHash("sha256")
    .update(`${normalizeCount(file?.size)}:${normalizeCount(file?.mtimeMs)}`)
    .digest("hex");
}

function preferMoreCompleteRollout(left, right) {
  if (right.size !== left.size) return right.size > left.size ? right : left;
  if (right.mtimeMs !== left.mtimeMs) return right.mtimeMs > left.mtimeMs ? right : left;
  return right.path.localeCompare(left.path) < 0 ? right : left;
}

async function listRolloutFiles(roots) {
  const found = [];
  async function visit(root, directory) {
    let entries;
    try {
      entries = await fsp.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(root, candidate);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        const stat = await fsp.stat(candidate);
        found.push({
          path: candidate,
          relativePath: path.relative(root, candidate).replaceAll("\\", "/"),
          size: stat.size,
          mtimeMs: Math.floor(stat.mtimeMs)
        });
      }
    }
  }
  for (const root of roots) await visit(root, root);

  const unique = new Map();
  for (const file of found) {
    const identity = rolloutFileIdentity(file);
    const existing = unique.get(identity);
    unique.set(identity, existing ? preferMoreCompleteRollout(existing, file) : file);
  }
  return [...unique.values()].sort((left, right) => (
    rolloutFileIdentity(left).localeCompare(rolloutFileIdentity(right))
  ));
}

function selectBoundedFiles(files, {
  maxFiles = MAX_ROLLOUT_FILES,
  maxFileBytes = MAX_ROLLOUT_FILE_BYTES,
  maxTotalBytes = MAX_ROLLOUT_TOTAL_BYTES
} = {}) {
  let truncated = files.length > maxFiles;
  const candidates = files.slice(-maxFiles);
  const selected = [];
  let totalBytes = 0;
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const file = candidates[index];
    if (file.size > maxFileBytes) {
      truncated = true;
      continue;
    }
    if (totalBytes + file.size > maxTotalBytes) {
      truncated = true;
      continue;
    }
    selected.push(file);
    totalBytes += file.size;
  }
  selected.reverse();
  return { files: selected, truncated, candidates };
}

async function scanRolloutFile(file, observedAt) {
  const accumulator = createAccumulator();
  const stream = fs.createReadStream(file.path, { encoding: "utf8" });
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of lines) consumeRolloutLine(accumulator, line);
  const snapshot = finalizeAccumulator(accumulator, { observedAt });
  return {
    id: persistedRolloutId(file),
    fingerprint: rolloutFingerprint(file),
    size: normalizeCount(file.size),
    models: snapshot.models,
    dailyUsage: snapshot.dailyUsage,
    unattributedInputTokens: snapshot.unattributedInputTokens,
    unattributedCachedInputTokens: snapshot.unattributedCachedInputTokens,
    unattributedCacheWriteInputTokens: snapshot.unattributedCacheWriteInputTokens,
    unattributedOutputTokens: snapshot.unattributedOutputTokens,
    unattributedReasoningOutputTokens: snapshot.unattributedReasoningOutputTokens,
    unattributedRequestCount: snapshot.unattributedRequestCount,
    duplicateEvents: snapshot.duplicateEvents,
    observedAt: normalizeCount(observedAt)
  };
}

function normalizeDailyUsageRows(value) {
  const rows = [];
  for (const rawRow of Array.isArray(value) ? value.slice(0, 400) : []) {
    const date = normalizedUsageDay(rawRow?.date);
    if (!date || !Array.isArray(rawRow?.models)) continue;
    const normalizedModels = rawRow.models.slice(0, 100).map(normalizeCostModel);
    const unknownModels = normalizedModels.filter(model => model.model === "unknown");
    rows.push({
      date,
      models: normalizedModels.filter(model => model.model !== "unknown"),
      ...normalizeUnattributedUsage(rawRow, unknownModels)
    });
  }
  return combineDailyUsage([rows]);
}

function combineDailyUsage(collections) {
  const grouped = new Map();
  for (const rows of Array.isArray(collections) ? collections : []) {
    for (const row of Array.isArray(rows) ? rows : []) {
      const date = normalizedUsageDay(row?.date);
      if (!date) continue;
      const existing = grouped.get(date) || { date, modelCollections: [], values: [] };
      existing.modelCollections.push(row.models);
      existing.values.push(row);
      grouped.set(date, existing);
    }
  }
  return [...grouped.values()].map(group => ({
    date: group.date,
    models: combineModels(group.modelCollections),
    ...sumUnattributedUsage(group.values)
  })).sort((left, right) => left.date.localeCompare(right.date));
}

function normalizeRolloutEntry(value) {
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.id !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.id) ||
    typeof value.fingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.fingerprint) ||
    !Array.isArray(value.models) ||
    !Array.isArray(value.dailyUsage)
  ) return null;
  const normalizedModels = value.models.slice(0, 100).map(normalizeCostModel);
  const unknownModels = normalizedModels.filter(model => model.model === "unknown");
  const unattributedUsage = normalizeUnattributedUsage(value, unknownModels);
  return {
    id: value.id,
    fingerprint: value.fingerprint,
    size: normalizeCount(value.size),
    models: normalizedModels.filter(model => model.model !== "unknown"),
    dailyUsage: normalizeDailyUsageRows(value.dailyUsage),
    ...unattributedUsage,
    duplicateEvents: normalizeCount(value.duplicateEvents),
    observedAt: normalizeCount(value.observedAt)
  };
}

function preferRolloutEntry(existing, candidate) {
  if (!existing) return candidate;
  if (!candidate) return existing;
  if (candidate.fingerprint === existing.fingerprint) {
    return candidate.observedAt >= existing.observedAt ? candidate : existing;
  }
  if (
    candidate.size >= existing.size &&
    modelsContainAtLeast(candidate.models, existing.models)
  ) return candidate;
  return existing;
}

class CodexCostUsageReader {
  constructor({
    sessionsRoot,
    archivedSessionsRoot,
    sessionRoots,
    cacheMs = SCAN_CACHE_MS,
    maxFiles = MAX_ROLLOUT_FILES,
    maxFileBytes = MAX_ROLLOUT_FILE_BYTES,
    maxTotalBytes = MAX_ROLLOUT_TOTAL_BYTES
  } = {}) {
    const codexRoot = path.join(os.homedir(), ".codex");
    const primaryRoot = sessionsRoot || path.join(codexRoot, "sessions");
    const defaultArchivedRoot = sessionsRoot
      ? path.join(path.dirname(primaryRoot), "archived_sessions")
      : path.join(codexRoot, "archived_sessions");
    const configuredRoots = Array.isArray(sessionRoots) && sessionRoots.length
      ? sessionRoots
      : [primaryRoot, archivedSessionsRoot || defaultArchivedRoot];
    this.sessionRoots = [...new Set(
      configuredRoots
        .filter(root => typeof root === "string" && root.trim())
        .map(root => path.resolve(root))
    )];
    this.cacheMs = cacheMs;
    this.maxFiles = Math.max(1, normalizeCount(maxFiles));
    this.maxFileBytes = Math.max(1, normalizeCount(maxFileBytes));
    this.maxTotalBytes = Math.max(1, normalizeCount(maxTotalBytes));
    this.cachedResult = null;
    this.cachedAt = 0;
  }

  async read(now = Date.now(), previousSnapshot = null) {
    if (this.cachedResult && now - this.cachedAt < this.cacheMs) {
      return this.cachedResult;
    }
    if (
      previousSnapshot?.schemaVersion === COST_SNAPSHOT_SCHEMA_VERSION &&
      previousSnapshot?.indexComplete === true &&
      previousSnapshot?.pricingDate === PRICING_DATE &&
      Number.isFinite(previousSnapshot?.observedAt) &&
      now - previousSnapshot.observedAt >= 0 &&
      now - previousSnapshot.observedAt < this.cacheMs
    ) {
      const restored = normalizeCostSnapshot(previousSnapshot);
      if (restored) {
        this.cachedResult = { scanned: true, ...restored };
        this.cachedAt = previousSnapshot.observedAt;
        return this.cachedResult;
      }
    }

    const previous = normalizeCostSnapshot(previousSnapshot);
    const previousEntries = new Map(
      (previous?.rolloutIndex || []).map(entry => [entry.id, entry])
    );
    const inventory = await listRolloutFiles(this.sessionRoots);
    const visibleInventory = inventory.slice(-this.maxFiles);
    const changed = visibleInventory.filter(file => {
      const existing = previousEntries.get(persistedRolloutId(file));
      return !existing || existing.fingerprint !== rolloutFingerprint(file);
    });
    const bounded = selectBoundedFiles(changed, {
      maxFiles: this.maxFiles,
      maxFileBytes: this.maxFileBytes,
      maxTotalBytes: this.maxTotalBytes
    });
    let scanFailed = false;
    for (const file of bounded.files) {
      try {
        const candidate = await scanRolloutFile(file, now);
        const existing = previousEntries.get(candidate.id);
        const accepted = preferRolloutEntry(existing, candidate);
        previousEntries.set(candidate.id, accepted);
        if (accepted !== candidate) scanFailed = true;
      } catch {
        scanFailed = true;
      }
    }

    const rolloutIndex = [...previousEntries.values()].sort((left, right) => (
      left.id.localeCompare(right.id)
    ));
    const indexedModels = combineModels(rolloutIndex.map(entry => entry.models));
    const models = indexedModels;
    const dailyUsage = combineDailyUsage(rolloutIndex.map(entry => entry.dailyUsage));
    const unattributedUsage = sumUnattributedUsage(rolloutIndex);
    const selectedIds = new Set(bounded.files.map(persistedRolloutId));
    const pendingFiles = changed.filter(file => !selectedIds.has(persistedRolloutId(file)));
    const indexComplete = (
      inventory.length <= this.maxFiles &&
      pendingFiles.length === 0 &&
      !scanFailed &&
      visibleInventory.every(file => {
        const entry = previousEntries.get(persistedRolloutId(file));
        return entry?.fingerprint === rolloutFingerprint(file);
      })
    );
    const result = {
      scanned: true,
      schemaVersion: COST_SNAPSHOT_SCHEMA_VERSION,
      pricingDate: PRICING_DATE,
      estimatedCostUsd: Number(models.reduce(
        (total, model) => total + (model.estimatedCostUsd || 0),
        0
      ).toFixed(6)),
      hasUnpricedModels: models.some(model => !model.priced),
      hasUnattributedUsage: unattributedUsage.unattributedRequestCount > 0,
      ...unattributedUsage,
      models,
      dailyUsage,
      filesScanned: rolloutIndex.length,
      truncated: !indexComplete,
      duplicateEvents: rolloutIndex.reduce(
        (total, entry) => safeAdd(total, entry.duplicateEvents),
        0
      ),
      observedAt: normalizeCount(now),
      indexComplete,
      rolloutIndex
    };
    this.cachedResult = result;
    this.cachedAt = indexComplete ? now : 0;
    return result;
  }
}

function normalizeCostModel(value) {
  const model = normalizeModelName(value?.model);
  const inputTokens = normalizeCount(value?.inputTokens);
  const cachedInputTokens = Math.min(inputTokens, normalizeCount(value?.cachedInputTokens));
  const cacheWriteInputTokens = Math.min(
    Math.max(0, inputTokens - cachedInputTokens),
    normalizeCount(value?.cacheWriteInputTokens)
  );
  const outputTokens = normalizeCount(value?.outputTokens);
  const reasoningOutputTokens = normalizeCount(value?.reasoningOutputTokens);
  const pricing = getModelPricing(model);
  const estimatedCostUsd = pricing && Number.isFinite(value?.estimatedCostUsd)
    ? Math.max(0, value.estimatedCostUsd)
    : null;
  return {
    model,
    inputTokens,
    cachedInputTokens,
    cacheWriteInputTokens,
    outputTokens,
    reasoningOutputTokens,
    requestCount: normalizeCount(value?.requestCount),
    longContextRequests: normalizeCount(value?.longContextRequests),
    cacheHitRate: inputTokens ? Number((cachedInputTokens / inputTokens * 100).toFixed(2)) : 0,
    estimatedCostUsd,
    priced: Boolean(pricing),
    pricing: pricing ? {
      input: pricing.input,
      cachedInput: pricing.cachedInput,
      cacheWrite: pricing.cacheWrite,
      output: pricing.output
    } : null
  };
}

function normalizeUnattributedUsage(value, unknownModels = []) {
  const unknown = combineModels([unknownModels]);
  const sumUnknown = key => unknown.reduce(
    (total, model) => safeAdd(total, model[key]),
    0
  );
  return {
    unattributedInputTokens: safeAdd(
      value?.unattributedInputTokens,
      sumUnknown("inputTokens")
    ),
    unattributedCachedInputTokens: safeAdd(
      value?.unattributedCachedInputTokens,
      sumUnknown("cachedInputTokens")
    ),
    unattributedCacheWriteInputTokens: safeAdd(
      value?.unattributedCacheWriteInputTokens,
      sumUnknown("cacheWriteInputTokens")
    ),
    unattributedOutputTokens: safeAdd(
      value?.unattributedOutputTokens,
      sumUnknown("outputTokens")
    ),
    unattributedReasoningOutputTokens: safeAdd(
      value?.unattributedReasoningOutputTokens,
      sumUnknown("reasoningOutputTokens")
    ),
    unattributedRequestCount: safeAdd(
      value?.unattributedRequestCount,
      sumUnknown("requestCount")
    )
  };
}

function normalizeCostSnapshot(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.models)) return null;
  const isCurrentSchema = (
    value.schemaVersion === COST_SNAPSHOT_SCHEMA_VERSION &&
    Array.isArray(value.dailyUsage)
  );
  const normalizedModels = value.models.slice(0, 100).map(normalizeCostModel);
  const unknownModels = normalizedModels.filter(model => model.model === "unknown");
  const models = normalizedModels.filter(model => model.model !== "unknown");
  const rolloutIndex = isCurrentSchema && Array.isArray(value.rolloutIndex)
    ? value.rolloutIndex
      .slice(-MAX_PERSISTED_ROLLOUTS)
      .map(normalizeRolloutEntry)
      .filter(Boolean)
    : [];
  const dailyUsage = isCurrentSchema ? normalizeDailyUsageRows(value.dailyUsage) : [];
  const unattributedUsage = normalizeUnattributedUsage(value, unknownModels);
  return {
    schemaVersion: isCurrentSchema ? COST_SNAPSHOT_SCHEMA_VERSION : 1,
    pricingDate: typeof value.pricingDate === "string" ? value.pricingDate : PRICING_DATE,
    estimatedCostUsd: models.reduce(
      (total, model) => total + (model.estimatedCostUsd || 0),
      0
    ),
    hasUnpricedModels: models.some(model => !model.priced),
    hasUnattributedUsage: unattributedUsage.unattributedRequestCount > 0,
    ...unattributedUsage,
    models,
    dailyUsage,
    filesScanned: normalizeCount(value.filesScanned),
    truncated: Boolean(value.truncated),
    duplicateEvents: normalizeCount(value.duplicateEvents),
    observedAt: normalizeCount(value.observedAt),
    indexComplete: isCurrentSchema && value.indexComplete === true,
    rolloutIndex
  };
}

function publicCostSnapshot(snapshot) {
  if (!snapshot) return null;
  const {
    rolloutIndex,
    dailyUsage,
    indexComplete,
    schemaVersion,
    ...publicSnapshot
  } = snapshot;
  return publicSnapshot;
}

function scaledCostModel(value, factor) {
  const model = normalizeCostModel(value);
  const scaleCount = count => normalizeCount(Math.round(normalizeCount(count) * factor));
  return normalizeCostModel({
    ...model,
    inputTokens: scaleCount(model.inputTokens),
    cachedInputTokens: scaleCount(model.cachedInputTokens),
    cacheWriteInputTokens: scaleCount(model.cacheWriteInputTokens),
    outputTokens: scaleCount(model.outputTokens),
    reasoningOutputTokens: scaleCount(model.reasoningOutputTokens),
    requestCount: scaleCount(model.requestCount),
    longContextRequests: scaleCount(model.longContextRequests),
    estimatedCostUsd: model.priced
      ? Number(((model.estimatedCostUsd || 0) * factor).toFixed(6))
      : null
  });
}

function scaledUnattributedUsage(value, factor) {
  const scale = key => normalizeCount(Math.round(normalizeCount(value?.[key]) * factor));
  return {
    unattributedInputTokens: scale("unattributedInputTokens"),
    unattributedCachedInputTokens: scale("unattributedCachedInputTokens"),
    unattributedCacheWriteInputTokens: scale("unattributedCacheWriteInputTokens"),
    unattributedOutputTokens: scale("unattributedOutputTokens"),
    unattributedReasoningOutputTokens: scale("unattributedReasoningOutputTokens"),
    unattributedRequestCount: scale("unattributedRequestCount")
  };
}

function calibrateCostSnapshot(snapshot, tokenUsage) {
  const officialBuckets = Array.isArray(tokenUsage?.dailyUsageBuckets)
    ? tokenUsage.dailyUsageBuckets
      .map(row => ({
        date: normalizedUsageDay(row?.startDate),
        tokens: normalizeCount(row?.tokens)
      }))
      .filter(row => row.date)
    : [];
  if (!officialBuckets.length || !snapshot.dailyUsage.length) {
    return {
      ...snapshot,
      calibratedToOfficialUsage: false,
      replayExcludedInputTokens: 0,
      officialUnmappedInputTokens: 0
    };
  }

  const officialByDate = new Map(officialBuckets.map(row => [row.date, row.tokens]));
  const calibratedModels = [];
  const calibratedUnattributedRows = [];
  let rawDailyInputTokens = 0;
  let rawOfficialComparableInputTokens = 0;
  let calibratedOfficialComparableInputTokens = 0;
  for (const row of snapshot.dailyUsage) {
    const comparableModels = row.models.filter(model => !isThirdPartyModel(model.model));
    const thirdPartyModels = row.models.filter(model => isThirdPartyModel(model.model));
    const attributedInputTokens = comparableModels.reduce(
      (total, model) => safeAdd(total, model.inputTokens),
      0
    );
    const localInputTokens = safeAdd(attributedInputTokens, row.unattributedInputTokens);
    rawDailyInputTokens = safeAdd(rawDailyInputTokens, localInputTokens);
    const officialTokens = officialByDate.get(row.date) || 0;
    const factor = localInputTokens > 0
      ? Math.min(1, officialTokens / localInputTokens)
      : 0;
    rawOfficialComparableInputTokens = safeAdd(
      rawOfficialComparableInputTokens,
      localInputTokens
    );
    calibratedOfficialComparableInputTokens = safeAdd(
      calibratedOfficialComparableInputTokens,
      Math.round(localInputTokens * factor)
    );
    calibratedModels.push([
      ...comparableModels.map(model => scaledCostModel(model, factor)),
      ...thirdPartyModels
    ]);
    calibratedUnattributedRows.push(scaledUnattributedUsage(row, factor));
  }

  const models = combineModels(calibratedModels).filter(model => (
    model.inputTokens > 0 || model.outputTokens > 0 || model.requestCount > 0
  ));
  const unattributedUsage = sumUnattributedUsage(calibratedUnattributedRows);
  const calibratedInputTokens = safeAdd(
    models.reduce((total, model) => safeAdd(total, model.inputTokens), 0),
    unattributedUsage.unattributedInputTokens
  );
  const rawInputTokens = safeAdd(
    snapshot.models.reduce((total, model) => safeAdd(total, model.inputTokens), 0),
    snapshot.unattributedInputTokens
  );
  const officialLifetimeTokens = normalizeCount(tokenUsage?.lifetimeTokens);
  return {
    ...snapshot,
    estimatedCostUsd: Number(models.reduce(
      (total, model) => total + (model.estimatedCostUsd || 0),
      0
    ).toFixed(6)),
    hasUnpricedModels: models.some(model => !model.priced),
    hasUnattributedUsage: unattributedUsage.unattributedRequestCount > 0,
    ...unattributedUsage,
    models,
    calibratedToOfficialUsage: true,
    rawLocalInputTokens: rawInputTokens,
    calibratedInputTokens,
    replayExcludedInputTokens: Math.max(
      0,
      rawOfficialComparableInputTokens - calibratedOfficialComparableInputTokens
    ),
    officialUnmappedInputTokens: Math.max(
      0,
      officialLifetimeTokens - calibratedOfficialComparableInputTokens
    ),
    rawUndatedInputTokens: Math.max(0, rawInputTokens - rawDailyInputTokens)
  };
}

function reconcileCostSnapshots(values) {
  const normalized = (Array.isArray(values) ? values : [])
    .map(normalizeCostSnapshot)
    .filter(Boolean);
  if (!normalized.length) return null;

  const current = normalized.filter(
    snapshot => snapshot.schemaVersion === COST_SNAPSHOT_SCHEMA_VERSION
  );
  if (!current.length) {
    const newestLegacy = normalized.sort(
      (left, right) => right.observedAt - left.observedAt
    )[0];
    return {
      ...newestLegacy,
      truncated: true,
      indexComplete: false,
      rolloutIndex: []
    };
  }

  const snapshots = current;

  const entries = new Map();
  for (const snapshot of snapshots) {
    for (const entry of snapshot.rolloutIndex) {
      entries.set(entry.id, preferRolloutEntry(entries.get(entry.id), entry));
    }
  }
  const rolloutIndex = [...entries.values()]
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(-MAX_PERSISTED_ROLLOUTS);
  const models = combineModels(rolloutIndex.map(entry => entry.models));
  const dailyUsage = combineDailyUsage(rolloutIndex.map(entry => entry.dailyUsage));
  const unattributedUsage = sumUnattributedUsage(rolloutIndex);
  const newest = snapshots.sort((left, right) => right.observedAt - left.observedAt)[0];
  const newestIndexed = snapshots.find(snapshot => snapshot.rolloutIndex.length > 0);
  const indexComplete = newest.indexComplete === true || newestIndexed?.indexComplete === true;
  return {
    schemaVersion: COST_SNAPSHOT_SCHEMA_VERSION,
    pricingDate: PRICING_DATE,
    estimatedCostUsd: Number(models.reduce(
      (total, model) => total + (model.estimatedCostUsd || 0),
      0
    ).toFixed(6)),
    hasUnpricedModels: models.some(model => !model.priced),
    hasUnattributedUsage: unattributedUsage.unattributedRequestCount > 0,
    ...unattributedUsage,
    models,
    dailyUsage,
    filesScanned: Math.max(
      rolloutIndex.length,
      ...snapshots.map(snapshot => snapshot.filesScanned)
    ),
    truncated: !indexComplete,
    duplicateEvents: rolloutIndex.reduce(
      (total, entry) => safeAdd(total, entry.duplicateEvents),
      0
    ),
    observedAt: newest.observedAt,
    indexComplete,
    rolloutIndex
  };
}

function normalizeCodexCostUsageResult(
  raw,
  previousState = {},
  now = Date.now(),
  tokenUsage = null
) {
  const current = raw?.scanned ? normalizeCostSnapshot(raw) : null;
  if (current) {
    const snapshot = { ...current, observedAt: normalizeCount(raw.observedAt ?? now) };
    const calibrated = calibrateCostSnapshot(snapshot, tokenUsage);
    return {
      available: true,
      cached: false,
      ...publicCostSnapshot(calibrated),
      persistence: { tokenCostSnapshot: snapshot }
    };
  }

  const cached = normalizeCostSnapshot(previousState?.tokenCostSnapshot);
  if (cached) {
    const calibrated = calibrateCostSnapshot(cached, tokenUsage);
    return {
      available: true,
      cached: true,
      ...publicCostSnapshot(calibrated),
      persistence: {}
    };
  }

  return {
    available: false,
    cached: false,
    pricingDate: PRICING_DATE,
    estimatedCostUsd: null,
    hasUnpricedModels: false,
    hasUnattributedUsage: false,
    unattributedInputTokens: 0,
    unattributedCachedInputTokens: 0,
    unattributedCacheWriteInputTokens: 0,
    unattributedOutputTokens: 0,
    unattributedReasoningOutputTokens: 0,
    unattributedRequestCount: 0,
    calibratedToOfficialUsage: false,
    rawLocalInputTokens: 0,
    calibratedInputTokens: 0,
    replayExcludedInputTokens: 0,
    officialUnmappedInputTokens: 0,
    rawUndatedInputTokens: 0,
    models: [],
    filesScanned: 0,
    truncated: false,
    duplicateEvents: 0,
    observedAt: null,
    persistence: {}
  };
}

module.exports = {
  CodexCostUsageReader,
  LONG_CONTEXT_THRESHOLD,
  MODEL_PRICING,
  PRICING_DATE,
  calculateUsageCost,
  normalizeCodexCostUsageResult,
  reconcileCostSnapshots,
  normalizeModelName,
  summarizeRolloutLines
};
