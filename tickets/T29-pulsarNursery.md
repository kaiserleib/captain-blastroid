# T29 — Level 4: Pulsar Nursery
Status: todo
Wave: 6 · Depends on: T21, T23, T24, T25 (+ T22 for the flow) · Blocks: T31

## Goal
Replace the `pulsarNursery` stub with the full sector from `docs/design.md` → **Level 4: "Pulsar Nursery"**: its enemies, hazards, timeline, escape pod and boss **Magnetar**, tuned to the sector's place in the difficulty curve.

## Owns
- `src/content/levels/pulsarNursery/**`: `LevelDef` (timeline, asteroid field, all tunables) plus the enemy and boss tables (`ROSTER`, boss def)
- `src/game/levels/pulsarNursery/**`: custom behaviors, the boss controller and its draw, sprites (`*.sprites.ts`), level scripts and systems, sandbox keys, tests
- `tests/sim/**`: only new files named `pulsarNursery.*.test.ts`

Nothing else. Everything plugs in through T21's registries (`registerRoster`, `registerBehavior`, `registerBoss`, `registerLevelScript`, `registerLevelSystem`) and T23's hazard API. If you need a change in a shared module, stop and describe it in Notes under "Shared changes needed" with a minimal patch suggestion. Don't edit it.

## Read first
`CLAUDE.md`, `docs/design.md` (Campaign section, especially **Level 4: "Pulsar Nursery"** and "Difficulty curve"), `docs/art-direction.md`, `tickets/WAVE6-NOTES.md` (the APIs as merged), and the Notes / Contract changes of T21, T23, T24 and T25. Use the Level 1 files (`content/levels/level1.ts`, `game/boss/rockHauler.ts`, `content/bosses.ts`) as the style and quality reference.

## Requirements
- Enemies: **Pulse Drone** (rings phase-locked to the nearest pulsar's pulse), **Streaker** (enters from the bottom only during fast scroll; never spawn one under the player: pick an x at least 50 px from the player), **Warden Ray** (sweeping line of spaced bullets).
- Pulsar placements via `anomaly` events with `variant` and `phase`. Use T25's documented 120 BPM alignment so pulses land on the music's accent (pulse at level-song time 3.0·k s; account for when GameScene starts the song).
- Scroll changes via `scroll` events: 28 → 70 at 70 s over 3 s, 70 → 18 at 105 s over 4 s, 18 → 36 at 145 s.
- **Boss: Magnetar** (`magnetar`): 4 rotating pylons and a core that owns a `magnetar` pulsar it reprograms per phase with `setPulsarPattern` (P1, P2, and the P3 MELTDOWN double rings). The boss drives `setScrollSpeed` in 12 s cycles 30 → 50 → 30 through a `registerLevelSystem` or its own update.
- **Timeline:** follow the design's beat table, including the supply run, the carrier, breathers with shield drops, a magnet, the pod and the warning-then-boss. Keep the `enemyHpMul`, `enemyShotSpeedMul`, `guaranteeWeapon`, `bossSalvage`, `podFallbackSalvage` and `schematicOnClear` numbers from the design unless balance requires otherwise; log any changes.
- **Art:** every new enemy and boss part has sprites at the art-direction sizes, a 15-bit palette, an outline, a 2-frame animation where it fits, and hit-flash support (automatic via the sprite cache). They appear in `tools/gallery.html`. Enemy bullets use only the standard enemy-bullet sprites.
- **Sandbox:** keys to spawn each new enemy and the boss under `?sandbox`. Pick keys not in use: check WAVE6-NOTES for the key map.
- **Fairness:** the T11 fairness rules (no shots in the first 0.5 s alive, shooter at least 24 px above the player for aimed shots) apply to every new attacker. Every telegraphed attack is telegraphed for ≥ 0.5 s.
- **Tests:** unit tests for each custom behavior's state machine and the boss phase transitions (as in `game/boss/boss.test.ts`). The T21 harness already runs god playthrough, determinism and pool safety for every `LEVEL_ORDER` id, so make yours pass. Add `pulsarNursery.balance` coverage via `LEVEL=pulsarNursery npm run balance`.

## Balance targets
Typical-bot clear rate ≈ 75%, novice ≥ 40%, boss time 60–100 s, salvage on a clear 400–520. Every ring hit must be avoidable: add a sim test that a bot standing in a computed gap takes 0 ring hits over 10 pulses for each variant used.
Measure with `LEVEL=pulsarNursery RUNS=50 npm run balance` (typical) and `SKILLS=novice,typical,expert`. Record a balance table in Notes, like T18's.

## Acceptance criteria
- [ ] `?level=` for this sector plays the full timeline to Magnetar's defeat, results, and the right schematic and pod (`?save=fresh` with earlier sectors cleared via `?save=mid`/`all` as needed).
- [ ] God playthrough (every seed), determinism and pool-safety tests pass for `pulsarNursery`.
- [ ] Balance targets met or the gap explained.
- [ ] Browser check on your own port with audio muted. Screenshots of each new enemy, the hazard beats and each boss phase are described in Notes, and there are no console errors.
- [ ] build / test / lint / test:sim pass.

## Contract changes
(fill in. There should be none.)

## Notes

## Follow-ups
