# T26 — Orbit Drones: fix the boss stall
Status: todo
Wave: 5 · Depends on: T00–T20 · Blocks: T31

## Goal
Fix the T18/T20 follow-up: a drone-heavy loadout (e.g. Blaster 1–3 + Drones 3–5) can't finish a boss, because drones only deal contact damage. That's about 2% timeouts for the typical bot and 8% for the expert.

## Owns
`src/content/weapons.ts` (drone entries), `src/game/weapons/**`.

## Read first
`docs/design.md` → Weapons; `tickets/T18-integration-balance.md` and `T20-test-bots-e2e.md` follow-ups; `src/game/weapons/drones.ts`; `tests/sim/balance.report.ts` (timed-out seeds such as `bal46`).

## Requirements
1. From **drone level 3**, each drone fires a **spark**: a 1-damage shot at the nearest *targetable* enemy within 150 px (use `isTargetable`/`targetFilterFor`), or straight up if there is none.
   - Rates: every 0.9 s at L3, 0.7 s at L4, 0.5 s at L5. Speed 220 px/s, sprite 4×4 using a cool palette (white core, cyan edge).
   - Drones fire staggered, so the sparks aren't in lockstep.
   - Tunables go in `content/weapons.ts`.
2. Shots go through the normal player-shot pool and damage pipeline. Seeker homing logic is not needed; the aim is fixed at fire time.
3. Update the weapon description text if the UI shows one.
4. **Tests:**
   - A unit test for spark targeting and its rate.
   - A sim test: a forced Blaster 2 + Drones 5 loadout under the god bot (`tests/sim`) defeats the Rock Hauler within 150 s for 3 seeds. Mark it `SIM=1` if it's slow.
5. Re-run `npm run balance` with `SKILLS=typical,expert` and record the timeout rate before and after in Notes. The target is 0 drone-stall timeouts.

## Acceptance criteria
- [ ] No drone-stall timeouts in a 50-seed typical and expert balance run.
- [ ] Drones are not now the best weapon. Record the weapon share at the boss and the clear time before and after.
- [ ] build / test / lint / test:sim pass.

## Contract changes
(fill in)
