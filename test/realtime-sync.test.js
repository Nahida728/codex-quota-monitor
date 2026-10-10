const test = require("node:test");
const assert = require("node:assert/strict");
const { RealtimeSync } = require("../src/realtime-sync");

function harness(service) {
  let now = 0;
  const timers = new Map();
  const events = [];
  let closed = false;
  const sync = new RealtimeSync({ service, now: () => now,
    onSnapshot: value => events.push(["remote", value]), onTasks: value => events.push(["local", value]),
    watch: () => ({ on() {}, close() { closed = true; } }),
    setTimer: (callback, delay) => { const id = { unref() {} }; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimer: id => timers.delete(id) });
  async function advance(ms) {
    now += ms;
    const ready = [...timers].filter(([, value]) => value.at <= now);
    for (const [id, value] of ready) { timers.delete(id); value.callback(); }
    for (let count = 0; count < 8; count++) await Promise.resolve();
  }
  sync.start();
  return { sync, timers, events, advance, get closed() { return closed; } };
}

test("event storms coalesce into one local read and one bounded remote read", async () => {
  let localReads = 0, remoteReads = 0;
  const h = harness({ client: {}, readActiveTasks: async () => { localReads++; return { tasks: [], records: {} }; },
    read: async () => { remoteReads++; return { online: true, activeTasks: { count: 1 } }; } });
  for (let i = 0; i < 10000; i++) h.sync.changed("sessions\\2026\\10\\rollout.jsonl");
  assert.equal(h.timers.size, 3); // one local, one remote, one fallback
  await h.advance(250);
  assert.equal(localReads, 1); assert.equal(remoteReads, 1);
  for (let i = 0; i < 100; i++) h.sync.changed("sessions/new.jsonl");
  await h.advance(250);
  assert.equal(localReads, 2); assert.equal(remoteReads, 1);
  assert.equal(h.events.filter(([type]) => type === "local").length, 1); // unchanged data is not repainted
  await h.advance(2750);
  assert.equal(remoteReads, 2);
  h.sync.dispose();
  assert.equal(h.timers.size, 0); assert.equal(h.closed, true);
});

test("a slow local scan queues only one follow-up and adaptively yields", async () => {
  let finish, reads = 0;
  const h = harness({ client: {}, read: async () => ({ online: true }),
    readActiveTasks: () => { reads++; return new Promise(resolve => { finish = resolve; }); } });
  h.sync.changed("sessions/a.jsonl");
  await h.advance(180);
  for (let i = 0; i < 1000; i++) h.sync.changed("sessions/a.jsonl");
  await h.advance(2000);
  assert.equal(reads, 1);
  finish({ tasks: [] });
  await h.advance(0);
  const local = h.timers.get(h.sync.localTimer);
  assert.equal(local.at, 2180 + 8000);
  h.sync.dispose();
});

test("unrelated files do not trigger scans and missing watcher support retains fallback checks", async () => {
  const h = harness({ client: {}, read: async () => ({ online: true }), readActiveTasks: async () => ({ tasks: [] }) });
  h.sync.changed("plugins/big-cache.bin"); h.sync.changed("config.toml");
  assert.equal(h.timers.size, 1);
  h.sync.changed("goals_1.sqlite-wal");
  assert.equal(h.timers.size, 2);
  await h.advance(180);
  assert.equal(h.events[0][0], "local");
  h.sync.dispose();
});

test("read-only SQLite shared-memory notifications never wake the monitor itself", () => {
  const h = harness({ client: {}, read: async () => ({ online: true }), readActiveTasks: async () => ({ tasks: [] }) });
  for (let i = 0; i < 10000; i++) h.sync.changed("goals_1.sqlite-shm");
  assert.equal(h.timers.size, 1);
  assert.equal(h.sync.localDirty, false);
  assert.equal(h.sync.remoteDirty, false);
  h.sync.changed("goals_1.sqlite-wal");
  assert.equal(h.sync.localDirty, true);
  h.sync.dispose();
});

test("live telemetry changes reach the task channel before a turn completes",async()=>{
  let tokens=100,running=true;
  const snapshot=()=>({available:true,count:running?1:0,tasks:running?[{id:'parent',startedAt:1,telemetry:{totalTokens:tokens}}]:[],
    latestTask:{id:'parent',startedAt:1,telemetry:{totalTokens:tokens}},records:{}});
  const h=harness({client:{},read:async()=>({online:true,activeTasks:snapshot()}),readActiveTasks:async()=>snapshot()});
  h.sync.changed('sessions/live.jsonl');await h.advance(250);
  tokens=220;h.sync.changed('sessions/live.jsonl');await h.advance(250);
  const updates=h.events.filter(([kind])=>kind==='local').map(([,value])=>value);
  assert.equal(updates.length,2);
  assert.equal(updates[1].count,1);
  assert.equal(updates[1].latestTask.telemetry.totalTokens,220);
  running=false;h.sync.changed('sessions/live.jsonl');await h.advance(250);
  assert.equal(h.events.filter(([kind])=>kind==='local').at(-1)[1].count,0);
  h.sync.dispose();
});
