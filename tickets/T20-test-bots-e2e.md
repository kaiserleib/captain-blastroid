# T20 — Headless bot playthrough + Playwright smoke
Status: done
Wave: 4 · Depends on: T18 (can start the harness against T15 once merged) · Blocks: —

## Goal
Automated confidence that the game *plays*: deterministic headless runs that catch crashes, softlocks and balance regressions, plus one real-browser smoke test.

## Owns
`tests/sim/**` (harness.ts, bots.ts, level1.playthrough.test.ts, balance.report.ts), `e2e/**` (playwright.config.ts, smoke.spec.ts), `package.json` scripts `test:sim`, `e2e`, `balance`.

## Requirements
1. **Harness:** build a `World` exactly as GameScene does, minus rendering and audio (these must be importable without DOM; fix leaks of DOM access into sim code as you find them and note them). `runSim(seed, bot, seconds) → { events log, result, stats }`.
2. **Bots** (each writes `world.input` per tick):
   - `idleBot` (never moves), which proves the level is survivable for some seconds and nothing crashes with no input.
   - `dodgerBot` steers away from the nearest threats (enemy shots within 40 px weighted by time-to-impact, asteroids, enemies) and drifts toward pickups when safe.
   - `godBot` is `dodgerBot` with `god` on, to reach the boss deterministically.
3. **Tests:**
   - `godBot` across 10 seeds: the boss spawns, the boss is defeated (at a debug-boosted loadout), `levelComplete` and `runOver{victory}` fire, and no exceptions occur.
   - Determinism: the same seed + bot gives an identical event log hash across two runs.
   - Pool safety: no pool ever hits capacity silently (warn counters exposed by T00's pool).
4. **Balance report** (`npm run balance`): runs `dodgerBot` (no god) for 50 seeds and prints survival time distribution, % reaching the boss, salvage earned, pickups collected per type and average weapon levels at death/boss. T18 uses this for tuning.
5. **Playwright smoke** (Chromium, mobile viewport emulation for iPhone + Pixel): load `/`, tap through Title → Hangar → Launch, inject touch-drag for 10 s, assert no console errors, the canvas is non-blank (pixel sample), and the `?debug` FPS overlay shows ticks advancing.

## Acceptance criteria
- [x] `npm run test:sim` runs in < 60 s and passes. *~7.5 s wall, 28 tests.*
- [x] `npm run balance` prints a readable report. *50 seeds in ~10 s.*
- [x] `npm run e2e` passes headless locally. *iPhone 13 + Pixel 7 emulation in Chromium, ~32 s including Vite startup.*

## Scripts
- `npm run test` (default) runs a quick subset of the sim tests: 3 god seeds, 3 idle seeds, a 90 s determinism check and a short pool stress. That adds ~2 s to the suite.
- `npm run test:sim` (`SIM=1 vitest run tests/sim`) runs the full set: 10 god seeds, 10 idle seeds, full-length determinism for the dodger and god bots, and a full all-L5 pool stress.
- `npm run balance` (`BALANCE=1`) prints the report for 50 seeds of `dodgerBot` (typical skill). `RUNS=N` changes the seed count. `SKILLS=novice,typical,expert,god` runs T18's per-skill pass instead, where `god` is the typical dodger that can't die. This replaces T18's `npm run sim`, which is removed.
- `npm run e2e` runs `playwright test -c e2e/playwright.config.ts`. Playwright starts Vite on port 5120 itself (it reuses a server already there outside CI) and stops it afterwards. First-time setup is `npx playwright install chromium`.

## Notes
- **Harness (`tests/sim/harness.ts`)**:
  - `createSimWorld(seed, opts)` builds the world the way `GameScene.enter` does: save, `initPlayer(computePlayerStats(...))`, level scroll speed, `startDirector`.
  - `runSim(seed, bot, seconds, opts)` returns `{ events, hash, eventCount, result, stats }`.
  - Systems: `GAME_SYSTEMS` is GameScene's list in GameScene's order. The background system is replaced by a scroll-only system, and `input.system` and fx are left out because the bot writes `world.input` and fx is presentation only.
  - `harness.test.ts` parses `GameScene.ts` (`?raw` import) and fails if the two lists drift.
  - Hitstop doesn't apply headless. In the game it freezes the whole loop, so it doesn't change the sim.
- **Event log:** the harness subscribes to every `GameEvents` key. The key list is checked by `satisfies Record<keyof GameEvents, 1>`, so a new event breaks the compile until it's added. Payloads are serialized at emit time because payload objects are reused, and entities print as `#id kind @x,y`. The hash is FNV-1a over every event, including the noisy `sfx`/`shake`/`enemyHit` ones, plus the final player position, score and salvage. The readable `events` array leaves the noisy ones out.
- **Bots (`tests/sim/bots.ts`):**
  - `idleBot()`.
  - `dodgerBot(skill = typical)`. This is T18's heuristic, kept so its balance numbers stay comparable. It samples 81 points on rings around the ship and scores each one by projected overlap with enemy shots, rocks and enemies along the path. Each look-ahead step is weighted by 1/(1+3t), which is time-to-impact weighting. It adds a pull toward a preferred spot: under the nearest targetable enemy, or a pickup when the greed roll allows. I didn't add a hard 40 px shot cut-off, because candidate points sit up to 50 px from the ship and a cut-off made the bot measurably worse. The projection already ignores shots that won't arrive within the look-ahead.
  - `godBot(skill = expert)` is the dodger with `setGodMode(true)` (reset in a `finally`). It doesn't use the old `invulnT` pin hack.
  - Bots seed their own rng from `${seed}#bot`.
- **God playthrough:** the god bot starts with a debug-boosted loadout (Blaster 5, Spread 4, Seeker 4). The boss spawns at 180 s and falls in 17–22 s on all 10 seeds. The tests assert this event order: `bossRequested` → `bossSpawned` → `bossDefeated` → `levelComplete` → exactly one `runOver{victory:true}`. They also assert 0 hits and the `bulwark` schematic. A separate unboosted god run checks the "about 3 weapons" design bound, which was T18's old smoke test.
- **Determinism:** two runs of the same seed in the same process produce identical hashes, logs and results. That also shows no module-global state leaks between runs (god flag, hooks, director WeakMap, formation ids). Different seeds produce different hashes.
- **Pool safety:** every run asserts `droppedSpawns === 0` and `peak < capacity` for all six pools. A stress run with all five weapons at L5 covers the worst case. A run with `playerShots` capacity 8 proves the counter is actually read. Peaks seen: player shots 77/400 (all-L5 god), enemy shots 36/600, enemies 19/80, asteroids 56/120, pickups 40/120.
- **Idle bot:** deaths come at 38–192 s across 10 seeds, mostly from rocks and early gnat shots. The test promises survival for more than 20 s.
- **DOM leaks:** I found none. Everything the harness imports (`sim`, `game/*`, `content`, `meta`, `engine`, `debug/flags`) loads in Vitest's `node` environment. Every `window` access in `game/*` sandboxes and in the director's `__director` hook is already guarded with `typeof window`, and `flags` falls back to `''` when `location` is missing.
- **Playwright smoke (`e2e/smoke.spec.ts`):**
  - It loads `/?debug&mute&save=fresh`. `save=fresh` keeps the run in memory, off the real save, and `mute` keeps it silent.
  - **Taps, not clicks:** the test uses `touchscreen.tap` on the title, waits 0.8 s, then taps the Hangar LAUNCH button.
    - The tap position is computed with the game's own pure `computeLayout`, imported from `src/engine/display.ts`, and the Hangar layout math (`top + 123`).
    - If HangarScene's layout changes, update that line.
  - **Touch drag:** the drag runs for 10 s through CDP `Input.dispatchTouchEvent`. That sends a real touchStart and touchMoves circling a 30 px radius, so the browser generates real `pointerType: touch` events on the floating stick.
  - **Assertions:**
    - No `console.error` and no `pageerror`.
    - Ticks advanced by more than 300 and director time by more than 5 s, read from `window.__director` (dev only).
    - The ship's x swept more than 20 px.
    - The display canvas is non-blank: more than 2% of the sampled pixels are lit and there are more than 8 distinct colors.
  - **Overlay:** I checked the `?debug` overlay itself by screenshot: FPS 60 / TPS 60, `IN touch`. The test reads the tick counter from the world rather than OCR-ing the overlay.
  - **Devices:** the descriptors are `iPhone 13` and `Pixel 7`, with `browserName: 'chromium'` pinned, because the iPhone descriptor defaults to WebKit.
- **Config edits outside Owns:** `eslint.config.js` gives `e2e/**/*.ts` Node globals. In `package.json`, the scripts changed and `@playwright/test` was added as a devDependency, nothing else. `e2e/` isn't in `tsconfig.json`'s include, because type-checking it would need `@types/node` for `process.env`. Playwright transpiles it on its own.

## Balance report (dodger typical, 50 seeds, `npm run balance`)
- Reached the boss 100%, cleared 90%. 4 deaths, all in the boss fight at 225–239 s. 1 timeout (seed `bal46`, Blaster 3 / Spread 3 / Drones 3, stuck in phase 2: T18's known drone-loadout stall).
- Salvage: clears median 303 (189–435), boss deaths about 211. On the clock: 27 / 72 / 108 / 164 / 242 at 45 / 90 / 120 / 150 / 180 s.
- At the boss: 3.2 weapons, average level 3.2. Blaster is held in 100% of runs at L3.7 on average, Spread 94% at L3.2, Drones 48%, Lance 40%, Seeker 34%. Pickups per run: 6.2 weapon, 3.2 upgrade, 6.2 magnet, 5.4 repulsor, 3.8 shield. The pod was rescued in 88% of runs.
- Boss time on clears: median 55 s (24–123). Peak enemy shots are 36 in waves and 36 in boss phase 2. Tick time averages 0.005 ms.
- Novice: reached the boss 76%, cleared 52%, 0.82 hits in the first 45 s. Expert: reached the boss 96%, cleared 82%, 8% timeouts, again the drone stall.

## Bugs found
- No game bugs turned up. Every god seed clears, runs are deterministic, and no pool overflowed.
- The one failure was my own: Playwright runs `webServer` from the config's folder (`e2e/`), so Vite served a 404 there. It's fixed with `cwd: '..'`.

## Follow-ups
- The boss phase-2 stall with drone-heavy loadouts, carried over from T18, shows up as 2% timeouts for the typical dodger and 8% for the expert. The balance report lists the timed-out seeds.
- The e2e test hard-codes the Hangar LAUNCH position. A dev-only `window.__scene` hook, or a test id per menu item, would make it layout-proof.
- CI isn't wired up. On CI, run `npx playwright install --with-deps chromium` before `npm run e2e`.
