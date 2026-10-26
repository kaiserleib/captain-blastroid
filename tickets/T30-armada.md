# T30 — Level 5: The Armada
Status: todo
Wave: 6 · Depends on: T21, T23, T24, T25 (+ T22 for the flow) · Blocks: T31

## Goal
Replace the `armada` stub with the full sector from `docs/design.md` → **Level 5: "The Armada"**: its enemies, hazards, timeline, escape pod and boss **Dreadnought Leviathan**, tuned to the sector's place in the difficulty curve.

## Owns
- `src/content/levels/armada/**`: `LevelDef` (timeline, asteroid field, all tunables) plus the enemy and boss tables (`ROSTER`, boss def)
- `src/game/levels/armada/**`: custom behaviors, the boss controller and its draw, sprites (`*.sprites.ts`), level scripts and systems, sandbox keys, tests
- `tests/sim/**`: only new files named `armada.*.test.ts`

Nothing else. Everything plugs in through T21's registries (`registerRoster`, `registerBehavior`, `registerBoss`, `registerLevelScript`, `registerLevelSystem`) and T23's hazard API. If you need a change in a shared module, stop and describe it in Notes under "Shared changes needed" with a minimal patch suggestion. Don't edit it.

## Read first
`CLAUDE.md`, `docs/design.md` (Campaign section, especially **Level 5: "The Armada"** and "Difficulty curve"), `docs/art-direction.md`, `tickets/WAVE6-NOTES.md` (the APIs as merged), and the Notes / Contract changes of T21, T23, T24 and T25. Use the Level 1 files (`content/levels/level1.ts`, `game/boss/rockHauler.ts`, `content/bosses.ts`) as the style and quality reference.

## Requirements
- Enemies: **Escort Fighter** (wings of 3), **Minelayer** (drops L2's Ion Mine: import its *def id* only. If T27 isn't merged when you start, register your own `armada_mine` def with the same numbers instead of importing T27's folder), **Frigate** mid-boss (a multi-part rig with `BossRig`, **not** `isBoss`, so the HUD boss bar ignores it; a guaranteed capsule on death).
- **Pod (Commodore Vale)** ejects from the second frigate's wreck (a `script` hook), or at 105 s.
- **Boss: Dreadnought Leviathan** (`leviathan`): a 240×~720 hull made of section rigs whose anchor scrolls down at 20 px/s, with `setScrollSpeed(w, 20)` at its start. Sections arrive in order: bow, forward battery, missile bays (homing missiles: 1 HP shootable enemies with a custom homing behavior), shield generators, bridge. The anchor stops when the bridge reaches y≈110 (`setScrollSpeed(w, 0)`). Generators overload after 25 s if they scroll past alive (no soft-lock). Bridge phase 1, then phase 2: the escape core detaches and strafes. Off-screen sections are released (not counted as kills). Hull art: deck plating tiles drawn per section (sprites or a cached procedural canvas per section), Syndicate rust on gunmetal.
- Final boss: `bossMusic: 'armada_boss'`. Crossfade at 145 s via a `script`, or by setting the boss request time so `bossSpawned` triggers it. The 3 s death chain across the hull goes through `fx` events (`shake`, explosion bursts) and must not duplicate T13's `bossDefeated` chain.
- **Timeline:** follow the design's beat table, including the supply run, the carrier, breathers with shield drops, a magnet, the pod and the warning-then-boss. Keep the `enemyHpMul`, `enemyShotSpeedMul`, `guaranteeWeapon`, `bossSalvage`, `podFallbackSalvage` and `schematicOnClear` numbers from the design unless balance requires otherwise; log any changes.
- **Art:** every new enemy and boss part has sprites at the art-direction sizes, a 15-bit palette, an outline, a 2-frame animation where it fits, and hit-flash support (automatic via the sprite cache). They appear in `tools/gallery.html`. Enemy bullets use only the standard enemy-bullet sprites.
- **Sandbox:** keys to spawn each new enemy and the boss under `?sandbox`. Pick keys not in use: check WAVE6-NOTES for the key map.
- **Fairness:** the T11 fairness rules (no shots in the first 0.5 s alive, shooter at least 24 px above the player for aimed shots) apply to every new attacker. Every telegraphed attack is telegraphed for ≥ 0.5 s.
- **Tests:** unit tests for each custom behavior's state machine and the boss phase transitions (as in `game/boss/boss.test.ts`). The T21 harness already runs god playthrough, determinism and pool safety for every `LEVEL_ORDER` id, so make yours pass. Add `armada.balance` coverage via `LEVEL=armada npm run balance`.

## Balance targets
Typical-bot clear rate ≈ 70%, novice ≥ 35%, hull plus bridge fight 60–110 s, salvage on a clear 520–700. Performance: the hull fight stays under the T18 budget (sim tick < 4 ms on desktop under `?debug`); record the numbers.
Measure with `LEVEL=armada RUNS=50 npm run balance` (typical) and `SKILLS=novice,typical,expert`. Record a balance table in Notes, like T18's.

## Acceptance criteria
- [ ] `?level=` for this sector plays the full timeline to Dreadnought Leviathan's defeat, results, and the right schematic and pod (`?save=fresh` with earlier sectors cleared via `?save=mid`/`all` as needed).
- [ ] God playthrough (every seed), determinism and pool-safety tests pass for `armada`.
- [ ] Balance targets met or the gap explained.
- [ ] Browser check on your own port with audio muted. Screenshots of each new enemy, the hazard beats and each boss phase are described in Notes, and there are no console errors.
- [ ] build / test / lint / test:sim pass.

## Contract changes
(fill in. There should be none.)

## Notes

## Follow-ups
