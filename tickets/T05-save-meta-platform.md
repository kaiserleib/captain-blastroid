# T05 — Save data, meta progression model, platform adapters
Status: todo
Wave: 1 · Depends on: T00 · Blocks: T08 (stats), T17

## Goal
The persistent layer: versioned save data, the meta-progression rules (salvage, hangar upgrades, schematics, ship building, pilot rescue, high scores, settings), and platform-service interfaces with web implementations that Capacitor versions can replace in T19.

## Owns
`src/meta/**` (save.ts, schema.ts, progression.ts, upgrades.ts, index.ts), `src/platform/**` (platform.ts interfaces, web/storage.ts, web/haptics.ts, web/lifecycle.ts, index.ts), `src/content/ships.ts` (data only, per design.md), `src/content/pilots.ts` (data only; T06 adds portrait seeds/overrides), `src/content/upgrades.ts`, tests.

## Read first
`docs/design.md` → Ships, Pilots, Meta progression.

## Requirements
1. **platform.ts:** interfaces `StorageAdapter { get(key): Promise<string|null>; set; remove }`, `Haptics { impact(kind) }`, `Lifecycle { onPause(cb); onResume(cb) }`, `Orientation { lockPortrait() }`. Web impls use localStorage (with an in-memory fallback if it throws), `navigator.vibrate` (feature-detected; no-op on iOS web), visibilitychange/pagehide, and `screen.orientation.lock` (try/catch). A `platform` singleton is selected at boot. In T19 it is selected by `Capacitor.isNativePlatform()`.
2. **schema.ts:** `SaveData v1 = { version, salvage, totalSalvageEarned, upgrades: Record<id, level>, schematics: string[], shipsBuilt: string[], pilotsRescued: string[], selectedShip, selectedPilot, highScores: {score, pilot, ship, date}[] (top 10), stats: {runs, kills, deaths, bossKills}, settings: {music, sfx, haptics, stickOpacity, stickRadiusScale, screenShake} }`. Defaults give Kestrel + Captain Blastroid unlocked. Include a `migrate(raw)` stub that is version-aware. Corrupt JSON falls back to defaults and backs up the bad blob under another key.
3. **save.ts:** async `load()`/`save()` through the StorageAdapter, debounced writes, and `saveNow()` on pause/pagehide.
4. **progression.ts** (pure functions on SaveData; no I/O):
   - `bankRun(save, runResult)` adds salvage (× salvageMul), merges schematics and rescued pilots, updates stats and the high-score table, and returns a list of "discoveries" for the results screen.
   - `canBuyUpgrade`, `buyUpgrade`, `canBuildShip` (requires schematic + salvage), `buildShip`.
   - `computePlayerStats(save, shipId, pilotId) → { base ship numbers, PlayerStats }`, combining ship + pilot passive + hangar upgrades. T08 consumes this.
   - `nextRescuablePilot(save, levelId)`, so the director knows which pilot an escape pod carries (or none).
5. **content/ships.ts, pilots.ts, upgrades.ts:** typed records exactly per design.md tables.

## Acceptance criteria
- [ ] Unit tests: defaults, round-trip save/load via in-memory adapter, corrupt-data recovery, bankRun (incl. duplicates of schematics/pilots ignored), upgrade purchase edge cases (cost, max level, insufficient salvage), ship building, stats composition (e.g. Old Grieg in Bulwark with Plating = 7 shields).
- [ ] Saving survives reload in the browser.
- [ ] Nothing in `src/meta` touches the DOM (it should be testable in Node).

## Out of scope
UI (T17), Capacitor implementations (T19).
