# T05 — Save data, meta progression model, platform adapters
Status: done (browser reload check pending boot wiring in T17)
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
- [x] Unit tests: defaults, round-trip save/load via in-memory adapter, corrupt-data recovery, bankRun (incl. duplicates of schematics/pilots ignored), upgrade purchase edge cases (cost, max level, insufficient salvage), ship building, stats composition (e.g. Old Grieg in Bulwark with Plating = 7 shields).
- [ ] Saving survives reload in the browser. (Not verified: nothing calls `initSave` yet; T17's BootScene wires it. `WebStorage` itself is unit-tested against a fake backing.)
- [x] Nothing in `src/meta` touches the DOM (it should be testable in Node).

## Out of scope
UI (T17), Capacitor implementations (T19).

## Contract changes
None to `sim/types.ts`, `sim/world.ts`, `engine/events.ts` or `gfx/renderer.ts`. `content/index.ts` gains `export * from './ships' | './pilots' | './upgrades'`.

## Notes
- **Content ids.** Ships `kestrel`, `bulwark`, `dart`. Pilots `blastroid`, `juno`, `grieg`, `zzkar`. Upgrades `plating`, `capacitors`, `tractor`, `fieldGen`. Schematic ids equal ship ids (`bulwark`, `dart`), matching T15's `schematicOnClear`. Starting weapon ids are `blaster` and `orbitDrones`; T09 should use these or rename them here. Zz'kar's rescue level is `ionShoals` (post-MVP), so `nextRescuablePilot(save, 'kessler')` returns Juno, then Grieg, then null.
- **`PilotDef.portrait?: { seed; overrides? }`** is reserved for T06.
- **Stat math.** Pilot `passive` is a `Partial<PlayerStats>`: `*Mul` fields multiply and `extraShield` adds. Each upgrade multiplies its stat by `1 + perLevel × level`, or adds to `extraShield`. Ships carry no multipliers. `computePlayerStats(save, shipId, pilotId)` returns a `PlayerLoadout` with `baseShield`, `baseSpeed`, `weaponSlots`, `startingWeapons`, `maxShield` (= base + extraShield), `speed` (= base × speedMul) and `stats`. Pickup radius is only a multiplier here; T08 owns the base radius.
- **Purity.** Progression functions return new `SaveData` and never mutate their input. `buyUpgrade` and `buildShip` throw unless `canBuyUpgrade` / `canBuildShip` pass. `bankRun(save, result, now?)` returns `{ save, salvageEarned, discoveries }`. Discoveries are `schematic {schematicId, shipId}`, `pilot {pilotId}` and `highScore {rank}`. Salvage is `round(raw × salvageMul)`. A schematic for a ship that's already built is ignored. Zero scores aren't recorded. On a tied score, the older entry stays ahead.
- **Save store.** `initSave(platform.storage, platform.lifecycle)` loads the save and flushes it on pause. Use `getSave()` / `setSave()` (debounced write, 500 ms), `saveNow()`, `getSettings()` (sync; defaults before load), `updateSettings(patch)` (writes immediately) and `onSaveChange(cb)` (can register before init). The key is `captain-blastroid.save`. A corrupt blob is copied to `captain-blastroid.save.corrupt` and replaced with defaults. `migrate()` drops unknown ids, clamps values and always keeps the starter ship and pilot unlocked.
- **Settings defaults:** music 0.35 (lowered after listening test), sfx 0.8, haptics on, stickOpacity 0.5, stickRadiusScale 1.0, screenShake `full`.
- **Platform.** `platform` (a live `let` export) defaults to `createWebPlatform()`. T19 calls `setPlatform()` when `Capacitor.isNativePlatform()`. Nothing touches the DOM until a method runs, so the platform imports cleanly in Node. `Haptics.impact` doesn't check `settings.haptics`; callers (T13) must. If `localStorage` is missing or a call throws, `WebStorage` falls back to memory for the session.
- **Not wired into `main.ts`/`BootScene`** (outside this ticket's Owns). T17's BootScene, or whoever owns boot, should call `initSave(platform.storage, platform.lifecycle)` and `platform.orientation.lockPortrait()`.
