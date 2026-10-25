# T10 — Asteroids + indestructible anomaly framework
Status: todo
Wave: 2 · Depends on: T02, T03 · Blocks: T11 (smart avoidance queries asteroids), T15, T16

## Goal
Asteroids that drift in straight lines, spin, break into satisfying debris, and act as hazards *and* tools (cover from enemy fire, enemy-killers). Also the data-driven framework for indestructible anomalies, with the black hole and pulsar implemented behind a flag for later levels.

## Owns
`src/game/obstacles/**` (asteroidSystem.ts, anomalySystem.ts, anomalies/blackhole.ts, anomalies/pulsar.ts, sprites.ts, index.ts, tests), `src/content/obstacles.ts`. The `obstacles` System and DrawLayers (asteroids z 30, anomalies z 10).

## Read first
`docs/design.md` → Obstacles, Scrolling and space. T03 `forces.ts`, collision matrix, `registerAnomalyContact`.

## Requirements
1. **content/obstacles.ts:** asteroid sizes (r, hp per level-theme, split rules, salvage, score), anomaly kinds (radius, strength, pulse timing, damage).
2. **Asteroid motion:** straight-line integration only (velocity changes come exclusively from forces), plus `rot += spin*dt`. `spawnAsteroidStream(world, {rate, sizeWeights, angleRange, speedRange, xRange})` helper for the director: rocks enter from the top with a heading within ±25° of straight down, and their velocity includes the scroll drift.
3. **Breaking:** on `asteroidDestroyed`, if a split rule exists, spawn children with diverging velocities. Always emit FX (rock-chunk debris, dust puff), `sfx asteroid_break`, and a salvage drop request (T12 rolls the drop table; emit only, as T12 listens).
4. **Sprites:** procedural (`defineProcSprite`) lumpy rocks with crater dithering and top-left lighting, 3 variants per size and 16 rotations. Theme palettes: kessler (warm gray/brown), ion (icy blue) and basalt.
5. **Anomalies** (implemented, tested, used by the director only in post-MVP levels):
   - **Black hole:** each tick, `applyRadialForce` with negative (pull) strength on the player (gentle), pickups, both shot pools, and asteroids. The core absorbs shots and asteroids, and contact damages the player. Visual: a pulsing ring of dithered accretion pixels plus the hole (palette cycling).
   - **Pulsar:** periodic telegraph glow (0.6 s), then an expanding ring (speed 120 px/s, thickness 4 px) that damages the player once per pulse on overlap. Indestructible.
   - Both are registered with T03's anomaly-contact hook.

## Acceptance criteria
- [ ] Asteroids move in perfectly straight lines unless the repulsor or a black hole acts on them (test: velocity is unchanged over 300 ticks with no forces).
- [ ] Asteroids block enemy shots, and dumb enemies die on them (integration test with T03 rules).
- [ ] Rock break looks and sounds crunchy. 120 asteroids on screen stay at 60 fps.
- [ ] Sandbox key `B` spawns a black hole, `N` a pulsar. Bullets visibly curve around the black hole.

## Out of scope
Level scripting (T15), tractor-beam enemies (post-MVP).
