// ==========================================================================
// Shared Renderer State
// ==========================================================================
// One mutable singleton, `S`, holds every piece of cross-module state. Views
// read and write properties on it; ES module bindings stay untouched, so no
// setter ceremony is needed and reassignment across modules just works.

export const S = {
  // Applications view
  allApps: [],
  filteredApps: [],
  currentSearch: '',
  selectedApp: null,
  isScanning: false,
  selectedAppIds: new Set(),
  isBatchUninstall: false,
  sortColumn: 'name',
  sortDirection: 'asc',
  isRenderingVirtual: false,

  // Junk cleaner view
  allJunk: [],
  selectedJunkIds: new Set(),
  currentJunkSearch: '',
  currentJunkTargetApp: null,
  isScanningJunk: false,

  // Startup & services view
  allStartupItems: [],
  currentStartupSearch: '',
  isScanningStartup: false,

  // Drivers & network view
  allDrivers: [],
  filteredDrivers: [],
  currentDriverSearch: '',
  isScanningDrivers: false,
  allAdapters: [],
  isScanningNetwork: false,

  // Global
  lastScanDate: null,
  engineInfo: { version: '1.0.0', platform: 'x64', elevated: false, connected: false },
  recentRpcActivity: [] // Array of { method, latency, ok, timestamp }
};
