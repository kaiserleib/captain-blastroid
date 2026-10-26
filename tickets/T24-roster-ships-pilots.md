# T24 — Campaign roster: 4 ships, 3 pilots, 2 hangar upgrades, select screens that scale
Status: todo
Wave: 5 · Depends on: T00–T20 · Blocks: T31

## Goal
Add the campaign's rewards as data plus art: Warden, Corsair, Halcyon and Paragon; Sable Okoro, Pip Tanaka and Commodore Vale; Hull Lattice and Munitions Cache. Rework Pilot and Ship select so 7 pilots and 7 ships fit a 240 px screen.

## Owns
- `src/content/ships.ts`, `pilots.ts`, `upgrades.ts`
- `src/game/player/ships.sprites.ts` (+ any player sprite/warm lists)
- `src/portraits/named.ts`
- `src/meta/upgrades.ts`, and `computePlayerStats` / `buyUpgrade` / `canBuyUpgrade` in `src/meta/progression.ts`. T22 also edits `bankRun` in that file; keep your edits to those functions.
- `src/scenes/PilotSelectScene.ts`, `ShipSelectScene.ts`, `UpgradesScene.ts`

## Read first
`docs/design.md` → "Rewards by sector", "New ships", "New pilots", "New hangar upgrades"; `docs/art-direction.md`; `tickets/WAVE5-NOTES.md`; the existing ship sprites (the `kestrel` sprite sets the quality bar); `src/portraits/**` (generator traits); `src/scenes/PilotSelectScene.ts`, `ShipSelectScene.ts`.

## Requirements
1. **Ships** (numbers from the design table): ids `warden`, `corsair`, `halcyon`, `paragon`, appended to `SHIP_ORDER`.
   - Unlock: `{ kind: 'schematic', schematicId: <same id>, cost }`.
   - Sprites at 24×24 with engine-flame frames and bank-left/right, following the art-direction rules (15-bit palette, top-left light, own ramps added to `RAMPS`).
   - Distinct silhouettes as described in the design. They must be readable against all five backgrounds.
   - They appear in `tools/gallery.html` (`*.sprites.ts` auto-listing).
2. **Pilots:** ids `sable`, `pip`, `vale`, appended to `PILOT_ORDER`.
   - Unlock by rescue on `eventHorizon`, `pulsarNursery` and `armada` respectively. `zzkar` stays on `ionShoals`.
   - Passives use the existing stat mods. Negative mods (−15% pickup radius, −10% salvage) must work. Check `applyStatMods` and add a test.
   - Portraits: a fixed seed plus overrides per the design. Iterate seeds in the gallery until each reads as the described character. **The user loves these portraits**, so take care, and keep the siege-and-shuffle style (that repo is read-only).
3. **Upgrades:**
   - `hullLattice`: +1 max shield, 1 level, cost 600, `requires: 'plating'`. Add `requires?: string` to `UpgradeDef`. `canBuyUpgrade` refuses until the required upgrade is maxed, and the Upgrades screen shows "REQUIRES REINFORCED PLATING".
   - `munitions`: 1 level, 450. The ship's first starting weapon starts one level higher. Implement this in `computePlayerStats`'s starting-weapons output (cap at the weapon's max level), and make sure `initPlayer` uses that output.
4. **Pilot Select** must fit 7 pilots at 240×400:
   - A paged or scrolling row of portraits: 4 visible, with left/right arrows and paging dots.
   - Locked pilots show a silhouette plus "RESCUE: <SECTOR NAME>" (from the pilot's `unlock.levelId` via `getLevel`).
   - Keep the large portrait and description for the focused pilot.
5. **Ship Select** must fit 7 ships the same way. Unknown ships (no schematic yet) show a silhouette and "SCHEMATIC: <SECTOR NAME>", where the sector is the first level whose `schematicOnClear` lists the ship. (T21 is adding these lists to the sector stubs; until it merges, fall back to "SCHEMATIC: ???".)
6. **Tests:** content integrity (every ship's starting weapons exist, every pilot's rescue level is in `LEVEL_ORDER`, costs > 0), the upgrade `requires` rule, the munitions starting level, negative mods. Update `debugSaves` ids only if needed: T22 owns `debugSaves.ts`, so note the needed change rather than editing it.

## Acceptance criteria
- [ ] All new ships and portraits appear in the gallery and look on-model (screenshots described in Notes).
- [ ] With `?save=all` every ship is buildable or built and every pilot selectable. Each new ship flies (`?level=1`) with the right stats and starting weapons.
- [ ] Pilot and Ship select are usable with 7 entries at h=400 and h=520 by touch, mouse and keys.
- [ ] build / test / lint pass.

## Contract changes
(fill in)
