# Cicada Uninstaller — Roadmap

Living document for outstanding work. Historical session logs live in
[`docs/history/`](history/).

## Status snapshot

| Area | State |
| --- | --- |
| Discovery & inventory (Win32 / Store / MSI) | Shipped |
| Single & bulk uninstall, dry-run, deny-list | Shipped |
| Leftover cleaner (files / registry / shortcuts) | Shipped |
| Startup, services & tasks manager | Shipped |
| Drivers & network manager | Shipped |
| System Restore integration | Shipped |
| Offline snapshot cache + tray background sync | Shipped |
| Electron hardening (sandbox, CSP, single instance, IPC validation) | Shipped |
| Packaging (electron-builder NSIS + portable) | Shipped |
| CI (lint + tests on windows-latest) | Shipped |
| Mission Control dashboard (summary cards, deep links) | Shipped |
| Command palette (Ctrl+K) | Shipped |
| Engine onboarding empty-state | Shipped |
| Release workflow (tag -> build -> GitHub Release) | Shipped |
| Code signing | Not started |
| Accessibility pass | Partial (high-contrast/reduced-motion themes pending) |

## Backlog

### Distribution

- [ ] Code signing certificate for the installer and portable exe
      (set `CSC_LINK` / `CSC_KEY_PASSWORD`; config already reads them and
      `.github/workflows/release.yaml` forwards the secrets).
- [x] Release workflow: tag -> build -> GitHub Release artifact upload
      (`.github/workflows/release.yaml`).
- [x] Bundle-check on CI: the release workflow runs `dist:dir`, verifies the
      packaged executable exists, then builds NSIS + portable. (A runtime
      smoke-launch of the packaged exe is still manual — it needs the engine.)

### UI / UX

- [x] Mission Control dashboard as the first view: summary cards for apps,
      reclaimable junk, startup impact, duplicate drivers, deny-list shield and
      snapshot cache — each deep-links into its view (`dashboard.js`).
- [x] Command palette (`Ctrl+K`) over apps, junk findings, startup entries,
      drivers and actions; `uninstall <name>` jumps straight to the confirm
      modal (`palette.js`, ranking in DOM-free `search-core.js`).
- [x] Focus trap for the confirm + uninstall modals (Tab cycles inside).
- [x] Filter popover arrow-key roving focus (`ArrowUp`/`ArrowDown`/`Home`/`End`),
      focus returns to the trigger on close, `ArrowDown` on the trigger opens.
- [x] Empty-state onboarding for a missing engine binary (Mission Control
      card with retry + Diagnostics deep link).
- [ ] High-contrast and reduced-motion theme variants.
- [ ] README screenshots (Mission Control, command palette, filter popovers).

### Engine interface

- [ ] Progress events for long scans (`apps.list`, `junk.scan`) so the GUI can show
      real progress instead of skeletons (requires engine-side notifications).
- [ ] Cancellation token for in-flight scans.

## UI brainstorm — candidate directions

Grounded in the current six-view structure (Applications, Junk, Startup,
Drivers & Network, Settings & Shield, Diagnostics). The shell is a dumb client,
so everything below stays in `src/gui/`.

### Direction A — "Mission Control" dashboard-first (recommended) — SHIPPED

Make the app read like an operations console instead of six parallel tools.

1. **Home dashboard as the first view.** After the instant-cache hydration,
   show a summary strip: total apps, reclaimable size (junk estimate), startup
   impact count, duplicate drivers — each card deep-links into its view.
   **Done** (`dashboard.js`), plus deny-list shield and snapshot-cache cards.
2. **Command palette (Ctrl+K).** One input that searches apps, junk findings,
   startup entries and actions ("uninstall chrome", "create restore point").
   The renderer already has all data client-side; this is pure UI.
   **Done** (`palette.js` + `search-core.js`; the uninstall verb is wired,
   restore point remains a "Go to Settings" navigation action).
3. **Progressive scan progress.** Replace the skeleton table with a real
   progress state (engine-side progress events would upgrade this further).
   **Mostly done** — progressive chunks report "Scanning... X of Y apps";
   engine-side notifications still open (see Engine interface backlog).
4. **Danger budget.** Destructive actions get a consistent "risk ring" visual
   language: protected = shield chip, bulk actions show cumulative size being
   removed. **Partially done** — batch bar shows cumulative footprint.

### Direction B — Workflow-driven "Clean my PC" wizard

A guided, opinionated flow for non-technical users: scan -> review findings
grouped by confidence -> apply -> verify. The existing six views remain as
"Advanced" surfaces. Best if the target audience expands beyond power users.

### Direction C — Density & data-tool polish

Keep the structure; push the information density and interactions to the level
of a first-class data tool:

1. Saved filter presets per view (the facet filter engine already exists).
2. Column chooser + persisted sort per view (localStorage).
3. Multi-select with shift-range clicks and Select-all-that-matches.
4. Inline detail preview pane (split view) instead of the slide-in drawer.
5. Virtualize the junk and driver tables the way the apps table already is.

### Cross-cutting additions (apply to any direction)

- **Empty-state onboarding**: when the engine binary is missing, show a
  "Build or point to the engine" card with the doctor output inline.
- **Keyboard affordances**: `Enter` confirms the focused destructive action,
  arrow-key row navigation in tables.
- **Scan status rail**: a thin status rail above the status bar showing the
  last RPC method + latency (the diagnostics view already records this).
