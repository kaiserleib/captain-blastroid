# T08 — Player ship: movement, shields, invulnerability, death, ship sprites
Status: done (real trackpad/phone feel check pending, see Notes)
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
- [x] Banking frames and engine animation visible. Three ship sprites in the gallery, distinct silhouettes.
- [x] Unit tests: clamping, mouse-arrive math, accel curve, stats from save applied.
- [x] Death sequence leads to `runOver` after 2 s.

## Out of scope
Weapons firing (T09), HUD shield display (T14).

## Contract changes
- New `src/content/player.ts` (`PLAYER_TUNING`), re-exported from `src/content/index.ts`.
- `kestrel`, `kestrel_bank_l/_r` (gfx/reference.sprites.ts) gained frames 3–5 (long climb flame) and an explicit anchor `{x:12, y:12}` so the taller cell doesn't move the pivot. Frames 0–2 are unchanged.
- No changes to `sim/types.ts`, `sim/world.ts`, `engine/events.ts` or `gfx/renderer.ts`.

## Notes
- API (`src/game/player/index.ts`): `initPlayer(world, loadout)`, `playerSystem`, `playerLayer` (`player`, z 60), `warmPlayerSprites(shipId)`, `installPlayerSandbox()`, `getPlayerRuntime(world)`, `isGodMode/setGodMode/toggleGodMode`, `blinkVisible`.
- `GameScene.enter` resolves ship/pilot as `data.shipId ?? save.selectedShip` (same for the pilot), passes them to `createWorld`, then calls `initPlayer(w, computePlayerStats(getSave(), …))`.
- The game never imported `gfx/reference.sprites.ts`, so the player index imports it. Otherwise the Kestrel would be missing in-game.
- Sprite convention for every ship: frames 0–2 cruise flame, 3–5 climb flame, plus `<id>_bank_l/_r`. Bulwark and Dart bank frames come from the level hull (low wing foreshortened by a column and shaded down, high wing lit).
- Mouse arrival: commanded speed is `min(speed, d × 12)`, which is first-order and so can't overshoot. It snaps once the ship is within 0.25 px. Verified in Chrome: with the cursor resting, 60 ticks gave a single position and zero velocity.
- Death: T03's `damagePlayer` already emits the big `shake` (6, 0.5) and `haptic heavy`, and T13 draws the explosion and shield ring from `playerDied`/`playerHit`. T08 adds `sfx player_die`, `hitstop 0.12` and `runOver{victory:false}` 120 ticks later. `sfx player_hit` fires only on non-lethal hits.
- Sandbox `G` pins `invulnT` to 0.05 each tick so `damagePlayer` no-ops, and the blink is suppressed while god mode is on.
- Not verified: real trackpad and a real phone. Keys, mouse and the touch stick were checked with synthetic events in Chrome.

