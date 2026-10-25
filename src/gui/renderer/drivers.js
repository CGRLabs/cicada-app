// ==========================================================================
// Drivers & Network View: OEM driver store, adapters, network janitor
// ==========================================================================

import {
  subTabDrivers,
  subTabNetwork,
  paneDrivers,
  paneNetwork,
  driverSearchInput,
  driverDryRunCheckbox,
  btnRefreshDrivers,
  pillTotalDrivers,
  pillProtectedDrivers,
  pillDuplicateDrivers,
  driversTableBody,
  driversLoadingState,
  driversNoResultsState,
  netOptDns,
  netOptArp,
  netDryRunToggle,
  btnCleanNetwork,
  netCleanStatusText,
  netCleanResultBox,
  btnRefreshNetwork,
  pillTotalAdapters,
  pillPhysicalAdapters,
  pillVirtualAdapters,
  networkAdaptersGrid,
  networkLoadingState
} from './dom.js';
import { escapeHtml, svgIcon } from './helpers.js';
import { S } from './state.js';
import { showToast, recordRpcActivity, showConfirm } from './components.js';
import { matchesFilters, syncFilters } from './filters.js';

// Sub-tab toggling (OEM Drivers vs Network & Janitor)
if (subTabDrivers && subTabNetwork) {
  subTabDrivers.addEventListener('click', () => {
    subTabDrivers.classList.add('active');
    subTabNetwork.classList.remove('active');
    paneDrivers.style.display = 'flex';
    paneNetwork.style.display = 'none';
  });

  subTabNetwork.addEventListener('click', () => {
    subTabNetwork.classList.add('active');
    subTabDrivers.classList.remove('active');
    paneDrivers.style.display = 'none';
    paneNetwork.style.display = 'block';
    if (S.allAdapters.length === 0 && !S.isScanningNetwork) {
      fetchNetwork(false);
    }
  });
}

// Fetch installed OEM drivers
export async function fetchDrivers(refresh = false) {
  if (S.isScanningDrivers) return;
  S.isScanningDrivers = true;

  if (driversLoadingState) driversLoadingState.style.display = 'flex';
  if (driversNoResultsState) driversNoResultsState.style.display = 'none';
  if (btnRefreshDrivers) btnRefreshDrivers.disabled = true;

  const startTime = Date.now();
  try {
    if (!window.cicadaAPI || !window.cicadaAPI.listDrivers) {
      throw new Error('Cicada API bridge not available for drivers');
    }

    const res = await window.cicadaAPI.listDrivers({});
    const elapsed = Date.now() - startTime;
    recordRpcActivity('drivers.list', elapsed, !!(res && res.ok));

    if (res.ok && res.data && Array.isArray(res.data.drivers)) {
      S.allDrivers = res.data.drivers;
      applyDriverFilters();
      syncFilters('drivers', { rebuildOptions: true });
      document.dispatchEvent(new CustomEvent('cicada:data-changed'));
      if (refresh) {
        showToast(`Enumerated ${S.allDrivers.length} OEM driver packages`, 'info', 2500);
      }
    } else {
      const errMsg = (res && res.error) || 'Failed to enumerate drivers';
      showToast(errMsg, 'error');
      if (driversTableBody) {
        driversTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--danger-text);">${escapeHtml(errMsg)}</td></tr>`;
      }
    }
  } catch (err) {
    showToast(err.message, 'error');
    if (driversTableBody) {
      driversTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--danger-text);">Error: ${escapeHtml(err.message)}</td></tr>`;
    }
  } finally {
    S.isScanningDrivers = false;
    if (driversLoadingState) driversLoadingState.style.display = 'none';
    if (btnRefreshDrivers) btnRefreshDrivers.disabled = false;
  }
}

export function applyDriverFilters() {
  const query = (S.currentDriverSearch || '').trim().toLowerCase();

  S.filteredDrivers = S.allDrivers.filter((drv) => {
    // Search query match
    if (query) {
      const matchInf = drv.publishedName && drv.publishedName.toLowerCase().includes(query);
      const matchOrig = drv.originalFileName && drv.originalFileName.toLowerCase().includes(query);
      const matchProv = drv.provider && drv.provider.toLowerCase().includes(query);
      const matchClass = drv.className && drv.className.toLowerCase().includes(query);
      if (!matchInf && !matchOrig && !matchProv && !matchClass) return false;
    }

    // Facet filters (multi-select)
    return matchesFilters('drivers', drv);
  });

  renderDrivers();
}

function renderDrivers() {
  if (!driversTableBody) return;

  const total = S.allDrivers.length;
  const protectedCount = S.allDrivers.filter(d => d.isProtected).length;
  const dupCount = S.allDrivers.filter(d => d.isDuplicate).length;

  if (pillTotalDrivers) pillTotalDrivers.textContent = `${total} driver packages`;
  if (pillProtectedDrivers) pillProtectedDrivers.textContent = `${protectedCount} system protected`;
  if (pillDuplicateDrivers) pillDuplicateDrivers.textContent = `${dupCount} duplicate/old`;

  if (S.filteredDrivers.length === 0) {
    driversTableBody.innerHTML = '';
    if (driversNoResultsState) driversNoResultsState.style.display = 'flex';
    return;
  }

  if (driversNoResultsState) driversNoResultsState.style.display = 'none';

  driversTableBody.innerHTML = S.filteredDrivers.map((d) => {
    const isProtected = !!d.isProtected;
    const isDup = !!d.isDuplicate;
    const clsLower = (d.className || '').toLowerCase();

    let classBadgeClass = 'badge-tag';
    if (clsLower === 'display') classBadgeClass += ' badge-driver-display';
    else if (clsLower === 'net' || clsLower === 'netservice') classBadgeClass += ' badge-driver-net';
    else if (clsLower === 'media') classBadgeClass += ' badge-driver-media';
    else if (clsLower === 'system' || clsLower === 'scsiadapter') classBadgeClass += ' badge-driver-system';
    else classBadgeClass += ' win32';

    return `
      <tr class="driver-row ${isProtected ? 'protected-row' : ''}">
        <td>
          <span style="font-family: var(--font-mono); font-weight: 600; color: var(--text-primary);">${escapeHtml(d.publishedName || 'oem.inf')}</span>
        </td>
        <td>
          <span style="font-family: var(--font-mono); font-size: 11.5px; color: var(--text-secondary);">${escapeHtml(d.originalFileName || '-')}</span>
        </td>
        <td>
          <span style="font-weight: 500; color: var(--text-primary);">${escapeHtml(d.provider || 'Generic / Microsoft')}</span>
        </td>
        <td>
          <span class="${classBadgeClass}" style="font-size: 10px;">${escapeHtml(d.className || 'Unknown')}</span>
        </td>
        <td>
          <div style="font-size: 11.5px; color: var(--text-primary); font-family: var(--font-mono);">${escapeHtml(d.driverVersion || '-')}</div>
          <div style="font-size: 10.5px; color: var(--text-muted);">${escapeHtml(d.driverDate || '-')}</div>
        </td>
        <td>
          ${isProtected ?
            `<span class="badge-tag danger" title="Protected by authoritative System Deny-List">${svgIcon('shield')} Protected</span>` :
            (isDup ?
              `<span class="badge-tag warning" title="Older duplicate version detected">${svgIcon('warning')} Duplicate</span>` :
              `<span class="badge-tag success">Active</span>`)
          }
        </td>
        <td style="text-align: right;">
          ${isProtected ?
            `<button class="btn btn-secondary btn-sm" disabled title="Cannot delete: Protected by authoritative System Deny-List" style="opacity: 0.5;">Protected</button>` :
            `<button class="btn btn-danger btn-sm btn-delete-driver" data-inf="${escapeHtml(d.publishedName)}" data-orig="${escapeHtml(d.originalFileName || d.publishedName)}">Delete</button>`
          }
        </td>
      </tr>
    `;
  }).join('');

  // Attach delete handlers
  document.querySelectorAll('.btn-delete-driver').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const inf = btn.getAttribute('data-inf');
      const orig = btn.getAttribute('data-orig');
      const dryRun = driverDryRunCheckbox ? driverDryRunCheckbox.checked : true;

      const confirmed = await showConfirm({
        title: dryRun ? 'Simulate Driver Package Removal' : 'Delete Driver Package',
        tone: dryRun ? 'info' : 'danger',
        icon: dryRun ? 'search' : 'trash',
        message: dryRun
          ? `Simulate deletion of driver package <strong>${escapeHtml(inf)}</strong>? No system changes will be made.`
          : `Permanently delete <strong>${escapeHtml(inf)}</strong> from the Windows Driver Store? This cannot be undone.`,
        detail: `${escapeHtml(orig)}`,
        confirmLabel: dryRun ? 'Run Simulation' : 'Delete Permanently'
      });
      if (!confirmed) return;

      btn.disabled = true;
      btn.textContent = dryRun ? 'Simulating...' : 'Deleting...';

      const startTime = Date.now();
      try {
        if (!window.cicadaAPI || !window.cicadaAPI.deleteDriver) {
          throw new Error('Cicada API bridge not available');
        }

        const res = await window.cicadaAPI.deleteDriver({ id: inf, dryRun });
        const elapsed = Date.now() - startTime;
        recordRpcActivity('drivers.delete', elapsed, !!(res && res.ok));

        if (res.ok && res.data) {
          if (res.data.simulated) {
            showToast(`Simulation: Driver "${inf}" verified for safe deletion`, 'info', 3500);
          } else {
            showToast(`Driver package "${inf}" deleted from Driver Store`, 'success', 3500);
            S.allDrivers = S.allDrivers.filter(d => d.publishedName !== inf);
            applyDriverFilters();
            syncFilters('drivers', { rebuildOptions: true });
          }
        } else {
          showToast(res.error || 'Failed to remove driver package', 'error', 4000);
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Delete';
      }
    });
  });
}

// Driver search & filter listeners
if (driverSearchInput) {
  let debounceTimer;
  driverSearchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      S.currentDriverSearch = e.target.value;
      applyDriverFilters();
    }, 150);
  });
}

if (btnRefreshDrivers) {
  btnRefreshDrivers.addEventListener('click', () => fetchDrivers(true));
}

// Fetch Network Adapters
export async function fetchNetwork(refresh = false) {
  if (S.isScanningNetwork) return;
  S.isScanningNetwork = true;

  if (networkLoadingState) networkLoadingState.style.display = 'flex';
  if (btnRefreshNetwork) btnRefreshNetwork.disabled = true;

  const startTime = Date.now();
  try {
    if (!window.cicadaAPI || !window.cicadaAPI.listNetwork) {
      throw new Error('Cicada API bridge not available for network');
    }

    const res = await window.cicadaAPI.listNetwork({});
    const elapsed = Date.now() - startTime;
    recordRpcActivity('network.list', elapsed, !!(res && res.ok));

    if (res.ok && res.data && Array.isArray(res.data.adapters)) {
      S.allAdapters = res.data.adapters;
      renderNetworkAdapters();
      if (refresh) {
        showToast(`Discovered ${S.allAdapters.length} network interfaces`, 'info', 2500);
      }
    } else {
      const errMsg = (res && res.error) || 'Failed to list network adapters';
      showToast(errMsg, 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    S.isScanningNetwork = false;
    if (networkLoadingState) networkLoadingState.style.display = 'none';
    if (btnRefreshNetwork) btnRefreshNetwork.disabled = false;
  }
}

function formatLinkSpeed(speed) {
  if (!speed || speed <= 0) return 'Speed: Variable / Auto';
  if (speed >= 1000000000) return `${(speed / 1000000000).toFixed(0)} Gbps`;
  if (speed >= 1000000) return `${(speed / 1000000).toFixed(0)} Mbps`;
  return `${speed} bps`;
}

function renderNetworkAdapters() {
  if (!networkAdaptersGrid) return;

  const total = S.allAdapters.length;
  const physical = S.allAdapters.filter(a => !a.isVirtual).length;
  const virtual = S.allAdapters.filter(a => a.isVirtual).length;

  if (pillTotalAdapters) pillTotalAdapters.textContent = `${total} adapters`;
  if (pillPhysicalAdapters) pillPhysicalAdapters.textContent = `${physical} physical`;
  if (pillVirtualAdapters) pillVirtualAdapters.textContent = `${virtual} virtual / VPN`;

  networkAdaptersGrid.innerHTML = S.allAdapters.map((a) => {
    const isUp = a.status === 'Up';
    const isVirtual = !!a.isVirtual;
    const ipList = Array.isArray(a.ipv4Addresses) && a.ipv4Addresses.length > 0 ? a.ipv4Addresses.join(', ') : 'No IPv4 assigned';

    return `
      <div class="network-card">
        <div class="network-card-header">
          <div class="network-card-name">
            <span>${svgIcon(isVirtual ? 'server' : (a.type === 'Wireless80211' ? 'wifi' : 'plug'))}</span>
            <span>${escapeHtml(a.name || 'Adapter')}</span>
          </div>
          <div class="network-status-indicator">
            <span class="network-status-dot ${isUp ? 'up' : 'down'}"></span>
            <span style="font-size: 11px; color: ${isUp ? 'var(--success-text)' : 'var(--text-muted)'}; font-weight: 600;">${isUp ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>

        <div class="network-card-desc">${escapeHtml(a.description || 'Generic Adapter Interface')}</div>

        <div class="network-meta-list">
          <div class="network-meta-row">
            <span class="network-meta-label">Type</span>
            <span class="network-meta-val"><span class="badge-tag ${isVirtual ? 'store' : 'win32'}" style="font-size: 9.5px;">${isVirtual ? 'Virtual / VPN' : 'Physical Hardware'}</span></span>
          </div>
          <div class="network-meta-row">
            <span class="network-meta-label">IP Address</span>
            <span class="network-meta-val">${escapeHtml(ipList)}</span>
          </div>
          <div class="network-meta-row">
            <span class="network-meta-label">MAC Address</span>
            <span class="network-meta-val">${escapeHtml(a.macAddress || '-')}</span>
          </div>
          <div class="network-meta-row">
            <span class="network-meta-label">Link Speed</span>
            <span class="network-meta-val">${escapeHtml(formatLinkSpeed(a.speed))}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

if (btnRefreshNetwork) {
  btnRefreshNetwork.addEventListener('click', () => fetchNetwork(true));
}

// Clean Network Stack (DNS & ARP Cache)
if (btnCleanNetwork) {
  btnCleanNetwork.addEventListener('click', async () => {
    const doDns = netOptDns ? netOptDns.checked : true;
    const doArp = netOptArp ? netOptArp.checked : true;
    const dryRun = netDryRunToggle ? netDryRunToggle.checked : true;

    const tasks = [];
    if (doDns) tasks.push('dns');
    if (doArp) tasks.push('arp');

    if (tasks.length === 0) {
      showToast('Select at least one network cleaning task', 'warning');
      return;
    }

    if (!dryRun) {
      const confirmed = await showConfirm({
        title: 'Flush Network Stack',
        message: `Apply network cleanup to <strong>${tasks.map(t => t.toUpperCase()).join(' + ')}</strong>?`,
        detail: 'DNS resolver cache and/or ARP table entries will be cleared immediately.',
        confirmLabel: 'Flush Now'
      });
      if (!confirmed) return;
    }

    btnCleanNetwork.disabled = true;
    if (netCleanStatusText) netCleanStatusText.textContent = 'Flushing network stack...';

    const startTime = Date.now();
    try {
      if (!window.cicadaAPI || !window.cicadaAPI.cleanNetwork) {
        throw new Error('Cicada API bridge not available for network clean');
      }

      const res = await window.cicadaAPI.cleanNetwork({ tasks, dryRun });
      const elapsed = Date.now() - startTime;
      recordRpcActivity('network.clean', elapsed, !!(res && res.ok));

      if (res.ok && res.data) {
        const msg = res.data.message || 'Network cleanup completed successfully.';
        showToast(msg, 'success', 3500);

        if (netCleanStatusText) {
          netCleanStatusText.textContent = res.data.simulated ? 'Simulation completed' : 'Flushed successfully';
        }

        if (netCleanResultBox) {
          netCleanResultBox.style.display = 'block';
          const taskDetails = Array.isArray(res.data.tasks) ?
            res.data.tasks.map(t => `<div style="margin-top: 4px;">- <b>${escapeHtml(t.task.toUpperCase())}:</b> ${escapeHtml(t.message || t.status)}</div>`).join('') :
            msg;
          netCleanResultBox.innerHTML = `
            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
              ${svgIcon(res.data.simulated ? 'search' : 'check-circle')}
              <span>${res.data.simulated ? 'Dry-Run Simulation Results:' : 'Cleanup Operations Applied:'}</span>
            </div>
            ${taskDetails}
          `;
        }
      } else {
        const errMsg = (res && res.error) || 'Failed to clean network stack';
        showToast(errMsg, 'error');
        if (netCleanStatusText) netCleanStatusText.textContent = 'Failed';
      }
    } catch (err) {
      showToast(err.message, 'error');
      if (netCleanStatusText) netCleanStatusText.textContent = 'Error';
    } finally {
      btnCleanNetwork.disabled = false;
    }
  });
}
