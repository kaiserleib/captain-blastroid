# T42 — Level 10: The Foundry + The Architect + escape
Status: todo
Wave: 9 · Depends on: T32–T37 (all of wave 8) · Blocks: T43

## Goal
Replace the `foundry` stub with the finale: a remix of every mechanic, the three-form Architect, and the 40 s escape that ends the campaign. Everything is specified in `docs/design.md` → **Level 10: "The Foundry"**, tuned to the sector's place in the Act II difficulty curve.

## Owns
- `src/content/levels/foundry/**`: the `LevelDef` (timeline, asteroid field, all tunables) plus the enemy and boss tables
- `src/game/levels/foundry/**`: custom behaviors, the boss controller and its draw, sprites, level scripts and systems, sandbox keys, tests
- `tests/sim/**`: only new files named `foundry.*.test.ts`

Nothing else. Everything plugs in through the T21 registries, the wave-8 APIs (T33 flares, shade, portals and bubbles, T34 terrain, T35 weapons, T32 escape) and `registerTimelineAction`. If you need a shared change, describe it under "Shared changes needed" in Notes with a minimal patch and work around it locally.

## Read first
`CLAUDE.md`, `docs/design.md` → "Campaign: Act II" (especially **Level 10: "The Foundry"** and "Act II difficulty curve"), `docs/art-direction.md`, `tickets/WAVE9-NOTES.md` (the wave-8 APIs as merged), and the Notes of T32–T37. Use T27–T30 as the reference for quality and for how a sector folder is laid out.

## Requirements
- **Enemies:** **Riveter** (conveyor lines), **Crane** (tows and flings hull-scrap rocks with the T23 tow API), **Sentinel** (a rotating 120° front shield). The sector may spawn **Act I** enemies by id (Escort Fighter, Orbiter, Lancer, Streaker) through the timeline. It must not import any other sector's folder or spawn Act II sector enemies (they're built in parallel).
- **Remix beats:** the yard (tow), containment (a `massive` black hole in a slab ring), the welding line (`turning` pulsars phase-locked to `foundry`'s BPM during a 30 → 60 surge), the furnace (flares, slabs, the portal conveyor), assembly (Foundry terrain chunks with bubbles in the bends).
- **Pod (Wren):** carried by the portal conveyor at about 130 s.
- **Boss: The Architect** (`fd_architect`): three forms on one boss bar (Scaffold, Singularity Engine, Paradox Core) with the design's parts and HP. Set the stall-breaker threshold to 150 s with T32's per-boss override. Clean every hazard up between forms: collapse the hole, clear the portals and bubbles.
- **Escape:** `LevelDef.escape` (40 s, scroll 30 → 90 over 6 s, bonus 100 − 20/hit) with a level script that queues `escape`-tagged Foundry chunks (≥ 7-tile corridors) and debris rocks, with no enemies. Music `escape`. Victory and CAMPAIGN COMPLETE when the timer ends.
- **Timeline:** follow the design table, including the Lance supply run, the carrier, breathers and the magnet.
- **Art:** every new enemy and boss part has sprites at the art-direction sizes: 15-bit palette, outline, 2-frame animation where it fits, hit flash from the sprite cache. They appear in `tools/gallery.html`. Enemy bullets use only the standard enemy-bullet sprites.
- **Sandbox:** keys from WAVE9-NOTES to spawn each new enemy and the boss under `?sandbox`.
- **Fairness:** the T11 rules (no shots in the first 0.5 s alive; aimed shots only from ≥ 24 px above the ship) apply to every new attacker, and every telegraphed attack is telegraphed for ≥ 0.5 s.
- **Tests:** unit tests for each custom behavior's state machine and the boss phase transitions. The harness's god playthrough, determinism and pool safety must pass for `foundry`. Add a `tests/sim/foundry.sector.test.ts` god run that asserts the sector's signature beats (listed above) actually happen.

## Balance targets
With `SAVE=act1`: typical-bot clear ≈ **65%**, novice ≥ 8%, boss time 50–90 s for the typical bot (the Architect: 80–130 s across three forms), salvage on a clear 900–1200 (including the escape bonus).
Measure with `LEVEL=foundry SAVE=act1 RUNS=50 SKILLS=novice,typical,expert npm run balance` and record a balance table in Notes, like T27's. If a number is off only because a bot is blind to something, show the evidence (hits by cause) and tune for a human.

## Acceptance criteria
- [ ] `?level=10&save=act1` plays the full timeline to the boss's defeat, the escape, results, and the right schematic, pod, and CAMPAIGN COMPLETE on the first clear.
- [ ] God playthrough (every seed), determinism and pool safety pass for `foundry`.
- [ ] Balance targets met or the gap explained.
- [ ] Browser check on your own port with `?mute`: each new enemy, each hazard beat and each boss phase is described in Notes, with no console errors.
- [ ] build / test / lint / test:sim / e2e pass.

## Contract changes
None expected.
