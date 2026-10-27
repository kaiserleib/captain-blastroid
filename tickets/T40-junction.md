# T40 — Level 8: Wormhole Junction + Janus
Status: done
Wave: 9 · Depends on: T32, T33, T35, T36, T37 · Blocks: T43

## Goal
Replace the `junction` stub with the full sector: portal pairs that teleport shots, rocks, pods and the ship, and an enemy roster that teaches shooting through them. Everything is specified in `docs/design.md` → **Level 8: "Wormhole Junction"**, tuned to the sector's place in the Act II difficulty curve.

## Owns
- `src/content/levels/junction/**`: the `LevelDef` (timeline, asteroid field, all tunables) plus the enemy and boss tables
- `src/game/levels/junction/**`: custom behaviors, the boss controller and its draw, sprites, level scripts and systems, sandbox keys, tests
- `tests/sim/**`: only new files named `junction.*.test.ts`

Nothing else. Everything plugs in through the T21 registries, the wave-8 APIs (T33 portals, T35 weapons) and `registerTimelineAction`. If you need a shared change, describe it under "Shared changes needed" in Notes with a minimal patch and work around it locally.

## Read first
`CLAUDE.md`, `docs/design.md` → "Campaign: Act II" (especially **Level 8: "Wormhole Junction"** and "Act II difficulty curve"), `docs/art-direction.md`, `tickets/WAVE9-NOTES.md` (the wave-8 APIs as merged), and the Notes of T32, T33, T35, T36 and T37. Use T27–T30 as the reference for quality and for how a sector folder is laid out.

## Requirements
- **Enemies:** **Blinker** (`portalOptIn`, a 0.5 s exit flash before its burst), **Gate Pylon** (carries a pair end with `setPortalEnd`, collapses its pair on death), **Aegis** (a front shield that absorbs shots arriving from below its centerline; shots from portals above, side-angled Ricochet discs, Seekers, Arc Coil and drones get through). Numbers from the design.
- **Teaching beat at 25 s:** the first Aegis with its portal pair placed so that shooting into the low ring lands shots on its back. Assert in a test that a straight-up stream into the ring damages it.
- **Pod (Nyx):** comes out of a portal mid-screen and is carried through rings it drifts into.
- **Boss: Janus** (`wj_janus`, about 128×64): the portal wall, two faces hittable only through the rings, ring generators holding the exits, phase 2's drifting rings and 6 s swaps, Blinker spawns, and the silent wall-flicker assist (40 s without a face hit, then 3 s off every 10 s).
- **Timeline:** follow the design table, including the Flak field test, the carrier, breathers, the magnet, the junction rush and the vertically stacked feedback loop.
- **Art:** every new enemy and boss part has sprites at the art-direction sizes: 15-bit palette, outline, 2-frame animation where it fits, hit flash from the sprite cache. They appear in `tools/gallery.html`. Enemy bullets use only the standard enemy-bullet sprites.
- **Sandbox:** keys from WAVE9-NOTES to spawn each new enemy and the boss under `?sandbox`.
- **Fairness:** the T11 rules (no shots in the first 0.5 s alive; aimed shots only from ≥ 24 px above the ship) apply to every new attacker, and every telegraphed attack is telegraphed for ≥ 0.5 s.
- **Tests:** unit tests for each custom behavior's state machine and the boss phase transitions. The harness's god playthrough, determinism and pool safety must pass for `junction`. Add a `tests/sim/junction.sector.test.ts` god run that asserts the sector's signature beats (listed above) actually happen.

## Balance targets
With `SAVE=act1`: typical-bot clear ≈ **70%**, novice ≥ 12%, boss time 50–90 s for the typical bot, salvage on a clear 640–850.
Measure with `LEVEL=junction SAVE=act1 RUNS=50 SKILLS=novice,typical,expert npm run balance` and record a balance table in Notes, like T27's. If a number is off only because a bot is blind to something, show the evidence (hits by cause) and tune for a human.

## Acceptance criteria
- [x] `?level=8&save=act1` plays the full timeline to the boss's defeat, results, and the right schematic, pod, and the Flak unlock.
- [x] God playthrough (every seed), determinism and pool safety pass for `junction`.
- [x] Balance targets met or the gap explained.
- [x] Browser check on your own port with `?mute`: each new enemy, each hazard beat and each boss phase is described in Notes, with no console errors.
- [x] build / test / lint / test:sim / e2e pass.

## Contract changes
None. Everything plugs in through existing registries: `registerRoster/Behavior/EnemyDraw`, `registerBoss` (with `assistAfter`), `registerLevelScript/System/Layer`, and one `registerCollisionPass` (a no-op for worlds that never met a junction enemy or script).

## Notes

### What's in the folders
- `content/levels/junction/`: `index.ts` (field, timeline, `JX_SCRIPTS`), `roster.ts` (Blinker, Pylon and Aegis params, `AEGIS_BYPASS`), `janus.ts` (every boss number).
- `game/levels/junction/`: `behaviors.ts` (Blinker, Gate Pylon, Aegis and their draw hooks), `janus.ts` + `janus.draw.ts`, `pass.ts` (the collision pass), `scripts.ts` (level scripts and the `junction` level system), `state.ts` (per-world side tables), sprites (`junction.sprites.ts`, `janus.sprites.ts`; `paint.ts` is copied from Ion Shoals), `sandbox.ts`, `junction.test.ts`.
- `tests/sim/junction.sector.test.ts`: a god run asserting the beats, plus the teaching-beat assertion with the full system list.

### Decisions
- **Aimed exits.** T33 portals keep a body's velocity, so a straight-up stream leaving an exit *above* a target keeps going up and never hits its back. The sector adds "aimed exits" (`aimExit` in `state.ts`): a player shot that just left such an exit (prev = pos, exactly r + 2 px from it) is turned toward the exit's target (or straight down for a free exit), keeping its speed. Only player shots are turned; enemy shots, rocks and pods behave as T33 portals. The Aegis's exit and Janus's two exits are aimed.
- **Aegis shield** (in the junction pass): absorbs a player shot touching the Aegis when the shot is below its centerline and heading up. These get through: shots from above (the aimed exit), `seeker` shots, Ricochet discs with |vx| ≥ 0.25 |vy| (all of them, at ±20°), and Arc Coil and Orbit Drones (they call `damageEnemy` directly, with no bullet). Each Aegis owns its pair (entry at `lowY` 240, exit 30 px above it); the pair collapses when the Aegis dies or leaves. It fires a 5-way fan every 2 s at 72 px/s (×1.28), holds 14 s, then climbs away. Drop table `elite`, so the lesson pays.
- **Blinker:** opts into portals and dives (120 px/s) at the nearest ring whose *partner* is at least 90 + 30 px above the ship. It detects its own teleport (a jump of more than 12 px between ticks), holds 1.2 s (a 0.5 s strobing ring, then an aimed 3-burst through `canFire`), and dives again, never straight back into the exit it used. After 3 dives it swoops. With no usable ring within 0.9 s, it swoops.
- **Gate Pylon:** carries its end 24 px beside it (toward the middle), so shots at the pylon don't vanish into its own ring. It drifts 12 s, not 16, so the 75–110 s pylons free their pair slots before Nyx's pod chain needs two. Drop table `elite` (gate hardware).
- **Janus geometry:**
  - Faces at (±30, −4); generators at (±80, +36), just outside the wall's ends. The wall is 144 px wide, 34 px under the center. The ship is held 26 px under the wall, so generator bursts always come from ≥ 24 px above it.
  - Entry rings are fixed left and right at x 40 and 200, **y 232**. The design says ≈260, but at 260 the ship's muzzle sits inside the ring at the usual hover height, and a shot spawned inside a ring never crosses into it.
  - Exits sit at y −3. Their centers are off screen, so the entries are closed to the ship (no teleporting behind the wall).
- **Only shots reach the faces.** With the wall up, a face's `onDamage` is absorbed unless a player bullet is touching it; otherwise Flak shell contact bursts and Arc Coil arcs would slip through. The wall also erases Flak fragments above it (shells aren't portal bodies, so nothing legit bursts there). Faces are auto-targets (seekers, arcs, drones, the bots' "drift under") only while the wall is down or once both generators are gone.
- **Generators** fire the aimed 3-bursts, taking turns every 1.6 s. A wrecked one lets its exit wander ±34 px over its face, and that exit turns shots straight down instead of onto the face. The bursts end with the generators. Wrecked parts spray salvage (35 per generator, 50 for the first face). The design gives no part reward; this pays for the risk of losing the held exits and brings clear salvage into the band.
- **Phase 2 (frenzy):** the entries drift on Lissajous paths across x 36–204 (y ±12), and the pairs swap every 6 s through `swapPortals` (its 0.8 s flicker). The surviving face fires a 4-arm spiral in bursts (1.6 s on, 1.8 s off). Blinkers come out of the top exits every 8 s. The 16-ring is phase 1 only.
- **Silent assist.** The design's "40 s without a face hit" is measured as **less than 60 damage landed through the rings over the last 40 s** (40 one-second buckets). With a plain "any hit" rule, stray hits through a drifting ring kept resetting the timer, and blind runs timed out in phase 2. Once triggered, the wall drops for 3 s in every 10 s. Direct hits during a window don't count as ring progress, so a player who never uses the rings keeps the windows. The stall breaker (`assistAfter`) is 60 s for Janus.
- **Timeline vs design:** it follows the table. Additions for density and salvage: a gunboat at 30 s, a carrier at 94 s, interceptors at 63 and 168 s, gunboats at 83, 117 and 161 s, extra Blinkers in the pylon section, and a pylon pair in the feedback loop (150 s). Pairs are spawned by `junction.pair` (tagged) instead of the generic `portal` action, so beats can close them (`junction.collapse`). The 4-pair cap is budgeted per section. The supply-run formations fly at x 72 and 164; straight down the middle they rammed parked ships.
- **Feedback loop:** each loop pair's top end sits at y −6. It's closed to the ship, and anything spawning at the top starts inside it, so it doesn't cross in. `junction.stream` pours medium rocks and gnats (opted into portals) out under the top ring. They fall into the bottom ring (y 286) and come round again until shot, or until the pair closes at 172 s. The level system also opts in gnats falling in a loop column.
- **Pod:** the `escapePod` at x 120 (hp 2) falls into a ring at (120, 14), comes out at (64, 156), drifts into (64, 236) and is put out at (178, 116). A unit test checks both jumps; the god bot usually grabs it after the first.
- **Sandbox keys** (Alt held, matched on `KeyboardEvent.code`): Alt+H Blinkers (plus a crossed pair if none is up), Alt+J a Gate Pylon with a fresh pair, Alt+L an Aegis (ring offset, alternating sides; Alt+Shift+L ring under it), Alt+Shift+H Janus, Alt+Shift+J wreck Dawn (phase 2).

### Balance (`LEVEL=junction SAVE=act1 RUNS=50`)
| | novice | typical | expert |
|---|---|---|---|
| reach boss | 24% | 86% | 98% |
| clear (target) | **18%** (≥ 12) | **74%** (≈ 70) | 76% |
| deaths: level · boss | 38 · 3 | 7 · 5 | 1 · 11 |
| salvage on clear, median (target 640–850) | 631 | **635** | 669 |
| boss time on clears, median (target 50–90) | 70 s | **72 s** (p25 64, p75 84) | 73 s |
| pod rescued | 26% | 96% | 96% |
| weapons at boss | 3.0 × L4.0 | 2.9 × L3.3 | 3.2 × L3.3 |
| peak enemy shots, waves / boss (design 55 / 70) | 33 / 49 | 31 / 56 | 29 / 53 |
| hit causes | shot 234, ram-gnat 97, boss 41, rock 30 | shot 224, boss 75, ram-gnat 52, rock 16 | shot 238, boss 124 |

- The typical salvage median (635) sits at the band's lower edge (p25 600, p75 668). The level itself yields about 200; the rest is the boss (280, plus parts and shot salvage).
- **The bots are blind to the rings:** they drift under the nearest auto-target. Per-seed traces show:
  - In phase 1 the typical bot parks under a generator, which sits right over an entry ring, so it lands 100–160 ring hits on a face by accident.
  - In phase 2 its ring hits fall to about 1 per 10 s (random drift crossings). Before the damage-window assist, 5–8 of 30 typical runs timed out in phase 2 with Blaster L2–3.
  - Boss times are therefore shaped by the assist. A player who follows the right ring color should finish phase 2 well inside the stall breaker.
- Experts die more in the boss than typical bots (11 vs 5), on greedier pickup runs under the spiral. Left alone.
- Peak shots are under the design, as in T28 and T31: more density pushes novice below 12% first.
- Act I hashes are unchanged: 17a78586 / 66a3e907 / kessler 432d4c06 / ionShoals 1c9e54f6 / eventHorizon f3426d8c / pulsarNursery 0b41ee42 / armada 8b2a6879.
- Pools: enemies 18/80, enemy shots 56/600, asteroids 19/120, no dropped spawns.

### Browser check (port 5140, `?mute`, no console errors)
- Sandbox: the Aegis (lime shield plate, its exit ring above, entry ring offset), Blinkers diving through and flashing before their bursts, a Gate Pylon carrying its lime ring beside it.
- Janus: hull, Dawn and Dusk, generators, the shimmering wall, orange and lime entries at the sides, exits peeking from the top edge. Alt+Shift+J cracks Dawn; then the entries drift and swap, Dusk spins its spiral, and Blinkers come out of the exits.
- `?level=8&save=act1&god&t=144`: the feedback loop (rocks and gnats pouring round the cyan loop, the pylon pair), then the boss entry and phase 1. An idle ship's outer Spread L5 shots fall into the side rings and crack both faces, so Spread is a natural ring weapon.
- `tools/gallery.html`: all 10 `wj_*` sprites are listed, with frames and flash.

### Shared changes needed
None are required. Suggestions:
- **Bots (`tests/sim/bots.ts`, T43):** read aimed exits, and prefer standing under an entry ring whose aimed exit targets a live part (`portalPairs` plus the junction's aimed-exit table). Janus phase 2 bot times would then reflect a human rather than the assist.
- **Flak vs the Aegis shield:** a Flak shell's contact burst calls `damageEnemy` from the weapons system, so the shield doesn't stop it (it does stop the fragments). A non-boss damage hook would let the shield see it. In `sim/hooks.ts`, add `export type EnemyDamageHook = (w, e, amount) => boolean` with a register/get pair, and call it at the top of `damageEnemy` for non-boss enemies. Left as is: the shell has to touch the Aegis from below, which is a fair answer anyway.

## Follow-ups
- T43: the tether lines (each generator to the exit it holds) are subtle. A playtest should say whether reading "which ring hits which face" needs more, for example tinting each face's socket with its current pair color.
- T43: a weak-loadout fight (Blaster L2) still runs about 120 s. Human playtests should judge the phase 2 length.
