# T23 — Hazards: tractor beams, black-hole variants, pulsar gaps
Status: done
Wave: 5 · Depends on: T00–T20 · Blocks: T27–T30

## Goal
Generic, reusable hazard mechanics for sectors 2–4, built in the obstacles module so level tickets only place them.

## Owns
`src/game/obstacles/**`, `src/content/obstacles.ts` (except `rockThemeForLevel`, which T21 owns), and obstacle sprites. If needed, a small additive `sim/forces.ts` helper; note it in Contract changes.

## Read first
`docs/design.md` → "Shared mechanics" (Tractor beams, Black holes, Pulsars), `tickets/WAVE5-NOTES.md`, `src/game/obstacles/**`, `src/sim/forces.ts`, `src/sim/collisionRules.ts`.

## Requirements
1. **Tractor beams** (exported from `game/obstacles`):
   - `towRock(w, rock, tx, ty, k)`: call it every tick while towing. It applies a damped spring toward (tx, ty) (damping 2√k) and marks the rock as towed for this tick.
   - `flingRock(w, rock, speed, targetX, targetY)`: sets the velocity and ends the tow.
   - `isTowed(rock)`.
   - Cleanup must never cull a rock that was towed this tick, even off-screen above the top edge (boss rocks come in from y < 0).
   - `drawTractorBeam(r, x0, y0, x1, y1, t)`: dashed 2 px cyan beam (`#58d0f8` / `#d0f8f8`) with scrolling dashes, using integer pixels and no allocations.
   - A towed rock moving *toward* a boss part must not break on it. Reuse T03's moving-away rule or exempt towed rocks.
   - Sandbox key `T`: the nearest rock is towed toward the cursor, and release flings it at the player.
2. **Black-hole variants:**
   - `BLACK_HOLE_VARIANTS = { small, standard, massive }` with the design's numbers.
   - `spawnBlackHole(w, x, y, { variant })`.
   - Per-slot variant data lives in a side table keyed by entity id (don't add fields to `Anomaly`; it's a contract).
   - `collapseAnomaly(w, a, dur)` shrinks the field and core to 0 over `dur` s, then releases the anomaly (boss defeat, gravity buoys).
   - **Draw:** an accretion ring (1 px bright ring at the core edge, slowly rotating highlight pixels) and a dithered dark halo out to 2× the core. It must read on all backgrounds, and the field radius is *not* drawn.
   - **Escape pods are never swallowed** by a core: the pickup pull still applies, but pods slide past.
3. **Pulsar variants with gaps:**
   - `PULSAR_VARIANTS = { steady, turning, quick, magnetar }`. Fields: period, telegraph, gaps, gapDeg, gapSpin, ringSpeed, maxRadius.
   - `spawnPulsar(w, x, y, { variant, phase })`. Exported helpers: `pulsarGapAngles(a, out)` (no allocation), `pulsarRingRadius`, `pulsarGlow`.
   - **Collision:** the ring damages the player only if the player's angle from the core is outside every gap (account for the player radius at that distance). One hit per pulse, as now.
   - **Telegraph:** during the glow, draw the gap directions as bright 1 px spokes from the core out to 40 px, growing with glow progress. The ring itself is drawn with the gaps cut out.
   - A **programmable pulsar** for bosses: `spawnPulsar(w, x, y, { variant: 'magnetar' })` plus `setPulsarPattern(a, { period, gaps, gapDeg, gapSpin, double? })`, so the Magnetar boss (T29) can change it per phase. `double` fires a second ring 0.5 s after each pulse, rotated by half a gap.
4. **Gravity buoy support:** `spawnFieldOnly(w, x, y, { variant, strengthMul })`, a black-hole field with **no core** (no absorb, no contact damage, not drawn as a hole), attached to a moving body. It can be implemented as an anomaly that the owner moves each tick (`a.x/a.y` written by the owner) and collapses on death.
5. **Tests** (pure where possible): gap math (in a gap means no damage, a solid arc means damage, the radius-at-distance edge case), variant spawn values, tow spring convergence and fling velocity, cull exemption, pods not absorbed, collapse releasing the anomaly, `setPulsarPattern` and the double ring.
6. **Sandbox:** keep `B`/`N`/`A`. `Shift+B` cycles black-hole variants and `Shift+N` cycles pulsar variants at the cursor. Show them in the `?sandbox` scene and the gallery (sprites, if any).

## Acceptance criteria
- [x] Each of the three pulsar variants is visibly dodgeable by standing in a telegraphed gap (checked by screenshots in the gallery's Hazards section, which parks a marker in the telegraphed gap, plus a sim test per variant: in-gap = 0 hits, solid arc = 1 hit).
- [x] Black holes look like holes (accretion ring + halo) on the ion, horizon and pulsar backgrounds.
- [x] Tow and fling work in the sandbox, and the beam draws crisp.
- [x] Level 1 is unchanged: god-bot (300 s) and dodger (200 s) event-log hashes are identical before and after (`e9c3409a` / `f699e354`).
- [x] build / test / lint / test:sim pass.

## Contract changes
All additive:
- `src/sim/hooks.ts`: new `registerAsteroidHeld(fn)` / `isAsteroidHeld(w, a)` (one check, replaced on re-register; `clearHooks` resets it). The obstacles module registers `isTowed` through it.
- `src/sim/cleanup.ts`: asteroids that are offscreen but held (`isAsteroidHeld`) aren't culled. `cullAsteroids` now takes the world (internal).
- `src/sim/collisionRules.ts`: `enemyVsAsteroid` returns early for held rocks, so towed rocks pass through every enemy (bosses included).
- `src/content/obstacles.ts`: `PulsarDef`/`PULSAR` lost `period`, `telegraph`, `ringSpeed`, `maxRadius` (now per variant in `PULSAR_VARIANTS`; nothing outside obstacles read them). New: `BLACK_HOLE_VARIANTS`, `BLACK_HOLE_VARIANT_IDS`, `DEFAULT_BLACK_HOLE_VARIANT`, `FIELD_ONLY_STRENGTH_MUL`, `PULSAR_VARIANTS`, `PULSAR_VARIANT_IDS`, `DEFAULT_PULSAR_VARIANT`, `PULSAR_FIRST_GAP_DEG`, `PULSAR_DOUBLE_DELAY`, `PULSAR_SPOKE_LEN`, `TRACTOR`.
- No changes to `Anomaly`/`Asteroid` types: variant, pulse clock, gap pattern, collapse and tow state live in side tables (`WeakMap` per pool slot, reset when the slot's entity id changes; allocated once per slot).

## Notes

### API (`import … from 'game/obstacles'`)
Tractor beams
- `towRock(w, rock, tx, ty, k, tvx = 0, tvy = 0)`: call every tick while towing. Critically damped spring (k 1/s², damping 2√k) toward (tx, ty), relative to the anchor's velocity (tvx, tvy) so moving slots (orbits) are tracked without lag. Backward Euler at the fixed step, so any k is stable. Marks the rock towed.
- `flingRock(w, rock, speed, targetX, targetY)`: ends the tow and sets the velocity to `speed` toward the target.
- `releaseRock(rock)`: ends the tow and keeps the current velocity. A rock nobody tows for two ticks is released automatically, which covers a dead tower.
- `isTowed(rock)`: true while held. Held rocks are never culled and don't collide with enemies. They still hit the player, take damage, split, and get swallowed by black holes.
- `drawTractorBeam(r, x0, y0, x1, y1, t)`: emitter → rock. Dashed 2 px `#58d0f8` beam with a `#d0f8f8` leading pixel per dash. The dashes scroll toward the emitter. Whole pixels, no allocation. Draw it from your own layer.
- `TRACTOR.k` (12) and `TRACTOR.flingSpeed` (95) are suggested defaults in content.

Black holes
- `spawnBlackHole(w, x, y, { vx?, vy?, variant? })`: variant `small` / `standard` / `massive`. Unknown or missing means `standard`. vy defaults to the scroll speed.
- `spawnFieldOnly(w, x, y, { variant? = 'small', strengthMul? = 0.5, vx? = 0, vy? = 0 })`: gravity-buoy field. `a.r = 0`, no absorb, no contact damage, not drawn. It still pulls shots, rocks, pickups and the player (strength and player pull × strengthMul). The owner writes `a.x`/`a.y` each tick (enemies run before obstacles, so that's this tick's position) and calls `collapseAnomaly` on death.
- `collapseAnomaly(w, a, dur)`: core, field and player pull shrink linearly to 0 over `dur` s, then the anomaly is released. `dur <= 0` releases it immediately. On pulsars it also stops new pulses. `isCollapsing(a)`.
- `anomalyVariant(a)`, `isFieldOnly(a)`.

Pulsars
- `spawnPulsar(w, x, y, { vx?, vy?, variant?, phase? })`: variant `steady` / `turning` / `quick` / `magnetar`. Unknown or missing means `steady`. `phase` pre-runs the pulse clock: pulse k fires at clock = k·period, and a `phase` ≥ period counts as pulses already fired. Rings already out at spawn don't hurt.
- `setPulsarPattern(a, { period, gaps, gapDeg, gapSpin, double?, telegraph?, ringSpeed? })`: takes effect from the next pulse. The clock keeps running, so a shorter period may fire immediately. `double` adds an echo ring `PULSAR_DOUBLE_DELAY` (0.5 s) later, its gaps turned by **half a gap width** (`gapDeg/2`).
- `pulsarGapAngles(a, out)`: writes gap-center angles in radians (canvas y down) and returns the count. These are the *next* pulse's gaps while glowing, otherwise the live ring's. No allocation.
- `pulsarRingRadius(a)` / `pulsarEchoRadius(a)`: return -1 when no ring is out. `pulsarGlow(a)` returns 0..1. `pulseIndex(a)` counts pulses fired. `pulsarGapWidth(a)` is in radians.
- `inPulsarGap(dx, dy, bodyR, gaps, gapW, rot)`: pure. True when the whole body (angular half-width asin(r/d)) fits inside a gap.
- Gaps start centered straight down (`PULSAR_FIRST_GAP_DEG = 90`) and turn by `gapSpin` each pulse.

### Decisions
- **Hit rule:** a ring damages only if the ship's whole hitbox, measured at its distance, isn't inside a gap. Each ring (main and echo) gets one hit chance per pulse, consumed on overlap even during invulnerability, as before.
- **Pulse clock:** the pulsar now runs its own clock (side table) instead of `floor(a.t / period)`, so the boss can change the period mid-fight.
- **Towed rocks vs enemies:** they're exempt from *all* enemy collisions, not only bosses. Otherwise a tug would kill itself with its own catch on the way in (a large rock does 10 dmg to a 10 HP tug). Flung rocks use the normal rules again.
- **Escape pods** are never absorbed. Nothing ever absorbed pickups, but pods also skip the pull while inside the core so they coast through instead of pinning on the capped inverse pull. Tested: a pod falling onto a `massive` hole is pulled, passes, and leaves below it.
- **Field-only anomalies** keep `r = 0`, so a player shot passing within its own radius of the buoy's center is still eaten by T03's shot × anomaly rule. The buoy enemy body sits on top and normally takes the shot first. It's acceptable, but noted.
- **Black-hole art** is redone as one baked sprite per whole core radius (1–12, `anomaly_blackhole_r{n}`, 8 frames): a black core, a 1 px amber ring with two white-hot highlights turning slowly, a Bayer-dithered dark halo to 2r, and sparse violet lensing glints just outside it. Collapsing holes step down through the sizes. The old 48 px swirl sprite and the dotted field circle are gone, since the design says not to draw the field.
- **Pulsar telegraph:** a bright spoke down each upcoming gap center, growing from the core to 40 px with the glow, plus dimmer, shorter spokes on the gap edges to show the width. Rings are drawn as midpoint circles with gap pixels skipped by a dot-product test. The echo ring is one ramp step dimmer.
- **Sandbox keys:** `B`/`N` (random spot, default variant) and `A` are unchanged. `Shift+B`/`Shift+N` spawn the next variant at the cursor and toast its name. **Clear anomalies moved from `Shift+B/N` to `X`.** Holding `T` tows the rock nearest the tow point toward a point 40 px above the cursor, so the catch doesn't land on the ship that follows the mouse; releasing flings it at the ship at 95 px/s. The cursor is the mouse-follow target; in keyboard mode it's a point 90 px above the ship. The sandbox beam draws in the anomaly layer (under rocks).
- **Gallery:** a new "Hazards" section (in `tools/sections/obstacles.ts`) shows the 3 hole variants live on the ion/horizon/pulsar backgrounds with shot fans, the 4 pulsar variants with a marker in the telegraphed gap (magnetar runs a double 3-gap pattern), and a Shepherd-style orbit tow + fling loop.
- My worktree started behind main and was fast-forwarded to `cd064d8` (the wave-5 contracts commit). Main has moved on since then (T25, T26). There's no overlap with obstacles, but T25 recolored the pulsar background, so it's worth one look at the gallery after merging.

### Shared changes needed
- None required. GameScene's layer list is unchanged: sector code draws tractor beams from its own enemy or boss draw.

## Follow-ups
- T27/T30: tugs and the Shepherd call `towRock` each tick, `flingRock` on throw, `releaseRock` (or just stop calling) on death, and `drawTractorBeam` from their draw.
- T28: gravity buoys need their own visual. A field-only anomaly isn't drawn at all.
- T29: magnetar patterns with `period` < maxRadius / ringSpeed (2 s at 260 / 130) cut the previous ring short when the next pulse fires. Pick periods with that in mind, or ask for multi-ring support.
- T31: the "half a gap" echo rotation is `gapDeg/2`. If playtests want the echo to force a move, turn it by half the gap *spacing* instead (a one-line change in `pulsar.ts`).
