// ==========================================================================
// Startup & Services View: card groups, toggles, deletion
// ==========================================================================

import {
  startupSearchInput,
  refreshStartupBtn,
  startupRefreshIcon,
  startupSummary,
  startupActiveSummary,
  startupLoadingState,
  startupNoResultsState,
  countRegistry,
  countTasks,
  countServices,
  countHelpers,
  itemsRegistry,
  itemsTasks,
  itemsServices,
  itemsHelpers
} from './dom.js';
import { escapeHtml, svgIcon } from './helpers.js';
import { S } from './state.js';
import { showToast, recordRpcActivity, showConfirm } from './components.js';
import { matchesFilters, syncFilters } from './filters.js';

export async function fetchStartup(refresh = false) {
  if (S.isScanningStartup) return;
  S.isScanningStartup = true;

  startupLoadingState.style.display = 'flex';
  startupNoResultsState.style.display = 'none';
  refreshStartupBtn.disabled = true;
  startupRefreshIcon.classList.add('spinning');
  startupSummary.textContent = 'Scanning startup items, tasks, and services...';

  const startTime = Date.now();
  try {
    if (!window.cicadaAPI) {
      throw new Error('Cicada API bridge not available');
    }

    const res = await window.cicadaAPI.listStartup({ refresh });
    const elapsed = Date.now() - startTime;
    recordRpcActivity('startup.list', elapsed, !!(res && res.ok));

    if (res.ok && res.data) {
      S.allStartupItems = res.data.items || [];
      renderStartupGroups();
      syncFilters('startup', { rebuildOptions: true });
      document.dispatchEvent(new CustomEvent('cicada:data-changed'));
      showToast(`Discovered ${S.allStartupItems.length} startup & service entries`, 'success', 3000);
    } else {
      startupSummary.textContent = `Error: ${res.error || 'Failed to enumerate entries'}`;
      showToast(res.error || 'Failed to enumerate startup items', 'error');
    }
  } catch (err) {
    startupSummary.textContent = `Error: ${err.message}`;
    showToast(err.message, 'error');
  } finally {
    S.isScanningStartup = false;
    startupLoadingState.style.display = 'none';
    refreshStartupBtn.disabled = false;
    startupRefreshIcon.classList.remove('spinning');
  }
}

export function renderStartupGroups() {
  const query = S.currentStartupSearch.trim().toLowerCase();

  const filtered = S.allStartupItems.filter((item) => {
    if (!matchesFilters('startup', item)) return false;

    if (query) {
      const name = (item.name || '').toLowerCase();
      const cmd = (item.command || '').toLowerCase();
      const loc = (item.location || '').toLowerCase();
      const comp = (item.company || '').toLowerCase();
      if (!name.includes(query) && !cmd.includes(query) && !loc.includes(query) && !comp.includes(query)) {
        return false;
      }
    }
    return true;
  });

  const total = S.allStartupItems.length;
  const activeCount = S.allStartupItems.filter((x) => !x.disabled).length;
  startupSummary.textContent = `${total} startup item(s) discovered`;
  startupActiveSummary.textContent = `${activeCount} enabled, ${total - activeCount} disabled`;

  if (filtered.length === 0) {
    startupNoResultsState.style.display = 'flex';
  } else {
    startupNoResultsState.style.display = 'none';
  }

  // Categorize
  const registryItems = [];
  const taskItems = [];
  const serviceItems = [];
  const helperItems = [];

  filtered.forEach((item) => {
    const kind = (item.kind || 'startup').toLowerCase();
    if (kind.includes('service')) serviceItems.push(item);
    else if (kind.includes('task')) taskItems.push(item);
    else if (kind.includes('registry') || kind.includes('startup') || kind.includes('run')) registryItems.push(item);
    else helperItems.push(item);
  });

  countRegistry.textContent = registryItems.length;
  countTasks.textContent = taskItems.length;
  countServices.textContent = serviceItems.length;
  countHelpers.textContent = helperItems.length;

  itemsRegistry.innerHTML = renderStartupRows(registryItems);
  itemsTasks.innerHTML = renderStartupRows(taskItems);
  itemsServices.innerHTML = renderStartupRows(serviceItems);
  itemsHelpers.innerHTML = renderStartupRows(helperItems);

  attachStartupEventHandlers();
}

function renderStartupRows(items) {
  if (items.length === 0) {
    return `<div style="padding:12px 18px; font-size:12px; color:var(--text-muted);">No items in this category.</div>`;
  }

  return items.map((item) => {
    const isProtected = !!item.isProtected;
    const isDisabled = !!item.disabled;
    const pathText = item.command || item.commandFilePath || item.location || '-';

    return `
      <div class="startup-item-row ${isDisabled ? 'disabled' : ''}" data-id="${escapeHtml(item.id)}">
        <label class="switch" title="${isProtected ? 'Protected Windows Component' : (isDisabled ? 'Click to Enable' : 'Click to Disable')}">
          <input type="checkbox" class="toggle-startup-switch" data-id="${escapeHtml(item.id)}" ${!isDisabled ? 'checked' : ''} ${isProtected ? 'disabled' : ''} />
          <span class="slider"></span>
        </label>

        <div class="startup-item-info">
          <div class="startup-item-name">
            <span>${escapeHtml(item.name || 'Unnamed Entry')}</span>
            ${isProtected ? `<span title="Protected Windows Component" style="font-size:12px;">${svgIcon('shield')}</span>` : ''}
            <span class="badge-tag win32" style="font-size:10px;">${escapeHtml(item.kind || 'Startup')}</span>
          </div>
          ${item.company ? `<div class="startup-item-company">${escapeHtml(item.company)}</div>` : ''}
          <div class="startup-item-path" title="${escapeHtml(pathText)}">${escapeHtml(pathText)}</div>
        </div>

        <div class="startup-item-actions">
          <button class="btn-icon-delete delete-startup-btn" data-id="${escapeHtml(item.id)}" title="Delete from startup" ${isProtected ? 'disabled style="display:none;"' : ''}>
            ${svgIcon('trash')}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function attachStartupEventHandlers() {
  document.querySelectorAll('.toggle-startup-switch').forEach((switchInput) => {
    switchInput.addEventListener('change', async () => {
      const id = switchInput.getAttribute('data-id');
      const newDisabled = !switchInput.checked;

      switchInput.disabled = true;
      try {
        if (!window.cicadaAPI) {
          throw new Error('Cicada API bridge not available');
        }

        const res = await window.cicadaAPI.toggleStartup({ id, disabled: newDisabled, simulate: false });
        if (res.ok && res.data) {
          const found = S.allStartupItems.find((x) => x.id === id);
          if (found) found.disabled = newDisabled;
          renderStartupGroups();
          showToast(`Startup entry ${newDisabled ? 'disabled' : 'enabled'}`, 'success', 2000);
        } else {
          showToast(res.error || 'Failed to toggle startup entry', 'error');
          renderStartupGroups();
        }
      } catch (err) {
        showToast(err.message, 'error');
        renderStartupGroups();
      }
    });
  });

  document.querySelectorAll('.delete-startup-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const item = S.allStartupItems.find((x) => x.id === id);
      const name = item ? item.name : 'this entry';

      const confirmed = await showConfirm({
        title: 'Remove Startup Entry',
        message: `Remove <strong>${escapeHtml(name)}</strong> from Windows startup?`,
        detail: `Entry ID: ${escapeHtml(id)}`,
        confirmLabel: 'Remove Entry'
      });
      if (!confirmed) return;

      btn.disabled = true;
      try {
        if (!window.cicadaAPI) {
          throw new Error('Cicada API bridge not available');
        }

        const res = await window.cicadaAPI.deleteStartup({ id, simulate: false });
        if (res.ok && res.data) {
          S.allStartupItems = S.allStartupItems.filter((x) => x.id !== id);
          renderStartupGroups();
          showToast(`Deleted startup entry "${name}"`, 'success', 2500);
        } else {
          showToast(res.error || 'Failed to delete startup entry', 'error');
          renderStartupGroups();
        }
      } catch (err) {
        showToast(err.message, 'error');
        renderStartupGroups();
      }
    });
  });
}

// Collapsible group headers
document.querySelectorAll('.startup-group-card .group-header').forEach((hdr) => {
  hdr.addEventListener('click', () => {
    const card = hdr.closest('.startup-group-card');
    card.classList.toggle('collapsed');
  });
});

startupSearchInput.addEventListener('input', (e) => {
  S.currentStartupSearch = e.target.value;
  renderStartupGroups();
});

refreshStartupBtn.addEventListener('click', () => fetchStartup(true));
