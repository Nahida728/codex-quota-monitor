const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("codexMonitor", {
  readQuota: () => ipcRenderer.invoke("quota:read"),
  rescanCost: () => ipcRenderer.invoke("cost:rescan"),
  onCost: callback => {
    const listener = (_event, cost) => callback(cost);
    ipcRenderer.on("cost:snapshot", listener);
    return () => ipcRenderer.removeListener("cost:snapshot", listener);
  },
  readMonitorUpdate: () => ipcRenderer.invoke("monitor-update:read"),
  checkMonitorUpdate: () => ipcRenderer.invoke("monitor-update:check"),
  installMonitorUpdate: () => ipcRenderer.invoke("monitor-update:install"),
  onMonitorUpdate: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("monitor-update:state", listener);
    return () => ipcRenderer.removeListener("monitor-update:state", listener);
  },
  readActiveTaskStatus: () => ipcRenderer.invoke("tasks:active-status"),
  focusCodex: () => ipcRenderer.invoke("codex:focus"),
  openResetSource: url => ipcRenderer.invoke("reset:open-source", url),
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
  onSnapshot: callback => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on("quota:snapshot", listener);
    return () => ipcRenderer.removeListener("quota:snapshot", listener);
  },
  onTasks: callback => {
    const listener = (_event, result) => callback(result);
    ipcRenderer.on("tasks:snapshot", listener);
    return () => ipcRenderer.removeListener("tasks:snapshot", listener);
  },
  onCheckpoints: callback => {
    const listener = (_event, checkpoint) => callback(checkpoint);
    ipcRenderer.on("checkpoints:snapshot", listener);
    return () => ipcRenderer.removeListener("checkpoints:snapshot", listener);
  },
  onAlwaysOnTop: callback => ipcRenderer.on("settings:alwaysOnTop", (_event, enabled) => callback(enabled)),
  onWindowModeChanged: callback => ipcRenderer.on("window:modeChanged", (_event, collapsed, anchor) => callback(collapsed, anchor)),
  onTopDockChanged: callback => ipcRenderer.on("window:topDockChanged", (_event, state) => callback(state))
});
