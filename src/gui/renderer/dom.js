// ==========================================================================
// DOM Element References
// ==========================================================================
// Single place that resolves every element the renderer touches. View modules
// import only the elements they own.

// Layout & Sidebar
export const appSidebar = document.getElementById('appSidebar');
export const sidebarToggle = document.getElementById('sidebarToggle');
export const tabDashboard = document.getElementById('tabDashboard');
export const tabApps = document.getElementById('tabApps');
export const tabJunk = document.getElementById('tabJunk');
export const tabStartup = document.getElementById('tabStartup');
export const tabDrivers = document.getElementById('tabDrivers');
export const tabSettings = document.getElementById('tabSettings');
export const tabDiagnostics = document.getElementById('tabDiagnostics');

// View panes
export const viewDashboard = document.getElementById('viewDashboard');
export const viewApplications = document.getElementById('viewApplications');
export const viewJunk = document.getElementById('viewJunk');
export const viewStartup = document.getElementById('viewStartup');
export const viewDrivers = document.getElementById('viewDrivers');
export const viewSettings = document.getElementById('viewSettings');
export const viewDiagnostics = document.getElementById('viewDiagnostics');

// Header
export const searchInput = document.getElementById('searchInput');
export const refreshScanBtn = document.getElementById('refreshScanBtn');
export const scanBtnIcon = document.getElementById('scanBtnIcon');
export const paletteBtn = document.getElementById('paletteBtn');
export const themeToggleBtn = document.getElementById('themeToggle');
export const themeToggleIcon = document.getElementById('themeToggleIcon');
export const headerElevationBadge = document.getElementById('headerElevationBadge');
export const headerElevationText = document.getElementById('headerElevationText');

// Applications view
export const appsFilterTrigger = document.getElementById('appsFilterTrigger');
export const appsFilterPopover = document.getElementById('appsFilterPopover');
export const appsFilterOptions = document.getElementById('appsFilterOptions');
export const appsFilterReset = document.getElementById('appsFilterReset');
export const appsFilterBadge = document.getElementById('appsFilterBadge');
export const appsActiveFilters = document.getElementById('appsActiveFilters');
export const appsResultCount = document.getElementById('appsResultCount');
export const appsSummary = document.getElementById('appsSummary');
export const totalSizeSummary = document.getElementById('totalSizeSummary');
export const appsLargeSummary = document.getElementById('appsLargeSummary');
export const scanElapsedInfo = document.getElementById('scanElapsedInfo');
export const tableScrollContainer = document.getElementById('tableScrollContainer');
export const appsTable = document.getElementById('appsTable');
export const appsTableBody = document.getElementById('appsTableBody');
export const selectAllAppsCheck = document.getElementById('selectAllAppsCheck');
export const loadingState = document.getElementById('loadingState');
export const noResultsState = document.getElementById('noResultsState');
export const batchBar = document.getElementById('batchBar');
export const batchCountText = document.getElementById('batchCountText');
export const batchUninstallBtn = document.getElementById('batchUninstallBtn');
export const batchClearBtn = document.getElementById('batchClearBtn');

// Detail drawer
export const detailDrawer = document.getElementById('detailDrawer');
export const closeDrawerBtn = document.getElementById('closeDrawerBtn');
export const drawerAvatar = document.getElementById('drawerAvatar');
export const drawerTitle = document.getElementById('drawerTitle');
export const drawerSubtitle = document.getElementById('drawerSubtitle');
export const drawerPublisher = document.getElementById('drawerPublisher');
export const drawerVersion = document.getElementById('drawerVersion');
export const drawerInstallDate = document.getElementById('drawerInstallDate');
export const drawerSize = document.getElementById('drawerSize');
export const drawerType = document.getElementById('drawerType');
export const drawerSilent = document.getElementById('drawerSilent');
export const drawerLocation = document.getElementById('drawerLocation');
export const drawerId = document.getElementById('drawerId');
export const drawerUrl = document.getElementById('drawerUrl');
export const drawerUrlField = document.getElementById('drawerUrlField');
export const copyPathBtn = document.getElementById('copyPathBtn');
export const uninstallBtn = document.getElementById('uninstallBtn');
export const scanAppJunkBtn = document.getElementById('scanAppJunkBtn');
export const protectedNotice = document.getElementById('protectedNotice');

// Junk cleaner view
export const junkSearchInput = document.getElementById('junkSearchInput');
export const junkAppSearch = document.getElementById('junkAppSearch');
export const junkAppPickerList = document.getElementById('junkAppPickerList');
export const scanOrphanedJunkBtn = document.getElementById('scanOrphanedJunkBtn');
export const junkScanIcon = document.getElementById('junkScanIcon');
export const junkSimulateToggle = document.getElementById('junkSimulateToggle');
export const junkSimulateLabel = document.getElementById('junkSimulateLabel');
export const cleanJunkBtn = document.getElementById('cleanJunkBtn');
export const junkSummary = document.getElementById('junkSummary');
export const junkSelectionSummary = document.getElementById('junkSelectionSummary');
export const junkTableBody = document.getElementById('junkTableBody');
export const junkLoadingState = document.getElementById('junkLoadingState');
export const junkNoResultsState = document.getElementById('junkNoResultsState');
export const selectAllJunkCheck = document.getElementById('selectAllJunkCheck');

// Startup & services view
export const startupSearchInput = document.getElementById('startupSearchInput');
export const refreshStartupBtn = document.getElementById('refreshStartupBtn');
export const startupRefreshIcon = document.getElementById('startupRefreshIcon');
export const startupSummary = document.getElementById('startupSummary');
export const startupActiveSummary = document.getElementById('startupActiveSummary');
export const startupLoadingState = document.getElementById('startupLoadingState');
export const startupNoResultsState = document.getElementById('startupNoResultsState');
export const startupFilterTrigger = document.getElementById('startupFilterTrigger');
export const startupFilterPopover = document.getElementById('startupFilterPopover');
export const startupFilterOptions = document.getElementById('startupFilterOptions');
export const startupFilterReset = document.getElementById('startupFilterReset');
export const startupFilterBadge = document.getElementById('startupFilterBadge');
export const startupActiveFilters = document.getElementById('startupActiveFilters');
export const countRegistry = document.getElementById('countRegistry');
export const countTasks = document.getElementById('countTasks');
export const countServices = document.getElementById('countServices');
export const countHelpers = document.getElementById('countHelpers');
export const itemsRegistry = document.getElementById('itemsRegistry');
export const itemsTasks = document.getElementById('itemsTasks');
export const itemsServices = document.getElementById('itemsServices');
export const itemsHelpers = document.getElementById('itemsHelpers');

// Drivers & network view
export const subTabDrivers = document.getElementById('subTabDrivers');
export const subTabNetwork = document.getElementById('subTabNetwork');
export const paneDrivers = document.getElementById('paneDrivers');
export const paneNetwork = document.getElementById('paneNetwork');
export const driverSearchInput = document.getElementById('driverSearchInput');
export const driverFilterTrigger = document.getElementById('driverFilterTrigger');
export const driverFilterPopover = document.getElementById('driverFilterPopover');
export const driverFilterOptions = document.getElementById('driverFilterOptions');
export const driverFilterReset = document.getElementById('driverFilterReset');
export const driverFilterBadge = document.getElementById('driverFilterBadge');
export const driverActiveFilters = document.getElementById('driverActiveFilters');
export const driverDryRunCheckbox = document.getElementById('driverDryRunCheckbox');
export const btnRefreshDrivers = document.getElementById('btnRefreshDrivers');
export const pillTotalDrivers = document.getElementById('pillTotalDrivers');
export const pillProtectedDrivers = document.getElementById('pillProtectedDrivers');
export const pillDuplicateDrivers = document.getElementById('pillDuplicateDrivers');
export const driversTableBody = document.getElementById('driversTableBody');
export const driversLoadingState = document.getElementById('driversLoadingState');
export const driversNoResultsState = document.getElementById('driversNoResultsState');
export const netOptDns = document.getElementById('netOptDns');
export const netOptArp = document.getElementById('netOptArp');
export const netDryRunToggle = document.getElementById('netDryRunToggle');
export const btnCleanNetwork = document.getElementById('btnCleanNetwork');
export const netCleanStatusText = document.getElementById('netCleanStatusText');
export const netCleanResultBox = document.getElementById('netCleanResultBox');
export const btnRefreshNetwork = document.getElementById('btnRefreshNetwork');
export const pillTotalAdapters = document.getElementById('pillTotalAdapters');
export const pillPhysicalAdapters = document.getElementById('pillPhysicalAdapters');
export const pillVirtualAdapters = document.getElementById('pillVirtualAdapters');
export const networkAdaptersGrid = document.getElementById('networkAdaptersGrid');
export const networkLoadingState = document.getElementById('networkLoadingState');

// Diagnostics view
export const diagStatusPulse = document.getElementById('diagStatusPulse');
export const diagStatusBadge = document.getElementById('diagStatusBadge');
export const diagStatusBadgeText = document.getElementById('diagStatusBadgeText');
export const diagErrorBanner = document.getElementById('diagErrorBanner');
export const diagMetricEngine = document.getElementById('diagMetricEngine');
export const diagMetricVersion = document.getElementById('diagMetricVersion');
export const diagMetricPlatform = document.getElementById('diagMetricPlatform');
export const diagMetricElevation = document.getElementById('diagMetricElevation');
export const diagMetricPath = document.getElementById('diagMetricPath');
export const diagPingBtn = document.getElementById('diagPingBtn');
export const diagTimestamp = document.getElementById('diagTimestamp');
export const activityLogList = document.getElementById('activityLogList');

// Settings & restore
export const restoreStatusBadge = document.getElementById('restoreStatusBadge');
export const restoreStatusBadgeText = document.getElementById('restoreStatusBadgeText');
export const restoreDescInput = document.getElementById('restoreDescInput');
export const restoreSimulateCheck = document.getElementById('restoreSimulateCheck');
export const createRestoreBtn = document.getElementById('createRestoreBtn');
export const restoreFeedbackBanner = document.getElementById('restoreFeedbackBanner');

// Smart cache & background settings
export const cacheStatusBadge = document.getElementById('cacheStatusBadge');
export const cacheStatusBadgeText = document.getElementById('cacheStatusBadgeText');
export const cacheDetailText = document.getElementById('cacheDetailText');
export const settingInstantCache = document.getElementById('settingInstantCache');
export const settingBackgroundRefresh = document.getElementById('settingBackgroundRefresh');
export const settingMinimizeToTray = document.getElementById('settingMinimizeToTray');
export const settingRefreshInterval = document.getElementById('settingRefreshInterval');
export const refreshCacheBtn = document.getElementById('refreshCacheBtn');
export const clearCacheBtn = document.getElementById('clearCacheBtn');
export const quitAppBtn = document.getElementById('quitAppBtn');

// Status bar
export const statusBarDot = document.getElementById('statusBarDot');
export const statusBarStatus = document.getElementById('statusBarStatus');
export const statusBarEngine = document.getElementById('statusBarEngine');
export const statusBarAppsCount = document.getElementById('statusBarAppsCount');
export const statusBarTotalSize = document.getElementById('statusBarTotalSize');
export const statusBarLastScan = document.getElementById('statusBarLastScan');

// Uninstall modal
export const uninstallModal = document.getElementById('uninstallModal');
export const modalCloseX = document.getElementById('modalCloseX');
export const modalCancelBtn = document.getElementById('modalCancelBtn');
export const modalConfirmBtn = document.getElementById('modalConfirmBtn');
export const modalAppName = document.getElementById('modalAppName');
export const modalAppMeta = document.getElementById('modalAppMeta');
export const modalQuietCheck = document.getElementById('modalQuietCheck');
export const modalSimulateCheck = document.getElementById('modalSimulateCheck');
export const modalAlert = document.getElementById('modalAlert');

// Generic confirmation modal
export const confirmModal = document.getElementById('confirmModal');
export const confirmModalIcon = document.getElementById('confirmModalIcon');
export const confirmModalTitleText = document.getElementById('confirmModalTitleText');
export const confirmModalMessage = document.getElementById('confirmModalMessage');
export const confirmModalDetail = document.getElementById('confirmModalDetail');
export const confirmModalOkBtn = document.getElementById('confirmModalOkBtn');
export const confirmModalCancelBtn = document.getElementById('confirmModalCancelBtn');
export const confirmModalCloseX = document.getElementById('confirmModalCloseX');

// Mission Control dashboard
export const dashEngineChip = document.getElementById('dashEngineChip');
export const dashEngineChipText = document.getElementById('dashEngineChipText');
export const dashScanChip = document.getElementById('dashScanChip');
export const dashOnboarding = document.getElementById('dashOnboarding');
export const dashRetryEngineBtn = document.getElementById('dashRetryEngineBtn');
export const dashDiagBtn = document.getElementById('dashDiagBtn');
export const dashCardApps = document.getElementById('dashCardApps');
export const dashAppsValue = document.getElementById('dashAppsValue');
export const dashAppsHint = document.getElementById('dashAppsHint');
export const dashCardJunk = document.getElementById('dashCardJunk');
export const dashJunkValue = document.getElementById('dashJunkValue');
export const dashJunkHint = document.getElementById('dashJunkHint');
export const dashCardStartup = document.getElementById('dashCardStartup');
export const dashStartupValue = document.getElementById('dashStartupValue');
export const dashStartupHint = document.getElementById('dashStartupHint');
export const dashCardDrivers = document.getElementById('dashCardDrivers');
export const dashDriversValue = document.getElementById('dashDriversValue');
export const dashDriversHint = document.getElementById('dashDriversHint');
export const dashCardShield = document.getElementById('dashCardShield');
export const dashShieldValue = document.getElementById('dashShieldValue');
export const dashShieldHint = document.getElementById('dashShieldHint');
export const dashCardCache = document.getElementById('dashCardCache');
export const dashCacheValue = document.getElementById('dashCacheValue');
export const dashCacheHint = document.getElementById('dashCacheHint');

// Command palette
export const commandPalette = document.getElementById('commandPalette');
export const paletteInput = document.getElementById('paletteInput');
export const paletteResults = document.getElementById('paletteResults');

// Toast container
export const toastContainer = document.getElementById('toastContainer');
