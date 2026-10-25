# T18 — End-to-end integration + balance pass
Status: todo
Wave: 4 · Depends on: T00–T17 · Blocks: T19, T20

## Goal
Turn the merged modules into **one playable, fun first version**: Level 1 from launch to boss kill to results, with meta progression working. This ticket owns the seams. Fix integration bugs anywhere, but keep feature changes minimal and in the owning module's style.

## Owns
`src/scenes/GameScene.ts` (final system/draw ordering, run lifecycle), `src/content/**` (balance numbers), any bug fixes across modules (note each one in this ticket under "Fixes").

## Requirements
1. **GameScene lifecycle:** `enter({shipId, pilotId, levelId, seed})` → `createWorld` → init player → director start → music. Wire `runOver` → build `RunResult` → `ResultsScene`, `pauseRequested`/visibility → `PauseOverlay`, and `?sandbox` keeps working.
2. Verify **system order** and **draw z-order** against tech-stack.md. Check that `prevX/prevY` interpolation is correct for every drawn entity (no jitter at 120 Hz).
3. **Contract audit:** every event in `GameEvents` has at least one emitter and one listener (or a comment saying why not).
4. **Balance targets** for Level 1, measured with T20's bot harness where possible:
   - A new player (Kestrel, no upgrades) reaches the boss on their 1st–3rd attempt and beats it within ~5 attempts.
   - A typical loadout at the boss is 3 weapons averaging L2–3.
   - Salvage per run is 80–150 on death mid-level and 200–300 on clear, so the first hangar upgrade lands after 1–2 runs and Bulwark after about 2–3 runs.
   - Enemy bullets on screen peak at about 40 in waves and about 80 in boss phase 2.
5. **Performance:** under `?debug`, the sim tick stays < 4 ms and frame < 8 ms on desktop throughout. Record numbers in this ticket.
6. **Feel pass:** fire rates, enemy HP, drop rates, i-frames, hitbox sizes. Write before/after values in "Balance log".

## Acceptance criteria
- [ ] Fresh save: complete loop playable on desktop (mouse and keys) and phone (stick).
- [ ] Clearing Level 1 the first time awards the Bulwark schematic. Rescuing the Level 1 pod unlocks Juno. Both appear correctly in the hangar.
- [ ] No console errors through 10 consecutive runs (mix of deaths, clears, abandons).
- [ ] Balance log and perf numbers recorded below.

## Fixes
## Balance log
## Perf numbers
