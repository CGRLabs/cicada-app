// ==========================================================================
// Diagnostics View: engine health, RPC activity log
// ==========================================================================

import {
  diagStatusBadge,
  diagStatusBadgeText,
  diagErrorBanner,
  diagMetricEngine,
  diagMetricVersion,
  diagMetricPlatform,
  diagMetricElevation,
  diagMetricPath,
  diagPingBtn,
  diagTimestamp,
  headerElevationBadge,
  headerElevationText
} from './dom.js';
import { S } from './state.js';
import { recordRpcActivity } from './components.js';
import { updateStatusBar } from './shell.js';

export async function runDiagnostics() {
  diagStatusBadge.className = 'badge';
  diagStatusBadgeText.textContent = 'Querying Engine...';
  diagErrorBanner.style.display = 'none';
  diagPingBtn.disabled = true;

  const startTime = Date.now();
  try {
    if (!window.cicadaAPI) {
      throw new Error('Cicada API bridge not available');
    }

    const response = await window.cicadaAPI.ping();
    const elapsed = Date.now() - startTime;
    recordRpcActivity('engine.ping', elapsed, !!(response && response.ok));

    if (response.ok && response.data) {
      S.engineInfo.connected = true;
      S.engineInfo.version = response.data.version || '1.0.0';
      S.engineInfo.platform = response.data.platform ? response.data.platform.toUpperCase() : 'X64';
      S.engineInfo.elevated = !!response.data.elevated;

      diagStatusBadge.className = 'badge badge-connected';
      diagStatusBadgeText.textContent = 'Connected';
      diagErrorBanner.style.display = 'none';

      diagMetricEngine.textContent = response.data.engine || 'cicada-engine';
      diagMetricVersion.textContent = `v${response.data.version || '1.0.0'}`;
      diagMetricPlatform.textContent = S.engineInfo.platform;
      diagMetricElevation.textContent = S.engineInfo.elevated
        ? 'Elevated (Administrator)'
        : 'Unelevated (Standard User)';
      diagMetricPath.textContent = response.enginePath || 'Bundled executable';

      diagTimestamp.textContent = `Last ping: ${new Date().toLocaleTimeString()} (${elapsed}ms)`;

      // Update header elevation badge
      if (S.engineInfo.elevated) {
        headerElevationBadge.className = 'elevation-badge elevated';
        headerElevationText.textContent = 'Elevated';
        headerElevationBadge.title = 'Running with Administrator privileges';
      } else {
        headerElevationBadge.className = 'elevation-badge unelevated';
        headerElevationText.textContent = 'Unelevated';
        headerElevationBadge.title = 'Running as standard user (elevation recommended for system apps)';
      }

      updateStatusBar();
    } else {
      S.engineInfo.connected = false;
      diagStatusBadge.className = 'badge badge-disconnected';
      diagStatusBadgeText.textContent = 'Disconnected';
      diagErrorBanner.textContent = `Engine Error: ${response.error || 'Unknown error'}`;
      diagErrorBanner.style.display = 'flex';
      updateStatusBar();
    }
  } catch (err) {
    S.engineInfo.connected = false;
    diagStatusBadge.className = 'badge badge-disconnected';
    diagStatusBadgeText.textContent = 'Disconnected';
    diagErrorBanner.textContent = `Communication Error: ${err.message}`;
    diagErrorBanner.style.display = 'flex';
    updateStatusBar();
  } finally {
    diagPingBtn.disabled = false;
  }
}

diagPingBtn.addEventListener('click', runDiagnostics);
