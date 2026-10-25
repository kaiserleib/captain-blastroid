# T15 — Wave director + Level 1 "The Kessler Belt"
Status: todo
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
- [ ] Headless test: running the director for 180 s of sim with a `?god` player spawns the boss exactly once at t=180, and every timeline event fires once.
- [ ] Same seed gives an identical spawn log, and a different seed varies `rand` positions and asteroid jitter.
- [ ] Manual play: the level escalates noticeably and has breathers. The asteroid storm at 150–180 s is a spectacle with a decent loadout.

## Out of scope
The boss's internals (T16), balance numbers beyond Level 1 (T18 tunes).
