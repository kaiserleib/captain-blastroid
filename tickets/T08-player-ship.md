# T08 — Player ship: movement, shields, invulnerability, death, ship sprites
Status: todo
Wave: 2 · Depends on: T01, T02, T03 (T05 for stats; stub if not merged) · Blocks: T18

## Goal
The ship feels great to fly with every input method. It takes hits readably, blinks while invulnerable, banks when strafing, and explodes satisfyingly on death.

## Owns
`src/game/player/**` (playerSystem.ts, playerDraw.ts, sprites.ts, index.ts, tests). The `player` System and DrawLayer (z 60) registrations. Sprites for `kestrel` (refine T02's reference if needed), `bulwark` and `dart`.

## Read first
`docs/design.md` → Controls, Death and damage, Ships. `docs/art-direction.md` → Sprite sizes. T01's `MoveIntent` semantics.

## Requirements
1. `initPlayer(world, shipId, pilotId, save)` uses `meta.computePlayerStats` to set shield/maxShield/speed/slots/pickupRadius/stats and the starting weapons (`WeaponInstance` list, which T09 consumes). Spawn at (120, 340).
2. **Movement:**
   - Key/stick intent: `v = intent * speed`. A short acceleration (reach full speed in ~60 ms, stop in ~40 ms) for weight without mush.
   - Mouse target: steer toward `(targetX, targetY)` at max speed. Within 8 px, approach proportionally (`v = d * 12/s`, capped) so it settles without jitter. Apply a configurable vertical **offset of −0 px** (keep the option for touch-relative modes later).
   - Clamp to the playfield with an 8 px margin.
3. **Banking:** horizontal velocity beyond 40% of speed picks the bank-left/right frames. Engine flame animates at 12 fps and is longer when moving up.
4. **Hitbox:** r=4 (shmup convention). Under `?debug`, draw the hitbox as a 1 px white dot ring.
5. **Hit:** `damagePlayer` (T03) handles numbers. This system reacts to `playerHit`: blink at 15 Hz during `invulnT`, a brief white flash frame, and a shield-break ring effect (emit, FX in T13). Emit `sfx player_hit`.
6. **Death:** on `playerDied`, hide the ship, emit a big `shake`, `hitstop 0.12`, `sfx player_die` and a large explosion request. Input is ignored. After 2.0 s, emit `runOver{victory:false}` so GameScene can go to Results.
7. `?god` ignores death.

## Acceptance criteria
- [ ] Flying in the sandbox with keys, mouse, trackpad and phone stick all feels responsive and precise. No jitter when the mouse is stationary over the ship.
- [ ] Banking frames and engine animation visible. Three ship sprites in the gallery, distinct silhouettes.
- [ ] Unit tests: clamping, mouse-arrive math, accel curve, stats from save applied.
- [ ] Death sequence leads to `runOver` after 2 s.

## Out of scope
Weapons firing (T09), HUD shield display (T14).

## Contract changes
