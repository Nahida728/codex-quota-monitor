const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, nativeTheme, screen, dialog } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { QuotaService } = require("./quota-service");
const { JsonStore } = require("./store");
const { focusCodexWindow } = require("./codex-window-focus");
const { didWindowMove, startSystemWindowMove } = require("./native-window-drag");

let window;
let tray;
let quotaService;
let store;
let isQuitting = false;
let isAppHidden = false;
let windowPositionSaveTimer = null;
let isWindowCollapsed = false;
let isChangingWindowMode = false;
let orbMoveSettledTimer = null;
let alwaysOnTopYielded = false;

const APP_NAME = "Codex监测台";
const WINDOW_WIDTH = 460;
const WINDOW_HEIGHT = 690;
const ORB_SIZE = 76;
const DEFAULT_WINDOW_MODE_ANCHOR = Object.freeze({ x: 358, y: 43 });
const MAX_BACKGROUND_BYTES = 20 * 1024 * 1024;
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) app.quit();

function isChinese() {
  return store?.get("language", "zh") === "zh";
}

function getLocalizedAppName() {
  return isChinese() ? APP_NAME : "Codex Quota Monitor";
}

function createTrayIcon() {
  const filename = nativeTheme.shouldUseDarkColors
    ? "tray-icon-on-dark.png"
    : "tray-icon-on-light.png";
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, filename)
    : path.join(__dirname, "..", "assets", filename);
  const image = nativeImage.createFromPath(iconPath);
  if (!image.isEmpty()) return image;
  return nativeImage.createFromPath(path.join(__dirname, "..", "assets", "codex-icon-white.png"))
    .resize({ width: 32, height: 32 });
}

function getWindowIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "icon.ico")
    : path.join(__dirname, "..", "assets", "icon.ico");
}

function readLargestPngFromIco(iconPath) {
  try {
    const buffer = fs.readFileSync(iconPath);
    if (buffer.length < 6 || buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) return null;
    const count = buffer.readUInt16LE(4);
    let best = null;
    for (let index = 0; index < count; index += 1) {
      const entryOffset = 6 + index * 16;
      if (entryOffset + 16 > buffer.length) break;
      const width = buffer[entryOffset] || 256;
      const height = buffer[entryOffset + 1] || 256;
      const size = buffer.readUInt32LE(entryOffset + 8);
      const imageOffset = buffer.readUInt32LE(entryOffset + 12);
      if (imageOffset + size > buffer.length || size < 8) continue;
      const isPng = buffer.compare(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 0, 8, imageOffset, imageOffset + 8) === 0;
      if (!isPng || (best && width * height <= best.width * best.height)) continue;
      best = { width, height, image: buffer.subarray(imageOffset, imageOffset + size) };
    }
    return best?.image || null;
  } catch {
    return null;
  }
}

function getWindowIconDataUrl() {
  const iconPath = getWindowIconPath();
  const largestPng = readLargestPngFromIco(iconPath);
  if (largestPng) return `data:image/png;base64,${largestPng.toString("base64")}`;
  const image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) return null;
  return image.resize({ width: 64, height: 64, quality: "best" }).toDataURL();
}

function createRectangularWindowShape(width, height, offsetX = 0, offsetY = 0) {
  return [{
    x: Math.round(offsetX),
    y: Math.round(offsetY),
    width: Math.round(width),
    height: Math.round(height)
  }];
}

function saveWindowPosition(target = window, key = "windowBounds") {
  if (!target || target.isDestroyed()) return;
  if (windowPositionSaveTimer) clearTimeout(windowPositionSaveTimer);
  windowPositionSaveTimer = null;
  const bounds = target.getBounds();
  store.set(key, { x: bounds.x, y: bounds.y });
}

function scheduleWindowPositionSave(target = window, key = "windowBounds") {
  if (windowPositionSaveTimer) clearTimeout(windowPositionSaveTimer);
  windowPositionSaveTimer = setTimeout(() => saveWindowPosition(target, key), 250);
}

function isPositionVisible(position, width, height) {
  return screen.getAllDisplays().some(({ workArea }) =>
    position.x < workArea.x + workArea.width - 24 &&
    position.x + width > workArea.x + 24 &&
    position.y < workArea.y + workArea.height - 24 &&
    position.y + height > workArea.y + 24
  );
}

function getWindowPosition(collapsed = false) {
  const size = collapsed ? ORB_SIZE : WINDOW_WIDTH;
  const height = collapsed ? ORB_SIZE : WINDOW_HEIGHT;
  const key = collapsed ? "orbWindowBounds" : "windowBounds";
  const saved = store.get(key);
  if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
    if (isPositionVisible(saved, size, height)) return saved;
  }

  if (collapsed) {
    const fullPosition = getWindowPosition(false);
    return {
      x: fullPosition.x + WINDOW_WIDTH - ORB_SIZE,
      y: fullPosition.y
    };
  }

  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: Math.round(workArea.x + workArea.width - WINDOW_WIDTH - 24),
    y: Math.round(workArea.y + 24)
  };
}

function clampWindowPosition(position, width, height) {
  const display = screen.getDisplayNearestPoint({
    x: Math.round(position.x + width / 2),
    y: Math.round(position.y + height / 2)
  });
  const { workArea } = display;
  return {
    x: Math.round(Math.min(Math.max(position.x, workArea.x), workArea.x + workArea.width - width)),
    y: Math.round(Math.min(Math.max(position.y, workArea.y), workArea.y + workArea.height - height))
  };
}

function normalizeWindowModeAnchor(anchor) {
  const stored = anchor && Number.isFinite(anchor.x) && Number.isFinite(anchor.y)
    ? anchor
    : store.get("windowModeAnchor", DEFAULT_WINDOW_MODE_ANCHOR);
  return {
    x: Math.round(Math.min(WINDOW_WIDTH - ORB_SIZE / 2, Math.max(ORB_SIZE / 2, Number(stored?.x) || DEFAULT_WINDOW_MODE_ANCHOR.x))),
    y: Math.round(Math.min(WINDOW_HEIGHT - ORB_SIZE / 2, Math.max(ORB_SIZE / 2, Number(stored?.y) || DEFAULT_WINDOW_MODE_ANCHOR.y)))
  };
}

function positionWindow(target, position) {
  if (!target || target.isDestroyed()) return;
  target.setPosition(Math.round(position.x), Math.round(position.y), false);
  target.setOpacity(1);
  target.webContents.invalidate();
}

function setWindowInteractive(target, interactive) {
  if (!target || target.isDestroyed()) return;
  target.setIgnoreMouseEvents(!interactive);
}

async function setWindowMode(collapsed, requestedAnchor) {
  const anchor = normalizeWindowModeAnchor(requestedAnchor);
  if (!window || window.isDestroyed()) {
    return { collapsed: isWindowCollapsed, anchor };
  }
  const nextCollapsed = Boolean(collapsed);
  if (nextCollapsed === isWindowCollapsed) return { collapsed: isWindowCollapsed, anchor };
  if (isChangingWindowMode) return { collapsed: isWindowCollapsed, anchor };
  isChangingWindowMode = true;

  try {
    const effectiveAnchor = anchor;
    const bounds = window.getBounds();
    isWindowCollapsed = nextCollapsed;
    if (nextCollapsed) {
      saveWindowPosition(window, "windowBounds");
      window.setMovable(true);
      store.set("orbWindowBounds", {
        x: Math.round(bounds.x + effectiveAnchor.x - ORB_SIZE / 2),
        y: Math.round(bounds.y + effectiveAnchor.y - ORB_SIZE / 2)
      });
      window.webContents.send("window:modeChanged", true, effectiveAnchor);
      window.setShape(createRectangularWindowShape(
        ORB_SIZE,
        ORB_SIZE,
        effectiveAnchor.x - ORB_SIZE / 2,
        effectiveAnchor.y - ORB_SIZE / 2
      ));
    } else {
      window.setMovable(!store.get("positionLocked", false));
      // Keep the full-card hit-test region explicit when the same fixed native
      // surface returns from its small floating-orb shape.
      window.setShape(createRectangularWindowShape(WINDOW_WIDTH, WINDOW_HEIGHT));
      window.webContents.send("window:modeChanged", false, effectiveAnchor);
      window.focus();
    }

    window.webContents.invalidate();
    store.set("windowCollapsed", isWindowCollapsed);
    store.set("windowModeAnchor", effectiveAnchor);
    updateTray();
    return { collapsed: isWindowCollapsed, anchor: effectiveAnchor };
  } finally {
    isChangingWindowMode = false;
  }
}

function buildTrayMenu() {
  const language = store.get("language", "zh");
  const zh = language === "zh";
  return Menu.buildFromTemplate([
    {
      label: !isAppHidden ? (zh ? "隐藏卡片" : "Hide card") : (zh ? "显示卡片" : "Show card"),
      click: () => (!isAppHidden ? hideAppWindows() : showWindow())
    },
    {
      label: zh ? "立即刷新" : "Refresh now",
      click: () => window?.webContents.send("quota:refresh")
    },
    { type: "separator" },
    {
      label: zh ? "始终置顶" : "Always on top",
      type: "checkbox",
      checked: store.get("alwaysOnTop", true),
      click: ({ checked }) => setAlwaysOnTop(checked)
    },
    {
      label: zh ? "开机启动" : "Launch at login",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: ({ checked }) => app.setLoginItemSettings({ openAtLogin: checked })
    },
    { type: "separator" },
    {
      label: zh ? "退出" : "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
}

function updateTray() {
  if (!tray) return;
  tray.setToolTip(getLocalizedAppName());
  tray.setContextMenu(buildTrayMenu());
}

function showWindow() {
  if (!window || window.isDestroyed()) return;
  isAppHidden = false;
  positionWindow(window, getWindowPosition(false));
  window.setAlwaysOnTop(store.get("alwaysOnTop", true), "floating");
  alwaysOnTopYielded = false;
  if (window.isMinimized()) window.restore();
  window.showInactive();
  window.focus();
  updateTray();
}

function hideAppWindows() {
  isAppHidden = true;
  saveWindowPosition(window, "windowBounds");
  window?.hide();
  updateTray();
}

function setAlwaysOnTop(enabled) {
  store.set("alwaysOnTop", Boolean(enabled));
  alwaysOnTopYielded = false;
  window?.setAlwaysOnTop(Boolean(enabled), "floating");
  window?.webContents.send("settings:alwaysOnTop", Boolean(enabled));
  updateTray();
}

function focusCodexFromMonitor() {
  const shouldYieldAlwaysOnTop = Boolean(
    window &&
    !window.isDestroyed() &&
    store.get("alwaysOnTop", true) &&
    window.isAlwaysOnTop()
  );
  if (shouldYieldAlwaysOnTop) {
    window.setAlwaysOnTop(false);
    alwaysOnTopYielded = true;
  }
  const focused = focusCodexWindow();
  if (!focused && shouldYieldAlwaysOnTop) {
    window.setAlwaysOnTop(true, "floating");
    alwaysOnTopYielded = false;
  }
  return focused;
}

function markOrbNativeMove() {
  if (orbMoveSettledTimer) clearTimeout(orbMoveSettledTimer);
  orbMoveSettledTimer = setTimeout(() => {
    orbMoveSettledTimer = null;
    if (!isWindowCollapsed || !window || window.isDestroyed()) return;
    const bounds = window.getBounds();
    const anchor = normalizeWindowModeAnchor();
    saveWindowPosition(window, "windowBounds");
    store.set("orbWindowBounds", {
      x: Math.round(bounds.x + anchor.x - ORB_SIZE / 2),
      y: Math.round(bounds.y + anchor.y - ORB_SIZE / 2)
    });
  }, 180);
}

function handleOrbNativeGesture() {
  if (!isWindowCollapsed || isChangingWindowMode || !window || window.isDestroyed()) return;
  const startBounds = window.getBounds();
  let started = false;
  try {
    started = startSystemWindowMove(window.getNativeWindowHandle());
  } catch {
    started = false;
  }
  if (!started || !window || window.isDestroyed() || !isWindowCollapsed) return;

  const endBounds = window.getBounds();
  if (didWindowMove(startBounds, endBounds)) {
    markOrbNativeMove();
    return;
  }
  void setWindowMode(false, normalizeWindowModeAnchor());
}

function createWindow() {
  // The card and orb share one fixed native surface. Collapse only clips the
  // visible/hit-test region; it never hides, swaps, resizes, or remounts a window.
  isWindowCollapsed = false;
  store.set("windowCollapsed", false);
  const position = getWindowPosition(false);
  window = new BrowserWindow({
    ...position,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: WINDOW_WIDTH,
    minHeight: WINDOW_HEIGHT,
    maxWidth: WINDOW_WIDTH,
    maxHeight: WINDOW_HEIGHT,
    frame: false,
    thickFrame: false,
    transparent: true,
    icon: getWindowIconPath(),
    backgroundColor: "#00000000",
    resizable: false,
    movable: true,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: store.get("alwaysOnTop", true),
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.setAlwaysOnTop(store.get("alwaysOnTop", true), "floating");
  window.setResizable(false);
  window.setMinimumSize(WINDOW_WIDTH, WINDOW_HEIGHT);
  window.setMaximumSize(WINDOW_WIDTH, WINDOW_HEIGHT);
  let initialWindowShown = false;
  const showInitialWindow = () => {
    if (initialWindowShown || !window || window.isDestroyed()) return;
    initialWindowShown = true;
    isAppHidden = false;
    positionWindow(window, position);
    setWindowInteractive(window, true);
    window.show();
  };
  window.once("ready-to-show", showInitialWindow);
  window.webContents.once("did-finish-load", showInitialWindow);
  window.loadFile(path.join(__dirname, "renderer", "index.html"));
  window.on("move", () => {
    if (!isWindowCollapsed && !isChangingWindowMode) {
      scheduleWindowPositionSave(window, "windowBounds");
    }
  });
  window.on("moved", () => {
    if (isWindowCollapsed) markOrbNativeMove();
  });
  window.on("will-resize", event => {
    event.preventDefault();
  });
  window.on("close", event => {
    if (!isQuitting) {
      event.preventDefault();
      hideAppWindows();
    }
  });
  window.on("show", updateTray);
  window.on("focus", () => {
    if (!alwaysOnTopYielded || !store.get("alwaysOnTop", true)) return;
    window.setAlwaysOnTop(true, "floating");
    alwaysOnTopYielded = false;
  });
  window.on("hide", () => {
    updateTray();
  });
  if (process.argv.includes("--dev")) {
    window.webContents.openDevTools({ mode: "detach" });
  }
}

function getBackgroundDataUrl() {
  const backgroundPath = store.get("backgroundPath");
  if (!backgroundPath || !fs.existsSync(backgroundPath)) return null;
  try {
    const extension = path.extname(backgroundPath).toLowerCase();
    const mimeType = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif"
    }[extension];
    if (!mimeType) return null;
    return `data:${mimeType};base64,${fs.readFileSync(backgroundPath).toString("base64")}`;
  } catch {
    return null;
  }
}

function registerIpc() {
  ipcMain.handle("quota:read", () => quotaService.read());
  ipcMain.handle("codex:focus", () => focusCodexFromMonitor());
  ipcMain.handle("tasks:active-status", async () => {
    const result = await quotaService.readActiveTasks();
    return {
      available: Boolean(result.available),
      count: Number.isFinite(result.count) ? result.count : 0,
      observedAt: Number.isFinite(result.observedAt) ? result.observedAt : null
    };
  });
  ipcMain.handle("settings:read", () => ({
    language: store.get("language", "zh"),
    alwaysOnTop: store.get("alwaysOnTop", true),
    positionLocked: store.get("positionLocked", false),
    windowCollapsed: isWindowCollapsed,
    windowModeAnchor: normalizeWindowModeAnchor(),
    appIconDataUrl: getWindowIconDataUrl(),
    backgroundDataUrl: getBackgroundDataUrl(),
    backgroundOpacity: store.get("backgroundOpacity", 0.34)
  }));
  ipcMain.handle("settings:language", (_event, language) => {
    const next = language === "en" ? "en" : "zh";
    store.set("language", next);
    updateTray();
    return next;
  });
  ipcMain.handle("settings:alwaysOnTop", (_event, enabled) => {
    setAlwaysOnTop(enabled);
    return Boolean(enabled);
  });
  ipcMain.handle("settings:positionLocked", (_event, locked) => {
    const next = Boolean(locked);
    store.set("positionLocked", next);
    if (next) {
      saveWindowPosition(window, "windowBounds");
    }
    return next;
  });
  ipcMain.handle("window:setCollapsed", (_event, collapsed, anchor) => setWindowMode(collapsed, anchor));
  ipcMain.on("window:beginOrbGesture", handleOrbNativeGesture);
  ipcMain.handle("background:choose", async () => {
    const zh = isChinese();
    const result = await dialog.showOpenDialog(window, {
      title: zh ? "选择卡片背景图" : "Choose card background",
      properties: ["openFile"],
      filters: [
        { name: zh ? "图片" : "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }
      ]
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const sourcePath = result.filePaths[0];
    const stat = fs.statSync(sourcePath);
    if (stat.size > MAX_BACKGROUND_BYTES) return { canceled: false, error: "FILE_TOO_LARGE" };
    const extension = path.extname(sourcePath).toLowerCase();
    const mimeType = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif"
    }[extension];
    if (!mimeType) return { canceled: false, error: "UNSUPPORTED_FILE" };
    return {
      canceled: false,
      name: path.basename(sourcePath),
      dataUrl: `data:${mimeType};base64,${fs.readFileSync(sourcePath).toString("base64")}`
    };
  });
  ipcMain.handle("background:saveCropped", (_event, dataUrl) => {
    if (typeof dataUrl !== "string") return { error: "INVALID_IMAGE" };
    const match = dataUrl.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return { error: "INVALID_IMAGE" };
    const buffer = Buffer.from(match[2], "base64");
    if (!buffer.length || buffer.length > MAX_BACKGROUND_BYTES) return { error: "FILE_TOO_LARGE" };
    const destination = path.join(app.getPath("userData"), "custom-background.png");
    const previousPath = store.get("backgroundPath");
    fs.writeFileSync(destination, buffer, { mode: 0o600 });
    if (previousPath && previousPath !== destination && fs.existsSync(previousPath)) {
      try { fs.unlinkSync(previousPath); } catch {}
    }
    store.set("backgroundPath", destination);
    return { dataUrl: getBackgroundDataUrl() };
  });
  ipcMain.handle("background:opacity", (_event, opacity) => {
    const normalized = Math.min(0.85, Math.max(0.08, Number(opacity) || 0.34));
    store.set("backgroundOpacity", normalized);
    return normalized;
  });
  ipcMain.handle("background:clear", () => {
    const backgroundPath = store.get("backgroundPath");
    if (backgroundPath && fs.existsSync(backgroundPath)) {
      try { fs.unlinkSync(backgroundPath); } catch {}
    }
    store.set("backgroundPath", null);
    return true;
  });
  ipcMain.on("window:minimize", () => window?.minimize());
  ipcMain.on("window:hide", hideAppWindows);
}

if (hasSingleInstanceLock) app.whenReady().then(() => {
  app.setName(APP_NAME);
  app.setAppUserModelId("com.codex.quota-monitor");
  store = new JsonStore(path.join(app.getPath("userData"), "settings.json"));
  quotaService = new QuotaService({
    appStatePath: path.join(app.getPath("userData"), "quota-state.json")
  });
  registerIpc();
  createWindow();
  tray = new Tray(createTrayIcon());
  tray.setToolTip(getLocalizedAppName());
  tray.setContextMenu(buildTrayMenu());
  tray.on("click", () => {
    !isAppHidden ? hideAppWindows() : showWindow();
  });
  nativeTheme.on("updated", () => tray?.setImage(createTrayIcon()));
});

app.on("second-instance", () => {
  if (!hasSingleInstanceLock || !app.isReady()) return;
  showWindow();
});

app.on("before-quit", () => {
  isQuitting = true;
  if (orbMoveSettledTimer) clearTimeout(orbMoveSettledTimer);
  saveWindowPosition(window, "windowBounds");
  quotaService?.dispose();
});

app.on("window-all-closed", event => event.preventDefault());
