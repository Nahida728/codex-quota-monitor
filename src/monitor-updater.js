const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const semver = require('semver');

const REPOSITORY = 'Nahida728/codex-quota-monitor';
const RELEASES_API = `https://api.github.com/repos/${REPOSITORY}/releases?per_page=30`;
const MAX_DOWNLOAD_BYTES = 384 * 1024 * 1024;

function selectPortableUpdate(releases, currentVersion) {
  if (!semver.valid(currentVersion) || !Array.isArray(releases)) return null;
  const beta = Boolean(semver.prerelease(currentVersion));
  const candidates = releases.filter(release => !release.draft && (beta || !release.prerelease))
    .map(release => ({ release, version: semver.valid(String(release.tag_name || '').replace(/^v/, '')) }))
    .filter(item => item.version && semver.gt(item.version, currentVersion) && (beta || !semver.prerelease(item.version)))
    .sort((a, b) => semver.rcompare(a.version, b.version));
  for (const { release, version } of candidates) {
    const name = `codex-quota-monitor-${version}-portable-x64.exe`;
    const asset = release.assets?.find(asset => asset.name === name);
    const expectedUrl = `https://github.com/${REPOSITORY}/releases/download/v${version}/${name}`;
    if (asset?.browser_download_url !== expectedUrl || !/^sha256:[a-f0-9]{64}$/.test(asset.digest || '') ||
        !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > MAX_DOWNLOAD_BYTES) continue;
    return { version, url: expectedUrl, sha256: asset.digest.slice(7), size: asset.size };
  }
  return null;
}

async function fileDigest(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function downloadVerified(update, destination, fetchImpl, onProgress = () => {}) {
  const response = await fetchImpl(update.url, { signal: AbortSignal.timeout(15 * 60 * 1000) });
  if (!response.ok || !response.body || Number(response.headers.get('content-length') || 0) > MAX_DOWNLOAD_BYTES) throw new Error('DOWNLOAD_FAILED');
  const handle = await fsp.open(destination + '.partial', 'w', 0o600);
  const hash = crypto.createHash('sha256');
  let bytes = 0, lastProgress = 0;
  try {
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > MAX_DOWNLOAD_BYTES || bytes > update.size) throw new Error('INVALID_SIZE');
      hash.update(chunk);
      await handle.writeFile(chunk);
      if (Date.now() - lastProgress >= 500) { onProgress(Math.floor(bytes / update.size * 100)); lastProgress = Date.now(); }
    }
    if (bytes !== update.size || hash.digest('hex') !== update.sha256) throw new Error('INVALID_DIGEST');
    await handle.sync();
  } catch (error) {
    await handle.close();
    await fsp.unlink(destination + '.partial').catch(() => {});
    throw error;
  }
  await handle.close();
  await fsp.rename(destination + '.partial', destination);
  onProgress(100);
}

class MonitorUpdater {
  constructor({ app, store, fetchImpl = fetch, notify = () => {}, idle = () => false, prepareQuit = async () => {} }) {
    Object.assign(this, { app, store, fetchImpl, notify, idle, prepareQuit });
    this.state = { status: app.isPackaged ? 'idle' : 'development', currentVersion: app.getVersion(), version: null, percent: 0 };
    this.portableTarget = process.env.PORTABLE_EXECUTABLE_FILE ? path.resolve(process.env.PORTABLE_EXECUTABLE_FILE) : null;
    this.directory = path.join(app.getPath('userData'), 'monitor-updates');
  }
  snapshot() { return { ...this.state }; }
  publish(values) { Object.assign(this.state, values); this.notify(this.snapshot()); }
  start() {
    if (!this.app.isPackaged) return;
    if (!this.portableTarget) this.configureInstaller();
    this.startTimer = setTimeout(() => this.check(), 15000); this.startTimer.unref();
    this.checkTimer = setInterval(() => this.check(), 6 * 60 * 60 * 1000); this.checkTimer.unref();
    // No timer reads conversations. Installation is deferred until observed tasks are idle.
    this.applyTimer = setInterval(() => { if (this.state.status === 'ready' && this.idle()) this.install().catch(() => {}); }, 30000);
    this.applyTimer.unref();
  }
  configureInstaller() {
    const { autoUpdater } = require('electron-updater');
    this.installer = autoUpdater;
    autoUpdater.logger = null;
    autoUpdater.allowDowngrade = false;
    autoUpdater.allowPrerelease = Boolean(semver.prerelease(this.app.getVersion()));
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.setFeedURL({ provider: 'github', owner: 'Nahida728', repo: 'codex-quota-monitor', private: false });
    autoUpdater.on('update-available', info => this.publish({ status: 'downloading', version: semver.valid(info.version), percent: 0 }));
    autoUpdater.on('update-not-available', () => this.publish({ status: 'current', version: null, percent: 0 }));
    autoUpdater.on('download-progress', info => this.publish({ status: 'downloading', percent: Math.max(0, Math.min(100, Math.floor(info.percent))) }));
    autoUpdater.on('update-downloaded', info => this.publish({ status: 'ready', version: semver.valid(info.version), percent: 100 }));
    autoUpdater.on('error', () => { if (this.state.status !== 'ready') this.publish({ status: 'error' }); });
  }
  async check() {
    if (!this.app.isPackaged || this.installing || this.state.status === 'downloading' || this.state.status === 'ready') return this.snapshot();
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.performCheck().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }
  async performCheck() {
    this.publish({ status: 'checking' });
    try {
      if (this.installer) { await this.installer.checkForUpdates(); return this.snapshot(); }
      await fsp.mkdir(this.directory, { recursive: true });
      const handoverFailure = path.join(this.directory, 'handover-status.txt');
      if (fs.existsSync(handoverFailure)) {
        this.store.set('monitorReadyUpdate', null);
        await fsp.unlink(handoverFailure);
        throw new Error('HANDOVER_FAILED');
      }
      const saved = this.store.get('monitorReadyUpdate');
      if (saved && semver.valid(saved.version) && semver.gt(saved.version, this.app.getVersion())) {
        const file = path.join(this.directory, `${saved.version}.exe`);
        if (/^[a-f0-9]{64}$/.test(saved.sha256 || '') && await fileDigest(file).catch(() => null) === saved.sha256) {
          this.ready = { ...saved, file }; this.publish({ status: 'ready', version: saved.version, percent: 100 }); return this.snapshot();
        }
      }
      const response = await this.fetchImpl(RELEASES_API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'codex-quota-monitor' }, signal: AbortSignal.timeout(20000) });
      if (!response.ok || !response.body) throw new Error('CHECK_FAILED');
      let body = '', length = 0;
      for await (const chunk of response.body) {
        length += chunk.length; if (length > 2 * 1024 * 1024) throw new Error('INVALID_MANIFEST');
        body += Buffer.from(chunk).toString('utf8');
      }
      const update = selectPortableUpdate(JSON.parse(body), this.app.getVersion());
      if (!update) { this.publish({ status: 'current', version: null, percent: 0 }); return this.snapshot(); }
      const file = path.join(this.directory, `${update.version}.exe`);
      this.publish({ status: 'downloading', version: update.version, percent: 0 });
      await downloadVerified(update, file, this.fetchImpl, percent => this.publish({ percent }));
      this.ready = { ...update, file };
      this.store.set('monitorReadyUpdate', { version: update.version, sha256: update.sha256 });
      this.publish({ status: 'ready', percent: 100 });
    } catch { if (this.state.status !== 'ready') this.publish({ status: 'error' }); }
    return this.snapshot();
  }
  async install() {
    if (this.state.status !== 'ready' || this.installing) return false;
    this.installing = true;
    try {
      if (this.portableTarget) {
        if (!this.ready || !path.isAbsolute(this.portableTarget) || path.extname(this.portableTarget).toLowerCase() !== '.exe' ||
            await fileDigest(this.ready.file) !== this.ready.sha256) throw new Error('INVALID_UPDATE');
        const configFile = path.join(this.directory, 'handover.json');
        await fsp.writeFile(configFile, JSON.stringify({ pid: process.pid, parentPid: process.ppid, target: this.portableTarget,
          staged: this.ready.file, sha256: this.ready.sha256 }), { mode: 0o600 });
        const helperFile = path.join(this.directory, 'portable-update.ps1');
        await fsp.writeFile(helperFile, await fsp.readFile(path.join(__dirname, 'portable-update.ps1')), { mode: 0o600 });
        await this.prepareQuit();
        const helper = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass',
          '-File', helperFile, '-ConfigPath', configFile], { detached: true, windowsHide: true, stdio: 'ignore' });
        await new Promise((resolve, reject) => { helper.once('spawn', resolve); helper.once('error', reject); });
        helper.unref();
        this.app.quit();
      } else {
        await this.prepareQuit();
        this.installer.quitAndInstall(true, true);
      }
      return true;
    } catch { this.installing = false; this.publish({ status: 'error' }); return false; }
  }
  dispose() { for (const timer of [this.startTimer, this.checkTimer, this.applyTimer]) clearTimeout(timer); }
}
module.exports = { MonitorUpdater, selectPortableUpdate, downloadVerified, REPOSITORY, RELEASES_API, MAX_DOWNLOAD_BYTES };
