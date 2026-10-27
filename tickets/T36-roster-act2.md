# T36 — Act II roster: 5 ships, 5 pilots, new passives, ship history
Status: done
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
- [x] Every ship and portrait appears in the gallery. Each new ship flies in the sandbox with its starting loadout.
- [x] Wren on a Nova shows 6 slots (capped), not 7.
- [x] Act I is unchanged with Act I ships and pilots: event-log hashes identical.
- [x] build / test / lint / test:sim pass.

## Contract changes
- **`PlayerStats` (`src/sim/types.ts`) + `createPlayerStats` (`src/sim/world.ts`), additive:** `rockDmgMul` (1), `rareDropMul` (1), `extraSlots` (0), `rockSalvage` (0). The defaults are neutral, so Act I hashes don't move.
- **`applyStatMods` (`src/meta/upgrades.ts`):** keys ending in `Mul` multiply and every other key adds. Before, only `extraShield` added. Behavior is the same for every existing mod.
- **`PilotDef.ability?: 'solarCells' | 'bulletTime'`** and `PILOT_ABILITY_TUNING` in `content/pilots.ts`. **`MAX_WEAPON_SLOTS = 6`** and `MIN_MAX_SHIELD = 1` in `content/ships.ts`.
- **`PlayerLoadout`:** `weaponSlots` is now `min(6, ship + extraSlots)`, and `maxShield` is `max(1, ship + extraShield)`.
- **`game/player` exports** `playerPastPos(w, secondsAgo, out)` and `HISTORY_SECONDS`. The pure ring lives in `game/player/history.ts`.
- **`rollDrop(table, rng, filter?, rareMul = 1)`:** a new optional last argument.

## Notes
- **Ships** (`ships.sprites.ts`, with new ramps appended to `gfx/palette.ts`: SHRIKE, FERRET, ARMOR, WRAITH, PORTAL, REVENANT, SILVER, NOVA, CREST). All five use the T24 helpers (`symmetric`/`bank`/`withFlames`, so 6 flame frames plus bank-left/right).
  - Shrike: warm white, needle wings swept hard forward with gold leading edges, a gold-banded "coil" fin down the spine, and one engine. Corsair is also forward-swept, but Shrike's wings are thin blades and it has the coil spine.
  - Ferret: a stubby ochre hull with a gunmetal fluted drill-bit nose, armored cheek plates, and twin engines.
  - Wraith: the slimmest dark-green arrowhead, with a needle nose and portal-orange engine glows.
  - Revenant: a bulky violet hull inside a silver ring (the drone housing).
  - Nova: a white hull, broad wings with hero-red stripes, a gold nose chevron and gold crest canards. The crest uses extra palette keys `x z v j` (GILT), which the bank shading maps also know.
  - I checked them at 5× on navy, near-black and rust plates (a scratch render of the registered pixels), then in the Ship Select bay and in flight: Nova + Wren under `?save=all`, port 5136, with no console errors.
- **Portraits** (`named.ts`) use fixed seeds plus overrides. Small generator additions, never rolled, so random portraits and the existing pinned pixels are unchanged:
  - **Traits:** hair `wild`, headgear `minerHelmet` (hard hat with a lit headlamp), and helmet color `hazard`.
  - **Accessories** (`SPECIAL_ACCESSORIES`): `glasses`, `hairStreak`, `dust`, `burnScar` and `earpiece`.
  - **Suit and insignia:** suit `labCoat` (`SPECIAL_SUITS`) and insignia `torn` (`SPECIAL_INSIGNIA`).
  - **Pilots:**
    - Ines: tan skin, platinum crop, gold visor up on a sand helmet (not white, so she doesn't read as Blastroid).
    - Rook: deep skin, heavy head, yellow miner helmet, dust smudges, stubble.
    - Nyx: pale skin, black bob with a teal streak, an earpiece, and a purple standing-collar suit.
    - Halász: old, wild white hair, round glasses, and a lab coat over a teal flight suit.
    - Wren: brown skin, auburn buzz cut, a jaw burn scar, an orange jumpsuit and a torn-off patch.
  - Halász's display name is "Dr. Imre Halasz" with no accent, because the bitmap font is ASCII.
  - Women on the roster are now 6 of 12.
- **Passives:**
  - **Ines:** `stepSolarCells` runs in `updatePlayer`. The clock resets on every `playerHit`. At 25 s below max it adds +1 shield, plays the `shield_up` sfx and shows a gold ring with glints in the player layer (no toast). At full shield the clock holds at 25 s, so a missing shield refills at once. That only matters if something drains shield without a hit.
  - **Halász:** on a non-lethal `playerHit` he sets `w.enemyBulletTimeScale = 0.5` for 2 s (a new hit refreshes it). The scale goes back to exactly 1 when the timer ends, on death, or on a re-`initPlayer`. The vignette is a dithered cobalt/sky frame around the playfield in the player layer (z 60, above bullets). It thins out in the last 0.5 s.
  - **Rook and Nyx:** three tiny read sites outside my Owns, each exact at ×1:
    - `sim/collisionRules.playerShotVsAsteroid`: `shot.damage * stats.rockDmgMul`. T34 reads the same stat for crumbly and gate tiles.
    - `game/pickups/drops.ts`: `rollDrop` weights shield, upgrade, magnet and repulsor by `rareMul`, and `rollAndSpawn` passes `stats.rareDropMul`. T35 owns only the capsule-weapon pick in this file.
    - `onAsteroidDestroyed`: sprays `stats.rockSalvage` after the table roll. It's skipped at 0, so other pilots' rng streams are untouched.
  - **Wren:** `extraSlots: 1, extraShield: -1`. `computePlayerStats` caps slots at 6 and floors shield at 1.
- **Ship history:** a `Float64Array` ring with room for 601 samples (10 s at `STEP` plus the current one), allocated once per `initPlayer`. It's written at the end of every `updatePlayer` tick (and while dead), plus once at spawn. `playerPastPos` interpolates linearly between ticks and clamps to the recorded span.
- **Select screens** already page generically (12 entries = 3 pages).
  - Pilot lock card: "RESCUE: / SECTOR N POD / <name>". Ship status for unknown ships: "SCHEMATIC: SECTOR N BOSS". The SLOTS row now draws 6 boxes.
  - Until T32 adds Act II to `LEVEL_ORDER` and its `schematicOnClear`, these read "SECTOR ? POD" and "SCHEMATIC: ???".
- **Act I hashes** with default saves are identical to WAVE8-NOTES: 17a78586, 66a3e907, 432d4c06, 1c9e54f6, f3426d8c, 0b41ee42, 8b2a6879.
- **Tests:**
  - `game/player/history.test.ts`: capacity, empty, interpolation, clamping, wrap, and `playerPastPos`.
  - `game/player/passives.test.ts`: the regen clock, bullet time on and off, Wren slot and shield, Rook damage and salvage, and Nyx weighting.
  - `meta/progression.test.ts`: stat composition, the slot cap and shield floor, and starting weapons.
  - `content/roster.test.ts`: the Act II table and one rescue per Act II sector.

## Shared changes needed
- `gfx/palette.ts`: the appended ramps may collide textually with other wave-8 `RAMPS` appends. Keep both sides.
- The small edits in `sim/types.ts`, `sim/world.ts`, `sim/collisionRules.ts`, `meta/upgrades.ts` and `game/pickups/drops.ts` are described above. Merge them alongside T34's and T35's changes to those files.
- **HUD (T32):** `widgets.ts` `MAX_SLOTS` is still 5, so a 6-slot loadout shows 5 boxes until the six-slot strip lands. It can import `MAX_WEAPON_SLOTS`.
- **T33:** bullet integrators must multiply in `w.enemyBulletTimeScale`. Until then bullet time only sets the field and draws the vignette.

## Follow-ups
- After T32 merges, check the "SECTOR N POD/BOSS" text on both select screens with real sector names.
- T43 balance: Nova + Wren, Revenant's three starting weapons, and Ines' regen on long boss fights.
- T41 (Echo): call `playerPastPos(w, secondsAgo, scratch)` with a preallocated scratch object. The history covers 10 s.
