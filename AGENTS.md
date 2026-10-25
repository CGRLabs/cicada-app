# Cicada App Architecture Rules and Operational Principles

This document defines non-negotiable constraints, boundaries, and conventions governing this repository (`cicada-app`).

## 1. Fork-Plus-Shell Architecture

- Cicada Uninstaller uses a **fork-plus-shell** architecture:
  - **Engine (C#):** Forked from Bulk Crap Uninstaller (BCU), Apache-2.0. Sole component permitted to perform system inspection and mutation.
  - **App Shell (Electron/Node):** Brand-new user interface shell. Dumb client.
  - **CLI (Node):** Thin client executing against the engine. Dumb client.
- The shell and CLI do **not** directly inspect or mutate system state (no direct registry modifications, no service control, no raw uninstaller invocation). Only the C# engine performs operations that inspect or mutate the host.

## 2. Process Boundary and Communication

- **Communication Mechanism:** JSON-RPC 2.0 strictly over standard I/O (`stdio`).
- **Child Process Model:** One long-lived child process spawned using safe process execution primitives (`child_process.execFile` without shell).
- **No Shell String Construction:** Under no circumstances may shell commands be assembled by concatenating user strings. Process execution uses direct argument arrays.
- **No Localhost HTTP:** No localhost web servers, REST endpoints, or WebSocket servers may be opened for IPC. All inter-process communication remains exclusively stdio-based.
- **Stdout Discipline:** Standard output in `--rpc` mode is strictly reserved for newline-delimited JSON-RPC responses. Log messages and diagnostics must go to stderr or internal debug streams.

## 3. Zero Telemetry

- The engine and app shell contain **no telemetry**, no usage tracking, no analytics reporting, and no external beacons.
- No diagnostics or crash reports may be transmitted over any network connection without explicit user-initiated export.

## 4. No Network in Core

- All core software discovery, registry parsing, junk analysis, and uninstallation workflows are strictly local and offline.
- No outbound network connections may be made during application scanning, junk analysis, or removal routines.

## 5. Non-Negotiable System Deny-List

- Critical operating system paths, protected system registry hives, kernel drivers, core Windows components, and system-critical recovery files are protected by an authoritative, immutable deny-list.
- Engine operations MUST respect the deny-list and refuse destructive operations targeting protected system assets.

## 6. Safety and Testing Safeguards

- No destructive tests on real host machines.
- All testing suites must execute against isolated temporary directories, mocks, and injected runners.
- Any change to system state must be logged transparently and auditable.
