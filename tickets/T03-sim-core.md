# T03 — Sim core: spatial hash, collision rules, forces, damage, cleanup
Status: done
Wave: 1 · Depends on: T00 · Blocks: T08–T13, T15, T16

## Goal
The shared simulation plumbing: moving bodies, finding overlaps cheaply, applying the game's collision rules, applying forces, dealing damage, and cleaning up off-screen entities. Each piece emits the contract events, so feature tickets react without knowing about each other.

## Owns
`src/sim/spatialHash.ts`, `src/sim/collision.ts`, `src/sim/collisionRules.ts`, `src/sim/forces.ts`, `src/sim/damage.ts`, `src/sim/motion.ts`, `src/sim/cleanup.ts`, `src/sim/spawn.ts` (typed spawn helpers that reset every field), tests. Registers the `bullets`, `collision` and `cleanup` systems in `GameScene`.

## Read first
`docs/tech-stack.md` → Core contracts. `docs/design.md` → Death and damage, Obstacles (bullets vs obstacles), Enemies (collision notes).

## Requirements
1. **spawn.ts:** `spawnPlayerShot(w, init)`, `spawnEnemyShot`, `spawnEnemy(w, defId, x, y, overrides)`, `spawnAsteroid`, `spawnAnomaly`, `spawnPickup`. Each resets **all** fields (pooled objects carry stale state), assigns `w.nextId()`, and sets `prevX/Y`. `spawnEnemy` reads HP and other fields from `content/enemies.ts` via the content registry (T11 fills the data; use a fallback def for tests).
2. **motion.ts:** `integrate(pool, dt)` sets prev, then `x += vx*dt`. Bullets: ttl countdown, homing steering (turn toward `targetId` by at most `homing*dt`, retarget to the nearest enemy if the target dies), and `rot` from velocity. The **bullets system** runs this for both shot pools.
3. **spatialHash.ts:** uniform grid (cell 32 px) rebuilt each tick for enemies, asteroids, anomalies and pickups. Allocation-free queries: `query(x, y, r, cb)`, plus a `nearest(x, y, filter)` helper for homing and AI.
4. **collisionRules.ts:** the **collision matrix**, all circle-vs-circle:
   | A × B | Result |
   |---|---|
   | playerShot × enemy | `damageEnemy`. Pierce: skip ids in `hitIds`, decrement pierce, release at <0. |
   | playerShot × asteroid (destructible) | `damageAsteroid`, consume shot (pierce applies) |
   | playerShot × anomaly | absorb shot |
   | enemyShot × player | `damagePlayer` (respect invuln) and release shot |
   | enemyShot × asteroid / anomaly | absorb shot (asteroid undamaged) |
   | enemy × asteroid | both take damage = the other's current HP (min 1). Emit `enemyKilled{byPlayer:false}` / `asteroidDestroyed{byPlayer:false}`. Bosses are immune. |
   | player × enemy | `damagePlayer`, enemy takes `5`, unless the enemy is a boss (player only) |
   | player × asteroid | `damagePlayer`, destructible asteroid destroyed |
   | player × anomaly | delegated to `registerAnomalyContact` hook (T10 registers per-kind handlers) |
   | player × pickup | handled by T12's pickup system (it uses pickupRadius, which is larger than r). Not here. |
   | enemy × enemy, asteroid × asteroid | nothing |
   Call the `registerShotBlocker` hooks (`src/sim/hooks.ts`) for every enemy shot, so T09's Orbit Drones and T12's escape pods can intercept them.
5. **damage.ts:** `damageEnemy(w, e, amount, source)` (flashT, emits `enemyHit`; at hp ≤ 0 emits `enemyKilled`, adds score via `run`, releases the enemy). If `e.isBoss`, call the `registerBossDamage` hooks first; when one returns true, T16 handles the hit and death. `damageAsteroid`, and `damagePlayer(w, amount)` (no-op if `invulnT>0`, `!alive` or `?god`; decrements shield, sets invulnT 1.0, emits `playerHit` + `shake` + `haptic`; at shield < 0 sets `alive=false` and emits `playerDied`). Chain multiplier bookkeeping in `run` (reset on playerHit).
6. **forces.ts:** `applyRadialForce(pool, x, y, radius, strength, falloff: 'linear'|'inverse')`. Positive pushes, negative pulls, and it modifies velocity. Used by the repulsor, magnet and black holes. Asteroids keep the new velocity, so they still travel in straight lines between forces.
7. **cleanup.ts:** release entities that are fully off-screen with a margin of 16 + r (bottom, left and right always; top only if moving up and y < −64). Then `compact()` every pool.
8. **Formation tracking:** `run.formations: Map<id, {alive, total}>`, decremented when a formation member dies *by the player*. Emits `formationCleared` at the last member's position. If a member leaves the screen or dies to an asteroid, the formation is marked broken and the bonus is lost.

## Acceptance criteria
- [x] Vitest: each row of the collision matrix has a test with hand-placed entities in a `createWorld()`.
- [x] Pierce shot hits 3 lined-up enemies exactly once each.
- [x] A dumb enemy flying into an asteroid kills both, with `byPlayer:false` and no formation bonus.
- [x] Benchmark test: 600 enemy shots + 400 player shots + 80 enemies + 120 asteroids, with one collision tick < 2 ms in Node. Measured on Node 23.5 and an Apple M1 Pro, over 60 fresh crowds after JIT warm-up: median 0.17–0.27 ms, p95 0.3–1.8 ms. The p95 includes GC of the test's own setup.
- [x] No allocations in `collision.update`, checked by a heap-delta smoke test over 1,000 ticks or by review. The test runs the full core loop (bullets, collision and cleanup, refilling every pool, ~14 kills per tick) under V8's sampling heap profiler with garbage included, and attributes the bytes to `src/sim`. Result: 20–67 B/tick, which is a few stray heap numbers on kill paths. A per-entity allocation would be ≥ 16 kB/tick.

## Out of scope
Specific enemy behaviors, weapon firing, pickup effects, visuals.

## Contract changes
No contract file changed (`types.ts`, `world.ts`, `events.ts`, `renderer.ts`). These conventions sit on top, all inside T03 files:
- `Bullet.hitIds` keeps its length across respawns, and unused slots hold `NO_HIT` (-1). Clearing it with `length = 0` would make V8 drop the backing store and reallocate on the next hit. Check it with "contains id", not `.length`.
- Asteroids with `maxHp <= 0` are indestructible (`isDestructible(a)`). They absorb player shots, kill enemies that hit them, and survive player contact.
- `damage.ts` reuses its event payload objects (one per nesting depth). Listeners must copy the fields they need and must not store the payload.
- The spatial hash is per world, held in a module `WeakMap` (`getSpatialHash(w)`), so `World` gains no field.
- Enemy defs reach the sim through `registerEnemyDefs(table)` in `spawn.ts`, so T03 doesn't import `content/enemies.ts` (which doesn't exist yet). A `dummy` fallback def (hp 1, r 6, score 10, contactDamage 1) is always registered.

## Notes
- **Who runs what.** `bulletsSystem` (motion.ts) handles both shot pools: ttl, homing and rot. `collisionSystem` decays the chain, rebuilds the hash and applies the matrix. `cleanupSystem` culls off-screen bodies, decays `flashT` on enemies and asteroids, and compacts every pool. All three are registered in `GameScene`. `player.invulnT` is **not** counted down here; T08 owns that.
- **Hash staleness.** Positions are snapshotted at the rebuild in `collision`. Systems that run earlier (weapons, enemies, bullet homing) query last tick's positions. Released bodies are always skipped.
- **Damage amounts.** An enemy shot removes `shot.damage` segments (spawn default 1). Enemy contact removes `enemy.contactDamage` (def default 1), and asteroid contact removes 1. The enemy only takes `RAM_DAMAGE` (5), or the rock is only destroyed, when the hit on the player actually lands, so an invulnerable ship doesn't shred everything it touches. Ram kills count as player kills.
- **Boss × asteroid.** Boss parts take no damage. A rock closing on a part (relative velocity toward it) breaks with `byPlayer:false`. A rock moving away passes through, so T16 can fling rocks out of the hopper without them breaking on spawn.
- **Order within a tick.** Player shots go first. Enemy shots go next: shot blockers, then obstacles, then the player, so rocks act as cover. Enemy × asteroid follows, and player contact comes last.
- **Scoring.** An enemy kill scores `def.score` × chain. A kill within `CHAIN_WINDOW` (1.5 s) of the previous one raises the chain, up to 8. Asteroids score a flat 10. `run.kills` and `run.asteroidsDestroyed` count player kills only.
- **Perf notes for wave 2.** When one call site reads doubles from several entity types, it goes megamorphic and V8 boxes every read. That's why the hash snapshots x/y/r into typed arrays and cleanup has one loop per pool. In hot loops, set `h.qx/qy/qr` and call `h.queryAt(mask, cb)` with a hoisted callback rather than `query(x, y, r, …)`.
