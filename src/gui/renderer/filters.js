// ==========================================================================
// Filter Engine (shared multi-select popovers)
// ==========================================================================
// Every list view declares its filters as facet *groups*. Options inside one
// group combine with OR ("match any"), while groups combine with AND. That
// lets a user express e.g. "Store apps" AND "installed recently" instead of
// the mutually-exclusive single-select behaviour of the old chip rows.
//
// The per-kind `apply` callbacks live in the view modules; they register here
// via registerFilterApplyHooks() from main.js, which keeps this module free of
// circular imports.

import {
  appsFilterTrigger,
  appsFilterPopover,
  appsFilterOptions,
  appsFilterReset,
  appsFilterBadge,
  appsActiveFilters,
  startupFilterTrigger,
  startupFilterPopover,
  startupFilterOptions,
  startupFilterReset,
  startupFilterBadge,
  startupActiveFilters,
  driverFilterTrigger,
  driverFilterPopover,
  driverFilterOptions,
  driverFilterReset,
  driverFilterBadge,
  driverActiveFilters
} from './dom.js';
import { escapeHtml, svgIcon } from './helpers.js';
import { S } from './state.js';

export function kindOfApp(app) {
  return (app.uninstallerKind || '').toLowerCase();
}

export function kindOfStartupItem(item) {
  return (item.kind || 'startup').toLowerCase();
}

export function driverClassOf(drv) {
  return (drv.className || '').toLowerCase();
}

export function isRecentlyInstalled(dateStr) {
  if (!dateStr) return false;
  const parsed = Date.parse(dateStr);
  if (isNaN(parsed)) return false;
  return (Date.now() - parsed) <= 30 * 24 * 60 * 60 * 1000;
}

// Late-bound apply hooks, registered by main.js once all views are loaded.
const applyHooks = { apps: null, startup: null, drivers: null };

export function registerFilterApplyHooks(hooks) {
  Object.assign(applyHooks, hooks);
}

export const FILTER_DEFS = {
  apps: {
    trigger: appsFilterTrigger,
    popover: appsFilterPopover,
    optionsEl: appsFilterOptions,
    resetEl: appsFilterReset,
    badgeEl: appsFilterBadge,
    activeEl: appsActiveFilters,
    source: () => S.allApps,
    apply: () => applyHooks.apps && applyHooks.apps(),
    groups: [
      {
        label: 'Type',
        options: [
          { key: 'regular', label: 'Desktop apps', icon: 'folder', hint: 'Classic Win32 installers',
            test: (a) => !kindOfApp(a).includes('store') && !a.isSystemComponent },
          { key: 'store', label: 'Microsoft Store', icon: 'sparkles', hint: 'Appx / Store packages',
            test: (a) => kindOfApp(a).includes('store') },
          { key: 'msi', label: 'MSI packages', icon: 'package', hint: 'Windows Installer packages',
            test: (a) => kindOfApp(a).includes('msi') },
        ],
      },
      {
        label: 'Size',
        options: [
          { key: 'large', label: 'Large', icon: 'hard-drive', hint: 'Estimated footprint over 100 MB',
            test: (a) => (a.estimatedSizeKb || 0) >= 100 * 1024 },
        ],
      },
      {
        label: 'Installed',
        options: [
          { key: 'recent', label: 'Recently installed', icon: 'clock', hint: 'Within the last 30 days',
            test: (a) => isRecentlyInstalled(a.installDate) },
        ],
      },
      {
        label: 'Condition',
        options: [
          { key: 'orphaned', label: 'Orphaned', icon: 'warning', hint: 'Missing on-disk install path',
            test: (a) => !a.installLocation || !!a.isOrphaned },
        ],
      },
    ],
  },

  startup: {
    trigger: startupFilterTrigger,
    popover: startupFilterPopover,
    optionsEl: startupFilterOptions,
    resetEl: startupFilterReset,
    badgeEl: startupFilterBadge,
    activeEl: startupActiveFilters,
    source: () => S.allStartupItems,
    apply: () => applyHooks.startup && applyHooks.startup(),
    groups: [
      {
        label: 'Kind',
        options: [
          { key: 'startup', label: 'Registry startup', icon: 'key', hint: 'Run keys & Startup folders',
            test: (i) => { const k = kindOfStartupItem(i); return k.includes('registry') || k.includes('startup') || k.includes('run'); } },
          { key: 'task', label: 'Scheduled tasks', icon: 'clock', hint: 'Task Scheduler entries',
            test: (i) => kindOfStartupItem(i).includes('task') },
          { key: 'service', label: 'Windows services', icon: 'zap', hint: 'Service Control Manager entries',
            test: (i) => kindOfStartupItem(i).includes('service') },
          { key: 'helper', label: 'Browser & other', icon: 'puzzle', hint: 'Shell extensions & helpers',
            test: (i) => { const k = kindOfStartupItem(i); return !(k.includes('service') || k.includes('task') || k.includes('registry') || k.includes('startup') || k.includes('run')); } },
        ],
      },
    ],
  },

  drivers: {
    trigger: driverFilterTrigger,
    popover: driverFilterPopover,
    optionsEl: driverFilterOptions,
    resetEl: driverFilterReset,
    badgeEl: driverFilterBadge,
    activeEl: driverActiveFilters,
    source: () => S.allDrivers,
    apply: () => applyHooks.drivers && applyHooks.drivers(),
    groups: [
      {
        label: 'Device class',
        options: [
          { key: 'display', label: 'Display', icon: 'monitor', hint: 'Graphics & display adapters',
            test: (d) => driverClassOf(d) === 'display' },
          { key: 'network', label: 'Network', icon: 'wifi', hint: 'Network & wireless adapters',
            test: (d) => ['net', 'netservice', 'nettrans'].includes(driverClassOf(d)) },
          { key: 'media', label: 'Audio & media', icon: 'plug', hint: 'Sound & media devices',
            test: (d) => { const c = driverClassOf(d); return c === 'media' || c.includes('audio'); } },
        ],
      },
      {
        label: 'Status',
        options: [
          { key: 'duplicate', label: 'Duplicates / old', icon: 'copy', hint: 'Superseded package versions',
            test: (d) => !!d.isDuplicate },
          { key: 'protected', label: 'System protected', icon: 'shield', hint: 'Guarded by the deny-list',
            test: (d) => !!d.isProtected },
        ],
      },
    ],
  },
};

export const filterState = { apps: new Set(), startup: new Set(), drivers: new Set() };

// True when an item survives every *used* facet group for the given kind.
export function matchesFilters(kind, item) {
  const def = FILTER_DEFS[kind];
  const selected = filterState[kind];
  if (!def || !selected || selected.size === 0) return true;

  return def.groups.every((group) => {
    const active = group.options.filter((opt) => selected.has(opt.key));
    if (active.length === 0) return true; // facet unused -> imposes no constraint
    return active.some((opt) => opt.test(item));
  });
}

export function renderFilterOptions(kind) {
  const def = FILTER_DEFS[kind];
  if (!def || !def.optionsEl) return;

  const selected = filterState[kind];
  const source = def.source() || [];

  def.optionsEl.innerHTML = def.groups.map((group) => `
    <div class="filter-group">
      <div class="filter-group-label">${escapeHtml(group.label)}</div>
      ${group.options.map((opt) => {
        const count = source.reduce((n, item) => n + (opt.test(item) ? 1 : 0), 0);
        const active = selected.has(opt.key);
        return `
          <button class="filter-option" type="button" role="checkbox"
                  aria-checked="${active}" aria-pressed="${active}"
                  data-filter-key="${escapeHtml(opt.key)}"
                  ${opt.hint ? `title="${escapeHtml(opt.hint)}"` : ''}>
            <span class="filter-option-icon">${svgIcon(opt.icon)}</span>
            <span class="filter-option-label">${escapeHtml(opt.label)}</span>
            <span class="filter-option-count">${count}</span>
            <span class="filter-option-tick">${svgIcon('check')}</span>
          </button>`;
      }).join('')}
    </div>
  `).join('');
}

export function renderActiveFilterChips(kind) {
  const def = FILTER_DEFS[kind];
  if (!def) return;

  const selected = filterState[kind];
  const chosen = [];
  def.groups.forEach((group) => group.options.forEach((opt) => {
    if (selected.has(opt.key)) chosen.push(opt);
  }));

  if (def.activeEl) {
    def.activeEl.innerHTML = chosen.length === 0 ? '' : (
      chosen.map((opt) => `
        <button class="chip-btn chip-filter" type="button" data-remove-filter="${escapeHtml(opt.key)}" title="Remove this filter">
          <span>${escapeHtml(opt.label)}</span>
          <span class="chip-x">${svgIcon('close')}</span>
        </button>
      `).join('') + '<button class="chip-btn chip-clear" type="button" data-clear-filters>Clear all</button>'
    );
  }

  if (def.badgeEl) {
    def.badgeEl.textContent = String(chosen.length);
    def.badgeEl.hidden = chosen.length === 0;
  }
  if (def.trigger) {
    def.trigger.classList.toggle('is-filtered', chosen.length > 0);
  }
  if (def.resetEl) {
    def.resetEl.disabled = chosen.length === 0;
  }
}

// Re-render the popover option list (counts depend on the dataset) and the
// active chip row together. Call after a scan fills or replaces data.
export function syncFilters(kind, { rebuildOptions = false } = {}) {
  if (rebuildOptions) renderFilterOptions(kind);
  renderActiveFilterChips(kind);
}

export function toggleFilterOption(kind, key) {
  const def = FILTER_DEFS[kind];
  if (!def) return;
  const opt = def.groups.flatMap((group) => group.options).find((o) => o.key === key);
  if (!opt) return;

  const selected = filterState[kind];
  if (selected.has(key)) selected.delete(key);
  else selected.add(key);

  // Update the pressed state in place rather than rebuilding the popover,
  // which would drop focus and re-run every option predicate.
  if (def.optionsEl) {
    const btn = def.optionsEl.querySelector(`.filter-option[data-filter-key="${key}"]`);
    if (btn) {
      const active = String(selected.has(key));
      btn.setAttribute('aria-pressed', active);
      btn.setAttribute('aria-checked', active);
    }
  }

  renderActiveFilterChips(kind);
  if (def.apply) def.apply();
}

export function resetFilters(kind) {
  const def = FILTER_DEFS[kind];
  if (!def) return;

  filterState[kind].clear();

  if (def.optionsEl) {
    def.optionsEl.querySelectorAll('.filter-option').forEach((btn) => {
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-checked', 'false');
    });
  }

  renderActiveFilterChips(kind);
  if (def.apply) def.apply();
}

export function setFilterPopoverOpen(kind, open) {
  const def = FILTER_DEFS[kind];
  if (!def || !def.popover) return;

  if (open) {
    Object.keys(FILTER_DEFS).forEach((k) => { if (k !== kind) setFilterPopoverOpen(k, false); });
  } else if (def.trigger && (def.popover.contains(document.activeElement) || document.activeElement === def.trigger)) {
    // Returning focus to the trigger keeps keyboard users anchored when the
    // popover closes (Escape or outside click).
    def.trigger.focus();
  }

  def.popover.hidden = !open;
  if (def.trigger) def.trigger.setAttribute('aria-expanded', String(open));
}

// -------------------------------------------------------------
// Roving focus inside filter popovers (keyboard accessibility)
// -------------------------------------------------------------
// Options are real buttons, so Tab works naturally; the arrows provide a
// menu-like roving focus within (and across) facet groups, wrapping at the
// ends. Home/End jump to the first/last option.
function popoverOptionButtons(def) {
  return def.optionsEl ? Array.from(def.optionsEl.querySelectorAll('.filter-option')) : [];
}

function movePopoverFocus(def, target) {
  const buttons = popoverOptionButtons(def).filter((el) => !el.disabled);
  if (buttons.length === 0) return;
  const index = buttons.indexOf(document.activeElement);
  const next = typeof target === 'number'
    ? ((index + target) % buttons.length + buttons.length) % buttons.length
    : (target === 'first' ? 0 : buttons.length - 1);
  buttons[next].focus();
}

function installPopoverKeyboard(kind, def) {
  if (!def.optionsEl) return;

  def.optionsEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); movePopoverFocus(def, +1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); movePopoverFocus(def, -1); }
    else if (e.key === 'Home') { e.preventDefault(); movePopoverFocus(def, 'first'); }
    else if (e.key === 'End') { e.preventDefault(); movePopoverFocus(def, 'last'); }
  });

  // ArrowDown on the trigger opens the popover and hands focus to the first
  // option, so the whole flow stays on the keyboard.
  if (def.trigger) {
    def.trigger.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' && def.popover.hidden) {
        e.preventDefault();
        setFilterPopoverOpen(kind, true);
        movePopoverFocus(def, 'first');
      }
    });
  }
}

// --- Wiring ---------------------------------------------------------------
Object.keys(FILTER_DEFS).forEach((kind) => {
  const def = FILTER_DEFS[kind];

  if (def.trigger && def.popover) {
    def.trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      setFilterPopoverOpen(kind, def.popover.hidden);
    });
  }

  installPopoverKeyboard(kind, def);

  if (def.optionsEl) {
    def.optionsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-option');
      if (!btn || !def.optionsEl.contains(btn)) return;
      toggleFilterOption(kind, btn.getAttribute('data-filter-key'));
    });
  }

  if (def.resetEl) {
    def.resetEl.addEventListener('click', () => resetFilters(kind));
  }

  if (def.activeEl) {
    def.activeEl.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('[data-remove-filter]');
      if (removeBtn) {
        toggleFilterOption(kind, removeBtn.getAttribute('data-remove-filter'));
        return;
      }
      if (e.target.closest('[data-clear-filters]')) resetFilters(kind);
    });
  }

  renderFilterOptions(kind);
  renderActiveFilterChips(kind);
});

// Clicking anywhere outside an open popover (and its trigger) dismisses it.
document.addEventListener('click', (e) => {
  Object.keys(FILTER_DEFS).forEach((kind) => {
    const def = FILTER_DEFS[kind];
    if (!def.popover || def.popover.hidden) return;
    if (def.popover.contains(e.target)) return;
    if (def.trigger && def.trigger.contains(e.target)) return;
    setFilterPopoverOpen(kind, false);
  });
});
