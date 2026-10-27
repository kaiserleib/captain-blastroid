# T43 — Act II integration, bots and balance
Status: todo
Wave: 10 · Depends on: T32–T42 · Blocks: —

## Goal
Make the ten-sector campaign hold together. Play it end to end, sharpen the bots for Act II hazards, hit the Act II balance targets, protect Act I, and check performance on devices.

## Owns
`tests/sim/**` (bots, harness, balance, campaign), plus tuning numbers in any `src/content/**` file (tunables only; behavior changes go back to the owning sector's folder as small, logged fixes). Also `docs/design.md` (the measured numbers) and `tickets/README.md`.

## Read first
`docs/design.md` → "Campaign: Act II", T31 (method, balance log and follow-ups), and the Notes and Follow-ups of T32–T42.

## Requirements
1. **Campaign flow test:** a scripted run from `?save=act1` clears sectors 6 → 10 through NEXT SECTOR. It checks the weapon unlocks (Arc Coil, Ricochet, Flak), the five pods, the five schematics, ACT I COMPLETE (from `?save=mid`-style Act I progress) and CAMPAIGN COMPLETE.
2. **Bots:**
   - Review the hazard cost terms added in wave 8 against real sector play, using hits by cause.
   - Teach the bot to shoot through portals at shielded targets (Aegis, Sentinel, Janus) well enough that it doesn't lean on the stall breaker every run.
   - Report how often the stall breaker fires per boss.
3. **Balance:**
   - Meet the Act II table (typical and novice clear rates, salvage, peak shots) with `SAVE=act1`.
   - Re-measure Act I with all eight weapons unlocked and fix any regression from drop-pool dilution (for example, by weighting new weapons lower in Act I).
   - Write the measured numbers back into the design's difficulty table.
4. **Economy:** check that build costs (900–2000) and the Act II salvage give a sensible pace: about one ship built per 2–3 Act II clears. Adjust costs if not.
5. **Perf:** device-class checks (the T19/T31 method) on the heaviest beat of each Act II sector and on the escape. 60 fps on a mid-range phone profile.
6. **Fix the follow-ups** the wave-9 tickets left, or defer them explicitly.

## Acceptance criteria
- [ ] The campaign flow test passes in the default suite (or the sim suite, if it's slow).
- [ ] Act II balance targets met or the gaps explained. Act I is within noise of T31 with all weapons unlocked.
- [ ] Perf numbers recorded for every Act II sector.
- [ ] build / test / lint / test:sim / e2e pass.

## Contract changes
