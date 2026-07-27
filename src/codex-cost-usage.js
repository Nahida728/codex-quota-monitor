const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const readline = require("node:readline");

const MAX_ROLLOUT_FILES = 1_000;
const MAX_ROLLOUT_FILE_BYTES = 512 * 1024 * 1024;
const MAX_ROLLOUT_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
const SCAN_CACHE_MS = 15 * 60 * 1_000;
const PRICING_DATE = "2026-07-26";
const LONG_CONTEXT_THRESHOLD = 272_000;

// Standard API text-token prices in USD per one million tokens.
// Unknown and third-party model slugs are deliberately left unpriced.
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
    input: 5,
    cachedInput: 0.5,
    cacheWrite: 6.25,
    output: 30,
    longContext: true
  },
  "gpt-5.6-terra": {
    input: 2.5,
    cachedInput: 0.25,
    cacheWrite: 3.125,
    output: 15,
    longContext: true
  },
  "gpt-5.6-luna": {
    input: 1,
    cachedInput: 0.1,
    cacheWrite: 1.25,
    output: 6,
    longContext: true
  }
});

const MODEL_ALIASES = Object.freeze({
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
  if (!SNAPSHOT_MODEL_PATTERN.test(aliased)) return aliased;
  const base = aliased.replace(SNAPSHOT_MODEL_PATTERN, "");
  return MODEL_ALIASES[base] || base;
}

function getModelPricing(value) {
  return MODEL_PRICING[canonicalModelName(value)] || null;
}

function normalizeUsage(value) {
  const inputTokens = normalizeCount(value?.input_tokens ?? value?.inputTokens);
  const cachedInputTokens = Math.min(
    inputTokens,
    normalizeCount(value?.cached_input_tokens ?? value?.cachedInputTokens)
  );
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
  const usage = normalizeUsage(value);
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

function createAccumulator() {
  return {
    activeModel: "unknown",
    seenUsage: new Set(),
    models: new Map(),
    invalidLines: 0,
    duplicateEvents: 0
  };
}

function addUsage(accumulator, model, rawUsage) {
  const usage = normalizeUsage(rawUsage);
  if (!usage.inputTokens && !usage.outputTokens && !usage.cacheWriteInputTokens) return;
  const modelName = normalizeModelName(model);
  const entry = accumulator.models.get(modelName) || {
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
  accumulator.models.set(modelName, entry);
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
    addUsage(accumulator, accumulator.activeModel, info?.last_token_usage);
  } catch {
    accumulator.invalidLines += 1;
  }
}

function finalizeAccumulator(accumulator, metadata = {}) {
  const models = [...accumulator.models.values()].map(entry => {
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
  const estimatedCostUsd = models.reduce(
    (total, model) => total + (model.estimatedCostUsd || 0),
    0
  );
  return {
    scanned: true,
    pricingDate: PRICING_DATE,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
    hasUnpricedModels: models.some(model => !model.priced),
    models,
    filesScanned: normalizeCount(metadata.filesScanned),
    truncated: Boolean(metadata.truncated),
    duplicateEvents: normalizeCount(accumulator.duplicateEvents),
    observedAt: normalizeCount(metadata.observedAt ?? Date.now())
  };
}

function summarizeRolloutLines(files, now = Date.now()) {
  const accumulator = createAccumulator();
  for (const file of Array.isArray(files) ? files : []) {
    accumulator.activeModel = "unknown";
    for (const line of Array.isArray(file?.lines) ? file.lines : []) {
      consumeRolloutLine(accumulator, line);
    }
  }
  return finalizeAccumulator(accumulator, {
    filesScanned: Array.isArray(files) ? files.length : 0,
    observedAt: now
  });
}

async function listRolloutFiles(root) {
  const found = [];
  async function visit(directory) {
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
        await visit(candidate);
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
  await visit(root);
  return found.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function selectBoundedFiles(files) {
  let truncated = files.length > MAX_ROLLOUT_FILES;
  const candidates = files.slice(-MAX_ROLLOUT_FILES);
  const selected = [];
  let totalBytes = 0;
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const file = candidates[index];
    if (file.size > MAX_ROLLOUT_FILE_BYTES) {
      truncated = true;
      continue;
    }
    if (totalBytes + file.size > MAX_ROLLOUT_TOTAL_BYTES) {
      truncated = true;
      continue;
    }
    selected.push(file);
    totalBytes += file.size;
  }
  selected.reverse();
  return { files: selected, truncated };
}

async function scanRolloutFile(file, accumulator) {
  accumulator.activeModel = "unknown";
  const stream = fs.createReadStream(file.path, { encoding: "utf8" });
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of lines) consumeRolloutLine(accumulator, line);
}

class CodexCostUsageReader {
  constructor({ sessionsRoot, cacheMs = SCAN_CACHE_MS } = {}) {
    this.sessionsRoot = sessionsRoot || path.join(os.homedir(), ".codex", "sessions");
    this.cacheMs = cacheMs;
    this.cachedFingerprint = null;
    this.cachedResult = null;
    this.cachedAt = 0;
  }

  async read(now = Date.now(), previousSnapshot = null) {
    if (this.cachedResult && now - this.cachedAt < this.cacheMs) {
      return this.cachedResult;
    }
    if (
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

    const inventory = await listRolloutFiles(this.sessionsRoot);
    const bounded = selectBoundedFiles(inventory);
    const fingerprint = bounded.files
      .map(file => `${file.relativePath}:${file.size}:${file.mtimeMs}`)
      .join("|");
    if (this.cachedResult && fingerprint === this.cachedFingerprint) {
      this.cachedAt = now;
      return this.cachedResult;
    }

    const accumulator = createAccumulator();
    for (const file of bounded.files) await scanRolloutFile(file, accumulator);
    const result = finalizeAccumulator(accumulator, {
      filesScanned: bounded.files.length,
      truncated: bounded.truncated,
      observedAt: now
    });
    this.cachedFingerprint = fingerprint;
    this.cachedResult = result;
    this.cachedAt = now;
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

function normalizeCostSnapshot(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.models)) return null;
  const models = value.models.slice(0, 100).map(normalizeCostModel);
  return {
    pricingDate: typeof value.pricingDate === "string" ? value.pricingDate : PRICING_DATE,
    estimatedCostUsd: models.reduce(
      (total, model) => total + (model.estimatedCostUsd || 0),
      0
    ),
    hasUnpricedModels: models.some(model => !model.priced),
    models,
    filesScanned: normalizeCount(value.filesScanned),
    truncated: Boolean(value.truncated),
    duplicateEvents: normalizeCount(value.duplicateEvents),
    observedAt: normalizeCount(value.observedAt)
  };
}

function normalizeCodexCostUsageResult(raw, previousState = {}, now = Date.now()) {
  const current = raw?.scanned ? normalizeCostSnapshot(raw) : null;
  if (current) {
    const snapshot = { ...current, observedAt: normalizeCount(raw.observedAt ?? now) };
    return {
      available: true,
      cached: false,
      ...snapshot,
      persistence: { tokenCostSnapshot: snapshot }
    };
  }

  const cached = normalizeCostSnapshot(previousState?.tokenCostSnapshot);
  if (cached) {
    return {
      available: true,
      cached: true,
      ...cached,
      persistence: {}
    };
  }

  return {
    available: false,
    cached: false,
    pricingDate: PRICING_DATE,
    estimatedCostUsd: null,
    hasUnpricedModels: false,
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
  normalizeModelName,
  summarizeRolloutLines
};
