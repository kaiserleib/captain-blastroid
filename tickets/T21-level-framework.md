# T21 — Level framework: registries, new timeline actions, scroll changes, sector stubs
Status: done
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
- [x] `?level=2` … `?level=5` play their stubs to a Rock Hauler kill and results, with each level's theme and scroll speed. Checked in the browser: L4 end to end, and L2 up to its 3 HP pod. All five sectors clear in the god playthrough test. L5's `armada` background theme doesn't exist until T25 adds it, so L5 falls back to `kessler` for now.
- [x] Level 1 plays exactly as before: the L1 god-bot event order is unchanged and the balance report is within noise. The sim hashes are identical for god0, god-plain, det, bal0 and bal1. The balance report clears 45/50 both before and after (see Notes).
- [x] No shared system imports a sector folder. Sectors plug in only through `registerRoster`, `registerBehavior`, `registerBoss`, `registerLevelScript` and `registerLevelSystem`. Only `game/levels/index.ts` imports the sector game folders. `content/levels/index.ts` imports the sector content folders, which is by design.
- [x] build / test / lint / test:sim / e2e pass.

## Out of scope
Real level content, sector select UI (T22), new hazard behavior (T23), new songs (T25).

## Contract changes
All additive. `src/sim/types.ts`, `src/sim/world.ts`, `src/engine/events.ts` and `src/gfx/renderer.ts` are unchanged.
- **New `src/sim/scroll.ts`:** `setScrollSpeed(w, v)`, `pinAnomaly(a)` and `isPinned(a)`.
- **`content/enemies.ts`:** `BehaviorParams` gains `CustomParams { kind: 'custom'; behavior: string; p?: Record<string, number> }`.
- **Escape pods:** `spawnEscapePod(w, pilotId, x, hp = 1)`. A pod's remaining HP lives in `Pickup.amount`, which pods never used before.
- **Audio:** `attachAudio(events, { bossSong? })`, plus a new `songOr(id, fallback)` that warns once per unknown id.
- **Boss lookups:** `activeBoss(w)` and `spawnBoss` return `BossController | null` instead of `RockHauler | null`. Use `instanceof RockHauler` to reach Rock-Hauler-only fields.
- **`pickSchematic(order, found, run, exists?)`:** the new 4th parameter defaults to "is a key of `SHIPS`".
- **Harness (tests/sim):**
  - `SimOptions.levelId` added.
  - `RunStats.bossPhaseAtEnd` is now the `phaseName()` string instead of a number.
  - New `RunStats.peakEnemyShotsByPhase`, and `peakEnemyShotsBoss` is now the peak over the whole fight.

## Notes

### API for sector tickets (T27–T30)
Import only from module indexes: `game/enemies`, `game/boss`, `game/director`, `game/obstacles`, `game/pickups`, plus `sim/*`.

Rules for every `register*` call:
- Call it once, at module load.
- Registering the same object twice is a no-op. A *different* object under the same id or name throws.
- Keep per-world state in your own `WeakMap<World, …>`.
- Don't allocate per tick.

**Enemies (`game/enemies`)**
```ts
registerRoster(table: Record<string, EnemyDef>, opts?: { hpScaled?: boolean }): void
//   Registers the sim defs (spawnEnemy, scoring) plus the enemy system's move/fire/draw.
//   Leave hpScaled off: enemyHpMul is only for Level 1's reused roster.
registerBehavior(name, fn: (w, e: Enemy, p: Readonly<Record<string, number>>, dt) => void): void
//   Def: behavior: { kind: 'custom', behavior: 'ion.tug', p: { holdY: 75 } }.
//   fn owns e.vx/e.vy (desired velocity; the system integrates), e.state (0 = first tick) and e.ax/e.ay.
//   e.t = seconds alive before this tick. An unknown name throws on the enemy's first tick in dev.
registerEnemyDraw(defId, fn: (w, r: Renderer, e: Enemy, x: number, y: number) => void): void
//   Drawn after the sprite at z 40 (beams, telegraph lines). A def with sprite: '' skips the sprite.
// Firing. Every one of these applies the level's enemyShotSpeedMul:
firePattern(w, e, pattern, style?, fair?)               // aimed at the player
fireAt(w, e, pattern, targetX, targetY, style?, fair?)  // aimed at a point
shootDir(w, x, y, deg, speed, style?)                   // one shot, 0° = right, 90° = down
aimed / fan / ring (w, x, y, …), burst(w, e, …)
aimAt(w, x, y), canFire(w, e), muzzleY(e), emitEnemyShotSfx(w, x), SHOT_SMALL / SHOT_LARGE
enemyShotSpeedMul(w)  // only for a shot you spawn yourself through sim/spawn
```

**Bosses (`game/boss`)**
```ts
interface BossController {
  readonly defId: string; readonly rig: BossRig; readonly done: boolean;
  spawn(w): boolean; update(w, dt): void;
  onDamage(part: Enemy, slot: PartSlot, amount: number): boolean; // true = handled or absorbed
  targetable(part: Enemy, slot: PartSlot): boolean;               // filter for seekers and drones
  phaseName(): string;                                            // harness stats and logs
}
registerBoss(defId, {
  create: () => new MyBoss(),
  draw: (w, r, alpha, boss) => { … },                 // z 42; not called once done
  displayName?: 'THE SHEPHERD',                        // HUD boss bar
  parts?: { ion_shep_core: { hp, r, score } },         // registered with isBoss forced on
  spriteIds?: […],                                     // GameScene pre-warms these
})
```
- `BossRig` (`parts.ts`) is generic.
- `RockHauler` (`rockHauler.ts` + `draw.ts`) is the reference implementation.
- The controller emits `bossDefeated` (with its defId) and `sfx boss_die` itself. The director handles rewards and the outro.
- The HUD boss bar sums every `isBoss` enemy. For a mid-boss that shouldn't show on the bar (T30's frigate): spawn its parts without `isBoss`, use a `BossRig` directly, and route damage through your own `registerBossDamage` hook from `sim/hooks`.

**Director (`game/director`)**
```ts
registerLevelScript(name, fn: (w, args: Readonly<Record<string, number | string>>) => void): void
//   Timeline: { t: 110, script: 'ionShoals.gauntlet', args: { side: 1 } }. Runs once per firing.
//   Prefix names with the level id. An unknown name throws in dev; in prod it is logged and skipped.
registerLevelSystem(levelId, system: System): void
//   Runs every tick while levelId is active: timeline, boss fight and outro (not under ?sandbox).
//   It runs in the director's slot (after cleanup, before fx).
registerLevelLayer(levelId, layer: DrawLayer): void
//   GameScene adds it while that level plays, sorted by z (e.g. a hull under everything at z 5, beams at z 41).
directorTime(w)    // level clock, frozen while the boss lives
emitToast(w, text)
```

**Timeline actions (`content/levels/types.ts`)**
- `anomaly: { kind, x, y?, vx?, vy?, variant?, phase? }`
  - `y` defaults to −r (just above the top edge). `vy` defaults to the scroll speed.
  - **`vy: 0` pins the anomaly**, so scroll changes skip it.
- `scroll: { to, over }`: a linear ramp, or an instant change when `over` is 0. Rocks and unpinned anomalies take the same vy delta.
- `script`: see `registerLevelScript` above.
- `escapePod: { x, hp? }`: the pod survives `hp − 1` enemy shots. Each hit flashes it and plays `armor_ping`. While hp > 1 it shows 1 px pips.
- From code:
  - `setScrollSpeed(w, v)` and `pinAnomaly(a)` from `sim/scroll`. Uses: Magnetar's scroll cycles, Perihelion's fixed hole.
  - `spawnEscapePod(w, pilot, x, hp)` from `game/pickups`.

**Minimal sector folder**
```ts
// src/content/levels/ionShoals/index.ts
export const ROSTER: Readonly<Record<string, EnemyDef>> = {
  ion_skiff: { id: 'ion_skiff', name: 'Skiff', hp: 2, r: 5, sprite: 'ion_skiff',
    behavior: { kind: 'custom', behavior: 'ion.weave', p: { amp: 40, hz: 0.9, vy: 130 } },
    fire: null, avoidsAsteroids: false, contactDamage: 1, score: 30, salvage: 1, dropTable: 'gnat' },
};
export const LEVEL: LevelDef = { id: 'ionShoals', number: 2, /* … */ timeline: [
  { t: 14, spawn: { enemy: 'ion_skiff', x: 60 } },
  { t: 110, script: 'ionShoals.gauntlet' },
  { t: 183, boss: 'ion_shepherd' },
] };

// src/game/levels/ionShoals/index.ts
import { ROSTER } from '../../../content/levels/ionShoals';
import { aimAt, registerBehavior, registerRoster, shootDir } from '../../enemies';
import { registerBoss } from '../../boss';
import { registerLevelScript, registerLevelSystem } from '../../director';
import './ionShoals.sprites';
registerRoster(ROSTER);
registerBehavior('ion.weave', (w, e, p, dt) => {
  if (e.state === 0) { e.state = 1; e.ax = e.x; }
  e.vx = Math.cos(e.t * p.hz! * Math.PI * 2) * p.amp! * p.hz! * Math.PI * 2;
  e.vy = p.vy!;
  if (e.t < 1.4 && e.t + dt >= 1.4) shootDir(w, e.x, e.y, aimAt(w, e.x, e.y), 90);
});
registerBoss('ion_shepherd', { create: () => new Shepherd(), draw: drawShepherd,
  displayName: 'THE SHEPHERD', parts: SHEPHERD_PARTS });
registerLevelScript('ionShoals.gauntlet', (w) => { /* arm per-world gauntlet state */ });
registerLevelSystem('ionShoals', { name: 'ionShoals.gauntlet', update: (w, dt) => { /* run it */ } });
```
- The stub folders already exist on both sides. Replace the bodies of `LEVEL`, `ROSTER` and the game folder's `index.ts`.
- Leave `content/levels/index.ts` and `game/levels/index.ts` alone.
- **Don't runtime-import `content/obstacles` from a sector content folder.** `content/obstacles` imports `content/levels` (for `rockThemeForLevel`), so a runtime import would create a cycle. Type imports are fine.

### Decisions
- **Stub music follows WAVE5-NOTES, not the ticket's "use `level1`":**
  - The stubs use the real ids: `music` is `ion`, `horizon`, `pulsar` or `armada`, and L5 has `bossMusic: 'armada_boss'`.
  - GameScene plays `songOr(level.music, 'level1')`. The boss song falls back to `boss`. Each unknown id warns once.
- **Stub contents:**
  - All design numbers are filled in: scroll speed, HP multiplier, shot-speed multiplier, guaranteed weapon, salvage and schematics.
  - The L2 pod has `hp: 3`.
  - L3 opens with a `small` black hole. L4 opens with a `steady` pulsar and has a 28→70→28 scroll surge. This way every new action runs inside a real level.
  - `duration` is 105 s.
- **`enemyHpMul` is applied on an enemy's first enemy-system tick (the spawn hook)**, because `sim/spawn` isn't in this ticket's Owns.
  - It is idempotent per entity id.
  - An enemy can be hit at base HP for one tick before scaling, which is harmless.
- **`guaranteeWeapon`:**
  - Fires once, at the first timeline tick at or after `by`.
  - The capsule appears 60 px above the ship, clamped to 16 px inside the edges.
  - It is skipped when `?t=` starts past `by`.
- **Boss with no schematic left:** it sprays `round(bossSalvage × 1.5)` (`NO_SCHEMATIC_SALVAGE_MUL`).
- **Level systems** run every tick in every phase, after the timeline step and the scroll ramp.
- **Two extra registries beyond the ticket:**
  - `registerEnemyDraw`, for Tug beams and Lancer telegraph lines.
  - `registerLevelLayer`, for the Armada hull and other level-wide drawing.
  - Without them, sector tickets would have to edit shared draw code.
- **`?level=N` now overrides the hangar's launch `levelId` in GameScene.** The hangar currently hard-codes `kessler`, so before this change `?level` had no effect after pressing LAUNCH. It's a dev flag only.
- **Rock Hauler part defs** still live in `content/bosses.ts` but are now registered through `registerBoss`.
- **Level 1 regression check:**
  - Event-log hashes are unchanged for god0, god-plain, det, bal0 and bal1.
  - In the 50-seed balance report, clears are 45/50 before and after.
  - Small drift comes only from the supply drop, which rarely fires: Spread held at the boss went from 94% to 100%, and capsules per run from 9.5 to 9.9. Both are within noise.
  - The report's "boss P2" shot peak is now "boss" (the whole fight). It reads 36 before and after.

### Edits outside Owns (small, needed for the requirements)
- `src/game/enemies/draw.ts`: draws through the roster registry, and adds the `registerEnemyDraw` hook.
- `src/game/pickups/index.ts`: one export line (`podHp`, `podOverlayLayer`).
- `src/game/hud/state.ts`: `bossDisplayName` now delegates to the boss registry's `displayName`.
- `src/content/obstacles.ts`: one `import { LEVELS }` line at the top. T23 owns the rest of this file; expect a trivial merge.

### Shared changes needed
- **T22:** the hangar's LAUNCH should pass `save.selectedLevel` instead of `'kessler'`. GameScene already honors `levelId` from the scene data.
- **T25:** the unknown-song warnings stop once T25's songs are registered. L5 picks up the `armada` theme as soon as T25 adds it.

## Follow-ups
- **Stubs are hard for the typical bot.** In a 10-seed typical-dodger sample, clears were: L2 2/10, L3 1/10, L4 0/10, L5 1/10.
  - A 45 s stub doesn't build enough loadout for the Rock Hauler.
  - The dodger bot ignores pulsar rings: 80% of L4 runs died before reaching the boss.
  - This is expected for stubs. T27–T30 replace them, and T31's bots will need pulsar and black-hole awareness.
- **Salvage cache has no HP.** The cache that replaces a pod is still a plain salvage spray. If the gauntlet's cache should have 3 HP (T27), it needs a pod-like pickup with an empty pilot, which is a small pickups change.
- **Balance seeds:** `LEVEL=all npm run balance` prefixes each sector's seeds with `<id>-`. Level 1 keeps its historical `bal<i>` seeds so reports stay comparable.
