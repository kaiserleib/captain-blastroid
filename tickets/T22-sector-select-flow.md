# T22 — Sector select, campaign flow, per-sector records
Status: done
Wave: 5 · Depends on: T00–T20 (codes against `LEVEL_ORDER` generically; T21 adds the other four ids) · Blocks: T31

## Goal
The player can pick any unlocked sector from the Hangar, and after a win can go straight on to the next one. High scores are kept per sector and stop recording abandoned runs. The e2e smoke test stops depending on hard-coded menu coordinates.

## Owns
- `src/scenes/SectorSelectScene.ts` (new), `HangarScene.ts`, `ResultsScene.ts`, `RecordsScene.ts`, `flow.ts`
- `src/ui/results.ts`, `src/ui/debugSaves.ts`, new `src/ui/*` helpers if needed
- `src/meta/progression.ts`: level-unlock helpers and the `bankRun` high-score rule. T24 also edits `computePlayerStats` in this file; keep your edits to separate functions.
- `src/main.ts`: the dev-only scene hook
- `e2e/**`

## Read first
`docs/design.md` → "Campaign structure", `tickets/WAVE5-NOTES.md`, `src/meta/schema.ts` (v2: `levels`, `selectedLevel`, `HighScore.level`), `src/scenes/*`, `src/ui/*`, `e2e/smoke.spec.ts`.

## Requirements
1. **Meta helpers** (pure, tested):
   - `isLevelUnlocked(save, id)`: the first id in `LEVEL_ORDER` is always unlocked, and later ones need the previous id cleared.
   - `nextLevelId(id)` returns the next id or null.
   - `unlockedLevels(save)`.
   - `selectLevel(save, id)` refuses locked ids.
   - `bankRun` sets `selectedLevel` to the next sector on that sector's **first** clear (when it exists).
2. **High scores:** `RunResult.abandoned` (set by the results flow). `bankRun` adds no high-score entry when the run was abandoned or the score is under `HIGH_SCORE_FLOOR = 1000`. The level record's `best` still updates for non-abandoned runs. `HIGH_SCORE_LIMIT` (10) applies **per level**: the save keeps up to 10 entries for each level, in one array, and normalize/sort per level. Tests.
3. **Hangar:**
   - Add a `SECTOR` row (below SHIP) whose value is `"<n> <NAME>"`, using the small-font fallback if it's long. It opens Sector Select.
   - LAUNCH flies `save.selectedLevel`, replacing the hard-coded `'kessler'`.
   - The header shows the sector name under the pilot or ship card if space allows; otherwise skip it.
4. **Sector Select scene:**
   - Five cards stacked in a SNES window: number, name (ui font), best score, a ★ with the clear count, "POD" while `nextRescuablePilot(save, id)` is non-null, and "SCHEMATIC" while `pickSchematic`-equivalent logic says the boss still has an unfound ship.
   - Locked cards are dimmed with a lock glyph and "CLEAR SECTOR N−1". Confirming a locked card plays `ui_back`.
   - Confirming an unlocked card selects it, saves, and returns to the Hangar with LAUNCH focused.
   - Pointer, keys and WASD work like the other menus. It must fit at 240×400 and 240×520.
   - Use the level's background theme as a small banner per card if it reads well; otherwise use the shared backdrop.
5. **Results:**
   - Victory: a **NEXT SECTOR** button, focused, when `nextLevelId` exists. It launches the next sector with the same ship and pilot and a new seed. Then HANGAR.
   - Defeat or abandon: **RETRY** (same sector, new seed), then HANGAR.
   - On the first clear of the last sector, show "CAMPAIGN COMPLETE" on the results screen.
   - The title line shows the sector name.
6. **Records:** one table per sector, paged with left/right (or tap arrows), and the sector name as the title.
7. **Debug saves:** `?save=mid` has L1 cleared (L2 unlocked); `?save=all` has every sector cleared, with plausible bests.
8. **e2e:**
   - Add a dev-only `window.__scene` hook in `main.ts`: `{ name(): string; items(): {id, x, y, w, h}[] }` for the top scene, in buffer coordinates. `MenuScene` exposes its items.
   - `smoke.spec.ts` taps LAUNCH by id: compute CSS coordinates from the item rect and the layout.
   - Add a second e2e test: `?save=all&mute` → Hangar → SECTOR → pick sector 2 → LAUNCH → 5 s of touch drag → no errors, and the run's `levelId` is `ionShoals` (via `__director`).

## Acceptance criteria
- [x] Fresh save: only sector 1 is selectable. After a (debug) L1 clear, sector 2 unlocks, is preselected, and NEXT SECTOR on results launches it. (Verified with local level stubs, see Notes.)
- [x] Abandoned runs and scores under 1000 never enter Records.
- [x] e2e taps by item id. Both e2e tests pass. (The sector-2 test skips until T21 adds a second id to `LEVEL_ORDER`; it passed 4/4 with local stubs.)
- [x] Screens checked at h=400 and h=520 with `?save=fresh|mid|all`, with screenshots described in Notes.
- [x] build / test / lint / e2e pass.

## Out of scope
Level content, ship and pilot select changes (T24).

## Contract changes
- None to `sim/types.ts`, `sim/world.ts`, `engine/events.ts` or `gfx/renderer.ts`.
- `meta/progression.ts` (additive): `RunResult.abandoned?`, `runResultFrom(run, victory, abandoned = false)`, `HIGH_SCORE_FLOOR = 1000`, `insertHighScore`, `levelHighScores`, `nextLevelId`, `isLevelUnlocked`, `unlockedLevels`, `selectLevel` (the last four take an optional `order` for tests). `bankRun` rule changes: no score entry for abandoned runs or scores < 1000; abandoned runs don't update `levels[id].best`; `HIGH_SCORE_LIMIT` is per level; first clear moves `selectedLevel` to the next sector. `computePlayerStats` untouched.
- `meta/schema.ts` (outside Owns, required by req. 2): `normalizeHighScores` now caps at 10 **per level** (one sorted array). Only that function and a doc comment changed.
- `ui`: `bankFinishedRun(save, run, victory, abandoned = false, now?, order?)` now returns `FinishedRun` (BankResult + `firstClear`, `campaignComplete`, `nextLevel`). New `ui/sectors.ts` (`sectorInfo`, `sectorLabel`, `hasSchematicLeft`), `ui/ui.sprites.ts` (`ui_star`, `ui_lock`, shown in the gallery's Sprites section). `MenuScene.menuItems()`.
- `flow.sectors()`; `flow.hangar(focus)` used with `'launch'` / `'sector'`.
- Dev-only `window.__scene = { name(), items() }` in `main.ts`.
- `e2e/playwright.config.ts`: `E2E_PORT` env overrides the default 5120, so parallel worktrees don't reuse each other's server (`reuseExistingServer` is on locally).

## Notes
- **Sector Select** (`SectorSelectScene`): header + one card per `LEVEL_ORDER` id + BACK. Cards are 56 px (70 px when the buffer is tall enough, i.e. 520). Each card: a banner window into the sector's own background theme (parked on the theme's first set piece, so Kessler shows its rock belt instead of empty sky; only stars twinkle), the number at 2× over it, name in the ui font (small-font fallback if too long), BEST score, a ★ with `xN` clears (dark star if uncleared), POD / SCHEMATIC tags, and SELECTED. Locked: banner dimmed, padlock, dim name, red "CLEAR SECTOR N-1"; confirming plays `ui_back`. Unlocked confirm → `selectLevel` + save → Hangar with LAUNCH focused. Back/Esc → Hangar with SECTOR focused. Banner `Background`s are cached per theme (built once). Themes that don't exist yet (e.g. `armada`) fall back via `themeForLevel`.
- SCHEMATIC marker mirrors `pickSchematic` (first `schematicOnClear` ship that exists in `SHIPS` and isn't found or built), in `ui/sectors.ts` so T21's director stays untouched.
- **Hangar**: SECTOR row under SHIP (`"2 THE ION SHOALS"`, drawButton's small-font fallback). The sector label also appears in small dim text under the pilot passive in the loadout card when it fits. LAUNCH flies `save.selectedLevel` (falls back to sector 1 if somehow locked). Content height 284 → 310.
- **Results**: subtitle line with the sector label under SECTOR CLEAR / SHIP LOST / RUN ABANDONED; blinking gold "CAMPAIGN COMPLETE" on the first clear of the last sector. Victory → NEXT SECTOR (gold, focused, only if a next sector exists and is unlocked) + HANGAR; defeat/abandon → RETRY + HANGAR. While salvage counts up, the first button reads SKIP and any button skips. NEXT/RETRY use the run's ship and pilot and a fresh `randomSeedString()` (not `?seed`), and also set `selectedLevel` to the sector being flown, so returning to the hangar continues from there (decision: the hangar follows where the player is in the campaign). Esc on results → Hangar.
- **High scores**: ranks in discoveries are per sector ("RANK n OF 10" still true). v1-migrated scores under 1000 are kept (only new runs are floored).
- **Records**: pager row with `<` / `>` buttons and the sector label between them; header shows `n/5`. Left/right keys always page (wrapping); up/down move focus. Opens on the selected sector's page. Lifetime stats below unchanged.
- **Debug saves**: `mid` has kessler cleared and `selectedLevel = LEVEL_ORDER[1]` (falls back to kessler while only one level exists). `all` has every `LEVEL_ORDER` sector cleared (clears 7/5/3/1/1), bests 52000 + 9000·i, per-sector score tables (10/8/6/4/3 entries), bossKills = sum of clears.
- **e2e**: `smoke.spec.ts` now taps by `__scene` item id (`tapItem(page, layout, sceneName, id)` polls until the scene is on top with that item laid out). Second test: `?mute&save=all` → SECTOR → `sector:<LEVEL_ORDER[1]>` → LAUNCH → 5 s touch drag → `__director.world.run.levelId === 'ionShoals'`, no errors. It `test.skip`s while `LEVEL_ORDER` has one id (this worktree); run with `E2E_PORT=5222` it passed 4/4 (iPhone + Pixel) with temporary local stubs for the four later ids, which were then reverted.
- **Browser checks** (port 5122, `?mute`, temporary stubs for levels 2–5 reusing Level 1 with their themes; reverted before commit):
  - h=400 `?save=mid`: Hangar shows SECTOR "2 THE ION SHOALS" and the small label in the card; Sector Select shows card 1 (best 18450, ★x1, POD), card 2 focused + SELECTED with POD, cards 3–5 dimmed with padlocks and "CLEAR SECTOR N-1"; Enter on card 3 stayed on the screen; clicking card 1 returned to Hangar with LAUNCH focused and "1 THE KESSLER BELT".
  - h=400 `?save=fresh`: only card 1 open (POD + SCHEMATIC tags, dark star), 2–5 locked. LAUNCH → forced victory (`bossDefeated`, score 12345) → SECTOR CLEAR "1 THE KESSLER BELT", NEW HIGH SCORE, NEXT SECTOR focused → launched `ionShoals` with a new seed → forced loss at 500 → SHIP LOST "2 THE ION SHOALS", RETRY/HANGAR, no high score → RETRY launched ionShoals again (new seed) → Esc → Abandon with score 40000 → RUN ABANDONED, nothing new → Hangar → Records opened on 2/5 (empty), Left → 1/5 with only the 12345 entry.
  - h=520 `?save=all` and `?save=mid`: Sector Select with tall 70 px cards, all five cleared with ★x7/x5/x3/x1/x1 and rising bests; Kessler banner shows its rock belt.
  - No console errors.
- Not verified: a real phone; CAMPAIGN COMPLETE on screen (unit-tested via `bankFinishedRun` with an injected order); real T21 stub levels.

## Shared changes needed
- None required. After T21 merges, the second e2e test un-skips automatically; re-run `npm run e2e` at merge.
- `meta/schema.ts` `normalizeHighScores` edit (per-level cap) is outside Owns; T21/T24 don't touch it, so it should merge cleanly.

## Follow-ups
- T25/T31: once the `armada` theme exists, the Armada banner picks it up automatically; check every banner reads well (Ion's planet is at x=-170, so its banner shows mostly nebula).
- T31: consider showing per-sector pod pilot portraits on the cards instead of a "POD" tag.
