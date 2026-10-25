# T03 — Sim core: spatial hash, collision rules, forces, damage, cleanup
Status: todo
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
- [ ] Vitest: each row of the collision matrix has a test with hand-placed entities in a `createWorld()`.
- [ ] Pierce shot hits 3 lined-up enemies exactly once each.
- [ ] A dumb enemy flying into an asteroid kills both, with `byPlayer:false` and no formation bonus.
- [ ] Benchmark test: 600 enemy shots + 400 player shots + 80 enemies + 120 asteroids, with one collision tick < 2 ms in Node.
- [ ] No allocations in `collision.update`, checked by a heap-delta smoke test over 1,000 ticks or by review.

## Out of scope
Specific enemy behaviors, weapon firing, pickup effects, visuals.
