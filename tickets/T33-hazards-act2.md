# T33 — Hazards II: solar flares and shade, portals, time bubbles
Status: done
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
- [x] Each hazard works in the sandbox and reads clearly on the `corona`, `junction` and `rift` backgrounds (or the placeholders, if T37 hasn't merged).
- [x] Zero allocations per tick in all three (checked with the existing pool-safety and perf habits).
- [x] Act I is unchanged: the event-log hashes are identical.
- [x] Bots survive each hazard in an isolated test scene (fewer hits than a hazard-blind baseline, numbers in Notes).
- [x] build / test / lint / test:sim pass.

## Contract changes
- **`src/sim/motion.ts` (`updateBullets`):** each shot now integrates with `dt × timeScaleAt(w, x, y)`, times `w.enemyBulletTimeScale` for enemy shots. That covers ttl, homing and movement. The defaults are 1, so the result is exactly `dt`. Act I hashes are unchanged.
- **Registered at load by `game/obstacles`:**
  - `registerTimeScale(bubbleTimeScale)`.
  - `registerSolidQuery(slabSolidQuery)`.
  - Timeline actions `flare`, `flares`, `shadeSlab`, `portal` and `bubble`.
- No type, World, event or renderer changes.

## Notes

### API (`import … from 'game/obstacles'`)
**Flares and shade**
- `startFlare(w, { warn?, burn?, practice? })`: returns false while a flare is already warning or burning.
  - The default warn is 1.2 s. The first two flares of a run (world) default to 2.0 s. The default burn is 1.2 s, followed by a 0.4 s cool.
  - A flare whose shade is out of reach fizzles at warn start: the warning plays, there's no burn, and it goes straight to the fade.
- `startFlares(w, { every, until, warn?, burn? })`: starts one flare now, then one every `every` s while `w.time ≤ until`. `stopFlares(w)` ends the repeat.
- Reading flare state:
  - `flarePhase(w)` returns `'idle' | 'warn' | 'burn' | 'cool'`.
  - `isFlareBurning(w)` is true only during a damaging burn.
  - `flareState(w)` returns `{ phase, t, warn, burn, practice, fizzled, count, hitTick }`.
  - `flareProgress(f)` returns 0..1.
  - `hazardLog(w)` returns lines like `"12.00 flare fizzle"`.
- `setFlareImmune(defId)`: for Sunskimmers. This is module-level and keyed by def id.
- `spawnShadeSlab(w, x, y, { vx?, vy? = scrollSpeed })` and `removeShadeSlab`. Slabs are 40×10 and indestructible.
  - They eat every player and enemy shot, using a swept test, except shots with `weaponId === 'ricochet'`.
  - They don't touch the ship, rocks or enemies.
  - `shadeSlabs(w)` lists them.
- `registerShadeCaster(w, enemyId, halfWidth, halfHeight = e.r)` and `unregisterShadeCaster`: for boss hulls. A caster is dropped automatically when its enemy dies.
- `inShade(w, x, y, r)` is true when the whole circle is inside one strip. A strip is the caster's width − 2, starting at the caster's bottom edge and running 160 px down.
- `nearestShadeSpot(w, x, y, r, out, topPad = 0, maxDx = ∞)` finds the closest point where the circle fits. It's for Shade enemies and bots.
- `forEachStrip(w, fn)` passes each strip as a reused object. `slabSolidQuery` is the slabs' `SolidQuery`.

**Portals**
- `spawnPortalPair(w, ax, ay, bx, by, { color: 'cyan'|'orange'|'lime', vxA?, vyA?, vxB?, vyB? })` returns a `PortalPair | null`.
  - Ends are fixed by default. The timeline `portal` action gives both ends the scroll speed unless `drift: false`.
  - At most 4 pairs.
- `setPortalEnd(w, pair, 'a'|'b', x, y)`: call it every tick from the owner's update to carry an end.
- `collapsePortalPair(w, pair)`.
- `swapPortals(w, p, q)`: the b ends flicker between the two colors for 0.8 s, then the pairs become p = (p.a, q.b) and q = (q.a, p.b).
- `pair.id` is unique per spawn, so owners can detect a recycled handle. `portalPairs(w)`, `partnerOf(end)`, and `end.open` (open to the ship this tick).
- `portalOptIn(w, enemyId)`. **It takes `w`**, because the side tables are per world. Opted-in enemies use the 0.35 s body cooldown.
- `sinceShipPorted(w)`: seconds since the ship last went through.
- Crossing rule: the body's previous center is outside the ring (measured at the ring's previous position) and its current center is inside.
  - The body exits at partner center + heading × (r + 2), with its velocity unchanged.
  - A body standing still uses the ring's sweep direction instead.
- An end is closed to the ship when its partner is:
  - off screen,
  - within a black-hole core + 6,
  - within a pulsar core + 6, or within 10 px of its live ring or echo,
  - or `isSolidAt`.

**Time bubbles**
- `spawnBubble(w, x, y, { kind, r, ttl?, vx?, vy? = scrollSpeed })`: at most 8. The timeline `bubble` default y is `-r`.
- `bubbleTimeScale(w, x, y)` is the product over containing bubbles (the `timeScaleAt` hook). `bubbleScale(b)`, `flipIsSlow(t)`, `flipFlickering(t)`, `bubbles(w)` and `removeBubble`.
- Flip bubbles start slow and switch every 3 s. Each switch is preceded by a 0.6 s flicker that alternates the looks, while the rate stays the old one until the switch.
- **Bullet time (T36):** enemy shots move at `bubble × w.enemyBulletTimeScale`, inside or outside a bubble. A unit test covers the two together.

**Misc:** `updateHazardsII`, which the obstacles system runs after rocks. `clearHazardsII(w)` and `registerHazardIIHooks()`, which tests call again after `clearHooks()`.

### Decisions
- **Draw layering:** the flare light (amber tint, top whitening, shimmer, blow-out) and the shadow strips are drawn first inside the anomaly layer (z 10). Every sprite, including the casting rocks, enemy bullets and the ship, stays crisp on top of the blow-out.
  - This needs no new GameScene layer.
  - Slabs draw at the end of the asteroid layer. Bubbles, portals and slow-bubble ghost pixels draw in the anomaly layer.
  - Dither uses 2×2 `CanvasPattern`s built once per context. Each strip is one `fillRect`, and nothing loops per pixel.
- **What the burn hits:**
  - The ship gets one hit per flare. The burn tries every tick until `damagePlayer` succeeds, so being invulnerable at burn start isn't a free pass if the ship is still in the light afterward.
  - Enemies and pods are each burned once per flare (an id set), the first tick they're in the light during the burn, and only while on screen.
  - The fizzle check uses the current strip positions. It ignores strip drift during the warn.
- **Pods:** a pod at 1 HP is lost by mirroring `losePod` (sfx `enemy_die_s` and the "POD LOST"/"CACHE LOST" toast) instead of importing pickups. Importing pickups from obstacles could reorder shot-blocker registration. See Follow-ups.
- **Time:** `flares.until` is compared with `w.time`, which equals level time until the boss freezes the director clock. Importing `directorTime` would have made an obstacles ↔ director import cycle.
- **Log:** fizzles go to the obstacles module's own `hazardLog(w)`, not the director log, for the same cycle reason.
- **Slab vs ship:** the ship isn't blocked by slabs. Slabs are in the solid query, so when T34 composes its terrain push the ship will be pushed out of slabs like walls.
- **Sandbox keys:**
  - `F` flare now (a toast says whether it fizzles).
  - `Shift+F` slab at the cursor.
  - `[` portal pair: A at the cursor, B mirrored 120 px higher, colors cycling.
  - `Shift+[` swaps the first two pairs.
  - `]` bubble (r 52) of the current kind at the cursor. `Shift+]` cycles the kind.
  - `X` also clears all of these.
  - Keys match on `KeyboardEvent.code`.
- **Gallery:** the new "Hazards II" section (`tools/sections/hazards2.ts`) has three live panels on the T37 backgrounds:
  - corona: repeating flares over slabs and large rocks.
  - junction: two pairs swapping every 4 s, a dim closed lime pair, and shot streams.
  - rift: slow, fast and flip bubbles with ghosting enemy fire.
- **Allocation:** every table is preallocated per world on first use: slabs 12, casters 16, pairs 4, bubbles 8, a 2048-slot cooldown hash, opt-ins 16, flashes 8, a 256-id burn set. Worlds that never use a hazard skip it entirely (`peekHz`). The only per-event allocation is one log string per flare start.
- **Bot numbers** (`tests/sim/hazardsII.bots.test.ts`, typical skill, hits from that hazard's cause, aware vs blind):
  - Flares (60 s × 3 seeds): **0 vs 22**.
  - Portal whose exit is ringed by hulls (40 s × 3): **0 vs 16**.
  - Fast and slow bubbles with aimed fire (40 s × 8): **2 vs 27**.
  - Correct shot prediction alone made things worse: a 1.8× shot jumps over the look-ahead samples. The bubble model also sweeps each scaled shot back over one sample interval.
- **Act I hashes** are identical to the WAVE8 baseline (17a78586, 66a3e907, 432d4c06, 1c9e54f6, f3426d8c, 0b41ee42, 8b2a6879). They were rechecked after merging main (T36, T37).
- I edited one file outside Owns: `src/game/director/levelFramework.test.ts`. Its "unregistered kind" test used `bubble`, which is now registered. The test now unregisters `bubble` first.

### Shared changes needed
1. **Enemies (behavior timers and movement in bubbles).** In `src/game/enemies/enemySystem.ts` `updateEnemies`:
   ```ts
   updateEnemy(w, e, def, dt * timeScaleAt(w, e.x, e.y)); // import { timeScaleAt } from '../../sim/hooks'
   ```
2. **Pickups and pods in bubbles.** In `src/game/pickups/pickupSystem.ts`, change the integrate step to:
   ```ts
   const kdt = dt * timeScaleAt(w, k.x, k.y); k.x += k.vx * kdt; k.y += k.vy * kdt;
   ```
3. **Harness hit causes.** In `tests/sim/harness.ts` `hitCause`:
   ```ts
   const h2 = hazardsIIHitCause(w); if (h2 !== null) return h2; // from './bots'
   ```
   This adds the `flare`, `portal` and `bubble-shot` causes.
4. **T34:** compose `slabSolidQuery` into the terrain `SolidQuery`, OR-ing `isSolidAt` and taking the nearest `raycastSolid` hit. Your registration replaces mine, because your module imports obstacles and so loads later.

## Follow-ups
- Export `losePod` (or a `damagePod(w, pod, n)`) from `game/pickups` so `burnPod` can stop duplicating it.
- Bosses aren't time-scaled (the boss system has its own update). If chrono's Echo should feel bubbles, the boss module needs the same one-line `dt` scale.
- T38 (corona):
  - Sunskimmers call `setFlareImmune('co_sunskimmer')` and read `isFlareBurning` for their ×1.5 speed.
  - Shades use `nearestShadeSpot`.
  - Lens Drones key off `flarePhase`.
  - The Heliostat registers its hull with `registerShadeCaster`.
- T40 (junction): Blinkers call `portalOptIn(w, id)`. Gate Pylons call `setPortalEnd` each tick and `collapsePortalPair` on death.
