// ==========================================================================
// Mission Control Dashboard: summary cards, engine onboarding, hero chips
// ==========================================================================
// A read-only aggregation surface: everything shown here already lives in the
// shared state singleton `S`, so no extra RPC traffic is generated. Modules
// that mutate that state announce it with the `cicada:data-changed` DOM event
// (see shell.js updateStatusBar and the fetch* functions), keeping this module
// free of imports from the view modules (no circular imports).

import {
  dashEngineChip,
  dashEngineChipText,
  dashScanChip,
  dashOnboarding,
  dashRetryEngineBtn,
  dashDiagBtn,
  dashCardApps,
  dashAppsValue,
  dashAppsHint,
  dashCardJunk,
  dashJunkValue,
  dashJunkHint,
  dashCardStartup,
  dashStartupValue,
  dashStartupHint,
  dashCardDrivers,
  dashDriversValue,
  dashDriversHint,
  dashCardShield,
  dashShieldValue,
  dashShieldHint,
  dashCardCache,
  dashCacheValue,
  dashCacheHint,
  cacheStatusBadgeText
} from './dom.js';
import { escapeHtml, formatSize, timeAgo } from './helpers.js';
import { S } from './state.js';
import { switchTab } from './shell.js';
import { runDiagnostics } from './diagnostics.js';

const LARGE_APP_KB = 100 * 1024; // "Large" threshold, matches the apps facet filter

function sumKb(apps) {
  return apps.reduce((acc, a) => acc + (a.estimatedSizeKb || 0), 0);
}

function junkBytes() {
  return S.allJunk.reduce((acc, x) => acc + (x.sizeBytes || 0), 0);
}

// -------------------------------------------------------------
// Card renderers
// -------------------------------------------------------------
function renderAppsCard() {
  const count = S.allApps.length;
  dashAppsValue.textContent = count > 0 ? String(count) : '—';

  if (count === 0) {
    dashAppsHint.textContent = S.engineInfo.connected ? 'Inventory empty — run a scan' : 'Waiting for engine...';
    return;
  }
  const large = S.allApps.filter((a) => (a.estimatedSizeKb || 0) >= LARGE_APP_KB).length;
  dashAppsHint.textContent = `${formatSize(sumKb(S.allApps))} installed · ${large} large`;
}

function renderJunkCard() {
  const count = S.allJunk.length;
  if (count === 0) {
    dashJunkValue.textContent = '—';
    dashJunkHint.textContent = 'Run a junk scan for live numbers';
    return;
  }
  const bytes = junkBytes();
  dashJunkValue.textContent = String(count);
  dashJunkHint.textContent = bytes > 0
    ? `~${(bytes / (1024 * 1024)).toFixed(1)} MB from last scan`
    : `${count} findings from last scan`;
}

function renderStartupCard() {
  const total = S.allStartupItems.length;
  if (total === 0) {
    dashStartupValue.textContent = '—';
    dashStartupHint.textContent = 'Not scanned yet';
    return;
  }
  const enabled = S.allStartupItems.filter((x) => !x.disabled).length;
  dashStartupValue.textContent = String(enabled);
  dashStartupHint.textContent = `${enabled} of ${total} entries enabled`;
}

function renderDriversCard() {
  const total = S.allDrivers.length;
  if (total === 0) {
    dashDriversValue.textContent = '—';
    dashDriversHint.textContent = 'Not scanned yet';
    return;
  }
  const duplicates = S.allDrivers.filter((d) => !!d.isDuplicate).length;
  dashDriversValue.textContent = String(duplicates);
  dashDriversHint.textContent = duplicates > 0
    ? `${duplicates} superseded of ${total} packages`
    : `None across ${total} packages`;
}

function renderShieldCard() {
  const protectedApps = S.allApps.filter((a) => !!(a.isProtected || a.isSystemComponent)).length;
  const protectedDrivers = S.allDrivers.filter((d) => !!d.isProtected).length;
  dashShieldValue.textContent = String(protectedApps + protectedDrivers);
  dashShieldHint.textContent = `${protectedApps} apps · ${protectedDrivers} drivers guarded`;
}

function renderCacheCard() {
  // cacheStatusBadgeText is kept current by settings.updateCacheDiagnosticsView
  const status = cacheStatusBadgeText ? cacheStatusBadgeText.textContent : '';
  const active = /active/i.test(status || '');
  dashCacheValue.textContent = active ? 'Active' : 'Idle';
  dashCacheHint.textContent = status ? escapeHtml(status) : 'Instant startup snapshot status';
}

// -------------------------------------------------------------
// Hero chips & engine onboarding
// -------------------------------------------------------------
function renderHeroChips() {
  if (S.engineInfo.connected) {
    dashEngineChip.className = 'badge badge-ok';
    dashEngineChipText.textContent = `Engine v${S.engineInfo.version} · ${S.engineInfo.elevated ? 'Elevated' : 'Unelevated'}`;
  } else {
    dashEngineChip.className = 'badge badge-disconnected';
    dashEngineChipText.textContent = 'Engine offline';
  }
  dashScanChip.textContent = `Last scan: ${timeAgo(S.lastScanDate)}`;
}

function renderOnboarding() {
  const engineMissing = !S.engineInfo.connected;
  const nothingCached = S.allApps.length === 0;
  dashOnboarding.style.display = engineMissing && nothingCached ? 'flex' : 'none';
}

// -------------------------------------------------------------
// Full re-render (coalesced via rAF when data-change events burst)
// -------------------------------------------------------------
let renderQueued = false;

export function renderDashboard() {
  renderHeroChips();
  renderOnboarding();
  renderAppsCard();
  renderJunkCard();
  renderStartupCard();
  renderDriversCard();
  renderShieldCard();
  renderCacheCard();
}

function queueRenderDashboard() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderDashboard();
  });
}

// Any module that fills/updates shared state announces `cicada:data-changed`.
// updateStatusBar also ticks every 15s, keeping the scan chip fresh.
document.addEventListener('cicada:data-changed', queueRenderDashboard);

// -------------------------------------------------------------
// Deep links & onboarding actions
// -------------------------------------------------------------
dashCardApps.addEventListener('click', () => switchTab('apps'));
dashCardJunk.addEventListener('click', () => switchTab('junk'));
dashCardStartup.addEventListener('click', () => switchTab('startup'));
dashCardDrivers.addEventListener('click', () => switchTab('drivers'));
dashCardShield.addEventListener('click', () => switchTab('settings'));
dashCardCache.addEventListener('click', () => switchTab('settings'));

dashRetryEngineBtn.addEventListener('click', () => {
  runDiagnostics();
});
dashDiagBtn.addEventListener('click', () => switchTab('diagnostics'));

// Initial paint (state is empty at boot; refreshes arrive via data-changed)
renderDashboard();
