// ==========================================================================
// Cicada Uninstaller - Renderer Entry Point
// ==========================================================================
// Imports every module (which wires their DOM listeners at eval time), then
// installs global behaviours: error surface, keyboard shortcuts, the
// background-cache update listener, and the boot sequence.

import {
  searchInput,
  detailDrawer,
  uninstallModal,
  confirmModal,
  scanElapsedInfo
} from './dom.js';
import { S } from './state.js';
import { showToast, closeConfirmModal } from './components.js';
import { FILTER_DEFS, setFilterPopoverOpen, registerFilterApplyHooks } from './filters.js';
import { switchTab, registerTabHooks, updateStatusBar } from './shell.js';
import {
  applyFilterAndSort,
  renderVirtualApps,
  fetchApplications,
  closeDetailDrawer,
  closeUninstallModal,
  openUninstallModal
} from './apps.js';
import { populateJunkTargetPicker } from './junk.js';
import { fetchStartup, renderStartupGroups } from './startup.js';
import { fetchDrivers, fetchNetwork, applyDriverFilters } from './drivers.js';
import { updateCacheDiagnosticsView, fetchRestoreStatus } from './settings.js';
import { runDiagnostics } from './diagnostics.js';
// Side-effect import: the dashboard self-wires (deep links + data-changed
// listener) at eval time; nothing else needs its exports.
import './dashboard.js';
import { closeCommandPalette, isPaletteOpen } from './palette.js';

// -------------------------------------------------------------
// Late-bound hooks (avoid circular imports between modules)
// -------------------------------------------------------------
registerTabHooks({
  fetchStartup,
  fetchDrivers,
  fetchNetwork,
  updateCacheDiagnosticsView,
  populateJunkTargetPicker,
  renderVirtualApps
});

registerFilterApplyHooks({
  apps: applyFilterAndSort,
  startup: renderStartupGroups,
  drivers: applyDriverFilters
});

// -------------------------------------------------------------
// Global Failure Surface
// -------------------------------------------------------------
// Production: unexpected renderer errors surface as toasts (and land on stderr
// via Electron's default logging) instead of failing silently.
function installGlobalErrorHandlers() {
  window.addEventListener('error', (event) => {
    const message = event && event.error && event.error.message ? event.error.message : 'Unexpected error';
    showToast(`UI error: ${message}`, 'error');
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event && event.reason ? event.reason : null;
    const message = reason && reason.message ? reason.message : String(reason || 'Unexpected async failure');
    showToast(`UI error: ${message}`, 'error');
  });
}
installGlobalErrorHandlers();

// -------------------------------------------------------------
// Keyboard Accessibility & Global Shortcuts
// -------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  // Ctrl + 1..7 Tab Navigation
  if (e.ctrlKey && !e.shiftKey && !e.altKey) {
    if (e.key === '1') {
      e.preventDefault();
      switchTab('dashboard');
    } else if (e.key === '2') {
      e.preventDefault();
      switchTab('apps');
    } else if (e.key === '3') {
      e.preventDefault();
      switchTab('junk');
    } else if (e.key === '4') {
      e.preventDefault();
      switchTab('startup');
    } else if (e.key === '5') {
      e.preventDefault();
      switchTab('drivers');
    } else if (e.key === '6') {
      e.preventDefault();
      switchTab('settings');
    } else if (e.key === '7') {
      e.preventDefault();
      switchTab('diagnostics');
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  }

  // Escape key closes palette, confirm modal, uninstall modal or detail drawer
  if (e.key === 'Escape') {
    if (isPaletteOpen()) {
      closeCommandPalette();
    } else if (confirmModal && confirmModal.classList.contains('open')) {
      closeConfirmModal(false);
    } else if (uninstallModal.classList.contains('open')) {
      closeUninstallModal();
    } else if (detailDrawer.classList.contains('open')) {
      closeDetailDrawer();
    } else {
      // Nothing above consumed it — dismiss any open filter popover.
      Object.keys(FILTER_DEFS).forEach((kind) => setFilterPopoverOpen(kind, false));
    }
  }

  // Delete key on selected application triggers uninstallation
  if (e.key === 'Delete' && S.selectedApp && !uninstallModal.classList.contains('open')) {
    const isProtected = S.selectedApp.isProtected || S.selectedApp.isSystemComponent;
    if (!isProtected && !(confirmModal && confirmModal.classList.contains('open'))) {
      openUninstallModal();
    }
  }
});

// -------------------------------------------------------------
// Background cache updates pushed from the main process
// -------------------------------------------------------------
if (window.cicadaAPI && window.cicadaAPI.onCacheUpdated) {
  window.cicadaAPI.onCacheUpdated((data) => {
    if (data && Array.isArray(data.apps)) {
      S.allApps = [...data.apps];
      S.lastScanDate = data.timestamp ? new Date(data.timestamp) : new Date();
      applyFilterAndSort();
      updateStatusBar();
      scanElapsedInfo.textContent = `Updated in background (${data.apps.length} apps)`;
      showToast(`Inventory updated in background (${data.apps.length} apps)`, 'info', 2500);
      updateCacheDiagnosticsView();
    }
  });
}

// -------------------------------------------------------------
// Initial Boot Sequence with Instant Hydration
// -------------------------------------------------------------
async function bootCicada() {
  runDiagnostics();
  fetchRestoreStatus();
  updateCacheDiagnosticsView();

  let hasHydrated = false;
  try {
    if (window.cicadaAPI && window.cicadaAPI.getCachedApps) {
      const cached = await window.cicadaAPI.getCachedApps();
      if (cached && Array.isArray(cached.apps) && cached.apps.length > 0) {
        S.allApps = [...cached.apps];
        S.lastScanDate = cached.timestamp ? new Date(cached.timestamp) : new Date();
        applyFilterAndSort();
        scanElapsedInfo.textContent = `Instant snapshot (${cached.apps.length} apps) | Verifying fresh state...`;
        updateStatusBar();
        hasHydrated = true;
      }
    }
  } catch {
    // Fall back to direct scan
  }

  // Trigger live scan in background
  fetchApplications(!hasHydrated);
}

bootCicada();
