// ==========================================================================
// Junk Cleaner View: target picker, residual table, cleanup flow
// ==========================================================================

import {
  junkSearchInput,
  junkAppSearch,
  junkAppPickerList,
  scanOrphanedJunkBtn,
  junkScanIcon,
  junkSimulateToggle,
  junkSimulateLabel,
  cleanJunkBtn,
  junkSummary,
  junkSelectionSummary,
  junkTableBody,
  junkLoadingState,
  junkNoResultsState,
  selectAllJunkCheck
} from './dom.js';
import { escapeHtml, svgIcon, debounce } from './helpers.js';
import { S } from './state.js';
import { showToast, recordRpcActivity, showConfirm } from './components.js';

function getConfidenceBadge(confidence) {
  const confLower = (confidence || 'Good').toLowerCase();
  let cls = 'confidence-good';
  if (confLower.includes('verygood')) cls = 'confidence-verygood';
  else if (confLower.includes('bad') || confLower.includes('danger')) cls = 'confidence-bad';
  else if (confLower.includes('questionable') || confLower.includes('warn')) cls = 'confidence-questionable';
  return `<span class="badge-tag ${cls}">${escapeHtml(confidence || 'Good')}</span>`;
}

function updateJunkSelectionSummary() {
  const selectedCount = S.selectedJunkIds.size;
  junkSelectionSummary.textContent = `${selectedCount} selected`;
  cleanJunkBtn.disabled = selectedCount === 0;
  selectAllJunkCheck.checked = S.allJunk.length > 0 && selectedCount === S.allJunk.length;
}

export function populateJunkTargetPicker() {
  if (!junkAppPickerList) return;

  const query = (junkAppSearch ? junkAppSearch.value : '').toLowerCase().trim();
  const sorted = [...S.allApps].sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
  const filtered = sorted.filter((a) => !query || (a.displayName && a.displayName.toLowerCase().includes(query)));

  junkAppPickerList.innerHTML = filtered.slice(0, 100).map((app) => {
    const isActive = S.currentJunkTargetApp === app.id;
    return `
      <div class="picker-item ${isActive ? 'active' : ''}" data-id="${escapeHtml(app.id)}">
        <span style="display: inline-flex;">${svgIcon('package')}</span>
        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(app.displayName || 'Unnamed')}</span>
      </div>
    `;
  }).join('');

  junkAppPickerList.querySelectorAll('.picker-item').forEach((item) => {
    item.addEventListener('click', () => {
      const id = item.getAttribute('data-id');
      S.currentJunkTargetApp = id;
      populateJunkTargetPicker();
      fetchJunk(id);
    });
  });
}

if (junkAppSearch) {
  junkAppSearch.addEventListener('input', debounce(populateJunkTargetPicker, 150));
}

function renderJunkTable() {
  junkTableBody.innerHTML = '';
  const q = S.currentJunkSearch.toLowerCase();
  const filtered = S.allJunk.filter((item) => {
    if (!q) return true;
    return (
      (item.path && item.path.toLowerCase().includes(q)) ||
      (item.app && item.app.toLowerCase().includes(q)) ||
      (item.entryType && item.entryType.toLowerCase().includes(q))
    );
  });

  const totalBytes = filtered.reduce((acc, x) => acc + (x.sizeBytes || 0), 0);
  const sizeFormatted = totalBytes > 0 ? ` (~${(totalBytes / (1024 * 1024)).toFixed(1)} MB)` : '';
  junkSummary.innerHTML = `Discovered <b>${filtered.length}</b> residual items${sizeFormatted}`;

  if (filtered.length === 0) {
    junkNoResultsState.style.display = 'flex';
    return;
  }
  junkNoResultsState.style.display = 'none';

  const fragment = document.createDocumentFragment();

  filtered.forEach((item) => {
    const tr = document.createElement('tr');
    tr.style.height = '40px';
    if (S.selectedJunkIds.has(item.id)) {
      tr.classList.add('selected');
    }

    const isProtected = !!item.isProtected;
    const checkboxHtml = isProtected
      ? `<span title="Protected item" style="color:var(--text-muted);">${svgIcon('shield')}</span>`
      : `<input type="checkbox" class="junk-row-check" data-id="${escapeHtml(item.id)}" ${S.selectedJunkIds.has(item.id) ? 'checked' : ''} />`;

    let typeIconName = 'folder';
    const typeLower = (item.entryType || '').toLowerCase();
    if (typeLower.includes('registry') || typeLower.includes('key')) typeIconName = 'key';
    else if (typeLower.includes('startup') || typeLower.includes('service')) typeIconName = 'zap';

    tr.innerHTML = `
      <td style="text-align:center;">${checkboxHtml}</td>
      <td style="font-size:12px;"><span style="margin-right:4px;">${svgIcon(typeIconName)}</span> ${escapeHtml(item.entryType || 'File')}</td>
      <td>${getConfidenceBadge(item.confidence)}</td>
      <td style="font-weight:500; font-size:12px;">${escapeHtml(item.app || 'Orphaned')}</td>
      <td style="font-family:var(--font-mono); font-size:11.5px; color:var(--text-secondary);" title="${escapeHtml(item.path)}">
        ${escapeHtml(item.path)}
        ${isProtected ? '<span class="protected-badge" style="display:inline-block; margin-left:6px; padding:1px 6px; font-size:10px;">Protected</span>' : ''}
      </td>
    `;

    if (!isProtected) {
      tr.addEventListener('click', (e) => {
        if (e.target.tagName && e.target.tagName.toLowerCase() === 'input') return;
        const chk = tr.querySelector('.junk-row-check');
        if (chk) {
          chk.checked = !chk.checked;
          if (chk.checked) S.selectedJunkIds.add(item.id);
          else S.selectedJunkIds.delete(item.id);
          tr.classList.toggle('selected', chk.checked);
          updateJunkSelectionSummary();
        }
      });

      const chk = tr.querySelector('.junk-row-check');
      if (chk) {
        chk.addEventListener('change', () => {
          if (chk.checked) S.selectedJunkIds.add(item.id);
          else S.selectedJunkIds.delete(item.id);
          tr.classList.toggle('selected', chk.checked);
          updateJunkSelectionSummary();
        });
      }
    }

    fragment.appendChild(tr);
  });

  junkTableBody.appendChild(fragment);
  updateJunkSelectionSummary();
}

export async function fetchJunk(appId = null) {
  if (S.isScanningJunk) return;
  S.isScanningJunk = true;

  scanOrphanedJunkBtn.disabled = true;
  cleanJunkBtn.disabled = true;
  junkScanIcon.classList.add('spinning');
  junkLoadingState.style.display = 'flex';
  junkNoResultsState.style.display = 'none';
  junkTableBody.innerHTML = '';
  S.selectedJunkIds.clear();
  updateJunkSelectionSummary();

  junkSummary.textContent = appId
    ? `Scanning residuals for '${appId}'...`
    : 'Analyzing registry hives, filesystem directories, and shortcuts...';

  const startTime = Date.now();
  try {
    if (!window.cicadaAPI) {
      throw new Error('Cicada API bridge not available');
    }

    const res = await window.cicadaAPI.scanJunk({ id: appId });
    const elapsed = Date.now() - startTime;
    recordRpcActivity('junk.scan', elapsed, !!(res && res.ok));

    if (res.ok && res.data && Array.isArray(res.data.items)) {
      S.allJunk = res.data.items;
      S.allJunk.forEach((item) => {
        if (!item.isProtected) S.selectedJunkIds.add(item.id);
      });
      junkSummary.innerHTML = `Discovered <b>${S.allJunk.length}</b> residual items (${elapsed}ms)`;
      renderJunkTable();
      document.dispatchEvent(new CustomEvent('cicada:data-changed'));
      showToast(`Residual scan found ${S.allJunk.length} items`, 'success', 3000);
    } else {
      junkSummary.textContent = `Leftover scan failed: ${res.error || 'Unknown error'}`;
      junkNoResultsState.style.display = 'flex';
      showToast(res.error || 'Failed to scan residual items', 'error');
    }
  } catch (err) {
    junkSummary.textContent = `Error: ${err.message}`;
    junkNoResultsState.style.display = 'flex';
    showToast(err.message, 'error');
  } finally {
    junkLoadingState.style.display = 'none';
    S.isScanningJunk = false;
    scanOrphanedJunkBtn.disabled = false;
    junkScanIcon.classList.remove('spinning');
  }
}

junkSimulateToggle.addEventListener('change', () => {
  if (junkSimulateToggle.checked) {
    junkSimulateLabel.textContent = 'Dry Run (Simulate)';
    cleanJunkBtn.textContent = 'Simulate Cleanup';
  } else {
    junkSimulateLabel.textContent = 'Live Cleanup (Permanent)';
    cleanJunkBtn.textContent = 'Clean Selected';
  }
});

selectAllJunkCheck.addEventListener('change', () => {
  if (selectAllJunkCheck.checked) {
    S.allJunk.forEach((item) => {
      if (!item.isProtected) S.selectedJunkIds.add(item.id);
    });
  } else {
    S.selectedJunkIds.clear();
  }
  renderJunkTable();
});

junkSearchInput.addEventListener('input', (e) => {
  S.currentJunkSearch = e.target.value.trim();
  renderJunkTable();
});

scanOrphanedJunkBtn.addEventListener('click', () => {
  S.currentJunkTargetApp = null;
  populateJunkTargetPicker();
  fetchJunk(null);
});

cleanJunkBtn.addEventListener('click', async () => {
  if (S.selectedJunkIds.size === 0) return;

  const simulate = junkSimulateToggle.checked;
  const itemsToClean = Array.from(S.selectedJunkIds);

  if (!simulate) {
    const confirmed = await showConfirm({
      title: 'Clean Selected Junk',
      message: `Permanently remove <strong>${itemsToClean.length}</strong> selected leftover item(s) from disk?`,
      detail: 'Protected system paths remain blocked by the authoritative deny-list.',
      confirmLabel: 'Clean Junk'
    });
    if (!confirmed) return;
  }

  cleanJunkBtn.disabled = true;
  scanOrphanedJunkBtn.disabled = true;
  cleanJunkBtn.textContent = simulate ? 'Simulating...' : 'Cleaning...';

  const startTime = Date.now();
  try {
    if (!window.cicadaAPI) {
      throw new Error('Cicada API bridge not available');
    }

    const res = await window.cicadaAPI.cleanJunk({
      items: itemsToClean,
      simulate
    });
    const elapsed = Date.now() - startTime;
    recordRpcActivity('junk.clean', elapsed, !!(res && res.ok));

    if (res.ok && res.data) {
      showToast(res.data.message || 'Cleanup operation finished', simulate ? 'info' : 'success', 4000);
      if (!simulate) {
        fetchJunk(S.currentJunkTargetApp);
      }
    } else {
      showToast(res.error || 'Cleanup failed', 'error');
    }
  } catch (err) {
    showToast(`Cleanup error: ${err.message}`, 'error');
  } finally {
    cleanJunkBtn.disabled = false;
    scanOrphanedJunkBtn.disabled = false;
    cleanJunkBtn.textContent = simulate ? 'Simulate Cleanup' : 'Clean Selected';
  }
});
