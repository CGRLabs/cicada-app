import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { EngineClient, resolveEnginePath } from '../src/engine/client.js';

test('resolveEnginePath returns existing binary path', () => {
  const enginePath = resolveEnginePath();
  assert.ok(enginePath, 'Engine path should be resolved');
  assert.match(enginePath, /cicada-engine\.exe$/i);
});

test('EngineClient communicates over stdio using mock process runner', async () => {
  function createMockProcess() {
    const proc = new EventEmitter();
    proc.stdin = new PassThrough();
    proc.stdout = new PassThrough();
    proc.stderr = new PassThrough();
    proc.kill = () => proc.emit('close', 0, null);

    // Read incoming JSON-RPC from stdin and echo mock response to stdout
    let buffer = '';
    proc.stdin.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        const msg = JSON.parse(line);
        if (msg.method === 'ping') {
          const resp = {
            jsonrpc: '2.0',
            id: msg.id,
            result: {
              ok: true,
              engine: 'cicada',
              version: '6.3.0.0',
              platform: 'x64',
              elevated: false
            }
          };
          proc.stdout.write(JSON.stringify(resp) + '\n');
        }
      }
    });

    return proc;
  }

  const client = new EngineClient({
    enginePath: 'C:\\fake\\cicada-engine.exe',
    spawnProcess: () => createMockProcess(),
    timeoutMs: 2000
  });

  const result = await client.ping();
  assert.equal(result.ok, true);
  assert.equal(result.engine, 'cicada');
  assert.equal(result.version, '6.3.0.0');
  assert.equal(result.platform, 'x64');
  assert.equal(result.elevated, false);

  await client.stop();
});

test('EngineClient handles method error response correctly', async () => {
  function createMockProcess() {
    const proc = new EventEmitter();
    proc.stdin = new PassThrough();
    proc.stdout = new PassThrough();
    proc.stderr = new PassThrough();
    proc.kill = () => proc.emit('close', 0, null);

    proc.stdin.on('data', (chunk) => {
      const msg = JSON.parse(chunk.toString('utf8').trim());
      const resp = {
        jsonrpc: '2.0',
        id: msg.id,
        error: { code: -32601, message: 'Method not found' }
      };
      proc.stdout.write(JSON.stringify(resp) + '\n');
    });

    return proc;
  }

  const client = new EngineClient({
    enginePath: 'C:\\fake\\cicada-engine.exe',
    spawnProcess: () => createMockProcess(),
    timeoutMs: 2000
  });

  await assert.rejects(
    async () => {
      await client.request('unknown_method');
    },
    {
      message: 'Method not found'
    }
  );

  await client.stop();
});

test('EngineClient integration with compiled cicada-engine.exe', async (t) => {
  const enginePath = resolveEnginePath();
  if (!enginePath) {
    t.skip('Compiled cicada-engine.exe not found on disk, skipping integration test');
    return;
  }

  const client = new EngineClient({ enginePath, timeoutMs: 5000 });
  try {
    const res = await client.ping();
    assert.equal(res.ok, true);
    assert.equal(res.engine, 'cicada');
    assert.ok(res.version, 'Version must be present');
    assert.ok(typeof res.elevated === 'boolean', 'Elevated must be boolean');
  } finally {
    await client.stop();
  }
});

test('CLI cicada doctor prints engine version, platform, and elevation', async (t) => {
  const enginePath = resolveEnginePath();
  if (!enginePath) {
    t.skip('Compiled cicada-engine.exe not found on disk, skipping CLI test');
    return;
  }

  await new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      ['src/cli.js', 'doctor'],
      { cwd: process.cwd() },
      (err, stdout, stderr) => {
        if (err) {
          return reject(new Error(`CLI error: ${err.message}\n${stderr}`));
        }

        assert.match(stdout, /Cicada Doctor/);
        assert.match(stdout, /Status:\s+Connected/);
        assert.match(stdout, /Engine Name:\s+cicada/);
        assert.match(stdout, /Engine Version:\s+6\.3/);
        assert.match(stdout, /Platform:\s+/);
        assert.match(stdout, /Elevation State:\s+/);
        resolve();
      }
    );
  });
});

test('CLI cicada help prints usage instructions', async () => {
  await new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      ['src/cli.js', '--help'],
      { cwd: process.cwd() },
      (err, stdout) => {
        if (err) return reject(err);
        assert.match(stdout, /Cicada Uninstaller CLI/);
        assert.match(stdout, /cicada doctor/);
        assert.match(stdout, /cicada list/);
        resolve();
      }
    );
  });
});

test('CLI cicada list prints discovered applications table', async (t) => {
  const enginePath = resolveEnginePath();
  if (!enginePath) {
    t.skip('Compiled cicada-engine.exe not found on disk, skipping CLI test');
    return;
  }

  await new Promise((resolveTest, rejectTest) => {
    execFile(
      process.execPath,
      ['src/cli.js', 'list', '--limit', '5'],
      { cwd: process.cwd() },
      (err, stdout, stderr) => {
        if (err) {
          return rejectTest(new Error(`CLI error: ${err.message}\n${stderr}`));
        }

        assert.match(stdout, /Discovered \d+ applications/);
        assert.match(stdout, /Application Name\s+Version/);
        resolveTest();
      }
    );
  });
});

test('EngineClient uninstallApp sends apps.uninstall RPC and parses response', async () => {
  function createMockProcess() {
    const proc = new EventEmitter();
    proc.stdin = new PassThrough();
    proc.stdout = new PassThrough();
    proc.stderr = new PassThrough();
    proc.kill = () => proc.emit('close', 0, null);

    proc.stdin.on('data', (chunk) => {
      const msg = JSON.parse(chunk.toString('utf8').trim());
      if (msg.method === 'apps.uninstall') {
        const resp = {
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            status: 'simulated',
            exitCode: 0,
            uninstallerCommand: 'MsiExec.exe /X{FAKE-GUID}',
            uninstallerKind: 'Msi'
          }
        };
        proc.stdout.write(JSON.stringify(resp) + '\n');
      }
    });

    return proc;
  }

  const client = new EngineClient({
    enginePath: 'C:\\fake\\cicada-engine.exe',
    spawnProcess: () => createMockProcess(),
    timeoutMs: 2000
  });

  const res = await client.uninstallApp({ id: 'TestApp', quiet: true, simulate: true });
  assert.equal(res.status, 'simulated');
  assert.equal(res.exitCode, 0);
  assert.equal(res.uninstallerKind, 'Msi');

  await client.stop();
});

test('CLI cicada uninstall requires target application name or ID', async () => {
  await new Promise((resolveTest) => {
    execFile(
      process.execPath,
      ['src/cli.js', 'uninstall'],
      { cwd: process.cwd() },
      (err, stdout, stderr) => {
        assert.ok(err, 'Should exit with non-zero error code');
        assert.match(stderr, /Application name or ID required/);
        resolveTest();
      }
    );
  });
});

test('CLI cicada uninstall with --dry-run simulates uninstallation without mutation', async (t) => {
  const enginePath = resolveEnginePath();
  if (!enginePath) {
    t.skip('Compiled cicada-engine.exe not found on disk, skipping CLI test');
    return;
  }

  await new Promise((resolveTest, rejectTest) => {
    execFile(
      process.execPath,
      ['src/cli.js', 'uninstall', '7-Zip', '--dry-run', '--quiet'],
      { cwd: process.cwd() },
      (err, stdout, stderr) => {
        if (err) {
          // If 7-Zip is not installed, it outputs Refused / Failed with not found
          assert.match(stderr, /not found/i);
          return resolveTest();
        }

        assert.match(stdout, /Mode:\s+Dry-Run Simulation/);
        assert.match(stdout, /Result:\s+Success/);
        assert.match(stdout, /Status:\s+simulated/);
        resolveTest();
      }
    );
  });
});

test('EngineClient scanJunk and cleanJunk send RPC methods and parse responses', async () => {
  function createMockProcess() {
    const proc = new EventEmitter();
    proc.stdin = new PassThrough();
    proc.stdout = new PassThrough();
    proc.stderr = new PassThrough();
    proc.kill = () => proc.emit('close', 0, null);

    proc.stdin.on('data', (chunk) => {
      const msg = JSON.parse(chunk.toString('utf8').trim());
      if (msg.method === 'junk.scan') {
        const resp = {
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            ok: true,
            total: 2,
            items: [
              {
                id: 'junk_0',
                path: 'HKEY_CURRENT_USER\\Software\\TestJunk',
                entryType: 'RegistryKey',
                confidence: 'VeryGood',
                app: 'TestApp',
                isProtected: false
              },
              {
                id: 'junk_1',
                path: 'C:\\Program Files\\TestJunk',
                entryType: 'FileSystem',
                confidence: 'Good',
                app: 'TestApp',
                isProtected: false
              }
            ]
          }
        };
        proc.stdout.write(JSON.stringify(resp) + '\n');
      } else if (msg.method === 'junk.clean') {
        const resp = {
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            ok: true,
            simulated: true,
            status: 'simulated',
            totalTargeted: 2,
            successCount: 2,
            failedCount: 0,
            refusedCount: 0,
            message: 'Simulation complete: 2 junk items would be cleaned (0 protected items refused).'
          }
        };
        proc.stdout.write(JSON.stringify(resp) + '\n');
      }
    });

    return proc;
  }

  const client = new EngineClient({
    enginePath: 'C:\\fake\\cicada-engine.exe',
    spawnProcess: () => createMockProcess(),
    timeoutMs: 2000
  });

  const scan = await client.scanJunk({ id: 'TestApp' });
  assert.equal(scan.ok, true);
  assert.equal(scan.total, 2);
  assert.equal(scan.items[0].id, 'junk_0');
  assert.equal(scan.items[0].confidence, 'VeryGood');

  const clean = await client.cleanJunk({ items: ['junk_0', 'junk_1'], simulate: true });
  assert.equal(clean.ok, true);
  assert.equal(clean.simulated, true);
  assert.equal(clean.successCount, 2);

  await client.stop();
});

test('CLI cicada clean --dry-run scans and simulates leftover removal', async (t) => {
  const enginePath = resolveEnginePath();
  if (!enginePath) {
    t.skip('Compiled cicada-engine.exe not found on disk, skipping CLI test');
    return;
  }

  await new Promise((resolveTest, rejectTest) => {
    execFile(
      process.execPath,
      ['src/cli.js', 'clean', '7-Zip', '--dry-run'],
      { cwd: process.cwd() },
      (err, stdout, stderr) => {
        if (err) {
          assert.match(stderr, /not found|Error/i);
          return resolveTest();
        }

        assert.match(stdout, /Cicada Leftover Junk Cleaner/);
        assert.match(stdout, /Mode:\s+Dry-Run Simulation/);
        assert.match(stdout, /Result:\s+Success/);
        resolveTest();
      }
    );
  });
});

test('EngineClient uninstallBatch sends apps.uninstallBatch and parses response', async () => {
  function createMockProcess() {
    const proc = new EventEmitter();
    proc.stdin = new PassThrough();
    proc.stdout = new PassThrough();
    proc.stderr = new PassThrough();
    proc.kill = () => proc.emit('close', 0, null);

    proc.stdin.on('data', (chunk) => {
      const msg = JSON.parse(chunk.toString('utf8').trim());
      if (msg.method === 'apps.uninstallBatch') {
        const resp = {
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            ok: true,
            simulated: true,
            total: 2,
            successful: 2,
            refused: 0,
            failed: 0,
            results: [
              { id: 'AppA', displayName: 'App A', status: 'simulated' },
              { id: 'AppB', displayName: 'App B', status: 'simulated' }
            ],
            message: 'Batch simulation complete: 2 application(s) verified, 0 protected item(s) refused.'
          }
        };
        proc.stdout.write(JSON.stringify(resp) + '\n');
      }
    });

    return proc;
  }

  const client = new EngineClient({
    enginePath: 'C:\\fake\\cicada-engine.exe',
    spawnProcess: () => createMockProcess(),
    timeoutMs: 2000
  });

  const res = await client.uninstallBatch({ apps: ['AppA', 'AppB'], simulate: true });
  assert.equal(res.ok, true);
  assert.equal(res.total, 2);
  assert.equal(res.successful, 2);
  assert.equal(res.results[0].status, 'simulated');

  await client.stop();
});

test('CLI cicada uninstall supports bulk dry-run simulation for multiple apps', async (t) => {
  const enginePath = resolveEnginePath();
  if (!enginePath) {
    t.skip('Compiled cicada-engine.exe not found on disk, skipping CLI test');
    return;
  }

  await new Promise((resolveTest) => {
    execFile(
      process.execPath,
      ['src/cli.js', 'uninstall', '7-Zip', 'Git', '--dry-run', '--quiet'],
      { cwd: process.cwd() },
      (err, stdout) => {
        assert.match(stdout, /Cicada Bulk Uninstaller/);
        assert.match(stdout, /Mode:\s+Dry-Run Simulation/);
        assert.match(stdout, /Result:\s+Success/);
        assert.match(stdout, /Summary:/);
        resolveTest();
      }
    );
  });
});

test('EngineClient startup and restore methods send JSON-RPC and parse responses', async () => {
  function createMockProcess() {
    const proc = new EventEmitter();
    proc.stdin = new PassThrough();
    proc.stdout = new PassThrough();
    proc.stderr = new PassThrough();
    proc.kill = () => proc.emit('close', 0, null);

    proc.stdin.on('data', (chunk) => {
      const msg = JSON.parse(chunk.toString('utf8').trim());
      if (msg.method === 'startup.list') {
        const resp = {
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            ok: true,
            total: 1,
            items: [{ id: 'st_0', name: 'MockUpdater', kind: 'Startup', disabled: false, isProtected: false }]
          }
        };
        proc.stdout.write(JSON.stringify(resp) + '\n');
      } else if (msg.method === 'startup.toggle') {
        const resp = {
          jsonrpc: '2.0',
          id: msg.id,
          result: { ok: true, simulated: true, id: msg.params.id, disabled: msg.params.disabled }
        };
        proc.stdout.write(JSON.stringify(resp) + '\n');
      } else if (msg.method === 'startup.delete') {
        const resp = {
          jsonrpc: '2.0',
          id: msg.id,
          result: { ok: true, simulated: true, id: msg.params.id }
        };
        proc.stdout.write(JSON.stringify(resp) + '\n');
      } else if (msg.method === 'system.restoreStatus') {
        const resp = {
          jsonrpc: '2.0',
          id: msg.id,
          result: { ok: true, available: true }
        };
        proc.stdout.write(JSON.stringify(resp) + '\n');
      } else if (msg.method === 'system.createRestorePoint') {
        const resp = {
          jsonrpc: '2.0',
          id: msg.id,
          result: { ok: true, simulated: true, description: msg.params.description, sequenceNumber: 1001 }
        };
        proc.stdout.write(JSON.stringify(resp) + '\n');
      }
    });

    return proc;
  }

  const client = new EngineClient({
    enginePath: 'C:\\fake\\cicada-engine.exe',
    spawnProcess: () => createMockProcess(),
    timeoutMs: 2000
  });

  const list = await client.listStartup();
  assert.equal(list.ok, true);
  assert.equal(list.total, 1);
  assert.equal(list.items[0].name, 'MockUpdater');

  const tog = await client.toggleStartup({ id: 'st_0', disabled: true, simulate: true });
  assert.equal(tog.ok, true);
  assert.equal(tog.disabled, true);

  const del = await client.deleteStartup({ id: 'st_0', simulate: true });
  assert.equal(del.ok, true);
  assert.equal(del.simulated, true);

  const stat = await client.getRestoreStatus();
  assert.equal(stat.ok, true);
  assert.equal(stat.available, true);

  const cr = await client.createRestorePoint({ description: 'Test Point', simulate: true });
  assert.equal(cr.ok, true);
  assert.equal(cr.simulated, true);

  await client.stop();
});

test('CLI cicada startup enumerates items', async (t) => {
  const enginePath = resolveEnginePath();
  if (!enginePath) {
    t.skip('Compiled cicada-engine.exe not found on disk, skipping CLI test');
    return;
  }

  await new Promise((resolveTest) => {
    execFile(
      process.execPath,
      ['src/cli.js', 'startup', '--type', 'Task'],
      { cwd: process.cwd() },
      (err, stdout) => {
        assert.match(stdout, /Discovered \d+ startup item/);
        assert.match(stdout, /Name\s+Type\s+State\s+Protected/);
        resolveTest();
      }
    );
  });
});

test('CLI cicada restore creates simulated restore point', async (t) => {
  const enginePath = resolveEnginePath();
  if (!enginePath) {
    t.skip('Compiled cicada-engine.exe not found on disk, skipping CLI test');
    return;
  }

  await new Promise((resolveTest) => {
    execFile(
      process.execPath,
      ['src/cli.js', 'restore', '--create', 'Test Point', '--dry-run'],
      { cwd: process.cwd() },
      (err, stdout) => {
        assert.match(stdout, /Creating System Restore Point:/);
        assert.match(stdout, /Result:\s+Success/);
        resolveTest();
      }
    );
  });
});

test('Electron shell launches and completes diagnostic cycle', async (t) => {
  const electronBin = resolve(
    process.cwd(),
    process.platform === 'win32'
      ? 'node_modules/electron/dist/electron.exe'
      : 'node_modules/.bin/electron'
  );
  if (!existsSync(electronBin)) {
    t.skip('Electron binary not found, skipping UI launch test');
    return;
  }

  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const userDataDir = await mkdtemp(join(tmpdir(), 'cicada-electron-launch-'));

  try {
    await new Promise((resolveTest, rejectTest) => {
      execFile(
        electronBin,
        ['.', '--test-launch', `--user-data-dir=${userDataDir}`],
        { cwd: process.cwd(), timeout: 10000 },
        (err) => {
          if (err) return rejectTest(err);
          resolveTest();
        }
      );
    });
  } finally {
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
});

test('CacheManager stores, retrieves, and purges offline snapshots and settings', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { CacheManager } = await import('../src/electron/cache-manager.js');

  const tempDir = await mkdtemp(join(tmpdir(), 'cicada-cache-test-'));

  try {
    const manager = new CacheManager(tempDir);
    await manager.init();

    // Default settings check
    const initialSettings = manager.getSettings();
    assert.equal(initialSettings.instantCache, true);
    assert.equal(initialSettings.backgroundRefresh, true);
    assert.equal(initialSettings.minimizeToTray, false);
    assert.equal(initialSettings.refreshIntervalMinutes, 30);

    // Save customized settings
    await manager.saveSettings({ minimizeToTray: true, refreshIntervalMinutes: 15 });
    const updatedSettings = manager.getSettings();
    assert.equal(updatedSettings.minimizeToTray, true);
    assert.equal(updatedSettings.refreshIntervalMinutes, 15);

    // Initial empty cache
    assert.equal(manager.getCachedApps(), null);
    const initialStats = await manager.getCacheStats();
    assert.equal(initialStats.hasCache, false);
    assert.equal(initialStats.appCount, 0);

    // Save applications cache
    const mockApps = [
      { id: 'app-1', displayName: 'VLC Media Player', estimatedSizeKb: 45000 },
      { id: 'app-2', displayName: 'Git', estimatedSizeKb: 90000 }
    ];
    await manager.saveAppsCache(mockApps);

    // Retrieve cached apps
    const cached = manager.getCachedApps();
    assert.ok(cached);
    assert.equal(cached.appCount, 2);
    assert.equal(cached.totalSizeKb, 135000);
    assert.equal(cached.apps.length, 2);
    assert.equal(cached.apps[0].displayName, 'VLC Media Player');

    const statsAfterSave = await manager.getCacheStats();
    assert.equal(statsAfterSave.hasCache, true);
    assert.equal(statsAfterSave.appCount, 2);
    assert.ok(statsAfterSave.fileSizeBytes > 0);

    // Clear cache
    await manager.clearCache();
    assert.equal(manager.getCachedApps(), null);
    const statsAfterClear = await manager.getCacheStats();
    assert.equal(statsAfterClear.hasCache, false);
    assert.equal(statsAfterClear.appCount, 0);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test('EngineClient driver and network methods send JSON-RPC and parse responses', async () => {
  function createMockProcess() {
    const proc = new EventEmitter();
    proc.stdin = new PassThrough();
    proc.stdout = new PassThrough();
    proc.stderr = new PassThrough();
    proc.kill = () => proc.emit('close', 0, null);

    let buffer = '';
    proc.stdin.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        const msg = JSON.parse(line);
        if (msg.method === 'drivers.list') {
          proc.stdout.write(JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            result: {
              ok: true,
              total: 2,
              drivers: [
                { id: 'oem1.inf', publishedName: 'oem1.inf', provider: 'Intel', className: 'System', isProtected: true },
                { id: 'oem2.inf', publishedName: 'oem2.inf', provider: 'Realtek', className: 'Net', isProtected: false }
              ]
            }
          }) + '\n');
        } else if (msg.method === 'drivers.delete') {
          proc.stdout.write(JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            result: {
              ok: true,
              simulated: Boolean(msg.params?.dryRun || msg.params?.simulate),
              infName: msg.params?.id || msg.params?.infName,
              message: 'Driver package deleted or simulated'
            }
          }) + '\n');
        } else if (msg.method === 'network.list') {
          proc.stdout.write(JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            result: {
              ok: true,
              total: 2,
              adapters: [
                { id: '{GUID1}', name: 'Ethernet', description: 'Realtek GbE', isVirtual: false, status: 'Up' },
                { id: '{GUID2}', name: 'vEthernet', description: 'Hyper-V Switch', isVirtual: true, status: 'Up' }
              ]
            }
          }) + '\n');
        } else if (msg.method === 'network.clean') {
          proc.stdout.write(JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            result: {
              ok: true,
              simulated: Boolean(msg.params?.dryRun || msg.params?.simulate),
              tasks: [{ task: 'dns', status: 'flushed' }],
              message: 'Network cleanup completed successfully.'
            }
          }) + '\n');
        }
      }
    });

    return proc;
  }

  const client = new EngineClient({
    enginePath: 'C:\\fake\\cicada-engine.exe',
    spawnProcess: () => createMockProcess(),
    timeoutMs: 2000
  });

  try {
    const driverList = await client.listDrivers();
    assert.equal(driverList.ok, true);
    assert.equal(driverList.total, 2);
    assert.equal(driverList.drivers[0].className, 'System');
    assert.equal(driverList.drivers[0].isProtected, true);

    const driverDel = await client.deleteDriver({ id: 'oem2.inf', dryRun: true });
    assert.equal(driverDel.ok, true);
    assert.equal(driverDel.simulated, true);
    assert.equal(driverDel.infName, 'oem2.inf');

    const netList = await client.listNetwork();
    assert.equal(netList.ok, true);
    assert.equal(netList.total, 2);
    assert.equal(netList.adapters[0].name, 'Ethernet');
    assert.equal(netList.adapters[1].isVirtual, true);

    const netClean = await client.cleanNetwork({ tasks: ['dns'], dryRun: true });
    assert.equal(netClean.ok, true);
    assert.equal(netClean.simulated, true);
  } finally {
    await client.stop();
  }
});

test('Real cicada-engine handles drivers.list and network.list offline', async (t) => {
  const enginePath = resolveEnginePath();
  if (!enginePath) {
    t.skip('Compiled cicada-engine.exe not found on disk, skipping real engine driver test');
    return;
  }

  const client = new EngineClient({ enginePath, timeoutMs: 15000 });
  try {
    const drivers = await client.listDrivers();
    assert.equal(drivers.ok, true);
    assert.ok(typeof drivers.total === 'number');
    assert.ok(Array.isArray(drivers.drivers));

    const network = await client.listNetwork();
    assert.equal(network.ok, true);
    assert.ok(typeof network.total === 'number');
    assert.ok(Array.isArray(network.adapters));

    const netClean = await client.cleanNetwork({ dryRun: true });
    assert.equal(netClean.ok, true);
    assert.equal(netClean.simulated, true);
  } finally {
    await client.stop();
  }
});




test('IPC option sanitizers strip unknown keys and coerce types', async () => {
  const {
    sanitizeUninstallAppOptions,
    sanitizeUninstallBatchOptions,
    sanitizeCleanJunkOptions,
    sanitizeSettings,
    sanitizeCleanNetworkOptions
  } = await import('../src/electron/ipc-validation.js');

  // Unknown keys are dropped, types are enforced
  const uninstall = sanitizeUninstallAppOptions({
    id: '7-Zip',
    quiet: 'yes',
    simulate: true,
    __proto__: { evil: true },
    shellCommand: 'del /f C:\\'
  });
  assert.deepEqual(uninstall, { id: '7-Zip', quiet: false, simulate: true });

  // Non-string id is dropped to empty string default
  assert.deepEqual(sanitizeUninstallAppOptions({ id: 42 }), {});

  // Arrays: non-strings filtered, oversized arrays capped
  const batch = sanitizeUninstallBatchOptions({
    apps: ['a', 5, null, 'b'],
    quiet: true,
    rogue: 1
  });
  assert.deepEqual(batch, { apps: ['a', 'b'], quiet: true });

  // Junk clean keeps items + flags only
  assert.deepEqual(
    sanitizeCleanJunkOptions({ items: ['junk_0'], all: true, simulate: false, extra: 'x' }),
    { items: ['junk_0'], all: true, simulate: false }
  );

  // Settings: refresh interval constrained to offered values
  assert.deepEqual(
    sanitizeSettings({ instantCache: false, minimizeToTray: true, refreshIntervalMinutes: 30 }),
    { instantCache: false, minimizeToTray: true, refreshIntervalMinutes: 30 }
  );
  assert.deepEqual(sanitizeSettings({ refreshIntervalMinutes: 9999 }), {});
  assert.deepEqual(sanitizeSettings('not an object'), {});

  // Network tasks allow-list by type
  assert.deepEqual(
    sanitizeCleanNetworkOptions({ tasks: ['dns', 'arp', 7], dryRun: true }),
    { tasks: ['dns', 'arp'], dryRun: true }
  );
});

test('EngineClient supports per-request timeouts without mutating shared state', async () => {
  function createMockProcess() {
    const proc = new EventEmitter();
    proc.stdin = new PassThrough();
    proc.stdout = new PassThrough();
    proc.stderr = new PassThrough();
    proc.kill = () => proc.emit('close', 0, null);

    proc.stdin.on('data', (chunk) => {
      const msg = JSON.parse(chunk.toString('utf8').trim());
      // Slow responder: replies after 250ms regardless of method
      setTimeout(() => {
        proc.stdout.write(JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          result: { ok: true, echo: msg.method }
        }) + '\n');
      }, 250);
    });

    return proc;
  }

  const client = new EngineClient({
    enginePath: 'C:\\fake\\cicada-engine.exe',
    spawnProcess: () => createMockProcess(),
    timeoutMs: 100
  });

  // Default (100ms) timeout fires on a 250ms response
  await assert.rejects(() => client.request('slow.method'), /timed out after 100ms/);
  // Per-request override beats the shared default without touching client.timeoutMs
  const result = await client.request('slow.method', {}, { timeoutMs: 2000 });
  assert.equal(result.ok, true);
  assert.equal(client.timeoutMs, 100);

  await client.stop();
});

test('CLI prints shell version with --version', async () => {
  const { readFile } = await import('node:fs/promises');
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));

  await new Promise((resolveTest, rejectTest) => {
    execFile(
      process.execPath,
      ['src/cli.js', '--version'],
      { cwd: process.cwd() },
      (err, stdout) => {
        if (err) return rejectTest(err);
        assert.match(stdout.trim(), new RegExp(`^cicada ${pkg.version}$`));
        resolveTest();
      }
    );
  });
});
