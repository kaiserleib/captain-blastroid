# T28 — Level 3: Event Horizon
Status: todo
Wave: 6 · Depends on: T21, T23, T24, T25 (+ T22 for the flow) · Blocks: T31

## Goal
Replace the `eventHorizon` stub with the full sector from `docs/design.md` → **Level 3: "Event Horizon"**: its enemies, hazards, timeline, escape pod and boss **Perihelion**, tuned to the sector's place in the difficulty curve.

## Owns
- `src/content/levels/eventHorizon/**`: `LevelDef` (timeline, asteroid field, all tunables) plus the enemy and boss tables (`ROSTER`, boss def)
- `src/game/levels/eventHorizon/**`: custom behaviors, the boss controller and its draw, sprites (`*.sprites.ts`), level scripts and systems, sandbox keys, tests
- `tests/sim/**`: only new files named `eventHorizon.*.test.ts`

Nothing else. Everything plugs in through T21's registries (`registerRoster`, `registerBehavior`, `registerBoss`, `registerLevelScript`, `registerLevelSystem`) and T23's hazard API. If you need a change in a shared module, stop and describe it in Notes under "Shared changes needed" with a minimal patch suggestion. Don't edit it.

## Read first
`CLAUDE.md`, `docs/design.md` (Campaign section, especially **Level 3: "Event Horizon"** and "Difficulty curve"), `docs/art-direction.md`, `tickets/WAVE6-NOTES.md` (the APIs as merged), and the Notes / Contract changes of T21, T23, T24 and T25. Use the Level 1 files (`content/levels/level1.ts`, `game/boss/rockHauler.ts`, `content/bosses.ts`) as the style and quality reference.

## Requirements
- Enemies: **Orbiter** (circles the nearest black hole at 54 px; spawn it with `{ ax/ay }` set to the hole, or find the hole at spawn), **Lancer** (telegraphed dash: draw the telegraph line in your enemy draw layer or the boss draw API), **Gravity Buoy** (drifting body with `spawnFieldOnly`, collapses on death).
- Black-hole placements via `anomaly` events with the design's variants and drifts. Shots fired beside a hole must visibly curve; tune the placements so the curving is a *feature*.
- **Boss: Perihelion** (`hz_perihelion`): spawns its own pinned `massive` black hole at (120, 150) with `vy: 0` (call `pinAnomaly` so scroll changes don't move it). Elliptical orbit around it (rx 80, ry 50, 9 s). Phase 2 slingshot dives with a curved dotted telegraph. The hole collapses on defeat (`collapseAnomaly`).
- **Timeline:** follow the design's beat table, including the supply run, the carrier, breathers with shield drops, a magnet, the pod and the warning-then-boss. Keep the `enemyHpMul`, `enemyShotSpeedMul`, `guaranteeWeapon`, `bossSalvage`, `podFallbackSalvage` and `schematicOnClear` numbers from the design unless balance requires otherwise; log any changes.
- **Art:** every new enemy and boss part has sprites at the art-direction sizes, a 15-bit palette, an outline, a 2-frame animation where it fits, and hit-flash support (automatic via the sprite cache). They appear in `tools/gallery.html`. Enemy bullets use only the standard enemy-bullet sprites.
- **Sandbox:** keys to spawn each new enemy and the boss under `?sandbox`. Pick keys not in use: check WAVE6-NOTES for the key map.
- **Fairness:** the T11 fairness rules (no shots in the first 0.5 s alive, shooter at least 24 px above the player for aimed shots) apply to every new attacker. Every telegraphed attack is telegraphed for ≥ 0.5 s.
- **Tests:** unit tests for each custom behavior's state machine and the boss phase transitions (as in `game/boss/boss.test.ts`). The T21 harness already runs god playthrough, determinism and pool safety for every `LEVEL_ORDER` id, so make yours pass. Add `eventHorizon.balance` coverage via `LEVEL=eventHorizon npm run balance`.

## Balance targets
Typical-bot clear rate ≈ 80%, novice ≥ 45%, boss time 50–100 s, salvage on a clear 340–450. Shots curving into the player must stay fair: no shot may *accelerate* into the player from off-screen without at least 0.5 s on screen.
Measure with `LEVEL=eventHorizon RUNS=50 npm run balance` (typical) and `SKILLS=novice,typical,expert`. Record a balance table in Notes, like T18's.

## Acceptance criteria
- [ ] `?level=` for this sector plays the full timeline to Perihelion's defeat, results, and the right schematic and pod (`?save=fresh` with earlier sectors cleared via `?save=mid`/`all` as needed).
- [ ] God playthrough (every seed), determinism and pool-safety tests pass for `eventHorizon`.
- [ ] Balance targets met or the gap explained.
- [ ] Browser check on your own port with audio muted. Screenshots of each new enemy, the hazard beats and each boss phase are described in Notes, and there are no console errors.
- [ ] build / test / lint / test:sim pass.

## Contract changes
(fill in. There should be none.)

## Notes

## Follow-ups
