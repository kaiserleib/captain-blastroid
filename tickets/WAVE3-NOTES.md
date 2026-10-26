# Wave 3 briefing (T15, T16, T17)

Waves 1 and 2 are merged. **Read `tickets/WAVE2-NOTES.md` first.** Its working rules still apply: run `npm ci`, stay inside Owns, use your own Chrome tab on port `51NN`, mute audio, stop the dev server when done, and commit on your worktree branch. Then read the Notes / Contract-changes sections of the wave-2 tickets you depend on. The essentials are below.

The user is away. Make sensible calls yourself and record them in your ticket's Notes. Don't stop to ask.

## New contract event
`bossRequested: { defId: string }` has been added to `GameEvents` (main, `src/engine/events.ts`). Here is the flow, which is how T15 and T16 stay independent:
1. The director (T15) emits `bossWarning`. 2 s later it emits `bossRequested { defId: 'rock_hauler' }`.
2. The boss module (T16) listens for `bossRequested`, spawns the boss and emits `bossSpawned { defId: 'rock_hauler' }`.
   - Music switches to the boss song automatically (T04 listens for `bossSpawned`).
   - The HUD boss bar (T14) sums `hp`/`maxHp` over the `isBoss` enemies. It derives the name from the defId, so `rock_hauler` displays as "ROCK HAULER".
3. When the core dies, T16 emits `bossDefeated { defId, x, y }` and `sfx boss_die`.
   - T13 already plays the 2 s explosion chain, the white flash and the hitstop on `bossDefeated`, so **T16 must not duplicate them**.
   - T04 stops the music on `bossDefeated`.
4. T15 listens for `bossDefeated` and handles the rest:
   - It spawns the schematic pickup at the boss position (for the first ship in `bulwark`, `dart` that the save doesn't have as a schematic or built).
   - It awards the boss salvage.
   - After 2.5 s it emits `levelComplete`, which makes T04 play `clear`.
   - After a further results delay (~3 s) it emits `runOver { victory: true }`.

## APIs you'll use
- **Asteroids (T10, `game/obstacles`):**
  - `spawnAsteroidStream(w, cfg)` returns a handle. You can set `stream.config.rate` and other fields live, and `stream.stop()` ends it.
  - `stopAllAsteroidStreams(w)`.
  - `spawnRock(w, {size, x, y, vx, vy, hp?})`.
  - With the kessler theme, mediums have 1 HP and only larges split.
- **Enemies (T11, `game/enemies`):**
  - `spawnFormation(w, {type, enemyId, count, x, y?, spacing, delay?, overrides?})` returns a formation id.
  - `spawnEnemy(w, defId, x, y, overrides)` from `sim/spawn`.
  - Patterns: `aimed`, `fan`, `ring`, `burst(..., fair=false)` for bosses. Angles are in degrees, with 90 = down.
  - Enemy ids are `gnat`, `swooper`, `gunboat`, `interceptor`, `carrier`. Their behaviors read spawn overrides; read `tickets/T11-enemies.md` for what each one uses.
  - **The enemy system only moves roster enemies.** Boss parts must be integrated and drawn by T16.
  - Register boss part defs with `registerEnemyDefs` (with `isBoss: true`).
- **Pickups (T12, `game/pickups`):**
  - `spawnEscapePod(w, pilotId, x)` (magnet pulls pods; that's intended).
  - `spawnDrop(w, kind, x, y, payload?, amount?)`, `spraySalvage(w, x, y, total)`.
  - Bosses roll no drops on their own.
- **Sim (T03):**
  - `registerBossDamage(fn)` returns true when the hook handled the damage.
  - Cleanup never culls bosses.
  - A rock moving toward a boss part breaks, and a rock moving away passes through, so flung rocks don't break on spawn.
  - `run.bossDefeated` exists on `RunState`.
- **Meta (T05):**
  - `nextRescuablePilot(getSave(), 'kessler')` returns `juno`, then `grieg`, then `null`.
  - `getSave()`, `setSave()`, `saveNow()`, `initSave(storage, lifecycle)`, `getSettings()`, `updateSettings(patch)`.
  - `bankRun(save, runResultFrom(run, victory))` returns `{save, salvageEarned, discoveries}`. **Floor `run.salvage` before banking.** It accumulates fractional amounts.
  - `buyUpgrade`, `buildShip`, `shipStatus`, `selectShip`, `selectPilot`.
- **Background (T07):** `scene.background.setTheme(theme, seed)`. Menus can own a `new Background('title', seed)`.
- **Audio (T04):** `playSong(id)`, `fadeTo`, `stopMusic`, `setVolume('music'|'sfx', v)`, `setMuted`, `suspendAudio`/`resumeAudio`. The user found the music too loud; the default is now 0.35. GameScene currently calls `playSong('level1')` in `enter`.
- **Portraits (T06):** `NAMED_PORTRAITS[pilotId]` gives `{seed, overrides}`, which you pass to `portraitCanvas(seed, overrides)`. The user loves these portraits.
- **Input (T01):**
  - `input.onUi` emits `pause`, `confirm` and `nav {dx, dy}`.
  - `pauseRequested` is emitted for Esc/P and for the HUD pause button.
  - Call `input.releaseStick()` when UI takes a touch.
  - Use `setInputSettingsProvider(() => getSettings())`.
- **HUD (T14):** `hud.onPointer(e)` returns true if the HUD consumed the event.
- **Fonts (T02):** use the `ui` font for all UI text. The user specifically asked for this look. `drawText(..., {scale})` handles big titles. `gfx/ui.ts` has `drawWindow`, `drawCursor` and `drawBar`.

## Shared-file etiquette
`src/scenes/GameScene.ts` will be touched by all three tickets. Keep edits small and additive:
- **T15** adds the director system at the `director` slot and sets theme, scroll and music from the level def in `enter`.
- **T16** adds its boss system at the `boss` slot plus a boss draw layer (z 40–45).
- **T17** adds `runOver`/`pauseRequested` handling and the enter-data plumbing (`shipId`, `pilotId`, `levelId`, `seed`).
