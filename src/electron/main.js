import { app, BrowserWindow, ipcMain, Tray, Menu, nativeTheme } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { EngineClient, resolveEnginePath } from '../engine/client.js';
import { CacheManager } from './cache-manager.js';
import {
  sanitizeListAppsOptions,
  sanitizeUninstallAppOptions,
  sanitizeUninstallBatchOptions,
  sanitizeScanJunkOptions,
  sanitizeCleanJunkOptions,
  sanitizeListStartupOptions,
  sanitizeToggleStartupOptions,
  sanitizeDeleteStartupOptions,
  sanitizeCreateRestorePointOptions,
  sanitizeDeleteDriverOptions,
  sanitizeCleanNetworkOptions,
  sanitizeSettings
} from './ipc-validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// The brand mark is a flat monochrome glyph, so a single icon cannot read on both light
// and dark window chrome. `scripts/generate-icons.ps1` emits both inks; pick the one that
// contrasts with the current OS theme and re-pick it whenever the theme changes.
const ICON_DARK_SURFACES = join(__dirname, '../../assets/icon.ico');        // white mark
const ICON_LIGHT_SURFACES = join(__dirname, '../../assets/icon-light.ico'); // deep-slate mark

function resolveAppIcon() {
  return nativeTheme.shouldUseDarkColors ? ICON_DARK_SURFACES : ICON_LIGHT_SURFACES;
}

let mainWindow = null;
let engineClient = null;
let cacheManager = null;
let tray = null;
let backgroundTimer = null;
let isScanningBackground = false;
let isQuitting = false;

function createEngineClient() {
  const enginePath = resolveEnginePath();
  engineClient = new EngineClient({
    enginePath,
    timeoutMs: 8000
  });

  ipcMain.handle('engine:ping', async () => {
    try {
      const result = await engineClient.ping();
      return {
        ok: true,
        data: result,
        enginePath: engineClient.enginePath
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message,
        enginePath: engineClient?.enginePath || null
      };
    }
  });

  ipcMain.handle('engine:get-apps', async (event, options = {}) => {
    try {
      const result = await engineClient.getApps(sanitizeListAppsOptions(options));
      if (result && Array.isArray(result.apps)) {
        await cacheManager.saveAppsCache(result.apps);
        updateTrayTooltip(`Cicada Uninstaller — Ready (${result.apps.length} apps cached)`);
      }
      return {
        ok: true,
        data: result
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message
      };
    }
  });

  ipcMain.handle('engine:uninstall-app', async (event, options = {}) => {
    try {
      const result = await engineClient.uninstallApp(sanitizeUninstallAppOptions(options));
      return {
        ok: true,
        data: result
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message,
        code: err.code
      };
    }
  });

  ipcMain.handle('engine:uninstall-batch', async (event, options = {}) => {
    try {
      const result = await engineClient.uninstallBatch(sanitizeUninstallBatchOptions(options));
      return {
        ok: true,
        data: result
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message,
        code: err.code
      };
    }
  });

  ipcMain.handle('engine:scan-junk', async (event, options = {}) => {
    try {
      const result = await engineClient.scanJunk(sanitizeScanJunkOptions(options));
      return {
        ok: true,
        data: result
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message,
        code: err.code
      };
    }
  });

  ipcMain.handle('engine:clean-junk', async (event, options = {}) => {
    try {
      const result = await engineClient.cleanJunk(sanitizeCleanJunkOptions(options));
      return {
        ok: true,
        data: result
      };
    } catch (err) {
      return {
        ok: false,
        error: err.message,
        code: err.code
      };
    }
  });

  ipcMain.handle('engine:list-startup', async (event, options = {}) => {
    try {
      const result = await engineClient.listStartup(sanitizeListStartupOptions(options));
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: err.message, code: err.code };
    }
  });

  ipcMain.handle('engine:toggle-startup', async (event, options = {}) => {
    try {
      const result = await engineClient.toggleStartup(sanitizeToggleStartupOptions(options));
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: err.message, code: err.code };
    }
  });

  ipcMain.handle('engine:delete-startup', async (event, options = {}) => {
    try {
      const result = await engineClient.deleteStartup(sanitizeDeleteStartupOptions(options));
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: err.message, code: err.code };
    }
  });

  ipcMain.handle('engine:get-restore-status', async () => {
    try {
      const result = await engineClient.getRestoreStatus();
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: err.message, code: err.code };
    }
  });

  ipcMain.handle('engine:create-restore-point', async (event, options = {}) => {
    try {
      const result = await engineClient.createRestorePoint(sanitizeCreateRestorePointOptions(options));
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: err.message, code: err.code };
    }
  });

  ipcMain.handle('engine:list-drivers', async (event, options = {}) => {
    try {
      const result = await engineClient.listDrivers(options);
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: err.message, code: err.code };
    }
  });

  ipcMain.handle('engine:delete-driver', async (event, options = {}) => {
    try {
      const result = await engineClient.deleteDriver(sanitizeDeleteDriverOptions(options));
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: err.message, code: err.code };
    }
  });

  ipcMain.handle('engine:list-network', async (event, options = {}) => {
    try {
      const result = await engineClient.listNetwork(options);
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: err.message, code: err.code };
    }
  });

  ipcMain.handle('engine:clean-network', async (event, options = {}) => {
    try {
      const result = await engineClient.cleanNetwork(sanitizeCleanNetworkOptions(options));
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: err.message, code: err.code };
    }
  });

  ipcMain.handle('engine:get-info', () => {
    return {
      enginePath: engineClient?.enginePath || null,
      isConnected: engineClient?.isConnected || false
    };
  });

  // Smart Cache, Settings & Lifecycle Handlers
  ipcMain.handle('cache:get-apps', () => {
    return cacheManager ? cacheManager.getCachedApps() : null;
  });

  ipcMain.handle('cache:get-stats', async () => {
    return cacheManager ? await cacheManager.getCacheStats() : null;
  });

  ipcMain.handle('cache:clear', async () => {
    if (cacheManager) {
      await cacheManager.clearCache();
      updateTrayMenu();
      return { ok: true };
    }
    return { ok: false };
  });

  ipcMain.handle('cache:get-settings', () => {
    return cacheManager ? cacheManager.getSettings() : {};
  });

  ipcMain.handle('cache:save-settings', async (event, newSettings) => {
    if (!cacheManager) return {};
    const updated = await cacheManager.saveSettings(sanitizeSettings(newSettings));
    setupBackgroundTimer();
    updateTrayMenu();
    return updated;
  });

  ipcMain.handle('app:quit-completely', () => {
    quitAppCompletely();
  });
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  } else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }
}

function updateTrayTooltip(text) {
  if (tray && !tray.isDestroyed()) {
    try {
      tray.setToolTip(text);
    } catch {
      // Ignore
    }
  }
}

function updateTrayMenu() {
  if (!tray || tray.isDestroyed()) return;

  const settings = cacheManager ? cacheManager.getSettings() : {};
  const stats = cacheManager ? cacheManager.getCachedApps() : null;
  const countText = stats ? `${stats.appCount} apps cached` : 'No cache yet';

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Cicada Uninstaller',
      click: () => showMainWindow()
    },
    {
      label: isScanningBackground ? 'Scanning Inventory...' : 'Scan Inventory Now',
      enabled: !isScanningBackground,
      click: () => triggerBackgroundScan()
    },
    { type: 'separator' },
    {
      label: `Cache Status: ${countText}`,
      enabled: false
    },
    {
      label: 'Keep Cache Warm in Background',
      type: 'checkbox',
      checked: !!settings.backgroundRefresh,
      click: async (item) => {
        await cacheManager.saveSettings({ backgroundRefresh: item.checked });
        setupBackgroundTimer();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('settings:updated', cacheManager.getSettings());
        }
      }
    },
    {
      label: 'Minimize to Tray on Close',
      type: 'checkbox',
      checked: !!settings.minimizeToTray,
      click: async (item) => {
        await cacheManager.saveSettings({ minimizeToTray: item.checked });
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('settings:updated', cacheManager.getSettings());
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Clear Local Cache',
      click: async () => {
        if (cacheManager) {
          await cacheManager.clearCache();
          updateTrayMenu();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('cache:cleared');
          }
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Cicada Completely',
      click: () => quitAppCompletely()
    }
  ]);

  try {
    tray.setContextMenu(contextMenu);
  } catch {
    // Ignore in non-GUI / test environments
  }
}

function createTray() {
  const isTest = process.env.CICADA_TEST_EXIT || process.argv.includes('--test-launch');
  if (isTest || tray) return;

  try {
    tray = new Tray(resolveAppIcon());
    tray.setToolTip('Cicada Uninstaller — Instant Inventory Ready');

    tray.on('click', () => {
      showMainWindow();
    });

    tray.on('double-click', () => {
      showMainWindow();
    });

    updateTrayMenu();
  } catch (err) {
    console.warn('System tray could not be initialized:', err.message);
    tray = null;
  }
}

async function triggerBackgroundScan() {
  if (!engineClient || isScanningBackground) return;
  isScanningBackground = true;
  updateTrayTooltip('Cicada Uninstaller — Scanning in background...');
  updateTrayMenu();

  try {
    const result = await engineClient.getApps({ refresh: true });
    if (result && Array.isArray(result.apps) && cacheManager) {
      await cacheManager.saveAppsCache(result.apps);
      updateTrayTooltip(`Cicada Uninstaller — Ready (${result.apps.length} apps cached)`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('cache:updated', {
          apps: result.apps,
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch (err) {
    updateTrayTooltip('Cicada Uninstaller — Ready');
  } finally {
    isScanningBackground = false;
    updateTrayMenu();
  }
}

function setupBackgroundTimer() {
  if (backgroundTimer) {
    clearInterval(backgroundTimer);
    backgroundTimer = null;
  }

  const isTest = process.env.CICADA_TEST_EXIT || process.argv.includes('--test-launch');
  if (isTest || !cacheManager) return;

  const settings = cacheManager.getSettings();
  if (!settings.backgroundRefresh || !settings.refreshIntervalMinutes || settings.refreshIntervalMinutes <= 0) {
    return;
  }

  const intervalMs = settings.refreshIntervalMinutes * 60 * 1000;
  backgroundTimer = setInterval(async () => {
    try {
      await triggerBackgroundScan();
    } catch {
      // Ignore background errors
    }
  }, intervalMs);
}

function quitAppCompletely() {
  isQuitting = true;
  if (backgroundTimer) {
    clearInterval(backgroundTimer);
    backgroundTimer = null;
  }
  if (tray && !tray.isDestroyed()) {
    try {
      tray.destroy();
    } catch {
      // Ignore
    }
    tray = null;
  }
  app.quit();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 800,
    minHeight: 560,
    title: 'Cicada Uninstaller',
    icon: resolveAppIcon(),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0a0e14' : '#f8fafc',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      preload: join(__dirname, 'preload.cjs')
    }
  });

  mainWindow.loadFile(join(__dirname, '../gui/index.html'));

  // Renderer containment: the shell is a dumb client with no reason to ever leave
  // the bundled GUI. Block in-window navigation and deny every window.open target.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
    }
  });

  mainWindow.on('close', (event) => {
    const isTest = process.env.CICADA_TEST_EXIT || process.argv.includes('--test-launch');
    if (isQuitting || isTest) {
      return;
    }

    const settings = cacheManager ? cacheManager.getSettings() : {};
    if (settings.minimizeToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  if (process.env.CICADA_TEST_EXIT || process.argv.includes('--test-launch')) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        quitAppCompletely();
      }, 1500);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Single instance: a second launch would race the tray timer for the snapshot cache
// file lock and spawn duplicate engine processes. Focus the existing window instead.
// Test launches are exempt so the suite stays independent of a running app.
const isTestLaunch = process.env.CICADA_TEST_EXIT === '1' || process.argv.includes('--test-launch');
const gotSingleInstanceLock = isTestLaunch || app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });
}

app.whenReady().then(async () => {
  // The renderer handles every shortcut itself (Ctrl+1..6, Ctrl+F, Delete, Esc);
  // the default menu only adds reload/devtools surfaces we do not want in production.
  Menu.setApplicationMenu(null);

  cacheManager = new CacheManager(app.getPath('userData'));
  await cacheManager.init();

  createEngineClient();
  createWindow();
  createTray();
  setupBackgroundTimer();

  // Keep the monochrome brand mark legible when the OS theme flips.
  nativeTheme.on('updated', () => {
    const icon = resolveAppIcon();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIcon(icon);
    }
    if (tray && !tray.isDestroyed()) {
      try {
        tray.setImage(icon);
      } catch {
        // Ignore in environments without a real tray.
      }
    }
  });

  app.on('activate', () => {
    showMainWindow();
  });
});

app.on('window-all-closed', () => {
  const isTest = process.env.CICADA_TEST_EXIT || process.argv.includes('--test-launch');
  if (isTest || isQuitting) {
    quitAppCompletely();
    return;
  }

  const settings = cacheManager ? cacheManager.getSettings() : {};
  if (!settings.minimizeToTray) {
    quitAppCompletely();
  }
});

app.on('before-quit', async () => {
  isQuitting = true;
  if (backgroundTimer) {
    clearInterval(backgroundTimer);
    backgroundTimer = null;
  }
  if (engineClient) {
    await engineClient.stop();
  }
});
