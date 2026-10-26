# T23 — Hazards: tractor beams, black-hole variants, pulsar gaps
Status: todo
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
- [ ] Each of the three pulsar variants is visibly dodgeable by standing in a telegraphed gap (sandbox, checked by screenshots).
- [ ] Black holes look like holes (accretion ring + halo) on the ion, horizon and pulsar backgrounds.
- [ ] Tow and fling work in the sandbox, and the beam draws crisp.
- [ ] Level 1 is unchanged (god-bot hash stable, or the diff is explained).
- [ ] build / test / lint pass.

## Contract changes
(fill in)
