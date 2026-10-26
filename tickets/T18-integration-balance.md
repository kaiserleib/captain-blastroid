# T18 — End-to-end integration + balance pass
Status: done
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
- [ ] Fresh save: complete loop playable on desktop (mouse and keys) and phone (stick). *Desktop mouse and keyboard verified in Chrome (menus by real key presses and clicks, flight by a synthetic-mouse autopilot); phone stick not tested, which is T19.*
- [x] Clearing Level 1 the first time awards the Bulwark schematic. Rescuing the Level 1 pod unlocks Juno. Both appear correctly in the hangar.
- [x] No console errors through 10 consecutive runs (mix of deaths, clears, abandons).
- [x] Balance log and perf numbers recorded below.

## Contract changes
All additive:
- `sim/hooks.ts`: `registerTargetFilter(fn)` / `getTargetFilters()` (and `clearHooks` clears them). New `sim/targeting.ts`: `isTargetable(w, e)`, `targetFilterFor(w)`.
- `engine/events.ts`: comments only. `asteroidHit`, `weaponAdded` and `weaponLeveled` have no listener yet, and the comments say why.
- `audio`: new sfx ids `enemy_shot`, `boss_throw`, `armor_ping`; `SFX_LIMITS` (per-id voice caps); `VoiceLimiter.tryStart(id, now, dur, limits?)`; `perceptualGain`. `suspendAudio`/`resumeAudio` keep their names but now pause only the music.
- `gfx/palette.ts`: `snesChannel` export (the channel quantizer).
- `content/pickups.ts`: `PICKUP_TUNING.formationCapsuleGap`, `formationBonusSalvage`.

## Fixes
- **Seeker Pods targeted boss armor and the shielded core.** Seekers and homing retargets now go through `isTargetable`: zero-HP `isBoss` parts are skipped, and the boss registers a filter that hides untargetable parts and the whole rig while it is invulnerable (entry, iris opening, death). Tested in `boss.test.ts` and `sim/targeting.test.ts`.
- **`enemy_hit` and `boss_warning` sfx were never played.** No module emitted them. `attachAudio` now plays `enemy_hit` on `enemyHit` (voice-limited to 2 voices, 70 ms apart) and the siren on `bossWarning`.
- **Enemies fired silently, and boss throws and deflects had no sound.** Added the `enemy_shot` sfx (quiet, once per volley rather than per bullet, at most 2 voices 70 ms apart), plus `boss_throw` and `armor_ping` (pings rate-limited to one per 0.12 s inside the boss).
- **UI sounds went silent while paused,** because pausing suspended the whole AudioContext. Pausing now mutes the music bus and stops the music scheduler. On resume the song re-anchors at its cursor, so it continues where it stopped. Page visibility still suspends the whole context.
- **Music was too loud.** The volume sliders now use a squared gain curve (`perceptualGain`): music 0.35 is now about −18 dB instead of −9 dB, so the user's saved setting gets quieter without anyone touching it. The default SFX slider went from 0.8 to 0.9, which keeps the effects at almost their old gain.
- **Elite schematic drop could award a ship already in the save.** It now skips ships in `save.schematics`/`save.shipsBuilt`, the same rule the director uses.
- **Forced Spread capsule:** if T12's new capsule gap means no clear-capsule exists to rewrite, the director spawns the forced capsule itself.
- **HUD boss bar strobed white under steady fire.** A hit now tints the bar with the light boss color and a white highlight row only, for 0.08 s, at most once every 0.3 s.
- **First-use hitches:** `GameScene.enter` warms every gameplay sprite once per session (`PICKUP_SPRITE_IDS`, `WEAPON_SPRITE_IDS`, `ENEMY_SPRITE_IDS`, `BOSS_SPRITE_IDS`, `FX_SPRITE_IDS`), including flash and rotation sheets.
- **FX did not interpolate:** particles, smoke and fireballs drew at tick positions. At 120 Hz the fast sparks stepped every other frame. They now extrapolate back by `(1 − alpha)` of a tick, like every other layer. I audited the rest: player, shots, drones, enemies, boss, rocks, anomalies, pickups and background all interpolate `prev → current`.
- **Local 15-bit quantizers** in `portraits/palette.ts` and `backgrounds/color.ts` now use `gfx/palette` (`snes`, `snesChannel`). The rounding rule is identical, so the output is unchanged, and the portrait and background tests pass as before.
- **`?debug` overlay:** added a render-cost line (`RND avg/max ms`) and the live voice count (`VOX`). The input debug lines moved down one row to make space.
- **Menu buttons:** a right-aligned value that would come within 14 px of its label falls back to the small font (`ui/draw.drawButton`). I could not reproduce the reported Hangar PILOT/SHIP overlap at 240×400, 440 or 520 (the CAPTAIN BLASTROID value clears the label by about 60 px). The fallback guards against it anyway. I checked Title, Hangar, Pilot/Ship select (all 3 ships), Upgrades, Settings, Pause/Abandon and Results at h=400 and h=520 and found no clipping.

## Balance log
Measured with **`npm run sim`** (`tests/sim/harness.ts` + `balance.test.ts`; `RUNS=N` sets the count). It plays seeded headless runs with a heuristic bot that dodges by projecting threats, drifts under targets and grabs pickups. There are three skills: novice, typical and expert. They differ in reaction ticks, look-ahead, safety margin, a 0.15–0.45 s reaction delay to fresh enemy shots, the chance of overlooking a rock or enemy, aim noise and pickup greed. A "god typical" pass measures loadouts and boss time with no deaths. The default `npm run test` only runs one god-mode smoke run (level → boss → clear → `bulwark` schematic, with an upper bound on the weapon-level sum). T20 replaces this with the real harness.

**Before (merged waves 0–3, typical bot, 10 runs):** 10/10 clears. Weapon count by time 30/45/60/90/120/180 s was 2.2/3.2/3.2/3.6/3.9/4.0. At the boss it was usually four weapons, all L5 (level sum about 19–20). About 26 capsules spawned per run. Salvage on a clear was 430–840. Peak enemy shots were 18 in waves and 17 in boss phase 2. Boss times ran 31–111 s, and were bimodal.

**After (16 runs per skill):**
| | novice | typical | expert | god typical |
|---|---|---|---|---|
| reach boss / clear | 14/16 · 10/16 | 16/16 · 16/16 | 15/16 · 13/16 | 16/16 · 14/16 (2 timeouts) |
| hits in first 45 s (avg) | 0.81 | 0.13 | 0 | – |
| weapons @30/45/60/90/120/180 s | 1.7/2.0/2.1/2.4/2.6/3.0 | 1.8/1.9/2.1/2.4/2.6/3.4 | 2.1/2.2/2.5/3.1/3.4/3.5 | 1.9/2.1/2.3/2.7/2.8/3.2 |
| weapon-level sum at boss | 10.1 | 9.8 | 10.9 | 10.3 |
| capsules + cores spawned | 9.1 | 9.6 | 11.0 | 10.1 |
| boss time on wins (s) | 20–92, median ~50 | 27–104, median ~58 | 27–99, median ~50 | 24–89, median ~45 |
| salvage: clear / mid-death / boss death | 211–330 / 20–26 (deaths at 76 s) / 180–252 | 246–335 | 304–463 | 263–364 |
| peak enemy shots, waves / boss P2 | 36 / 35 | 35 / 36 | 33 / 35 | 35 / 35 |

Salvage on the clock (typical): about 26 at 45 s, 66 at 90 s, 103 at 120 s, 157 at 150 s, 232 at 180 s. A death mid-level (90–150 s) therefore banks about 70–160.

Against the targets:
- **New player reaches the boss on attempts 1–3 and beats it within ~5:** novice reaches the boss 88% of the time and clears 63%. Real first-timers are worse than this bot, so I expect it to land in range. Hangar upgrades after the first runs (plating +1 shield) are the safety valve.
- **About 3 weapons averaging L2–3 at the boss:** about 3 weapons with a level sum near 10, i.e. averaging just over L3. The bots grab more capsules than a human will, so I left it there.
- **Salvage 80–150 on a mid-level death and 200–300 on a clear:** a clear gives about 250–330 (typical bot about 290). A death at 90–150 s gives about 70–160. Deaths very early (at about 76 s) give about 25. The first upgrade (40–50) lands after 1–2 runs. Bulwark (150) is affordable right after the first clear.
- **Enemy shots peak at ~40 in waves and ~80 in boss P2:** I reached about 36 in waves and 35 in P2. **Judgment call:** I stopped at about 35 in phase 2. On a 240 px screen, 14-shot rings every 1.5 s already read as a curtain, and bots and expected humans already take most boss-phase hits from shots. T20 or the user can push `ring.n` and `ring.interval` further.
- **Boss in 60–90 s for a human with a typical loadout:** bot medians are about 45–58 s. Bots that hold position under the boss and don't lead do roughly what humans do. I expect humans to run slower, around 60–80 s.

Changes, before → after:
| What | Before | After | Why |
|---|---|---|---|
| Formation-clear capsule | every clear | at most one per **25 s** (`formationCapsuleGap`); a clear inside the gap sprays 1 salvage | ~30 formations dropped ~20 capsules; 4 weapons by 60 s |
| `common` drop weapon / upgrade weights | 2 / 3 | 0.6 / 1.2 | same |
| asteroid upgrade weights (medium/large) | 1 / 6 | 0.4 / 3 | same |
| `common` salvage weights (1 / 5) | 15 / 3 | 9 / 1 | salvage target |
| asteroid salvage weights small 1 · medium 1/5 · large 25 | 18 · 30/6 · 10 | 5 · 9/1.5 · 4 | storm rocks flooded salvage |
| boss salvage / shot-to-salvage cap | 100 / 40 | 50 / 20 | clear 200–300 |
| Swooper shot | 1 aimed | 2 aimed, 10° apart | waves too quiet (18 shots peak) |
| Gunboat fan | 3 × 36° | 5 × 56° | same |
| Interceptor interval | 2.0 s | 1.7 s | same |
| Rock Hauler turret / core HP | 135 / 270 | 120 / 210 | with fewer weapons the fight ran past 110 s and P2 stalled |
| Strafe period P1 / P2 | 6.5 / 4.2 s | 7 / 5.6 s | unled shots at a fast-sweeping core mostly missed (bots hit about 3 dps out of 13 in P2) |
| P2 ring | 8 every 2 s, 70 px/s, 15° step | 14 every 1.5 s, 70 px/s, 11° step | phase 2 needed density |
| Spread ttl | 1.05 s | 1.15 s | Spread from the bottom third couldn't reach the boss at y≈80 |
| Blaster L4 / L5 cooldown | 0.3 / 0.25 | 0.25 / 0.17 | L4–L5 should be a wall of fire |
| Spread L5 | 5-way, 0.45 s | 7-way ±36°, 0.40 s | same |
| Lance L5 cooldown | 0.8 | 0.55 | same |
| Seeker L5 | 4 missiles, 0.8 s | 6 missiles, 0.7 s | same |
| Drones L5 | 4 | 5 | same |
| Settings defaults | music 0.35 linear, sfx 0.8 | music 0.35 squared (−18 dB), sfx 0.9 squared (≈ old 0.8) | user: music too loud |

Unchanged on purpose: i-frames (1.0 s), player hitbox r 4, pickup radius, enemy HP, pity timer (25 s), `ownedWeaponBias` (0.5), the level timeline.

## Perf numbers
Desktop Chrome (M-series Mac, 120 Hz display), `?debug`:
- **Normal run, full level:** FPS 120, TPS 60. Sim tick averages 0.06–0.11 ms, with a 1 s window max of 0.2–0.8 ms. Frame render (draw plus present) averages 0.6–0.9 ms, with a max of 1.0–3.0 ms.
- **Stress (`?t=150&god`, all five weapons at L5 through the storm into the boss):** about 44–52 player shots. Tick averages 0.10–0.16 ms, max 0.3–0.4 ms. Render averages 0.8–1.0 ms, max 1.6–3.0 ms. The budget is 4 ms tick and 8 ms frame, so there is plenty of headroom.
- **Headless (Node, `npm run sim`):** a tick averages 0.004–0.008 ms. The worst single tick across 64 runs was 1.6 ms, a JIT or GC spike.
- Peak entity counts in the sim: 53 player shots (pool 400), 36 enemy shots, 21 enemies, 68 rocks.

## Verification
- **Browser (Chrome, port 5118, `?mute`, my own tab):**
  - **Full Level 1 from a fresh save** via Title → Hangar → Launch with an in-page autopilot driving real `pointermove` events. Forced Spread arrived at 20 s. The loadout at the boss was Blaster 2, Spread 3, Seeker 3. The boss fight took about 67 s and ended at 0 shields. Then SECTOR CLEAR: +285 salvage, **SCHEMATIC FOUND Bulwark, PILOT RESCUED Juno**, high score. In the Hangar, Juno is selectable in Pilot select, and Bulwark shows as a buildable schematic (150) in Ship select.
  - **10 consecutive runs, zero console errors** (`?t=176`, so each run starts at the boss): clear (Bulwark), abandon, death, clear (**Dart** schematic, the second clear), death, abandon, clear (no schematic left), death, abandon, clear. A `window.onerror`/`console.error` hook and `read_console_messages` both showed nothing.
  - **Display rate:** the display ran at 120 fps with TPS 60 throughout.
  - **Other screens:** the `?debug` overlay shows `RND`/`VOX`, and the menus at h=400 and 520.
- **Not verified:**
  - Listening. The tab was muted, so the new sfx, the music level and pause behavior are checked only in code. Whether the music now continues seamlessly after a pause needs a human ear.
  - A real phone or touch stick (T19).
  - Hand-played feel. The game was flown by the autopilot and the headless bot, not by hand in real time, because screenshot round-trips are too slow for that. The menus were driven with real key presses and clicks.
  - No-jitter at 120 Hz was checked by code audit and the 120/60 FPS/TPS readout, not by eye.

## Follow-ups (T19/T20)
- T20: replace `tests/sim/harness.ts` with the real harness. Its skill knobs are reasonable starting points. Boss phase 2 can stall (more than 120 s) for bots that don't lead their shots and carry Orbit Drones in place of a ranged weapon, about 2 timeouts in 16 runs.
- Orbit Drones contribute nothing at range against the boss. A drone-heavy loadout (e.g. Blaster 1 + Drones 5) can't finish the fight. Consider letting drones fire a weak shot at L4+, or giving the boss a dive or lunge.
- Peak enemy shots in boss phase 2 sit at about 35 against the ticket's ~80. Raise `ROCK_HAULER.ring` if the user wants more danmaku.
- The forced Spread capsule only appears if the player clears one of the first three formations. A player who misses all three (gnats lost to rocks) may reach 45 s with only the Blaster. I saw this in one autopilot run, which reached 59 s with Blaster 2 only.
- The high-score table records abandoned and very low-score runs (a 10-point death ranked #3). Consider a floor or excluding abandons (T05 `bankRun`).
- After Results, the hangar focuses the item under a stale mouse position. That's a mouse-hover artifact, and only matters for automation.
- The debug overlay text covers the top-left HUD shield pips (debug only).
- `?t=` gives the debug loadout to every run in the page session, so the results time reads 3:0x for skipped runs. That's expected.
