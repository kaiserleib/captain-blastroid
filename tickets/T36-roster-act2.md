# T36 — Act II roster: 5 ships, 5 pilots, new passives, ship history
Status: todo
Wave: 8 · Depends on: T31 + the wave-8 contracts commit · Blocks: T38–T43

## Goal
Add the Shrike, Ferret, Wraith, Revenant and Nova, and the pilots Ines Solano, Rook Mbeki, Nyx Calder, Dr. Imre Halász and Wren Ashgrove, with their passives, sprites and portraits. Also add the ship-position history that the Echo boss reads.

## Owns
- `src/content/ships.ts`, `src/content/pilots.ts`
- Ship sprites and pilot portrait overrides
- `src/game/player/**`, **except** the damage function's last-shield guard (T32)
- `src/meta/progression.ts` → `computePlayerStats` (your own function)
- `src/scenes/ShipSelectScene.ts`, `src/scenes/PilotSelectScene.ts`, `src/scenes/rosterStrip.ts` (only to fit 12 ships and 12 pilots)

## Read first
`docs/design.md` → **"New ships"** and **"New pilots"** (Act II), `docs/art-direction.md` (ship and portrait rules), `tickets/WAVE8-NOTES.md`, and T24's Notes.

## Requirements
1. **Ships:** the stats and starting weapons from the design. The Nova has 6 slots. Sprites follow the Kestrel rules (24×24, 2–3 frame engine flame, bank frames), with the silhouettes described in the design. The Nova must read as the hero ship.
2. **Pilots and passives:**
   - **Ines, solar cells:** a clock reset on every hit. At 25 s, +1 shield (up to max), with a gold flash and a toast-free sparkle.
   - **Rook:** +50% damage to asteroids and gate/crumbly tiles (exposed as a stat T34 reads: `stats.rockDmgMul`), and +1 salvage per asteroid.
   - **Nyx:** +25% on uncommon and rare drop chances, as a `stats.rareDropMul` that the drop tables read. This is one read site; coordinate in Notes if it's in T35's area.
   - **Dr. Halász, bullet time:** on a hit, set `world.enemyBulletTimeScale = 0.5` for 2 s, then restore it. Show a subtle blue vignette.
   - **Wren:** +1 slot (max 6) and −1 max shield (minimum 1).
3. **Rescue levels:** ines → corona, rook → warrens, nyx → junction, halasz → chrono, wren → foundry. Schematics are set per level by T32's stubs.
4. **Portraits:** the existing generator with fixed seeds plus the design's trait notes. Add generator traits only if one is missing, such as a headlamp helmet or round glasses, and keep each addition small.
5. **Ship history:** a preallocated ring buffer (10 s at the fixed step) of the ship's x and y, written every tick. `playerPastPos(w, secondsAgo, out)` is exported from `game/player`. Pure and tested.
6. **Select screens:** 12 ships and 12 pilots fit and scroll or page cleanly on 240×400. Locked entries show how to unlock them ("SECTOR 7 POD").
7. **Tests:** each passive (stat composition, the regen clock, bullet time on and off, slot cap at 6, min shield 1) and the history buffer (wrap, interpolation, clamping before 10 s).

## Acceptance criteria
- [ ] Every ship and portrait appears in the gallery. Each new ship flies in the sandbox with its starting loadout.
- [ ] Wren on a Nova shows 6 slots (capped), not 7.
- [ ] Act I is unchanged with Act I ships and pilots: event-log hashes identical.
- [ ] build / test / lint / test:sim pass.

## Contract changes
