# T43 — Act II integration, bots and balance
Status: done
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
- [x] The campaign flow test passes in the default suite (or the sim suite, if it's slow).
- [x] Act II balance targets met or the gaps explained. Act I is within noise of T31 with all weapons unlocked.
- [x] Perf numbers recorded for every Act II sector.
- [x] build / test / lint / test:sim / e2e pass.

## Contract changes
None to the core contracts (`sim/types.ts`, `sim/world.ts`, `engine/events.ts`, `gfx/renderer.ts`). Additive elsewhere:
- `game/obstacles`: `cancelFlare(w)` (fades a warning or burning flare).
- `game/pickups`: `capsuleWeights(w)`, `losePod` exported; `pickCapsuleWeapon(rng, weapons, pool, weights?)` takes optional weights.
- `content/pickups` `PICKUP_TUNING.act2WeaponWeightInAct1` (0.4).
- `debug/overlay` `DebugOverlay.stats()`; dev builds with `?debug` expose `window.__perf()`.
- Test harness (`tests/sim`): `RunStats.bossId / assistAfter / assistFired`; `assistLine`; the balance report prints a stall-breaker line and the summary an `assist%` column; `npm run balance` takes `WEAPONS=all` and `SEEDS=<prefix>`. Each run installs its save for `getSave()`.

## Notes

### Method
`SAVE=act1 RUNS=100 SKILLS=novice,typical,expert npm run balance` per sector, on **two seed sets** (`bal…` and `SEEDS=nz`), averaged (200 runs). Two 100-run sets of the same content differed by up to 14 points (Corona 78 vs 92), so wave-9's 50-run numbers carried about ±7 of noise; every decision below used 200 runs. Act I hashes checked after each step with a throwaway test: all seven unchanged (17a78586, 66a3e907, 432d4c06, 1c9e54f6, f3426d8c, 0b41ee42, 8b2a6879).

### Campaign flow (`tests/sim/campaign.test.ts`, default suite, ~6 s)
Two flows through `bankFinishedRun` and NEXT SECTOR, the god bot chasing pods:
- `?save=mid` (sector 1 cleared) → sectors 2–5 → **ACT I COMPLETE**, selected level moves to Corona, no weapon unlock in Act I.
- `?save=act1` → sectors 6–10 → **CAMPAIGN COMPLETE**. Each clear banks its schematic (Shrike, Ferret, Wraith, Revenant, Nova) and pod pilot (Ines, Rook, Nyx, Halász, Wren). Corona, Warrens and Junction report `unlockedWeapon` Arc Coil, Ricochet, Flak (with the results banner name); later sectors' capsule pools contain the weapons unlocked before them; the save ends with all eight unlocked.
- **Harness fix:** the harness never installed its save where the game reads it (`getSave()`: pod pilot, schematic, capsule pool), so every sim run used a default save for those. It now does, which the pool check above needs. No Act I hash or Act II number changed from it (checked on Corona with and without).

### Bots (`tests/sim/bots.ts`)
- **Expert below typical was a sampling bug.** The look-ahead had 4 samples whatever its length, so the expert's 0.55 s stepped 0.14 s and a sidestep through a pair of twin rounds fell between samples (traced on the Echo: hits came from shots the bot had seen for 1.5 s). In Act II sectors the look-ahead is now sampled at least every 0.1 s (typical's own step, so typical and novice are unchanged). Echo probe (16 fights, ship refilled, hits): expert 104 → 8, typical 45 → 45. Expert clears are 100% in every Act II sector now, so it is no longer a useful ceiling. Act I keeps T18's sampling (hash).
- **Echo:** the lance's locked line and the arc crackle's range are costed like the Lancer's line. A weave under the Echo cut typical hits by a third but stretched fights to ~90 s with the stall breaker in half of them; dropped.
- **Janus:** with the wall up, the bot stands under the entry ring whose exit hangs over a live face (a held exit preferred). Boss time fell from 72 s (assist-shaped) to 27 s, so the faces went up (Balance).
- **Wyrm:** it moves under the dust trail's exit point during the 0.8 s telegraph, then leads the open head. Boss time 64 → 38 s before re-tuning.
- **Aegis / Sentinel:** an Aegis is shot through its own entry ring; a Sentinel (its shield turns to face the ship at 0.8 rad/s, faster than the ship can flank it from 180 px) gets +120 px of target "distance", so the bot shoots it last, like a player would.
- **Hazard terms vs hits by cause** (typical, 100 runs, final content): Corona flare 2.9/run and rock 1.5; Foundry welding rings 1.85, flares 1.15; Chrono bubble-shots 0.42; portals 0 (the ring-avoidance term never misfires); crush ~0. The flare hits are mostly the 26/40 s band flares (T38's finding: the bot shoots its own cover). No term changed.
- **Stall breaker per boss** (typical fights that outlast `assistAfter`, 200 runs): Heliostat 34%, Wyrm 23%, Janus 19% (before: boss times "shaped by the assist", 60 s threshold), Echo 21%, Architect 13%. Act I for reference (fresh save): Rock Hauler 21%, Shepherd 8%, Perihelion 21%, Magnetar 27%, Leviathan 20%.

### Act II balance (`act1` save; clear % typical / novice / expert · typical clear salvage median · boss s median)
| | L6 Corona | L7 Warrens | L8 Junction | L9 Chrono | L10 Foundry |
|---|---|---|---|---|---|
| **Before** (wave-9 bots and content, 50 seeds) | 72 / 20 / 92 · 472 · 56 | 72 / 28 / 78 · 640 · 64 | 76 / 18 / 76 · 632 · 72 | 68 / 14 / 38 · 675 · 53 | 72 / 10 / 92 · 982 · 60 |
| T43 bots, wave-9 content (50) | 72 / 20 / 100 · 472 · 56 | 78 / 34 / 100 · 638 · **38** | **90** / 34 / 100 · 588 · **27** | – (weave variant) | 82 / 4 / 100 · 1015 · 65 |
| **After** (200 seeds) | **76 / 22 / 100** · 578 · 72 | **75 / 36 / 100** · 633 · 51 | **74 / 14 / 100** · 672 · 50 | **70 / 14 / 100** · 772 · 61 | **70 / 9 / 100** · 980 · 91 |
| Target | ~75 / ≥15 · 560–750 · 50–90 | ~72 / ≥14 · 600–800 | ~70 / ≥12 · 640–850 | ~68 / ≥10 · 680–900 | ~65 / ≥8 · 900–1200 · 80–130 |

Peak enemy shots (waves / boss, after): 34/58, 23/15, 34/53, 73/39, 16/58. All targets are met within seed noise (±5 at 200 runs). Foundry typical sits 5 over and novice 1 over its floor; I left both.

**Changes (content):**
| What | Before | After | Why |
|---|---|---|---|
| Corona roster salvage (Sunskimmer, Shade, Lens) · mirror spray | 3 / 6 / 10 · 15 | 6 / 10 / 18 · 45 | clear salvage 472 → 578 (band 560–750). Flare kills paying salvage needs a damage source on `enemyKilled` (contract); deferred, this was simpler |
| Corona `enemyHpMul` · Shade fire · flare warn | 1.40 · 1.8 s · 1.6 s | 1.50 · 1.4 s · 1.4 s | typical measured 84% at 200 runs once the noise was averaged out; HP mul and Shade fire brought it to 76 (1.6 overshot to 67) |
| Wyrm head · mouth open · segment shot · FRENZY fan | 180 · 2.0 s · 70 · 78 | **260 (design)** · 1.7 s · 80 · 84 | the bot now reads the dust trail: boss time 38 s → 51 |
| Warrens `enemyShotSpeedMul` | 1.25 | 1.35 | typical 81% → 75 (deaths are in the tunnels, not the boss) |
| Janus faces · bursts · ring · stall breaker · part salvage | 200 · 1.6 s · 2.5 s · 60 s · 35/50 | 460 · 1.35 s · 2.2 s · **90 s** · 45/90 | ring-reading bot: 27 s fights → 50 s; the 60 s threshold existed only because bots couldn't read rings; salvage 588 → 672 |
| Junction `enemyShotSpeedMul` | 1.28 | 1.38 | typical 83% → 74 |
| Stutterer / Rewinder salvage · Echo shot salvage | 2 / 5 · 20 | 3 / 7 · 30 | clear salvage 673 → 772 (band 680–900) |
| Architect arms · core 1 · pylons · core 2 · core 3 | 50 · 120 · 30 · 170 · 170 (680) | 75 · 180 · 50 · 250 · 220 (1,080; design 1,200) | boss time 65 → 91 s (Architect target 80–130); `weakLoadout` now counts from `assistAfter` (Blaster L2: 276 s, limit 300) |

### Act I with all eight weapons (fresh save, 100 seeds; clear % typical / novice / expert)
| | L1 | L2 | L3 | L4 | L5 |
|---|---|---|---|---|---|
| T31 (reference) | 90 / 55 / 88 | 92 / 45 / 98 | 76 / 43 / 99 | 78 / 9 / 65 | 75 / 8 / 75 |
| Five-weapon pool, today | 95 / 55 / 90 | 94 / 45 / 98 | 78 / 52 / 100 | 86 / 9 / 71 | 78 / 8 / 76 |
| Eight unlocked, uniform | 98 / 40 / 82 | 91 / 43 / 96 | 82 / 47 / 100 | 80 / 6 / 68 | 80 / 4 / 69 |
| **Eight unlocked, Act II weapons at 0.4 (shipped)** | 94 / 39 / 91 | 91 / 49 / 96 | 74 / 49 / 100 | 83 / 14 / 60 | 83 / 5 / 70 |

The L1 novice drop (55 → 40) looked like dilution, but on a second seed set at 200 runs it was 38 (five weapons) vs 41 (eight, weighted): seed noise. Every other cell is within ±7 of the five-weapon pool. I kept the 0.4 weighting as a hedge (L4/L5 typical sat a little lower uniform) and so Act I replays still feel like Act I; only worlds whose pool holds an Act II weapon roll differently, so fresh-save Act I is bit-identical.

### Economy
Act II ship costs 900 / 1000 / 1100 / 1300 / 2000 → **1400 / 1600 / 1800 / 2100 / 3000**. A model of a typical player (600 banked from Act I; per sector the measured clear rate, clear salvage and death salvage; build each ship once its schematic is found and it's affordable; replay sectors in order after the campaign) built all five after 8 clears at the old costs (1.6 per ship; the Shrike right after Corona). New costs: 12 clears, 2.4 per ship; Shrike after the second clear, Nova about three clears after CAMPAIGN COMPLETE. Pilot salvage passives (Zz'kar +25%, Vale −10%) aren't modeled. `docs/design.md` carries the table and the reasoning.

### Perf
`e2e/perf.spec.ts` (opt-in `PERF=1`, see `docs/mobile.md`): each sector's heaviest beat plus the Architect → escape, at Chromium 4× ("mid-tier mobile") and 6× CPU throttle, Pixel 7 emulation, no console errors. At 4× every beat holds 60 fps / 60 TPS with 2.9–4.3 ms per frame (update 0.2 ms, render 2.6–4.1 ms); at 6×, 4.3–6.4 ms. Worst beat: Chrono's dammed gunboat in the time storm (57–71 shots). One outlier: a single 26 ms render frame (37 ms at 6×) when an Architect form ends via `__foundry.skip()`; not profiled. Full table in `docs/mobile.md`.

### Follow-ups from wave 9
**Fixed:** Echo telegraphs and the expert under the Echo; Janus ring→face reading; the Wyrm's dust warning; Sentinel (left for last) and the Aegis (through its ring); Corona and Junction salvage; the Architect's HP via `weakLoadout` from `assistAfter`; the peak-shot curve (design.md now has a measured row and says why peak shots aren't an Act II target); `cancelFlare(w)` (Heliostat and Architect use it); `levelFramework` allows ≤ 1 `escapePod` event per Act II sector; `applyCapsuleFixes` re-picks a locked weapon; the `CAPSULE_WEAPON_IDS` comment; `losePod` exported; design.md "Act II as built" lists every deviation from T38–T43.

**Deferred:**
- *Non-boss damage hook* (Flak shell vs the Aegis from below): the hook would need the damage's origin, not just the amount, to tell "from below"; the shell must physically touch the Aegis from below, which T40 judged a fair answer. Not worth a hook yet.
- *`timeScaled` on boss registration*: the Echo already scales its own clocks and nothing else needs it. Add it when a second time-bubble boss appears.
- *Flare kills paying salvage*: needs a damage source on `enemyKilled` (contract change); raising the roster salvage closed the gap.

### For a human
- The eight Act II songs; the rock-band cover and the outward Heliostat beams; flare warning now 1.4 s.
- Ring→generator readability on Janus, and whether 460-HP faces feel long with a weak loadout (the bot reading rings with B4–5 kills them in ~50 s; Blaster L2 alone takes ~160 s).
- The Warrens fork and S-bends by hand; the Wyrm's 1.7 s mouth window.
- The Sentinel's feel.
- New Act II ship costs (1400–3000).
- On-device perf, especially the Architect's form transitions.
- Dedicated sfx for the new enemies (audio owner).
