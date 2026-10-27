# T39 — Level 7: The Warrens + Wyrm
Status: todo
Wave: 9 · Depends on: T32, T34, T35, T36, T37 · Blocks: T43

## Goal
Replace the `warrens` stub with the full sector: the game's first terrain level, with tunnels, gates, wall turrets, a fork and a burrowing worm boss. Everything is specified in `docs/design.md` → **Level 7: "The Warrens"**, tuned to the sector's place in the Act II difficulty curve.

## Owns
- `src/content/levels/warrens/**`: the `LevelDef` (timeline, asteroid field, all tunables) plus the enemy and boss tables
- `src/game/levels/warrens/**`: custom behaviors, the boss controller and its draw, sprites, level scripts and systems, sandbox keys, tests
- `tests/sim/**`: only new files named `warrens.*.test.ts`

Nothing else. Everything plugs in through the T21 registries, the wave-8 APIs (T34 terrain, T35 weapons) and `registerTimelineAction`. If you need a shared change, describe it under "Shared changes needed" in Notes with a minimal patch and work around it locally.

## Read first
`CLAUDE.md`, `docs/design.md` → "Campaign: Act II" (especially **Level 7: "The Warrens"** and "Act II difficulty curve"), `docs/art-direction.md`, `tickets/WAVE9-NOTES.md` (the wave-8 APIs as merged), and the Notes of T32, T34, T35, T36 and T37. Use T27–T30 as the reference for quality and for how a sector folder is laid out.

## Requirements
- **Chunks:** author the sector's terrain as chunks in `content/levels/warrens/` (cave mouth, wide tunnel, chamber, narrowing, gate rows, the fork, the pod alcove, S-bends, crumbly collapse, the Wyrm's den). They must pass T34's chunk validator.
- **Enemies:** **Wall Turret** (registered for `T` sockets), **Borer** (dust telegraph, crossing, `carveTiles`, a 4-shot ring on entering the far wall), **Cave Bat** (flocking with preallocated neighbor scratch, no per-bat arrays). Numbers from the design.
- **Pod (Rook):** in an alcove behind a gate on the left branch of the fork. Shooting the gate frees it.
- **Boss: Wyrm** (`wr_wyrm`): a head plus 8 segment parts following the head's path (a preallocated path buffer). It burrows, with a 0.8 s dust-trail exit telegraph; the head opens while surfacing; Frenzy at < 50% carves pillars. The scroll is 0 and the arena fixed for the whole fight.
- **Timeline:** follow the design table, including the Ricochet field test, a carrier chamber, breathers, the fork's upgrade core, the magnet, and the scroll changes in the S-bends.
- **Art:** every new enemy and boss part has sprites at the art-direction sizes: 15-bit palette, outline, 2-frame animation where it fits, hit flash from the sprite cache. They appear in `tools/gallery.html`. Enemy bullets use only the standard enemy-bullet sprites.
- **Sandbox:** keys from WAVE9-NOTES to spawn each new enemy and the boss under `?sandbox`.
- **Fairness:** the T11 rules (no shots in the first 0.5 s alive; aimed shots only from ≥ 24 px above the ship) apply to every new attacker, and every telegraphed attack is telegraphed for ≥ 0.5 s.
- **Tests:** unit tests for each custom behavior's state machine and the boss phase transitions. The harness's god playthrough, determinism and pool safety must pass for `warrens`. Add a `tests/sim/warrens.sector.test.ts` god run that asserts the sector's signature beats (listed above) actually happen.

## Balance targets
With `SAVE=act1`: typical-bot clear ≈ **72%**, novice ≥ 14%, boss time 50–90 s for the typical bot, salvage on a clear 600–800.
Measure with `LEVEL=warrens SAVE=act1 RUNS=50 SKILLS=novice,typical,expert npm run balance` and record a balance table in Notes, like T27's. If a number is off only because a bot is blind to something, show the evidence (hits by cause) and tune for a human.

## Acceptance criteria
- [ ] `?level=7&save=act1` plays the full timeline to the boss's defeat, results, and the right schematic, pod, and the Ricochet unlock.
- [ ] God playthrough (every seed), determinism and pool safety pass for `warrens`.
- [ ] Balance targets met or the gap explained.
- [ ] Browser check on your own port with `?mute`: each new enemy, each hazard beat and each boss phase is described in Notes, with no console errors.
- [ ] build / test / lint / test:sim / e2e pass.

## Contract changes
None expected.
