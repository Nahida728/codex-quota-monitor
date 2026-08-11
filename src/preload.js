const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("codexMonitor", {
  readQuota: () => ipcRenderer.invoke("quota:read"),
  readActiveTaskStatus: () => ipcRenderer.invoke("tasks:active-status"),
  focusCodex: () => ipcRenderer.invoke("codex:focus"),
  readSettings: () => ipcRenderer.invoke("settings:read"),
  setLanguage: language => ipcRenderer.invoke("settings:language", language),
  setAlwaysOnTop: enabled => ipcRenderer.invoke("settings:alwaysOnTop", enabled),
  setPositionLocked: locked => ipcRenderer.invoke("settings:positionLocked", locked),
  setTopDockEnabled: enabled => ipcRenderer.invoke("settings:topDockEnabled", enabled),
  setCollapsed: (collapsed, anchor) => ipcRenderer.invoke("window:setCollapsed", collapsed, anchor),
  revealTopDock: () => ipcRenderer.invoke("window:revealTopDock"),
  retractTopDock: () => ipcRenderer.invoke("window:retractTopDock"),
  confirmTopDockPaint: (requestId, rect) => ipcRenderer.send("window:topDockPaintReady", requestId, rect),
  notifyTopDockReady: () => ipcRenderer.send("window:topDockRendererReady"),
  beginOrbGesture: () => ipcRenderer.send("window:beginOrbGesture"),
  chooseBackground: () => ipcRenderer.invoke("background:choose"),
  saveCroppedBackground: dataUrl => ipcRenderer.invoke("background:saveCropped", dataUrl),
  setBackgroundOpacity: opacity => ipcRenderer.invoke("background:opacity", opacity),
  clearBackground: () => ipcRenderer.invoke("background:clear"),
  minimize: () => ipcRenderer.send("window:minimize"),
  hide: () => ipcRenderer.send("window:hide"),
  onRefresh: callback => ipcRenderer.on("quota:refresh", callback),
  onAlwaysOnTop: callback => ipcRenderer.on("settings:alwaysOnTop", (_event, enabled) => callback(enabled)),
  onWindowModeChanged: callback => ipcRenderer.on("window:modeChanged", (_event, collapsed, anchor) => callback(collapsed, anchor)),
  onTopDockChanged: callback => ipcRenderer.on("window:topDockChanged", (_event, state) => callback(state))
});
