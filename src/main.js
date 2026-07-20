const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, nativeTheme, screen, dialog } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { QuotaService } = require("./quota-service");
const { JsonStore } = require("./store");

let window;
let tray;
let quotaService;
let store;
let isQuitting = false;
let windowPositionSaveTimer = null;

const APP_NAME = "Codex 额度检测器";
const WINDOW_WIDTH = 460;
const WINDOW_HEIGHT = 690;
const MAX_BACKGROUND_BYTES = 20 * 1024 * 1024;

function isChinese() {
  return store?.get("language", "zh") === "zh";
}

function getLocalizedAppName() {
  return isChinese() ? APP_NAME : "Codex Quota Monitor";
}

function ensureWindowSize() {
  if (!window || window.isDestroyed()) return;
  const bounds = window.getBounds();
  if (bounds.width === WINDOW_WIDTH && bounds.height === WINDOW_HEIGHT) return;
  window.setBounds({
    x: bounds.x,
    y: bounds.y,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT
  }, false);
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

function saveWindowPosition() {
  if (!window || window.isDestroyed()) return;
  if (windowPositionSaveTimer) clearTimeout(windowPositionSaveTimer);
  windowPositionSaveTimer = null;
  const bounds = window.getBounds();
  store.set("windowBounds", { x: bounds.x, y: bounds.y });
}

function scheduleWindowPositionSave() {
  if (windowPositionSaveTimer) clearTimeout(windowPositionSaveTimer);
  windowPositionSaveTimer = setTimeout(saveWindowPosition, 250);
}

function getWindowPosition() {
  const saved = store.get("windowBounds");
  if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
    const visible = screen.getAllDisplays().some(({ workArea }) =>
      saved.x < workArea.x + workArea.width - 80 &&
      saved.x + WINDOW_WIDTH > workArea.x + 80 &&
      saved.y < workArea.y + workArea.height - 80 &&
      saved.y + WINDOW_HEIGHT > workArea.y + 80
    );
    if (visible) return saved;
  }
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: Math.round(workArea.x + workArea.width - WINDOW_WIDTH - 24),
    y: Math.round(workArea.y + 24)
  };
}

function buildTrayMenu() {
  const language = store.get("language", "zh");
  const zh = language === "zh";
  return Menu.buildFromTemplate([
    {
      label: window?.isVisible() ? (zh ? "隐藏卡片" : "Hide card") : (zh ? "显示卡片" : "Show card"),
      click: () => {
        window?.isVisible() ? window.hide() : showWindow();
      }
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
  if (!window) return;
  window.show();
  window.focus();
  updateTray();
}

function setAlwaysOnTop(enabled) {
  store.set("alwaysOnTop", Boolean(enabled));
  window?.setAlwaysOnTop(Boolean(enabled), "floating");
  window?.webContents.send("settings:alwaysOnTop", Boolean(enabled));
  updateTray();
}

function createWindow() {
  const position = getWindowPosition();
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
  window.loadFile(path.join(__dirname, "renderer", "index.html"));
  window.once("ready-to-show", () => window.show());
  window.on("moved", scheduleWindowPositionSave);
  window.on("will-resize", event => {
    event.preventDefault();
  });
  window.on("close", event => {
    if (!isQuitting) {
      event.preventDefault();
      window.hide();
      updateTray();
    }
  });
  window.on("show", updateTray);
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
  ipcMain.handle("settings:read", () => ({
    language: store.get("language", "zh"),
    alwaysOnTop: store.get("alwaysOnTop", true),
    positionLocked: store.get("positionLocked", false),
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
      saveWindowPosition();
    }
    return next;
  });
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
  ipcMain.on("window:hide", () => window?.hide());
}

app.whenReady().then(() => {
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
    window?.isVisible() ? window.hide() : showWindow();
  });
  nativeTheme.on("updated", () => tray?.setImage(createTrayIcon()));
});

app.on("before-quit", () => {
  isQuitting = true;
  saveWindowPosition();
  quotaService?.dispose();
});

app.on("window-all-closed", event => event.preventDefault());
