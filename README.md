# Cicada Uninstaller

A modern Windows software-removal tool — an **Electron desktop app** and a **`cicada` command-line client**, backed by a hardened **C# engine** forked from [Bulk Crap Uninstaller](https://www.bcuninstaller.com/) (Apache-2.0).

Find installed software, remove it properly, and clean up the leftovers it leaves behind.

## Features

- **Discovery & inventory** — multi-threaded scanning of Win32, Store, and MSI applications with category filtering, instant search, and a detail drawer.
- **Removal** — single and bulk uninstall with quiet switches, dry-run simulation, and an authoritative system deny-list that refuses to touch protected OS assets.
- **Leftover cleaner** — deep scan of orphaned files, registry keys, and startup links, scored by confidence (`VeryGood` / `Good` / `Questionable` / `Bad`), sent to the Recycle Bin rather than hard-deleted.
- **Startup manager** — Windows startup programs, services, scheduled tasks, and browser helpers, with enable/disable toggles and removal.
- **System Restore** — verify and create restore checkpoints before destructive operations.
- **Drivers & network** — OEM driver-package inspection, network adapter inventory, and a network stack janitor (DNS/ARP flush).
- **Offline snapshot cache** — local, network-free inventory snapshots for instant cold starts, refreshed by a background sync controller.
- **Theming** — light, dark, and follow-OS (`auto`) modes, persisted between launches.

## Architecture: fork-plus-shell

Cicada Uninstaller uses a deliberate two-tier architecture. Exactly one component is permitted to inspect or mutate the host.

| Tier | Tech | Role |
| --- | --- | --- |
| **Engine** | C# | Forked from Bulk Crap Uninstaller (Apache-2.0). Sole component allowed to perform system inspection and mutation — registry parsing, service control, driver handling, uninstaller invocation. |
| **Shell** | Electron / Node | Brand-new dumb client. Desktop GUI, `cicada` CLI, and the JSON-RPC stdio adapter. Performs **no** direct registry edits, service control, or raw uninstaller calls. |

**Process boundary**

- **Transport:** JSON-RPC 2.0 strictly over standard input/output (`stdio`). Newline-delimited JSON on stdout in `--rpc` mode; logs and diagnostics go to stderr.
- **Process model:** one long-lived child process spawned via `child_process.execFile` with a direct argument array — never a shell string. No user input is ever concatenated into a command line.
- **No localhost HTTP:** no local servers, REST endpoints, or WebSockets for IPC.

**Non-negotiable guarantees**

- **Zero telemetry** — no analytics, usage tracking, or crash reporters. Nothing leaves the machine without an explicit user-initiated export.
- **Offline core** — all scanning, parsing, and removal runs locally. No outbound network connections during scanning, analysis, or removal.
- **System deny-list** — critical OS paths, protected registry hives, kernel drivers, and recovery files are protected by an immutable deny-list; the engine refuses destructive operations against them.
- **Auditable changes** — every system mutation is logged transparently.

## Repository layout

The two tiers live in separate repositories:

| Repository | Branch | Contents |
| --- | --- | --- |
| `realLLUKS/cicada-app` **(this repo)** | `main` | The shell: Electron GUI, `cicada` CLI, JSON-RPC adapter, tests. |
| `realLLUKS/Cicada-Uinstaller` | `master` | The engine: the C# fork of Bulk Crap Uninstaller, plus its licence, notice, and CI. |

Clone this repository for the shell. Clone the engine repository and build `cicada-engine.exe` from its `master` branch — the shell finds it automatically next to the checkout, or you can point at it explicitly with `CICADA_ENGINE_PATH`.

## Prerequisites

- Windows 10 or 11 (x64)
- Node.js 20+ (tested on Node 24)
- .NET 8.0 SDK (or .NET 10.0 SDK) to compile the engine

## Project structure

```
cicada-app/
├── assets/              App icons (light + dark ink variants) and source artwork
├── docs/
│   ├── ROADMAP.md       Living backlog + UI direction candidates
│   └── history/         Session logs from completed polish cycles
├── engine/
│   └── bin/             Drop-in location for cicada-engine.exe (gitignored)
├── scripts/             Developer utilities (icons, shortcut, syntax gate)
├── src/
│   ├── cli.js           The `cicada` command-line client
│   ├── electron/        Main process: window, tray, IPC, cache, validation
│   ├── engine/          JSON-RPC 2.0 stdio client for the C# engine
│   └── gui/             Renderer UI (markup, styles, logic)
└── test/                Node test runner suite (24 tests)
```

## Repository layout

The two tiers live in separate repositories:

## Building the engine

From the engine branch of this repository:

```powershell
dotnet publish source\BCU-console\BCU-console.csproj `
  -c Release `
  -r win-x64 `
  --self-contained `
  -p:PublishSingleFile=true `
  -p:IncludeNativeLibrariesForSelfExtract=true `
  -o bin\publish\win-x64
```

This produces the self-contained single-file binary:

```
bin\publish\win-x64\cicada-engine.exe
```

## Running the shell

From the `main` branch of this repository.

### Install dependencies

```powershell
npm install
```

> The shell has **zero runtime npm dependencies**. Electron is a development dependency only.

### Verify the engine connection

```powershell
npm run doctor
# or:
node src/cli.js doctor
```

```text
Cicada Doctor
=============
Engine Binary:   ..\Cicada-Uinstaller\bin\publish\win-x64\cicada-engine.exe
Status:          Connected (110ms)
Engine Name:     cicada
Engine Version:  6.3.0.0
Platform:        win32-x64 (engine arch: x64)
Elevation State: Unelevated (Standard User)
```

To point at a different engine build:

```powershell
$env:CICADA_ENGINE_PATH = "C:\path\to\cicada-engine.exe"
node src/cli.js doctor
```

### Launch the desktop app

```powershell
npm start
```

Opens the Electron interface with the **Mission Control** dashboard — summary
cards for applications, reclaimable junk, startup impact, duplicate drivers,
deny-list shield, and the snapshot cache, each deep-linking into its view.
Engine connection state, elevation, and last-scan time sit in the header strip,
and a dedicated onboarding card appears whenever the engine binary is missing.

### Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `Ctrl+K` | Command palette — search apps, junk, startup, drivers and actions |
| `Ctrl+1` … `Ctrl+7` | Switch view (Mission Control, Applications, Junk, Startup, Drivers, Settings, Diagnostics) |
| `Ctrl+F` | Focus the global search box |
| `Delete` | Uninstall the selected application |
| `Esc` | Close palette / drawer / modal / filter popover |
| `↑` `↓` `Enter` | Navigate & run inside the command palette and filter popovers |

## Packaging & distribution

The shell packages into Windows installers with [electron-builder](https://www.electron.build/) (dev dependency only):

```powershell
# Build the engine first so it is bundled into the package
dotnet publish ... -o engine\bin   # see "Building the engine" in the engine repo

npm run dist        # NSIS installer + portable exe  -> dist/
npm run dist:dir    # unpacked app for smoke-testing -> dist/win-unpacked/
```

- If `engine/bin/cicada-engine.exe` exists at build time it is bundled to
  `<install>/resources/engine/`; the packaged app resolves it automatically.
  Otherwise ship the engine alongside and point `CICADA_ENGINE_PATH` at it.
- Code signing: set `CSC_LINK` and `CSC_KEY_PASSWORD` before `npm run dist`.

## Security model

- **Sandboxed renderer** — Chromium sandbox on, `contextIsolation` on, no Node in the page.
- **Strict CSP** — `default-src 'none'`; the renderer cannot open a network connection at all (`connect-src 'none'`).
- **Allow-listed IPC** — every renderer→main payload passes strict sanitizers (`src/electron/ipc-validation.js`) before reaching the engine; unknown keys are stripped and types enforced.
- **Single instance** — a second launch focuses the running window instead of racing the cache.
- **No shell invocation** — the engine is spawned via `execFile` with a fixed argument array; no user string is ever concatenated into a command line.

## CLI usage

```powershell
# Diagnostics
node src/cli.js doctor

# Shell version
node src/cli.js --version

# Inventory: search, limits, JSON output for scripting
node src/cli.js list --search "chrome"
node src/cli.js list --limit 20
node src/cli.js list --json

# Uninstall, single or bulk, with dry-run preview
node src/cli.js uninstall "7-Zip" --dry-run
node src/cli.js uninstall "7-Zip" "Git" --dry-run --quiet

# Leftover scan and clean (to Recycle Bin)
node src/cli.js clean "7-Zip" --dry-run
node src/cli.js clean --force

# Startup programs, services, scheduled tasks
node src/cli.js startup
node src/cli.js startup --type Service
node src/cli.js startup --type Task

# System Restore
node src/cli.js restore
node src/cli.js restore --create "Pre-Uninstall Checkpoint" --dry-run

# Drivers and network
node src/cli.js drivers
node src/cli.js network
```

## Tests

```powershell
npm test
```

Runs Node's built-in test runner (`node:test`) — **24 tests, all passing**. Covers stdio JSON-RPC messaging against mocks, live integration with the compiled engine, IPC payload sanitizers, CLI command behaviour, and Electron window launch.

```powershell
npm run lint
```

Zero-dependency syntax gate (`node --check`) across `src/`, `test/`, and `scripts/`.

> Safety note: the suite runs against isolated temp directories and mocks. It performs no destructive operations against the host system.

## License

The shell — this repository — is licensed under the **Apache License 2.0**. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).

**In short: use it, change it, sell it, rebrand it — just keep the credit.**

Anyone redistributing it must keep the copyright notice and the `NOTICE`, and must state what they changed. Apache-2.0 grants **no trademark rights**, so a derivative may not market itself as "Cicada Uninstaller" — pick your own name and reference the original. That clause is what makes "rebrand it, reference me" hold: you get the credit, they don't get your brand.

### The engine

The C# engine is a **separate work**, forked from [Bulk Crap Uninstaller](https://www.bcuninstaller.com/) by Klocman and likewise under Apache-2.0. It lives in [`realLLUKS/Cicada-Uinstaller`](https://github.com/realLLUKS/Cicada-Uinstaller) and is not included here — no BCU source code is in this repository.