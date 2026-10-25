# T20 — Headless bot playthrough + Playwright smoke
Status: todo
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
- [ ] `npm run test:sim` runs in < 60 s and passes.
- [ ] `npm run balance` prints a readable report.
- [ ] `npm run e2e` passes headless locally.
