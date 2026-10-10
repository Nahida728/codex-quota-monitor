const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { selectPortableUpdate, downloadVerified, MonitorUpdater, REPOSITORY } = require('../src/monitor-updater');
function release(version, options={}) {
  const name=`codex-quota-monitor-${version}-portable-x64.exe`;
  return {tag_name:`v${version}`,draft:false,prerelease:version.includes('-'),assets:[{name,size:5,digest:'sha256:'+'a'.repeat(64),browser_download_url:`https://github.com/${REPOSITORY}/releases/download/v${version}/${name}`}],...options};
}
test('update selection pins repository, x64 asset, checksum, channel and strictly newer SemVer',()=>{
  const releases=[release('1.4.0-beta.1'),release('1.3.1'),release('1.3.0-beta.2',{draft:true}),release('1.2.6')];
  assert.equal(selectPortableUpdate(releases,'1.3.0-beta.1').version,'1.4.0-beta.1');
  assert.equal(selectPortableUpdate(releases,'1.3.0').version,'1.3.1');
  assert.equal(selectPortableUpdate(releases,'1.4.0'),null);
  const foreign=release('2.0.0');foreign.assets[0].browser_download_url='https://example.com/update.exe';
  assert.equal(selectPortableUpdate([foreign],'1.3.0'),null);
  const missingDigest=release('2.0.0');delete missingDigest.assets[0].digest;
  assert.equal(selectPortableUpdate([missingDigest],'1.3.0'),null);
});
test('streamed downloads reject tampering and retain the previous verified file',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'quota-update-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=path.join(root,'update.exe');fs.writeFileSync(file,'OLD');
  const data=Buffer.from('verified update'),sha256=crypto.createHash('sha256').update(data).digest('hex');
  const mock=async()=>new Response(data);
  await assert.rejects(downloadVerified({url:'https://github.com/test',size:data.length,sha256:'0'.repeat(64)},file,mock));
  assert.equal(fs.readFileSync(file,'utf8'),'OLD');assert.equal(fs.existsSync(file+'.partial'),false);
  await downloadVerified({url:'https://github.com/test',size:data.length,sha256},file,mock);
  assert.deepEqual(fs.readFileSync(file),data);
});
test('development mode cannot check, download or install updates',async()=>{
  const updater=new MonitorUpdater({app:{isPackaged:false,getVersion:()=> '1.3.0-beta.1',getPath:()=>os.tmpdir()},store:{get:()=>null},fetchImpl:()=>{throw Error('network must not be called');}});
  updater.start();assert.equal((await updater.check()).status,'development');assert.equal(await updater.install(),false);
});

test('portable handover replaces atomically with a backup and rejects a changed staged file', {skip:process.platform!=='win32'}, t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'quota-handover-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const target=path.join(root,'monitor.exe'), staged=path.join(root,'next.exe'), config=path.join(root,'handover.json');
  const launcher=path.join(root,'test.ps1');
  const fixtureHelper=path.join(root,'helper.ps1');
  fs.writeFileSync(fixtureHelper,fs.readFileSync(path.resolve(__dirname,'../src/portable-update.ps1'),'utf8').replace("[void][Diagnostics.Process]::Start($updateLaunch)","Write-Output 'LAUNCH_REQUESTED'"));
  fs.writeFileSync(launcher,`param([string]$Helper,[string]$Config)
. $Helper -ConfigPath $Config
`);
  const run=()=>spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',launcher,
    '-Helper',fixtureHelper,'-Config',config],{encoding:'utf8',windowsHide:true,timeout:10000});
  fs.writeFileSync(target,'OLD');fs.writeFileSync(staged,'NEW');
  fs.writeFileSync(config,JSON.stringify({pid:2147483646,parentPid:2147483645,target,staged,sha256:crypto.createHash('sha256').update('NEW').digest('hex')}));
  const applied=run();assert.equal(applied.status,0,applied.stderr);assert.match(applied.stdout,/LAUNCH_REQUESTED/);
  assert.equal(fs.readFileSync(target,'utf8'),'NEW',applied.stdout);assert.equal(fs.readFileSync(target+'.previous.exe','utf8'),'OLD');
  fs.writeFileSync(staged,'TAMPERED');const failed=run();assert.equal(failed.status,0);
  assert.equal(fs.readFileSync(target,'utf8'),'NEW');assert.equal(fs.existsSync(path.join(root,'handover-status.txt')),true);
});
