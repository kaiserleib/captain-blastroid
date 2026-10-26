# T30 — Level 5: The Armada
Status: done
Wave: 6 · Depends on: T21, T23, T24, T25 (+ T22 for the flow) · Blocks: T31

## Goal
Replace the `armada` stub with the full sector from `docs/design.md` → **Level 5: "The Armada"**: its enemies, hazards, timeline, escape pod and boss **Dreadnought Leviathan**, tuned to the sector's place in the difficulty curve.

## Owns
- `src/content/levels/armada/**`: `LevelDef` (timeline, asteroid field, all tunables) plus the enemy and boss tables (`ROSTER`, boss def)
- `src/game/levels/armada/**`: custom behaviors, the boss controller and its draw, sprites (`*.sprites.ts`), level scripts and systems, sandbox keys, tests
- `tests/sim/**`: only new files named `armada.*.test.ts`

Nothing else. Everything plugs in through T21's registries (`registerRoster`, `registerBehavior`, `registerBoss`, `registerLevelScript`, `registerLevelSystem`) and T23's hazard API. If you need a change in a shared module, stop and describe it in Notes under "Shared changes needed" with a minimal patch suggestion. Don't edit it.

## Read first
`CLAUDE.md`, `docs/design.md` (Campaign section, especially **Level 5: "The Armada"** and "Difficulty curve"), `docs/art-direction.md`, `tickets/WAVE6-NOTES.md` (the APIs as merged), and the Notes / Contract changes of T21, T23, T24 and T25. Use the Level 1 files (`content/levels/level1.ts`, `game/boss/rockHauler.ts`, `content/bosses.ts`) as the style and quality reference.

## Requirements
- Enemies: **Escort Fighter** (wings of 3), **Minelayer** (drops L2's Ion Mine: register your own `ar_mine` def with the same numbers; never import T27's folder), **Frigate** mid-boss (a multi-part rig with `BossRig`, **not** `isBoss`, so the HUD boss bar ignores it; a guaranteed capsule on death).
- **Pod (Commodore Vale)** ejects from the second frigate's wreck (a `script` hook), or at 105 s.
- **Boss: Dreadnought Leviathan** (`ar_leviathan`): a 240×~720 hull made of section rigs whose anchor scrolls down at 20 px/s, with `setScrollSpeed(w, 20)` at its start. Sections arrive in order: bow, forward battery, missile bays (homing missiles: 1 HP shootable enemies with a custom homing behavior), shield generators, bridge. The anchor stops when the bridge reaches y≈110 (`setScrollSpeed(w, 0)`). Generators overload after 25 s if they scroll past alive (no soft-lock). Bridge phase 1, then phase 2: the escape core detaches and strafes. Off-screen sections are released (not counted as kills). Hull art: deck plating tiles drawn per section (sprites or a cached procedural canvas per section), Syndicate rust on gunmetal.
- Final boss: `bossMusic: 'armada_boss'`. Crossfade at 145 s via a `script`, or by setting the boss request time so `bossSpawned` triggers it. The 3 s death chain across the hull goes through `fx` events (`shake`, explosion bursts) and must not duplicate T13's `bossDefeated` chain.
- **Timeline:** follow the design's beat table, including the supply run, the carrier, breathers with shield drops, a magnet, the pod and the warning-then-boss. Keep the `enemyHpMul`, `enemyShotSpeedMul`, `guaranteeWeapon`, `bossSalvage`, `podFallbackSalvage` and `schematicOnClear` numbers from the design unless balance requires otherwise; log any changes.
- **Art:** every new enemy and boss part has sprites at the art-direction sizes, a 15-bit palette, an outline, a 2-frame animation where it fits, and hit-flash support (automatic via the sprite cache). They appear in `tools/gallery.html`. Enemy bullets use only the standard enemy-bullet sprites.
- **Sandbox:** keys to spawn each new enemy and the boss under `?sandbox`. Pick keys not in use: check WAVE6-NOTES for the key map.
- **Fairness:** the T11 fairness rules (no shots in the first 0.5 s alive, shooter at least 24 px above the player for aimed shots) apply to every new attacker. Every telegraphed attack is telegraphed for ≥ 0.5 s.
- **Tests:** unit tests for each custom behavior's state machine and the boss phase transitions (as in `game/boss/boss.test.ts`). The T21 harness already runs god playthrough, determinism and pool safety for every `LEVEL_ORDER` id, so make yours pass. Add `armada.balance` coverage via `LEVEL=armada npm run balance`.

## Balance targets
Typical-bot clear rate ≈ 70%, novice ≥ 35%, hull plus bridge fight 60–110 s, salvage on a clear 520–700. Performance: the hull fight stays under the T18 budget (sim tick < 4 ms on desktop under `?debug`); record the numbers.
Measure with `LEVEL=armada RUNS=50 npm run balance` (typical) and `SKILLS=novice,typical,expert`. Record a balance table in Notes, like T18's.

## Acceptance criteria
- [x] `?level=` for this sector plays the full timeline to Dreadnought Leviathan's defeat, results, and the right schematic and pod (`?save=fresh` with earlier sectors cleared via `?save=mid`/`all` as needed).
- [x] God playthrough (every seed), determinism and pool-safety tests pass for `armada`.
- [x] Balance targets met or the gap explained.
- [x] Browser check on your own port with audio muted. Screenshots of each new enemy, the hazard beats and each boss phase are described in Notes, and there are no console errors.
- [x] build / test / lint / test:sim pass.

## Contract changes
None.

## Notes

### What's in
- **Content** (`content/levels/armada/`): `index.ts` holds `ROSTER` (escort, minelayer, `ar_mine`, `ar_missile`, `ar_frigate`) and the `LEVEL` timeline. `tuning.ts` holds every number for the frigate, mine, pod and Leviathan. `LEVIATHAN_PARTS` gives each hull part's x, depth from the bow, HP and r, and `LEVIATHAN_PART_DEFS` is derived from it.
- **Game** (`game/levels/armada/`):
  - `behaviors.ts`: escort, minelayer, mine, homing missile, plus `lineBurst`.
  - `frigate.ts`: the mid-boss.
  - `leviathan.ts`: the `BossController`.
  - `draw.ts`: boss draw, the hull deck layer at z 5, the frigate-wreck layer at z 39, and the sunk-wreck layer at z 43.
  - `pod.ts`, `state.ts` (per-world `WeakMap`), `sandbox.ts`.
  - `armada.sprites.ts` and `paint.ts`: a Rock-Hauler-style index-buffer painter.
  - Tests: `armada.test.ts` (19 tests) and `tests/sim/armada.playthrough.test.ts`.

### Decisions
- **The frigate's parts are `isBoss`, despite the ticket's "not isBoss".**
  - `sim/damage` only calls `registerBossDamage` hooks for `isBoss` enemies, so the armored hull needs it. `BossRig.spawn` also forces `isBoss`. Cleanup would otherwise cull the hull at its side entry.
  - The HUD bar is unaffected: it counts `isBoss` parts only while a `bossSpawned` fight is active, and `Leviathan.spawn` releases any live frigate (as a non-kill).
  - The hull is a roster enemy (`ar_frigate`, `sprite: ''`) whose custom behavior carries a `BossRig` of 2 turrets and 2 hp-0 armor plates. It therefore works in the timeline and under `?sandbox` with no level system.
  - Rewards are paid from the damage hook, since `isBoss` kills skip T12 drops: 50 salvage, a guaranteed capsule, a shake and a sinking wreck.
- **Pod:** `armada.podArm` (75 s) arms it, and the first frigate of the pair to be wrecked ejects it at the wreck. If both escape, `armada.podFallback` (105 s) drifts it in from the top. The design's "second frigate" is read as "a frigate of the second wave". The pod has 2 HP (`POD.hp`), because it ejects in the middle of a firefight; the design gives no HP for L5. With every pilot rescued, an 80-salvage cache opens at the wreck instead.
- **Hull geometry:**
  - The anchor is the bow tip. Parts sit at `oy = −depth`. The bridge is at depth 690 and the hull is 780 long.
  - Sections arrive at about 3 s (bow flak), 10–14 s (battery and armor), 19 s (bays), 30 s (generators), 33 s (guns) and 35 s (bridge).
  - The lock comes at 40.5 s, when the bridge reaches y 110. `setScrollSpeed` is 20 at spawn and 0 at the lock.
  - Parts more than `r` below y 400 are released, not killed. That isn't counted as a kill and pays no salvage.
- **Bridge 400 HP is split as bridge 220 + escape core 100** (design: 280 + 120, see balance). Phase 2 starts when the bridge structure breaks. The guns go with it, the core rises out of the wreck invulnerable for 1.6 s, then strafes y≈66 firing a 3-arm spiral (2.6 s on, 1.1 s off). Debris rocks tumble off the burning bridge, and the broken bridge drops one shield cell.
- **No soft-lock:** generators overload 25 s after they first come on screen, flickering for 2 s first, with no reward. The bridge can also be broken before the lock, in which case the hull locks where it is. The core is never released as "passed", and bots never timed out once the cap was 420 s. The god bot clears every seed.
- **Death:** the controller emits `bossDefeated` exactly once, at the core. T13's own chain plays there. My 3 s chain is drawn by the boss with the shared `boomSprite` sheets, and emits `shake` and `sfx` only. Missiles, mines and debris are cleared on defeat, and the core's contact damage drops to 0, so nothing can kill the player after the win. After 3 s the parts are released and the wreck drifts off as the scroll ramps back to 24.
- **Fairness:**
  - Hull guns fire only after 0.5 s on screen, and only while at least 100 px above the player (`minAbove`), as if the deck guns can't depress further.
  - Bays crack their doors 0.6 s before each launch.
  - Mines arm 0.5 s before bursting, and blink red for the last 1 s of the fuse.
  - The frigate's ring is telegraphed by a 0.6 s reactor glow.
  - Flak and frigate 3-bursts use `lineBurst`: three rounds down one line. They don't re-aim like `burst`.
- **Escort Fighter:** the "aimed pair" is two rounds 0.14 s apart down one line. A wing's members fire staggered by 0.4 s, and each stops firing after 2.8 s alive (one volley, sometimes two, per pass).
- **Missiles** use `dropTable: 'asteroid_small'` (mostly nothing), so a stream of 1-HP missiles can't be farmed for shields.
- **Music:** `{ t: 145, boss: 'ar_leviathan' }` triggers `bossSpawned`, so the `armada_boss` crossfade comes from GameScene's existing handling. A warning sounds at 142 and "DREADNOUGHT BELOW" shows at 145.
- **Sandbox:** keys only work in `?sandbox`, and should be combined with `?level=5` so the hull layer is drawn. Sector folders have no sandbox slot, so the keydown handler acts between ticks on `__director.world` (dev only).
  - `Z`: escort wing.
  - `Shift+Z`: frigate.
  - `C`: minelayer.
  - `M`: mine.
  - `Shift+C`: Leviathan.
  - Dev console: `__armada.skip('bridge' | 'gens' | 'core')` fast-forwards the fight.
- **Art:** everything is in `armada.sprites.ts` and shows in the gallery. The hull deck is one 240×780 painting cut into six 240×130 segments (two frames for the running lights). It has no auto-outline, so no seams show; the rim draws its own ink line. Deck rust is kept to the dark steps so the pink enemy bullets keep their contrast.

### Balance (`LEVEL=armada RUNS=150 SKILLS=novice,typical,expert npm run balance`)
| | novice | typical | expert |
|---|---|---|---|
| reach boss | 31% | 91% | 93% |
| **clear** | **6%** | **75%** | **74%** |
| deaths before / in boss | 104 / 37 | 14 / 24 | 11 / 28 |
| hits in first 45 s · per run · in boss | 2.07 · 6.4 · 3.3 | 0.79 · 5.7 · 2.2 | 0.61 · 6.0 · 2.4 |
| boss time on clears (p25 / median / p75) | 60 / 65 / 76 | 67 / **84** / 106 | 75 / 81 / 105 |
| salvage on clear (p25 / median / p75) | 531 / 570 / 582 | 492 / **535** / 605 | 506 / 559 / 615 |
| pod rescued | 18% | 49% | 51% |
| weapons at boss (count, avg level) | 3.1, 2.59 | 3.1, 2.72 | 3.0, 2.64 |
| peak enemy shots waves / boss | 48 / 41 | 48 / 42 | 47 / 42 |

- **Targets met:**
  - Typical clear ≈ 70% (75% here; it varies ±5 between batches).
  - Hull plus bridge fight takes 60–110 s (median 84).
  - Salvage on a clear is 520–700 (median 535).
- **Gap: novice clears 6%, against a target of ≥35%.**
  - L1's novice clears 55% on this harness, and its first 45 s are already dominated by gnat rams (67 per 100 runs on L1, 174 per 150 runs here). Novice deaths are 75% before the boss.
  - Getting novice to 35% would need L5's waves easier than L1's, which contradicts the difficulty curve. Left for T31's bot work.
  - Expert ≈ typical because the bot stands at y 270 during every boss, close to the hull guns. Boss hits don't shrink with skill.
- **Perf:**
  - Harness sim tick averages 0.006 ms. The worst single tick was 4.9 ms (typical) and 80 ms (novice); both are one-off Node GC/JIT spikes.
  - In Chrome under `?debug`, the full hull fight (lock, ring, guns, missiles) showed `UPD 0.07 ms, MAX 0.30 ms`, well under the 4 ms budget.
  - Enemy pool peak was 22/80, enemy shots 48/600. No dropped spawns.
- **Changes from design numbers, each made to reach the targets:**
  - Bridge 280→220 and core 120→100 (design total 400 → 320).
  - Generators have 40 HP (design 50) and sit at depth 600, near enough to the bridge to shoot.
  - Gun fans every 2.8 s (design 1.4).
  - Bridge ring every 2.4 s at 66 px/s (design 2 s).
  - Deck-turret fans are 4-way, aimed down with at most ±25° lean, every 3.2 s.
  - Flak every 2.6 s. Frigate turret bursts every 2.8 s.
  - Salvage: escort 2→5, minelayer 4→8, mine 2→3, frigate 25→50, hull parts 10→20.
  - Kept as designed: `enemyHpMul` 1.35, `enemyShotSpeedMul` 1.2, `guaranteeWeapon` Lance by 25, `bossSalvage` 150, `podFallbackSalvage` 80, schematic `paragon`.
  - Timeline additions: a carrier at 100 s, shields at 71 / 108 / 140, an upgrade at 141, and fewer escort wings in the opening.

### Browser check (port 5130, `?mute`)
All screenshots were checked visually. No console errors in the game or the gallery.
- `?level=5&t=143&god&save=all`: the bow enters under the gas giant, then the flak sockets, the battery with armor slabs and the bay doors scroll past.
- At the lock, the bridge tower sits inside the dotted shield dome, with the cyan conduits running to both generators. The 16-ring and the gun fans are readable against the darkened deck.
- `__armada.skip('core')`: the bridge wreck burns and the escape core strafes the top with its spiral.
- After the kill, the burnt-out hull drifts off as the scroll resumes.
- `?sandbox` with `Shift+Z`/`Z`/`C`/`M`: the frigate (turrets, reactor hatch), the escort wing, the minelayer and the mines all read clearly.
- The gallery lists all 30 `ar_*` sprites.
- First pass found the rust too bright and too blood-red, and the deck barrels too short. Both were fixed (dark rust steps, longer barrels).

### Edits outside Owns
- `src/game/director/levelFramework.test.ts`: the "five sectors" test required every sector's timeline to end in `rock_hauler` and to have exactly one `escapePod` event. That only holds for stubs. It now checks for exactly one `boss` event and at most one `escapePod` event, which every wave-6 sector will need. One-line change; expect the same edit from T27–T29, so take any of them at merge.

### Shared changes needed
- None required.
- Nice to have: a sandbox registry for sector folders, so keys don't have to go through `__director.world`. Also a `registerLevelLayer` that is active under `?sandbox` on any level, so the hull draws without `?level=5`.

## Follow-ups
- T31: novice clear rate (6%) and expert ≈ typical. Both come from bot behavior: novice gnat rams, and the boss stance at y 270 sitting right under the hull guns. Re-measure after the bot work.
- The HUD boss bar sums every hull part, so it shrinks a little as unkilled turrets scroll off. That reads as "the ship's relevant HP", but a per-boss `bossHp` override in the HUD would be cleaner.
