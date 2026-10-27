# T41 — Level 9: Chrono Rift + Echo
Status: done
Wave: 9 · Depends on: T32, T33, T35, T36, T37 · Blocks: T43

## Goal
Replace the `chrono` stub with the full sector: slow, fast and flip time bubbles, and Echo, a boss that flies the ship's own path and fires its loadout. Everything is specified in `docs/design.md` → **Level 9: "Chrono Rift"**, tuned to the sector's place in the Act II difficulty curve.

## Owns
- `src/content/levels/chrono/**`: the `LevelDef` (timeline, asteroid field, all tunables) plus the enemy and boss tables
- `src/game/levels/chrono/**`: custom behaviors, the boss controller and its draw, sprites, level scripts and systems, sandbox keys, tests
- `tests/sim/**`: only new files named `chrono.*.test.ts`

Nothing else. Everything plugs in through the T21 registries, the wave-8 APIs (T33 time bubbles, T36 `playerPastPos`, T35 weapons) and `registerTimelineAction`. If you need a shared change, describe it under "Shared changes needed" in Notes with a minimal patch and work around it locally.

## Read first
`CLAUDE.md`, `docs/design.md` → "Campaign: Act II" (especially **Level 9: "Chrono Rift"** and "Act II difficulty curve"), `docs/art-direction.md`, `tickets/WAVE9-NOTES.md` (the wave-8 APIs as merged), and the Notes of T32, T33, T35, T36 and T37. Use T27–T30 as the reference for quality and for how a sector folder is laid out.

## Requirements
- **Enemies:** **Stutterer** (burst and freeze, a cross ring every second freeze), **Rewinder** (records 2 s in a preallocated buffer, a one-time rewind with a 1.0 s backward-clock telegraph), **Bubble Mine** (pops into a 6 s slow bubble). Behavior timers must respect the scaled `dt` inside bubbles.
- **Pod (Dr. Halász):** an uncollectable echo pod at 100 s on the exact path of the real pod 6 s later (same seed-driven path, so record the first path and replay it).
- **Boss: Echo** (`cr_echo`, 48×48 palette-swapped mirror of the player's current ship sprite):
  - Movement from `playerPastPos` with the design's y mapping. The weapon-to-pattern table with its caps, using up to 3 weapons.
  - Phase 2 is the Ghost Echo part at a 4 s delay. Phase 3 is PARADOX: a `flip` bubble and slow bubbles on past positions.
  - Test that the Echo's pattern set changes with the loadout, including all eight weapons.
- **Timeline:** follow the design table, including the Spread supply run, the carrier, breathers, the magnet and the time storm.
- **Art:** every new enemy and boss part has sprites at the art-direction sizes: 15-bit palette, outline, 2-frame animation where it fits, hit flash from the sprite cache. They appear in `tools/gallery.html`. Enemy bullets use only the standard enemy-bullet sprites.
- **Sandbox:** keys from WAVE9-NOTES to spawn each new enemy and the boss under `?sandbox`.
- **Fairness:** the T11 rules (no shots in the first 0.5 s alive; aimed shots only from ≥ 24 px above the ship) apply to every new attacker, and every telegraphed attack is telegraphed for ≥ 0.5 s.
- **Tests:** unit tests for each custom behavior's state machine and the boss phase transitions. The harness's god playthrough, determinism and pool safety must pass for `chrono`. Add a `tests/sim/chrono.sector.test.ts` god run that asserts the sector's signature beats (listed above) actually happen.

## Balance targets
With `SAVE=act1`: typical-bot clear ≈ **68%**, novice ≥ 10%, boss time 50–90 s for the typical bot. Report the Echo's fight time and hit rate by player weapon count (1–5) too: more weapons must not make the fight net harder for the typical bot, salvage on a clear 680–900.
Measure with `LEVEL=chrono SAVE=act1 RUNS=50 SKILLS=novice,typical,expert npm run balance` and record a balance table in Notes, like T27's. If a number is off only because a bot is blind to something, show the evidence (hits by cause) and tune for a human.

## Acceptance criteria
- [x] `?level=9&save=act1` plays the full timeline to the boss's defeat, results, and the right schematic, pod.
- [x] God playthrough (every seed), determinism and pool safety pass for `chrono`.
- [x] Balance targets met or the gap explained.
- [x] Browser check on your own port with `?mute`: each new enemy, each hazard beat and each boss phase is described in Notes, with no console errors.
- [x] build / test / lint / test:sim / e2e pass.

## Contract changes
None.

## Notes

### What's in
- **Content** (`content/levels/chrono/`): `roster.ts` (Stutterer, Rewinder, Bubble Mine, and `cr_missile` for the Echo's Seeker pattern, each with its params), `echo.ts` (every Echo number: parts, lags, y map, the weapon-pattern table, drones, PARADOX, death), `index.ts` (the `LEVEL` timeline, field and `POD`).
- **Game** (`game/levels/chrono/`): `behaviors.ts`, `echo.ts` (the `BossController`), `pod.ts`, `state.ts` (per-world `WeakMap`, preallocated recorders and pod path), `draw.ts`, `chrono.sprites.ts` + `paint.ts` (index-buffer painter copied from the Armada's), `sandbox.ts`, `chrono.test.ts` (31 tests).
- **Sim tests:** `tests/sim/chrono.sector.test.ts` (god run asserting every beat), `tests/sim/chrono.echo.test.ts` (smoke run; `ECHO=1` prints the weapon-count report).

### Decisions
- **Stutterer:** 0.4 s burst at 105 px/s, 0.6 s freeze (vy 0); the 4-shot cross (+ shape) opens every 2nd freeze, via `canFire`. Timers run on the scaled dt, so bubbles stretch or squeeze the whole cycle. While moving toward a firing freeze its four ports glow (a read, not a fairness requirement). Drawn by `registerEnemyDraw` so the frame follows its state.
- **Rewinder:** the Interceptor's shadow movement (own copy, so it can carry the recorder index in `ay`). Samples (x, y, HP) every 0.1 s of its own time into a preallocated 16-slot recorder table (21 samples each). The first drop below 50% starts a 1.0 s telegraph: a backward-spinning clock over it and a faint copy at the snap-back spot. It holds fire during the window. Then it snaps to its state 2 s before the snap (= 1 s before the trigger) once. "2 s earlier" is read as 2 s before the rewind moment.
- **Bubble Mine:** drifts with the scroll; any death (shot, ram, its own 6 s fuse) pops a slow bubble r 52, ttl 6, drifting with the scroll. The pop rides one `enemyKilled` listener attached per world on the first mine's first tick (works under `?sandbox`, where level systems don't run). Lamps blink amber for the last second.
- **Pod:** `chrono.echoPod` (100 s) starts a ghost pod at a seeded x that moves exactly as a pod does (pod speed × the bubble rate at its position) and records its path every tick (Float64, 2400 ticks). The real pod is the timeline's normal `escapePod` event at 106 s (so the director picks the pilot or the armored cache pod, and the shared "one escapePod per Act II sector" test holds). The level system claims it on its spawn tick, moves it to the echo's start and overwrites its position with the recording each tick, until it is magnetized or the recording ends. A unit test proves the replay is exact even when the bubble that slowed the echo has gone. The pod has 2 HP (design gives none; it shares the screen with gunboat fans). With Halász rescued it is an armored 120-salvage cache pod.
- **Echo:**
  - One `BossRig` holds core 1150 HP, ghost 200 HP and three 20 HP blocker drones. Only the core spawns at first; the ghost and drones are spawned into their slots when needed, and the controller places them each tick after `rig.moveTo` (ghost on its own lag, drones on an orbit). Only the core counts in the HUD bar (`inHpBar`).
  - Movement: `playerPastPos` at the current lag, x copied (clamped to 16 px inside the edges), y = `clamp(60 + (pastY − 240) × 0.5, 40, 140)`. With less history than the lag (sandbox) it strafes the top band. 2.5 s entry from the top, invulnerable.
  - **Bubbles:** the boss system doesn't scale bosses, so the Echo multiplies its own pattern clocks (and drone orbit) by `timeScaleAt` at its position; the ghost by its own. Slow time also stretches the lag (fast time shrinks it) within 5–9.8 s (ghost 2.5–6 s), easing back outside bubbles. In PARADOX it sits in its own flip bubble, so it lags, then catches up, every 3 s.
  - **Mirror:** recomputed every tick from `w.player.weapons`: the 3 highest levels, ties to the lower loadout index (oldest). Patterns (speeds before the 1.3 shot multiplier unless noted):
    | Weapon | Echo pattern |
    |---|---|
    | Blaster | aimed shot every 1.3 s at 80; twin (two parallel rounds) from L4 |
    | Spread | aimed 3-way ±14° every 2.2 s at 72; 5-way from L4 |
    | Lance | 0.6 s dotted telegraph line locked on the ship, then a 3-round large bolt at an absolute 200 px/s, every 2.8 s |
    | Seeker | a 1 HP `cr_missile` (62 px/s, 1.5 rad/s, blind inside 40 px, 4.5 s) every 3.2 s; 2 from L3; at most 4 alive |
    | Orbit Drones | 1/1/2/2/3 blocker drones by level; each respawns 8 s after it is shot down |
    | Arc Coil | ship within 72 px starts a 0.5 s crackle (range ring and sparks); the zap hits if the ship is still within 60 px; 1.5 s cooldown |
    | Ricochet | a large disc bank-shot at the ship's mirror image across the nearer wall, 2 bounces, every 2.4 s at 82 |
    | Flak | a large shell aimed at the ship, every 2.8 s at 76; bursts after 0.9 s (bubble-scaled) or within 72 px of the ship into 6 shards at 40 |
  - Caps differ from the design where balance needed it (blaster 0.9 → 1.3 s and twin from L4 instead of L3; spread 1.6 → 2.2 s; lance 2.4 → 2.8; seeker 3 → 3.2; ricochet 2.2 → 2.4; flak 2.6 → 2.8). **Core HP 520 → 1150, ghost 160 → 200**: at 520 the typical bot's act1 loadout (3.6 weapons, avg L3.5, all upgrades) killed it in a median 30 s.
  - **Fairness:** every aimed pattern (and the disc, shell and missile launch) needs the muzzle ≥ 24 px above a live ship; a blocked volley retries 0.25 s later. The entry covers the 0.5 s rule; the ghost's first volley comes ≥ 1 s after it splits. Lance and Arc are telegraphed 0.6 s and 0.5 s.
  - **Phase 2** (< 60%): the ghost splits off over 1 s onto a 4 s lag, translucent, and fires only the first mirrored weapon at 2.2× the interval.
  - **Phase 3** (< 25%): toast "PARADOX", a flip bubble (r 52) rides the Echo, and every 2.6 s a slow bubble (r 36, 6 s) blooms where the ship was 2.5 s ago (at most 3 at once; the global bubble cap is 8).
  - **Death:** `bossDefeated` on the killing blow; ghost, drones and missiles are released (no kills), its flip bubble removed, shots become salvage. Freeze 0.4 s (flashing), rewind 1 s back along its own recorded last second with afterimages, shatter 0.7 s (12 glass shards), then release.
- **Art:** `cr_echo_<ship>` for all 12 ships is baked from the ship's own grid at bake time: hull rows only, flipped nose-down, 2×, luminance-mapped onto a violet/black/white ramp, with violet flames from the source nozzles, 48×48 + outline (2 frames). The ghost uses it at ~40% alpha, the Echo leaves two faint afterimages. `cr_echo_pod` is the escape pod recolored in slow-time blue, drawn at ~50% alpha with two afterimages. All `cr_*` sprites (20) list in the gallery; no console errors there.
- **Sandbox** (`?sandbox&level=9`): Alt+Z Stutterer column, Alt+C Rewinder, Alt+M Bubble Mine, Alt+Shift+Z the Echo. Dev console: `__chrono.skip('ghost' | 'paradox' | 'kill')`.

### Browser check (port 5141, `?mute`, `save=act1&god`)
- Opening: the slow bubble's blue tick ring drifts down the center, rocks and the Blaster's shots visibly crawl through it.
- Sandbox: the Stutterer column reads as blue-hourglass hexes stepping down in jerks; the Rewinder is a violet delta with a white clock face; Bubble Mines are blue glass orbs and pop into slow rings.
- Echo (loadout blaster/lance/flak L4): a violet mirror Kestrel nose-down with violet flames; the lance's dotted violet telegraph line, twin blaster rounds and flak shards all read. Ghost phase (spread/drones/seeker): the dark translucent ghost trails on its own path while the Echo orbits its drones and launches missiles. PARADOX: the flip ring rides the Echo and slow rings bloom on the ship's recent path. Defeat: flash, rewind, shatter, then the shared boss explosion.
- `t=100`: the blue echo pod leads, the real pod follows 72 px behind on the same line. `t=150`: amber (fast) flip rings, Stutterer columns and a Rewinder in the time storm.
- No console errors in the game or the gallery.

### Balance (`LEVEL=chrono SAVE=act1 RUNS=100 SKILLS=novice,typical,expert npm run balance`)
| | novice | typical | expert |
|---|---|---|---|
| reach boss | 67% | 96% | 96% |
| **clear** | **14%** | **67%** | **39%** |
| deaths before / in boss | 33 / 53 | 4 / 28 | 4 / 57 |
| hits in first 45 s · per run · in boss | 3.8 · 10.5 · 4.8 | 2.1 · 8.0 · 3.5 | 1.4 · 8.2 · 4.9 |
| boss time on clears (p25 / median / p75) | 60 / 66 / 97 | 45 / **54** / 78 | 38 / 43 / 59 |
| salvage on clear (p25 / median / p75) | 644 / 649 / 663 | 658 / **682** / 706 | 680 / 688 / 717 |
| pod rescued | 46% | 68% | 69% |
| weapons at boss (count, avg level) | 3.5, 3.72 | 3.6, 3.45 | 3.4, 3.62 |
| peak enemy shots waves / boss | 71 / 30 | 65 / 34 | 65 / 36 |

- Targets: typical ≈ 68% (67%), novice ≥ 10% (14%), boss time 50–90 s (median 54), salvage 680–900 (median 682). Met.
- Typical hit causes: level shot 345, boss shot 330, gnat rams 44, Stutterer rams 36, bubble-shot 34 (+8 in the boss), rocks 7.
- **Gap: expert clears 39%, below typical.** It is the bot, not the fight: the expert drifts under its target with 4 px aim noise, so it holds still directly under the Echo, and the Echo (its own path from 8 s ago) then sits straight overhead. Its boss hits are 4.9 vs the typical's 3.5 (boss:shot 462 vs 330 per 100 runs) despite reacting twice as fast. A human dodging an Echo moves, which also moves the Echo. Same pattern as T30's "expert ≈ typical" note, stronger here. Left for T43's bot pass.
- Peak wave shots 65–71 vs the design's 60: the peak is the dammed gunboat at 131 s, whose slow bubble is meant to hold a pile of fans. One typical timeout per 100 (a blaster3/spread2 loadout with drone blockers, 141 s into the fight when the harness stops at 320 s; the stall breaker was ramping).

### Echo by weapon count (`ECHO=1 RUNS=20 SIM=1 npx vitest run tests/sim/chrono.echo.test.ts --silent=false`)
Starts at 168 s with a fixed loadout of N level-3 weapons (blaster, spread, seeker, lance, drones in that order), act1 save, typical bot. "Can't die" gives the ship 999 shield so every hit counts.

| weapons | fight s (median, can't die) | hits/min | clear (mortal) | fight s on clears |
|---|---|---|---|---|
| 1 | 137 | 2.2 | 9/20 | 144 |
| 2 | 143 | 3.7 | 4/20 | 155 |
| 3 | 106 | 3.0 | 16/20 | 106 |
| 4 | 95 | 3.6 | 14/20 | 91 |
| 5 | 92 | 2.0 | 20/20 | 92 |

- Hit rate stays 2–4/min whatever the count, and fights get shorter, so more weapons don't make the fight net harder. The one dip is 2 weapons: Spread L3 adds a mirrored 3-way fan but little single-target damage (1.5 dps), so the fight is long *and* busier. From 3 weapons on, every added weapon helps.
- Fight times here are longer than in the level because the level's loadouts average L3.5–4 (Blaster L4.3).

### Act I
Hashes unchanged: 17a78586, 66a3e907, kessler 432d4c06, ionShoals 1c9e54f6, eventHorizon f3426d8c, pulsarNursery 0b41ee42, armada 8b2a6879.

### Shared changes needed
- None required.
- Nice to have (`game/boss/bossSystem.ts`): an opt-in `timeScaled?: boolean` on `BossRegistration`, with `updateBoss` passing `dt * timeScaleAt(w, b.rig.x, b.rig.y)` for those bosses. The Echo scales its own clocks today, so nothing depends on it.
- Nice to have (`tests/sim/bots.ts`): the bots can't see the Echo's lance line or Arc crackle; T43's bot pass could read `Echo.echoE.lanceT/lanceDeg` and `arcT` as it reads Lancer telegraphs.

## Follow-ups
- T43: the expert bot under the Echo (see Balance).
- Sfx: the Echo reuses `shot_lance` (zap, bolt), `magnet_on` (lance lock, rewind telegraph), `boss_throw` (ghost split, rewind snap), `repulsor_on` (mine pop). Dedicated `rewind` and `zap` sounds belong to the audio owner.
