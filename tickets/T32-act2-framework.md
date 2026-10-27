# T32 — Act II framework: ten sectors, act paging, escape phase, HUD
Status: todo
Wave: 8 · Depends on: T31 + the wave-8 contracts commit · Blocks: T38–T43

## Goal
Make the campaign ten sectors long. This covers the level stubs, Sector Select paging by act, the results texts, the `act1` debug save, the escape phase that ends the Foundry, and the HUD changes Act II needs: a six-slot weapon strip and the escape countdown.

## Owns
- `src/content/levels/index.ts`, `src/content/levels/types.ts` (additively), and the five new stub folders `src/content/levels/{corona,warrens,junction,chrono,foundry}/**` and `src/game/levels/{…}/**`. Stubs only: wave 9 replaces them.
- `src/game/levels/index.ts`
- `src/game/director/**`: dispatch for the new timeline actions through `registerTimelineAction`, `escape`, and the per-boss stall-breaker threshold
- `src/scenes/SectorSelectScene.ts`, `src/scenes/ResultsScene.ts`, `src/scenes/flow.ts`
- `src/game/hud/**`
- `src/ui/debugSaves.ts` (the `act1` preset), `src/debug/flags.ts` (`?level=6..10`)
- `tests/sim/harness.ts` and `tests/sim/campaign.test.ts`, only to widen them to ten sectors
- `e2e/**`
- **One allowed edit outside these:** the last-shield guard during the escape, in the player damage path (≤ 5 lines). T36 must not touch that function.

## Read first
`CLAUDE.md`, `docs/design.md` → **"Campaign: Act II"** (Act II structure, difficulty curve, Level 10's escape, presentation), `tickets/WAVE8-NOTES.md`, and the Notes of T21, T22 and T31 (the level framework, Sector Select and the campaign harness as built).

## Requirements
1. **Ten sectors.**
   - `LEVEL_ORDER` gets the five Act II ids.
   - Each sector has a ~45 s stub that ends in the Rock Hauler. It uses the real `music`/`bossMusic` ids from WAVE8-NOTES, the design's tuning numbers (`enemyHpMul`, `enemyShotSpeedMul`, `guaranteeWeapon`, `bossSalvage`, `podFallbackSalvage`, `schematicOnClear`, `fieldTestWeapon`), and one `escapePod` event.
   - `?level=6..10` works.
   - The T21 harness (god playthrough, determinism, pool safety) runs over all ten.
2. **Sector Select pages by act.**
   - Two pages of five cards, `ACT I` / `ACT II` headers, and left/right (keys, swipe, and on-screen arrows) to switch. Pointer Events only.
   - It opens on the page that holds `selectedLevel`.
   - The locked Act II page shows dimmed cards reading "CLEAR SECTOR 5".
   - The hangar's SECTOR row reads e.g. "7 THE WARRENS".
3. **Results.**
   - The first Armada clear shows **ACT I COMPLETE**, and NEXT SECTOR → Corona Drift.
   - The first Foundry clear shows **CAMPAIGN COMPLETE**.
   - When `RunResult.unlockedWeapon` is set (T35 sets it), show "NEW WEAPON: <NAME>".
4. **Escape phase.**
   - `LevelDef.escape?: { dur, scrollTo, over, script?, bonus, bonusPerHit }`. With `escape` set, boss defeat starts the escape instead of the victory flow:
     - a toast and a HUD countdown;
     - the scroll ramp;
     - the optional level script (the Foundry places terrain and debris through it);
     - the last-shield guard (a hit at 1 segment flashes but doesn't kill);
     - victory when the countdown reaches 0, paying `bonus − bonusPerHit × hits` (minimum 0).
   - Test it with a stub level that sets `escape`.
5. **Stall breaker per boss.** Generalize `BOSS_ASSIST.after` to a per-boss override (`assistAfter?` on the boss def or level). Act I values don't change.
6. **HUD:**
   - The weapon strip fits **6** slots at 240 px wide. Check with a 6-weapon loadout in the sandbox.
   - The escape countdown, top center, in the debug-overlay 8 px monospace style.
7. **`?save=act1`:** every Act I sector cleared, Act I ships built, Act I pilots rescued, all Act I hangar upgrades, Kestrel and Blastroid selected, `selectedLevel` = corona, and only the five Act I weapons in `weaponsUnlocked`. `npm run balance` accepts `SAVE=act1`.
8. **Timeline dispatch:** the director routes `flare`, `flares`, `shadeSlab`, `terrain`, `portal`, `bubble` (and any future kinds) through `registerTimelineAction(kind, fn)`. An unknown kind warns once and is skipped, so stubs run before T33 and T34 merge.
9. **e2e:** the campaign smoke covers paging to Act II and launching sector 6 with `?save=act1`.

## Acceptance criteria
- [ ] All ten sectors launch from Sector Select, and each stub clears into results with the right NEXT SECTOR.
- [ ] ACT I COMPLETE, CAMPAIGN COMPLETE and NEW WEAPON lines show in the right cases (unit-tested in the results view model and checked in the browser).
- [ ] The escape phase works on a test level: countdown, last-shield guard, bonus, victory.
- [ ] Act I is unchanged: the Level 1 god-bot and dodger event-log hashes are identical before and after, and the Act I balance numbers are within noise.
- [ ] The six-slot HUD and the escape countdown appear in the gallery and the sandbox.
- [ ] build / test / lint / test:sim / e2e pass.

## Out of scope
Real Act II content (wave 9), hazards (T33, T34), weapons and the unlock pool (T35), ships and pilots (T36), music and backgrounds (T37).

## Contract changes
