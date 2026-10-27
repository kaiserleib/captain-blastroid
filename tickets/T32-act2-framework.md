# T32 — Act II framework: ten sectors, act paging, escape phase, HUD
Status: done
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
- [x] All ten sectors launch from Sector Select, and each stub clears into results with the right NEXT SECTOR.
- [x] ACT I COMPLETE, CAMPAIGN COMPLETE and NEW WEAPON lines show in the right cases (unit-tested in the results view model and checked in the browser).
- [x] The escape phase works on a test level: countdown, last-shield guard, bonus, victory.
- [x] Act I is unchanged: the Level 1 god-bot and dodger event-log hashes are identical before and after, and the Act I balance numbers are within noise.
- [x] The six-slot HUD and the escape countdown appear in the gallery and the sandbox.
- [x] build / test / lint / test:sim / e2e pass.

## Out of scope
Real Act II content (wave 9), hazards (T33, T34), weapons and the unlock pool (T35), ships and pilots (T36), music and backgrounds (T37).

## Contract changes
- `engine/events.ts`: new event `escapeStarted: { dur: number }`, emitted by the director when boss defeat starts an escape. The HUD counts down from it. Audio should switch to `escape` on it (see Shared changes). `tests/sim/harness.ts` lists it in `EVENT_TYPES`.
- `sim/hooks.ts` (additive, no-op default, reset by `clearHooks`): `registerShieldFloor(fn)` and `shieldFloor(w)`. A hit can't leave the shield below `min(current, floor)`. The default floor is `-Infinity`. The director registers it in every `startDirector`, and it returns 1 while the escape runs (through the outro).
- `sim/damage.ts` `damagePlayer` (the allowed edit, 1 line plus a comment): `p.shield = Math.max(p.shield - amount, Math.min(p.shield, shieldFloor(w)))`. A guarded hit still sets `invulnT` (the flash), resets the chain and emits `playerHit`. It just can't take the last pip, and it can't kill at 0.
- `content/levels/types.ts`: `EscapeDef.toast?` (default `ESCAPE_TOAST`, "CORE BREACH - ESCAPE!". The font has no em dash.)
- `content/levels/index.ts`: `ACTS` (`ActDef { name, levels }`), `actIndexOf(id)` and `actEndedBy(id)`.
- `ui/results.ts` (outside Owns, additive. It's the results view model the acceptance criteria name):
  - `FinishedRun` gains `actComplete: string | null` ("ACT I COMPLETE"), `unlockedWeapon` and `unlockedWeaponName`.
  - New exports: `resultBanners(f, victory)` and `unlockedWeaponOf(reported, before, after)`.
- `tests/sim/balance.test.ts` and `balance.report.ts` (outside Owns, required by req. 7): `SAVE=act1` (or fresh/mid/all) picks the `?save=` preset, and the report header names the save.
- Director exports: `escapeTimeLeft(w)` (−1 when there's no escape), `escapeBonus(def, hits)` and `ESCAPE_TOAST`. `DirectorPhase` gains `'escape'`, and `DirectorState.escape` is an `EscapeState`.

## Notes
- **Stubs:**
  - Each Act II sector reuses T21's `stubTimeline` and `STUB_BASE` unchanged: one `escapePod`, and the Rock Hauler at 40 s.
  - Each carries the design's `enemyHpMul`, `enemyShotSpeedMul`, `bossSalvage`, `podFallbackSalvage`, `schematicOnClear`, `music`/`bossMusic` and `rockTheme`, plus `fieldTestWeapon` for 6–8.
  - Every stub has `guaranteeWeapon: { by: 25, weapon }`, using the sector's field-test weapon or Spread/Lance.
  - The supply-run `forceCapsule` is left to wave 9.
  - The Foundry stub has the real `escape` (40 s, 30 → 90 over 6 s, 100 − 20/hit) without a script. T42 adds `escape.script` for the terrain and debris.
  - The stubs include no hazard events, so the sim suites don't print registry warnings.
- **Escape flow:**
  - On `bossDefeated` the director drops the schematic and salvage, clears shots, and then, if `level.escape` is set, enters `phase: 'escape'`. That means `escapeStarted`, the toast, a scroll ramp and the optional script.
  - Pickups are magnetized at 1 s, because they would otherwise fall behind at 90 px/s.
  - At 0 the director adds `escapeBonus` straight to `run.salvage` (toast "ESCAPE BONUS +N") and joins the normal outro past its magnet step: `levelComplete` 1.5 s later, `runOver{victory}` 4.5 s later.
  - The level clock stays frozen during the escape (as in the boss phase), so the escape keeps its own `escape.t` and `escape.left`.
  - Hits during the escape are counted from `playerHit`.
- **Last-shield guard:**
  - Guarded hits still flash, reset the chain and count against the bonus.
  - A ship that enters the escape at 0 pips can't die either.
  - The guard stays on through the post-escape outro.
- **HUD:**
  - `MAX_SLOTS = MAX_WEAPON_SLOTS` (6, from `content/ships`). At 18 px a slot that's 3 + 108 px, which clears the magnet and repulsor timers.
  - The countdown reads `ESCAPE 0:40` in the UI font at `bossY` (top centre, where the boss bar was), and blinks red for the last 10 s.
  - The **white-out** is also in the HUD: 0.4 s in, 0.3 s hold, 1.2 s out after the countdown ends. The HUD keeps its own end time from `escapeStarted`.
  - The `?sandbox&hud` demo, which the gallery's HUD section also uses, now fills all six slots (including `arc`) and runs a 3.5 s escape with the white-out at 20.5 s of each 26 s loop.
- **Sector Select:**
  - One page per act (`ACTS`), with the `ACT I` / `ACT II` label between `<` and `>` buttons (`prev` and `next` item ids).
  - The header shows `n/2`.
  - Left/right keys page, and a horizontal swipe of at least 32 px (twice as wide as it is tall) pages and cancels the press on the card under the finger.
  - It opens on the act of `selectedLevel`.
  - While the act's first sector is locked, every card reads "CLEAR SECTOR 5". Otherwise each card reads N−1 as before.
  - The hangar row already used `sectorLabel`, so it reads "6 CORONA DRIFT" and "7 THE WARRENS".
- **Results:**
  - The banners come from `resultBanners`: CAMPAIGN COMPLETE, else `<ACT> COMPLETE` on the first clear of an act's last sector (not the campaign's), then `NEW WEAPON: <NAME>`.
  - `unlockedWeapon` prefers `RunResult.unlockedWeapon` (T35) and otherwise falls back to the first weapon the save gained during banking, so either T35 implementation shows up.
- **Stall breaker:** `BossRegistration.assistAfter` already gives each boss its own threshold (the Leviathan uses it), so nothing changed. T42 registers the Architect with `assistAfter: 150`.
- **Timeline dispatch** was already in the contracts commit. New tests cover all six kinds reaching their handler, and an unknown kind warning exactly once.
- **`?save=act1`:**
  - It now sets explicitly: `selectedLevel: 'corona'`, Kestrel + Blastroid, and `weaponsUnlocked` = the five Act I weapons.
  - `debugSaves.test.ts` checks it, including a `normalize` round trip.
  - `?level=6..10` works through `LEVEL_ORDER`.
- **Act I is unchanged:** after the merge with main (T36 and T37), the baseline hashes are identical: 17a78586 / 66a3e907 / kessler 432d4c06 / ionShoals 1c9e54f6 / eventHorizon f3426d8c / pulsarNursery 0b41ee42 / armada 8b2a6879. The Act I sim is untouched, so the balance numbers are identical by construction.
- **Browser checks** (port 5132):
  - Act II page with act1 and fresh saves (the locked page reads "CLEAR SECTOR 5"), and the swipe.
  - `?level=10&t=38&save=act1`: boss → `ESCAPE 0:37` countdown → bonus → results with CAMPAIGN COMPLETE.
  - `?level=5&save=fresh`: ACT I COMPLETE plus NEXT SECTOR.
  - `?sandbox&hud`: 6 slots, the escape event and the white-out.
  - The pilot screen shows "SECTOR 8 POD / WORMHOLE JUNCTION".
  - NEW WEAPON can't be triggered until T35 banks unlocks. It is unit-tested.
- **e2e:** the new `act1 save` smoke opens Sector Select on ACT II, pages to ACT I and back with the arrows, and launches sector 6.

## Shared changes needed
- **Escape music (audio, T37's area).** In `attachAudio` add:
  `events.on('escapeStarted', () => music.playSong(songOr('escape', 'boss'))),`
  Until then the music stays stopped after `bossDefeated` during the escape.

## Follow-ups
- T35: set `RunResult.unlockedWeapon` in `bankRun`. The results screen shows it automatically (the save-diff fallback covers it either way).
- T42: set `escape.script` (terrain and debris), register the Architect with `assistAfter: 150`, and replace the stub timeline. The escape's `toast` can stay at its default.
- T38–T41: replace the stub fields and timelines, and add the field-test `forceCapsule` on the supply run.

