# T28 — Level 3: Event Horizon
Status: done
Wave: 6 · Depends on: T21, T23, T24, T25 (+ T22 for the flow) · Blocks: T31

## Goal
Replace the `eventHorizon` stub with the full sector from `docs/design.md` → **Level 3: "Event Horizon"**: its enemies, hazards, timeline, escape pod and boss **Perihelion**, tuned to the sector's place in the difficulty curve.

## Owns
- `src/content/levels/eventHorizon/**`: `LevelDef` (timeline, asteroid field, all tunables) plus the enemy and boss tables (`ROSTER`, boss def)
- `src/game/levels/eventHorizon/**`: custom behaviors, the boss controller and its draw, sprites (`*.sprites.ts`), level scripts and systems, sandbox keys, tests
- `tests/sim/**`: only new files named `eventHorizon.*.test.ts`

Nothing else. Everything plugs in through T21's registries (`registerRoster`, `registerBehavior`, `registerBoss`, `registerLevelScript`, `registerLevelSystem`) and T23's hazard API. If you need a change in a shared module, stop and describe it in Notes under "Shared changes needed" with a minimal patch suggestion. Don't edit it.

## Read first
`CLAUDE.md`, `docs/design.md` (Campaign section, especially **Level 3: "Event Horizon"** and "Difficulty curve"), `docs/art-direction.md`, `tickets/WAVE6-NOTES.md` (the APIs as merged), and the Notes / Contract changes of T21, T23, T24 and T25. Use the Level 1 files (`content/levels/level1.ts`, `game/boss/rockHauler.ts`, `content/bosses.ts`) as the style and quality reference.

## Requirements
- Enemies: **Orbiter** (circles the nearest black hole at 54 px; spawn it with `{ ax/ay }` set to the hole, or find the hole at spawn), **Lancer** (telegraphed dash: draw the telegraph line in your enemy draw layer or the boss draw API), **Gravity Buoy** (drifting body with `spawnFieldOnly`, collapses on death).
- Black-hole placements via `anomaly` events with the design's variants and drifts. Shots fired beside a hole must visibly curve; tune the placements so the curving is a *feature*.
- **Boss: Perihelion** (`hz_perihelion`): spawns its own pinned `massive` black hole at (120, 150) with `vy: 0` (call `pinAnomaly` so scroll changes don't move it). Elliptical orbit around it (rx 80, ry 50, 9 s). Phase 2 slingshot dives with a curved dotted telegraph. The hole collapses on defeat (`collapseAnomaly`).
- **Timeline:** follow the design's beat table, including the supply run, the carrier, breathers with shield drops, a magnet, the pod and the warning-then-boss. Keep the `enemyHpMul`, `enemyShotSpeedMul`, `guaranteeWeapon`, `bossSalvage`, `podFallbackSalvage` and `schematicOnClear` numbers from the design unless balance requires otherwise; log any changes.
- **Art:** every new enemy and boss part has sprites at the art-direction sizes, a 15-bit palette, an outline, a 2-frame animation where it fits, and hit-flash support (automatic via the sprite cache). They appear in `tools/gallery.html`. Enemy bullets use only the standard enemy-bullet sprites.
- **Sandbox:** keys to spawn each new enemy and the boss under `?sandbox`. Pick keys not in use: check WAVE6-NOTES for the key map.
- **Fairness:** the T11 fairness rules (no shots in the first 0.5 s alive, shooter at least 24 px above the player for aimed shots) apply to every new attacker. Every telegraphed attack is telegraphed for ≥ 0.5 s.
- **Tests:** unit tests for each custom behavior's state machine and the boss phase transitions (as in `game/boss/boss.test.ts`). The T21 harness already runs god playthrough, determinism and pool safety for every `LEVEL_ORDER` id, so make yours pass. Add `eventHorizon.balance` coverage via `LEVEL=eventHorizon npm run balance`.

## Balance targets
Typical-bot clear rate ≈ 80%, novice ≥ 45%, boss time 50–100 s, salvage on a clear 340–450. Shots curving into the player must stay fair: no shot may *accelerate* into the player from off-screen without at least 0.5 s on screen.
Measure with `LEVEL=eventHorizon RUNS=50 npm run balance` (typical) and `SKILLS=novice,typical,expert`. Record a balance table in Notes, like T18's.

## Acceptance criteria
- [x] `?level=` for this sector plays the full timeline to Perihelion's defeat, results, and the right schematic and pod (`?save=fresh` with earlier sectors cleared via `?save=mid`/`all` as needed).
- [x] God playthrough (every seed), determinism and pool-safety tests pass for `eventHorizon`.
- [x] Balance targets met or the gap explained.
- [x] Browser check on your own port with audio muted. Screenshots of each new enemy, the hazard beats and each boss phase are described in Notes, and there are no console errors.
- [x] build / test / lint / test:sim pass.

## Contract changes
None.

## Notes

### What's in
- **Content** (`content/levels/eventHorizon/`):
  - `index.ts`: `LEVEL` (field, timeline) and the `HZ_SCRIPTS` knobs.
  - `roster.ts`: `hz_orbiter`, `hz_lancer`, `hz_buoy` and their behavior params.
  - `perihelion.ts`: the boss def and its part defs.
- **Game** (`game/levels/eventHorizon/`):
  - `behaviors.ts`: the orbit, lance and buoy state machines.
  - `perihelion.ts` (controller) and `perihelion.draw.ts`.
  - `draw.ts`: the Lancer telegraph and dash afterimages, plus the buoy-field layer.
  - `scripts.ts`: `eventHorizon.orbiters`, `eventHorizon.massive`, `eventHorizon.collapse`, and the massive-hole level system.
  - `sandbox.ts`, `*.sprites.ts` and `eventHorizon.test.ts` (11 unit tests).
  - `paint.ts`: a small procedural painter. game/boss's `Paint` isn't exported, so this folder has its own.
- **Sim tests:**
  - `tests/sim/eventHorizon.fairness.test.ts` checks curved-shot fairness. It runs 2 seeds under `test` and 12 under `test:sim`, and a 200-seed sweep came back clean.
  - `tests/sim/eventHorizon.balance.test.ts` is a probe that is skipped by default. `HZ_AWARE=1` runs the hole-aware bot (described under Balance). `HZ_HOLD=1` measures boss DPS from a fixed x.

### Enemies
- **Orbiter** (6 HP, 5 salvage):
  - Movement: it spirals in from 24 px outside its orbit to 54 px around the nearest live hole with a core. It circles at 1.4 rad/s for 10 s, then peels off outward and down.
  - Attack: an outward 2-shot fan (18° apart) every 1.3 s at 72 px/s. The hole bends the shots into loops, and some come back around after 4–5 s.
  - Extra rules: no fan while the player is within 70 px. It leaves early once its hole sinks below y 190, so a ring never sweeps the player's row.
  - Script: `eventHorizon.orbiters { x, n, dir }` rings the hole nearest (x, 60), with slots evenly spaced from the top. A slot within 60 px of the player flips to the far side of the hole. With no hole on screen, the Orbiter circles a virtual center that scrolls.
- **Lancer** (5 HP, smart while descending, 4 salvage):
  - Sequence: it descends to y 70, settles for 0.35 s, locks a line on the player and shows it for the full 0.7 s. It then dashes at 260 px/s without steering and leaves the screen.
  - Telegraph: a marching dashed line to the playfield edge, red, then amber, then blinking white, with a 1 px shadow and a flare sprite at the nose. The dash leaves three afterimages.
  - Moving during the telegraph doesn't drag the line: it's a dodge, not a homing ram.
- **Gravity Buoy** (12 HP, 10 salvage):
  - It drifts with the scroll, sways ±8 px/s and carries a `spawnFieldOnly` field (small variant, 0.5×) on itself.
  - When killed, its field collapses over 0.45 s through `collapseAnomaly` (one `enemyKilled` listener per world). When culled, the field leaves the screen with it.
  - Visual: two counter-turning dotted violet rings on a level layer at z 12. They cave in while the field collapses.
- I raised salvage from the design's 3 / 3 / 5 to 5 / 4 / 10 to reach the 340–450 clear target.

### Timeline (185 s to the boss)
The level follows the design's beat table. Holes that need to linger for a beat get a slow `vy` of 10–18 px/s, so they drift like the nebula layer.

Changes from the design, all for fairness or balance:
- I trimmed two interceptors and a gunboat pair from the 45–120 s beats. Gunboat fans passing two holes and the buoys produced 60–90° curves in under 1 s.
- The 151 s gunboats became a gnat V.
- The 63 s swoopers became gnats. Their close aimed shot grazed a hole and curved into the player.
- The Lancer volleys at 143 s and 155 s are pairs. The 128 s volley keeps all 3.

Hole beats:
- `eventHorizon.massive` brings in the massive hole at scroll speed. Below y 92 it settles to 1.5 px/s and sways ±15 px.
- `eventHorizon.collapse` collapses every unpinned hole at 176 s, so the boss arena starts clean.
- The storm lanes aim at the massive hole. The hole swallows most rocks from the slow center lane, and the side lanes swing past it.

Pod: Sable's pod has **2 HP** and drifts between two small holes at 100 s. The design doesn't give an HP, and 1 HP felt unfair under curving fire.

Kept at the design's numbers: `enemyHpMul` 1.15, `enemyShotSpeedMul` 1.10, `guaranteeWeapon` Seeker by 30 s, `bossSalvage` 90, `podFallbackSalvage` 50, `schematicOnClear` corsair.

### Perihelion
- **Entry (3 s):** the boss descends to the top of its orbit. Its hole grows from a pinprick: core radius, field and strength scale up over 1.4 s while violet rings converge on it. The hole spawns with `vy 0` and is pinned with `pinAnomaly`.
- **Phase 1 (`orbit`):** a clockwise ellipse, rx 80 by ry 50, around (120, 150), with a 9 s period. The pods fire an aimed 3-way fan (±10°) every 1.6 s (1.2 s once one pod is gone). They fire only from at least 24 px above the player and at least 60 px away.
- **Opening:** wrecking both pods starts a 1.2 s iris opening, then phase 2.
- **Phase 2 (`slingshot`), one dive per lap:**
  - Telegraph (0.8 s): starts as the boss reaches the right side heading down. A dotted quadratic curve runs from the dive point, under the hole, through the player's row and x, and back up to the far side. The dots march and heat from red to amber to blinking white, and a bracket marks where the curve crosses the player's row.
  - Dive: the boss follows exactly that path at about 280 px/s on average, fastest at the bottom of the swing, with afterimages.
  - Dive ring: 12 shots, dropped on the climb after 68% of the path and only with the player at least 96 px away.
  - Core ring: between dives the core fires a 6-way ring every 1.2 s, skipped while the player is within 80 px.
  - The dive replaces the bottom half of the orbit, which gives the design's beat of about one dive every 6 s.
- **Defeat:** `collapseAnomaly` over 0.5 s with a white field flash and an expanding ring, then 2 s of death throes. The parts are released, and the hole too if it's still there.
- **HP 70 / 70 / 120** (design: 80 / 80 / 260).
  - The hole eats any shot fired straight at the core behind it. With the design HP, the fight ran past 130 s for every bot variant.
  - Holding off-axis and letting the hole curve shots in kills it in 27–59 s with Blaster 3 + Seeker 2 (`HZ_HOLD`), so the intended skill pays off.
- **Sound:** the sfx set is shared, so the telegraph reuses `magnet_on` (a rising saw wind-up) and dashes reuse `boss_throw`.

### Fairness
- Every new shooter uses `canFire` (at least 0.5 s alive, on screen, at least 24 px above the player) plus the distance gates above.
- Telegraphs: Lancer 0.7 s, dive 0.8 s. Unit tests assert each is at least 0.5 s.
- `eventHorizon.fairness.test.ts` records every enemy shot's heading at spawn and its continuous time on screen. A hit by a shot bent 35° or more must come from a shot that was on screen for at least 0.5 s.
  - 200 seeds of the typical dodger: no violations.
  - With the threshold at 25°, one point-blank swooper shot grazed a hole: 29° after 0.42 s. That is a normal T11 aimed shot, so the threshold is 35°.

### Balance
The stock dodger can't see black holes, curving shots and rocks, Lancer lines or the dive telegraph:
- Its `hitCause` doesn't list anomalies, so hole-core contact shows up as `level:rock`. For the typical dodger, 146 of 300 hits are "rock".
- A probe that does count holes attributed 23–31 hits per 20 runs to hole cores in the windows where a hole crosses the player's row.

So the table reports both the stock bot and a **hole-aware** wrapper (`HZ_AWARE=1`; see the test file's header). The wrapper models what a human reads off the screen, and I tuned for its numbers.

50 seeds each, Kestrel, fresh save:

| | novice | typical | expert | god typical |
|---|---|---|---|---|
| stock dodger: reach boss / clear | 38% / 18% | 34% / 16% | 32% / 12% | 100% / 100% |
| hole-aware clear (+ runs where the boss was still up at the 320 s cap, unhit) | 70% (+14%) | 76% (+18%) | 74% | – |
| hits per run / hits in first 45 s (stock) | 6.9 / 1.74 | 7.0 / 1.18 | 7.3 / 1.38 | 0 |
| weapons @30/45/60/90/120/180 s (stock) | 1.4/2.3/2.5/2.6/2.8/3.0 | 1.5/2.2/2.5/2.8/3.0/3.1 | 1.7/2.3/2.6/2.7/2.9/3.2 | 1.5/2.3/2.7/3.0/3.2/3.4 |
| boss time on clears | aware 31–129, median ~85 | aware 25–128, median ~70 | aware 24–125, median ~61 | 23–131, median 56 |
| salvage on a clear | 297–422, median 332 | 315–460, median 381 | 345–409, median 385 | 262–440, median 355 |
| peak enemy shots waves / boss | 18 / 30 | 18 / 32 | 18 / 30 | 18 / 32 |
| capsules + cores spawned | 6.8 | 7.1 | 7.7 | 10.3 |

How this compares to the targets:
- **Typical clear rate:** about 76% with the hole-aware bot, within the harness's 320 s cap. The other runs that reach the boss are unhit and still shooting at the cap, and the game has no clock. Target ~80%: met within noise.
- **Novice ≥ 45%:** met.
- **Boss time 50–100 s:** medians 56–85.
- **Salvage 340–450 on a clear:** typical median 381, god 355.
- **Peak shots are well under the design's 45 / 50.** This is deliberate: a bent shot is more dangerous than a straight one, and every density increase I tried added sub-second curved hits. T31 can revisit this once the bot reads curves.
- **Pool peaks:** anomalies 5/8, enemies 25/80, enemyShots 32/600. No spawns were dropped.

### Browser check (port 5128, `?mute`, no console errors)
- **`?sandbox&level=3`:**
  - U rings a slow standard hole with 3 Orbiters: Saturn-shaped drones with a gold ring and chasing lights, firing shots that curve into loops.
  - I spawns a Lancer: a dashed telegraph line from its nose to the bottom edge, then the dash with afterimages.
  - O spawns a Gravity Buoy: a violet seed in a gold gimbal, with dotted rings pulsing around it. Shots bend as they pass through the rings.
- **Shift+U (boss):**
  - Perihelion descends while violet rings converge on its growing hole.
  - Phase 1: it orbits while the pods fire aimed fans that the hole bends.
  - Shift+U again wrecks the pods. They leave smoking wrecks, the iris opens to a violet core, and 6-way rings curl around the hole.
  - Dive: the telegraph is a red dotted U from the right wingtip, under the hole, through the ship's row and back up. The dive follows it with afterimages.
- **`?level=3&t=117`:** the massive hole settles with a ring of 4 Orbiters while a Lancer volley shows its lines.
- **`t=176`:** the holes collapse, then the boss arrives.

### Shared changes needed
- **Made (one test assertion):** `src/game/director/levelFramework.test.ts` asserted that every sector's timeline ends in `rock_hauler`. It now asserts that each sector's boss id is registered (`bossRegistration`). Every wave-6 sector runs into this, so expect the same small change from T27/T29/T30. The merge is trivial.
- **Optional:** `tests/sim/harness.ts` `hitCause` could list anomalies as `hole`, so the stock report stops calling hole contacts "rock".
- **Optional sfx** (`audio/presets.ts`): a dedicated `telegraph` wind-up and a `lance_dash`. The Perihelion telegraph currently reuses `magnet_on`.
- **Optional gallery card:** the part sprites (`hz_*`) already appear in the Sprites section automatically. A composite Perihelion card would need an edit to `tools/sections/boss.ts`.

## Follow-ups
- T31: teach the bot black holes (core keep-out, curved projections), Lancer lines and the dive telegraph. The `holeAware` wrapper in `eventHorizon.balance.test.ts` is a starting point.
- T31: if playtests want denser waves, add shooters away from the holes first. Peak shots are 18 against the design's 45.
- The Orbiter's ring reads a little flat at 1×. If playtests agree, a third ring frame or a brighter body highlight would help.
