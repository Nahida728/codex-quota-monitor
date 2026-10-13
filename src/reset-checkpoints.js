// Public community announcements are independent of account-local reset evidence.
// Parse inert JSON data only; never execute remote scripts or expose post bodies.
const SOURCE_URL = "https://codexresettracker.com/";
const RADAR_URL = "https://codex-reset.com/";
const CACHE_MS = 60 * 1000;
const MAX_BYTES = 2 * 1024 * 1024;

async function readBoundedText(response, maxBytes = MAX_BYTES) {
  if (!response.ok) throw new Error("SOURCE_UNAVAILABLE");
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error("SOURCE_TOO_LARGE");
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally { await reader.cancel().catch(() => {}); }
}

function normalizeCheckpointEvents(events, now = Date.now()) {
  const unique = new Map();
  for (const event of Array.isArray(events) ? events : []) {
    const at = Number(event?.at);
    const sourceUrl = event?.sourceUrl;
    if (!Number.isFinite(at) || at <= 0 || at > now / 1000 + 300 ||
        !/^https:\/\/x\.com\/thsottiaux\/status\/\d{10,25}$/.test(sourceUrl || "")) continue;
    unique.set(sourceUrl, { at: Math.floor(at), sourceUrl });
  }
  return [...unique.values()].sort((a, b) => a.at - b.at);
}

function parseCheckpointPage(html, now = Date.now()) {
  if (typeof html !== "string" || Buffer.byteLength(html) > MAX_BYTES) throw new Error("INVALID_SOURCE");
  let flight = "";
  for (const match of html.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)) {
    try { const part = JSON.parse(match[1]); if (typeof part[1] === "string") flight += part[1]; } catch {}
  }
  let rows = null;
  let checkedAt = null;
  function visit(value, depth = 0) {
    if (!value || typeof value !== "object" || depth > 40) return;
    if (Array.isArray(value.rows) && Array.isArray(value.events)) rows = value.rows;
    if (typeof value.template === "string" && value.template.startsWith("Last check:")) {
      const stamp = Date.parse(value.utc);
      if (Number.isFinite(stamp) && stamp <= now + 300000) checkedAt = stamp;
    }
    for (const child of Object.values(value)) visit(child, depth + 1);
  }
  for (const line of flight.split("\n")) {
    try { visit(JSON.parse(line.slice(line.indexOf(":") + 1))); } catch {}
  }
  if (!rows || !checkedAt) throw new Error("SOURCE_SCHEMA_CHANGED");
  const events = normalizeCheckpointEvents(rows.filter(row =>
    row?.type === "automatic_reset" && row?.status === "confirmed"
  ).map(row => ({ at: Date.parse(row.at) / 1000, sourceUrl: row.sourceUrl })), now);
  if (!events.length) throw new Error("SOURCE_NO_CONFIRMED_EVENTS");
  return { events, sourceCheckedAt: checkedAt, fetchedAt: now };
}

function checkpointSummary(snapshot, now = Date.now(), cached = false) {
  const events = normalizeCheckpointEvents(snapshot?.events, now);
  const recent = events.filter(event => event.at >= now / 1000 - 183 * 86400);
  const gaps = recent.slice(1).map((event, index) => event.at - recent[index].at)
    .filter(gap => gap > 0).sort((a, b) => a - b);
  const middle = Math.floor(gaps.length / 2);
  const medianSeconds = gaps.length ? (gaps.length % 2 ? gaps[middle] : (gaps[middle - 1] + gaps[middle]) / 2) : null;
  const sourceCheckedAt = Number.isFinite(snapshot?.sourceCheckedAt) && snapshot.sourceCheckedAt > 0 && snapshot.sourceCheckedAt <= now + 300000 ? snapshot.sourceCheckedAt : null;
  const stale = !sourceCheckedAt || now - sourceCheckedAt > 24 * 3600000;
  // The tracker's documented exponential model uses the median wait as its
  // half-life. It is a community trend, never a per-account prediction.
  const probability = hours => gaps.length >= 3 && !stale
    ? Math.round(100 * (1 - Math.exp(-Math.LN2 * hours * 3600 / medianSeconds))) : null;
  const forecast = normalizeForecast(snapshot?.forecast, now);
  const useForecast = forecast && !stale && Number.isFinite(forecast.probability24) && now - forecast.checkedAt <= 24 * 3600000;
  const commitment = forecast?.commitment && now - forecast.checkedAt <= 3600000 &&
    !events.some(event => event.at * 1000 >= forecast.commitment.at) &&
    !(forecast.lastResetAt >= forecast.commitment.at) ? forecast.commitment : null;
  return { available: events.length > 0 || Boolean(useForecast || commitment), observedAt: now, sourceUrl: snapshot?.sourceUrl === RADAR_URL ? RADAR_URL : SOURCE_URL, events,
    latestAt: events.at(-1)?.at || null, sourceCheckedAt,
    fetchedAt: Number.isFinite(snapshot?.fetchedAt) && snapshot.fetchedAt <= now + 300000 ? snapshot.fetchedAt : null, cached, stale,
    sampleCount: gaps.length, medianSeconds, windowDays: 183,
    forecast: forecast || null,
    commitment,
    probability24: useForecast ? forecast.probability24 : probability(24),
    probability48: useForecast ? forecast.probability48 : probability(48),
    probabilityMode: useForecast ? "source-experimental" : "median-history" };
}

function normalizeForecast(value, now) {
  if (!value || !Number.isFinite(value.checkedAt) || value.checkedAt <= 0 || value.checkedAt > now + 300000) return null;
  const historical = Number.isFinite(value.probability24) && Number.isFinite(value.probability48) &&
    value.probability24 >= 0 && value.probability48 <= 100 && value.probability48 >= value.probability24 &&
    Number.isInteger(value.sampleCount) && value.sampleCount >= 3 && value.sampleCount <= 1000;
  const positive = n => Number.isFinite(n) && n >= 0 && n <= 1000 ? n : null;
  const range = v => Number.isFinite(v?.lower) && Number.isFinite(v?.upper) &&
    v.lower >= 0 && v.upper <= 100 && v.upper >= v.lower
    ? { lower: Math.round(v.lower), upper: Math.round(v.upper) } : null;
  return { checkedAt: value.checkedAt, probability24: historical ? value.probability24 : null,
    probability48: historical ? value.probability48 : null, sampleCount: historical ? value.sampleCount : null,
    range24: range(value.range24), range48: range(value.range48),
    medianDays: positive(value.medianDays), meanDays: positive(value.meanDays), longestDays: positive(value.longestDays),
    lastResetAt: Number.isFinite(value.lastResetAt) && value.lastResetAt <= now ? value.lastResetAt : null,
    commitment: normalizeCommitment(value.commitment, now) };
}

function normalizeCommitment(value, now) {
  if (!value || !/^https:\/\/x\.com\/thsottiaux\/status\/\d{10,25}$/.test(value.sourceUrl || "") ||
      !["promise", "dated_commitment"].includes(value.type) || !Number.isFinite(value.probability) ||
      value.probability < 0 || value.probability > 100 || !Number.isFinite(value.at) || value.at <= 0 ||
      value.at > now || now - value.at > 48 * 3600000) return null;
  const window = value.window;
  const validWindow = window && [window.startAt, window.endAt, window.targetAt].every(Number.isFinite) &&
    window.startAt >= value.at - 300000 && window.endAt > window.startAt &&
    window.endAt - value.at <= 72 * 3600000 && ["deadline", "center"].includes(window.targetKind) &&
    window.targetAt >= window.startAt && window.targetAt <= window.endAt &&
    (window.targetKind !== "deadline" || window.targetAt === window.endAt);
  return { type: value.type, sourceUrl: value.sourceUrl, at: value.at, probability: value.probability,
    window: validWindow ? { startAt: window.startAt, endAt: window.endAt,
      targetAt: window.targetAt, targetKind: window.targetKind } : null };
}

function parseForecast(raw, now) {
  const candidate = raw?.official_signal;
  const signal = candidate && !["banked", "credits", "banked_grant"].includes(candidate.kind) &&
    candidate.banked_grant !== true && candidate.reset_kind !== "banked" &&
    (!candidate.scope || candidate.scope === "global") && raw?.latest_alert?.kind !== "banked" ? candidate : null;
  const window = signal?.window;
  const range = value => value ? { lower: value.lower * 100, upper: value.upper * 100 } : null;
  return normalizeForecast({ checkedAt: Date.parse(raw?.updated_at),
    probability24: raw?.probabilities?.rounded_24h, probability48: raw?.probabilities?.rounded_48h,
    sampleCount: raw?.model?.window_intervals, range24: range(raw?.probabilities?.range_24h), range48: range(raw?.probabilities?.range_48h),
    medianDays: raw?.wait_comparison?.median_days, meanDays: raw?.wait_comparison?.mean_days,
    longestDays: raw?.wait_comparison?.longest_days, lastResetAt: Date.parse(raw?.last_reset_at),
    commitment: { type: signal?.signal_type, sourceUrl: signal?.url, at: Date.parse(signal?.at),
      probability: raw?.probabilities?.commitment_floor_percent,
      window: window ? { startAt: Date.parse(window.start_at), endAt: Date.parse(window.end_at),
        targetAt: Date.parse(window.target_at), targetKind: window.target_kind } : null }
  }, now);
}

// The site's current deadline override is an inert JSON object in a versioned
// asset, absent from /api/forecast. Extract just that object; never execute JS.
function parseObservationDeadlines(text) {
  const literal = text.match(/OBSERVATION_DEADLINES\s*=\s*Object\.freeze\((\{[^;]{1,16000}\})\)/)?.[1];
  if (!literal) return {};
  try {
    const value = JSON.parse(literal);
    return Object.fromEntries(Object.entries(value).slice(0, 100).filter(([id, stamp]) =>
      /^\d{10,25}$/.test(id) && typeof stamp === "string" && Number.isFinite(Date.parse(stamp))));
  } catch { return {}; }
}

function parseRadarTimeline(raw, now = Date.now()) {
  const sourceCheckedAt = Date.parse(raw?.updated_at);
  if (!Number.isFinite(sourceCheckedAt) || sourceCheckedAt <= 0 || sourceCheckedAt > now + 300000 || !Array.isArray(raw?.events)) throw new Error("SOURCE_SCHEMA_CHANGED");
  const events = normalizeCheckpointEvents(raw.events.filter(event =>
    event?.type === "reset" && event?.scope === "global" && event?.preview === false &&
    event?.banked_grant !== true && event?.reset_kind !== "banked" &&
    (event.confirmed === true && ["high", "medium"].includes(event.confidence) ||
      event.confirmed !== false && event.confidence === "high" &&
      (event.source === "archive" || event.reset_verification_status === "verified"))
  ).map(event => ({ at: Date.parse(event.effective_at || event.announced_at) / 1000, sourceUrl: event.url })), now);
  if (!events.length) throw new Error("SOURCE_NO_CONFIRMED_EVENTS");
  return { sourceUrl: RADAR_URL, events, sourceCheckedAt, fetchedAt: now };
}

class ResetCheckpointReader {
  constructor({ fetchImpl = globalThis.fetch } = {}) { this.fetch = fetchImpl; this.nextReadAt = 0; this.lastAttemptAt = -Infinity; this.inFlight = null; }
  async read(now = Date.now(), previous = null, { force = false } = {}) {
    if (this.inFlight) return this.inFlight;
    if (now < this.nextReadAt && (!force || now - this.lastAttemptAt < 5000)) return checkpointSummary(this.snapshot || previous, now, true);
    this.lastAttemptAt = now;
    this.inFlight = (async () => {
      try {
        const getText = async url => readBoundedText(await this.fetch(url, {
          redirect: "error", cache: "no-cache", headers: { "Cache-Control": "no-cache" }, signal: AbortSignal.timeout(6000)
        }));
        const results = await Promise.allSettled([
          getText(`${RADAR_URL}api/timeline`).then(text => parseRadarTimeline(JSON.parse(text), now)),
          getText(SOURCE_URL).then(text => ({ ...parseCheckpointPage(text, now), sourceUrl: SOURCE_URL })),
          getText(`${RADAR_URL}api/forecast`).then(text => {
            return parseForecast(JSON.parse(text), now);
          })
        ]);
        const snapshots = results.slice(0, 2).filter(result => result.status === "fulfilled").map(result => result.value);
        const forecast = results[2].status === "fulfilled" ? results[2].value
          : normalizeForecast(this.snapshot?.forecast || previous?.forecast, now);
        if (!snapshots.length && !forecast) throw new Error("SOURCE_UNAVAILABLE");
        const incoming = snapshots.sort((a, b) => b.sourceCheckedAt - a.sourceCheckedAt)[0] || {
          sourceUrl: RADAR_URL, sourceCheckedAt: forecast.checkedAt, fetchedAt: now, events: []
        };
        if (forecast?.commitment && !forecast.commitment.window) {
          try {
            const html = await getText(RADAR_URL);
            const asset = html.match(/src="(\/assets\/[a-f0-9]{8,64}\/app\.js)"/)?.[1];
            if (asset) {
              if (this.deadlineAsset !== asset) {
                this.deadlines = parseObservationDeadlines(await getText(`${RADAR_URL.slice(0, -1)}${asset.replace("app.js", "home-countdown.js")}`));
                this.deadlineAsset = asset;
              }
              const targetAt = Date.parse(this.deadlines?.[forecast.commitment.sourceUrl.split("/").at(-1)]);
              forecast.commitment = normalizeCommitment({ ...forecast.commitment,
                window: { startAt: forecast.commitment.at, endAt: targetAt, targetAt, targetKind: "deadline" } }, now);
            }
          } catch { /* Keep the promise probability; timing remains unavailable. */ }
        }
        this.snapshot = { ...incoming, events: normalizeCheckpointEvents([
          ...(previous?.events || []), ...(this.snapshot?.events || []), ...snapshots.flatMap(snapshot => snapshot.events)
        ], now), forecast };
        this.nextReadAt = now + CACHE_MS;
        return checkpointSummary(this.snapshot, now);
      } catch {
        this.nextReadAt = now + 60000;
        return checkpointSummary(this.snapshot || previous, now, true);
      } finally { this.inFlight = null; }
    })();
    return this.inFlight;
  }
}

module.exports = { ResetCheckpointReader, parseCheckpointPage, checkpointSummary,
  normalizeCheckpointEvents, readBoundedText, parseRadarTimeline, parseForecast, parseObservationDeadlines, SOURCE_URL, RADAR_URL };
