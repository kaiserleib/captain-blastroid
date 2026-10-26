# T10 — Asteroids + indestructible anomaly framework
Status: done
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
- [x] Asteroids move in perfectly straight lines unless the repulsor or a black hole acts on them (test: velocity is unchanged over 300 ticks with no forces).
- [x] Asteroids block enemy shots, and dumb enemies die on them (integration test with T03 rules).
- [ ] Rock break looks and sounds crunchy. 120 asteroids on screen stay at 60 fps. (120 rocks at 60 fps verified; the break sound and look depend on T04 audio, unheard while muted, and on T13 debris FX)
- [x] Sandbox key `B` spawns a black hole, `N` a pulsar. Bullets visibly curve around the black hole.

## Contract changes
None. No contract file changed. Conventions on top of T03:
- `Asteroid.variant` encodes theme and shape: `themeIndex * ROCK_VARIANTS + shape` (themes `kessler`=0, `ion`=1, `basalt`=2). Use `asteroidTheme(a)` to read it back. Children inherit the theme.
- Pulsar anomalies use `radius` = max ring radius and `strength` = ring speed. Black holes use `radius` = field radius and `strength` = shot pull (px/s² at 8 px, inverse falloff).
- The black hole moves the player by **position drift**, not velocity, because T08 owns player velocity.

## Notes
- **API (`src/game/obstacles/index.ts`).**
  - `obstaclesSystem` (slot between bullets and pickups), `asteroidLayer` (z 30), `anomalyLayer` (z 10). All three are registered in `GameScene`.
  - `spawnRock(w, { size, x, y, vx, vy, theme?, shape?, hp?, spin?, rot? })` → `Asteroid | null`. It uses content radius and HP, with spin, shape and rot from `world.rng`. `hp <= 0` makes the rock indestructible. The theme defaults to `rockThemeForLevel(run.levelId)`. **T16:** fling rocks with this.
  - `spawnAsteroidStream(w, { rate, sizeWeights, angleRange, speedRange, xRange, jitter, duration, theme, indestructibleChance, poolReserve })` → `AsteroidStream`. Every field is optional (defaults are in `ASTEROID_STREAM_DEFAULTS`). The obstacles system ticks the stream until `stream.stop()` or `duration` runs out. `stream.config.rate` etc. can be changed live for ramps. `stopAllAsteroidStreams(w)` and `activeAsteroidStreams(w)` are also exported. For manual control, use `new AsteroidStream(cfg)` and call `.update(w, dt)` yourself. Rocks enter just above the top edge, heading within ±25° of straight down (clamped), and their vy includes `world.scrollSpeed`. The stream keeps `poolReserve` (12) slots free so splits never overflow the pool. **T15:** use this.
  - `spawnBlackHole(w, x, y, {vx?, vy?})` and `spawnPulsar(w, x, y, {vx?, vy?})`. `vy` defaults to `scrollSpeed`, so they drift with the world. `pulsarRingRadius(a)` and `pulsarGlow(a)` are exported for anyone who needs the ring (e.g. bots).
  - `registerAnomalyHooks()` runs on import. Call it again after `clearHooks()` in tests.
- **Breaking.** `asteroidDestroyed` triggers `sfx asteroid_break` (with x) and splits per `ASTEROID_SIZES[size].split[theme]`. Children fly sideways across the parent's heading. Kessler: only larges split (into 2 mediums), and mediums are 1 HP with no split. Ion/basalt: mediums split into 2 smalls. Drops and debris FX are T12/T13 listeners. `ASTEROID_SIZES[size].salvage` is there for T12 to read if it wants size-scaled salvage. Score stays T03's flat 10.
- **Black hole.** Pulls both shot pools, asteroids (×0.3) and pickups (×0.4) with `applyRadialForce` (inverse falloff, radius 128). Shots reaching the core (r 8) are absorbed by T03's collision rule. Rocks within `r + rock.r/2` are released silently, with no `asteroidDestroyed` and so no drop. Contact costs 1 segment through the anomaly-contact hook.
- **Pulsar.** Pulse k fires at `t = k·3 s`, after a 0.6 s glow. The ring expands at 120 px/s, 4 px thick, out to 220 px. The player gets one hit chance per pulse, while the band overlaps the ship.
- **Art.** `obstacles.sprites.ts`: `rock_<theme>_<size>_<0..2>` (inner 10/18/30 plus a 1 px outline = 12/20/32). Each sprite has 16 *frames* for the 16 rotations rather than cache rotation. Every frame is re-lit from the top-left, so the light doesn't spin with the rock. Draw with `frame: rockFrame(rot)`. Shading comes from a height map (lumpy sphere, crater bowls with rims, value noise) with ordered dithering only near level boundaries. `anomaly_blackhole` is 48×48 with 8 palette-cycled frames. `anomaly_pulsar` is 24×24 (frames 0–3 idle, 4–7 telegraph). The asteroid layer warms the level theme's 9 rock sprites on its first draw.
- **Sandbox (`?sandbox`).** `B` spawns a black hole, `N` a pulsar, and `Shift+B`/`Shift+N` clear anomalies. `A` cycles the stream off → stream → storm (fills all 120 slots) → off. Console access: `(await import('/src/game/obstacles/sandbox.ts')).sandbox.world`.
- **Gallery.** The "Obstacles" section runs the live sim over the kessler/ion/horizon backgrounds, with a black hole bending a fan of player shots, a pulsar ring, and rocks breaking.
- **Verified in Chrome (port 5110, muted).** Storm with 119 rocks, 2 anomalies: 120 fps display, 0.05 ms update, 0 dropped spawns, no console errors. Shots visibly curve around the black hole (gallery). The "crunchy" sound is T04's `asteroid_break` preset and wasn't listened to (audio muted).

## Out of scope
Level scripting (T15), tractor-beam enemies (post-MVP).
