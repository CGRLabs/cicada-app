// ==========================================================================
// Shell Chrome: Theme, Sidebar, Tab Navigation, Status Bar
// ==========================================================================
// View modules register their lazy-loaders via registerTabHooks() from
// main.js, so this module never imports a view (no circular imports).

import {
  appSidebar,
  sidebarToggle,
  tabDashboard,
  tabApps,
  tabJunk,
  tabStartup,
  tabDrivers,
  tabSettings,
  tabDiagnostics,
  viewDashboard,
  viewApplications,
  viewJunk,
  viewStartup,
  viewDrivers,
  viewSettings,
  viewDiagnostics,
  themeToggleBtn,
  themeToggleIcon,
  statusBarDot,
  statusBarStatus,
  statusBarEngine,
  statusBarAppsCount,
  statusBarTotalSize,
  statusBarLastScan,
  diagStatusPulse
} from './dom.js';
import { formatSize, timeAgo, svgIcon } from './helpers.js';
import { S } from './state.js';

// -------------------------------------------------------------
// Theme Management
// -------------------------------------------------------------
const THEMES = ['auto', 'light', 'dark'];
let currentThemeIndex = 0;

export function applyTheme(theme) {
  if (theme === 'auto') {
    document.documentElement.removeAttribute('data-theme');
    themeToggleIcon.innerHTML = svgIcon('monitor');
    themeToggleBtn.title = 'Theme: System (Click to switch to Light)';
  } else if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    themeToggleIcon.innerHTML = svgIcon('sun');
    themeToggleBtn.title = 'Theme: Light (Click to switch to Dark)';
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggleIcon.innerHTML = svgIcon('moon');
    themeToggleBtn.title = 'Theme: Dark (Click to switch to Auto)';
  }
}

themeToggleBtn.addEventListener('click', () => {
  currentThemeIndex = (currentThemeIndex + 1) % THEMES.length;
  const theme = THEMES[currentThemeIndex];
  localStorage.setItem('cicada-theme', theme);
  applyTheme(theme);
});

const savedTheme = localStorage.getItem('cicada-theme') || 'auto';
currentThemeIndex = THEMES.indexOf(savedTheme) !== -1 ? THEMES.indexOf(savedTheme) : 0;
applyTheme(savedTheme);

// -------------------------------------------------------------
// Sidebar Expand / Collapse Management
// -------------------------------------------------------------
export function setSidebarExpanded(expanded) {
  if (expanded) {
    appSidebar.classList.add('expanded');
    localStorage.setItem('cicada-sidebar-collapsed', 'false');
  } else {
    appSidebar.classList.remove('expanded');
    localStorage.setItem('cicada-sidebar-collapsed', 'true');
  }
}

const savedSidebarState = localStorage.getItem('cicada-sidebar-collapsed');
if (savedSidebarState === 'false') {
  setSidebarExpanded(true);
} else {
  setSidebarExpanded(false);
}

sidebarToggle.addEventListener('click', () => {
  const isExpanded = appSidebar.classList.contains('expanded');
  setSidebarExpanded(!isExpanded);
});

// -------------------------------------------------------------
// Tab Navigation
// -------------------------------------------------------------
// Hooks are provided by the view modules (lazy loads on first visit, refreshes
// when re-entering a view). Registered once from main.js.
const tabHooks = {};

export function registerTabHooks(hooks) {
  Object.assign(tabHooks, hooks);
}

function switchTab(target) {
  const tabs = [
    { id: 'dashboard', btn: tabDashboard, view: viewDashboard },
    { id: 'apps', btn: tabApps, view: viewApplications },
    { id: 'junk', btn: tabJunk, view: viewJunk },
    { id: 'startup', btn: tabStartup, view: viewStartup },
    { id: 'drivers', btn: tabDrivers, view: viewDrivers },
    { id: 'settings', btn: tabSettings, view: viewSettings },
    { id: 'diagnostics', btn: tabDiagnostics, view: viewDiagnostics }
  ];

  tabs.forEach((t) => {
    if (!t.btn || !t.view) return;
    const isActive = t.id === target;
    t.btn.classList.toggle('active', isActive);
    t.view.classList.toggle('active', isActive);
  });

  // Lazy load startup items if switching for the first time
  if (target === 'startup' && S.allStartupItems.length === 0 && !S.isScanningStartup) {
    tabHooks.fetchStartup && tabHooks.fetchStartup(false);
  }

  // Lazy load drivers and network if switching to drivers tab
  if (target === 'drivers') {
    if (S.allDrivers.length === 0 && !S.isScanningDrivers) {
      tabHooks.fetchDrivers && tabHooks.fetchDrivers(false);
    }
    if (S.allAdapters.length === 0 && !S.isScanningNetwork) {
      tabHooks.fetchNetwork && tabHooks.fetchNetwork(false);
    }
  }

  // Update settings diagnostics when entering settings view
  if (target === 'settings') {
    tabHooks.updateCacheDiagnosticsView && tabHooks.updateCacheDiagnosticsView();
  }

  // Populate junk target apps picker from the apps cache
  if (target === 'junk' && S.allApps.length > 0) {
    tabHooks.populateJunkTargetPicker && tabHooks.populateJunkTargetPicker();
  }

  // Restore or re-render virtual scroller if returning to apps
  if (target === 'apps') {
    requestAnimationFrame(() => tabHooks.renderVirtualApps && tabHooks.renderVirtualApps());
  }
}

export { switchTab };

if (tabDashboard) tabDashboard.addEventListener('click', () => switchTab('dashboard'));
if (tabApps) tabApps.addEventListener('click', () => switchTab('apps'));
if (tabJunk) tabJunk.addEventListener('click', () => switchTab('junk'));
if (tabStartup) tabStartup.addEventListener('click', () => switchTab('startup'));
if (tabDrivers) tabDrivers.addEventListener('click', () => switchTab('drivers'));
if (tabSettings) tabSettings.addEventListener('click', () => switchTab('settings'));
if (tabDiagnostics) tabDiagnostics.addEventListener('click', () => switchTab('diagnostics'));

// -------------------------------------------------------------
// Status Bar Updates
// -------------------------------------------------------------
export function updateStatusBar() {
  if (S.engineInfo.connected) {
    statusBarDot.className = 'status-dot connected';
    statusBarStatus.textContent = 'Connected';
    diagStatusPulse.className = 'pulsing-dot';
  } else {
    statusBarDot.className = 'status-dot disconnected';
    statusBarStatus.textContent = 'Disconnected';
    diagStatusPulse.className = 'pulsing-dot disconnected';
  }

  statusBarEngine.textContent = `Engine v${S.engineInfo.version || '1.0.0'}`;
  statusBarAppsCount.textContent = `${S.allApps.length} apps`;

  const totalKb = S.allApps.reduce((acc, a) => acc + (a.estimatedSizeKb || 0), 0);
  statusBarTotalSize.textContent = formatSize(totalKb);
  statusBarLastScan.textContent = `Last scan: ${timeAgo(S.lastScanDate)}`;

  // Announce shared-state changes so the Mission Control dashboard (and any
  // other aggregate surface) can re-render. rAF-coalescing happens on the
  // listener side, so bursts are cheap.
  document.dispatchEvent(new CustomEvent('cicada:data-changed'));
}

setInterval(updateStatusBar, 15000);
