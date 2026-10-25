// ==========================================================================
// Command Palette (Ctrl+K): one input over every view's client-side data
// ==========================================================================
// Pure UI over shared state `S` — the renderer already holds apps, junk,
// startup and drivers client-side, so the palette never issues RPC calls of
// its own. Matching/ranking lives in the DOM-free search-core.js.

import {
  commandPalette,
  paletteInput,
  paletteResults,
  paletteBtn,
  startupSearchInput,
  driverSearchInput
} from './dom.js';
import { escapeHtml, svgIcon, formatSize } from './helpers.js';
import { S } from './state.js';
import { switchTab, applyTheme } from './shell.js';
import { selectApp, openUninstallModal, fetchApplications } from './apps.js';
import { fetchJunk } from './junk.js';
import { fetchStartup } from './startup.js';
import { filterPool } from './search-core.js';

const VERB_UNINSTALL = /^un(?:install)?\s+(.+)$/i;

// -------------------------------------------------------------
// Open / close plumbing
// -------------------------------------------------------------
let lastFocused = null;
let flatItems = [];
let activeIndex = 0;

export function isPaletteOpen() {
  return commandPalette.classList.contains('open');
}

export function openCommandPalette() {
  if (isPaletteOpen()) return;
  lastFocused = document.activeElement;
  commandPalette.classList.add('open');
  paletteInput.value = '';
  renderResults('');
  setActive(0);
  setTimeout(() => paletteInput.focus(), 20);
}

export function closeCommandPalette() {
  if (!isPaletteOpen()) return;
  commandPalette.classList.remove('open');
  if (lastFocused && typeof lastFocused.focus === 'function' && document.contains(lastFocused)) {
    lastFocused.focus();
  }
  lastFocused = null;
}

export function toggleCommandPalette() {
  if (isPaletteOpen()) closeCommandPalette();
  else openCommandPalette();
}

// -------------------------------------------------------------
// Result sources
// -------------------------------------------------------------
function staticActions() {
  return [
    { label: 'Go to Mission Control', icon: 'home', tab: 'dashboard' },
    { label: 'Go to Applications', icon: 'layers', tab: 'apps' },
    { label: 'Go to Junk Cleaner', icon: 'trash', tab: 'junk' },
    { label: 'Go to Startup & Services', icon: 'settings', tab: 'startup' },
    { label: 'Go to Drivers & Network', icon: 'plug', tab: 'drivers' },
    { label: 'Go to Settings & Shield', icon: 'shield', tab: 'settings' },
    { label: 'Go to Diagnostics', icon: 'flask', tab: 'diagnostics' },
    {
      label: 'Rescan installed applications',
      icon: 'refresh',
      run: () => { switchTab('apps'); fetchApplications(true); }
    },
    {
      label: 'Scan orphaned leftovers',
      icon: 'search',
      run: () => { switchTab('junk'); fetchJunk(null); }
    },
    {
      label: 'Refresh startup entries',
      icon: 'refresh',
      run: () => { switchTab('startup'); fetchStartup(true); }
    },
    {
      label: 'Cycle theme (Auto / Light / Dark)',
      icon: 'monitor',
      run: () => {
        const order = ['auto', 'light', 'dark'];
        const current = localStorage.getItem('cicada-theme') || 'auto';
        const next = order[(order.indexOf(current) + 1) % order.length] || 'auto';
        localStorage.setItem('cicada-theme', next);
        applyTheme(next);
      }
    }
  ];
}

function buildGroups(rawQuery) {
  const uninstallMatch = rawQuery.match(VERB_UNINSTALL);
  const uninstallMode = !!uninstallMatch;
  const query = uninstallMode ? uninstallMatch[1] : rawQuery;
  const groups = [];

  // Actions (always available)
  const actions = filterPool(staticActions(), query, ['label'], 6).map((action) => ({
    label: action.label,
    hint: '',
    icon: action.icon,
    run: action.run || (() => switchTab(action.tab))
  }));
  if (actions.length > 0) groups.push({ label: 'Actions', items: actions });

  // Applications — with the "uninstall " verb, Enter opens the confirm modal
  const apps = filterPool(S.allApps, query, ['displayName', 'publisher'], 8).map((app) => ({
    label: app.displayName || 'Unnamed',
    hint: [app.publisher, formatSize(app.estimatedSizeKb)].filter(Boolean).join(' · '),
    icon: 'package',
    run: () => {
      switchTab('apps');
      selectApp(app);
      if (uninstallMode) openUninstallModal();
    }
  }));
  if (apps.length > 0) groups.push({ label: uninstallMode ? 'Uninstall' : 'Applications', items: apps });

  // Startup & services
  const startup = filterPool(S.allStartupItems, query, ['name', 'company', 'kind', 'command'], 5).map((item) => ({
    label: item.name || 'Unnamed entry',
    hint: [item.kind, item.company].filter(Boolean).join(' · '),
    icon: 'zap',
    run: () => {
      switchTab('startup');
      if (startupSearchInput && item.name) {
        startupSearchInput.value = item.name;
        startupSearchInput.dispatchEvent(new Event('input'));
      }
    }
  }));
  if (startup.length > 0) groups.push({ label: 'Startup & Services', items: startup });

  // Junk findings (from the most recent scan)
  const junk = filterPool(S.allJunk, query, ['path', 'app', 'entryType'], 5).map((item) => ({
    label: item.path || item.id || 'Residual item',
    hint: [item.app || 'Orphaned', item.entryType].filter(Boolean).join(' · '),
    icon: 'trash',
    run: () => switchTab('junk')
  }));
  if (junk.length > 0) groups.push({ label: 'Junk Findings', items: junk });

  // Driver packages
  const drivers = filterPool(S.allDrivers, query, ['publishedName', 'originalFileName', 'provider', 'className'], 5).map((drv) => ({
    label: drv.originalFileName || drv.publishedName || 'Driver package',
    hint: [drv.provider, drv.className].filter(Boolean).join(' · '),
    icon: 'plug',
    run: () => {
      switchTab('drivers');
      if (driverSearchInput && (drv.publishedName || drv.originalFileName)) {
        driverSearchInput.value = drv.publishedName || drv.originalFileName;
        driverSearchInput.dispatchEvent(new Event('input'));
      }
    }
  }));
  if (drivers.length > 0) groups.push({ label: 'Drivers', items: drivers });

  return groups;
}

// -------------------------------------------------------------
// Rendering & selection
// -------------------------------------------------------------
function renderResults(query) {
  const groups = buildGroups(query);
  flatItems = [];
  groups.forEach((group) => group.items.forEach((item) => flatItems.push(item)));

  if (flatItems.length === 0) {
    paletteResults.innerHTML = `
      <div class="palette-empty">
        ${svgIcon('search')}
        <p>Nothing matches "${escapeHtml(query)}".</p>
      </div>`;
    return;
  }

  let index = 0;
  paletteResults.innerHTML = groups.map((group) => `
    <div class="palette-group-label">${escapeHtml(group.label)}</div>
    ${group.items.map((item) => {
      const i = index++;
      return `
        <button class="palette-item" type="button" role="option" id="pal-opt-${i}"
                data-palette-index="${i}" aria-selected="false">
          <span class="palette-item-icon">${svgIcon(item.icon)}</span>
          <span class="palette-item-label">${escapeHtml(item.label)}</span>
          <span class="palette-item-hint">${escapeHtml(item.hint || '')}</span>
        </button>`;
    }).join('')}
  `).join('');
}

function setActive(index) {
  const items = paletteResults.querySelectorAll('.palette-item');
  if (items.length === 0) { activeIndex = 0; return; }

  activeIndex = ((index % items.length) + items.length) % items.length;
  items.forEach((el, i) => {
    const isActive = i === activeIndex;
    el.classList.toggle('active', isActive);
    el.setAttribute('aria-selected', String(isActive));
  });

  const activeEl = items[activeIndex];
  if (activeEl) {
    activeEl.scrollIntoView({ block: 'nearest' });
    paletteInput.setAttribute('aria-activedescendant', activeEl.id);
  }
}

function runActiveItem() {
  const item = flatItems[activeIndex];
  if (!item) return;
  closeCommandPalette();
  item.run();
}

// -------------------------------------------------------------
// Wiring
// -------------------------------------------------------------
paletteInput.addEventListener('input', () => {
  renderResults(paletteInput.value);
  setActive(0);
});

paletteInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    setActive(activeIndex + 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setActive(activeIndex - 1);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    runActiveItem();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    closeCommandPalette();
  }
});

// Mouse: hover pre-highlights, click runs
paletteResults.addEventListener('mousemove', (e) => {
  const btn = e.target.closest('.palette-item');
  if (!btn) return;
  const index = Number(btn.getAttribute('data-palette-index'));
  if (!Number.isNaN(index) && index !== activeIndex) setActive(index);
});

paletteResults.addEventListener('click', (e) => {
  const btn = e.target.closest('.palette-item');
  if (!btn) return;
  const index = Number(btn.getAttribute('data-palette-index'));
  if (!Number.isNaN(index)) {
    activeIndex = index;
    runActiveItem();
  }
});

// Backdrop click dismisses
commandPalette.addEventListener('click', (e) => {
  if (e.target === commandPalette) closeCommandPalette();
});

// Global Ctrl+K shortcut + header affordance
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    toggleCommandPalette();
  }
});

if (paletteBtn) {
  paletteBtn.addEventListener('click', toggleCommandPalette);
}
