# T38 — Level 6: Corona Drift + Heliostat
Status: todo
Wave: 9 · Depends on: T32, T33, T35, T36, T37 · Blocks: T43

## Goal
Replace the `corona` stub with the full sector from the design: cover from solar flares in shadows that the player's own guns wear away. Everything is specified in `docs/design.md` → **Level 6: "Corona Drift"**, tuned to the sector's place in the Act II difficulty curve.

## Owns
- `src/content/levels/corona/**`: the `LevelDef` (timeline, asteroid field, all tunables) plus the enemy and boss tables
- `src/game/levels/corona/**`: custom behaviors, the boss controller and its draw, sprites, level scripts and systems, sandbox keys, tests
- `tests/sim/**`: only new files named `corona.*.test.ts`

Nothing else. Everything plugs in through the T21 registries, the wave-8 APIs (T33 flares and shade, T35 weapons) and `registerTimelineAction`. If you need a shared change, describe it under "Shared changes needed" in Notes with a minimal patch and work around it locally.

## Read first
`CLAUDE.md`, `docs/design.md` → "Campaign: Act II" (especially **Level 6: "Corona Drift"** and "Act II difficulty curve"), `docs/art-direction.md`, `tickets/WAVE9-NOTES.md` (the wave-8 APIs as merged), and the Notes of T32, T33, T35, T36 and T37. Use T27–T30 as the reference for quality and for how a sector folder is laid out.

## Requirements
- **Enemies:** **Sunskimmer** (flare-immune, faster during a burn), **Shade** (finds and holds a shadow strip with `inShade` and the caster list), **Lens Drone** (during a burn: a 0.6 s telegraph line, then a 0.4 s bullet-line beam). Numbers from the design.
- **Flares:** the practice flare at 12 s, then cadences per the timeline. Before every flare, a placed large-rock band or a shade slab makes cover exist (the fizzle rule is the backstop, not the plan). Log how many flares fizzle per run in the balance notes; aim for ≈ 0 with typical play.
- **Pod (Ines):** 2 HP, drifting beside a shade slab. Flares and Shades can hurt it.
- **Boss: Heliostat** (`co_heliostat`, about 120×56): mirror arms with sweeping beams, slab drops before each flare, the hull registered as a shade caster, the Solar Furnace phase with the 6-arm spiral and 7 s flares.
- **Timeline:** follow the design table, including the Arc Coil field-test supply run, the carrier, breathers with shields, the magnet and the coronal-mass-ejection finale. Keep the design's `LevelDef` numbers unless balance requires otherwise; log any change.
- **Art:** every new enemy and boss part has sprites at the art-direction sizes: 15-bit palette, outline, 2-frame animation where it fits, hit flash from the sprite cache. They appear in `tools/gallery.html`. Enemy bullets use only the standard enemy-bullet sprites.
- **Sandbox:** keys from WAVE9-NOTES to spawn each new enemy and the boss under `?sandbox`.
- **Fairness:** the T11 rules (no shots in the first 0.5 s alive; aimed shots only from ≥ 24 px above the ship) apply to every new attacker, and every telegraphed attack is telegraphed for ≥ 0.5 s.
- **Tests:** unit tests for each custom behavior's state machine and the boss phase transitions. The harness's god playthrough, determinism and pool safety must pass for `corona`. Add a `tests/sim/corona.sector.test.ts` god run that asserts the sector's signature beats (listed above) actually happen.

## Balance targets
With `SAVE=act1`: typical-bot clear ≈ **75%**, novice ≥ 15%, boss time 50–90 s for the typical bot, salvage on a clear 560–750.
Measure with `LEVEL=corona SAVE=act1 RUNS=50 SKILLS=novice,typical,expert npm run balance` and record a balance table in Notes, like T27's. If a number is off only because a bot is blind to something, show the evidence (hits by cause) and tune for a human.

## Acceptance criteria
- [ ] `?level=6&save=act1` plays the full timeline to the boss's defeat, results, and the right schematic, pod, and the Arc Coil unlock.
- [ ] God playthrough (every seed), determinism and pool safety pass for `corona`.
- [ ] Balance targets met or the gap explained.
- [ ] Browser check on your own port with `?mute`: each new enemy, each hazard beat and each boss phase is described in Notes, with no console errors.
- [ ] build / test / lint / test:sim / e2e pass.

## Contract changes
None expected.
