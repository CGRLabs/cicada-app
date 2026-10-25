/**
 * Strict allow-list sanitizers for renderer -> main IPC payloads.
 *
 * The renderer is an untrusted boundary: every `ipcMain.handle` handler receives
 * attacker-controllable objects. The engine is the sole system mutator (fork-plus-shell),
 * so these validators are defense-in-depth — they guarantee that only well-formed,
 * bounded, allow-listed options ever reach the engine's stdin.
 *
 * Rules:
 * - Unknown keys are stripped.
 * - Values are coerced to the declared type or replaced with the default.
 * - Strings are capped (defensive bound, far above any legitimate value).
 * - Arrays are capped in length; each element is validated.
 */

const MAX_STRING = 4096;
const MAX_ARRAY = 10000;

function clampString(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.length > MAX_STRING ? value.slice(0, MAX_STRING) : value;
}

function toBool(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function clampStringLength(value) {
  return value.length > MAX_STRING ? value.slice(0, MAX_STRING) : value;
}

/**
 * Builds a sanitizer that copies only the declared keys from an input object.
 * @param {Record<string, 'boolean'|'string'|'string[]'>} schema - allowed keys and their types
 * @returns {(input: unknown) => Record<string, unknown>}
 */
function makeSanitizer(schema) {
  return function sanitize(input) {
    const out = {};
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return out;
    }
    for (const [key, type] of Object.entries(schema)) {
      const value = input[key];
      if (value === undefined || value === null) continue;

      switch (type) {
        case 'boolean':
          out[key] = toBool(value);
          break;
        case 'string': {
          if (typeof value !== 'string') break;
          out[key] = clampStringLength(value);
          break;
        }
        case 'string[]': {
          if (!Array.isArray(value)) break;
          const items = value
            .slice(0, MAX_ARRAY)
            .filter((v) => typeof v === 'string' && v.length > 0)
            .map((v) => clampString(v));
          if (items.length > 0) out[key] = items;
          break;
        }
        default:
          break;
      }
    }
    return out;
  };
}

/** engine:get-apps → apps.list */
export const sanitizeListAppsOptions = makeSanitizer({ refresh: 'boolean' });

/** engine:uninstall-app → apps.uninstall */
export const sanitizeUninstallAppOptions = makeSanitizer({
  id: 'string',
  quiet: 'boolean',
  simulate: 'boolean'
});

/** engine:uninstall-batch → apps.uninstallBatch */
export const sanitizeUninstallBatchOptions = makeSanitizer({
  apps: 'string[]',
  quiet: 'boolean',
  simulate: 'boolean'
});

/** engine:scan-junk → junk.scan */
export const sanitizeScanJunkOptions = makeSanitizer({ id: 'string' });

/** engine:clean-junk → junk.clean */
export const sanitizeCleanJunkOptions = makeSanitizer({
  items: 'string[]',
  all: 'boolean',
  simulate: 'boolean'
});

/** engine:list-startup → startup.list */
export const sanitizeListStartupOptions = makeSanitizer({ refresh: 'boolean' });

/** engine:toggle-startup → startup.toggle */
export const sanitizeToggleStartupOptions = makeSanitizer({
  id: 'string',
  disabled: 'boolean',
  simulate: 'boolean'
});

/** engine:delete-startup → startup.delete */
export const sanitizeDeleteStartupOptions = makeSanitizer({
  id: 'string',
  simulate: 'boolean'
});

/** engine:create-restore-point → system.createRestorePoint */
export const sanitizeCreateRestorePointOptions = makeSanitizer({
  description: 'string',
  simulate: 'boolean'
});

/** engine:delete-driver → drivers.delete */
export const sanitizeDeleteDriverOptions = makeSanitizer({
  id: 'string',
  dryRun: 'boolean',
  simulate: 'boolean'
});

/** engine:clean-network → network.clean */
export const sanitizeCleanNetworkOptions = makeSanitizer({
  tasks: 'string[]',
  dryRun: 'boolean',
  simulate: 'boolean'
});

const REFRESH_INTERVALS = new Set([0, 15, 30, 60]);

/**
 * Validates the settings object persisted to disk. Only known keys are kept and
 * `refreshIntervalMinutes` is constrained to the values the UI offers.
 * @param {unknown} input
 * @returns {Record<string, unknown>} safe settings (may be empty — caller merges)
 */
export function sanitizeSettings(input) {
  const out = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return out;
  }
  if (typeof input.instantCache === 'boolean') out.instantCache = input.instantCache;
  if (typeof input.backgroundRefresh === 'boolean') out.backgroundRefresh = input.backgroundRefresh;
  if (typeof input.minimizeToTray === 'boolean') out.minimizeToTray = input.minimizeToTray;
  if (typeof input.refreshIntervalMinutes === 'number' && REFRESH_INTERVALS.has(input.refreshIntervalMinutes)) {
    out.refreshIntervalMinutes = input.refreshIntervalMinutes;
  }
  return out;
}
