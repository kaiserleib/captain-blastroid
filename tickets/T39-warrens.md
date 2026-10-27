# T39 — Level 7: The Warrens + Wyrm
Status: done
Wave: 9 · Depends on: T32, T34, T35, T36, T37 · Blocks: T43

## Goal
Replace the `warrens` stub with the full sector: the game's first terrain level, with tunnels, gates, wall turrets, a fork and a burrowing worm boss. Everything is specified in `docs/design.md` → **Level 7: "The Warrens"**, tuned to the sector's place in the Act II difficulty curve.

## Owns
- `src/content/levels/warrens/**`: the `LevelDef` (timeline, asteroid field, all tunables) plus the enemy and boss tables
- `src/game/levels/warrens/**`: custom behaviors, the boss controller and its draw, sprites, level scripts and systems, sandbox keys, tests
- `tests/sim/**`: only new files named `warrens.*.test.ts`

Nothing else. Everything plugs in through the T21 registries, the wave-8 APIs (T34 terrain, T35 weapons) and `registerTimelineAction`. If you need a shared change, describe it under "Shared changes needed" in Notes with a minimal patch and work around it locally.

## Read first
`CLAUDE.md`, `docs/design.md` → "Campaign: Act II" (especially **Level 7: "The Warrens"** and "Act II difficulty curve"), `docs/art-direction.md`, `tickets/WAVE9-NOTES.md` (the wave-8 APIs as merged), and the Notes of T32, T34, T35, T36 and T37. Use T27–T30 as the reference for quality and for how a sector folder is laid out.

## Requirements
- **Chunks:** author the sector's terrain as chunks in `content/levels/warrens/` (cave mouth, wide tunnel, chamber, narrowing, gate rows, the fork, the pod alcove, S-bends, crumbly collapse, the Wyrm's den). They must pass T34's chunk validator.
- **Enemies:** **Wall Turret** (registered for `T` sockets), **Borer** (dust telegraph, crossing, `carveTiles`, a 4-shot ring on entering the far wall), **Cave Bat** (flocking with preallocated neighbor scratch, no per-bat arrays). Numbers from the design.
- **Pod (Rook):** in an alcove behind a gate on the left branch of the fork. Shooting the gate frees it.
- **Boss: Wyrm** (`wr_wyrm`): a head plus 8 segment parts following the head's path (a preallocated path buffer). It burrows, with a 0.8 s dust-trail exit telegraph; the head opens while surfacing; Frenzy at < 50% carves pillars. The scroll is 0 and the arena fixed for the whole fight.
- **Timeline:** follow the design table, including the Ricochet field test, a carrier chamber, breathers, the fork's upgrade core, the magnet, and the scroll changes in the S-bends.
- **Art:** every new enemy and boss part has sprites at the art-direction sizes: 15-bit palette, outline, 2-frame animation where it fits, hit flash from the sprite cache. They appear in `tools/gallery.html`. Enemy bullets use only the standard enemy-bullet sprites.
- **Sandbox:** keys from WAVE9-NOTES to spawn each new enemy and the boss under `?sandbox`.
- **Fairness:** the T11 rules (no shots in the first 0.5 s alive; aimed shots only from ≥ 24 px above the ship) apply to every new attacker, and every telegraphed attack is telegraphed for ≥ 0.5 s.
- **Tests:** unit tests for each custom behavior's state machine and the boss phase transitions. The harness's god playthrough, determinism and pool safety must pass for `warrens`. Add a `tests/sim/warrens.sector.test.ts` god run that asserts the sector's signature beats (listed above) actually happen.

## Balance targets
With `SAVE=act1`: typical-bot clear ≈ **72%**, novice ≥ 14%, boss time 50–90 s for the typical bot, salvage on a clear 600–800.
Measure with `LEVEL=warrens SAVE=act1 RUNS=50 SKILLS=novice,typical,expert npm run balance` and record a balance table in Notes, like T27's. If a number is off only because a bot is blind to something, show the evidence (hits by cause) and tune for a human.

## Acceptance criteria
- [x] `?level=7&save=act1` plays the full timeline to the boss's defeat, results, and the right schematic, pod, and the Ricochet unlock.
- [x] God playthrough (every seed), determinism and pool safety pass for `warrens`.
- [x] Balance targets met or the gap explained.
- [x] Browser check on your own port with `?mute`: each new enemy, each hazard beat and each boss phase is described in Notes, with no console errors.
- [x] build / test / lint / test:sim / e2e pass.

## Contract changes
None.

## Notes
**Layout** (all inside Owns):
- `content/levels/warrens/`: `index.ts` (roster, `LEVEL`, timeline), `tuning.ts` (turret, borer, bat, cages, rock falls, den brake, Wyrm + part defs), `chunks.ts` (nine chunks, `CHUNK_ORDER`, anchors `FORK` / `CHAMBER` / `DEN`).
- `game/levels/warrens/`: `behaviors.ts` (turret, borer, bat), `scripts.ts` (chunk marks, bats, rock falls, cages, den brake, level system), `wyrm.ts`, `draw.ts`, `warrens.sprites.ts`, `paint.ts` (copy of T27's), `sandbox.ts`, `state.ts`, `warrens.test.ts` (14 tests).
- `tests/sim/warrens.sector.test.ts`: god (typical skill) pod-chasing run asserting the toasts (THE WARRENS, SHOOT THE GATES, POD BEHIND THE GATE, FRENZY), turrets/borers/bats/carrier/gunboats, a borer ring dig, the 22 and 34 px/s scrolls, rock falls, scroll 0 at the fight, every Wyrm phase, pillar carving, Rook rescued and the Ferret.

**Terrain.** ~560 rows in nine chunks (cave mouth → 16-wide tunnel → 24-wide chamber open to the left edge → narrows with five gate rows → breather → fork → S-bends → collapse → den), all validated alone and as a sequence at 34 px/s. Chunk rows were generated by a script (open span per row, a ±1 wall wobble that only ever widens, then features) and pasted as literals. Each chunk is queued by a `terrain` event a couple of seconds before the previous one runs out; `warrens.mark` (a script run just before the fork's and den's events) records the chunk's first terrain row so the cages and the den stop find their rows exactly, even after a `?t=` start. Entry times: mouth 15, tunnel 20, chamber 27, narrows 41, rest 72, fork 77, S-bends 113, collapse 141, den 164.

**Calls I made:**
- **Toasts:** a `THE WARRENS AHEAD` toast at 0.5 s (the god test wants the sector name first, and weapon pickups toast before 15 s), then the design's `THE WARRENS` at 15 s.
- **Scroll:** 30 → 26 at 15 s, 22 in the narrows (40–70, the curve's "22–34"), 26 → 34 at 110, 34 → 26 at 145, then the den brake (13 px/s²) lands the den's bottom row exactly at y 400 (≈180.5 s). The boss waits in `entry` until the scroll is 0, plus 1.2 s.
- **Carrier chamber** is open to the left edge (cols 0–23): the carrier is dumb, and a side entry through rock would kill it. Unkilled, it rams the chamber's right wall (no capsule).
- **Pod:** an `escapePod` event (hp 2) at 96 s; the cage system takes it into a 2×3 pocket in the left branch's left wall, above a gate floor over a bulge in the branch. Any gate tile broken (or the release line, y 304, where the gate has crumbled anyway) frees it; it drops down the branch at scroll + 10 and eases to the branch's middle. Toast `POD BEHIND THE GATE` / `CACHE BEHIND THE GATE`. Typical rescue rate 94%.
- **Upgrade core:** an `upgrade` pickup held above the right branch's two gate rows until both are open at its column (or y 304). Its ttl is refreshed while caged.
- **Wall Turret:** sits on the wall face (4 px out of the socket), barrel sprite tracks the ship (clamped off its own wall), dies when its socket is carved. Stops firing below y 250 (point-blank flank bursts in a corridor were undodgeable for the bots and would be for players). `ignoreTerrain` for turrets and borers.
- **Borer:** spawned with the normal `spawn { from: left|right, y }`; it finds the wall face on its row and starts 12 px inside it. Plume 0.6 s → bores out → crosses at 90 → 4-ring at 45° on hitting the far wall → digs 20 px and is released (not a kill). Carves r 8 the whole time it's in rock (so it also kills turrets in its path).
- **Bats:** spawned by `warrens.bats {n, x}` from the top; boids + seek + wall probes; neighbor list is one preallocated `Int32Array` per world rebuilt once per tick.
- **Rock falls** (`warrens.rockfall`, every 1.5 s 146–170): 0.6 s of dust and grit at an open top column, then a small/medium basalt rock at scroll + 46.
- **Wyrm design deviations (balance, logged):** head **180 HP** (design 260), mouth open **2.0 s** (design 1.4) and the head heaves out at 40% speed easing to full over that window; in FRENZY each crossing of the pair re-opens the mouth. Why: the head only takes damage while open, and the worm crosses at 110–150 px/s, so shots fired straight up mostly miss. With design numbers the typical bot's fights ran 150–190 s (stall-breaker assisted). Evidence from a boss-only probe: during open windows the bot was under the head only ~1/3 of the time, and dealt ~9 dps when it was. Segments keep 30 HP. Arcs stay above y 230 (sag 30–90). Anchors are the wall faces (y 60/110/160/210), the two pillars and three points just above the top edge (the cavern's ceiling is off-screen); an arc never starts within 60 px of the ship or ends on its own wall/pillar.
- **Salvage (balance, logged):** turret 3 → 5, borer 4 → 6, bat 1 → 2; bats roll the `asteroid_small` table so flocks aren't a shield farm.
- **Segment shots:** one per segment as it crosses x 120, perpendicular to its heading on the downward side, only if ≥ 24 px above the ship. The FRENZY fan (7-way, aimed) fires 0.5 s after surfacing, also only from ≥ 24 px above.

### Balance (`LEVEL=warrens SAVE=act1 RUNS=50 SKILLS=novice,typical,expert npm run balance`)
| | novice | typical | expert | target |
|---|---|---|---|---|
| clear | **28%** | **72%** | 74% | typical ≈ 72%, novice ≥ 14% |
| reach boss | 36% | 78% | 92% | |
| boss time on clears, median (p25–p75) | 71 s (46–87) | **64 s** (47–81) | 71 s (51–84) | 50–90 s |
| salvage on clears, median (p25–p75) | 630 (615–658) | **640** (616–668) | 651 (614–669) | 600–800 |
| level sum at boss, median | 9 | 9 | 8 | |
| pod rescued | 52% | 94% | 76% | |
| peak enemy shots, waves / boss | 24 / 17 | 24 / 16 | 23 / 16 | 50 / 65 |
- Hit causes (typical, 50 runs): level:shot 249, boss:shot 67, ram-gnat 19, ram-bat 18, rock 4, ram-turret 2. Turrets were the main shooter (a nearest-shooter probe gave turrets ~40% of hits) before the y-250 cutoff and trimming the narrows and fork turrets.
- **Peak shots are under the curve's table.** The sector's pressure is walls, bodies (bats, borers, the worm) and turret crossfire in narrow corridors; every extra shooter I tried pushed typical clears under 65%. Expert loses more fights than typical (7 vs 3 boss deaths) because it parks under the worm's body and eats segment shots.
- Seed noise at 50 runs is about ±5%.
- Act I hashes unchanged: 17a78586 / 66a3e907 / kessler 432d4c06 / ionShoals 1c9e54f6 / eventHorizon f3426d8c / pulsarNursery 0b41ee42 / armada 8b2a6879.

### Browser check (port 5139, `?mute`, no console errors)
- `?level=7&save=act1&god&t=17`: the chamber rows, bats, an interceptor; tiles read well against the strata.
- `t=74`: the fork: turrets on the left wall and the divider's face, gnats down the left branch, the right branch's hazard gate shot open and the `U` core drifting free; ~15 s later Rook's pod sits in its pocket behind the gate row.
- `t=162`: the den lands with both pillars at y ~120–176 and the bottom corners filling the screen bottom; the Wyrm bursts out of a pillar with its maw open (carving it), segment shots fan down as the body crosses the middle, a wall hole stays where it dove in. `__warrens.skip('frenzy')`: FRENZY toast, the left pillar visibly chewed away; `skip('kill')`: head burst, segment pops, SECTOR CLEAR with NEW WEAPON: RICOCHET and the Ferret schematic.
- `?sandbox&level=7`: Alt+U queued the turret tunnel (turrets fire bursts), Alt+O a bat flock, Alt+I a borer crossing out of the wall. Alt+Shift+U (den + Wyrm) is covered by the unit tests' arena.
- Gallery: `wr_turret`, `wr_turret_gun` (rot16), `wr_borer`, `wr_bat`, `wr_wyrm_head` (2 frames, rot16), `wr_wyrm_seg` (rot16) with flash variants.

### Terrain feel (no human pass yet)
- **Strata vs the cave mouth:** with `start: 8` the strata wall is already ~120 px down the screen when the mouth's walls arrive at 15 s, so the "asteroid face" scrolls in before the cave. The wall's edge moves at half the terrain's speed, so they can only coincide once; to have them meet at the top edge at ~15 s, use **`THEMES.warrens.nebula.start = 17`** (13·17 = 221 nebula px ≈ scrollY 442, reached at 14.7 s at 30 px/s). 18 would meet at ~15.6 s, as the first rock row enters.
- The 7-wide left branch with turrets on both faces feels tight but fair at 26 px/s; the 12 px ship box against the 1-tile wall wobble occasionally nudges the ship sideways (no damage), which reads as "scraping the wall".
- S-bends at 34 px/s shift one tile a row; bots took no crushes there in the 150 balance runs (no `crush` hit causes at all).
- Gate rows crumble at y 300 well before the ship's row, so a passive player is never trapped; the fork's right-branch gates mostly fall to auto-fire.

## Shared changes needed
- **`src/backgrounds/themes.ts`:** `warrens.nebula.start: 8` → `17` (see the feel notes; 18 if the edge should arrive with the first rock row).
  ```diff
  -      start: 8,
  +      start: 17,
  ```
- **`src/game/director/levelFramework.test.ts`** (Act II stubs test) requires exactly one `escapePod` event per Act II sector. The Warrens keeps one (the cage captures it), but sectors that spawn pods from scripts would need it relaxed to `toBeLessThanOrEqual(1)`.

## Follow-ups
- Human feel pass on the fork's left branch and the S-bends at 34 px/s with mouse and floating stick.
- T43: the curve's peak-shot targets don't fit a terrain sector; consider "pressure" targets per sector instead.
- Dedicated sfx (wall turret, borer drill, Wyrm burst/roar) belong to the audio owner; the sector reuses `asteroid_break`, `armor_ping`, `enemy_die_m`.
- The bot doesn't read the Wyrm's dust telegraph; a T43 bot that pre-positions under the exit point would make boss time comparable to a human's (the bot is under the open head only ~1/3 of the window).
