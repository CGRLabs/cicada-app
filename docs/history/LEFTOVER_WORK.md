# Leftover Work — Cicada Uninstaller (UI/GUI Polish)

> **Status: complete.** All actionable items in sections 1–5 are done and committed.
> Section 6 remains a backlog of out-of-scope feature ideas. Section 7 lists the items opened by
> the theme/filter/icon session (see `docs/UI_ICON_POLISH_PROGRESS.md` §12).
> See `docs/UI_ICON_POLISH_PROGRESS.md` for the full history of the polish sessions.

## 1. Pending cleanup (low-risk, cosmetic) — DONE

- [x] **Unified `.stats-strip` and `.stats-row`.**
  - Both now share one base rule in `styles.css` (`display:flex; align-items:center;
    gap:8px; font-size:11.5px; color:var(--text-muted); flex-shrink:0`), with per-instance
    overrides: `.stats-strip` keeps its full-width bar styling (padding / border-bottom /
    `space-between`), `.stats-row` keeps `flex-wrap` for the sub-view pill rows.
- [x] **Dropped the unused `i-chevron-left` sprite symbol.**
  - Removed from the sprite in `src/gui/index.html`; it had no references. Sprite is now
    34 symbols.
- [x] **Silenced the "unused symbol" scanner noise.**
  - Added an explanatory comment above the sprite listing the dynamically-resolved symbols
    (`i-info`, `i-folder`, `i-server`, `i-wifi`, `i-check-circle`) and noting why a naive
    static scan flags them.
- [x] **Documented the `i-more` row-actions icon** as intentionally hover-only (matches the
      original `⋯` behaviour); noted in the same sprite comment.

## 2. Documentation tidy-up — DONE

- [x] **Renumbered "Implemented Features" in `README.md`.**
  - Now a coherent Phase 0–7 list plus a "UI/GUI Polish" entry matching the commit history:
    Phase 6 = offline snapshot cache + background sync, Phase 7 = drivers & network manager
    (GUI + `cicada drivers` / `cicada network` CLI).
- [x] **Updated the README theming note** (there was no screenshot to refresh).
  - Documented the light / dark / auto themes and that the choice persists locally
    (`localStorage`). Also corrected the stale "18 automated tests" to 21.

## 3. UX decisions — RESOLVED

- [x] **Keep all confirmations.** Decision: keep the styled confirm modal on junk cleanup,
      network stack flush, and snapshot purge. Consistency and safety win; nothing was relaxed.
- [x] **Replace remaining native browser calls.** No `window.alert` / `prompt` were ever used;
      the only remaining `window.confirm` is the documented degraded-mode fallback inside
      `showConfirm()` for when the modal markup is missing.
- [x] **Unified `.chip` / `.chip-btn`.** Dropped the `.chip` alias; CSS now styles only
      `.chip-btn`, and the drivers toolbar markup uses `class="chip-btn"`.

## 4. Git hygiene — DONE

- [x] **Committed the working tree:** `src/gui/index.html`, `src/gui/renderer.js`,
      `src/gui/styles.css`, `README.md`, plus the new `docs/` folder.
- [x] **Verified throwaway artifacts.** No `gui-check` directory (or temp server/harness)
      remains anywhere in the repo.

## 5. Verification (run before committing) — DONE

- [x] `node --test test/client.test.js` → 21/21 pass
- [x] `electron.exe . --test-launch --user-data-dir=<temp>` → exit 0
- [x] `node --check src/gui/renderer.js` → clean
- [x] CSS braces balanced (326/326)
- [x] All `#i-*` references resolve (34/34 symbols)
- [x] No emoji remaining in `index.html` / `renderer.js`
- [x] No native `window.confirm` / `alert` / `prompt` in `src/gui/` (only the documented fallback)

## 6. Suggested next feature work (out of scope, backlog)

- [ ] Native notification / toast improvements (e.g. persistent, action buttons).
- [ ] Keyboard shortcuts for destructive flows (Enter to confirm, Esc to cancel — already partially wired).
- [ ] Accessibility pass: ARIA roles/labels on modal, focus trap, screen-reader announcements for toasts.
- [ ] High-contrast / reduced-motion theme variants.
- [ ] README screenshots of the new icon system and confirm modal.

## 7. Opened by the theme / filter / icon session

- [ ] **Filter popover keyboard navigation** — options are tab-reachable, but there is no focus trap
      and no arrow-key roving focus inside a facet (see `UI_ICON_POLISH_PROGRESS.md` §12.7).
- [ ] **Focus trap for the confirm modal** — Escape/Cancel/backdrop all work; Tab can still leave the card.
- [ ] **README screenshots** of the new filter popovers and the regenerated app icon.
- [ ] Icon source artwork (`assets/icon-source.jpg`) is committed as the regeneration input; if a
      different brand export is wanted, replace it and re-run `scripts/generate-icons.ps1`.
