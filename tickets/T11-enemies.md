# T11 — Enemies: behaviors, smart avoidance, fire patterns
Status: todo
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
- [ ] In the sandbox with an asteroid stream, Gunboats/Interceptors visibly weave around rocks while Gnats/Swoopers smash into them.
- [ ] Aimed shots lead toward the player's current position (no prediction), readable and dodgeable.
- [ ] Unit tests: each behavior's path is deterministic for a given seed; avoidance deflects from an asteroid placed ahead; fairness rules (no fire in the first 0.5 s or below the player); formation registration.

## Out of scope
Drops (T12), explosions (T13), the boss (T16), timeline (T15).
