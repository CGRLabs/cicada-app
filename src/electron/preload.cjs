const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cicadaAPI', {
  ping: () => ipcRenderer.invoke('engine:ping'),
  getEngineInfo: () => ipcRenderer.invoke('engine:get-info'),
  getApps: (options) => ipcRenderer.invoke('engine:get-apps', options),
  uninstallApp: (options) => ipcRenderer.invoke('engine:uninstall-app', options),
  uninstallBatch: (options) => ipcRenderer.invoke('engine:uninstall-batch', options),
  scanJunk: (options) => ipcRenderer.invoke('engine:scan-junk', options),
  cleanJunk: (options) => ipcRenderer.invoke('engine:clean-junk', options),
  listStartup: (options) => ipcRenderer.invoke('engine:list-startup', options),
  toggleStartup: (options) => ipcRenderer.invoke('engine:toggle-startup', options),
  deleteStartup: (options) => ipcRenderer.invoke('engine:delete-startup', options),
  getRestoreStatus: () => ipcRenderer.invoke('engine:get-restore-status'),
  createRestorePoint: (options) => ipcRenderer.invoke('engine:create-restore-point', options),
  listDrivers: (options) => ipcRenderer.invoke('engine:list-drivers', options),
  deleteDriver: (options) => ipcRenderer.invoke('engine:delete-driver', options),
  listNetwork: (options) => ipcRenderer.invoke('engine:list-network', options),
  cleanNetwork: (options) => ipcRenderer.invoke('engine:clean-network', options),

  // Smart Cache, Settings & Background Lifecycle
  getCachedApps: () => ipcRenderer.invoke('cache:get-apps'),
  getCacheStats: () => ipcRenderer.invoke('cache:get-stats'),
  clearCache: () => ipcRenderer.invoke('cache:clear'),
  getSettings: () => ipcRenderer.invoke('cache:get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('cache:save-settings', settings),
  quitApp: () => ipcRenderer.invoke('app:quit-completely'),
  onCacheUpdated: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('cache:updated', listener);
    return () => ipcRenderer.removeListener('cache:updated', listener);
  }
});
