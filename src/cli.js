#!/usr/bin/env node

import { EngineClient, resolveEnginePath } from './engine/client.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function printVersion() {
  try {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));
    console.log(`cicada ${pkg.version}`);
  } catch {
    console.log('cicada (version unknown)');
  }
}

function printHelp() {
  console.log(`Cicada Uninstaller CLI

Usage:
  cicada doctor             Check engine connectivity, version, platform, and elevation
  cicada list [options]     List installed applications discovered by the engine
  cicada uninstall <app>    Uninstall application (with silent & simulation options)
  cicada clean [app]        Scan and clean leftover residual files and registry keys
  cicada startup [options]  List startup entries, services, and scheduled tasks
  cicada restore [options]  Inspect System Restore status or create restore checkpoint
  cicada drivers [options]  List or clean OEM driver packages
  cicada network [options]  Inspect network adapters or flush DNS/ARP caches
  cicada help               Show this help message

Options for list:
  --search <query>          Filter applications by name or publisher
  --limit <n>               Maximum items to display (default: 50, 0 for all)
  --json                    Output raw JSON array of applications

Options for uninstall:
  --quiet, -q               Use quiet / unattended uninstallation
  --dry-run, -n             Simulate uninstallation preview without making changes

Options for clean:
  --dry-run, -n             Simulate cleanup without deleting (default)
  --force                   Execute live deletion to Recycle Bin for verified leftovers

Options for startup:
  --type <type>             Filter by item kind (Startup, Service, Task, Browser)
  --json                    Output raw JSON array of startup items

Options for restore:
  --create [description]    Create a new system restore point
  --dry-run, -n             Simulate restore point creation

Other:
  --version, -v             Print the shell version
  help                      Show this help message

Environment variables:
  CICADA_ENGINE_PATH        Override path to cicada-engine.exe
`);
}

async function runDoctor() {
  const enginePath = resolveEnginePath();

  console.log('Cicada Doctor');
  console.log('=============');

  if (!enginePath) {
    console.error('Status:          Disconnected');
    console.error('Error:           Could not locate cicada-engine.exe binary.');
    console.error('Resolution:      Build the engine or set CICADA_ENGINE_PATH to the engine executable.');
    process.exitCode = 1;
    return;
  }

  console.log(`Engine Binary:   ${enginePath}`);

  const client = new EngineClient({ enginePath, timeoutMs: 5000 });

  try {
    const startTime = Date.now();
    const result = await client.ping();
    const elapsed = Date.now() - startTime;

    const elevationStr = result.elevated
      ? 'Elevated (Administrator)'
      : 'Unelevated (Standard User)';

    console.log(`Status:          Connected (${elapsed}ms)`);
    console.log(`Engine Name:     ${result.engine || 'cicada'}`);
    console.log(`Engine Version:  ${result.version}`);
    console.log(`Platform:        ${process.platform}-${process.arch} (engine arch: ${result.platform || 'unknown'})`);
    console.log(`Elevation State: ${elevationStr}`);
  } catch (err) {
    console.error(`Status:          Error`);
    console.error(`Error:           ${err.message}`);
    process.exitCode = 1;
  } finally {
    await client.stop();
  }
}

async function runList(args) {
  const enginePath = resolveEnginePath();
  if (!enginePath) {
    console.error('Error: Could not locate cicada-engine.exe binary.');
    process.exitCode = 1;
    return;
  }

  const isJson = args.includes('--json');
  let search = null;
  const searchIdx = args.indexOf('--search');
  if (searchIdx !== -1 && args[searchIdx + 1]) {
    search = args[searchIdx + 1].toLowerCase();
  }

  let limit = 40;
  const limitIdx = args.findIndex((a) => a.startsWith('--limit'));
  if (limitIdx !== -1) {
    const val = args[limitIdx].includes('=') ? args[limitIdx].split('=')[1] : args[limitIdx + 1];
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) limit = parsed;
  }

  if (!isJson) {
    console.log('Scanning installed applications via Cicada Engine...');
  }

  const client = new EngineClient({ enginePath, timeoutMs: 90000 });
  try {
    const res = await client.getApps();
    let apps = res.apps || [];

    if (search) {
      apps = apps.filter(
        (a) =>
          (a.displayName && a.displayName.toLowerCase().includes(search)) ||
          (a.publisher && a.publisher.toLowerCase().includes(search)) ||
          (a.installLocation && a.installLocation.toLowerCase().includes(search))
      );
    }

    const displayed = limit === 0 ? apps : apps.slice(0, limit);

    if (isJson) {
      console.log(JSON.stringify(displayed, null, 2));
      return;
    }

    console.log(`\nDiscovered ${apps.length} applications${search ? ` matching "${search}"` : ''}:\n`);
    console.log(
      `${'Application Name'.padEnd(42)} ${'Version'.padEnd(16)} ${'Publisher'.padEnd(24)} ${'Size'.padStart(10)}`
    );
    console.log('-'.repeat(96));

    for (const app of displayed) {
      const name = (app.displayName || 'Unknown').substring(0, 40).padEnd(42);
      const ver = (app.displayVersion || '').substring(0, 15).padEnd(16);
      const pub = (app.publisher || '').substring(0, 22).padEnd(24);
      const sizeStr = app.estimatedSizeKb > 0 ? `${(app.estimatedSizeKb / 1024).toFixed(1)} MB` : '-';
      console.log(`${name} ${ver} ${pub} ${sizeStr.padStart(10)}`);
    }

    if (limit > 0 && apps.length > limit) {
      console.log(`\n... and ${apps.length - limit} more. Use --limit 0 to view all, or launch the GUI.`);
    }
  } catch (err) {
    console.error(`Error scanning applications: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await client.stop();
  }
}

async function runUninstall(args) {
  const enginePath = resolveEnginePath();
  if (!enginePath) {
    console.error('Error: Could not locate cicada-engine.exe binary.');
    process.exitCode = 1;
    return;
  }

  const quiet = args.includes('--quiet') || args.includes('-q');
  const simulate = args.includes('--dry-run') || args.includes('--simulate') || args.includes('-n');
  const appIds = args.filter((a) => !a.startsWith('-'));

  if (appIds.length === 0) {
    console.error('Error: Application name or ID required.\nExample: cicada uninstall "7-Zip" --dry-run');
    process.exitCode = 1;
    return;
  }

  if (appIds.length > 1) {
    console.log(`\nCicada Bulk Uninstaller`);
    console.log(`=======================`);
    console.log(`Targets:   ${appIds.length} application(s)`);
    console.log(`Mode:      ${simulate ? 'Dry-Run Simulation (No system changes)' : 'Live Uninstallation'}`);
    console.log(`Quiet:     ${quiet ? 'Enabled (Unattended)' : 'Disabled (Interactive wizard)'}`);

    const client = new EngineClient({ enginePath, timeoutMs: 120000 });
    try {
      const result = await client.uninstallBatch({ apps: appIds, quiet, simulate });
      console.log(`\nResult:    Success`);
      console.log(`Message:   ${result.message}`);
      console.log(`Summary:   ${result.successful} successful, ${result.refused} refused, ${result.failed} failed\n`);
      for (const res of result.results || []) {
        const statusTag = `[${res.status.toUpperCase()}]`.padEnd(14);
        console.log(`  ${statusTag} ${res.displayName || res.id}${res.error ? ` (${res.error})` : ''}`);
      }
    } catch (err) {
      console.error(`\nResult:    Refused / Failed`);
      console.error(`Error:     ${err.message}`);
      process.exitCode = 1;
    } finally {
      await client.stop();
    }
    return;
  }

  const appId = appIds[0];
  console.log(`\nCicada Uninstaller`);
  console.log(`==================`);
  console.log(`Target:    ${appId}`);
  console.log(`Mode:      ${simulate ? 'Dry-Run Simulation (No system changes)' : 'Live Uninstallation'}`);
  console.log(`Quiet:     ${quiet ? 'Enabled (Unattended)' : 'Disabled (Interactive wizard)'}`);

  const client = new EngineClient({ enginePath, timeoutMs: 60000 });
  try {
    const result = await client.uninstallApp({ id: appId, quiet, simulate });
    console.log(`\nResult:    Success`);
    console.log(`Status:    ${result.status}`);
    if (result.exitCode !== undefined) {
      console.log(`Exit Code: ${result.exitCode}`);
    }
    if (result.uninstallerCommand) {
      console.log(`Target:    ${result.uninstallerCommand}`);
    }
  } catch (err) {
    console.error(`\nResult:    Refused / Failed`);
    console.error(`Error:     ${err.message}`);
    process.exitCode = 1;
  } finally {
    await client.stop();
  }
}

async function runClean(args) {
  const enginePath = resolveEnginePath();
  if (!enginePath) {
    console.error('Error: Could not locate cicada-engine.exe binary.');
    process.exitCode = 1;
    return;
  }

  const simulate = args.includes('--dry-run') || args.includes('-n') || !args.includes('--force');
  const appId = args.find((a) => !a.startsWith('-'));

  console.log(`\nCicada Leftover Junk Cleaner`);
  console.log(`============================`);
  console.log(`Target:    ${appId || 'Orphaned Residuals'}`);
  console.log(`Mode:      ${simulate ? 'Dry-Run Simulation (Preview without deleting)' : 'Live Cleanup'}`);

  const client = new EngineClient({ enginePath, timeoutMs: 90000 });
  try {
    console.log(`\nScanning for residual filesystem and registry items...`);
    const scanRes = await client.scanJunk({ id: appId });
    const items = scanRes.items || [];

    if (items.length === 0) {
      console.log(`No leftover junk items found.`);
      return;
    }

    console.log(`Found ${items.length} residual item(s):\n`);
    for (const item of items) {
      const typeTag = `[${item.entryType || 'Item'}]`.padEnd(16);
      const confTag = `(${item.confidence || 'Good'})`.padEnd(12);
      const protTag = item.isProtected ? ' [PROTECTED - REFUSED]' : '';
      console.log(`  ${typeTag} ${confTag} ${item.path}${protTag}`);
    }

    console.log(`\nExecuting cleanup (${simulate ? 'Simulation' : 'Live'})...`);
    const cleanRes = await client.cleanJunk({
      all: true,
      simulate
    });

    console.log(`\nResult:    Success`);
    console.log(`Status:    ${cleanRes.status}`);
    console.log(`Message:   ${cleanRes.message}`);
    if (cleanRes.refusedCount > 0) {
      console.log(`Protected: ${cleanRes.refusedCount} item(s) protected by Authoritative Deny-List`);
    }
  } catch (err) {
    console.error(`\nResult:    Refused / Failed`);
    console.error(`Error:     ${err.message}`);
    process.exitCode = 1;
  } finally {
    await client.stop();
  }
}

async function runStartup(args) {
  const enginePath = resolveEnginePath();
  if (!enginePath) {
    console.error('Error: Could not locate cicada-engine.exe binary.');
    process.exitCode = 1;
    return;
  }

  const isJson = args.includes('--json');
  let typeFilter = null;
  const typeIdx = args.indexOf('--type');
  if (typeIdx !== -1 && args[typeIdx + 1]) {
    typeFilter = args[typeIdx + 1].toLowerCase();
  }

  if (!isJson) {
    console.log('Enumerating startup items, services, and tasks...');
  }

  const client = new EngineClient({ enginePath, timeoutMs: 60000 });
  try {
    const res = await client.listStartup();
    let items = res.items || [];

    if (typeFilter) {
      items = items.filter((x) => (x.kind || '').toLowerCase().includes(typeFilter));
    }

    if (isJson) {
      console.log(JSON.stringify(items, null, 2));
      return;
    }

    console.log(`\nDiscovered ${items.length} startup item(s):\n`);
    const nameWidth = 32;
    const typeWidth = 10;
    const stateWidth = 10;
    const protWidth = 10;

    console.log(
      'Name'.padEnd(nameWidth) +
      'Type'.padEnd(typeWidth) +
      'State'.padEnd(stateWidth) +
      'Protected'.padEnd(protWidth) +
      'Command / Path'
    );
    console.log('-'.repeat(95));

    for (const item of items) {
      const name = (item.name || 'Unknown').slice(0, nameWidth - 2).padEnd(nameWidth);
      const kind = (item.kind || 'Startup').slice(0, typeWidth - 2).padEnd(typeWidth);
      const state = (item.disabled ? 'Disabled' : 'Enabled').padEnd(stateWidth);
      const prot = (item.isProtected ? 'Yes' : 'No').padEnd(protWidth);
      const cmd = item.command || item.commandFilePath || item.location || '';
      console.log(`${name}${kind}${state}${prot}${cmd}`);
    }
  } catch (err) {
    console.error(`Error querying startup entries: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await client.stop();
  }
}

async function runRestore(args) {
  const enginePath = resolveEnginePath();
  if (!enginePath) {
    console.error('Error: Could not locate cicada-engine.exe binary.');
    process.exitCode = 1;
    return;
  }

  const isDryRun = args.includes('--dry-run') || args.includes('-n');
  const createIdx = args.findIndex((a) => a === '--create' || a.startsWith('--create='));

  const client = new EngineClient({ enginePath, timeoutMs: 60000 });
  try {
    if (createIdx !== -1) {
      let desc = 'Cicada Uninstaller Checkpoint';
      const rawArg = args[createIdx];
      if (rawArg.includes('=')) {
        desc = rawArg.split('=')[1];
      } else if (args[createIdx + 1] && !args[createIdx + 1].startsWith('-')) {
        desc = args[createIdx + 1];
      }

      console.log(`Creating System Restore Point: "${desc}" (dry-run: ${isDryRun})...`);
      const res = await client.createRestorePoint({ description: desc, simulate: isDryRun });
      console.log(`Result:  ${res.ok ? 'Success' : 'Failed'}`);
      console.log(`Message: ${res.message || 'Complete'}`);
    } else {
      const res = await client.getRestoreStatus();
      console.log('System Restore Status');
      console.log('=====================');
      console.log(`Available on Host: ${res.available ? 'Yes (Enabled)' : 'No (Disabled or Unsupported)'}`);
    }
  } catch (err) {
    console.error(`System restore error: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await client.stop();
  }
}

async function runDrivers(args) {
  const enginePath = resolveEnginePath();
  if (!enginePath) {
    console.error('Error: Could not locate cicada-engine.exe binary.');
    process.exitCode = 1;
    return;
  }

  const isJson = args.includes('--json');
  const deleteTarget = args.includes('--delete') ? args[args.indexOf('--delete') + 1] : null;
  const isDryRun = args.includes('--dry-run') || args.includes('-n');

  const client = new EngineClient({ enginePath, timeoutMs: 15000 });
  try {
    if (deleteTarget) {
      const result = await client.deleteDriver({ id: deleteTarget, dryRun: isDryRun });
      if (isJson) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(result.message || 'Driver deletion completed.');
      }
      return;
    }

    const result = await client.listDrivers();
    if (isJson) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    const drivers = result.drivers || [];
    console.log(`\nDiscovered ${drivers.length} OEM driver packages:\n`);
    console.log('INF Name'.padEnd(14) + 'Class'.padEnd(16) + 'Provider'.padEnd(28) + 'Version'.padEnd(18) + 'Status');
    console.log('-'.repeat(85));

    for (const d of drivers) {
      const status = d.isProtected ? '[PROTECTED]' : (d.isDuplicate ? '[DUPLICATE]' : '[Active]');
      console.log(
        (d.publishedName || '').padEnd(14) +
        (d.className || 'Unknown').padEnd(16) +
        (d.provider || 'Generic').slice(0, 26).padEnd(28) +
        (d.driverVersion || '—').padEnd(18) +
        status
      );
    }
  } catch (err) {
    console.error(`Driver error: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await client.stop();
  }
}

async function runNetwork(args) {
  const enginePath = resolveEnginePath();
  if (!enginePath) {
    console.error('Error: Could not locate cicada-engine.exe binary.');
    process.exitCode = 1;
    return;
  }

  const isJson = args.includes('--json');
  const doClean = args.includes('--clean');
  const isDryRun = args.includes('--dry-run') || args.includes('-n');

  const client = new EngineClient({ enginePath, timeoutMs: 15000 });
  try {
    if (doClean) {
      const tasks = [];
      if (args.includes('--dns')) tasks.push('dns');
      if (args.includes('--arp')) tasks.push('arp');
      if (tasks.length === 0) tasks.push('dns', 'arp');

      const result = await client.cleanNetwork({ tasks, dryRun: isDryRun });
      if (isJson) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(result.message || 'Network cleanup completed.');
        if (result.tasks) {
          for (const t of result.tasks) {
            console.log(` - ${t.task.toUpperCase()}: ${t.message}`);
          }
        }
      }
      return;
    }

    const result = await client.listNetwork();
    if (isJson) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    const adapters = result.adapters || [];
    console.log(`\nDiscovered ${adapters.length} network adapters:\n`);
    console.log('Adapter Name'.padEnd(24) + 'Type'.padEnd(16) + 'Status'.padEnd(10) + 'Virtual'.padEnd(10) + 'IP Address');
    console.log('-'.repeat(80));

    for (const a of adapters) {
      const ip = (a.ipv4Addresses && a.ipv4Addresses[0]) || '—';
      console.log(
        (a.name || '').slice(0, 22).padEnd(24) +
        (a.type || '').padEnd(16) +
        (a.status || '').padEnd(10) +
        (a.isVirtual ? 'Yes' : 'No').padEnd(10) +
        ip
      );
    }
  } catch (err) {
    console.error(`Network error: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await client.stop();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = (args[0] || '').toLowerCase();

  switch (command) {
    case 'doctor':
      await runDoctor();
      break;
    case 'list':
      await runList(args.slice(1));
      break;
    case 'uninstall':
    case 'remove':
      await runUninstall(args.slice(1));
      break;
    case 'clean':
    case 'junk':
      await runClean(args.slice(1));
      break;
    case 'startup':
    case 'services':
      await runStartup(args.slice(1));
      break;
    case 'restore':
      await runRestore(args.slice(1));
      break;
    case 'drivers':
      await runDrivers(args.slice(1));
      break;
    case 'network':
      await runNetwork(args.slice(1));
      break;
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;
    case 'version':
    case '--version':
    case '-v':
      printVersion();
      break;
    case '':
      printHelp();
      break;
    default:
      console.error(`Unknown command: "${args[0]}"\n`);
      printHelp();
      process.exitCode = 1;
      break;
  }
}

main().catch((err) => {
  console.error(`Fatal CLI error: ${err.message}`);
  process.exit(1);
});
