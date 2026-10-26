# T15 — Wave director + Level 1 "The Kessler Belt"
Status: done (boss handoff verified with a simulated `bossDefeated`; T16 isn't in this worktree)
Wave: 3 · Depends on: T10, T11, T12 (T07 for theme) · Blocks: T18

## Goal
A data-driven timeline director, and the Level 1 script authored with it. The script should teach, escalate, and build to the boss in about 3.5 minutes.

## Owns
`src/game/director/**` (director.ts, timeline.ts, events.ts, index.ts, tests), `src/content/levels/level1.ts`, `src/content/levels/index.ts`. The `director` System registration.

## Read first
`docs/design.md` → Level 1 timeline table, The run, Pickups (escape pods, carriers), Enemies.

## Requirements
1. **Level definition format** (data, typed):
   ```ts
   { id: 'kessler', name: 'THE KESSLER BELT', theme: 'kessler', music: 'level1', scrollSpeed: 30,
     asteroidField: [{ from: 0, to: 15, rate: 0.6, sizes: {small: 1} }, …],   // rate = rocks/s; RNG jitter
     timeline: [
       { t: 16, formation: { type: 'column', enemy: 'gnat', count: 5, x: 'rand' } },
       { t: 28, formation: { type: 'v', enemy: 'gnat', count: 5, x: 120 }, forceCapsule: 'spread' },
       { t: 60, spawn: { enemy: 'carrier', from: 'left', y: 90 } },
       { t: 100, escapePod: { x: 'rand' } },          // pilot chosen via meta.nextRescuablePilot
       { t: 178, bossWarning: true },
       { t: 180, boss: 'rockHauler' },
     ],
     schematicOnClear: ['bulwark', 'dart'] }          // first missing one awarded
   ```
   `x: 'rand'` resolves via `world.rng` inside safe bounds. Spawns may use `repeat: {every, times}`.
2. **Director:** advances on `world.time`. The timeline **pauses while the boss lives**. Asteroid density interpolates between field segments. Supports `?level=1&t=120` to start mid-level (skip earlier events, but pre-grant a plausible loadout in debug: Blaster L3 + Spread L2).
3. **Boss flow:** at the boss event, stop the asteroid field (except for boss-thrown rocks), switch music to `boss`, emit `bossSpawned`. On `bossDefeated`, wait 2.5 s, emit `levelComplete`, play `clear`, award the schematic drop, then emit `runOver{victory:true}` after the results delay.
4. **Escape pod:** if `nextRescuablePilot` returns none (all rescued), skip it and spawn a salvage cache instead.
5. **Level 1 script:** author it following the design table. Tune so a first-time player with only the starter blaster can survive the first 45 s, and the formation-capsule in the first minute (forced Spread) is reliably obtainable.
6. Level metadata exposed for the results screen (name, duration).

## Acceptance criteria
- [x] Headless test: running the director for 180 s of sim with a `?god` player spawns the boss exactly once at t=180, and every timeline event fires once.
- [x] Same seed gives an identical spawn log, and a different seed varies `rand` positions and asteroid jitter.
- [x] Manual play: the level escalates noticeably and has breathers. The asteroid storm at 150–180 s is a spectacle with a decent loadout.

## Out of scope
The boss's internals (T16), balance numbers beyond Level 1 (T18 tunes).

## Contract changes
No contract file changed. Additive, outside the contract files:
- `src/content/index.ts` re-exports `./levels`.
- `GameScene`: `directorSystem` sits at the director slot. `enter` resolves `levelId` (enter data, else `?level=N`, else the `kessler` default), sets the theme, `world.scrollSpeed` and the song from the level def, and calls `startDirector(w, level, {startT: flags.t ?? 0, debugLoadout: true})`.
- Boss flow follows WAVE3-NOTES. The director emits `bossWarning` (t 178) and `bossRequested {defId: 'rock_hauler'}` (t 180). It does **not** emit `bossSpawned` (T16 does), and it doesn't touch music, because T04 reacts to the events. The ticket's `boss: 'rockHauler'` became `'rock_hauler'` to match the event flow.

## Notes
**API (`src/game/director/index.ts`).**
- `directorSystem` is idle under `?sandbox`.
- `startDirector(w, level, {startT?, debugLoadout?})`. It sets `w.time = startT`. With `startT > 0` and `debugLoadout`, it grants Blaster L3 and Spread L2 (`DEBUG_LOADOUT`).
- `updateDirector(w, dt)` auto-starts from `run.levelId` if nobody called `startDirector`.
- `getDirector(w)` returns the state (`t`, `phase: level|boss|outro|done`, `fires[]` per timeline index, `log[]`).
- `directorTime(w)` is the level clock, frozen while the boss lives.
- `OUTRO = {magnetAt 1.0, levelCompleteAt 2.5, runOverAt 5.5}`.
- Pure helpers: `buildSchedule`, `segmentRate`, `fieldRate`, `resolveX`, `pickSchematic`, `eventKind`.
- In dev, `window.__director = {world, state}` for console and bot access (T20 may want it).

**Content (`src/content/levels`).**
- `LevelDef` (types.ts) has id, number, name, theme, music, scrollSpeed, duration (210), asteroidField, timeline, schematicOnClear, bossSalvage (100) and podFallbackSalvage (30).
- Timeline events hold exactly one of: `formation` (+`forceCapsule`), `spawn {enemy, from: top|left|right|topLeft|topRight, x, y, overrides}`, `escapePod {x}`, `drop {kind, x}`, `toast`, `bossWarning`, `boss`. Any of them can take `repeat {every, times}`.
- `x: 'rand'` resolves through `world.rng` within [16, 224], narrowed by the formation's half-width so every member spawns on screen.
- Field segments are independent streams over [from, to). Each ramps linearly from `rate` to `rateTo`, and overlapping segments stack, which is how the storm's diagonal side lanes work.
- `LEVELS`, `LEVEL_ORDER`, `getLevel(id)` (unknown ids fall back to L1), `levelIdForNumber(n)`, `levelSummary(id)` → `{id, name, duration}` for results (T17).

**Behavior.**
- **Forced capsule.** The director listens for `formationCleared`. On the next director tick it rewrites the payload of the weapon capsule T12 spawned at that exact spot. T12 isn't touched, and the order of the two listeners doesn't matter. The first three formations (16/22/29 s) carry `forceCapsule: 'spread'`, which keeps applying until the player actually owns Spread. A missed capsule therefore gets another chance.
- **Escape pod.** The pilot comes from `nextRescuablePilot(getSave(), level.id)`. If that returns null, or the pilot was already rescued this run, the director sprays a 30-salvage cache instead.
- **Boss.** At the boss event the director stops its own streams. Boss-thrown rocks are unaffected, because T16 spawns them with `spawnRock`. The timeline then waits until `bossDefeated`.
- **bossDefeated.** Sets `run.bossDefeated`, releases every enemy shot so nothing can kill the player after the win, then spawns the schematic for the first of `bulwark`, `dart` not in `save.schematics`, `save.shipsBuilt` or `run.schematics`, and sprays 100 salvage.
- **Outro.** At +1.0 s every pickup is magnetized. At +2.5 s `levelComplete` fires. At +5.5 s any schematic or salvage still on screen is collected and `runOver {victory: true}` fires. Neither is emitted if the player is dead. A second `bossDefeated` is ignored.

**Level 1 timeline (final).**
- 0–16: small rocks only.
- 16 / 22 / 29: gnat column, column, V, all forced Spread.
- 35, 40: twin columns, then a V of 7.
- 44–58: dense band at 2→3.2 rocks/s. Swoopers from the corners (47/53/64/71) and gnat columns/lines die on the rocks. Carrier from the left at 60.
- 74–78: breather.
- Gunboat pairs at 78 and 90, a gnat V at 84, swoopers at 88, gnats at 96.
- Toast at 99, pod at 100, then flanking gnat columns (103) and a V (107). No shooters are near the pod.
- 109–114: breather.
- Interceptors at 114/126/141, gunboats at 118/130, magnet drop at 124, second carrier from the right at 135, swoopers at 119 and 138.
- 146: shield drop. 147: toast `ASTEROID STORM INBOUND`.
- 150–174: storm ramping 4→10 rocks/s (with some 10 HP larges), plus diagonal side lanes at 1→3/s from 156/160. Gnat swarms at 152/155/159/163/166/171.
- 174–177: the field tapers to nothing.
- 178: warning. 180: boss.

**Tuning from play (Chrome, port 5115, muted, `?god`, a console autopilot that chases enemies and pickups).**
- The first pass was far too sparse: 2–6 rocks on screen mid-level and about 20 at the storm's peak, because the player shreds rocks the moment they enter. I raised every field segment about 1.5×, the dense band to 2.0→3.2, and the storm to 4→10 plus the side lanes at 1→3. The storm now holds 37–44 rocks on screen with 5–20 gnats at once, and it reads as a storm.
- Forced Spread worked in play: the first column was cleared at 19 s, the bot missed the capsule, the second column was forced again, and the player had Spread by 25 s.
- With the second gunboat pair at 92, up to 20 enemy shots were still on screen when the pod spawned at 100. I moved the pair to 90 so they leave (and their shots clear) before the pod arrives.
- Boss handoff in the browser: `bossWarning` @178.0 → `bossRequested` @180.0. A simulated `bossDefeated` led to `levelComplete` 2.5 s later, the schematic toast `SCHEMATIC: BULWARK`, and `runOver{victory:true}` at +5.5 s. Results: run.schematics = [bulwark], salvage 101.

**Not verified / follow-ups**
- I haven't played the real boss fight (T16 lands separately). If T16 never answers `bossRequested`, the level waits forever. That's by design, but it's worth a T18 smoke check after the merge.
- Drop generosity (T12/T18): the autopilot had 4 weapons by about 60 s. That makes the mid-level easier than the design intends. The level script is not the right place to fix it.
- I haven't checked survival for a first-time player with only the starter blaster by hand. The bot plays far better than a human but less evasively. In the first 45 s only gnats (which ram) and a sparse field appear, so it should be gentle. T18 should confirm on a phone.
- The pod drifts at 12 px/s and takes about 25 s to reach the ship's height, so the player has to fly up for it (or use the magnet). That's intended by T12's design, but watch it in T18.
