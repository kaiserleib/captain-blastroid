# T42 — Level 10: The Foundry + The Architect + escape
Status: done
Wave: 9 · Depends on: T32–T37 (all of wave 8) · Blocks: T43

## Goal
Replace the `foundry` stub with the finale: a remix of every mechanic, the three-form Architect, and the 40 s escape that ends the campaign. Everything is specified in `docs/design.md` → **Level 10: "The Foundry"**, tuned to the sector's place in the Act II difficulty curve.

## Owns
- `src/content/levels/foundry/**`: the `LevelDef` (timeline, asteroid field, all tunables) plus the enemy and boss tables
- `src/game/levels/foundry/**`: custom behaviors, the boss controller and its draw, sprites, level scripts and systems, sandbox keys, tests
- `tests/sim/**`: only new files named `foundry.*.test.ts`

Nothing else. Everything plugs in through the T21 registries, the wave-8 APIs (T33 flares, shade, portals and bubbles, T34 terrain, T35 weapons, T32 escape) and `registerTimelineAction`. If you need a shared change, describe it under "Shared changes needed" in Notes with a minimal patch and work around it locally.

## Read first
`CLAUDE.md`, `docs/design.md` → "Campaign: Act II" (especially **Level 10: "The Foundry"** and "Act II difficulty curve"), `docs/art-direction.md`, `tickets/WAVE9-NOTES.md` (the wave-8 APIs as merged), and the Notes of T32–T37. Use T27–T30 as the reference for quality and for how a sector folder is laid out.

## Requirements
- **Enemies:** **Riveter** (conveyor lines), **Crane** (tows and flings hull-scrap rocks with the T23 tow API), **Sentinel** (a rotating 120° front shield). The sector may spawn **Act I** enemies by id (Escort Fighter, Orbiter, Lancer, Streaker) through the timeline. It must not import any other sector's folder or spawn Act II sector enemies (they're built in parallel).
- **Remix beats:** the yard (tow), containment (a `massive` black hole in a slab ring), the welding line (`turning` pulsars phase-locked to `foundry`'s BPM during a 30 → 60 surge), the furnace (flares, slabs, the portal conveyor), assembly (Foundry terrain chunks with bubbles in the bends).
- **Pod (Wren):** carried by the portal conveyor at about 130 s.
- **Boss: The Architect** (`fd_architect`): three forms on one boss bar (Scaffold, Singularity Engine, Paradox Core) with the design's parts and HP. Set the stall-breaker threshold to 150 s with T32's per-boss override. Clean every hazard up between forms: collapse the hole, clear the portals and bubbles.
- **Escape:** `LevelDef.escape` (40 s, scroll 30 → 90 over 6 s, bonus 100 − 20/hit) with a level script that queues `escape`-tagged Foundry chunks (≥ 7-tile corridors) and debris rocks, with no enemies. Music `escape`. Victory and CAMPAIGN COMPLETE when the timer ends.
- **Timeline:** follow the design table, including the Lance supply run, the carrier, breathers and the magnet.
- **Art:** every new enemy and boss part has sprites at the art-direction sizes: 15-bit palette, outline, 2-frame animation where it fits, hit flash from the sprite cache. They appear in `tools/gallery.html`. Enemy bullets use only the standard enemy-bullet sprites.
- **Sandbox:** keys from WAVE9-NOTES to spawn each new enemy and the boss under `?sandbox`.
- **Fairness:** the T11 rules (no shots in the first 0.5 s alive; aimed shots only from ≥ 24 px above the ship) apply to every new attacker, and every telegraphed attack is telegraphed for ≥ 0.5 s.
- **Tests:** unit tests for each custom behavior's state machine and the boss phase transitions. The harness's god playthrough, determinism and pool safety must pass for `foundry`. Add a `tests/sim/foundry.sector.test.ts` god run that asserts the sector's signature beats (listed above) actually happen.

## Balance targets
With `SAVE=act1`: typical-bot clear ≈ **65%**, novice ≥ 8%, boss time 50–90 s for the typical bot (the Architect: 80–130 s across three forms), salvage on a clear 900–1200 (including the escape bonus).
Measure with `LEVEL=foundry SAVE=act1 RUNS=50 SKILLS=novice,typical,expert npm run balance` and record a balance table in Notes, like T27's. If a number is off only because a bot is blind to something, show the evidence (hits by cause) and tune for a human.

## Acceptance criteria
- [x] `?level=10&save=act1` plays the full timeline to the boss's defeat, the escape, results, and the right schematic, pod, and CAMPAIGN COMPLETE on the first clear.
- [x] God playthrough (every seed), determinism and pool safety pass for `foundry`.
- [x] Balance targets met or the gap explained.
- [x] Browser check on your own port with `?mute`: each new enemy, each hazard beat and each boss phase is described in Notes, with no console errors.
- [x] build / test / lint / test:sim / e2e pass.

## Contract changes
None.

## Notes

### What's in
- **Content** (`src/content/levels/foundry/`):
  - `index.ts`: `LEVEL` (timeline, field, escape), `ROSTER` (Riveter, Crane, Sentinel); the assembly events are generated from the chunk rows.
  - `tuning.ts`: every tunable (`RIVETER_P`, `CRANE_P`, `SENTINEL_P`, `CONVEYOR`, `CONTAINMENT`, `WELDING`, `FURNACE`, `ESCAPE_RUN`, `ARCHITECT`, the part table and part defs).
  - `chunks.ts`: the assembly chunks (30 px/s, 8|14|8 joins) and the `escape`-tagged chunks (12-wide joins, ≥ 7 tiles, valid at 90 px/s), built from wall profiles and registered with `registerChunks`.
- **Game** (`src/game/levels/foundry/`): `behaviors.ts` (three behaviors, the Sentinel shield collision pass, Crane and Sentinel draws), `architect.ts` + `architect.draw.ts`, `scripts.ts` (level scripts, the sector system, gantry and containment layers), `sandbox.ts`, `paint.ts` (local painter), `foundry.sprites.ts`, `foundry.test.ts`.
- **Tests:** `foundry.test.ts` (18 unit tests: content and chunk validation, riveter, crane, sentinel, each beat, every Architect transition, escape arming); `tests/sim/foundry.sector.test.ts` (god run asserting the signature beats: crane throws, the captive hole in ≥ 4 slabs, surge pulsars pulsing on the beat within a tick, 2 portal pairs + ≥ 2 flares, the pod rescued off the line, assembly terrain + slow bubbles, every boss phase, escape terrain with debris and no enemies, the escape bonus, the Nova schematic).

### Calls I made
- **Riveter** (2 HP, contact only): lines of 6–12 from `foundry.conveyor` / `foundry.portalLine`, 17 px apart, spawned one at a time by the sector system (pre-placed off-screen ones would be culled). A riveter popping out of a portal adopts its new row.
- **Crane** (12 HP): brings its own large scrap (10 HP) on the hook, holds near the top, the hook glows orange 0.6 s, then flings it at the ship (only from ≥ 24 px above, else drops it). Then it snipes (one aimed shot every 2.4 s) and re-hooks medium/large field scrap within 96 px after 3.5 s. Leaves at 17 s; an `ax` override shortens the stay (chamber Cranes: 8 s). Steering is on only while terrain is active (otherwise it sidesteps its own catch, as the Tug would).
- **Sentinel** (16 HP): turns toward the ship at 0.8 rad/s; a 120° cyan shield arc. The shield is a collision pass (`registerCollisionPass`): a player shot entering the shield radius from within ±60° of the facing (judged from its previous position) is stopped with a spark and `armor_ping`. 3-way fans along its facing every 1.8 s, only within 40° of the ship's bearing. Straight-up shots from under it are always stopped, so Spread angles, Ricochet, Seeker, Arc Coil, drones, Flak bursting behind it, or porting beside it are the answers. Leaves at 14 s.
- **Act I enemies by id:** `ar_escort`, `hz_orbiter`, `hz_lancer`, `pn_streaker`, plus Level 1's gnat, swooper, gunboat, interceptor and carrier. Orbiters come from my own `foundry.orbiters` script (spawned either side of the captive hole). No Act II sector enemies.
- **Containment:** a `massive` hole falls in with the scroll, settles at y 116 (2 px/s, a ±26 px sway, pinned), and five shade slabs ride springs around it (a ring with gaps; dashed molten beams drawn between them). At 74 s it collapses and the slabs drop away.
- **Welding line:** `foundry.pulsar` queues a `turning` pulsar for the next 7-beat grid line (7 × 0.441 s = 3.09 s, the variant's 3 s put on the grid) and spawns it with `phase` = time since that line, so every pulse lands on a `foundry` beat. Scroll 30 → 60 over 4 s at 80, back to 30 over 5 s at 115.
- **Furnace:** two fixed portal pairs (orange: right row 62 → left row 142; cyan: right 142 → left 222) form the conveyor; portal lines opt their riveters in. **The pod:** the timeline keeps a plain `escapePod` (the director picks Wren or the cache, and the shared one-pod-event test holds); the sector system lifts it onto the line at the left edge and carries it (vx 60, vy 0) through both pairs, then lets it drift down at 24 px/s past x 132 on the last row. The first draft lost it (13% rescued): flares burn pods and Sentinel fans crossed the line. Now flares run 118–127 and 142–147, the pod rides 131–139, and the Sentinels and escorts come after it (typical rescue 94%).
- **Assembly:** entry, S-bend right, chamber A, S-bend left, chamber B, then `@clear` (126 rows, 150 → 183.6 s, walls gone well before 200). Slow bubbles (r 30) are timed to each bend's outer stretch; chambers have crumbly buttresses, a gate line across the throat and two Cranes each. Magnet at 160.
- **The Architect** (`fd_architect`, `assistAfter: 150`): every part spawns with the fight, and later forms' parts wait parked at y −400 (untargetable, absorbing nothing), so one bar spans the whole fight (840 HP). Cores die like any part; the controller then plays a 2.2 s invulnerable transition.
  - Scaffold: a truss, 2 arms (50 HP) and a core (120 HP, iris shut = armored while an arm stands). Each arm tows a medium scrap rock in orbit (r 26) as a shield and throws it every 5 s after a 0.7 s orange glow; a fresh one is hauled in 2.6 s later. Aimed 5-way fans every 2.1 s.
  - Fall: the truss and arms tumble away; the hole's ignition point glows for the last second.
  - Singularity Engine: a core (170 HP, cyan shield ring until three of four 30 HP pylons are down); a captive massive hole below that sways against the core's strafe, so the column above the ship is never shut for long; magnetar rings from the core every 2.5 s (3 gaps of 58°); aimed pylon shots every 2.6 s, bent by the hole. **The pylons feed the hole:** its pull is 60% of `massive` with all four up and 20% with none. At full pull a Blaster shot bends ~60 px on its way up, so nothing below the core could hit anything.
  - Collapse: the hole and the pulsar collapse; pylons still standing go with them.
  - Paradox Core (170 HP): two portal pairs re-paired every 6 s, a flip bubble (r 28) riding the core, a flare every 8 s with two slabs dropped 1.2 s earlier (74 px either side, falling at 30 px/s so their shade reaches the ship's row), and a 6-arm spiral (0.26 s gaps, 2.2 s on, 1.2 s off).
  - Defeat: everything the boss owns is cleaned up (portals, bubble, slabs, flares, rocks, hole, pulsar), shots turn to salvage, and `bossDefeated` starts the director's escape. Arms and pylons spray 40 / 30 salvage, and each broken core sprays 45.
- **Escape:** `LEVEL.escape` is the stub's def unchanged (see Shared changes). The sector system starts the run when the director enters its escape phase (`escapeTimeLeft ≥ 0`; `foundry.escape` is registered too and is idempotent): non-boss enemies and every Act II hazard are cleared, `fd_esc_entry` is queued, then a seeded shuffle of four escape chunks keeps ≥ 24 rows queued; `clearTerrain` (taper) at 4.5 s left. Debris: a rock every 0.7 s (25% medium) in an open column, none in the last 2 s. The `escape` music comes from the shared `escapeStarted` wiring.
- **Yard gantries:** a z 4 layer of dark gantry silhouettes at the sides, entering only during the first 40 s (none when `?t=` starts past the yard).
- **Sandbox:** Alt+R a riveter line, Alt+G a Crane, Alt+K a Sentinel, Alt+Shift+R the Architect (pressed again: end the current form). The listener runs in the capture phase and stops Alt combos, so the shared sandboxes' plain R (enemy reset) and K (Rock Hauler) don't also fire. `__foundry.skip()` in the dev console ends the current form outside the sandbox too.
- **Gallery:** all sprites live in `foundry.sprites.ts` and show in the Sprites section (riveter, crane with 4 frames, sentinel, truss, arm with 4 frames, core 1 shut/open, pylon, core 2, core 3 with 4 frames, wreck, gantry).

### Balance (`LEVEL=foundry SAVE=act1 RUNS=50 SKILLS=novice,typical,expert`, with a 420 s cap; see Shared changes)
| | novice | typical | expert | target |
|---|---|---|---|---|
| reach boss | 16% | 74% | 96% | |
| **clear** | **10%** | **72%** | 92% | typical ≈ 65%, novice ≥ 8% |
| deaths before / in boss | 42 / 3 | 13 / 1 | 2 / 2 | |
| hits: first 45 s · per run · in boss | 2.68 · 8.7 · 2.6 | 1.18 · 7.5 · 1.1 | 1.10 · 5.6 · 1.2 | |
| boss time on clears, median (p25–p75) | 57 s | **60 s (44–78)** | 66 s (46–87) | 50–90 s (Architect 80–130) |
| salvage on clear, median (p25–p75) | 1005 | **994 (929–1014)** | 964 (936–998) | 900–1200 |
| weapons at boss (avg level) | 3.3 (L3.2) | 3.0 (L3.5) | 2.9 (L3.4) | |
| capsules · pod rescued | 4.6 · 38% | 7.5 · 94% | 7.5 · 100% | |
| peak enemy shots, waves / boss | 17 / 58 | 16 / 58 | 16 / 58 | ≤ 60 / 80 |

- **Typical hit causes:** level shots 107, welding rings 91, flares 71, gnat rams 28, boss shots 21, streaker rams 19, rocks 14, boss flares 12, boss rocks 7, escape crushes 2. The bot reads rings and flares (T31/T33), so these hits are real. Most deaths come in the welding line and the furnace (113–145 s).
- **Typical 72% vs ≈ 65%:** three 50-seed passes on the same level during tuning read 64–72%, so seed noise is about ±5. I left it on the easy side because the weak-loadout guard below had already forced the boss down.
- **Boss time 60 s, under the Architect's 80–130 s.** At the design HP (1200) the typical fight took 110 s, but the shared `weakLoadout` test failed at 327 s. That test requires an invulnerable Blaster L2 to finish every boss inside 240 s, and this boss's stall breaker only starts at 150 s. To pass it I made these changes, and that run now takes 228 s:
  - HP down to arms 50, core 120, pylons 30, core 170 and core 170 (840 total).
  - The scaffold strafe narrowed to ±22 over 12 s.
  - The hole's pull capped at 60%.
  - The paradox core's drift slowed, and its slabs dropped wider (they were eating the shots aimed at it).
  - Raising HP again first needs that test relaxed for three-form bosses.
- **Salvage:** at the design roster numbers, clears paid ~700. I raised it, following T31's precedent:
  - Riveter 1 → 2, Crane 6 → 10, Sentinel 8 → 14.
  - The Architect's part and core sprays.
  - Extra Act I wings: a gunboat at 19.5, swoopers at 28 and 97, an interceptor at 39, wings at 43, 71, 85 and 175.
  - `bossSalvage` 400 and the escape bonus are as designed.
- **Drops:** a shield at 75 (the design breather) and upgrades at 76.5 and 190. With extra shields at 113.5 and 190, typical clears rose to 84%, so both went.

### Browser check (port 5142, `?mute`, Chrome)
- Yard (`?t=8`): gantries at the sides, Cranes hauling scrap on cyan beams, escorts.
- Containment (`?t=39.5`): the massive hole settles in its slab ring with molten beams between the slabs; Orbiters circle it; a Sentinel's shield arc and barrel track the ship.
- Welding (`?t=79.5`): a riveter conveyor line crosses during the surge.
- Furnace (`?t=116.5`): flare blow-out over the slabs; orange and cyan pairs at the edges; riveters riding the line.
- Assembly (`?t=149.5`): the corridor taper, the right bend with its slow bubble, a chamber with crumbly buttresses and a half-shot gate line.
- Boss (`?t=199` plus `__foundry.skip()`):
  - Scaffold: arms with rocks, hit flash, fans.
  - Fall: the truss tumbling.
  - Engine: shield ring, four pylons, the hole, a magnetar ring.
  - Paradox: the flip bubble's look alternating, two pairs, dropped slabs and their shade during a flare, the spiral.
  - Escape: corridors at 90, debris, `ESCAPE 0:32`.
  - The white-out, then results with **SECTOR CLEAR · CAMPAIGN COMPLETE** and the Nova schematic.
- `?sandbox&level=10`: Alt+R/G/K and Alt+Shift+R spawn as described, and no Rock Hauler appears. No console errors.

### Act I
Hashes unchanged: 17a78586, 66a3e907, kessler 432d4c06, ionShoals 1c9e54f6, eventHorizon f3426d8c, pulsarNursery 0b41ee42, armada 8b2a6879.

### Shared changes needed
1. **Balance cap.** In `tests/sim/balance.report.ts`, `BALANCE_MAX_T = 320` cuts the Foundry short: 200 s to the boss, then the fight, the 40 s escape and the outro. Every run whose boss takes more than ~74 s times out, which reads as about 27% clears instead of 72%. Suggest `export const BALANCE_MAX_T = 420;`. The table above used a local copy at 420.
2. **`escape.script`.** `src/game/director/escape.test.ts` ("the Foundry stub carries the design escape") checks the escape def with `toEqual`, so `script` can't be set without editing it. Nothing is missing, because the sector system starts the run on the escape phase. To make it explicit, add `script: 'foundry.escape'` to `ESCAPE` and to that expectation.
3. **design.md, Level 10:**
   - Architect HP: arms 50 + 50, core 120; pylons 30 × 4, core 170; core 170.
   - The hole's pull follows the pylons (20–60% of massive).
   - Roster salvage: Riveter 2, Crane 10, Sentinel 14.
   - Arm, pylon and core salvage sprays.

## Follow-ups
- Raise the Architect toward the design HP once `weakLoadout` gives three-form bosses more time (e.g. measure from `assistAfter`, or allow 300 s).
- A human pass on the Sentinel: from straight below it is a wall; check that Spread angles and portal flanks feel like real answers.
- The bend bubbles' x positions are hand-set; their times follow the chunk rows automatically.
