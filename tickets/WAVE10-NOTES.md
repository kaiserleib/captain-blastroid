# Wave 10 briefing (T43): Act II integration, bots, balance

Waves 8 and 9 are merged on main. All ten sectors are real. T43 is the only ticket in this wave, so **you may make small shared fixes outside the T43 Owns list** (hooks, hazards, boss system, sector folders) when a follow-up below needs one. Keep contract changes additive and list them under "Contract changes". The user is away: make sensible calls, record them in Notes, and don't stop to ask.

## Working rules
- `npm ci`. Merge main into your branch first if `git log --oneline -1 main` isn't in your history.
- Browser: your own Chrome tab, dev server on port **5143**, `?mute` on every URL, close the tab and stop the server when done. e2e: `E2E_PORT=5193`.
- **Act I hashes must stay identical** unless a change is a deliberate Act I balance fix that you log (T43 requirement 3 allows re-tuning Act I for drop-pool dilution). Check them with a throwaway test and `SIM=1 npx vitest run <file> --silent=false`:
  - `runSim('hash-god', godBot(), 300)` → 17a78586
  - `runSim('hash-dodger', dodgerBot(), 200)` → 66a3e907
  - `runSim('hash-' + id, dodgerBot(), 120, { levelId: id })` → kessler 432d4c06, ionShoals 1c9e54f6, eventHorizon f3426d8c, pulsarNursery 0b41ee42, armada 8b2a6879
  - If you change a hash on purpose, update this list in `tickets/WAVE10-NOTES.md` and say why.
- `BALANCE_MAX_T` is now 420 (the Foundry's three-form boss runs long).
- Done means: build, test, lint, test:sim and e2e pass; the ticket's boxes are ticked, `Status: done`, Notes hold the balance tables; committed with a message ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Wave-9 balance as each sector reported it (`SAVE=act1`)
| Sector | novice | typical | expert | typical boss s | typical salvage | notes |
|---|---|---|---|---|---|---|
| 6 corona | 20% | 72% | 92% | 56 | 472 (target 560–750) | flare kills pay nothing |
| 7 warrens | 28% | 72% | 74% | 64 | 640 | peak shots 24/17, far under the curve |
| 8 junction | 18% | 74% | 76% | 72 | 635 (target 640–850) | boss times shaped by the assist |
| 9 chrono | 14% | 67% | **39%** | 54 | 682 | expert parks under the Echo |
| 10 foundry | 10% | 72% | 92% | 60 (Architect target 80–130) | 994 | Architect HP cut to fit `weakLoadout` |

## Follow-ups from wave 9 (fix or defer explicitly)
**Bots**
- Chrono: expert bot clears less than typical; teach bots the Echo's telegraphs (`echoE.lanceT`, `lanceDeg`, `arcT`) and not to park under it.
- Junction: bots can't read ring→face mapping. Stand under an entry ring whose exit aims at a live part, so Janus doesn't lean on the assist.
- Warrens: bot ignores the Wyrm's dust warning; move under the exit point.
- Foundry: Sentinel's front shield; bots should flank or use portals/spread.

**Balance and economy**
- Corona salvage gap (~470). One option the T38 agent raised: flare kills pay salvage (not capsules); that needs a damage source on `enemyKilled` (additive contract change). Your call; raising roster salvage is the simpler fix.
- Junction salvage just under band.
- Foundry: the Architect was cut from 1200 to 840 HP only because the shared `weakLoadout` test requires an invulnerable Blaster L2 to finish every boss under 240 s, while the Architect's stall breaker starts at 150 s. Consider measuring that limit from `assistAfter` instead, then restore HP toward the design and re-measure.
- Peak-shot targets in the difficulty curve don't suit terrain sectors (Warrens 24/17); revise the curve or explain.

**Shared code**
- `cancelFlare(w)` in `src/game/hazards2/flare.ts`; the Heliostat currently writes `flareState(w)` directly on defeat.
- A damage hook for non-boss enemies in `sim/hooks.ts`: a Flak shell touching an Aegis from below gets past its shield.
- Optional `timeScaled?: boolean` on boss registration (the Echo scales itself today).
- `levelFramework.test.ts` requires exactly one `escapePod` event per Act II sector; relax to ≤ 1 if useful.
- Older items: guard `applyCapsuleFixes` against locked weapons; the `CAPSULE_WEAPON_IDS` comment still lists only B/S/L/M/D; export `losePod` from pickups.

**Design doc**: record what changed from the design in each sector (all in the T38–T42 Notes), e.g. Heliostat HP 45/200, Wyrm head 180 HP and 2.0 s mouth, Echo core 1150 / ghost 200, the Architect's per-form HP, raised roster salvage, flare warning 1.6 s.

**For a human (list in your final message, don't block on them)**: the eight new songs, the rock-band cover and outward Heliostat beams, ring→generator readability, Blaster-L2 length on Janus, the Warrens fork and S-bends by hand, the Sentinel feel, dedicated sfx for the new enemies (audio owner).
