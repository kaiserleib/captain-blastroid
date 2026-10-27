# T41 — Level 9: Chrono Rift + Echo
Status: todo
Wave: 9 · Depends on: T32, T33, T35, T36, T37 · Blocks: T43

## Goal
Replace the `chrono` stub with the full sector: slow, fast and flip time bubbles, and Echo, a boss that flies the ship's own path and fires its loadout. Everything is specified in `docs/design.md` → **Level 9: "Chrono Rift"**, tuned to the sector's place in the Act II difficulty curve.

## Owns
- `src/content/levels/chrono/**`: the `LevelDef` (timeline, asteroid field, all tunables) plus the enemy and boss tables
- `src/game/levels/chrono/**`: custom behaviors, the boss controller and its draw, sprites, level scripts and systems, sandbox keys, tests
- `tests/sim/**`: only new files named `chrono.*.test.ts`

Nothing else. Everything plugs in through the T21 registries, the wave-8 APIs (T33 time bubbles, T36 `playerPastPos`, T35 weapons) and `registerTimelineAction`. If you need a shared change, describe it under "Shared changes needed" in Notes with a minimal patch and work around it locally.

## Read first
`CLAUDE.md`, `docs/design.md` → "Campaign: Act II" (especially **Level 9: "Chrono Rift"** and "Act II difficulty curve"), `docs/art-direction.md`, `tickets/WAVE9-NOTES.md` (the wave-8 APIs as merged), and the Notes of T32, T33, T35, T36 and T37. Use T27–T30 as the reference for quality and for how a sector folder is laid out.

## Requirements
- **Enemies:** **Stutterer** (burst and freeze, a cross ring every second freeze), **Rewinder** (records 2 s in a preallocated buffer, a one-time rewind with a 1.0 s backward-clock telegraph), **Bubble Mine** (pops into a 6 s slow bubble). Behavior timers must respect the scaled `dt` inside bubbles.
- **Pod (Dr. Halász):** an uncollectable echo pod at 100 s on the exact path of the real pod 6 s later (same seed-driven path, so record the first path and replay it).
- **Boss: Echo** (`cr_echo`, 48×48 palette-swapped mirror of the player's current ship sprite):
  - Movement from `playerPastPos` with the design's y mapping. The weapon-to-pattern table with its caps, using up to 3 weapons.
  - Phase 2 is the Ghost Echo part at a 4 s delay. Phase 3 is PARADOX: a `flip` bubble and slow bubbles on past positions.
  - Test that the Echo's pattern set changes with the loadout, including all eight weapons.
- **Timeline:** follow the design table, including the Spread supply run, the carrier, breathers, the magnet and the time storm.
- **Art:** every new enemy and boss part has sprites at the art-direction sizes: 15-bit palette, outline, 2-frame animation where it fits, hit flash from the sprite cache. They appear in `tools/gallery.html`. Enemy bullets use only the standard enemy-bullet sprites.
- **Sandbox:** keys from WAVE9-NOTES to spawn each new enemy and the boss under `?sandbox`.
- **Fairness:** the T11 rules (no shots in the first 0.5 s alive; aimed shots only from ≥ 24 px above the ship) apply to every new attacker, and every telegraphed attack is telegraphed for ≥ 0.5 s.
- **Tests:** unit tests for each custom behavior's state machine and the boss phase transitions. The harness's god playthrough, determinism and pool safety must pass for `chrono`. Add a `tests/sim/chrono.sector.test.ts` god run that asserts the sector's signature beats (listed above) actually happen.

## Balance targets
With `SAVE=act1`: typical-bot clear ≈ **68%**, novice ≥ 10%, boss time 50–90 s for the typical bot. Report the Echo's fight time and hit rate by player weapon count (1–5) too: more weapons must not make the fight net harder for the typical bot, salvage on a clear 680–900.
Measure with `LEVEL=chrono SAVE=act1 RUNS=50 SKILLS=novice,typical,expert npm run balance` and record a balance table in Notes, like T27's. If a number is off only because a bot is blind to something, show the evidence (hits by cause) and tune for a human.

## Acceptance criteria
- [ ] `?level=9&save=act1` plays the full timeline to the boss's defeat, results, and the right schematic, pod.
- [ ] God playthrough (every seed), determinism and pool safety pass for `chrono`.
- [ ] Balance targets met or the gap explained.
- [ ] Browser check on your own port with `?mute`: each new enemy, each hazard beat and each boss phase is described in Notes, with no console errors.
- [ ] build / test / lint / test:sim / e2e pass.

## Contract changes
None expected.
