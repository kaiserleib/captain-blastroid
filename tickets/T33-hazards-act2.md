# T33 — Hazards II: solar flares and shade, portals, time bubbles
Status: todo
Wave: 8 · Depends on: T31 + the wave-8 contracts commit · Blocks: T38, T40, T41, T42

## Goal
Generic, reusable hazards for Act II, in the obstacles module, so sector tickets only place them. Also teach the test bots to survive them.

## Owns
- `src/game/obstacles/**`, `src/content/obstacles.ts` (new constants only), and obstacle sprites
- `tools/sections/` (a new "Hazards II" section file)
- `tests/sim/bots.ts`: add cost terms and `hitCause`s for these hazards only (append-only; T34 appends terrain at the same time)
- Small additive `src/sim/**` changes for time scaling and teleport, noted under Contract changes

## Read first
`docs/design.md` → **"Act II shared mechanics"** (Solar flares and shade, Portals, Time bubbles), `tickets/WAVE8-NOTES.md`, and T23's Notes. The black-hole and pulsar side-table patterns are the model to follow.

## Requirements
1. **Flares and shade:**
   - `startFlare(w, { warn, burn, practice? })`, `isFlareBurning(w)`, `flarePhase(w)`. Register the `flare` and `flares` timeline actions.
   - **Shade slabs:** `spawnShadeSlab(w, x, y, { vx?, vy? })`. Indestructible (40×10), drifts with the scroll, absorbs all shots and bounces Ricochet discs (through `isSolidAt` or a slab query T35 can use).
   - **Casters:** medium and large asteroids, slabs, and anything registered with `registerShadeCaster(w, entityId, halfWidth)`, which bosses use.
   - `inShade(w, x, y, r)` is pure over the caster list. The whole hitbox must be inside a strip (caster width − 2 px, 160 px long).
   - **Burn effects:**
     - 1 hit to the ship per flare when it's not in shade.
     - 3 damage once per flare to each non-boss enemy in the light.
     - 1 HP to escape pods in the light.
   - **Fizzle rule:** at warn start, if no strip is within 100 px horizontally and reachable before the burn (at the ship's speed), the flare fizzles. Log it in the event log.
   - **Draw:**
     - Warn: the top-edge whitening, the amber tint and the shimmer pixels.
     - Burn: blow-out with the shadow strips cut out (dithered umber).
     - A `practice` flare outlines the strips in white.
     - Cheap at 60 fps on mobile: no full-screen per-pixel loops, only rects and dither patterns.
2. **Portals:**
   - `spawnPortalPair(w, ax, ay, bx, by, { color, vxA?, vyA?, vxB?, vyB? })`, `setPortalEnd(w, pair, end, x, y)` (for owners), `collapsePortalPair`, and `swapPortals(w, p, q)` with a 0.8 s flicker. Register the `portal` timeline action.
   - **Crossing:** a body crossing *into* a ring (the previous position outside, the current one inside) comes out of the partner with the same velocity, placed r + 2 px out.
     - Applies to player shots, enemy shots, rocks, pickups and pods.
     - Per-body cooldown of 0.35 s in a side table keyed by entity id; preallocate it.
   - **The ship:**
     - A 1.0 s cooldown.
     - A portal end is closed to the ship (drawn dim) when its partner is off-screen or inside a black-hole core, a pulsar ring or a solid tile.
     - `portalOptIn(enemyId)` lets behaviors (the Blinker) use portals.
   - **Draw:** a 2 px ring in the pair's color with a rotating dithered swirl inside, plus a 1-frame white flash at an exit.
3. **Time bubbles:**
   - `spawnBubble(w, x, y, { kind: 'slow' | 'fast' | 'flip', r, ttl?, vx?, vy? })` and `timeScaleAt(w, x, y)`. Register the `bubble` timeline action.
   - **What's scaled:** bullet, rock and pickup integration, and enemies' movement and behavior timers (a scaled `dt` passed to behaviors). The ship is never scaled.
   - Multiply in `world.enemyBulletTimeScale` for enemy bullets (Dr. Halász's bullet time; T36 sets it).
   - **Flip** bubbles alternate every 3 s, with a 0.6 s flicker before each switch.
   - **Draw:**
     - Slow: a blue ring with tick marks.
     - Fast: an amber ring with streaks.
     - Bullets inside a slow bubble get 2 trailing ghost pixels.
4. **Bots** (`tests/sim/bots.ts`):
   - Flare: during the warn, move into the nearest reachable strip.
   - Portal: avoid entering one unless the exit is safer.
   - Bubbles: predict bullet positions with the scale.
   - Each hazard gets its own `hitCause`.
5. **Sandbox and gallery:**
   - Keys `F` (flare now), `Shift+F` (shade slab at the cursor), `[` (portal pair), `Shift+[` (swap), `]` (slow bubble) and `Shift+]` (cycle bubble kinds).
   - A "Hazards II" gallery section shows all three hazards live.
6. **Tests:** shade geometry (in, edge and out), fizzle reachability, one hit per flare, enemy burn damage, the portal crossing rule (no ping-pong, velocity preserved, closed ends), time-scale composition (bubble × bullet time), and flip timing.

## Acceptance criteria
- [ ] Each hazard works in the sandbox and reads clearly on the `corona`, `junction` and `rift` backgrounds (or the placeholders, if T37 hasn't merged).
- [ ] Zero allocations per tick in all three (checked with the existing pool-safety and perf habits).
- [ ] Act I is unchanged: the event-log hashes are identical.
- [ ] Bots survive each hazard in an isolated test scene (fewer hits than a hazard-blind baseline, numbers in Notes).
- [ ] build / test / lint / test:sim pass.

## Contract changes
