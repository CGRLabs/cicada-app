// ==========================================================================
// Applications View: table, virtual scrolling, drawer, uninstall flows
// ==========================================================================

import {
  searchInput,
  refreshScanBtn,
  scanBtnIcon,
  appsSummary,
  totalSizeSummary,
  appsLargeSummary,
  appsResultCount,
  scanElapsedInfo,
  tableScrollContainer,
  appsTableBody,
  selectAllAppsCheck,
  loadingState,
  noResultsState,
  batchBar,
  batchCountText,
  batchUninstallBtn,
  batchClearBtn,
  detailDrawer,
  closeDrawerBtn,
  drawerAvatar,
  drawerTitle,
  drawerSubtitle,
  drawerPublisher,
  drawerVersion,
  drawerInstallDate,
  drawerSize,
  drawerType,
  drawerSilent,
  drawerLocation,
  drawerId,
  drawerUrl,
  drawerUrlField,
  copyPathBtn,
  uninstallBtn,
  scanAppJunkBtn,
  protectedNotice,
  uninstallModal,
  modalCloseX,
  modalCancelBtn,
  modalConfirmBtn,
  modalAppName,
  modalAppMeta,
  modalQuietCheck,
  modalSimulateCheck,
  modalAlert
} from './dom.js';
import {
  ROW_HEIGHT,
  BUFFER_ROWS,
  escapeHtml,
  svgIcon,
  debounce,
  formatSize,
  getSizeColor,
  getAvatarColor,
  getAppTypeBadge
} from './helpers.js';
import { S } from './state.js';
import { showToast, recordRpcActivity } from './components.js';
import { matchesFilters, syncFilters } from './filters.js';
import { switchTab, updateStatusBar } from './shell.js';
import { fetchJunk } from './junk.js';
import { updateCacheDiagnosticsView } from './settings.js';

// -------------------------------------------------------------
// Filtering & Sorting
// -------------------------------------------------------------
export function applyFilterAndSort() {
  const query = S.currentSearch.toLowerCase();

  S.filteredApps = S.allApps.filter((app) => {
    // Search match
    if (query) {
      const matchName = app.displayName && app.displayName.toLowerCase().includes(query);
      const matchPub = app.publisher && app.publisher.toLowerCase().includes(query);
      const matchLoc = app.installLocation && app.installLocation.toLowerCase().includes(query);
      const matchId = app.id && app.id.toLowerCase().includes(query);
      if (!matchName && !matchPub && !matchLoc && !matchId) return false;
    }

    // Facet filters (multi-select)
    return matchesFilters('apps', app);
  });

  // Sort
  S.filteredApps.sort((a, b) => {
    let valA, valB;
    switch (S.sortColumn) {
      case 'publisher':
        valA = (a.publisher || '').toLowerCase();
        valB = (b.publisher || '').toLowerCase();
        break;
      case 'version':
        valA = (a.displayVersion || '').toLowerCase();
        valB = (b.displayVersion || '').toLowerCase();
        break;
      case 'size':
        valA = a.estimatedSizeKb || 0;
        valB = b.estimatedSizeKb || 0;
        break;
      case 'type':
        valA = (a.uninstallerKind || '').toLowerCase();
        valB = (b.uninstallerKind || '').toLowerCase();
        break;
      case 'name':
      default:
        valA = (a.displayName || '').toLowerCase();
        valB = (b.displayName || '').toLowerCase();
        break;
    }

    if (valA < valB) return S.sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return S.sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Update Summary Chips
  appsSummary.textContent = `${S.filteredApps.length} apps`;
  const totalKb = S.filteredApps.reduce((acc, a) => acc + (a.estimatedSizeKb || 0), 0);
  totalSizeSummary.textContent = formatSize(totalKb);
  const largeCount = S.filteredApps.filter((a) => (a.estimatedSizeKb || 0) >= 100 * 1024).length;
  appsLargeSummary.textContent = `${largeCount} large (>100MB)`;

  if (appsResultCount) {
    appsResultCount.textContent = S.allApps.length === 0
      ? 'No inventory loaded'
      : `Showing ${S.filteredApps.length} of ${S.allApps.length} applications`;
  }

  updateBatchBar();

  if (S.filteredApps.length === 0) {
    noResultsState.style.display = 'flex';
  } else {
    noResultsState.style.display = 'none';
  }

  renderVirtualApps();
}

// -------------------------------------------------------------
// Virtual Scrolling Implementation
// -------------------------------------------------------------
export function renderVirtualApps() {
  if (!tableScrollContainer || S.isScanning) return;

  const total = S.filteredApps.length;
  if (total === 0) {
    appsTableBody.innerHTML = '';
    return;
  }

  const scrollTop = tableScrollContainer.scrollTop;
  const viewportHeight = tableScrollContainer.clientHeight || 500;

  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
  const endIdx = Math.min(total, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + BUFFER_ROWS);

  const topPadding = startIdx * ROW_HEIGHT;
  const bottomPadding = Math.max(0, (total - endIdx) * ROW_HEIGHT);

  const rowsHtml = [];

  // Top spacer
  if (topPadding > 0) {
    rowsHtml.push(`<tr class="virtual-spacer" style="height:${topPadding}px;"><td colspan="7" style="padding:0; border:none;"></td></tr>`);
  }

  for (let i = startIdx; i < endIdx; i++) {
    const app = S.filteredApps[i];
    const isSelected = S.selectedApp && S.selectedApp.id === app.id;
    const isChecked = S.selectedAppIds.has(app.id);
    const isProtected = app.isProtected || app.isSystemComponent;
    const firstLetter = (app.displayName || 'A').trim().charAt(0).toUpperCase();
    const avatarColor = getAvatarColor(app.displayName || '');
    const sizeColorClass = getSizeColor(app.estimatedSizeKb);

    const checkboxHtml = isProtected
      ? `<span title="Protected Windows system component" style="font-size:12px; opacity:0.6;">${svgIcon('shield')}</span>`
      : `<input type="checkbox" class="app-row-check" data-id="${escapeHtml(app.id)}" ${isChecked ? 'checked' : ''} />`;

    const silentHtml = app.quietUninstallPossible
      ? `<span class="silent-badge" title="Silent/Quiet uninstall supported">${svgIcon('check')}</span>`
      : `<span style="color:var(--text-muted); font-size:12px;">-</span>`;

    rowsHtml.push(`
      <tr class="app-table-row ${isSelected ? 'selected' : ''}" data-id="${escapeHtml(app.id)}" style="height:${ROW_HEIGHT}px;">
        <td class="col-check" style="text-align:center;">${checkboxHtml}</td>
        <td class="col-app">
          <div class="app-meta-cell">
            <div class="app-avatar" style="background-color: ${avatarColor};">${firstLetter}</div>
            <div class="app-name-block">
              <span class="app-name-title" title="${escapeHtml(app.displayName || '')}">${escapeHtml(app.displayName || 'Unnamed Application')}</span>
              <span class="app-name-sub">${escapeHtml(app.publisher || 'Unknown Publisher')}</span>
            </div>
          </div>
        </td>
        <td class="col-publisher">${escapeHtml(app.publisher || '-')}</td>
        <td class="col-version">${escapeHtml(app.displayVersion || '-')}</td>
        <td class="col-size size-cell ${sizeColorClass}">${formatSize(app.estimatedSizeKb)}</td>
        <td class="col-type" style="text-align:center;">${getAppTypeBadge(app)}</td>
        <td class="col-silent" style="text-align:center; position:relative;">
          ${silentHtml}
          <div class="row-actions">
            ${!isProtected ? `<button class="action-btn-mini danger quick-uninstall-btn" data-id="${escapeHtml(app.id)}" type="button" title="Quick Uninstall">Uninstall</button>` : ''}
            <button class="action-btn-mini quick-detail-btn" data-id="${escapeHtml(app.id)}" type="button" title="Details">${svgIcon('more')}</button>
          </div>
        </td>
      </tr>
    `);
  }

  // Bottom spacer
  if (bottomPadding > 0) {
    rowsHtml.push(`<tr class="virtual-spacer" style="height:${bottomPadding}px;"><td colspan="7" style="padding:0; border:none;"></td></tr>`);
  }

  appsTableBody.innerHTML = rowsHtml.join('');
  attachRowEventListeners();
}

function attachRowEventListeners() {
  const rows = appsTableBody.querySelectorAll('.app-table-row');
  rows.forEach((row) => {
    const id = row.getAttribute('data-id');
    const app = S.allApps.find((a) => a.id === id);
    if (!app) return;

    row.addEventListener('click', (e) => {
      if (e.target.closest('.app-row-check') || e.target.closest('.quick-uninstall-btn')) {
        return;
      }
      selectApp(app);
    });

    const chk = row.querySelector('.app-row-check');
    if (chk) {
      chk.addEventListener('click', (e) => e.stopPropagation());
      chk.addEventListener('change', () => {
        if (chk.checked) S.selectedAppIds.add(app.id);
        else S.selectedAppIds.delete(app.id);
        updateBatchBar();
      });
    }

    const quickUninstall = row.querySelector('.quick-uninstall-btn');
    if (quickUninstall) {
      quickUninstall.addEventListener('click', (e) => {
        e.stopPropagation();
        selectApp(app);
        openUninstallModal();
      });
    }

    const quickDetail = row.querySelector('.quick-detail-btn');
    if (quickDetail) {
      quickDetail.addEventListener('click', (e) => {
        e.stopPropagation();
        selectApp(app);
      });
    }
  });
}

// Throttle virtual scrolling with requestAnimationFrame
tableScrollContainer.addEventListener('scroll', () => {
  if (!S.isRenderingVirtual) {
    S.isRenderingVirtual = true;
    requestAnimationFrame(() => {
      renderVirtualApps();
      S.isRenderingVirtual = false;
    });
  }
});

// -------------------------------------------------------------
// Progressive Loading Pattern
// -------------------------------------------------------------
export async function fetchApplications(refresh = false) {
  if (S.isScanning) return;
  S.isScanning = true;

  const hasExistingData = S.allApps.length > 0;
  refreshScanBtn.disabled = true;
  scanBtnIcon.classList.add('spinning');

  if (!hasExistingData) {
    loadingState.style.display = 'block';
    appsTableBody.innerHTML = '';
  }
  noResultsState.style.display = 'none';
  scanElapsedInfo.textContent = hasExistingData ? 'Updating in background...' : 'Scanning...';

  const startTime = Date.now();
  try {
    if (!window.cicadaAPI) {
      throw new Error('Cicada API bridge not available');
    }

    const response = await window.cicadaAPI.getApps({ refresh });
    const elapsed = Date.now() - startTime;
    recordRpcActivity('apps.get', elapsed, !!(response && response.ok));

    if (response.ok && response.data && Array.isArray(response.data.apps)) {
      const rawApps = response.data.apps;
      S.lastScanDate = new Date();
      scanElapsedInfo.textContent = `Completed in ${elapsed}ms`;

      // Progressive Rendering Pattern: Ingest in chunks of 50 per frame
      S.allApps = [];
      const totalCount = rawApps.length;
      let chunkIdx = 0;
      const CHUNK_SIZE = 50;

      function renderNextChunk() {
        const nextBatch = rawApps.slice(chunkIdx, chunkIdx + CHUNK_SIZE);
        S.allApps.push(...nextBatch);
        chunkIdx += CHUNK_SIZE;

        // Live progress in the stats note while chunks stream in
        if (chunkIdx < totalCount) {
          scanElapsedInfo.textContent = `Scanning... ${S.allApps.length} of ${totalCount} apps`;
        }

        // Apply filters & render
        applyFilterAndSort();

        if (chunkIdx < totalCount) {
          requestAnimationFrame(renderNextChunk);
        } else {
          loadingState.style.display = 'none';
          S.isScanning = false;
          refreshScanBtn.disabled = false;
          scanBtnIcon.classList.remove('spinning');
          // renderVirtualApps() is a no-op while isScanning is set, so the final
          // paint has to happen after the flag is cleared.
          applyFilterAndSort();
          syncFilters('apps', { rebuildOptions: true });
          updateStatusBar();
          updateCacheDiagnosticsView();
          showToast(`Discovered ${S.allApps.length} installed applications`, 'success', 3000);
        }
      }

      // Initial chunk immediate
      loadingState.style.display = 'none';
      renderNextChunk();
    } else {
      loadingState.style.display = 'none';
      appsSummary.textContent = `Scan failed`;
      showToast(response.error || 'Failed to scan applications', 'error');
      S.isScanning = false;
      refreshScanBtn.disabled = false;
      scanBtnIcon.classList.remove('spinning');
    }
  } catch (err) {
    loadingState.style.display = 'none';
    appsSummary.textContent = `Error: ${err.message}`;
    showToast(`Scan error: ${err.message}`, 'error');
    S.isScanning = false;
    refreshScanBtn.disabled = false;
    scanBtnIcon.classList.remove('spinning');
  }
}

// -------------------------------------------------------------
// Column Header Sorting
// -------------------------------------------------------------
document.querySelectorAll('#appsTable th.sortable').forEach((th) => {
  th.addEventListener('click', () => {
    const col = th.getAttribute('data-sort');
    if (S.sortColumn === col) {
      S.sortDirection = S.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      S.sortColumn = col;
      S.sortDirection = col === 'size' ? 'desc' : 'asc';
    }

    document.querySelectorAll('#appsTable th.sortable').forEach((h) => {
      h.classList.remove('sorted-asc', 'sorted-desc');
    });

    th.classList.add(S.sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');

    applyFilterAndSort();
  });
});

// -------------------------------------------------------------
// Search and Filter Listeners
// -------------------------------------------------------------
const debouncedSearch = debounce((q) => {
  S.currentSearch = q.trim();
  applyFilterAndSort();
}, 150);

searchInput.addEventListener('input', (e) => {
  debouncedSearch(e.target.value);
});

refreshScanBtn.addEventListener('click', () => fetchApplications(true));

// -------------------------------------------------------------
// Detail Drawer Management
// -------------------------------------------------------------
export function selectApp(app) {
  S.selectedApp = app;

  drawerAvatar.style.backgroundColor = getAvatarColor(app.displayName || '');
  drawerAvatar.textContent = (app.displayName || 'A').trim().charAt(0).toUpperCase();
  drawerTitle.textContent = app.displayName || 'Application Details';
  drawerSubtitle.textContent = app.publisher || 'Unknown Publisher';

  drawerPublisher.textContent = app.publisher || '-';
  drawerVersion.textContent = app.displayVersion || '-';
  drawerInstallDate.textContent = app.installDate || '-';
  drawerSize.textContent = formatSize(app.estimatedSizeKb);
  drawerType.textContent = app.uninstallerKind || 'Standard';
  drawerSilent.textContent = app.quietUninstallPossible
    ? 'Supported (Unattended)'
    : 'Not supported (Manual wizard)';
  drawerLocation.textContent = app.installLocation || '-';
  drawerId.textContent = app.id || '-';

  if (app.aboutUrl || app.url) {
    drawerUrlField.style.display = 'flex';
    drawerUrl.innerHTML = `<a href="${escapeHtml(app.aboutUrl || app.url)}" target="_blank" style="color:var(--accent); text-decoration:none;">${escapeHtml(app.aboutUrl || app.url)}</a>`;
  } else {
    drawerUrlField.style.display = 'none';
  }

  copyPathBtn.disabled = !app.installLocation;
  copyPathBtn.innerHTML = `${svgIcon('copy')} Copy Install Path`;

  const isProtected = app.isProtected || app.isSystemComponent;
  if (isProtected) {
    protectedNotice.style.display = 'block';
    uninstallBtn.style.display = 'none';
  } else {
    protectedNotice.style.display = 'none';
    uninstallBtn.style.display = 'inline-flex';
  }

  detailDrawer.classList.add('open');
  renderVirtualApps();
}

export function closeDetailDrawer() {
  detailDrawer.classList.remove('open');
  S.selectedApp = null;
  renderVirtualApps();
}

closeDrawerBtn.addEventListener('click', closeDetailDrawer);

copyPathBtn.addEventListener('click', () => {
  if (S.selectedApp && S.selectedApp.installLocation) {
    navigator.clipboard.writeText(S.selectedApp.installLocation);
    copyPathBtn.innerHTML = `${svgIcon('check')} Copied to Clipboard!`;
    showToast('Path copied to clipboard', 'info', 2000);
    setTimeout(() => {
      copyPathBtn.innerHTML = `${svgIcon('copy')} Copy Install Path`;
    }, 2000);
  }
});

scanAppJunkBtn.addEventListener('click', () => {
  if (S.selectedApp) {
    const targetId = S.selectedApp.id;
    S.currentJunkTargetApp = targetId;
    closeDetailDrawer();
    switchTab('junk');
    fetchJunk(targetId);
  }
});

// -------------------------------------------------------------
// Floating Batch Action Bar
// -------------------------------------------------------------
export function updateBatchBar() {
  const count = S.selectedAppIds.size;
  if (count > 0) {
    batchBar.style.display = 'flex';

    // Danger budget: surface the cumulative footprint being removed.
    let selectedKb = 0;
    S.allApps.forEach((a) => {
      if (S.selectedAppIds.has(a.id)) selectedKb += a.estimatedSizeKb || 0;
    });
    const sizeText = selectedKb > 0 ? ` - ${formatSize(selectedKb)} to be removed` : '';
    batchCountText.textContent = `${count} application(s) selected${sizeText}`;

    selectAllAppsCheck.checked =
      S.allApps.length > 0 &&
      count === S.allApps.filter((a) => !a.isProtected && !a.isSystemComponent).length;
  } else {
    batchBar.style.display = 'none';
    selectAllAppsCheck.checked = false;
  }
}

selectAllAppsCheck.addEventListener('change', () => {
  if (selectAllAppsCheck.checked) {
    S.filteredApps.forEach((a) => {
      if (!a.isProtected && !a.isSystemComponent) {
        S.selectedAppIds.add(a.id);
      }
    });
  } else {
    S.filteredApps.forEach((a) => S.selectedAppIds.delete(a.id));
  }
  updateBatchBar();
  renderVirtualApps();
});

batchClearBtn.addEventListener('click', () => {
  S.selectedAppIds.clear();
  updateBatchBar();
  renderVirtualApps();
});

batchUninstallBtn.addEventListener('click', () => {
  if (S.selectedAppIds.size === 0) return;
  S.isBatchUninstall = true;
  modalAppName.textContent = `Batch Removal (${S.selectedAppIds.size} applications)`;
  modalAppMeta.textContent = `Selected: ${Array.from(S.selectedAppIds).slice(0, 3).join(', ')}${S.selectedAppIds.size > 3 ? ` + ${S.selectedAppIds.size - 3} more` : ''}`;
  modalQuietCheck.checked = true;
  modalQuietCheck.disabled = false;
  modalSimulateCheck.checked = false;
  modalAlert.style.display = 'none';
  modalConfirmBtn.textContent = 'Uninstall Selected';
  modalConfirmBtn.disabled = false;
  modalCancelBtn.disabled = false;
  modalCloseX.disabled = false;
  uninstallModal.classList.add('open');
});

// -------------------------------------------------------------
// Uninstall Confirmation Modal
// -------------------------------------------------------------
export function openUninstallModal() {
  if (!S.selectedApp) return;

  S.isBatchUninstall = false;
  modalAppName.textContent = S.selectedApp.displayName || 'Application';
  modalAppMeta.textContent = `${S.selectedApp.publisher || 'Unknown Publisher'} - ${S.selectedApp.displayVersion || 'Version not specified'}`;
  modalQuietCheck.checked = !!S.selectedApp.quietUninstallPossible;
  modalQuietCheck.disabled = !S.selectedApp.quietUninstallPossible;
  modalSimulateCheck.checked = false;
  modalAlert.style.display = 'none';
  modalAlert.textContent = '';
  modalConfirmBtn.disabled = false;
  modalCancelBtn.disabled = false;
  modalCloseX.disabled = false;
  modalConfirmBtn.textContent = 'Uninstall';

  uninstallModal.classList.add('open');
  // Anchor keyboard focus on the safe choice; the Tab-trap (components.js)
  // keeps it cycling inside the dialog from here.
  setTimeout(() => modalCancelBtn.focus(), 30);
}

export function closeUninstallModal() {
  uninstallModal.classList.remove('open');
}

uninstallBtn.addEventListener('click', openUninstallModal);
modalCloseX.addEventListener('click', closeUninstallModal);
modalCancelBtn.addEventListener('click', closeUninstallModal);

// Close modal on clicking backdrop
uninstallModal.addEventListener('click', (e) => {
  if (e.target === uninstallModal) {
    closeUninstallModal();
  }
});

modalConfirmBtn.addEventListener('click', async () => {
  const quiet = modalQuietCheck.checked;
  const simulate = modalSimulateCheck.checked;

  modalConfirmBtn.disabled = true;
  modalCancelBtn.disabled = true;
  modalCloseX.disabled = true;
  modalConfirmBtn.textContent = simulate ? 'Simulating...' : 'Uninstalling...';
  modalAlert.style.display = 'none';

  const startTime = Date.now();
  try {
    if (!window.cicadaAPI) {
      throw new Error('Cicada API bridge not available');
    }

    if (S.isBatchUninstall) {
      const res = await window.cicadaAPI.uninstallBatch({
        apps: Array.from(S.selectedAppIds),
        quiet,
        simulate
      });
      const elapsed = Date.now() - startTime;
      recordRpcActivity('apps.uninstallBatch', elapsed, !!(res && res.ok));

      if (res.ok && res.data) {
        modalAlert.style.display = 'flex';
        modalAlert.textContent = res.data.message || 'Batch uninstallation completed.';

        if (!simulate) {
          S.selectedAppIds.clear();
          showToast('Batch removal completed successfully', 'success');
          setTimeout(() => {
            closeUninstallModal();
            fetchApplications(true);
          }, 1500);
        } else {
          modalConfirmBtn.disabled = false;
          modalCancelBtn.disabled = false;
          modalCloseX.disabled = false;
          modalConfirmBtn.textContent = 'Simulate Again';
          showToast('Batch simulation completed', 'info');
        }
      } else {
        modalAlert.style.display = 'flex';
        modalAlert.textContent = `Batch error: ${res.error || 'Operation failed'}`;
        modalConfirmBtn.disabled = false;
        modalCancelBtn.disabled = false;
        modalCloseX.disabled = false;
        modalConfirmBtn.textContent = 'Retry Batch';
        showToast('Batch uninstallation encountered errors', 'error');
      }
      return;
    }

    if (!S.selectedApp) return;

    const res = await window.cicadaAPI.uninstallApp({
      id: S.selectedApp.id,
      quiet,
      simulate
    });
    const elapsed = Date.now() - startTime;
    recordRpcActivity('apps.uninstall', elapsed, !!(res && res.ok));

    if (res.ok && res.data) {
      if (simulate) {
        modalAlert.style.display = 'flex';
        modalAlert.textContent = `Simulation successful: Exit code ${res.data.exitCode} (${res.data.status}). Command: ${res.data.uninstallerCommand || 'Standard'}`;
        modalConfirmBtn.disabled = false;
        modalCancelBtn.disabled = false;
        modalCloseX.disabled = false;
        modalConfirmBtn.textContent = 'Simulate Again';
        showToast('Dry run simulation finished', 'info');
      } else {
        modalAlert.style.display = 'flex';
        modalAlert.textContent = `Uninstallation completed (${res.data.status}). Exit code: ${res.data.exitCode}.`;
        showToast(`Uninstalled ${S.selectedApp.displayName || 'app'}`, 'success');

        setTimeout(() => {
          closeUninstallModal();
          closeDetailDrawer();
          fetchApplications(true);
        }, 1200);
      }
    } else {
      modalAlert.style.display = 'flex';
      modalAlert.textContent = `Error: ${res.error || 'Uninstallation failed'}`;
      modalConfirmBtn.disabled = false;
      modalCancelBtn.disabled = false;
      modalCloseX.disabled = false;
      modalConfirmBtn.textContent = 'Retry Uninstall';
      showToast(res.error || 'Uninstallation failed', 'error');
    }
  } catch (err) {
    modalAlert.style.display = 'flex';
    modalAlert.textContent = `Error: ${err.message}`;
    modalConfirmBtn.disabled = false;
    modalCancelBtn.disabled = false;
    modalCloseX.disabled = false;
    modalConfirmBtn.textContent = 'Retry Uninstall';
    showToast(err.message, 'error');
  }
});
