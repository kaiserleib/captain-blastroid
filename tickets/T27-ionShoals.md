# T27 — Level 2: Ion Shoals
Status: todo
Wave: 6 · Depends on: T21, T23, T24, T25 (+ T22 for the flow) · Blocks: T31

## Goal
Replace the `ionShoals` stub with the full sector from `docs/design.md` → **Level 2: "Ion Shoals"**: its enemies, hazards, timeline, escape pod and boss **Shepherd**, tuned to the sector's place in the difficulty curve.

## Owns
- `src/content/levels/ionShoals/**`: `LevelDef` (timeline, asteroid field, all tunables) plus the enemy and boss tables (`ROSTER`, boss def)
- `src/game/levels/ionShoals/**`: custom behaviors, the boss controller and its draw, sprites (`*.sprites.ts`), level scripts and systems, sandbox keys, tests
- `tests/sim/**`: only new files named `ionShoals.*.test.ts`

Nothing else. Everything plugs in through T21's registries (`registerRoster`, `registerBehavior`, `registerBoss`, `registerLevelScript`, `registerLevelSystem`) and T23's hazard API. If you need a change in a shared module, stop and describe it in Notes under "Shared changes needed" with a minimal patch suggestion. Don't edit it.

## Read first
`CLAUDE.md`, `docs/design.md` (Campaign section, especially **Level 2: "Ion Shoals"** and "Difficulty curve"), `docs/art-direction.md`, `tickets/WAVE6-NOTES.md` (the APIs as merged), and the Notes / Contract changes of T21, T23, T24 and T25. Use the Level 1 files (`content/levels/level1.ts`, `game/boss/rockHauler.ts`, `content/bosses.ts`) as the style and quality reference.

## Requirements
- Enemies: **Tug** (custom behavior: hold and drift, tow the nearest medium or large rock with `towRock` and draw the beam with `drawTractorBeam`, fling with `flingRock`; if nothing is in range, one aimed shot), **Skiff** (fast sine weave, one aimed shot), **Ion Mine** (proximity or timer ring burst; shooting it disarms it). Numbers from the design.
- **Escape-pod gauntlet** at ~110–145 s: a `script` named `ionShoals.gauntlet` (or plain timeline events) with skiff sweeps from both sides and gunboats whose fans cross the pod's path. Uses `escapePod: { x: 120, hp: 3 }`. Toasts: "ZZ'KAR'S POD - ESCORT IT!" (or the salvage-cache line when Zz'kar is already rescued) and "POD LOST" when it's destroyed (listen for the pickup module's pod-destroyed signal; if none exists, add an event-free check in your script).
- **Boss: The Shepherd** (`shepherd`): emitters that tow large rocks into orbit (shields), throw them every 5 s and tow fresh ones in from the top; aimed 3-bursts; core phase with the 5-arm ion spiral and skiff waves. About 112×64, built from part sprites like the Rock Hauler.
- **Timeline:** follow the design's beat table, including the supply run, the carrier, breathers with shield drops, a magnet, the pod and the warning-then-boss. Keep the `enemyHpMul`, `enemyShotSpeedMul`, `guaranteeWeapon`, `bossSalvage`, `podFallbackSalvage` and `schematicOnClear` numbers from the design unless balance requires otherwise; log any changes.
- **Art:** every new enemy and boss part has sprites at the art-direction sizes, a 15-bit palette, an outline, a 2-frame animation where it fits, and hit-flash support (automatic via the sprite cache). They appear in `tools/gallery.html`. Enemy bullets use only the standard enemy-bullet sprites.
- **Sandbox:** keys to spawn each new enemy and the boss under `?sandbox`. Pick keys not in use: check WAVE6-NOTES for the key map.
- **Fairness:** the T11 fairness rules (no shots in the first 0.5 s alive, shooter at least 24 px above the player for aimed shots) apply to every new attacker. Every telegraphed attack is telegraphed for ≥ 0.5 s.
- **Tests:** unit tests for each custom behavior's state machine and the boss phase transitions (as in `game/boss/boss.test.ts`). The T21 harness already runs god playthrough, determinism and pool safety for every `LEVEL_ORDER` id, so make yours pass. Add `ionShoals.balance` coverage via `LEVEL=ionShoals npm run balance`.

## Balance targets
Typical-bot clear rate ≈ **90%** (the user's explicit target), novice ≥ 60%, boss time 50–90 s for the typical bot, salvage on a clear 280–380.
Measure with `LEVEL=ionShoals RUNS=50 npm run balance` (typical) and `SKILLS=novice,typical,expert`. Record a balance table in Notes, like T18's.

## Acceptance criteria
- [ ] `?level=` for this sector plays the full timeline to Shepherd's defeat, results, and the right schematic and pod (`?save=fresh` with earlier sectors cleared via `?save=mid`/`all` as needed).
- [ ] God playthrough (every seed), determinism and pool-safety tests pass for `ionShoals`.
- [ ] Balance targets met or the gap explained.
- [ ] Browser check on your own port with audio muted. Screenshots of each new enemy, the hazard beats and each boss phase are described in Notes, and there are no console errors.
- [ ] build / test / lint / test:sim pass.

## Contract changes
(fill in. There should be none.)

## Notes

## Follow-ups
