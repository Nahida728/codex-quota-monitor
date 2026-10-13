const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCheckpointPage, parseRadarTimeline, checkpointSummary, ResetCheckpointReader, parseForecast, parseObservationDeadlines } = require("../src/reset-checkpoints");
const { reconcileQuotaStates } = require("../src/store");

const now = Date.parse("2026-10-10T05:00:00Z");
const rows = Array.from({ length: 5 }, (_, i) => ({
  type: "automatic_reset", status: "confirmed", at: new Date(now - (i + 1) * 4 * 86400000).toISOString(),
  sourceUrl: `https://x.com/thsottiaux/status/210391195954461082${i}`
}));
function page(rowsToUse = rows, utc = new Date(now).toISOString()) {
  const flight = `1:${JSON.stringify({ rows: rowsToUse, events: [] })}\n2:${JSON.stringify({ template: "Last check: {duration} ago.", utc })}\n`;
  return `<script>self.__next_f.push(${JSON.stringify([1, flight])})</script>`;
}

test("checkpoint parsing uses confirmed global announcements, never grants or executable script", () => {
  const parsed = parseCheckpointPage(page([...rows, { ...rows[0], type: "banked_reset_grant" },
    { ...rows[0], status: "announced" }, { ...rows[0], sourceUrl: "javascript:alert(1)" }]), now);
  assert.equal(parsed.events.length, 5);
  assert.equal(parsed.sourceCheckedAt, now);
  assert.doesNotMatch(JSON.stringify(parsed), /banked|announced|javascript/);
  assert.throws(() => parseCheckpointPage("<script>throw new Error('execute me')</script>", now));
});

test("24/48-hour estimates disclose sample size and exclude stale or insufficient data", () => {
  const fresh = checkpointSummary(parseCheckpointPage(page(), now), now);
  assert.equal(fresh.sampleCount, 4);
  assert.equal(fresh.medianSeconds, 4 * 86400);
  assert.equal(fresh.probability24, 16);
  assert.equal(fresh.probability48, 29);
  const stale = checkpointSummary(parseCheckpointPage(page(rows, new Date(now - 2 * 86400000).toISOString()), now), now);
  assert.equal(stale.stale, true);
  assert.equal(stale.probability24, null);
  assert.equal(checkpointSummary({ ...fresh, events: rows.slice(0, 2).map(row => ({ at: Date.parse(row.at) / 1000, sourceUrl: row.sourceUrl })) }, now).probability24, null);
});

test("radar API rejects hints, banked grants, previews and unsafe links; keeps experimental source odds", async () => {
  const event = { type: "reset", scope: "global", confidence: "high", preview: false, source: "archive", announced_at: new Date(now - 86400000).toISOString(), url: "https://x.com/thsottiaux/status/2107676072871600470" };
  const timeline = { updated_at: new Date(now).toISOString(), events: [event, { ...event, preview: true }, { ...event, confidence: "medium" }, { ...event, type: "credits" }, { ...event, url: "https://other.invalid/" }] };
  assert.equal(parseRadarTimeline(timeline, now).events.length, 1);
  const reader = new ResetCheckpointReader({ fetchImpl: async url => new Response(url.endsWith("timeline") ? JSON.stringify(timeline) : url.endsWith("forecast") ? JSON.stringify({ updated_at: timeline.updated_at, probabilities: { rounded_24h: 15, rounded_48h: 28 }, model: { window_intervals: 8 } }) : page(rows, new Date(now - 2 * 86400000).toISOString())) });
  const result = await reader.read(now);
  assert.equal(result.sourceUrl, "https://codex-reset.com/");
  assert.equal(result.probability24, 15);
  assert.equal(result.probability48, 28);
  assert.equal(result.probabilityMode, "source-experimental");
  assert.equal(result.events.length, 6);
  assert.equal(checkpointSummary({ ...result, sourceCheckedAt: now + 86400000 }, now).probability24, null);
});

test("offline reads and archive reconciliation preserve checkpoint history separately from local resets", async () => {
  let reads = 0;
  const reader = new ResetCheckpointReader({ fetchImpl: async () => { reads++; return new Response(page()); } });
  const first = await reader.read(now);
  await reader.read(now + 5000);
  assert.equal(reads, 3);
  reader.fetch = async () => { throw new Error("offline"); };
  const offline = await reader.read(now + 20 * 60000);
  assert.equal(offline.events.length, 5);
  assert.equal(offline.cached, true);
  const recovered = reconcileQuotaStates({}, [{ resetCheckpointSnapshot: first }]);
  assert.equal(recovered.resetCheckpointSnapshot.events.length, 5);
  assert.equal(recovered.officialResetHistory.length, 0);
});

test("live explicit confirmations survive medium confidence while unconfirmed and banked records stay excluded", () => {
  const event = { type: "reset", scope: "global", confidence: "medium", preview: false,
    source: "live", confirmed: true, reset_verification_status: "pending", banked_grant: false,
    announced_at: new Date(now - 1000).toISOString(), url: "https://x.com/thsottiaux/status/2109132167112782291" };
  const timeline = { updated_at: new Date(now).toISOString(), events: [event,
    { ...event, confirmed: false }, { ...event, confirmed: undefined }, { ...event, preview: true },
    { ...event, type: "credits" }, { ...event, banked_grant: true }, { ...event, reset_kind: "banked" },
    { ...event, confidence: "low" }, { ...event, url: "https://other.invalid/" },
    { ...event, confidence: "high", source: "archive", confirmed: false }] };
  assert.deepEqual(parseRadarTimeline(timeline, now).events, [{ at: (now - 1000) / 1000, sourceUrl: event.url }]);
});

test("manual refresh revalidates cached sources with bounded coalescing and retains history on failure", async () => {
  let calls = 0, fail = false;
  const reader = new ResetCheckpointReader({ fetchImpl: async (_url, options) => {
    calls++;
    assert.equal(options.cache, "no-cache");
    assert.equal(options.headers["Cache-Control"], "no-cache");
    if (fail) throw new Error("offline");
    return new Response(page());
  } });
  await reader.read(now);
  await reader.read(now + 10000);
  assert.equal(calls, 3);
  const [first, second] = await Promise.all([reader.read(now + 10000, null, { force: true }), reader.read(now + 10000, null, { force: true })]);
  assert.equal(calls, 6);
  assert.deepEqual(first, second);
  await reader.read(now + 11000, null, { force: true });
  assert.equal(calls, 6);
  fail = true;
  const offline = await reader.read(now + 20000, first, { force: true });
  assert.equal(offline.cached, true);
  assert.equal(offline.events.length, 5);
  assert.equal(offline.observedAt, now + 20000);
  const recovered = reconcileQuotaStates({}, [{ resetCheckpointSnapshot: first }]);
  assert.equal(recovered.resetCheckpointSnapshot.events.length, 5);
});

test("commitments have independent priority, validated timing and freshness without becoming reset history", async () => {
  const at = now - 60000, end = now + 3600000;
  const signal = { signal_type: "dated_commitment", at: new Date(at).toISOString(),
    url: "https://x.com/thsottiaux/status/2109812360596865224", window: {
      start_at: new Date(at).toISOString(), end_at: new Date(end).toISOString(),
      target_at: new Date(end).toISOString(), target_kind: "deadline" } };
  const raw = { updated_at: new Date(now).toISOString(), official_signal: signal,
    probabilities: { rounded_24h: 19, rounded_48h: 34, commitment_floor_percent: 83,
      range_24h: { lower: .099, upper: .325 } }, model: { window_intervals: 8 } };
  const forecast = parseForecast(raw, now);
  const snapshot = { ...parseCheckpointPage(page(), now), forecast };
  const fresh = checkpointSummary(snapshot, now);
  assert.equal(fresh.commitment.probability, 83);
  assert.equal(fresh.commitment.window.targetAt, end);
  assert.equal(fresh.probability24, 19);
  assert.deepEqual(fresh.forecast.range24, { lower: 10, upper: 33 });
  assert.equal(checkpointSummary(snapshot, now + 3600001).commitment, null);
  const confirmed = { ...snapshot, events: [...snapshot.events, { at: now / 1000, sourceUrl: signal.url }] };
  assert.equal(checkpointSummary(confirmed, now).commitment, null);
  assert.equal(parseForecast({ ...raw, official_signal: { ...signal, signal_type: "tease" } }, now).commitment, null);
  assert.equal(parseForecast({ ...raw, official_signal: { ...signal, reset_kind: "banked" } }, now).commitment, null);
  assert.equal(parseForecast({ ...raw, official_signal: { ...signal, url: "https://evil.invalid/" } }, now).commitment, null);
  const invalidWindow = parseForecast({ ...raw, official_signal: { ...signal, window: { ...signal.window, target_at: "bad" } } }, now);
  assert.equal(invalidWindow.commitment.window, null);
  // A live forecast is usable even if both announcement-history readers fail.
  const reader = new ResetCheckpointReader({ fetchImpl: async url => {
    if (!url.endsWith("forecast")) throw new Error("history offline");
    return new Response(JSON.stringify(raw));
  } });
  const result = await reader.read(now);
  assert.equal(result.commitment.probability, 83);
  assert.deepEqual(result.events, []);
});

test("promise deadline overrides parse inert data from pinned versioned assets, never arbitrary code", async () => {
  const id = "2109812360596865224", target = new Date(now + 3600000).toISOString();
  const asset = `export const OBSERVATION_DEADLINES = Object.freeze({"${id}":"${target}"});`;
  assert.equal(parseObservationDeadlines(asset)[id], target);
  assert.deepEqual(parseObservationDeadlines('OBSERVATION_DEADLINES = Object.freeze({"x":process.exit()});'), {});
  const reader = new ResetCheckpointReader({ fetchImpl: async url => new Response(
    url.endsWith("forecast") ? JSON.stringify({ updated_at: new Date(now).toISOString(),
      official_signal: { signal_type: "promise", at: new Date(now - 60000).toISOString(), url: `https://x.com/thsottiaux/status/${id}` },
      probabilities: { commitment_floor_percent: 83 }, model: {} })
    : url.endsWith("home-countdown.js") ? asset : url === "https://codex-reset.com/" ? '<script src="/assets/22e0f21947/app.js"></script>' : page()) });
  const result = await reader.read(now);
  assert.equal(result.commitment.window.targetAt, Date.parse(target));
  assert.equal(result.probabilityMode, "median-history");
  assert.equal(result.events.length, 5);
});
