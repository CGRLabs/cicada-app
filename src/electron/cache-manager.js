import { promises as fs } from 'node:fs';
import { join } from 'node:path';

/**
 * Manages local offline caching and user preferences for instant application loading.
 * Strictly local, offline, no telemetry.
 */
export class CacheManager {
  constructor(userDataPath) {
    this.userDataPath = userDataPath;
    this.cacheFilePath = join(userDataPath, 'cicada-cache.json');
    this.settingsFilePath = join(userDataPath, 'cicada-settings.json');
    this.memoryCache = null;
    this.settings = null;
  }

  /**
   * Atomic JSON write: serializes to a temp file in the same directory, then renames.
   * A crash mid-write can never leave a truncated snapshot or settings file behind.
   * @param {string} filePath
   * @param {unknown} data
   */
  async #writeJsonAtomic(filePath, data) {
    const tmpPath = `${filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(data), 'utf8');
    await fs.rename(tmpPath, filePath);
  }

  async init() {
    try {
      await fs.mkdir(this.userDataPath, { recursive: true });
    } catch {
      // Ignore if directory already exists
    }
    await this.loadSettings();
    await this.loadCache();
  }

  async loadSettings() {
    const defaults = {
      instantCache: true,
      backgroundRefresh: true,
      minimizeToTray: false,
      refreshIntervalMinutes: 30
    };

    try {
      const content = await fs.readFile(this.settingsFilePath, 'utf8');
      this.settings = { ...defaults, ...JSON.parse(content) };
    } catch {
      this.settings = defaults;
    }
    return this.settings;
  }

  async saveSettings(newSettings = {}) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      await this.#writeJsonAtomic(this.settingsFilePath, this.settings);
    } catch (err) {
      console.error('Failed to save settings:', err.message);
    }
    return this.settings;
  }

  getSettings() {
    return this.settings || {
      instantCache: true,
      backgroundRefresh: true,
      minimizeToTray: false,
      refreshIntervalMinutes: 30
    };
  }

  async loadCache() {
    try {
      const content = await fs.readFile(this.cacheFilePath, 'utf8');
      this.memoryCache = JSON.parse(content);
      return this.memoryCache;
    } catch {
      this.memoryCache = null;
      return null;
    }
  }

  async saveAppsCache(apps = []) {
    if (!Array.isArray(apps)) return null;

    const totalKb = apps.reduce((acc, a) => acc + (a.estimatedSizeKb || 0), 0);
    const cachePayload = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      appCount: apps.length,
      totalSizeKb: totalKb,
      apps
    };

    this.memoryCache = cachePayload;

    try {
      await this.#writeJsonAtomic(this.cacheFilePath, cachePayload);
    } catch (err) {
      console.error('Failed to write apps cache:', err.message);
    }

    return cachePayload;
  }

  getCachedApps() {
    if (!this.memoryCache || !Array.isArray(this.memoryCache.apps)) {
      return null;
    }
    return {
      timestamp: this.memoryCache.timestamp,
      appCount: this.memoryCache.appCount || this.memoryCache.apps.length,
      totalSizeKb: this.memoryCache.totalSizeKb || 0,
      apps: this.memoryCache.apps
    };
  }

  async clearCache() {
    this.memoryCache = null;
    try {
      await fs.unlink(this.cacheFilePath);
    } catch {
      // Ignore if already deleted
    }
    return true;
  }

  async getCacheStats() {
    let fileSizeBytes = 0;
    try {
      const stat = await fs.stat(this.cacheFilePath);
      fileSizeBytes = stat.size;
    } catch {
      fileSizeBytes = 0;
    }

    return {
      hasCache: !!this.memoryCache,
      timestamp: this.memoryCache?.timestamp || null,
      appCount: this.memoryCache?.appCount || 0,
      totalSizeKb: this.memoryCache?.totalSizeKb || 0,
      fileSizeBytes
    };
  }
}
