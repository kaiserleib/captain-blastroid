# T21 — Level framework: registries, new timeline actions, scroll changes, sector stubs
Status: todo
Wave: 5 · Depends on: T00–T20 · Blocks: T27–T31

## Goal
Make the game multi-level without any level content: every later sector can then live in its own folder and plug in through registries, with no edits to shared systems. When this lands, all five sectors in `LEVEL_ORDER` are playable as short **stub** levels that end in the Rock Hauler. The level tickets (T27–T30) replace the stubs.

## Owns
- `src/content/levels/**`: `index.ts`, `types.ts` (additive only; the contract types are already committed), stub folders `ionShoals/`, `eventHorizon/`, `pulsarNursery/`, `armada/`. Each has an `index.ts` exporting the stub `LevelDef` and an empty `ROSTER` (enemy defs) table.
- `src/game/director/**`
- `src/game/levels/**` (new): `index.ts` imports every sector folder for its registrations. The stub folders `ionShoals/`, `eventHorizon/`, `pulsarNursery/`, `armada/` each start with an empty `index.ts`.
- Boss registry: `src/game/boss/bossSystem.ts`, `src/game/boss/index.ts`, `src/game/boss/rockHauler.ts` (adapt to the interface only)
- Enemy registries: `src/game/enemies/index.ts`, `enemySystem.ts`, `behaviors/index.ts`, `patterns.ts` (shot-speed multiplier only), `src/content/enemies.ts` (the `custom` behavior variant only)
- `src/game/pickups/escapePod.ts` (pod HP only)
- `src/sim/scroll.ts` (new)
- `src/content/obstacles.ts`: `rockThemeForLevel` only (T23 owns the rest of that file)
- `src/audio/index.ts`: a boss-song option on `attachAudio` only
- `src/scenes/GameScene.ts`: level plumbing
- `tests/sim/harness.ts`, `tests/sim/level1.playthrough.test.ts` → make them level-aware (see 9)

## Read first
`docs/design.md` → "Campaign: Levels 2–5" (all of it), `tickets/WAVE5-NOTES.md`, `src/content/levels/types.ts`, `src/game/director/*`, `src/game/boss/*`, `src/game/enemies/*`, `tests/sim/harness.ts`.

## Requirements
1. **Five sectors.** `LEVEL_ORDER = ['kessler', 'ionShoals', 'eventHorizon', 'pulsarNursery', 'armada']`.
   - Stubs are about 45 s long. Each has its sector name, its `theme`, a `music` id (use `level1` until T25 lands; T25 then switches them to their songs), `rockTheme` and the numbers from the design's difficulty table (`scrollSpeed`, `enemyHpMul`, `enemyShotSpeedMul`, `guaranteeWeapon`, `bossSalvage`, `podFallbackSalvage`, `schematicOnClear`).
   - Each stub timeline: rocks, three gnat formations, one pod at 20 s, then a `rock_hauler` boss at 40 s.
   - `getLevel` still falls back to Level 1 for unknown ids.
   - `levelIdForNumber(n)` and `?level=N` work for 1–5.
2. **Roster registry** (`game/enemies`).
   - `registerRoster(table: Record<string, EnemyDef>)`: registers sim defs *and* makes the enemy system move, fire and draw those enemies.
   - Level 1's roster goes through it.
   - The enemy system looks defs up through the registry, not the static `ENEMIES` import.
   - Registering the same id twice with a different def throws (catches collisions between sector folders).
   - Draw: an enemy def's `sprite` is drawn as now, so new enemies only need sprites plus defs.
3. **Custom behaviors.**
   - Add `{ kind: 'custom'; behavior: string; p?: Readonly<Record<string, number>> }` to `BehaviorParams`.
   - `registerBehavior(name, fn(w, e, p, dt))`. The function owns `e.vx/e.vy/e.state/e.ax/e.ay` like the built-ins.
   - Export the pattern firing API (`fireAt(w, e, pattern, targetX, targetY)` or the existing equivalent) so custom behaviors can shoot.
   - Unknown behavior names throw at spawn in dev and do nothing in prod.
4. **Boss registry** (`game/boss`).
   - Define `interface BossController { readonly defId: string; readonly rig: BossRig; done: boolean; spawn(w): boolean; update(w, dt): void; onDamage(part, slot, amount): boolean; targetable(part): boolean; phaseName(): string }`.
   - `registerBoss(defId, factory)`. RockHauler implements the interface and registers as `rock_hauler`. `activeBoss(w)` returns `BossController | null`. `spawnBoss` uses the registry.
   - The boss *draw* also dispatches per controller: each controller (or its registration) provides `draw(w, r, alpha)`. Keep the Rock Hauler's look unchanged.
   - Boss part defs come from each boss's registration (`registerEnemyDefs` with `isBoss: true`) and no longer only from the Rock Hauler's tables.
   - The HUD boss bar keeps summing `isBoss` enemies. The name comes from a `displayName` on the registration, falling back to the defId transform.
5. **New timeline actions** (director):
   - `anomaly`: calls `spawnBlackHole` / `spawnPulsar` from `game/obstacles`, passing `{ vx, vy, variant, phase }`. Its `y` defaults to −radius (just above the top edge). `vy` defaults to the scroll speed, as the spawners already do.
   - `scroll`: ramps `w.scrollSpeed` linearly to `to` over `over` s (0 = instant). New `sim/scroll.ts` exports `setScrollSpeed(w, v)`, which applies the *delta* to `vy` of every active asteroid and anomaly. World-anchored bodies speed up together. Anomalies spawned with an explicit `vy: 0` (boss arenas) are excluded: flag them through a side table in `sim/scroll.ts` (`pinAnomaly(a)`) and leave `Anomaly` unchanged.
   - `script`: `registerLevelScript(name, fn(w, args))` runs bespoke beats. Unknown names throw in dev.
   - `escapePod.hp`: the pod survives `hp − 1` enemy shots. Each hit flashes it and plays `armor_ping`. The pickups module draws the remaining HP as 1 px pips above the pod when hp > 1. Add `spawnEscapePod(w, pilotId, x, hp = 1)`.
6. **Per-level systems.** `registerLevelSystem(levelId, system)`. The director runs it every tick while that level is active, including the boss phase and the outro. The Armada hull needs this (T30).
7. **Level tuning hooks:**
   - `enemyHpMul` applies at spawn to enemies from the Level 1 roster only (`Math.max(1, Math.round(hp × mul))`).
   - `enemyShotSpeedMul` multiplies every enemy and boss shot's speed. Store it per world (a WeakMap in `game/enemies`, `setEnemyShotSpeedMul(w, m)`, called by the director's `startDirector`).
   - `guaranteeWeapon`: if `w.player.weapons.length <= 1` at `by` s, drop that weapon capsule 60 px above the player (clamped on-screen) and toast "SUPPLY DROP". Add `guaranteeWeapon: { by: 45, weapon: 'spread' }` to Level 1. This fixes the T18 follow-up. Keep the old forced-capsule rewrite.
   - `rockTheme`: `rockThemeForLevel(id)` returns `LEVELS[id]?.rockTheme ?? 'basalt'` (keep the old aliases).
   - `bossMusic`: `attachAudio(events, { bossSong })`. GameScene passes `level.bossMusic ?? 'boss'`.
8. **GameScene and harness** import `game/levels` (side-effect registrations). GameScene behavior is otherwise unchanged.
9. **Harness:**
   - `createSimWorld(seed, { levelId, ... })` and `runSim(seed, bot, seconds, { levelId })`.
   - The god playthrough test runs **every id in `LEVEL_ORDER`**: in the default suite 1 seed per level, under `SIM=1` 5 seeds per level. Each asserts boss spawned → defeated → levelComplete → exactly one `runOver{victory}`, and no pool overflow.
   - Determinism runs per level: the default suite runs a short slice of each, and `SIM=1` runs full length.
   - `npm run balance` takes `LEVEL=<id>` (default `kessler`). `LEVEL=all` prints one block per level.
   - The harness's boss stats use `phaseName()` instead of the Rock Hauler `Phase` enum.
10. **Tests:** registries (duplicate ids, unknown names), every new timeline action, `setScrollSpeed` deltas (rocks move with it, pinned anomalies don't), pod HP, `guaranteeWeapon` (fires once and not when the player already has two weapons), `enemyHpMul` rounding, the shot-speed multiplier.

## Acceptance criteria
- [ ] `?level=2` … `?level=5` play their stubs to a Rock Hauler kill and results, with each level's theme and scroll speed.
- [ ] Level 1 plays exactly as before: the L1 god-bot event order is unchanged and the balance report is within noise. Note any hash change and why.
- [ ] No shared system imports a sector folder. Sectors plug in only through `registerRoster`, `registerBehavior`, `registerBoss`, `registerLevelScript` and `registerLevelSystem`.
- [ ] build / test / lint / test:sim / e2e pass.

## Out of scope
Real level content, sector select UI (T22), new hazard behavior (T23), new songs (T25).

## Contract changes
(fill in)
