# T22 — Sector select, campaign flow, per-sector records
Status: todo
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
- [ ] Fresh save: only sector 1 is selectable. After a (debug) L1 clear, sector 2 unlocks, is preselected, and NEXT SECTOR on results launches it.
- [ ] Abandoned runs and scores under 1000 never enter Records.
- [ ] e2e taps by item id. Both e2e tests pass.
- [ ] Screens checked at h=400 and h=520 with `?save=fresh|mid|all`, with screenshots described in Notes.
- [ ] build / test / lint / e2e pass.

## Out of scope
Level content, ship and pilot select changes (T24).

## Contract changes
(fill in)
