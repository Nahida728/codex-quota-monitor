// Only numeric counters and timestamps leave this reader. Interval rates are
// output-token averages between log records, not per-token decoding speeds.
const MAX_SAFE = Number.MAX_SAFE_INTEGER;

function safeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_SAFE
    ? value : null;
}

function normalizeTaskTelemetry(value) {
  if (!value || typeof value !== "object") return null;
  return {
    firstTokenMs: safeNumber(value.firstTokenMs),
    totalTokens: safeNumber(value.totalTokens),
    outputTokens: safeNumber(value.outputTokens),
    cacheHitRate: safeNumber(value.cacheHitRate) !== null && value.cacheHitRate <= 100 ? value.cacheHitRate : null,
    peakTokensPerSecond: safeNumber(value.peakTokensPerSecond),
    minTokensPerSecond: safeNumber(value.minTokensPerSecond),
    averageTokensPerSecond: safeNumber(value.averageTokensPerSecond),
    intervalCount: Math.floor(safeNumber(value.intervalCount) || 0),
    partial: Boolean(value.partial),
    rateMode: "recorded-output-intervals"
  };
}

function summarizeTaskTelemetry(lines, terminal, cost, partial = false) {
  const models = Array.isArray(cost?.models) ? cost.models : [];
  const outputTokens = models.reduce((sum, model) => Math.min(MAX_SAFE, sum + (safeNumber(model.outputTokens) || 0)), 0);
  const totalTokens = models.reduce((sum, model) => Math.min(MAX_SAFE, sum + (safeNumber(model.inputTokens) || 0) + (safeNumber(model.outputTokens) || 0)), 0);
  const inputTokens = models.reduce((sum, model) => Math.min(MAX_SAFE, sum + (safeNumber(model.inputTokens) || 0)), 0);
  const cachedInputTokens = models.reduce((sum, model) => Math.min(MAX_SAFE, sum + Math.min(safeNumber(model.inputTokens) || 0, safeNumber(model.cachedInputTokens) || 0)), 0);
  const firstTokenMs = safeNumber(terminal?.firstTokenMs);
  const durationMs = safeNumber(terminal?.durationMs) ?? (
    Number.isFinite(terminal?.startedAt) && Number.isFinite(terminal?.eventAt)
      ? Math.max(0, terminal.eventAt - terminal.startedAt) * 1000 : null
  );
  let previousAt = Number.isFinite(terminal?.startedAt) ? terminal.startedAt * 1000 : null;
  let previousTotal = null;
  let sampledOutput = 0;
  let countersKnown = false;
  let cacheCountersKnown = true;
  let cacheSampled = false;
  let validIntervals = !partial;
  const rates = [];
  for (const line of Array.isArray(lines) ? lines : []) {
    if (!/"type"\s*:\s*"token_count"/.test(line)) continue;
    let record;
    try { record = JSON.parse(line); } catch { continue; }
    if (record.type !== "event_msg" || record.payload?.type !== "token_count") continue;
    const info = record.payload.info;
    const input = safeNumber(info?.last_token_usage?.input_tokens);
    const cached = safeNumber(info?.last_token_usage?.cached_input_tokens);
    if (input > 0) { cacheSampled = true; cacheCountersKnown &&= cached !== null && cached <= input; }
    const total = safeNumber(info?.total_token_usage?.output_tokens);
    const last = safeNumber(info?.last_token_usage?.output_tokens);
    if (total === null) continue;
    countersKnown = true;
    if (previousTotal !== null && total === previousTotal) continue; // replay/heartbeat
    const output = previousTotal === null ? last : total - previousTotal;
    const at = typeof record.timestamp === "string" ? Date.parse(record.timestamp) : NaN;
    if (output === null || output < 0 || !Number.isFinite(at) || previousAt === null ||
        at <= previousAt || (Number.isFinite(terminal?.eventAt) && at > terminal.eventAt * 1000 + 1000)) {
      validIntervals = false;
    } else {
      sampledOutput += output;
      rates.push(output / ((at - previousAt) / 1000));
    }
    previousTotal = total;
    previousAt = Number.isFinite(at) ? at : null;
  }
  // A missing/reordered counter or an uncovered output segment invalidates the
  // extrema. Whole-turn average can still use complete cost counters + duration.
  validIntervals = validIntervals && sampledOutput === outputTokens;
  return normalizeTaskTelemetry({
    firstTokenMs,
    totalTokens: countersKnown ? totalTokens : null,
    outputTokens: countersKnown ? outputTokens : null,
    cacheHitRate: cacheSampled && cacheCountersKnown && inputTokens > 0 ? cachedInputTokens / inputTokens * 100 : null,
    peakTokensPerSecond: validIntervals && rates.length ? rates.reduce((peak, rate) => Math.max(peak, rate), 0) : null,
    minTokensPerSecond: validIntervals && rates.length ? rates.reduce((minimum, rate) => Math.min(minimum, rate), Infinity) : null,
    averageTokensPerSecond: !partial && countersKnown && durationMs > 0
      ? outputTokens / (durationMs / 1000) : null,
    intervalCount: validIntervals ? rates.length : 0,
    partial
  });
}

module.exports = { normalizeTaskTelemetry, summarizeTaskTelemetry };
