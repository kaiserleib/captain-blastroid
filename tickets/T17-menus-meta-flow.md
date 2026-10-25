# T17 — Title, hangar, pilot/ship select, results, pause, settings
Status: todo
Wave: 3 · Depends on: T05, T06, T14 (T01 for UI input, T04 for UI SFX) · Blocks: T18

## Goal
The full out-of-run loop in SNES menu style, usable by tap on phones and by keyboard or mouse on desktop. The pilot select screen shows the sci-fi portraits.

## Owns
`src/scenes/TitleScene.ts`, `HangarScene.ts`, `PilotSelectScene.ts`, `ShipSelectScene.ts`, `ResultsScene.ts`, `PauseOverlay.ts`, `SettingsOverlay.ts`, `src/ui/**` (menu widget: list, button, cursor, focus nav, tap hit-testing, scroll), `BootScene.ts` edits (load save → Title).

## Read first
`docs/design.md` → The run, Ships, Pilots, Meta progression. `docs/art-direction.md` → UI, Pilot portraits. T05 progression API.

## Requirements
1. **UI widget kit** (`src/ui`): focusable buttons and lists drawn with `gfx/ui.drawWindow`. Arrow/WASD + Enter/Space navigation with a blinking cursor. Direct tap/click on any item (≥ 44 CSS px hit areas). Back via Esc or an on-screen back button. Plays `ui_move` / `ui_confirm` / `ui_back` SFX.
2. **Title:** animated `title` background theme, "CAPTAIN BLASTROID" logo (big chunky pixel lettering, built from the 8×8 font scaled 2–3× with gradient bands, or bespoke glyphs), a "TAP TO START" blink, version string. The first tap unlocks audio and starts `title` music.
3. **Hangar** (hub): Launch, Pilot, Ship, Upgrades, Records, Settings. Shows the current salvage and selected pilot portrait + ship sprite.
4. **Pilot select:** a 2×2 grid of portraits at 2× in SNES frames. Locked pilots show a silhouette (portrait drawn in a single dark color) and "RESCUE FROM ESCAPE POD". Selected pilot shows name, passive text and a short bio line.
5. **Ship select:** rotate through ships with a large sprite (2×), stat bars (shield, speed, slots) and the starting weapon. States: built / schematic owned (Build for N salvage) / unknown (silhouette, "SCHEMATIC NOT FOUND").
6. **Upgrades:** list from `content/upgrades.ts` with level pips, cost and buy action (`progression.buyUpgrade` → save). Purchase SFX + flash.
7. **Results:** "SECTOR CLEAR" or "SHIP LOST", with score, kills, time, salvage earned (count-up animation) and a discoveries list (schematic found, pilot rescued, new high score). Calls `progression.bankRun` once. Continue → Hangar.
8. **Pause overlay:** Resume, Settings, Abandon Run (confirm: banks salvage collected so far). Opened by Esc/P, the HUD pause button, or auto on visibility loss. Game sim frozen and music ducked.
9. **Settings:** music/SFX volume, haptics on/off, screen shake (off/low/full), stick opacity, stick size. Saved immediately.
10. **Records:** high-score table + stats.

## Acceptance criteria
- [ ] Full loop on desktop with mouse only, keyboard only, and on a phone with touch only: Title → Hangar → select pilot/ship → Launch → (die or clear) → Results → Hangar shows updated salvage.
- [ ] Locked/unlocked states render correctly for each pilot/ship state (test with crafted saves via a `?save=fresh|mid|all` debug flag).
- [ ] No DOM UI; everything renders in the canvas.

## Out of scope
Gameplay scene internals.
