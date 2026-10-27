# T38 — Level 6: Corona Drift + Heliostat
Status: done
Wave: 9 · Depends on: T32, T33, T35, T36, T37 · Blocks: T43

## Goal
Replace the `corona` stub with the full sector from the design: cover from solar flares in shadows that the player's own guns wear away. Everything is specified in `docs/design.md` → **Level 6: "Corona Drift"**, tuned to the sector's place in the Act II difficulty curve.

## Owns
- `src/content/levels/corona/**`: the `LevelDef` (timeline, asteroid field, all tunables) plus the enemy and boss tables
- `src/game/levels/corona/**`: custom behaviors, the boss controller and its draw, sprites, level scripts and systems, sandbox keys, tests
- `tests/sim/**`: only new files named `corona.*.test.ts`

Nothing else. Everything plugs in through the T21 registries, the wave-8 APIs (T33 flares and shade, T35 weapons) and `registerTimelineAction`. If you need a shared change, describe it under "Shared changes needed" in Notes with a minimal patch and work around it locally.

## Read first
`CLAUDE.md`, `docs/design.md` → "Campaign: Act II" (especially **Level 6: "Corona Drift"** and "Act II difficulty curve"), `docs/art-direction.md`, `tickets/WAVE9-NOTES.md` (the wave-8 APIs as merged), and the Notes of T32, T33, T35, T36 and T37. Use T27–T30 as the reference for quality and for how a sector folder is laid out.

## Requirements
- **Enemies:** **Sunskimmer** (flare-immune, faster during a burn), **Shade** (finds and holds a shadow strip with `inShade` and the caster list), **Lens Drone** (during a burn: a 0.6 s telegraph line, then a 0.4 s bullet-line beam). Numbers from the design.
- **Flares:** the practice flare at 12 s, then cadences per the timeline. Before every flare, a placed large-rock band or a shade slab makes cover exist (the fizzle rule is the backstop, not the plan). Log how many flares fizzle per run in the balance notes; aim for ≈ 0 with typical play.
- **Pod (Ines):** 2 HP, drifting beside a shade slab. Flares and Shades can hurt it.
- **Boss: Heliostat** (`co_heliostat`, about 120×56): mirror arms with sweeping beams, slab drops before each flare, the hull registered as a shade caster, the Solar Furnace phase with the 6-arm spiral and 7 s flares.
- **Timeline:** follow the design table, including the Arc Coil field-test supply run, the carrier, breathers with shields, the magnet and the coronal-mass-ejection finale. Keep the design's `LevelDef` numbers unless balance requires otherwise; log any change.
- **Art:** every new enemy and boss part has sprites at the art-direction sizes: 15-bit palette, outline, 2-frame animation where it fits, hit flash from the sprite cache. They appear in `tools/gallery.html`. Enemy bullets use only the standard enemy-bullet sprites.
- **Sandbox:** keys from WAVE9-NOTES to spawn each new enemy and the boss under `?sandbox`.
- **Fairness:** the T11 rules (no shots in the first 0.5 s alive; aimed shots only from ≥ 24 px above the ship) apply to every new attacker, and every telegraphed attack is telegraphed for ≥ 0.5 s.
- **Tests:** unit tests for each custom behavior's state machine and the boss phase transitions. The harness's god playthrough, determinism and pool safety must pass for `corona`. Add a `tests/sim/corona.sector.test.ts` god run that asserts the sector's signature beats (listed above) actually happen.

## Balance targets
With `SAVE=act1`: typical-bot clear ≈ **75%**, novice ≥ 15%, boss time 50–90 s for the typical bot, salvage on a clear 560–750.
Measure with `LEVEL=corona SAVE=act1 RUNS=50 SKILLS=novice,typical,expert npm run balance` and record a balance table in Notes, like T27's. If a number is off only because a bot is blind to something, show the evidence (hits by cause) and tune for a human.

## Acceptance criteria
- [x] `?level=6&save=act1` plays the full timeline to the boss's defeat, results, and the right schematic, pod, and the Arc Coil unlock. (`tests/sim/corona.sector.test.ts` plays it end to end on the act1 save: Arc at the boss, the pod toast, every boss phase, Shrike schematic. The unlock is T35's `fieldTestWeapon` banking. In the browser I checked the opening, practice flare, storm and the full boss under `?sandbox`.)
- [x] God playthrough (every seed), determinism and pool safety pass for `corona`.
- [x] Balance targets met or the gap explained. (Clear rates and boss time are met. Salvage is short; see the notes.)
- [x] Browser check on your own port with `?mute`: each new enemy, each hazard beat and each boss phase is described in Notes, with no console errors.
- [x] build / test / lint / test:sim / e2e pass.

## Contract changes
None.

## Notes

### Layout
- `src/content/levels/corona/index.ts` holds `ROSTER`, `BAND`, `POD_SLAB`, `NEAR_SLAB`, `HELIOSTAT`/`HELIOSTAT_PARTS`, `WARN` and `LEVEL`.
- `src/game/levels/corona/`:
  - `behaviors.ts`: skimmer, shade and lens.
  - `heliostat.ts`: the boss controller.
  - `draw.ts`: roster draws, the boss and its telegraphs.
  - `scripts.ts`: `corona.band`, `corona.slab` and `corona.podSlab`.
  - `sandbox.ts`, `corona.sprites.ts`.
  - `paint.ts`: a copy of eventHorizon's painter plus a `rotations` option. Sector folders can't import each other.
  - Tests: `behaviors.test.ts` and `heliostat.test.ts`, plus `tests/sim/corona.sector.test.ts`.

### Enemies
- **Sunskimmer** (`co_sunskimmer`, 3 HP, 16×16 at 16 rotations, 4 frames):
  - Comes in pairs from a side (`spawn from: left|right`, repeated 0.32 s apart) on a 26° diagonal at 120 px/s.
  - Moves ×1.5 while `isFlareBurning`, and its sail frames blaze. `setFlareImmune` is set for it.
  - Fires one aimed shot when it crosses mid-screen (`canFire`).
- **Shade** (`co_shade`, 6 HP, smart, 20×18):
  - Descends, then each tick takes `nearestShadeSpot` within 110 px. It only takes spots at y ≤ 200, so it never sits on the player's row.
  - It rides the strip down with the scroll and leaves after 12 s.
  - Its aimed pair every 1.8 s is the def's `fire`, so the T11 fairness rules apply.
- **Lens Drone** (`co_lens`, 9 HP, smart, 22×22):
  - Holds at y 48 and drifts toward the ship.
  - On each damaging burn (`flarePhase === 'burn'`, not practice) it locks its aim and shows a 0.6 s telegraph line (red → amber → white dots).
  - Then a 0.4 s beam: one shot every 0.03 s along the locked line, at 170 px/s (×1.22).
  - It fires once per flare (it keys on `flareState.count`) and leaves after 26 s.

### Boss: Heliostat (`co_heliostat`, about 120×56)
- **Parts:** a 64×40 hull sprite (truss, solar panels, furnace ring) with arms drawn as two 2 px segments and a gold elbow. Mirrors are 18×18 hexes in 4 frames (idle glint, charge, beam). The core is 24×24: shuttered, then exposed, then furnace.
- **Shade:** the core entity is the shade caster (`registerShadeCaster`, half-width 26, strip from the keel).
- **Phase 1:**
  - The mirror pairs (outer 0/3, inner 1/2) alternate every 6 s.
  - Each beam shows a 0.6 s telegraph (start line bright, end line dim, a sweep arc), then sweeps ±30° around a 25° slant over 3 s, one shot every 0.2 s at 100 px/s.
  - A flare every 11 s (warn 1.6). 2 s before each warning a slab drops from the keel to y 214–246, 34–76 px beside the ship, then drifts at 12 px/s.
- **Solar Furnace** (3 mirrors down):
  - Toast and shake. The core becomes targetable.
  - The 6-arm spiral: a 6-way ring every 0.2 s for 8 rings, then a 2 s pause, turning 11° per ring.
  - Flares every 7 s, two slabs (one each side) before each.
  - The last mirror telegraphs as the warning ends and sweeps a beam through the burn, centered on the ship's bearing.
- **Defeat:** 36 glints fly from the mirror positions. A flare still warning or burning is faded (see Shared changes). Then `bossDefeated`, 240 salvage and the Shrike.
- Each mirror sprays **15 salvage** when it breaks, like the Leviathan's guns.

### Decisions and changes from design.md (balance)
- **The boss holds still while a flare warns or burns.** Its strafe clock pauses. Before this, the hull's strip slid sideways and bobbed under a ship hiding in it, and the typical bot took about 2 flare hits per fight.
- **Beams slant outward**, not crossing under the hull. Crossing beams fenced the middle: 44 phase-1 shot hits in 16 fights. Outward: 15 hits over a longer fight. Beam gap is 0.2 s (it started at 0.11).
- **HP:** mirrors 60 → 45 and core 280 → 200. With weak act1 loadouts (level sum ~7 at the boss), the typical boss time was about 130 s.
- **Boss slabs land beside the ship, not over it.** A slab over the ship's column ate its fire for the whole fight.
- **Flare warning is 1.6 s** (`WARN`) instead of 1.2 for every non-intro flare. The first real flare (26 s) keeps the 2.0 s intro warning.
- **Cover for each flare:**
  - Every timeline flare gets a slab that enters near the ship (`corona.slab`, ±50 px of the player's x) and sits over the ship's row mid-burn.
  - The design's "large-rock band" is used for the 26 s and 40 s flares (`corona.band`: 3 large rocks with 22 HP each, `BAND.hp`, at 38 px/s).
  - With bands before every flare, about 45% of band flares hit the bot, against 0–10% for slab flares. The bot sits under a narrow 24 px strip, shoots its own cover away, and then dodges the rock as it comes down. The rock bands also added about 1.5 rock hits per run. So bands stay as the teaching beat, and slabs are the cover that lasts, as the design says.
  - CME flares get two slabs: one near the ship and one 90 px toward the middle.
- **Pod at 100 s, not ~95.** It enters right after the 98 s burn, so the 108 s flare takes 1 HP and the 115 s flare takes the last. Its slab drifts 30 px to the middle side at the pod's 12 px/s, which leaves the pod in the light.
- **Timing around burns:** formations and carriers are timed to be off screen before each burn. A flare kill pays no salvage and breaks the formation's capsule. The CME gnat swarms are the exception (the design's "gnat swarms burn up").
- **Roster salvage:** Sunskimmer 3, Shade 6, Lens 10 (design: 2/4/6), for the salvage target. The field is thinner than Act I, because basalt is tough and splits.
- **Added enemies:** gunboats and interceptors over the design table, which raised the wave shot peak. The waves peak is 30 against the design's 55. I chose not to push it higher, since the flares are the sector's pressure.

### Balance table (`LEVEL=corona SAVE=act1 RUNS=50 SKILLS=novice,typical,expert npm run balance`)
| skill | reach boss | clear | boss time (clears, median) | salvage on clear (median, p25–p75) | hits/run by cause |
|---|---|---|---|---|---|
| novice | 36% | **20%** (target ≥ 15) | 50 s | 483 (435–520) | shot 3.7, rock 2.9, flare 1.9, boss shot 0.8 |
| typical | 82% | **72%** (target ~75) | **56 s** (target 50–90) | 472 (442–519) | flare 3.0, shot 2.9, rock 1.6, boss shot 1.2 |
| expert | 94% | 92% | 38 s | 511 (481–551) | flare 2.9, shot 2.9, boss shot 0.9, rock 0.5 |

- **Peak enemy shots:** 30 in the waves, 58 at the boss. Typical capsules: 5.7 per run. Typical pod rescue: 14% (the dodger bots don't fly up for pods).
- **Flare fizzles:** 0 in every run I logged (12–20 seeds per probe, typical). The god sector test asserts ≤ 1.
- **Per-flare typical hit rate** (20 seeds):
  - 26 s band and slab: 35%. 40 s: 50%.
  - Slab flares 54–124 s: 0–10%. 133 and 142 s (larges weighted): 25–35%.
  - CME 148/160/172: 50/17/11% (89% before the second slab).
  - Boss flares: about 0% once the hull holds still.
- **Salvage gap:** typical clears bank about 470 against the 560–750 target. In the bot's runs:
  - Flares kill about 25 gnats, 1.3 carriers and some interceptors and swoopers per run. Hazard kills pay nothing and break formations.
  - Armada makes about 350 salvage by 180 s from escorts and frigates. Corona makes about 195.
  - Closing the gap needs either more salvage-rich enemies (which means more shots) or flare kills that pay salvage (see Shared changes). I left this for T43.

### Browser check (port 5138, `?mute`, no console errors)
- `?level=6&save=act1&god&t=10`: the practice flare whitens the screen, outlines the strips and leaves the rocks crisp.
- `?sandbox&level=6`:
  - Alt+Q: the Sunskimmer pair, gold sails, rotated to the heading.
  - Alt+E: the Shade, soot-violet with a cyan eye.
  - Alt+Y: the Lens Drone.
  - Alt+Shift+Q: the Heliostat descends. The outer pair's outward beam lines show, and a slab drops beside the ship.
  - The flare burn shows the hull strip and the slab strips.
  - Alt+Shift+E: the furnace. Wrecked frames, salvage spray, the exposed white-gold core, 6-arm spiral rings and two slabs.
  - Alt+Shift+Y and kill: the death chain and the schematic.
- `t=76`: the storm with the slab lane and a Lens Drone.
- New sprites appear in the gallery's Sprites section automatically (`*.sprites.ts`).
- Act I hashes are unchanged: 17a78586, 66a3e907, 432d4c06, 1c9e54f6, f3426d8c, 0b41ee42, 8b2a6879.

### Shared changes needed
1. **ionShoals sandbox ignores Alt** (`src/game/levels/ionShoals/sandbox.ts`, `installIonSandbox`). Alt+Q/E/Y also spawned Ion Shoals enemies and the Shepherd. Local workaround: corona's listener runs in the capture phase and calls `stopImmediatePropagation` for Alt+Q/E/Y. Patch:
   ```ts
   if (e.repeat || e.altKey || (e.code !== 'KeyQ' && e.code !== 'KeyE' && e.code !== 'KeyY')) return;
   ```
2. **`cancelFlare(w)` in `game/obstacles/hazards2/flare.ts`.** The Heliostat fades a live flare on defeat by writing `flareState(w)` directly (`phase = 'cool'; t = 0`). Patch:
   ```ts
   export function cancelFlare(w: World): void {
     const f = peekHz(w)?.flare;
     if (f && (f.phase === 'warn' || f.phase === 'burn')) { f.phase = 'cool'; f.t = 0; }
   }
   ```
3. **Optional, for T43 (salvage):** let flare kills pay salvage but not capsules. In `game/pickups/drops.ts` `attachDrops`, spray `def.salvage` when `!p.byPlayer` and the cause is a flare. That needs a `source` on `enemyKilled`, so it is a contract change. Worth about +25–40 per Corona run.

### Follow-ups
- T43: the salvage gap above. Also the waves shot peak (30) is under the design's 55.
- The rock band count (3) and HP (22) are untested with humans. A human may enjoy band cover more than the bot does.
- A human should try the boss beams: outward sweeps with the hull's shadow as the safe middle.
