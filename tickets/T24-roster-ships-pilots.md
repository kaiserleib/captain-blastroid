# T24 — Campaign roster: 4 ships, 3 pilots, 2 hangar upgrades, select screens that scale
Status: done
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
- [x] All new ships and portraits appear in the gallery and look on-model (screenshots described in Notes).
- [x] With `?save=all` every ship is buildable or built and every pilot selectable. Each new ship flies (`?level=1`) with the right stats and starting weapons.
- [x] Pilot and Ship select are usable with 7 entries at h=400 and h=520 by touch, mouse and keys.
- [x] build / test / lint pass.

## Contract changes
- `UpgradeDef` (content, additive in spirit): `stat` is now optional (absent for non-stat upgrades); new optional `startWeaponLevel?: number` and `requires?: string`. Only `meta/upgrades.ts` reads `stat`, and it skips upgrades without one.
- `meta/upgrades.ts`: new exports `missingRequirement(save, id)` and `startWeaponBonus(save)`. `canBuyUpgrade` now refuses while `requires` isn't maxed.
- `computePlayerStats(...).startingWeapons` now carries the Munitions Cache bonus (first weapon +1, capped at the weapon's level count). `initPlayer` already reads it, so no game change was needed.
- `NamedPilotId` gains `sable | pip | vale`.
- `gfx/palette.ts` (shared, append-only): new ramps `WARDEN`, `TEAL`, `CORSAIR`, `GILT`, `HALCYON`, `SKY`, `PARAGON`, all added to `RAMPS`. The trim ramp is `GILT`, not `GOLD`, to avoid clashing with `ui`'s `GOLD` text color.

## Notes
- **Ships** (`ships.sprites.ts`): `defineShip` takes an optional palette, and `shipPalette(hull, trim)` swaps the hull (k d b l h) and trim (n c s u) keys. Canopy and flame stay shared. All four use the existing `symmetric`/`bank`/`withFlames` helpers, so each has 6 flame frames plus bank-left/right frames.
  - Warden: a broad pale-teal hull with two forward gun booms (a fork from above), teal trim, twin engines.
  - Corsair: crimson with **forward-swept** wings and gold leading edges. It's the only forward-swept silhouette in the hangar.
  - Halcyon: a pearl-white lancer with a long needle nose, canards, short rear wings with tip pods, and sky trim. It's deliberately the slimmest ship.
  - Paragon: a flagship-blue double delta with gold leading edges and twin gold tail fins.
  - I checked them at 5× against navy, ion-teal, violet, pulsar-pink and near-black plates (a scratch render of the registered sprite pixels), then in the gallery's sprite listing and in flight (`flow.launch` with each ship on Kessler; no console errors). Warden reads slightly softer on the ion-teal plate, but its dark outline keeps it legible.
- **Portraits** (`named.ts`): seeds only move background details, and the overrides pin everything else. I compared head shapes, mouths, visor tints, uniforms and shoulder pads in a contact sheet next to the existing four.
  - Sable (`SABLEOKR`): deep skin, red (`helmetColor: 'uniform'` + crimson) visor-up helmet with a smoke visor, a scar across the eye, and a smirk. The undercut is set, but the helmet covers it, as on every helmeted pilot.
  - Pip (`PIPTANKA`): a young man with lime crop hair, headset, freckles, an open-mouthed grin, a teal bomber jacket and a porthole background. I made him male so he doesn't read as a second Juno (who already has young + headset + freckles + neon hair).
  - Vale (`CMDRVALE`): an older woman with gray tied-back hair, no headgear, a long nose and a grim mouth. She wears a gunmetal flight suit with shoulder boards (`shoulderPads`) and a gold star patch, on a rust hangar wall. The generator has no dedicated officer collar, so the standing flight-suit collar plus the epaulettes and gold insignia stand in for it. Female keeps the roster at 3/7 women.
- **Pilot Select:** a large 2× portrait card (name, SELECTED, passive, bio) for the focused pilot. Below it, a strip of 4 thumbnails at 1×, with ←/→ page buttons and paging dots under the strip, and DONE.
  - Left/right on the strip walks the whole roster and turns pages at the edges. Tapping a thumbnail selects that pilot (if rescued).
  - Locked pilots show a silhouette, and the card shows "RESCUE:" plus the sector name from `LEVELS[levelId].name`. It shows `???` until T21 registers that level (`getLevel` would fall back to Kessler, so I don't use it).
- **Ship Select:** a card with a 2× bay, stats and starting weapons (now with `L1`/`L2`), a 4-up thumbnail strip (full color when built, blue tint for a schematic, dark silhouette when unknown), page buttons with dots, then ACTION and DONE.
  - Left/right walks the hangar from anywhere except the page arrows, as the old carousel did. Tapping a thumbnail shows that ship, and tapping the shown one again acts as ACTION.
  - Unknown ships read "SCHEMATIC: <first LEVEL_ORDER sector whose schematicOnClear lists it>", or `SCHEMATIC: ???` until T21 lands.
- **Shared strip helpers** live in a new `src/scenes/rosterStrip.ts`: paging, dots, arrow buttons, focus corners and sector-name lookups.
- **Upgrades:** both new upgrades are in `UPGRADE_ORDER`. Six rows fit at h=400. Hull Lattice shows "REQUIRES REINFORCED PLATING" in red, with a dimmed cost, until Plating is maxed.
- **Browser checks** (port 5124, `?mute`):
  - `?save=mid&h=400`: locked pilots, unknown ships, the Upgrades requirement line.
  - `?save=all&h=520`: mouse paging, thumbnail select, keyboard walking.
  - In runs: Warden + Vale flew with 7 shields and Blaster L2 + Seeker. Paragon flew with 5 slots, Blaster L3 (with Munitions) and Orbit Drones.
- **Tests:**
  - `src/content/roster.test.ts`: content integrity. The "rescue level in LEVEL_ORDER" case is `runIf(LEVEL_ORDER.length >= 5)`, so it switches on once T21 merges. Until then, an always-on case checks the WAVE5 level ids.
  - `src/meta/upgrades.test.ts`: the requirement rule, Munitions (bonus, cap, no mutation of the ship def), negative mods, and Vale's −10% banked salvage.
  - `src/portraits/generator.test.ts`: the pinned-pixels uniqueness check now uses the roster size instead of a hard-coded 4, plus signature-trait checks for the three new pilots.

## Shared changes needed
- `debugSaves.ts` (T22): nothing required. `?save=all` already derives ships, pilots and upgrades from the `*_ORDER` lists, so it includes the new entries (Hull Lattice and Munitions at level 1 = max).
- `gfx/palette.ts`: my append to `RAMPS` may conflict textually with other wave-5 ramp additions. Keep both sides.

## Follow-ups
- Once T21 merges, check that "RESCUE: EVENT HORIZON" etc. fit the 2-line slot on the pilot card, and that the ship status line fits at 240 px. Both wrap or centre, but they're worth a look.
- T31 balance: confirm Paragon (1200) and the Munitions + Corsair/Paragon combinations (Blaster L3 at start) aren't too strong.
