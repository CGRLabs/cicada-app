# UI/GUI Icon System & Visual Polish — Progress Document

> Purpose: handoff document so a new session can pick up where the previous one left off.
> Branch state: working tree modified (not committed). Run `git diff --stat` to see the changed files.
> Sections 1–8 describe the original icon-system session. Section 9 covers the continuation session
> (styled confirm modal, chip dedupe, virtual-list paint fix). Sections 10–11 cover cleanup,
> consolidation and the drivers-table fix. Section 12 covers the theme rework, the multi-select
> filter system and the new app icon.

## 1. User request

> "I'd like you to work on the UI/GUI of this app"

Clarified via question: the chosen focus was **"Visual polish & icon system (Recommended)"** — replace emoji icons with a consistent inline SVG set, and refine spacing, typography, hover/focus states across all views.

## 2. Repository / architecture context

- **Repo:** `D:\Workspace\01_Active\cicada-app` (Node/Electron, zero runtime npm deps, Electron ^33.2.0 dev dep).
- **Architecture:** fork-plus-shell — C# engine (stdio JSON-RPC 2.0) + Electron shell. Shell is a dumb client; no direct system mutation.
- **GUI files (all three were modified):**
  - `src/gui/index.html` — markup (895 lines → +137)
  - `src/gui/renderer.js` — renderer logic (≈2354 lines → +70 net)
  - `src/gui/styles.css` — styles (≈2218 lines → +285)

## 3. What was accomplished

### 3.1 Inline SVG icon sprite (new)
- Added an inline `<svg class="icon-sprite">` at the top of `<body>` containing **35 `<symbol>` definitions** (stroke-based, 24px, `viewBox="0 0 24 24"`).
- Symbols: `search, refresh, sun, moon, monitor, layers, trash, settings, plug, shield, flask, chevron-right/left/down/up, close, warning, sparkles, sliders, globe, zap, lock, folder, key, package, server, wifi, check, check-circle, info, puzzle, clock, copy, power, more`.
- Sprite is hidden via `position:absolute; width:0; height:0; overflow:hidden` (not `display:none`, which can break `<use>` in some engines).
- Reference pattern: `<svg class="icon"><use href="#i-name"></use></svg>`.

### 3.2 `.icon` base styles (new CSS section)
- `width/height: 1em` → sizes with parent font-size, so they naturally match existing emoji font-size rules.
- `fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap/linejoin: round; overflow: visible; vertical-align: -0.125em; flex-shrink: 0`.
- `.badge-tag/.stat-pill/.elevation-badge .icon` get `vertical-align: -0.15em`.
- Transition hooks for `.sort-icon .icon`, `.group-chevron .icon`, `.collapse-toggle .toggle-icon .icon`.

### 3.3 Emoji → SVG replacement
- `index.html`: all static emoji replaced (search icon, rescan ↻, theme toggle 🌙/🌓/☀️, nav icons 🗂🗑⚙🔌🛡️🔬, collapse » , sort ▲▼, empty-state ✨🔍, protected 🛡️, junk scan ↻, group icons 🔑⏱⚡🧩, chevrons ▼, subtab 🎛️🌐, network janitor ⚡, adapters 🌐, settings ⚡, restore 🛡️, lock 🔒, modal ⚠️✕, etc.).
- `renderer.js`: added `svgIcon(name, extraClass)` helper next to `escapeHtml`; replaced toast icons (ℹ️✓✕⚠️), protected shields, silent check ✓, quick-detail ⋯, picker 📦, junk type icons 📁🔑⚡, startup 🔒🗑, driver badges 🔒⚠️, network card icons 🖧📶🔌, net-clean result 🔍✅.
- `0 emoji remaining` in both files (verified by Unicode scan; only typographic `•` bullets remain, intentionally).

### 3.4 Incidental bug fixes / polish
- **`.spinning` animation** was only defined as `.rescan-icon.spinning`, so Junk and Startup refresh spinners never animated. Added a generic `.spinning { animation: spin ... }` rule.
- **Group collapse chevron**: `.group-chevron` was inline, so `transform` was ignored. Made it `inline-flex` so groups now visibly rotate on collapse.
- **Sort headers**: replaced `textContent = '▲'/'▼'` (which would have wiped the SVG) with CSS-class-only toggling plus `th.sorted-desc .sort-icon .icon { transform: rotate(180deg) }`. Initial `Size` header no longer carries a stale `sorted-desc` class.
- **Activity-log dot**: replaced the `●` glyph with a real `.activity-dot` element (`.ok`/`.fail`).
- **Toast icons** tinted per type via `.toast.toast-{type} .toast-icon`.
- **Copy/Quit buttons** gained `i-copy` / `i-power` icons; `copyPathBtn` now updates `innerHTML` (so the icon survives the "Copied!" state).
- Drawer's "Scan for Leftovers" button gained a search icon.

### 3.5 Previously-missing Drivers & Network styles (new CSS block)
The Drivers view referenced many classes that had no rules. Added: `.view-header-strip`, `.view-title-group`, `.view-title`, `.view-subtitle`, `.view-toolbar`, `.toolbar-search` + `.search-icon` + `.search-input`, `.chip` (alias of `.chip-btn`), `.toolbar-actions`, `.switch-control`, `.switch-label`, `.stats-row` (plus `.subview-pane > .stats-row` padding), `.stat-pill.success/.warning/.protected`, `.btn-sm`, `.badge.badge-success`, `.network-janitor-card`.

### 3.6 `index.html` additions
- Sprite insertion after `<body>`.
- Drawer button icons; junk/startup/drivers subtabs/toolbar/buttons; group icons/chevrons; settings/restore card icons; lock note; modal title/close/warning icons; network janitor/adapters card icons; driver refresh; net-clean button; close buttons.

## 4. Files changed

| File | Δ |
|------|---|
| `src/gui/index.html` | +137 / -84 |
| `src/gui/renderer.js` | +70 / -56 |
| `src/gui/styles.css` | +285 / -1 |

Total: 408 insertions, 84 deletions (3 files).

## 5. Verification performed

- `node --test test/client.test.js` → **21/21 pass** (including the Electron shell launch test and real-engine integration tests).
- Unicode scan: **0 emoji remaining** in `index.html` / `renderer.js`.
- Static reference check: every `<use href="#i-…">` (static + dynamic `svgIcon('…')`) resolves to a defined `<symbol id="i-…">`; symbol open/close balanced (35/35).
- Browser render check (served `src/gui/` over localhost, injected mock data): all 6 views render with **no visible icon having zero geometry**; dynamic icons resolve correctly:
  - junk → `key`/`folder`/`zap`/`shield`
  - startup → `key`/`clock`/`zap`/`puzzle` + `shield`/`trash`
  - drivers → `shield`/`warning` badges
  - adapters → `plug`/`wifi`/`server`
  - theme cycle → `monitor`→`sun`→`moon`→`monitor`
  - sort click → `sorted-desc` + 180° rotation
  - group collapse → `matrix(0,-1,1,0,0,0)` (−90°) when transitions are disabled (verified they're just throttled in the background tab).

## 6. Known leftovers / suggested next steps (not done)

- **Native `window.confirm()`** is still used in `renderer.js` for startup-entry deletion and driver-package deletion — replace with the styled uninstall modal for consistency (the user's "UX consistency & fixes" option).
- `.chip` and `.chip-btn` are now duplicated aliases; `.stats-row` and `.stats-strip` overlap; could be unified into single components.
- `i-chevron-left` is defined in the sprite but currently unused (kept as a symmetric pair for future use).
- The `i-more` (row-actions detail button) only appears on row hover, so it only has non-zero geometry when hovered — expected, matches original `⋯` behavior.
- `i-info`/`i-folder`/`i-server` are referenced dynamically (`svgIcon(iconName)`, `svgIcon(typeIconName)`, ternary), so the static scanner flagged them as unused — they are in fact used.
- No README update was made; the README's "Implemented Features" list is unchanged.

## 7. How to review / run

```powershell
npm test                 # 21/21 should pass
npm start                # launch Electron shell to see the new icons
git diff -- src/gui/     # inspect the three changed files
```

## 8. Constraints respected

- No runtime npm dependencies added (Electron is the only dev dep; SVG sprite is inline).
- No localhost server opened by the app itself — the localhost server used during verification was a throwaway dev tool, stopped after the session.
- No telemetry/network added; all changes are local UI only.
- No destructive tests on the real host; the Electron launch test is the only GUI-touching test and it passed.

## 9. Session 2 (continuation) — styled confirm modal + paint fix

Picked up the top item from §6 ("Native `window.confirm()` … replace with the styled uninstall modal").

### 9.1 Generic styled confirmation modal (new)
- `index.html`: new `#confirmModal` overlay (`.modal-overlay` → `.modal-card.modal-card-sm`) with
  `#confirmModalIcon` (tone-tinted leading icon), `#confirmModalTitleText`, `#confirmModalMessage`,
  `#confirmModalDetail` (optional mono detail card), `#confirmModalCancelBtn`, `#confirmModalOkBtn`,
  `#confirmModalCloseX`. Marked `role="dialog" aria-modal="true"`.
- `styles.css` (Modals block): `.modal-card-sm`, `.modal-title-icon` + `.tone-info/.tone-warning/.tone-success`
  modifiers, `.confirm-message` (+ `strong`), `.confirm-detail`.
- `renderer.js`: promise-based `showConfirm({ title, message, detail, confirmLabel, cancelLabel, tone, icon })`
  plus `closeConfirmModal(result)`. Callers receive `true` on confirm / `false` on cancel, so handlers read
  `if (!(await showConfirm(...))) return;`.
  - `message`/`detail` are injected as HTML so callers can emphasise values with `<strong>`; user text is
    escaped by the caller with `escapeHtml()`.
  - `tone` selects the icon (`danger`/`warning` → `i-warning`, `info` → `i-info`, `success` → `i-check-circle`).
  - `tone: 'info'` renders the OK button as `btn-primary`; every other tone uses `btn-danger`.
  - Cancel paths: Cancel button, close ✕, backdrop click, and the `Escape` key.
  - A second request while one is pending cancels the previous one (no dangling promises).
  - If the markup is ever removed the helper degrades to a stripped-down `window.confirm()` fallback.
  - OK button is focused on open.

### 9.2 Native dialogs removed / destructive flows now confirmed
| Flow | Before | After |
|---|---|---|
| Startup entry deletion | native `confirm()` | `showConfirm` (danger, "Remove Entry") |
| Driver package deletion | `window.confirm()` | `showConfirm` (danger + `i-trash`; **info** tone + `i-search` in dry-run) |
| Junk cleanup | *no confirmation* | `showConfirm` when simulate is off (shows selected item count) |
| Network stack flush (DNS/ARP) | *no confirmation* | `showConfirm` when dry-run is off (lists the tasks) |
| Offline snapshot purge | *no confirmation* | `showConfirm` |

`0` native `confirm()` calls remain in `src/gui/` (only the fallback branch references `window.confirm`).
The `Delete`-key uninstall shortcut is now suppressed while the confirm modal is open.

### 9.3 Bug fix — Applications table rendered empty after a scan (real, user-visible)
`renderVirtualApps()` early-returns while `isScanning` is true, but `fetchApplications()` cleared
`isScanning = false` *after* the final progressive chunk had already painted — so the table stayed empty
once a scan finished, until the user scrolled, searched, or re-entered the tab. Fix: call
`applyFilterAndSort()` once more in the final chunk branch, after the flag is cleared (`renderer.js` ≈ line 895).

### 9.4 CSS dedupe
`.chip` was a byte-for-byte duplicate of `.chip-btn` except for a missing `box-shadow` on `.active`.
Both are now a single shared selector group (`.chip, .chip-btn { … }`), so the drivers-toolbar chips also
pick up the active-state shadow. The old `.chip` block is now just an explanatory comment.

### 9.5 Verification performed (session 2)
- `node --test test/client.test.js` → **21/21 pass** (includes the real Electron shell launch test).
- `electron.exe . --test-launch --user-data-dir=<temp>` → exit code `0` with the modified GUI loaded.
- Syntax: `node --check src/gui/renderer.js` clean; CSS braces balanced (325/325); all `#i-*` references resolve
  (35/35 symbols, balanced open/close tags).
- Offline browser harness (throwaway static server over `src/gui/` + mock `window.cicadaAPI`, temp dir only —
  no app code was changed to enable it):
  - First-load paint now renders 3/3 app rows with no interaction (the §9.3 bug).
  - For each destructive flow: **Cancel / ✕ / backdrop / Escape → zero bridge calls**; **Confirm → exactly one
    bridge call**. Verified for startup delete, driver delete (danger + dry-run info tones), network flush,
    junk cleanup (3 items selected) and snapshot purge.
  - Assertions on modal title/message/detail text, tone class, icon `href`, OK label/class, and focus landing on OK.
  - `window.__nativeConfirmUsed === false` for the entire run — no native dialog was ever raised.
  - Reopening works (modal is reusable; each open replaces the previous resolver).
- Note: the first full-suite run failed on the Electron launch test only because an already-running
  `cicada-app` instance held the shared `%APPDATA%\cicada-app` cache lock; a re-run passed 21/21 and the
  isolated `--user-data-dir` launch exited 0.

### 9.6 Leftovers after session 2
- `.stats-strip` (apps view) and `.stats-row` (sub-view panes) still overlap conceptually; not unified because
  their layouts genuinely differ (space-between bar vs wrapping pill row).
- `i-chevron-left` remains defined-but-unused (kept as a symmetric pair).
- `i-info` / `i-folder` / `i-server` are only referenced dynamically, so a naive "unused symbol" scan still
  flags them; they *are* used.
- The status bar still shows a literal `|` separator between app count and total size (typographic, intentional).
- Nothing is committed: `src/gui/index.html`, `src/gui/renderer.js`, `src/gui/styles.css` and `README.md` are
  modified in the working tree; `docs/UI_ICON_POLISH_PROGRESS.md` is untracked.

### 9.7 How to re-verify quickly
```powershell
node --test test/client.test.js                                  # 21/21
.\node_modules\electron\dist\electron.exe . --test-launch "--user-data-dir=$env:TEMP\cicada-check"   # exit 0
npm start                                                        # click any Delete / Clean / Purge action
```

## 10. Session 3 (continuation) — cleanup & consolidation

Closed out the remaining low-risk items from `docs/LEFTOVER_WORK.md`.

### 10.1 Changes
- **Unified `.stats-strip` / `.stats-row`** behind a shared base rule plus per-variant
  overrides (`.stats-strip` full-width bar, `.stats-row` wrapping pill row).
- **Removed the unused `i-chevron-left`** symbol (sprite is now 34 symbols) and added a comment
  above the sprite documenting the dynamically-resolved symbols (`i-info`, `i-folder`, `i-server`,
  `i-wifi`, `i-check-circle`) so unused-symbol scans stay quiet.
- **Dropped the `.chip` alias** — `.chip-btn` is now the single class, and the drivers toolbar
  markup was updated from `class="chip"` to `class="chip-btn"`.
- **README:** renumbered "Implemented Features" into a coherent Phase 0–7 + UI-polish list, added
  a theming note (light / dark / auto, persisted), and corrected the test count (18 → 21).

### 10.2 Decisions
- All destructive confirmations were **kept** (junk cleanup, network flush, snapshot purge).

### 10.3 Verification (session 3)
- `node --test test/client.test.js` → **21/21 pass**.
- `electron.exe . --test-launch --user-data-dir=<temp>` → exit **0**.
- `node --check src/gui/renderer.js` clean; CSS braces balanced (326/326); all `#i-*` refs resolve
  (34/34); **0 emoji** in `index.html` / `renderer.js`.

### 10.4 Status
- Working tree committed (GUI sources, README, and `docs/`). Nothing outstanding beyond the
  out-of-scope backlog in `LEFTOVER_WORK.md` §6.

## 11. Session 4 — Drivers table rendering fix

The Drivers & Network Manager table rendered as an unstyled mess. Three styling gaps were found
and fixed in `src/gui/styles.css` / `src/gui/index.html`:

1. **No `.data-table` rules existed.** `#driversTable` uses `class="data-table"`, but only
   `.apps-table` was styled, so the drivers table fell back to default browser table rendering.
   Added a `.data-table` block mirroring `.apps-table` (sticky uppercase header, 44px middle-aligned
   rows, `nowrap` + ellipsis cells, row hover) minus the selection affordances.
2. **Missing status-badge rules.** The status cells use `badge-tag danger` / `warning` / `success`,
   which had no CSS (only `.badge.badge-success` etc. existed). Added `.badge-tag.danger`,
   `.badge-tag.warning`, and `.badge-tag.success`.
3. **Hardcoded light-only class-badge colors.** `.badge-driver-*` used fixed hex values
   (`#475569`, `#059669`, `#0284c7`, `#9333ea`) that were near-invisible on the dark theme.
   Introduced theme-aware `--badge-driver-*` text variables in all four theme blocks and pointed the
   classes at them.

Also widened the Provider column by switching the drivers `<th>` widths from fixed px to percentages
(`11% / 14% / auto / 13% / 14% / 12% / 11%`), eliminating the horizontal overflow and the ragged,
wrapping provider rows.

Verified by rendering the table against the real `styles.css` in an isolated harness (dark + light):
uniform 46px rows, no horizontal overflow, no provider truncation, status badges tinted, and class
badge text `rgb(148,163,184)` (dark) / `rgb(71,85,105)` (light). Full suite still 21/21.

## 12. Session 5 — theme rework, multi-select filters, app icon

### 12.1 User request
Rework the UI so it feels more modern/professional/friendly **without changing the structure**:
the colour/theme layer "needs a rework cuz it's bad", make the filters "very modern" everywhere,
and set the app icon used by the built app from the attached line-art cicada artwork.

Clarified decisions (via question tool):
- **Icon:** switch to the attached line-art mark.
- **Theme:** refined deep-slate + emerald.
- **Scope:** restyle in place, same structure.

### 12.2 Theme token layer rebuilt (`src/gui/styles.css`)
- All four token blocks were replaced — `:root` (light default), `@media (prefers-color-scheme: dark)`,
  `:root[data-theme="dark"]`, `:root[data-theme="light"]` — around a deep-slate surface ramp and a
  single emerald accent.
- The accent was split into three explicit roles: `--accent` (fill), `--accent-fg` (accent-coloured
  text/icons on surfaces) and `--on-accent` (ink drawn on top of the accent fill). This removes the
  earlier ambiguity where one variable served both purposes.
- Added tokens: `--border-strong`, `--ring`, `--overlay` (modal scrim — `.modal-overlay` now uses it
  instead of a hardcoded `rgba(0,0,0,.6)`), `--scrollbar` / `--scrollbar-hover`, `--glow-accent`,
  `--accent-subtle`, `--bg-hover-subtle`.
- Removed the superseded/dead tokens left over from earlier sessions: `--bg-active`, `--text-inverse`,
  `--accent-bg`, `--warning-hover`, `--success-hover`, `--shadow-md`.
- Base/reset modernisation: theme-aware scrollbars, `:focus-visible` rings, `::selection` tinting and
  a `prefers-reduced-motion` guard.
- Component passes: header/brand, icon buttons/rescan, sidebar nav (with a `::before` active marker),
  buttons, switch control, `.apps-table` and `.data-table`, modals.

### 12.3 Filters — one shared multi-select model
Before: three independent single-select chip rows
(`.chip-btn[data-filter]`, `[data-startup-filter]`, `[data-driver-filter]`), each with its own
listener and its own `switch` in the filter predicate.

After: **one shared model** in `renderer.js` (`FILTER_DEFS` + `filterState` + `matchesFilters()` +
`renderFilterOptions()` / `renderActiveFilterChips()` / `setFilterPopoverOpen()`).

| Surface | Trigger | Facets |
|---|---|---|
| Applications | `#appsFilterTrigger` | Type (Desktop / Store / MSI), Size (Large), Installed (Recently), Condition (Orphaned) |
| Startup | `#startupFilterTrigger` | Kind (Registry startup / Scheduled tasks / Windows services / Browser & other) |
| Drivers | `#driverFilterTrigger` | Device class (Display / Network / Audio & media), Status (Duplicates / System protected) |

- Options are grouped into **facets**: **within a facet the selected options are OR-ed, across facets
  they are AND-ed** — so "Store" AND "Large" narrows, while "Display" OR "Network" widens within the
  Device-class facet.
- Each option shows a **live count** computed against the current dataset, a per-option glyph, and a
  checkbox tick.
- Active choices render as removable **chips** underneath the toolbar plus a **Clear all** action; the
  trigger shows a numeric badge (`.filter-badge`) and an `.is-filtered` state; Reset disables itself
  when nothing is selected.
- Toggling updates the option's pressed state in place (the popover DOM is not rebuilt, so focus and
  scroll position survive). Popovers close on outside click, when another popover opens, and on `Esc`.
- New apps meta line `#appsResultCount` → "Showing X of Y applications".

### 12.4 App icon from the attached line-art mark
- `scripts/generate-icons.ps1` — reproducible PowerShell + inline-`System.Drawing` generator. It keys
  out the flat background, auto-crops, and re-inks the mark; the small sizes get a tighter crop plus an
  alpha-boosted stroke so the glyph stays legible down to 16px.
- Source artwork moved into the repo as `assets/icon-source.jpg` (byte-identical to the attachment).
- Outputs: `assets/icon.png` (1024), `assets/icon.ico` (9 sizes, white ink),
  `assets/icon-light.ico` (9 sizes, deep-slate `#0F172A` ink), `src/gui/assets/icon.png` (256).
- `src/electron/main.js`: `resolveAppIcon()` picks the white or slate ink from
  `nativeTheme.shouldUseDarkColors`, and is applied to the window and the tray; a
  `nativeTheme.on('updated')` handler re-picks it when the OS theme changes.
  `scripts/create-shortcut.js` continues to point the desktop shortcut at `assets/icon.ico`.

### 12.5 Verification (session 5)
- `node --test test/client.test.js` → **21/21 pass**.
- `node --check src/gui/renderer.js` and `src/electron/main.js` → clean.
- CSS token audit → 72 tokens defined, **0 undefined, 0 unused**.
- Throwaway Electron harness (temp dir; loaded the real `index.html` + `renderer.js` + `styles.css`
  + `preload.cjs` with mock engine data over the real IPC channels, then deleted):
  - Apps / Startup / Drivers popovers render with correct live counts (verified by hand against the
    mock dataset).
  - A two-facet AND selection filters correctly (Store + Large → 0 results, empty state shown).
  - Chip removal and "Clear all" work; outside-click and `Esc` close the popover.
  - The confirm modal renders correctly with the new `--overlay` scrim in **both** dark and light.
  - No renderer console errors (only Electron's CSP dev warning).
  - Screenshots reviewed: apps dark/light, popover open (dark/light), active-filter chips, startup and
    drivers popovers, confirm modal (dark/light).

### 12.6 Files changed / added
| File | State |
|---|---|
| `src/gui/styles.css` | modified — new token layer, component pass, filter component styles |
| `src/gui/renderer.js` | modified — filter engine replaces the three chip-row handlers |
| `src/gui/index.html` | modified — filter toolbars/popovers + active-filter rows, sprite additions (`i-hard-drive`, `i-filter`), `.switch-control` markup fixes, `#appsResultCount` |
| `src/electron/main.js` | modified — theme-adaptive app/tray icon |
| `assets/icon.ico`, `assets/icon.png`, `src/gui/assets/icon.png` | regenerated |
| `assets/icon-light.ico`, `assets/icon-source.jpg`, `scripts/generate-icons.ps1` | new |
| `docs/UI_ICON_POLISH_PROGRESS.md` | this document |

### 12.7 Leftovers after session 5
- Filter popovers are plain dialogs: tab/click work, but there is no focus trap or arrow-key roving
  focus between options.
- README still has no screenshots.
- Nothing is committed — every change is still in the working tree.


