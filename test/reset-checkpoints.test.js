const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCheckpointPage, parseRadarTimeline, checkpointSummary, ResetCheckpointReader } = require("../src/reset-checkpoints");
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
