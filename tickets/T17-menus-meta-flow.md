# T17 — Title, hangar, pilot/ship select, results, pause, settings
Status: done (real-phone touch check pending)
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
- [ ] Full loop on desktop with mouse only, keyboard only, and on a phone with touch only (desktop mouse-only and keyboard-only verified in Chrome; touch verified only with synthetic touch PointerEvents, not on a phone): Title → Hangar → select pilot/ship → Launch → (die or clear) → Results → Hangar shows updated salvage.
- [x] Locked/unlocked states render correctly for each pilot/ship state (test with crafted saves via a `?save=fresh|mid|all` debug flag).
- [x] No DOM UI; everything renders in the canvas.

## Out of scope
Gameplay scene internals.

## Contract changes
- None to `sim/types.ts`, `sim/world.ts`, `engine/events.ts` or `gfx/renderer.ts`.
- `src/debug/flags.ts` (additive): `flags.save` (`?save=fresh|mid|all`, dev only) and `flags.mute` (`?mute`, dev only); flags test updated.
- `content/pilots.ts`: removed the unused `portrait` field (portraits stay keyed by pilot id in `portraits/named.ts`); added a required `bio` line per pilot.
- `GameScene` (additive): listens for `pauseRequested` / `runOver` and acts after the tick's systems; `pauseNow()` for lifecycle pauses. Enter-data plumbing (`shipId/pilotId/levelId/seed`) already existed and is now fed by the hangar.

## Notes
- **Boot.** `BootScene` awaits `initSave(platform.storage, platform.lifecycle)` (or an in-memory store seeded with a crafted save under `?save=`, so debug saves never overwrite the real one), calls `platform.orientation.lockPortrait()`, then goes to Title. **`?sandbox` still boots straight into a run** so the gameplay tickets' test keys keep working.
- **main.ts** sets `setInputSettingsProvider(() => getSettings())`, routes `input.onUi` (and WASD, via `ui/keys.ts`) to the top scene if it is a `UiScene`, applies music/SFX volumes from the save via `onSaveChange` (fires on load and every change), sets the menu min tap size to 44 CSS px on every resize, and opens the pause menu from `platform.lifecycle.onPause` (visibility/pagehide on web; Capacitor's App.pause once T19 swaps the platform before main runs, or T19 re-registers).
- **Routing** is in `src/scenes/flow.ts` (`flow.title/hangar/pilots/ships/upgrades/records/launch/results/pause/settings/closeOverlay`). Menu screens `replace`; Pause and Settings `push` as overlays over the frozen scene. All transitions run from `update()` via `MenuScene.later()`, never inside an input handler — otherwise the Esc that closes the pause overlay would also reach the resumed GameScene as a fresh `pauseRequested`.
- **UI kit (`src/ui`).** `Menu` (focus, spatial arrow/WASD nav with vertical wrap, mouse hover focus, press/release activation, sliders with drag + left/right, `adjustable` rows for toggles), `MenuScene` base (buffer coords with offset/shake zeroed, relayout on height change, shared `title` backdrop so the starfield is continuous between screens, releases the virtual stick on any menu touch), draw helpers (`drawButton`, `drawHeader`, `drawSalvage`, `drawSpriteScaled` with silhouette tint, `drawPortrait` with locked silhouettes built from the portrait generator's figure mask, `wrapText`, `drawSliderRow`). No scrolling widget: every list fits at 400 px (records = 10 rows).
- **Logo** (`ui/logo.ts`): ui-font glyph bits, 2 px letter gap, horizontal emboldening (keeps counters open), scaled 3×5 for BLASTROID (gold banded gradient, 3 px extrusion, dark outline) and 2× steel for CAPTAIN, with a drop-in, 1 px bob and a stepped sheen sweep every 4.5 s. Title also shows "THE KESSLER BELT", a bobbing 2× Kestrel, blinking TAP TO START, "or press Enter", version.
- **Audio.** Title calls `playSong('title')` (remembered until the first gesture unlocks audio); Hangar `fadeTo('title', 1)`; Results stops music on a loss (a clear keeps T04's `clear` jingle). Pause calls `suspendAudio()` and resume/abandon call `resumeAudio()` — so UI SFX are silent while paused (a consequence of suspending the context). Volume sliders step 5% (music default stays 0.35 from T05; the user can now turn it down). Mapping is linear gain.
- **Results** banks exactly once in `enter` via `ui/results.bankFinishedRun` (floors `run.salvage`, `bankRun(getSave(), runResultFrom(run, victory))`), then `setSave` + `saveNow`. Salvage counts up (tap = skip), discoveries pop in with a portrait / blueprint ship / rank badge. Abandon Run banks with `victory: false` (counts as a death in stats) and shows "RUN ABANDONED".
- **Pilot select**: tapping/Enter on an unlocked pilot selects it immediately (saved) and stays on the screen; DONE/Esc returns. Locked pilots show a silhouette, "LOCKED", and "RESCUE FROM ESCAPE POD". **Ship select**: ←/→ (keys or on-screen arrows) cycle; built → SELECT/SELECTED, schematic → blueprint-blue sprite with BUILD N (building also selects), unknown → dark silhouette, "SCHEMATIC NOT FOUND", stats hidden.
- **Verified in Chrome (port 5117, `?mute`)**: keyboard-only Title → Hangar → Pilot (select Juno) → Ship (build Bulwark with `?save=mid`) → Upgrades (denied buy) → Settings (music 35→20%, mixer followed) → Launch → Esc pause → resume (no re-pause) → P → Abandon → Results → Hangar. Mouse-only with `?save=all`: pick Zz'kar + Dart, Launch (run started with `dart/zzkar/kessler/<seed>`), HUD pause button → Resume; real death via `damagePlayer` → T08's `runOver` → SHIP LOST, salvage 57.8 × 1.25 → +71. Synthetic touch: menu taps, music slider drag (0.95 → 0.10) and label-tap step, Launch with no stick carried into the run, HUD pause tap, `pagehide` opens the pause menu. Victory path via a manual `runOver {victory:true}`: schematic, rescued pilot and high-score discoveries render. Save persisted across a reload (real localStorage, no `?save`). No console errors.
- **Not verified**: a real phone (tap sizes, safe areas), listening (volumes by ear), the real T15 victory flow (director not merged in this worktree), Capacitor app pause.

## Follow-ups
- T18: consider lowering the default music volume in `meta/schema.ts` (user still finds 0.35 loud) or a perceptual (squared) slider curve.
- T19: if `setPlatform()` runs after `main.ts` registers `platform.lifecycle.onPause`, re-register the pause hook on the native lifecycle.
- T15/T18: nothing in the menus reads level defs yet; Launch hardcodes `levelId: 'kessler'`.

## Notes from earlier waves
- Pilot portraits: `NAMED_PORTRAITS[pilotId]` (`src/portraits/named.ts`) gives `{ seed, overrides }`; draw with `portraitCanvas(seed, overrides)`. `content/pilots.ts` has an unused optional `portrait` field — either link it to `NAMED_PORTRAITS` or remove it.
- Boot: call `initSave(platform.storage, platform.lifecycle)` and `platform.orientation.lockPortrait()`; point T01's `setInputSettingsProvider` at T05's `getSettings()`.
- Input: route `input.onUi` to menus, handle `pauseRequested`, call `input.releaseStick()` when a UI widget claims a touch in GameScene. `ScenePointer` objects are reused — copy values you keep.
- Audio: `playSong('title')` on the title screen; settings call `setVolume`/`setMuted`.
