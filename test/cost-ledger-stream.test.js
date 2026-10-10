const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { CodexCostUsageReader, reconcileCostSnapshots, normalizeCodexCostUsageResult } = require('../src/codex-cost-usage');
const { CostRecordProjector } = require('../src/cost-record-projector');
const context = JSON.stringify({type:'turn_context',payload:{model:'gpt-6.1-sol'}});
const count = n => JSON.stringify({timestamp:'2026-10-10T01:00:00Z',type:'event_msg',payload:{type:'token_count',info:{last_token_usage:{input_tokens:n,output_tokens:10},total_token_usage:{input_tokens:n,output_tokens:10}}}});
function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'quota-stream-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'sessions')); fs.mkdirSync(path.join(root,'archived_sessions'));
  return root;
}
test('oversized files resume at byte boundaries across restarts without retaining conversation strings',async t=>{
  const root=fixture(t), file=path.join(root,'sessions','rollout-large.jsonl');
  const secret='PRIVATE_TOOL_TEXT';
  fs.writeFileSync(file,[context,JSON.stringify({type:'response_item',payload:{body:secret.repeat(1000)}}),count(100),count(100)].join('\n')+'\n');
  let state, passes=0;
  do {
    const reader=new CodexCostUsageReader({sessionsRoot:path.join(root,'sessions'),cacheMs:0,maxTotalBytes:257,maxFileBytes:128});
    state=await reader.read(++passes,state);
    assert.ok(state.scanProgress.bytesRead<=257);
    assert.doesNotMatch(JSON.stringify(state),/PRIVATE_TOOL_TEXT/);
  } while(!state.indexComplete&&passes<200);
  assert.ok(state.indexComplete); assert.equal(state.models[0].inputTokens,100); assert.equal(state.duplicateEvents,1);
  const appended=count(200)+'\n'; fs.appendFileSync(file,appended);
  const reader=new CodexCostUsageReader({sessionsRoot:path.join(root,'sessions'),cacheMs:0,maxTotalBytes:4096});
  const next=await reader.read(1000,state);
  assert.equal(next.scanProgress.bytesRead,Buffer.byteLength(appended)); assert.equal(next.models[0].inputTokens,300);
  fs.renameSync(file,path.join(root,'archived_sessions',path.basename(file)));
  const archived=await reader.read(1001,next);
  assert.equal(archived.models[0].inputTokens,300); assert.equal(archived.scanProgress.bytesRead,0);
  fs.unlinkSync(path.join(root,'archived_sessions',path.basename(file)));
  const missing=await reader.read(1002,archived); assert.equal(missing.models[0].inputTokens,300);
});
test('pricing migrations retain old numeric ledgers and only explicit full scan replaces an entry',async t=>{
  const root=fixture(t),file=path.join(root,'sessions','rollout-old.jsonl'); fs.writeFileSync(file,context+'\n'+count(100)+'\n');
  const reader=new CodexCostUsageReader({sessionsRoot:path.join(root,'sessions'),cacheMs:0,maxTotalBytes:4096});
  const first=await reader.read(1000);
  const legacy=structuredClone(first); legacy.schemaVersion=6;
  for(const entry of legacy.rolloutIndex){delete entry.scanState;delete entry.byteOffset;}
  fs.writeFileSync(file,context+'\n'+count(20)+'\n');
  const freshReader=new CodexCostUsageReader({sessionsRoot:path.join(root,'sessions'),cacheMs:0,maxTotalBytes:4096});
  const retained=await freshReader.read(1001,legacy);
  assert.equal(retained.models[0].inputTokens,100); assert.equal(retained.scanProgress.bytesRead,0);
  assert.equal(reconcileCostSnapshots([legacy,retained]).models[0].inputTokens,100);
  freshReader.requestFullScan(); const rebuilt=await freshReader.read(1002,retained);
  assert.equal(rebuilt.models[0].inputTokens,20);
  assert.equal(reconcileCostSnapshots([legacy,rebuilt]).models[0].inputTokens,20);
  assert.equal(normalizeCodexCostUsageResult(retained,{tokenCostSnapshot:rebuilt},1003).models[0].inputTokens,20);
});
test('inventory limits apply per pass rather than dropping archived or earlier sessions',async t=>{
  const root=fixture(t);
  for(let i=0;i<5;i++)fs.writeFileSync(path.join(root,i%2?'archived_sessions':'sessions',`rollout-${i}.jsonl`),context+'\n'+count(10)+'\n');
  const reader=new CodexCostUsageReader({sessionsRoot:path.join(root,'sessions'),cacheMs:0,maxFiles:2,maxTotalBytes:4096});
  let state; for(let i=0;i<3;i++)state=await reader.read(i+1,state);
  assert.equal(state.filesScanned,5); assert.equal(state.models[0].inputTokens,50);assert.ok(state.indexComplete);
});
test('projector discards private object keys immediately and rejects malformed structures',()=>{
  const parser=new CostRecordProjector();parser.feed('{"type":"turn_context","payload":{"private_objective');
  assert.doesNotMatch(JSON.stringify(parser.snapshot()),/private_objective/);
  for(const text of ['{"type" "turn_context"}','{"payload":[{"model":"gpt-6.1-sol"}]}']){
    const p=new CostRecordProjector(); for(const c of text)p.feed(c);
    assert.equal(p.result()?.payload?.model,undefined);
  }
  const p=new CostRecordProjector(); for(const c of context)p.feed(c);
  assert.equal(p.result().payload.model,'gpt-6.1-sol');
});

test('manual rebuild bypasses a recent cache and preserves committed values during partial UTF-8 reads',async t=>{
  const root=fixture(t),file=path.join(root,'sessions','rollout-unicode.jsonl');
  fs.writeFileSync(file,context+'\n'+count(100)+'\n');
  const reader=new CodexCostUsageReader({sessionsRoot:path.join(root,'sessions'),cacheMs:30000,maxTotalBytes:4096});
  const first=await reader.read(100000);
  fs.writeFileSync(file,JSON.stringify({type:'turn_context',payload:{model:'gpt-6.1-sol',irrelevant:'文字🙂'.repeat(100)}})+'\n'+count(20)+'\n');
  reader.maxTotalBytes=31;reader.requestFullScan();
  let rebuilt=await reader.read(100001,first);
  assert.ok(rebuilt.scanProgress.rebuilding);assert.equal(rebuilt.models[0].inputTokens,100);
  for(let pass=0;rebuilt.rescanPending.length&&pass<100;pass++) {
    const restarted=new CodexCostUsageReader({sessionsRoot:path.join(root,'sessions'),cacheMs:0,maxTotalBytes:31});
    rebuilt=await restarted.read(100002+pass,rebuilt,{force:true});
    assert.doesNotMatch(JSON.stringify(rebuilt),/文字/);
  }
  assert.equal(rebuilt.rescanPending.length,0);assert.equal(rebuilt.models[0].inputTokens,20);
});

test('manual rebuild restarts a source truncated during its partial replacement',async t=>{
  const root=fixture(t),file=path.join(root,'sessions','rollout-truncated.jsonl');
  fs.writeFileSync(file,context+'\n'+count(100)+'\n');
  const reader=new CodexCostUsageReader({sessionsRoot:path.join(root,'sessions'),cacheMs:0,maxTotalBytes:4096});
  const committed=await reader.read(1000);
  fs.writeFileSync(file,context+'\n'+JSON.stringify({type:'response_item',payload:{body:'x'.repeat(5000)}})+'\n'+count(20)+'\n');
  reader.maxTotalBytes=1000;reader.requestFullScan();
  const partial=await reader.read(1001,committed);
  assert.equal(partial.models[0].inputTokens,100);
  assert.ok(partial.rescanPending.length);
  fs.writeFileSync(file,context+'\n'+count(20)+'\n');
  const replacement=await reader.read(1002,partial,{force:true});
  assert.equal(replacement.rescanPending.length,0);
  assert.equal(replacement.models[0].inputTokens,20);
});
