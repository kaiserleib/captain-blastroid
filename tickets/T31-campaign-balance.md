# T31 — Campaign integration, bots and balance
Status: todo
Wave: 7 · Depends on: T21–T30 · Blocks: —

## Goal
The five sectors play as one campaign: the flow from fresh save to CAMPAIGN COMPLETE works, every level has bot coverage, and the difficulty curve matches the design.

## Owns
`tests/sim/**`, `e2e/**`, `src/content/**` (balance numbers only), and bug fixes anywhere (list each one under "Fixes", in the owning module's style).

## Read first
Everything in the Campaign section of `docs/design.md`, the Notes and balance tables of T21–T30, `tickets/T18-integration-balance.md` (the balance-log format).

## Requirements
1. **Bots:**
   - The `dodgerBot` threat model learns the new hazards: pulsar rings (project the ring radius and stand in a gap), black-hole pull on its own shots (aim offset), towed and flung rocks, Lancer telegraphs, homing missiles.
   - Keep the skills (novice / typical / expert) comparable to T18's numbers on Level 1. L1 results must stay within noise.
2. **Coverage for every `LEVEL_ORDER` id:**
   - `SIM=1`: god-bot clear on 10 seeds per level.
   - Full-length determinism per level.
   - Pool safety per level, including an all-L5 stress run per level.
   - Default suite: 1 seed per level, under ~15 s added.
3. **`npm run balance`:** `LEVEL=all` prints a per-level table (reach boss %, clear %, deaths by phase, salvage, weapons at the boss, boss time, peak shots, pod rescue %).
4. **Balance pass** toward the design table: typical clear ≈ 90 / 90 / 80 / 75 / 70% for L1–L5, salvage bands, peak-shot targets. Change only `content/`. Write a before/after balance log.
5. **Campaign flow (e2e or sim):** fresh save → clear L1 (god) → NEXT SECTOR → L2 … → L5 → CAMPAIGN COMPLETE. Every sector's schematic and pod land in the save, `selectedLevel` advances, and per-sector records fill.
6. **Perf:** the T18 method on each level's heaviest beat and boss (desktop `?debug`). Record the numbers. Fix anything over budget.
7. **Docs:**
   - Update `docs/design.md` with the final numbers where tuning changed them.
   - Mark tickets done in `tickets/README.md`.
   - Note any open follow-ups.

## Acceptance criteria
- [ ] `npm run test:sim` passes in < 120 s. `LEVEL=all npm run balance` prints readable per-level reports.
- [ ] Campaign flow verified end to end (described in Notes).
- [ ] Balance log recorded. Targets met or the gaps explained.
- [ ] build / test / lint / test:sim / e2e pass. No console errors in a browser run of each sector.

## Contract changes
(fill in)

## Inputs from waves 5–6 (main session)
Read the Notes, balance tables and follow-ups of T26–T30. In short:
- **Bot blind spots:** the shared `dodgerBot` can't see:
  - pulsar rings: T29 wrote a ring-aware copy in `tests/sim/pulsarNursery.balance.test.ts`;
  - black-hole pull and curving shots: T28's `HZ_AWARE` wrapper in `tests/sim/eventHorizon.balance.test.ts`;
  - Lancer telegraph lines, Perihelion's dive telegraph, Warden Ray sweeps;
  - the Armada hull guns: it parks at y≈270 under them.

  Merge these into the shared bot, so every level uses one bot per skill. Add `hole` and `ring` hit causes to `hitCause`.
- **Current numbers** (each sector's own bot; see the tickets):
  - L2: typical 94%, novice 50%.
  - L3: hole-aware typical 76%.
  - L4: ring-aware typical 28%, but 76% with ring hits refunded. Salvage on a clear is ~275, against a 400–520 target.
  - L5: typical 75%, novice 6%.
  - L1 novice sits at ~52–55% in this harness, so the design's novice targets (60/45/40/35%) are probably miscalibrated for the bot.
  - Set novice targets relative to L1 (e.g. L2 ≥ 0.9× L1 novice, falling ~10 points per sector) and document the choice.
- **Pulsar echo fixed on main:** the echo hit test now matches its drawn gaps (half the gap spacing). Switch Magnetar's MELTDOWN from its second-pulsar workaround to the built-in `double` ring, if that keeps the gap tests green.
- **Known issues to fix or explicitly defer:**
  - The HUD boss bar shrinks as unkilled Leviathan turrets scroll off.
  - With mid-level Blaster/Spread loadouts, the expert bot spends 80–100 s in the Rock Hauler's turret phase (T26).
  - A Blaster L2-only loadout never finishes a boss (T26). A minimum-DPS floor may be needed.
- **Campaign salvage curve:** clears should pay increasing salvage, L1 → L5 (design table), so the late ships (Halcyon 800, Paragon 1200) are reachable after a few campaign clears.
- **Sim time budget:** `npm run test:sim` must stay under ~120 s, and the default `npm run test` must stay fast.
