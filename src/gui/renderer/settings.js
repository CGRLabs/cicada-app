// ==========================================================================
// Settings & Shield View: offline cache, background settings, System Restore
// ==========================================================================

import {
  restoreStatusBadge,
  restoreStatusBadgeText,
  restoreDescInput,
  restoreSimulateCheck,
  createRestoreBtn,
  restoreFeedbackBanner,
  cacheStatusBadge,
  cacheStatusBadgeText,
  cacheDetailText,
  settingInstantCache,
  settingBackgroundRefresh,
  settingMinimizeToTray,
  settingRefreshInterval,
  refreshCacheBtn,
  clearCacheBtn,
  quitAppBtn
} from './dom.js';
import { formatSize, timeAgo } from './helpers.js';
import { showToast, recordRpcActivity, showConfirm } from './components.js';
import { fetchApplications } from './apps.js';

export async function updateCacheDiagnosticsView() {
  if (!window.cicadaAPI || !window.cicadaAPI.getCacheStats) return;

  try {
    const stats = await window.cicadaAPI.getCacheStats();
    if (cacheStatusBadge && cacheStatusBadgeText) {
      if (stats && stats.hasCache) {
        cacheStatusBadge.className = 'badge badge-ok';
        cacheStatusBadgeText.textContent = 'Snapshot Active';
      } else {
        cacheStatusBadge.className = 'badge badge-warning';
        cacheStatusBadgeText.textContent = 'No Snapshot';
      }
    }

    if (cacheDetailText) {
      if (stats && stats.hasCache) {
        const sizeFormatted = stats.fileSizeBytes > 0 ? `${(stats.fileSizeBytes / 1024).toFixed(1)} KB` : 'Cached';
        const age = stats.timestamp ? timeAgo(new Date(stats.timestamp)) : 'recently';
        cacheDetailText.textContent = `${stats.appCount} applications (${formatSize(stats.totalSizeKb)}) | Snapshot file: ${sizeFormatted} | Last updated: ${age}`;
      } else {
        cacheDetailText.textContent = 'No snapshot stored on disk. Next scan will automatically populate the snapshot.';
      }
    }

    if (window.cicadaAPI.getSettings) {
      const settings = await window.cicadaAPI.getSettings();
      if (settingInstantCache) settingInstantCache.checked = settings.instantCache !== false;
      if (settingBackgroundRefresh) settingBackgroundRefresh.checked = settings.backgroundRefresh !== false;
      if (settingMinimizeToTray) settingMinimizeToTray.checked = !!settings.minimizeToTray;
      if (settingRefreshInterval) settingRefreshInterval.value = String(settings.refreshIntervalMinutes ?? 30);
    }
  } catch (err) {
    if (cacheDetailText) cacheDetailText.textContent = `Could not query cache: ${err.message}`;
  }

  document.dispatchEvent(new CustomEvent('cicada:data-changed'));
}

async function saveCurrentSettings() {
  if (!window.cicadaAPI || !window.cicadaAPI.saveSettings) return;
  const newSettings = {
    instantCache: settingInstantCache ? settingInstantCache.checked : true,
    backgroundRefresh: settingBackgroundRefresh ? settingBackgroundRefresh.checked : true,
    minimizeToTray: settingMinimizeToTray ? settingMinimizeToTray.checked : false,
    refreshIntervalMinutes: settingRefreshInterval ? parseInt(settingRefreshInterval.value, 10) : 30
  };
  await window.cicadaAPI.saveSettings(newSettings);
  showToast('Background settings saved', 'info', 1500);
}

if (settingInstantCache) settingInstantCache.addEventListener('change', saveCurrentSettings);
if (settingBackgroundRefresh) settingBackgroundRefresh.addEventListener('change', saveCurrentSettings);
if (settingMinimizeToTray) settingMinimizeToTray.addEventListener('change', saveCurrentSettings);
if (settingRefreshInterval) settingRefreshInterval.addEventListener('change', saveCurrentSettings);

if (refreshCacheBtn) {
  refreshCacheBtn.addEventListener('click', () => {
    showToast('Refreshing inventory snapshot...', 'info', 2000);
    fetchApplications(true);
  });
}

if (clearCacheBtn) {
  clearCacheBtn.addEventListener('click', async () => {
    if (!window.cicadaAPI || !window.cicadaAPI.clearCache) return;

    const confirmed = await showConfirm({
      title: 'Purge Offline Snapshot',
      message: 'Delete the cached inventory snapshot stored on disk?',
      detail: 'A fresh scan will repopulate the snapshot on the next inventory refresh.',
      confirmLabel: 'Purge Snapshot'
    });
    if (!confirmed) return;

    await window.cicadaAPI.clearCache();
    await updateCacheDiagnosticsView();
    showToast('Local offline snapshot purged', 'info', 2500);
  });
}

if (quitAppBtn) {
  quitAppBtn.addEventListener('click', () => {
    if (window.cicadaAPI && window.cicadaAPI.quitApp) {
      window.cicadaAPI.quitApp();
    } else {
      window.close();
    }
  });
}

// -------------------------------------------------------------
// System Restore Controller
// -------------------------------------------------------------
export async function fetchRestoreStatus() {
  try {
    if (!window.cicadaAPI) return;

    const res = await window.cicadaAPI.getRestoreStatus();
    if (res.ok && res.data) {
      const isAvail = res.data.available;
      restoreStatusBadge.className = isAvail ? 'badge badge-ok' : 'badge badge-warning';
      restoreStatusBadgeText.textContent = isAvail ? 'Protection Active' : 'Disabled / Unavailable';
    }
  } catch (err) {
    restoreStatusBadge.className = 'badge badge-error';
    restoreStatusBadgeText.textContent = 'Check Failed';
  }
}

createRestoreBtn.addEventListener('click', async () => {
  const desc = restoreDescInput.value.trim() || 'Cicada Checkpoint';
  const simulate = restoreSimulateCheck.checked;

  createRestoreBtn.disabled = true;
  createRestoreBtn.textContent = 'Creating...';
  restoreFeedbackBanner.style.display = 'none';

  const startTime = Date.now();
  try {
    if (!window.cicadaAPI) {
      throw new Error('Cicada API bridge not available');
    }

    const res = await window.cicadaAPI.createRestorePoint({ description: desc, simulate });
    const elapsed = Date.now() - startTime;
    recordRpcActivity('restore.create', elapsed, !!(res && res.ok));

    if (res.ok && res.data) {
      restoreFeedbackBanner.textContent = res.data.message || 'System Restore point created successfully.';
      restoreFeedbackBanner.style.display = 'flex';
      showToast('System Restore checkpoint created', 'success', 4000);
    } else {
      restoreFeedbackBanner.textContent = res.error || 'Failed to create restore point.';
      restoreFeedbackBanner.style.display = 'flex';
      showToast(res.error || 'Restore creation failed', 'error');
    }
  } catch (err) {
    restoreFeedbackBanner.textContent = `Error: ${err.message}`;
    restoreFeedbackBanner.style.display = 'flex';
    showToast(err.message, 'error');
  } finally {
    createRestoreBtn.disabled = false;
    createRestoreBtn.textContent = 'Create Checkpoint';
  }
});
