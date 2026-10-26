# Wave 2 briefing (T08–T14)

Wave 1 is merged. Read the "Contract changes" / "Notes" sections of T00–T07 for the APIs you'll use. The important bits are collected here.

## Working rules for parallel agents
- Run `npm ci` (not a fresh `npm install`, because npm 10 crashes).
- Stay inside your ticket's **Owns** paths. Allowed shared edits: one-line registrations in `src/scenes/GameScene.ts` (systems at their documented slot, layers anywhere since they're sorted by z), adding a page to `vite.config.ts` build input, and appending re-exports to `src/content/index.ts`.
- **Browser checks:** the Chrome tab group is shared with other agents. Open your *own* tab and never navigate or close others' tabs. Run your dev server on your own port (`npm run dev -- --port 51NN`, where NN is your ticket number, e.g. T08 uses 5108). **Mute audio** while testing (`import { setMuted } from 'src/audio'` → call `setMuted(true)` from the console, or add `?mute` handling in your own sandbox code). Music previously blasted through the user's speakers. Stop your dev server when done.
- **Sandbox:** `?sandbox` is a dev flag (`flags.sandbox` in `src/debug/flags.ts`). Add your sandbox spawn keys in your own module, guarded by `flags.sandbox`. Key map: T09 `F1–F6`, T10 `B`/`N`/`A` (asteroid stream toggle), T11 `1–6`, T12 `7`/`8`/`9`/`0` (magnet / repulsor / shield / random capsule), T13 `X` (big explosion test), T14 none, T08 `G` (toggle god).
- Finish with `npm run build && npm run test && npm run lint` passing, tick only acceptance boxes you verified, set `Status:` in your ticket, and commit on your worktree branch, ending the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## APIs from wave 1
- **Sim (T03, `src/sim/`):**
  - `spawn*` helpers return the entity or `null` when the pool is full. Always handle null.
  - `spawnEnemy` needs defs registered via `registerEnemyDefs(table)`.
  - `damageEnemy/damageAsteroid/damagePlayer`, `applyRadialForce(pool, x, y, radius, strength, falloff, dt)`, `applyRadialForceTo(body, …)`.
  - `getSpatialHash(w)` with `query/queryInto/nearest`. Positions are a snapshot from the last collision rebuild.
  - Hooks in `sim/hooks.ts`: `registerShotBlocker`, `registerAnomalyContact`, `registerBossDamage`.
  - **Event payload objects are reused.** Copy any field you keep.
  - `hitIds` uses `-1` (`NO_HIT`) for unused slots. Never use `.length = 0`.
  - Enemy/asteroid `flashT` decays in cleanup. **`player.invulnT` is not decremented by T03; T08 owns that.**
  - Performance gotcha: a function that reads x/y from several entity *types* makes V8 box the reads and allocate. Keep one loop per pool.
- **Art (T02, `src/gfx/`):**
  - Define sprites in files named `*.sprites.ts` (auto-listed in `/tools/gallery.html`) with `defineSprite` / `defineProcSprite`. Palettes come from `gfx/palette.ts`; add new ramps to `RAMPS`.
  - Draw with `r.sprite(id, x, y, {frame, rot, flash, alpha, flipX})`, where `rot` is in radians, 0 = as drawn, clockwise, 16 buckets. Call `warm([...ids])` at scene load.
  - Text: `r.text(str, x, y, {font: 'ui'|'small', color, align, shadow})`. The `ui` font is the look the user specifically asked for, so use it for UI text.
  - `gfx/ui.ts` has `drawWindow`, `drawCursor`, `drawBar`. `defineCapsule(id, letterRows)` (in `gfx/reference.sprites.ts`) stamps a 3×5 letter on the pickup capsule.
  - The existing `kestrel`, `kestrel_bank_l/_r`, `ebullet_s`, `pbullet_blaster` and `capsule` sprites set the quality bar.
- **Audio (T04):** `world.events.emit('sfx', { id, x })` with the ids listed in `tickets/T04-audio.md`. Music reacts to boss/level events by itself.
- **Meta (T05):** `getSave()`, `getSettings()` (sync), `computePlayerStats(save, shipId, pilotId)` → `PlayerLoadout` (maxShield, speed, weaponSlots, startingWeapons, stats). Ship ids are `kestrel`/`bulwark`/`dart`, and pilot ids are `blastroid`/`juno`/`grieg`/`zzkar`. `platform.haptics.impact(kind)` doesn't check the setting, so the caller must check `getSettings().haptics`.
- **Input (T01):** `world.input` holds the `MoveIntent`. With `targetX !== null`, steer toward the target; otherwise use `x/y`. When a UI widget claims a touch, call `input.releaseStick()`.

## Cross-ticket decisions for this wave
- **Weapon ids:** `blaster`, `spread`, `lance`, `seeker`, `orbitDrones`. T05's ships already use `blaster`/`orbitDrones`.
- **Weapon and upgrade pickups:** T12 does not import T09. T12 emits `pickupCollected` for every pickup and applies the effects of non-weapon kinds itself. **T09 listens to `pickupCollected`** and handles `kind === 'weapon'` (payload = weapon id) and `kind === 'upgrade'`. That keeps T09 and T12 independent.
- **Drops:** T10 and T11 only emit their death events. T12 listens to `enemyKilled`/`asteroidDestroyed`/`formationCleared` and rolls the drops. Carriers are flagged in their enemy def as `dropTable: 'carrier'`, which always drops a capsule.
- **Player init:** T08 adds `initPlayer(world, loadout)` and calls it from `GameScene.enter` using `computePlayerStats(getSave(), save.selectedShip, save.selectedPilot)`. T08 owns the base pickup radius (14). Starting weapons go into `player.weapons` as `WeaponInstance`s, and T09's system fires them.
- **HUD boss bar:** T14 sums `hp`/`maxHp` of `isBoss` enemies after `bossSpawned`. No T16 import.
- **Player draw layer** must be named `player`. GameScene's placeholder rect disappears once it exists.
