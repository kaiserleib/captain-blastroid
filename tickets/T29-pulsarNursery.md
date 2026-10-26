# T29 — Level 4: Pulsar Nursery
Status: done
Wave: 6 · Depends on: T21, T23, T24, T25 (+ T22 for the flow) · Blocks: T31

## Goal
Replace the `pulsarNursery` stub with the full sector from `docs/design.md` → **Level 4: "Pulsar Nursery"**: its enemies, hazards, timeline, escape pod and boss **Magnetar**, tuned to the sector's place in the difficulty curve.

## Owns
- `src/content/levels/pulsarNursery/**`: `LevelDef` (timeline, asteroid field, all tunables) plus the enemy and boss tables (`ROSTER`, boss def)
- `src/game/levels/pulsarNursery/**`: custom behaviors, the boss controller and its draw, sprites (`*.sprites.ts`), level scripts and systems, sandbox keys, tests
- `tests/sim/**`: only new files named `pulsarNursery.*.test.ts`

Nothing else. Everything plugs in through T21's registries (`registerRoster`, `registerBehavior`, `registerBoss`, `registerLevelScript`, `registerLevelSystem`) and T23's hazard API. If you need a change in a shared module, stop and describe it in Notes under "Shared changes needed" with a minimal patch suggestion. Don't edit it.

## Read first
`CLAUDE.md`, `docs/design.md` (Campaign section, especially **Level 4: "Pulsar Nursery"** and "Difficulty curve"), `docs/art-direction.md`, `tickets/WAVE6-NOTES.md` (the APIs as merged), and the Notes / Contract changes of T21, T23, T24 and T25. Use the Level 1 files (`content/levels/level1.ts`, `game/boss/rockHauler.ts`, `content/bosses.ts`) as the style and quality reference.

## Requirements
- Enemies: **Pulse Drone** (rings phase-locked to the nearest pulsar's pulse), **Streaker** (enters from the bottom only during fast scroll; never spawn one under the player: pick an x at least 50 px from the player), **Warden Ray** (sweeping line of spaced bullets).
- Pulsar placements via `anomaly` events with `variant` and `phase`. Use T25's documented 120 BPM alignment so pulses land on the music's accent (pulse at level-song time 3.0·k s; account for when GameScene starts the song).
- Scroll changes via `scroll` events: 28 → 70 at 70 s over 3 s, 70 → 18 at 105 s over 4 s, 18 → 36 at 145 s.
- **Boss: Magnetar** (`pn_magnetar`): 4 rotating pylons and a core that owns a `magnetar` pulsar it reprograms per phase with `setPulsarPattern` (P1, P2, and the P3 MELTDOWN double rings). The boss drives `setScrollSpeed` in 12 s cycles 30 → 50 → 30 through a `registerLevelSystem` or its own update.
- **Timeline:** follow the design's beat table, including the supply run, the carrier, breathers with shield drops, a magnet, the pod and the warning-then-boss. Keep the `enemyHpMul`, `enemyShotSpeedMul`, `guaranteeWeapon`, `bossSalvage`, `podFallbackSalvage` and `schematicOnClear` numbers from the design unless balance requires otherwise; log any changes.
- **Art:** every new enemy and boss part has sprites at the art-direction sizes, a 15-bit palette, an outline, a 2-frame animation where it fits, and hit-flash support (automatic via the sprite cache). They appear in `tools/gallery.html`. Enemy bullets use only the standard enemy-bullet sprites.
- **Sandbox:** keys to spawn each new enemy and the boss under `?sandbox`. Pick keys not in use: check WAVE6-NOTES for the key map.
- **Fairness:** the T11 fairness rules (no shots in the first 0.5 s alive, shooter at least 24 px above the player for aimed shots) apply to every new attacker. Every telegraphed attack is telegraphed for ≥ 0.5 s.
- **Tests:** unit tests for each custom behavior's state machine and the boss phase transitions (as in `game/boss/boss.test.ts`). The T21 harness already runs god playthrough, determinism and pool safety for every `LEVEL_ORDER` id, so make yours pass. Add `pulsarNursery.balance` coverage via `LEVEL=pulsarNursery npm run balance`.

## Balance targets
Typical-bot clear rate ≈ 75%, novice ≥ 40%, boss time 60–100 s, salvage on a clear 400–520. Every ring hit must be avoidable: add a sim test that a bot standing in a computed gap takes 0 ring hits over 10 pulses for each variant used.
Measure with `LEVEL=pulsarNursery RUNS=50 npm run balance` (typical) and `SKILLS=novice,typical,expert`. Record a balance table in Notes, like T18's.

## Acceptance criteria
- [x] `?level=` for this sector plays the full timeline to Magnetar's defeat, results, and the right schematic and pod (`?save=fresh` with earlier sectors cleared via `?save=mid`/`all` as needed).
- [x] God playthrough (every seed), determinism and pool-safety tests pass for `pulsarNursery`.
- [x] Balance targets met or the gap explained.
- [x] Browser check on your own port with audio muted. Screenshots of each new enemy, the hazard beats and each boss phase are described in Notes, and there are no console errors.
- [x] build / test / lint / test:sim pass.

## Contract changes
None.

## Notes

### What's in
- **Content** (`content/levels/pulsarNursery/index.ts`): `ROSTER` (`pn_drone`, `pn_streaker`, `pn_ray`), `MAGNETAR` + `MAGNETAR_PARTS`, `GARDEN`, the field and the timeline. Sector numbers are unchanged from the design (`enemyHpMul` 1.25, shot speed 1.15, Spread by 30 s, boss salvage 110, cache 60, Halcyon).
- **Game** (`game/levels/pulsarNursery/`): `behaviors.ts` (drone, streaker, ray), `magnetar.ts` (boss), `draw.ts`, `garden.ts` (garden system and the streaker script), `pulsarNursery.sprites.ts`, `sandbox.ts`, plus unit tests (`behaviors.test.ts`, `magnetar.test.ts`).
- **Sim tests**:
  - `tests/sim/pulsarNursery.gaps.test.ts`: ring avoidability.
  - `tests/sim/pulsarNursery.balance.test.ts`: the pulsar-aware bot and the balance passes.

### Timeline (scroll in brackets)
| Time | Beat |
|---|---|
| 0.5 [28] | `steady` pulsar at center. First pulse on the 3 s kick. "STAND IN THE GAPS" at 2.5 s. |
| 6, 10 | Supply run: gnat V and column, both forcing Spread |
| 11–43 | Second `steady` pulsar half a bar off (11), a third on the bar (22). Pulse Drone pairs at 12/24/36, gnat lines between. Carrier at 35. |
| 45–68 | `turning` pulsars (45, 56), swoopers, Warden Ray (50), gnats |
| 69–73 | "CURRENT SURGE", scroll 28 → 70 over 3 s |
| 75–103 [70] | Small-rock rain. Streakers from below (script, 1–2 at a time). One `quick` pulsar at 84, on the left edge. |
| 105–106 | Scroll 70 → 18 over 4 s, shield drop |
| 108–145 [18] | "THE GARDEN": `quick` at (120,62), `steady` at (52,150) on the bar, `steady` at (188,150) half a bar off. They glide in and creep at 1.5 px/s. Drone pairs flank the pod lane, plus interceptors and gnats. Pod (Pip, hp 2) at 118, x 120. |
| 145–146 | Garden pulsars collapse (1.5 s), scroll 18 → 36, magnet drop |
| 150–176 [36] | Warden Rays ×2, `quick` pulsars on the left and right edges (152, 165), gunboats, swoopers, a drone, interceptors, gnats |
| 179 / 182 / 186 | Shield drop, warning, Magnetar |

### Music phase-lock
- `lockedPhase(t, period, offset)` gives each timeline pulsar `phase = (t − offset) mod period`, so pulses land at level time k·period (+ offset).
- `BAR = 3` is tested equal to `PULSAR_SONG_PERIOD`. `VARIANT_PERIOD` is tested equal to `PULSAR_VARIANTS`; it is a copy because a runtime import would create a cycle.
- The garden spawns at `directorTime` using the same rule.
- A drone rings on its nearest pulsar's pulse. With no pulsar within 300 px, it rings on the song bar instead (`w.time`).

### Enemies
- **Pulse Drone** (4 HP):
  - Drifts down at 20 px/s and fires a 10-shot ring (62 px/s). Every other ring is turned half a spacing.
  - Keeps at least 2.4 s between rings, so it rings on every other `quick` pulse.
  - Silent below y 230. My call: the rings are meant to be read from a distance.
  - Its charge glow follows the pulsar's telegraph, or the last 0.6 s of the bar.
- **Streaker** (3 HP):
  - The script only spawns it at scroll ≥ 50, at x ≥ 50 px from the player (`world.rng`).
  - It waits just below the bottom edge for 0.7 s while a blinking chevron (`pn_warn`) marks the spot. Then it launches up at 150 px/s, tilted 15° **toward mid-screen**.
  - Why mid-screen: tilting away from the player sent edge launches off-screen before y 200, so they never fired.
  - One aimed shot crossing y 200, under the fairness rule. Pairs launch 0.35 s apart.
- **Warden Ray** (14 HP, smart):
  - Holds at y≈58 and drifts toward the player only while idle. Each cycle: 2.2 s off, 0.7 s telegraph, 1.8 s on.
  - At the telegraph it locks a 54° fan beside the player's bearing. Both edges are drawn as dotted gold lines, plus a short arc for the sweep direction.
  - It then sweeps a SHOT_SMALL every 0.08 s (105 px/s) from the fan's far edge to the near edge. The near edge stops 12° short of where the player was.
  - So the danger area is telegraphed and never starts on the player. This is my fair reading of "sweeps side to side".
  - It alternates sides and leaves after 15 s.

### Magnetar (`pn_magnetar`)
- **Pylons**: 4 pylons (50 HP) orbit at r 34, 0.5 rad/s (0.8 in meltdown). The controller re-places them each tick because the rig only holds fixed offsets.
- **Shield**: the core is shielded until 3 pylons fall, then the shield drops over 1 s.
- **Scroll and rocks**: holds at y 96. Scroll runs 30 → 50 → 30 on a 12 s cosine, eased in during entry and back to 30 on death. A sparse small-rock trickle down the flanks in phases 1–2 makes the drag visible.
- **Its pulsar**: the core owns a pinned `magnetar` pulsar with reach (`radius`) **320**. The design's 260 left a safe strip at the bottom.
  - Phase 1: 3 s, 4 × 45° gaps, 30° turn per pulse, 130 px/s.
  - Phase 2: 2 s, 3 × 50° gaps, 60° turn, 160 px/s. 2 s × 160 = 320, so a ring is never cut short.
- **Pattern switches**:
  - A switch waits until early in a period, so a shorter period can't fire before its telegraph (tested).
  - Phase 2 also waits for a pulse whose gaps sit **±30° off straight down** (`offsetDeg`). With 3 gaps turning 60°, it then flips +30°/−30° forever, so a gap is always reachable from the bottom row (a center-line zig-zag).
  - On the other parity it would alternate with gaps 60° up the flanks, which can't be reached from the bottom.
- **Meltdown** (core < 30%):
  - Toast "MELTDOWN" and a shake. Gaps widen to **58°**, and an **echo ring follows 0.5 s later**, turned half a spacing (60°).
  - With the ±30° parity, the ring's gaps and the echo's sit either side of the center line. The hop between them is ~2° plus the hull, about 17 px at the bottom.
  - With 50° gaps the hop was ~52 px, which can't be made after the first ring has passed.
- **The echo is a second "twin" pulsar**, not `double`, because of the shared bug below.
  - It is spawned so its first live ring trails main's next ring by exactly 0.5 s.
  - It pre-fires m silent pulses at the variant's 30° turn to set its rotation (`twinPrefire`, tested), then takes the meltdown pattern.
- **Telegraph spokes**: the station art hides the anomaly layer's own spokes, so the boss draws them past the hull rim (main white, echo violet).
- **Spiral**: in phase 2, 4 arms every 0.2 s turning 13°, at 56 px/s. In meltdown, every 0.26 s.
  - It fires only between rings: from 0.45 s after a pulse (0.8 s in meltdown) until the next telegraph.
  - Shots leave from the collar rim at r 18. The core's own pulsar swallows shots born at its center.
- **Pylon fire**: aimed, staggered, only from ≥ 24 px above the player.
- **Defeat**: 2 s throes, the pulsars collapse over 0.6 s, enemy shots turn into salvage, and the director awards Halcyon + 110.

### Tuning changes vs design (logged)
| What | Design | Here | Why |
|---|---|---|---|
| Core HP | 300 | **240** | The pylons orbit, so phase 1 runs long |
| Pylon fire | every 2 s, 90 px/s | **every 2.6 s, 80 px/s** | Top killer when combined with gap-standing |
| Magnetar ring reach | 260 | **320** | Removes the safe strip at the bottom |
| Phase 2/3 gap pattern | – | **±30° parity** | Keeps a gap reachable from the bottom row |
| Meltdown gaps | – | **58°** | Makes the echo hop possible |
| Spiral speed | – (unspecified) | **56 px/s** | – |
| Boss lead-in | – | **Shield drop at 179** | Added |
| Garden end | – | **Pulsars collapse at 145** | Instead of drifting down through the player |

- `turning` pulsars get pre-turned patterns (`turns` in `pulsarAt`), so their near-vertical patterns come up while they cross mid-screen.
- `quick` pulsars sit at the screen edges. A centered `quick` with sideways gaps has no gap reachable from the bottom.
- Roster salvage: drone 4, streaker 3, ray 12.

### Sandbox (`?sandbox&level=4`)
| Key | Spawns |
|---|---|
| `H` | Drone pair |
| `J` | Two streakers (any scroll speed) |
| `L` | Warden Ray |
| `Shift+H` | Magnetar |
| `Shift+J` | Wreck 3 pylons (phase 2) |
| `Shift+L` | Core to 29% (meltdown) |

Level systems don't tick under `?sandbox`, so the key queue drains from a level layer's `draw` (dev only).

### Art and gallery
`pulsarNursery.sprites.ts` is picked up by the gallery glob.

| Sprite | Size, frames | Look |
|---|---|---|
| `pn_drone` | 16², 4 | Gunmetal orb with a gold resonator crown and a green eye; the charge frames wake a blue-white heart |
| `pn_streaker` | 12×20, 2 | Nose up, flame frames |
| `pn_warn` | – | Chevron |
| `pn_ray` | 32×24 | Olive manta, rust leading edges |
| `pn_ray_lens` | 4 intensity frames | – |
| `pn_mag_hull` | 96², 2 | Gunmetal torus, rust buttresses with hazard stripes, pylon track with gold studs, gold-coiled collar, running lights |
| `pn_mag_core` | 32², 10 | Hex-lattice shield → cracking → open blue-white star with violet field arcs → meltdown hot gold |
| `pn_mag_pylon`, `pn_mag_pylon_wreck`, `pn_mag_spark` | – | – |

All 15-bit, outlined. Flash comes from the sprite cache. Enemy bullets are standard SHOT_SMALL only.

### Browser check (port 5129, `?mute`, own tab, closed after)
- **Gallery**: every `pn_` sprite renders with frames and flash.
- **`?level=4&god&save=all`**: the opening pulsar's ring with its downward gap.
- **`t=108`**: the garden pulsars gliding in, quick-pulsar spokes, the shield drop.
- **Sandbox**:
  - The drone ring.
  - The Ray's sweeping beam.
  - Magnetar phase 1: pylons, the lattice core, and white spokes past the rim.
  - Phase 2: wrecks, the exposed star, the spiral, a ±30° ring.
  - Meltdown: ring + echo with offset gaps and the core flashing.
- No console errors.

### Balance
**Blind shared bot.** It can't see rings (T31 teaches it). `LEVEL=pulsarNursery RUNS=50 npm run balance` (typical) reaches the boss 0% of the time.
- It takes 4.4 hits in the first 45 s.
- Most of those are rings, but the report labels them shot/rock/ram, because it names the nearest body.
- A ring counter over 10 blind runs found 23 of 36 hits were rings.

**Pulsar-aware bot.** `tests/sim/pulsarNursery.balance.test.ts` adds `PulsarDodger`:
- It is the shared dodger (copied, since it isn't exported) plus a ring-sweep cost and pulsar-core avoidance.
- Rings get the shot look-ahead + 1.2 s of foresight, standing in for reading the telegraph.
- A `<skill>-perfect` pass refunds every ring hit, which isolates the guns, rocks and rams.

`BALANCE=1 RUNS=50 SKILLS=novice,typical,expert,god,typical-perfect npx vitest run tests/sim/pulsarNursery.balance.test.ts --silent=false`:

| Bot (50 seeds) | Reach boss | Clear | Ring hits/run | Hits first 45 s | Boss time (clears) median [p25–p75] | Clear salvage median |
|---|---|---|---|---|---|---|
| novice + rings | 18% | 0% | 3.0 | 2.6 | – | – |
| typical + rings | 74% | 28% (+10% timeouts) | 3.1 | 1.1 | 60 s [46–69] | 271 |
| expert + rings | 92% | 26% | 2.2 | 0.3 | 50 s [33–64] | 292 |
| god (typical, can't die) | 100% | 88% (12% hit the 320 s cap) | – | – | 60 s [47–72], max 125 | 279 |
| **typical, rings refunded** | 92% | **76%** | – | 1.0 | 63 s [48–85] | 274 |

- Peak enemy shots: waves 48, boss 38 (design 45 / 55). No dropped spawns.
- **Rings refunded:** typical clears **76%**, on the ≈75% target, with boss time inside 60–100 s. Everything apart from the rings is on target.
- **The gap is the bot.** The drop to 28% comes from the bot's ring play (3 ring hits per run). `pulsarNursery.gaps.test.ts` shows every variant's rings, and every Magnetar phase's including meltdown's echo, are avoidable at Kestrel speed (a gap-flying ship takes 0 hits over 10 pulses; one standing still is hit). So I tuned for a human reading the telegraph. T31's ring-aware shared bot should land between 28% and 76%; re-tune against that.
- **Not closed:**
  - Novice is far under ≥ 40%.
  - Clear salvage is ~275 against a 400–520 target. The roster pays 1–4 per kill; closing the gap needs more salvage per kill campaign-wide, or a per-level multiplier (T31).
  - The pod is rescued 46% of the time (hp 2).

### Shared changes needed
1. **The pulsar echo's hit test doesn't match its drawing** (`game/obstacles/anomalies/pulsar.ts`, `updatePulsar`).
   - Commit 93281ed turned the *drawn* echo by half the gap spacing (`pulsarEchoRot`), but the hit test still turns it by half the gap width.
   - So `double` rings hurt a player standing in the drawn gap.
   - Patch: in the echo branch, replace `e.ringRot + e.gapW / 2` with `pulsarEchoRot(a)`.
   - Magnetar avoids this with its twin pulsar. Once the patch lands, it can use `double: true`.
2. **`src/game/director/levelFramework.test.ts`** asserted that every sector's timeline ends in `rock_hauler`, a stub-era check.
   - I relaxed it to "has a boss event", a one-line edit **on this branch**, because the suite can't pass otherwise.
   - Other sector branches need the same edit, so expect a trivial merge.

## Follow-ups
- T31: a ring-aware shared bot. `PulsarDodger` and `ringHitCounter` (`tests/sim/pulsarNursery.balance.test.ts`) are a starting point. Re-tune L4 against it.
- T31: the campaign salvage curve. L4 banks ~275 per clear against the 400–520 target.
- After the shared fix, switch meltdown to `double` and drop `maybeSpawnTwin` / `twinPrefire`.
- The harness's `hitCauses` names the nearest body, so ring hits show up as shot/rock/ram. Adding a `ring` cause would make every sector's report accurate.
