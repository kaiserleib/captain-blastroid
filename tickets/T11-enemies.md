# T11 — Enemies: behaviors, smart avoidance, fire patterns
Status: done
Wave: 2 · Depends on: T02, T03 (reads asteroid pool; no T10 import needed) · Blocks: T15, T16

## Goal
The Level 1 enemy roster ("Scrap Syndicate"), built on reusable movement behaviors and bullet patterns that later enemies and the boss can compose.

## Owns
`src/game/enemies/**` (enemySystem.ts, behaviors/*.ts, patterns.ts, avoidance.ts, formations.ts, sprites.ts, index.ts, tests), `src/content/enemies.ts`. The `enemies` System and DrawLayers (enemies z 40, enemy shots z 50).

## Read first
`docs/design.md` → Enemies (table + collision notes). `docs/art-direction.md` → Enemy faction palette, enemy bullet rule.

## Requirements
1. **content/enemies.ts:** per enemy: hp, r, sprite, behavior id + params, fire pattern id + params, avoidsAsteroids, contactDamage, score, salvage, drop table id. Gnat, Swooper, Gunboat, Interceptor, Carrier per design.md.
2. **Behaviors** (pure-ish functions `(w, e, def, dt) → mutate vx/vy/state`):
   - `straight` (heading + speed; includes scroll drift)
   - `sineDive` (downward with sine x-offset; amplitude/frequency params)
   - `swoop` (enter from a corner along a quadratic/cubic Bézier, then exit the side)
   - `holdAndStrafe` (descend to anchorY, strafe ± within bounds for N s, then exit up/down)
   - `shadowPlayer` (lerp x toward player.x with lag, descend slowly)
   - `crossing` (side-to-side transit at fixed y, for the Carrier)
3. **Smart avoidance** (`avoidsAsteroids: true`): look-ahead probe (40 px along velocity, plus two ±25° whiskers) against asteroids via the spatial hash. Steer laterally away with a capped force, then blend back to the behavior's desired velocity. Dumb enemies skip this entirely. **No enemy reacts to player shots.**
4. **Fire patterns** (`patterns.ts`, reused by the boss): `aimed(n, spreadDeg, speed)`, `fan(n, arcDeg, speed)`, `ring(n, speed, rotOffset)`, `burst(count, interval, inner)`. Enemies only fire when on screen and at least 24 px above the player, and never in their first 0.5 s (fairness).
5. **Formations** (`formations.ts`): `spawnFormation(w, {type: 'column'|'v'|'line'|'stagger', enemyId, count, x, spacing, delay})` assigns a `formationId` and registers it in `run.formations` (T03).
6. **Sprites:** 16×16 Gnat/Swooper (2-frame), 24×24 Gunboat/Interceptor, 32×24 Carrier (with visible cargo pods). Flash on hit. Rust/olive/gunmetal and green-glow palette. Enemy bullet sprites `ebullet_s`/`ebullet_l` (magenta ring, white core) with a 2-frame pulse.
7. **Sandbox:** keys `1–5` spawn each enemy type and `6` spawns a gnat V-formation.

## Acceptance criteria
- [x] In the sandbox with an asteroid stream, Gunboats/Interceptors visibly weave around rocks while Gnats/Swoopers smash into them.
- [x] Aimed shots lead toward the player's current position (no prediction), readable and dodgeable.
- [x] Unit tests: each behavior's path is deterministic for a given seed; avoidance deflects from an asteroid placed ahead; fairness rules (no fire in the first 0.5 s or below the player); formation registration.

## Out of scope
Drops (T12), explosions (T13), the boss (T16), timeline (T15).

## Contract changes
No contract file changed. Additive, outside the contract files:
- `src/content/index.ts` re-exports `./enemies`.
- `GameScene` registers `enemySystem` at the enemies slot and spreads `...enemyLayers` into its layers.
- The enemy system integrates enemy positions itself (prevX/prevY, then x += vx·dt) for roster enemies only, meaning defs in `ENEMIES`. Boss parts and other defs are skipped, so **T16 integrates and draws its own parts**.

## Notes
**Content (`content/enemies.ts`).** `EnemyDef` (exported type) holds hp, r, sprite, `behavior` (a `BehaviorParams` union keyed by `kind`), `fire` (`{pattern, firstDelay, interval (0 = once), bullet: 's'|'l'}` or null), avoidsAsteroids, contactDamage, score, salvage, `dropTable`. Drop table ids: `carrier` for the Carrier, `common` for everything else. T12 reads `ENEMIES[enemy.defId].dropTable` and `.salvage` on `enemyKilled`. Also exported: `ENEMY_BULLETS` (s = `ebullet_s` r2, l = `ebullet_l` r3), `ENEMY_FAIRNESS`, `AVOIDANCE`. `registerEnemyDefs(ENEMIES)` runs when `game/enemies/index.ts` loads.

**Behaviors (`behaviors/*.ts`).** `fn(w, e, params, dt)` writes the desired velocity into `e.vx/vy`. `e.state === 0` means not initialized yet. `runBehavior(w, e, params, dt)` dispatches on `params.kind`. Use of ax/ay per behavior:
- straight: ax = heading (rad), ay = speed. A non-zero spawn `vx/vy` overrides the def's heading and speed.
- sineDive: ax = center x.
- swoop: ax/ay = spawn point. Spawning right of center mirrors the curve.
- holdAndStrafe: ax = strafe center. ay = hold y (spawn override `ay > 0` replaces `anchorY`).
- shadowPlayer: ax = fixed per-instance x offset (±spread, derived from the id) so groups don't stack.
- crossing: ax = direction, ay = cruise y.

**Avoidance (`avoidance.ts`).** `computeAvoidance(w, e, dirX, dirY, out, curVx?, curVy?)` probes at 20 and 40 px ahead plus ±25° whiskers of 30 px, using `getSpatialHash(w)` on the asteroid layer. It returns a lateral steer (capped at 130 px/s) plus a brake along the heading that scales with how close the nearest rock's edge is. Smart enemies blend `v → desired + steer` at 7/s, which also eases them back onto the path. Dumb enemies take the behavior's velocity directly.

**Patterns (`patterns.ts`), for T15/T16.** Angles are in degrees with 90 = down. Each function returns the number of shots spawned.
- `aimed(w, x, y, n, spreadDeg, speed, style?)` aims at `player` now, with no lead.
- `fan(w, x, y, n, arcDeg, speed, style?, centerDeg = 90)`
- `ring(w, x, y, n, speed, rotOffsetDeg, style?)`
- `burst(w, source: Enemy, count, interval, inner: aimed|fan|ring def, style?, fair = true)` fires now, then schedules `count-1` follow-ups from the source's live position. Follow-ups stop if the source dies. Bosses pass `fair = false`. Pending bursts are ticked by the enemies system.
- `firePattern(w, source, patternDef, style?, fair?)`, `aimAt(w, x, y)`, `muzzleY(e)`, `canFire(w, e)`.
- Styles: `SHOT_SMALL`, `SHOT_LARGE`, `shotStyle('s'|'l')`, or your own `{sprite, r, damage?, ttl?}`.

**Fairness** (`canFire`). An enemy may fire only when all of these hold: t ≥ 0.5 s, center on screen, y ≤ player.y − 24, and the player is alive. A volley that is due waits until it is allowed. The fire timer starts at `max(firstDelay, 0.5)` unless the spawn overrides `fireT`.

**Formations (`formations.ts`).** `spawnFormation(w, {type: 'column'|'v'|'line'|'stagger', enemyId, count, x, y = -16, spacing, delay = 0, overrides?}) → formationId`. It registers `{alive: count, total: count, broken: false}` in `run.formations` and tags each member. With `delay`, member i spawns i·delay s later (still counted). A member that can't spawn because the pool is full is removed from the count. `formationOffset(type, i, count, spacing, out)` is pure.

**Draw.** `enemiesLayer` (z 40) draws roster enemies with a 2-frame animation (per-id phase) and hit flash. `enemyShotsLayer` (z 50) draws every enemy shot with its `sprite` (default `ebullet_s`) and a 10 fps pulse. Sprites are in `enemies.sprites.ts` (`enemy_gnat`, `enemy_swooper`, `enemy_gunboat`, `enemy_interceptor`, `enemy_carrier`, `ebullet_l`). The index also imports `gfx/reference.sprites` so `ebullet_s` exists in-game.

**Sandbox** (`?sandbox`). Keys 1–5 spawn gnat/swooper/gunboat/interceptor/carrier, and 6 spawns a 5-gnat V. **R** (extra, unused by other tickets) drops 6 static indestructible rocks so avoidance can be watched without T10. Rocks are outlined by a sandbox-only layer at z 29, which sits under T10's real asteroid sprites after merge.

**Verified in Chrome** (port 5111, muted). With three R fields plus 4 gnats, a gnat V, 3 interceptors and 2 gunboats: all 9 gnats died on rocks, and all interceptors and gunboats survived, steering around the clusters. Aimed shots, gunboat fans and sprite animation/flash all render.

**Follow-ups**
- No enemy-fire sfx exists in T04's id list, so enemies fire silently.
- Against a static rock wall wider than the steer can clear, an interceptor still hovers above it while it keeps shadowing the player. Drifting rocks (T10) resolve this.
- Enemies spawned with zero velocity ease up to speed over about 0.2 s when smart (blend).
