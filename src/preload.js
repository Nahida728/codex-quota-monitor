const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("codexMonitor", {
  readQuota: () => ipcRenderer.invoke("quota:read"),
  readSettings: () => ipcRenderer.invoke("settings:read"),
  setLanguage: language => ipcRenderer.invoke("settings:language", language),
  setAlwaysOnTop: enabled => ipcRenderer.invoke("settings:alwaysOnTop", enabled),
  setPositionLocked: locked => ipcRenderer.invoke("settings:positionLocked", locked),
  chooseBackground: () => ipcRenderer.invoke("background:choose"),
  saveCroppedBackground: dataUrl => ipcRenderer.invoke("background:saveCropped", dataUrl),
  setBackgroundOpacity: opacity => ipcRenderer.invoke("background:opacity", opacity),
  clearBackground: () => ipcRenderer.invoke("background:clear"),
  minimize: () => ipcRenderer.send("window:minimize"),
  hide: () => ipcRenderer.send("window:hide"),
  onRefresh: callback => ipcRenderer.on("quota:refresh", callback),
  onAlwaysOnTop: callback => ipcRenderer.on("settings:alwaysOnTop", (_event, enabled) => callback(enabled))
});
