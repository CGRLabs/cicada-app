import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Discovers the default Cicada Engine executable location.
 * Priority:
 * 1. CICADA_ENGINE_PATH environment variable
 * 2. Packaged app resources (Electron: <install>/resources/engine/cicada-engine.exe)
 * 3. Bundled engine in cicada-app (engine/bin/cicada-engine.exe)
 * 4. Adjacent Cicada-Uinstaller build output
 * 5. Adjacent bcu-engine build output
 *
 * @returns {string|null} Resolved executable path if found, otherwise null.
 */
export function resolveEnginePath() {
  if (process.env.CICADA_ENGINE_PATH && existsSync(process.env.CICADA_ENGINE_PATH)) {
    return resolve(process.env.CICADA_ENGINE_PATH);
  }

  // When running from an electron-builder install (or `dist:dir` output), the engine is
  // bundled as an extra resource next to app.asar. `process.resourcesPath` only exists
  // inside Electron, so guard for plain-Node (CLI) usage.
  const candidates = [];
  if (process.resourcesPath) {
    candidates.push(join(process.resourcesPath, 'engine', 'cicada-engine.exe'));
  }

  candidates.push(
    resolve(__dirname, '../../engine/bin/cicada-engine.exe'),
    resolve(__dirname, '../../../Cicada-Uinstaller/bin/publish/win-x64/cicada-engine.exe'),
    resolve(__dirname, '../../../bcu-engine/bin/publish/win-x64/cicada-engine.exe'),
    resolve(process.cwd(), '../Cicada-Uinstaller/bin/publish/win-x64/cicada-engine.exe'),
    resolve(process.cwd(), '../bcu-engine/bin/publish/win-x64/cicada-engine.exe'),
    resolve(process.cwd(), 'bin/publish/win-x64/cicada-engine.exe')
  );

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * JSON-RPC 2.0 stdio client for Cicada Engine.
 * Spawns one long-lived child process using child_process.execFile (no shell).
 */
export class EngineClient {
  /**
   * @param {Object} [options={}]
   * @param {string} [options.enginePath] - Path to the engine executable
   * @param {Function} [options.spawnProcess] - Injected process spawner for testing
   * @param {number} [options.timeoutMs=10000] - Request timeout in milliseconds
   */
  constructor(options = {}) {
    this.enginePath = options.enginePath || resolveEnginePath();
    this.isCustomRunner = Boolean(options.spawnProcess);
    this.spawnProcess = options.spawnProcess || ((exe, args, opts) => execFile(exe, args, opts));
    this.timeoutMs = options.timeoutMs || 10000;

    this.process = null;
    this.nextId = 0;
    this.pendingRequests = new Map();
    this.stdoutBuffer = '';
    this.stderrBuffer = '';
    this.isConnected = false;
  }

  /**
   * Starts the long-lived engine child process in --rpc mode.
   * Uses safe process execution primitives without shell invocation.
   */
  start() {
    if (this.process) {
      return;
    }

    if (!this.isCustomRunner && (!this.enginePath || !existsSync(this.enginePath))) {
      throw new Error(`Cicada engine executable not found. Checked path: ${this.enginePath || 'none'}`);
    }

    // Spawn engine directly without shell to prevent shell string concatenation vulnerabilities
    this.process = this.spawnProcess(
      this.enginePath,
      ['--rpc'],
      {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      }
    );

    this.isConnected = true;

    this.process.stdout.setEncoding('utf8');
    this.process.stdout.on('data', (chunk) => this._onStdoutData(chunk));

    this.process.stderr.setEncoding('utf8');
    this.process.stderr.on('data', (chunk) => {
      this.stderrBuffer += chunk;
      // Stderr is reserved for diagnostic logs, not JSON-RPC messages
    });

    this.process.on('error', (err) => {
      this._handleProcessClose(new Error(`Failed to spawn engine process: ${err.message}`));
    });

    this.process.on('close', (code, signal) => {
      const exitReason = `Engine process exited (code=${code}, signal=${signal}). Stderr: ${this.stderrBuffer.trim()}`;
      this._handleProcessClose(new Error(exitReason));
    });
  }

  /**
   * Internal handler for incoming stdout data chunks.
   * Expects newline-delimited JSON-RPC 2.0 messages.
   * @param {string} chunk
   */
  _onStdoutData(chunk) {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split(/\r?\n/);
    // Keep the trailing incomplete line segment in the buffer
    this.stdoutBuffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const message = JSON.parse(trimmed);
        this._dispatchResponse(message);
      } catch (err) {
        // Discard or log parse errors for malformed lines
      }
    }
  }

  /**
   * Dispatches parsed JSON-RPC message to corresponding pending request.
   * @param {Object} message
   */
  _dispatchResponse(message) {
    if (message.id === undefined || message.id === null) {
      return;
    }

    const pending = this.pendingRequests.get(message.id);
    if (!pending) {
      return;
    }

    this.pendingRequests.delete(message.id);
    clearTimeout(pending.timeoutId);

    if (message.error) {
      const err = new Error(message.error.message || 'JSON-RPC Error');
      err.code = message.error.code;
      err.data = message.error.data;
      pending.reject(err);
    } else {
      pending.resolve(message.result);
    }
  }

  /**
   * Cleans up pending requests when process terminates.
   * @param {Error} error
   */
  _handleProcessClose(error) {
    this.isConnected = false;
    this.process = null;

    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeoutId);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  /**
   * Sends a JSON-RPC 2.0 request over stdin and waits for the response.
   * @param {string} method
   * @param {Object} [params={}]
   * @param {Object} [options={}]
   * @param {number} [options.timeoutMs] - Per-request timeout override (does not mutate client state,
   *   so concurrent requests with different deadlines are safe)
   * @returns {Promise<any>}
   */
  request(method, params = {}, options = {}) {
    if (!this.process || !this.isConnected) {
      try {
        this.start();
      } catch (err) {
        return Promise.reject(err);
      }
    }

    const id = ++this.nextId;
    const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? options.timeoutMs
      : this.timeoutMs;
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params
    });

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request '${method}' timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeoutId });

      try {
        this.process.stdin.write(payload + '\n', 'utf8', (err) => {
          if (err) {
            clearTimeout(timeoutId);
            this.pendingRequests.delete(id);
            reject(err);
          }
        });
      } catch (err) {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(id);
        reject(err);
      }
    });
  }

  /**
   * Sends ping method to engine.
   * Returns `{ ok: true, engine: 'cicada', version: string, platform: string, elevated: boolean }`.
   * @returns {Promise<{ ok: boolean, engine: string, version: string, platform?: string, elevated?: boolean }>}
   */
  async ping() {
    return this.request('ping');
  }

  /**
   * Retrieves discovered applications from the engine.
   * @param {Object} [options={}]
   * @param {boolean} [options.refresh=false] - If true, triggers a fresh system scan
   * @returns {Promise<{ ok: boolean, total: number, apps: Array<Object> }>}
   */
  async getApps(options = {}) {
    return this.request('apps.list', options, { timeoutMs: 90000 });
  }

  /**
   * Executes or simulates uninstallation of a specified application.
   * Enforces system deny-list at the engine level.
   * @param {Object} options
   * @param {string} options.id - Application registry key or identifier
   * @param {boolean} [options.quiet=false] - Prefer silent / quiet uninstaller
   * @param {boolean} [options.simulate=false] - Dry run simulation mode
   * @returns {Promise<Object>}
   */
  async uninstallApp(options = {}) {
    return this.request('apps.uninstall', options, { timeoutMs: 60000 });
  }

  /**
   * Executes or simulates batch uninstallation of multiple applications.
   * Enforces authoritative deny-list for all items in the batch.
   * @param {Object} options
   * @param {Array<string>} options.apps - Array of application IDs or names
   * @param {boolean} [options.quiet=true] - Prefer silent unattended uninstall
   * @param {boolean} [options.simulate=false] - Dry run simulation mode
   * @returns {Promise<Object>}
   */
  async uninstallBatch(options = {}) {
    return this.request('apps.uninstallBatch', options, { timeoutMs: 120000 });
  }

  /**
   * Scans for residual files, directories, registry entries, and shortcuts.
   * @param {Object} [options={}]
   * @param {string} [options.id] - Target application ID or null for orphaned leftovers
   * @returns {Promise<{ ok: boolean, total: number, items: Array<Object> }>}
   */
  async scanJunk(options = {}) {
    return this.request('junk.scan', options, { timeoutMs: 90000 });
  }

  /**
   * Cleans residual items or simulates the cleanup.
   * Authoritative deny-list is enforced by the C# engine.
   * @param {Object} options
   * @param {Array<string>} [options.items] - Array of junk IDs (e.g. ['junk_0', 'junk_1'])
   * @param {boolean} [options.all=false] - Clean all discovered junk items
   * @param {boolean} [options.simulate=true] - Dry-run simulation mode
   * @returns {Promise<Object>}
   */
  async cleanJunk(options = {}) {
    return this.request('junk.clean', options, { timeoutMs: 60000 });
  }

  /**
   * Retrieves startup items, services, tasks, and browser helpers.
   * @param {Object} [options={}]
   * @param {boolean} [options.refresh=false]
   * @returns {Promise<{ ok: boolean, total: number, items: Array<Object> }>}
   */
  async listStartup(options = {}) {
    return this.request('startup.list', options, { timeoutMs: 60000 });
  }

  /**
   * Enables or disables a startup item or service.
   * @param {Object} options
   * @param {string} options.id - Target startup ID or name
   * @param {boolean} options.disabled - True to disable, false to enable
   * @param {boolean} [options.simulate=false] - Dry-run simulation
   * @returns {Promise<Object>}
   */
  async toggleStartup(options = {}) {
    return this.request('startup.toggle', options);
  }

  /**
   * Deletes a startup item or service.
   * Protected items are refused by the C# engine.
   * @param {Object} options
   * @param {string} options.id - Target startup ID or name
   * @param {boolean} [options.simulate=false] - Dry-run simulation
   * @returns {Promise<Object>}
   */
  async deleteStartup(options = {}) {
    return this.request('startup.delete', options);
  }

  /**
   * Queries Windows System Restore availability.
   * @returns {Promise<{ ok: boolean, available: boolean }>}
   */
  async getRestoreStatus() {
    return this.request('system.restoreStatus');
  }

  /**
   * Creates a System Restore Point.
   * @param {Object} [options={}]
   * @param {string} [options.description='Cicada Uninstaller Checkpoint']
   * @param {boolean} [options.simulate=false]
   * @returns {Promise<Object>}
   */
  async createRestorePoint(options = {}) {
    return this.request('system.createRestorePoint', options, { timeoutMs: 60000 });
  }

  /**
   * Enumerates third-party OEM drivers installed on the host.
   * @param {Object} [options={}]
   * @returns {Promise<Object>}
   */
  async listDrivers(options = {}) {
    return this.request('drivers.list', options);
  }

  /**
   * Deletes a driver package from the system driver store.
   * Protected drivers on the system deny-list are refused by the engine.
   * @param {Object} options
   * @param {string} options.id - e.g. "oem13.inf"
   * @param {boolean} [options.dryRun=false]
   * @param {boolean} [options.simulate=false]
   * @returns {Promise<Object>}
   */
  async deleteDriver(options = {}) {
    return this.request('drivers.delete', options);
  }

  /**
   * Enumerates network adapters and their interfaces.
   * @param {Object} [options={}]
   * @returns {Promise<Object>}
   */
  async listNetwork(options = {}) {
    return this.request('network.list', options);
  }

  /**
   * Performs network cache cleanup (DNS flush, ARP table reset).
   * @param {Object} [options={}]
   * @param {string[]} [options.tasks=['dns', 'arp']]
   * @param {boolean} [options.dryRun=false]
   * @param {boolean} [options.simulate=false]
   * @returns {Promise<Object>}
   */
  async cleanNetwork(options = {}) {
    return this.request('network.clean', options);
  }

  /**
   * Closes the engine process cleanly.
   */
  async stop() {
    if (!this.process) return;

    this.isConnected = false;
    try {
      this.process.stdin.end();
    } catch {
      // Ignored
    }

    return new Promise((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }

      const timer = setTimeout(() => {
        if (this.process) {
          try {
            this.process.kill();
          } catch {
            // Ignored
          }
        }
        resolve();
      }, 1000);

      this.process.once('close', () => {
        clearTimeout(timer);
        this.process = null;
        resolve();
      });
    });
  }
}
