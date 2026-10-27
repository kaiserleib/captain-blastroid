# T40 — Level 8: Wormhole Junction + Janus
Status: todo
Wave: 9 · Depends on: T32, T33, T35, T36, T37 · Blocks: T43

## Goal
Replace the `junction` stub with the full sector: portal pairs that teleport shots, rocks, pods and the ship, and an enemy roster that teaches shooting through them. Everything is specified in `docs/design.md` → **Level 8: "Wormhole Junction"**, tuned to the sector's place in the Act II difficulty curve.

## Owns
- `src/content/levels/junction/**`: the `LevelDef` (timeline, asteroid field, all tunables) plus the enemy and boss tables
- `src/game/levels/junction/**`: custom behaviors, the boss controller and its draw, sprites, level scripts and systems, sandbox keys, tests
- `tests/sim/**`: only new files named `junction.*.test.ts`

Nothing else. Everything plugs in through the T21 registries, the wave-8 APIs (T33 portals, T35 weapons) and `registerTimelineAction`. If you need a shared change, describe it under "Shared changes needed" in Notes with a minimal patch and work around it locally.

## Read first
`CLAUDE.md`, `docs/design.md` → "Campaign: Act II" (especially **Level 8: "Wormhole Junction"** and "Act II difficulty curve"), `docs/art-direction.md`, `tickets/WAVE9-NOTES.md` (the wave-8 APIs as merged), and the Notes of T32, T33, T35, T36 and T37. Use T27–T30 as the reference for quality and for how a sector folder is laid out.

## Requirements
- **Enemies:** **Blinker** (`portalOptIn`, a 0.5 s exit flash before its burst), **Gate Pylon** (carries a pair end with `setPortalEnd`, collapses its pair on death), **Aegis** (a front shield that absorbs shots arriving from below its centerline; shots from portals above, side-angled Ricochet discs, Seekers, Arc Coil and drones get through). Numbers from the design.
- **Teaching beat at 25 s:** the first Aegis with its portal pair placed so that shooting into the low ring lands shots on its back. Assert in a test that a straight-up stream into the ring damages it.
- **Pod (Nyx):** comes out of a portal mid-screen and is carried through rings it drifts into.
- **Boss: Janus** (`wj_janus`, about 128×64): the portal wall, two faces hittable only through the rings, ring generators holding the exits, phase 2's drifting rings and 6 s swaps, Blinker spawns, and the silent wall-flicker assist (40 s without a face hit, then 3 s off every 10 s).
- **Timeline:** follow the design table, including the Flak field test, the carrier, breathers, the magnet, the junction rush and the vertically stacked feedback loop.
- **Art:** every new enemy and boss part has sprites at the art-direction sizes: 15-bit palette, outline, 2-frame animation where it fits, hit flash from the sprite cache. They appear in `tools/gallery.html`. Enemy bullets use only the standard enemy-bullet sprites.
- **Sandbox:** keys from WAVE9-NOTES to spawn each new enemy and the boss under `?sandbox`.
- **Fairness:** the T11 rules (no shots in the first 0.5 s alive; aimed shots only from ≥ 24 px above the ship) apply to every new attacker, and every telegraphed attack is telegraphed for ≥ 0.5 s.
- **Tests:** unit tests for each custom behavior's state machine and the boss phase transitions. The harness's god playthrough, determinism and pool safety must pass for `junction`. Add a `tests/sim/junction.sector.test.ts` god run that asserts the sector's signature beats (listed above) actually happen.

## Balance targets
With `SAVE=act1`: typical-bot clear ≈ **70%**, novice ≥ 12%, boss time 50–90 s for the typical bot, salvage on a clear 640–850.
Measure with `LEVEL=junction SAVE=act1 RUNS=50 SKILLS=novice,typical,expert npm run balance` and record a balance table in Notes, like T27's. If a number is off only because a bot is blind to something, show the evidence (hits by cause) and tune for a human.

## Acceptance criteria
- [ ] `?level=8&save=act1` plays the full timeline to the boss's defeat, results, and the right schematic, pod, and the Flak unlock.
- [ ] God playthrough (every seed), determinism and pool safety pass for `junction`.
- [ ] Balance targets met or the gap explained.
- [ ] Browser check on your own port with `?mute`: each new enemy, each hazard beat and each boss phase is described in Notes, with no console errors.
- [ ] build / test / lint / test:sim / e2e pass.

## Contract changes
None expected.
