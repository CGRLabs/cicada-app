#!/usr/bin/env node

import { EngineClient, resolveEnginePath } from './engine/client.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Shared helpers (production-ready plumbing for every subcommand)
// ---------------------------------------------------------------------------

const ENGINE_MISSING_HINT =
  'Hint: build the engine or point Cicada at it — set CICADA_ENGINE_PATH,\n' +
  '     write {"enginePath": "C:\\\\path\\\\cicada-engine.exe"} to the cicada config file,\n' +
  '     or drop cicada-engine.exe into engine/bin/.';

/**
 * Resolves the engine path or prints a uniform, actionable error and returns null.
 * Every command used to duplicate this block with slightly different wording.
 */
function requireEnginePath(commandName) {
  const enginePath = resolveEnginePath();
  if (!enginePath) {
    console.error(`Error [${commandName}]: Could not locate cicada-engine.exe binary.`);
    console.error(ENGINE_MISSING_HINT);
    return null;
  }
  return enginePath;
}

/**
 * Runs `fn` against a freshly-spawned engine client and guarantees the child
 * process is stopped even if `fn` throws or the shell exits unexpectedly.
 * If `enginePath` is omitted it is resolved (and reported) here.
 */
async function withEngine(commandName, fn, timeoutMs, enginePath = requireEnginePath(commandName)) {
  if (!enginePath) {
    process.exitCode = 1;
    return;
  }
  const client = new EngineClient({ enginePath, timeoutMs });
  try {
    await fn(client);
  } catch (err) {
    console.error(`\nResult:    Refused / Failed`);
    console.error(`Error:     ${err.message}`);
    process.exitCode = 1;
  } finally {
    await client.stop();
  }
}

/**
 * Minimal, robust argv parser supporting:
 *   --flag               -> true
 *   --opt value          -> string
 *   --opt=value          -> string
 *   -s short form        -> mapped via `aliases`
 * Everything not consumed as an option lands in `_` (positional operands).
 */
function parseArgs(argv, { aliases = {}, valueOpts = {} } = {}) {
  const opts = { _: [] };
  const longValue = new Set(Object.keys(valueOpts));
  const longFlags = new Set(['json', 'quiet', 'dry-run', 'force', 'create', 'delete', 'clean', 'dns', 'arp', 'all', 'refresh']);
  for (const a of Object.values(aliases)) longFlags.add(a);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--') {
      opts._.push(...argv.slice(i + 1));
      break;
    }

    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
      const canonical = aliases[name] || name;

      if (eq !== -1) {
        opts[canonical] = arg.slice(eq + 1);
      } else if (longValue.has(canonical)) {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('-')) {
          opts[canonical] = next;
          i++;
        } else {
          opts[canonical] = true; // present but missing value — treated by callers
        }
      } else if (longFlags.has(canonical)) {
        opts[canonical] = true;
      } else {
        opts[canonical] = true; // unknown flags are still recorded truthily
      }
      continue;
    }

    if (arg.length > 1 && arg.startsWith('-') && !/^-\d/.test(arg)) {
      // Short options, possibly bundled (-qn). Last one may take a value.
      const chars = arg.slice(1).split('');
      for (let c = 0; c < chars.length; c++) {
        const canonical = aliases[chars[c]] || chars[c];
        if (longValue.has(canonical)) {
          const next = argv[i + 1];
          if (next !== undefined && !next.startsWith('-')) {
            opts[canonical] = next;
            i++;
          } else {
            opts[canonical] = true;
          }
        } else {
          opts[canonical] = true;
        }
      }
      continue;
    }

    opts._.push(arg);
  }

  return opts;
}

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
  --limit <n>               Maximum items to display (default: 40, 0 for all)
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

Config file (optional, enginePath key):
  Windows: %APPDATA%\\cicada\\config.json
  Linux:   ~/.config/cicada/config.json
  macOS:   ~/Library/Application Support/cicada/config.json
`);
}

async function runDoctor() {
  console.log('Cicada Doctor');
  console.log('=============');

  const enginePath = resolveEnginePath();
  if (!enginePath) {
    console.error('Status:          Disconnected');
    console.error('Error:           Could not locate cicada-engine.exe binary.');
    console.error(ENGINE_MISSING_HINT);
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
  const opts = parseArgs(args, {
    aliases: { s: 'search', l: 'limit' },
    valueOpts: { search: String, limit: Number }
  });

  const isJson = Boolean(opts.json);
  const search = typeof opts.search === 'string' ? opts.search.toLowerCase() : null;
  let limit = Number.isFinite(Number(opts.limit)) ? parseInt(opts.limit, 10) : 40;
  if (opts.limit === true) limit = 40; // --limit given without a value keeps the default

  if (!isJson) {
    console.log('Scanning installed applications via Cicada Engine...');
  }

  await withEngine('list', async (client) => {
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
  }, 90000);
}

async function runUninstall(args) {
  const opts = parseArgs(args, { aliases: { q: 'quiet', n: 'dry-run' } });
  const quiet = Boolean(opts.quiet);
  const simulate = Boolean(opts.dryRun);
  const appIds = opts._;

  // Validate user input BEFORE touching the engine — a missing operand is a usage
  // error, not an environment error, and the message must not be masked by
  // "engine not found" on machines without the binary.
  if (appIds.length === 0) {
    console.error('Error: Application name or ID required.\nExample: cicada uninstall "7-Zip" --dry-run');
    process.exitCode = 1;
    return;
  }

  const enginePath = requireEnginePath('uninstall');
  if (!enginePath) {
    process.exitCode = 1;
    return;
  }

  if (appIds.length > 1) {
    console.log(`\nCicada Bulk Uninstaller`);
    console.log(`=======================`);
    console.log(`Targets:   ${appIds.length} application(s)`);
    console.log(`Mode:      ${simulate ? 'Dry-Run Simulation (No system changes)' : 'Live Uninstallation'}`);
    console.log(`Quiet:     ${quiet ? 'Enabled (Unattended)' : 'Disabled (Interactive wizard)'}`);

    await withEngine('uninstall', async (client) => {
      const result = await client.uninstallBatch({ apps: appIds, quiet, simulate });
      console.log(`\nResult:    Success`);
      console.log(`Message:   ${result.message}`);
      console.log(`Summary:   ${result.successful} successful, ${result.refused} refused, ${result.failed} failed\n`);
      for (const res of result.results || []) {
        const statusTag = `[${res.status.toUpperCase()}]`.padEnd(14);
        console.log(`  ${statusTag} ${res.displayName || res.id}${res.error ? ` (${res.error})` : ''}`);
      }
    }, 120000, enginePath);
    return;
  }

  const appId = appIds[0];
  console.log(`\nCicada Uninstaller`);
  console.log(`==================`);
  console.log(`Target:    ${appId}`);
  console.log(`Mode:      ${simulate ? 'Dry-Run Simulation (No system changes)' : 'Live Uninstallation'}`);
  console.log(`Quiet:     ${quiet ? 'Enabled (Unattended)' : 'Disabled (Interactive wizard)'}`);

  await withEngine('uninstall', async (client) => {
    const result = await client.uninstallApp({ id: appId, quiet, simulate });
    console.log(`\nResult:    Success`);
    console.log(`Status:    ${result.status}`);
    if (result.exitCode !== undefined) {
      console.log(`Exit Code: ${result.exitCode}`);
    }
    if (result.uninstallerCommand) {
      console.log(`Target:    ${result.uninstallerCommand}`);
    }
  }, 60000, enginePath);
}

async function runClean(args) {
  const opts = parseArgs(args, { aliases: { n: 'dry-run' } });
  // Safety default: live deletion requires an explicit --force.
  const simulate = !opts.force;
  const appId = opts._[0];

  console.log(`\nCicada Leftover Junk Cleaner`);
  console.log(`============================`);
  console.log(`Target:    ${appId || 'Orphaned Residuals'}`);
  console.log(`Mode:      ${simulate ? 'Dry-Run Simulation (Preview without deleting)' : 'Live Cleanup'}`);

  await withEngine('clean', async (client) => {
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
  }, 90000);
}

async function runStartup(args) {
  const opts = parseArgs(args, { aliases: { t: 'type' }, valueOpts: { type: String } });
  const isJson = Boolean(opts.json);
  const typeFilter = typeof opts.type === 'string' ? opts.type.toLowerCase() : null;

  if (!isJson) {
    console.log('Enumerating startup items, services, and tasks...');
  }

  await withEngine('startup', async (client) => {
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
  }, 60000);
}

async function runRestore(args) {
  const opts = parseArgs(args, {
    aliases: { n: 'dry-run' },
    valueOpts: { create: String }
  });
  const isDryRun = Boolean(opts.dryRun);

  await withEngine('restore', async (client) => {
    if (opts.create !== undefined) {
      const desc = typeof opts.create === 'string' && opts.create
        ? opts.create
        : 'Cicada Uninstaller Checkpoint';

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
  }, 60000);
}

async function runDrivers(args) {
  const opts = parseArgs(args, { aliases: { n: 'dry-run' }, valueOpts: { delete: String } });
  const isJson = Boolean(opts.json);
  const isDryRun = Boolean(opts.dryRun);
  const deleteTarget = typeof opts.delete === 'string' ? opts.delete : null;

  await withEngine('drivers', async (client) => {
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
  }, 15000);
}

async function runNetwork(args) {
  const opts = parseArgs(args, { aliases: { n: 'dry-run' } });
  const isJson = Boolean(opts.json);
  const doClean = Boolean(opts.clean);
  const isDryRun = Boolean(opts.dryRun);

  await withEngine('network', async (client) => {
    if (doClean) {
      const tasks = [];
      if (opts.dns) tasks.push('dns');
      if (opts.arp) tasks.push('arp');
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
  }, 15000);
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
  console.error(`Fatal CLI error: ${err?.message || err}`);
  process.exit(1);
});
