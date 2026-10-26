# T31 — Campaign integration, bots and balance
Status: done
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
- [x] `npm run test:sim` passes in < 120 s. `LEVEL=all npm run balance` prints readable per-level reports.
- [x] Campaign flow verified end to end (described in Notes).
- [x] Balance log recorded. Targets met or the gaps explained.
- [x] build / test / lint / test:sim / e2e pass. No console errors in a browser run of each sector.

## Contract changes
None to the core contracts (`sim/types.ts`, `sim/world.ts`, `engine/events.ts`, `gfx/renderer.ts`). Additive elsewhere:
- `game/boss` `BossController`: optional `inHpBar?(part: Enemy): boolean` (default: every part counts). The HUD skips parts it rejects. `Leviathan` implements it.
- `content/levels/pulsarNursery` `MagnetarRingPattern`: optional `double?: boolean` (the meltdown echo).
- Removed: `twinPrefire` (and `Magnetar.twin`) from `game/levels/pulsarNursery`, replaced by the shared `double` ring. `Magnetar.echo()` stays and now returns the main pulsar while its pattern is `double`.
- Test harness (`tests/sim`): `dodgerBot(skill, { hazards })` / `godBot(skill, { hazards })`; `hitCause` exported, with new causes `ring`, `hole`, `pulsar`; `formatSummaryTable`.

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

## Notes

### Bots (`tests/sim/bots.ts`)
One `dodgerBot` / `godBot` per skill for every sector. T28's `HZ_AWARE` wrapper and T29's `PulsarDodger` copy are merged in and their probe files deleted (`eventHorizon.balance.test.ts`, `pulsarNursery.balance.test.ts`). The skill knobs (novice / typical / expert) are T18's, unchanged. The hazard model is on by default; `{ hazards: false }` is T18's dodger, kept for blind-vs-aware tests.
- **Black holes:** shots and rocks are projected along their gravity curve (each hole's pull at the body now, `½at²` over the look-ahead), the core has a keep-out cost (core radius + 34 px, the player drifts in), the bot steps its aim column off a hole sitting between it and its target, and it doesn't chase pickups within 90 px of a core (a pod is the exception).
- **Pulsar rings:** T29's ring-sweep cost, plus the `double` echo (live ring, live echo, and while the telegraph glows the next ring and its echo), the wider sampling radii when a pulsar is up, and an extra weight on rings that arrive soon, so a boxed-in bot buys time instead of standing still. That last term cut Magnetar ring hits by about two thirds.
- **Lancers:** the telegraphed line (and the dash, which doesn't steer) is a keep-out lane.
- **Perihelion:** during the telegraph and the dive, the Bézier path (24 samples) is a keep-out band ±40 px wide.
- **Warden Ray:** the locked fan (both edges ± 6°) is costed from the telegraph to the end of the sweep.
- **Homing missiles:** a reach bubble (they turn toward wherever the ship goes).
- **Dreadnought stance:** under the Leviathan the bot holds y 360 instead of 270 (a player sits low under deck guns that hold fire within 100 px above). Every other boss keeps 270, so L1/L2 are bit-for-bit the T18 bot (a test checks the hash).
- **Hit causes:** `ring` when a ring's solid part covers the ship (the same test `updatePulsar` uses, so a shot fired through a gap isn't blamed on the ring), `hole` / `pulsar` for core contact.
- Expert ≈ typical (L1: 86 vs 92) is T18's bot, unchanged: the expert's greed and constant replanning cost it about as much as its reaction buys. I didn't retune the skills, to keep L1 comparable.

### Coverage
- `SIM=1`: 10 god seeds per sector (boosted loadout), full-length (420 s) dodger determinism per sector, and an all-L5 god run through every sector checking every pool (no dropped spawns, peak < capacity). The default suite runs 1 god seed per sector, 25 s determinism slices and the same five all-L5 pool runs: `tests/sim` went from ~6.5 s to ~10 s.
- `tests/sim/bots.test.ts`: aware vs blind on the same seeds (shields refilled so both fly the same stretch): ring hits under half (L4, 75 s), hole + rock + Lancer hits under half (L3), Perihelion dive hits under a third, and the L1 hash identical with and without the hazard model.
- `npm run test:sim`: 121 tests in ~40 s.

### Campaign flow (`tests/sim/campaign.test.ts`, default suite, ~3 s)
One save from `createDefaultSave()`: the god bot (boosted loadout, flying to any escape pod) clears each sector, and the run is banked with the same `bankFinishedRun` ResultsScene calls. Then it launches `banked.nextLevel` (what NEXT SECTOR does). Each step asserts:
- the sector is unlocked and is `LEVEL_ORDER`'s next;
- its schematic (bulwark, warden, corsair, halcyon, paragon) and pod pilot (juno, zzkar, sable, pip, vale) land in the save;
- `levels[id].clears` is 1 and `best` equals the run's score, and the per-sector high-score table has an entry;
- `selectedLevel` moves to the next sector;
- `campaignComplete` is false until the Armada, then true.

The browser e2e (`e2e/smoke.spec.ts`, T22) covers Title → Hangar → Sector Select → launch, unchanged.

### Balance targets: novice
L1 novice clears ~52% on this harness, so the design's novice targets (60/45/40/35%) don't fit the bot. **Decision:** novice targets are set relative to L1: L2 ≥ 0.9 × L1 (47%), then 10 points less per sector (37 / 27 / 17%). Recorded in `docs/design.md` → Difficulty curve.

### Balance log
`LEVEL=<id> SKILLS=novice,typical,expert npm run balance` (Kestrel, fresh save). Clear %, novice / typical / expert, and the typical clear's median salvage:

| | L1 Kessler | L2 Ion Shoals | L3 Event Horizon | L4 Pulsar Nursery | L5 Armada |
|---|---|---|---|---|---|
| **Before**: stock T18 bot, merged main (50 seeds) | 52 / 92 / 86 · 306 | 50 / 94 / 98 · 353 | 18 / 16 / 12 · 381 | 0 / 0 / 0 · – | 6 / 74 / 74 · 533 |
| Unified hazard-aware bot, content untouched (50) | 52 / 92 / 86 · 306 | 50 / 94 / 98 · 353 | 44 / 84 / 100 · 329 | 0 / 52 / 36 · 279 | 8 / 84 / 90 · 474 |
| **After** tuning (`LEVEL=all RUNS=100`) | 55 / 90 / 88 · 313 | 45 / 92 / 98 · 365 | 43 / 76 / 99 · 361 | 9 / 78 / 65 · 406 | 8 / 75 / 75 · 555 |
| Target | ~52 (ref.) / ~90 · 200–300 | ≥47 / ~90 · 280–380 | ≥37 / ~80 · 340–450 | ≥27 / ~75 · 400–520 | ≥17 / ~70 · 520–700 |

The L1 and L2 rows are bit-identical between the stock and the unified bot (no new hazards there); the "after" spread is the 50 → 100 seed change. Seed noise is about ±7 points at 50 seeds and ±5 at 100.

`LEVEL=all RUNS=100 SKILLS=typical` summary (after):
```
sector             │ boss% │ clear% │ deaths: level · boss by phase          │ salvage clear (all) │ at boss    │ boss s │ peak shots │ pod%
1 THE KESSLER BELT │ 99    │ 90     │ 1 · 4 (fight 4)                        │ 313 (309)           │ 3.3 × L3.2 │ 50     │ 37 / 36    │ 91
2 ION SHOALS       │ 96    │ 92     │ 4 · 2 (dying 1, exposed 1)             │ 365 (359)           │ 3.1 × L3.3 │ 45     │ 36 / 41    │ 72
3 EVENT HORIZON    │ 100   │ 76     │ 0 · 23 (slingshot 23)                  │ 361 (347)           │ 3.2 × L3.2 │ 59     │ 18 / 40    │ 27
4 PULSAR NURSERY   │ 93    │ 78     │ 7 · 7 (phase2 3, meltdown 1, phase1 3) │ 406 (398)           │ 3.2 × L2.7 │ 55     │ 42 / 39    │ 55
5 THE ARMADA       │ 88    │ 75     │ 12 · 10 (core 3, bridge 7)             │ 555 (512)           │ 3.0 × L2.6 │ 91     │ 41 / 52    │ 47
```

**Changes (content only, except the Magnetar echo and the HUD fix under Fixes):**

| What | Before | After | Why |
|---|---|---|---|
| L3 `bossSalvage` | 90 | 120 | clear salvage 329 → 361 (target 340–450) |
| Perihelion core ring | 6-way | 8-way | with the hole read, typical cleared 86%; 76% now (target 80) |
| Pulsar `steady` | 3 × 60°, telegraph 0.8 s | 3 × 64°, 1.0 s | L4 novice and typical died to rings in the first 90 s |
| Pulsar `turning` | 2 × 55°, 0.8 s | **3 × 52°**, 1.0 s | with 2 gaps 180° apart, the 40° turn regularly put both gaps sideways (e.g. 30°/210° on a pulsar at mid-screen): no gap reachable from the bottom half. With 3 gaps one is always within 60° of straight down |
| Pulsar `quick` | 2 × 50°, 0.6 s | 2 × 58°, 0.8 s | same |
| Warden Ray beam | 1.8 s on, lead 12° | 1.5 s on, lead 16° | the sweep was the top L4 shot killer |
| Magnetar core HP · meltdown at | 240 · < 30% | 180 · < 25% | 12–16% of typical runs timed out in phase 2 / meltdown with B2–3 S2–3 loadouts |
| L4 timeline | – | shield at 43 s, carrier at 124 s | weapons at the boss were 2.6 avg level (L1 3.2) |
| L4 roster salvage drone · streaker · ray | 4 · 3 · 12 | 7 · 5 · 18 | clear salvage 279 → 406 (target 400–520) |
| L4 `bossSalvage` | 110 | 180 | same |
| Frigate turret bursts | every 2.8 s at 88 px/s | 3.2 s at 80 | novice deaths clustered on frigates at 30 and 75 s |
| Escort `cease` · L5 66 s interceptors | 2.8 s · pair | 2.2 s · one | same |
| Leviathan flak · deck · guns · ring | 2.6 · 3.2 · 2.8 s · 16 every 2.4 s at 66 | 2.2 · 2.8 · 2.0 s · 20 every 2 s at 70 | with a low stance the hull fight barely hit back (typical 84%, 2 boss deaths in 44) |
| Leviathan bridge + core · escape-core spiral | 220 + 100 · 3 arms, 2.6 on / 1.1 off at 72 | 250 + 120 · 4 arms, 3.0 / 0.9 at 78 | same; fight median 91 s (design 60–110) |
| L5 `bossSalvage` · hull part salvage | 150 · 20 | 220 · 25 | clear salvage 474 → 555 (target 520–700) |

`docs/design.md` carries the new numbers (difficulty table: boss salvage and a novice row; pulsar variant table; Perihelion ring; Warden Ray; Magnetar; Leviathan).

**Gaps, explained:**
- **Novice L4 (9%) and L5 (8%) are far under 27% / 17%.** Novice deaths come mostly before the boss (L4 87 of 91; L5 69 of 92) from the sector's own mechanics: rings in L4, frigate and fighter fire in L5. The novice bot is slow (0.23 s replans, 0.45 s shot reaction, it misses 25% of threats). Easing L4/L5's waves far enough for it would put typical well above target and make the late sectors easier than L1. I left them, and recommend judging novice play in L4–L5 by hand.
- **Expert < typical on L4 (65 vs 78).** It is a bot artifact (the expert dies in Magnetar phase 2, chasing salvage spat out under the station). T18's expert sits a little under typical on L1 too.
- **L3 peak wave shots: 18 against the design's 45.** T28 kept it low on purpose (curved shots). Now that the bot reads curves, typical L3 has 0 deaths before the boss, so this is the place to add density if playtests find the level easy. The boss carries the difficulty now.
- **L5 boss peak shots: 52 against 70.**
- **Pod rescue: L3 27%, L5 47%.** The L3 pod (2 HP) drifts between two holes. The bot does go for it now, but curved fire often kills it first.

### Perf (desktop Chrome, M-series Mac, 120 Hz, `?debug`, port 5131, `?mute`, all five weapons at L5 or a weak loadout as noted)
| Beat | UPD avg / max ms | RND avg / max ms |
|---|---|---|
| L3 Perihelion slingshot phase (all L5) | 0.10 / 0.30 | 0.77 / 0.90 |
| L4 the garden, 3 pulsars + drones (all L5) | 0.11 / 1.50 | 0.64 / 1.00 |
| L4 Magnetar phase 1 (all L3) | 0.13 / 0.50 | 0.86 / 1.20 |
| L5 Leviathan bridge lock, 20-ring + gun fans (Blaster 2 + Lance 2) | 0.08 / 0.20–0.36 | 0.82 / 1.0–1.4 |
| L5 escape core, 47 enemy shots | 0.09 / 0.30 | 0.85 / 1.00 |

FPS 118–120, TPS 60 throughout, far under the 4 ms tick / 8 ms frame budget. L1/L2 content is unchanged since T18/T27. Headless: the harness tick averages 0.005–0.008 ms. A `window.onerror` hook and `read_console_messages` showed no errors in the L3–L5 runs; the e2e smoke covers L1 and L2 (no console errors).

### Fixes
- **HUD boss bar shrank as unkilled Leviathan turrets scrolled off** (`game/boss`, `game/hud`, `game/levels/armada`). Controllers may now narrow the bar with `inHpBar(part)`. The Leviathan's bar is the bridge fight (generators, guns, bridge, escape core), which never scrolls away, so it only moves when the player deals damage. Tested in `armada.test.ts`.
- **Magnetar meltdown uses the shared `double` ring** (`game/levels/pulsarNursery`), now that the echo's hit test matches its drawing. The twin pulsar, `twinPrefire` and its pre-fire maths are gone. The pattern takes hold just after a main pulse (≤ 0.4 s), so the first echo leaves the core 0.5 s behind its ring instead of popping up mid-screen (tested). The echo's spokes are drawn half a spacing round. `pulsarNursery.gaps.test.ts` now models the echo and still flies meltdown with 0 hits.
- **`armada.playthrough` pod check was vacuous:** it looked for `vale` in serialized event data, which never contains the payload. It only ran when the pod was rescued, which the old bot never managed. It now reads `run.pilotsRescued`.
- **Tests hard-coded the Magnetar meltdown threshold** (`0.75` / `0.25` of core HP). Retuning `meltdownAt` made the gaps test loop forever. They now derive it from `MAGNETAR.meltdownAt`.
- `hazards.test.ts` assumed `turning` has 2 gaps; it now reads `PULSAR_VARIANTS.turning.gaps`.

### Deferred
- **Expert's 80–100 s Rock Hauler turret phase** and **Blaster L2-only can't finish a boss** (T26): not addressed. L1 typical/expert timeouts are 0–4% in the 100-seed pass. A minimum-DPS floor (e.g. Blaster L1–2 gets a boss-damage multiplier, or turrets lose HP over time) is a design call for the user.

## Follow-ups
- Novice L4/L5 (see Gaps): hand-playtest before tuning further. If they're too hard for people, the cheapest levers are more shield drops and longer telegraphs, not fewer rings.
- L3 wave density (18 peak shots) can go up now that curved shots are read.
- The L3 pod is rarely rescued (27% typical): consider 3 HP, like L2's.
- `tests/sim/bots.ts` is now the place for new hazards. Each needs a cost term plus a `hitCause`.
- Expert-bot quirks (greed, replanning) make it a weak "expert". A better expert would need its own skill retune, which would break comparability with T18's L1 numbers.
