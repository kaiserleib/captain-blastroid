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
