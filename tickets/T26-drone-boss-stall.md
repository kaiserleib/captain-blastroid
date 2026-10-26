# T26 — Orbit Drones: fix the boss stall
Status: done
Wave: 5 · Depends on: T00–T20 · Blocks: T31

## Goal
Fix the T18/T20 follow-up: a drone-heavy loadout (e.g. Blaster 1–3 + Drones 3–5) can't finish a boss, because drones only deal contact damage. That's about 2% timeouts for the typical bot and 8% for the expert.

## Owns
`src/content/weapons.ts` (drone entries), `src/game/weapons/**`.

## Read first
`docs/design.md` → Weapons; `tickets/T18-integration-balance.md` and `T20-test-bots-e2e.md` follow-ups; `src/game/weapons/drones.ts`; `tests/sim/balance.report.ts` (timed-out seeds such as `bal46`).

## Requirements
1. From **drone level 3**, each drone fires a **spark**: a 1-damage shot at the nearest *targetable* enemy within 150 px (use `isTargetable`/`targetFilterFor`), or straight up if there is none.
   - Rates: every 0.9 s at L3, 0.7 s at L4, 0.5 s at L5. Speed 220 px/s, sprite 4×4 using a cool palette (white core, cyan edge).
   - Drones fire staggered, so the sparks aren't in lockstep.
   - Tunables go in `content/weapons.ts`.
2. Shots go through the normal player-shot pool and damage pipeline. Seeker homing logic is not needed; the aim is fixed at fire time.
3. Update the weapon description text if the UI shows one.
4. **Tests:**
   - A unit test for spark targeting and its rate.
   - A sim test: a forced Blaster 2 + Drones 5 loadout under the god bot (`tests/sim`) defeats the Rock Hauler within 150 s for 3 seeds. Mark it `SIM=1` if it's slow.
5. Re-run `npm run balance` with `SKILLS=typical,expert` and record the timeout rate before and after in Notes. The target is 0 drone-stall timeouts.

## Acceptance criteria
- [x] No drone-stall timeouts in a 50-seed typical and expert balance run. (Two expert timeouts remain; neither is a drone stall. See Notes.)
- [x] Drones are not now the best weapon. Record the weapon share at the boss and the clear time before and after.
- [x] build / test / lint / test:sim pass.

## Contract changes
None to the core contracts (`sim/types.ts`, `sim/world.ts`, `engine/events.ts`, `gfx/renderer.ts`). Additive changes in owned files:
- `content/weapons.ts`: `WeaponLevel.sparkCooldown` (0 = no sparks; set on drones L3–L5), plus new exports `DRONE_SPARK` (the spark's `WeaponLevel`) and `DRONE_SPARK_RANGE` (150).
- `game/weapons/state.ts`: `WeaponsState.sparkT` and `sparkNext`.
- `game/weapons/index.ts`: also exports `sparkAngle`, and `WEAPON_SPRITE_IDS` gains `pbullet_spark`.

## Notes
**Implementation**
- From L3, `updateDrones` runs one shared spark timer. Each beat, the next drone in round-robin order fires, so each drone fires every `sparkCooldown` (0.9 / 0.7 / 0.5 s) and the orbit as a whole fires every `sparkCooldown / count`. There is never more than one spark per tick.
- Aim is fixed at fire time: `SpatialHash.nearest` within 150 px of the drone, filtered with `targetFilterFor`, so boss armor and shielded parts are skipped. With no target the spark goes straight up. Sparks are spawned with `fireShot` (normal player-shot pool, `weaponId: 'orbitDrones'`, damage × `damageMul`), and there is no homing.
- Judgement call: the spark timer is scaled by `stats.fireRateMul`, like every other weapon's cooldown. Contact damage is still not scaled.
- Sprite `pbullet_spark` is 4×4: a white core with a cyan edge and a 2-frame shimmer. It appears automatically in the gallery's Sprites section. No sfx, because a spark every 0.1 s at L5 would be noise, and audio isn't in my Owns.
- No in-game UI shows weapon descriptions (only upgrades have them), so there was no text to change. See "Shared changes needed".

**Tests**
- `src/game/weapons/weapons.test.ts`: no sparks at L2; rate and stagger at L3/L4/L5 (count over 10 s, even gaps, at most 1 per tick, damage 1, speed 220); targeting (out of range and boss armor give straight up, and an in-range enemy is aimed at); sparks damage an enemy through the collision pipeline.
- `tests/sim/drones.test.ts`: the god bot with a forced Blaster 2 + Drones 5 loadout (re-applied every tick, so pickups can't change it) beats the Rock Hauler in under 150 s on 3 seeds. It runs in about 1.6 s, so it's in the default test run as well as SIM. With sparks off, all 3 seeds stall (boss alive after 300 s).

**Balance: `SKILLS=typical,expert npm run balance`, 50 seeds each**

| | typical before | typical after | expert before | expert after |
|---|---|---|---|---|
| clear | 90% | 92% | 82% | 86% |
| timeout | 2% (bal46: B3 S3 D3) | **0%** | 8% (bal4 D2, bal13 D2, bal26 D2, bal32 D1) | 4% (bal4 D2, bal32 D1) |
| boss time on clears, median (p75 / max) | 55 (70 / 123) | 53 (70 / 125) | 50 (73 / 106) | 56 (74 / 127) |
| drones held at boss | 48% L2.5 | 48% L2.5 | 54% L2.2 | 54% L2.2 |

The weapon share at the boss doesn't change, because it depends on pickups, not on performance. The expert median boss time rose only because three formerly timed-out runs now count as slow clears.

**The two remaining expert timeouts are not drone stalls**
- `bal32` (Blaster 2, Spread 3, Drones 1) still times out with the drones removed every tick (it ends Blaster 4 / Spread 3). The expert dodger spends about 100 s of the fight in phase 1 (turrets) before the core opens.
- `bal4` (Blaster 3, Spread 2, Drones 2) has drones below spark level, so the spec doesn't cover it. I tried L2 sparks at 1.2 s: bal4 then clears, but only at 131 s, and bal32 is unchanged. I reverted that and kept the spec's L3+.

**Is it now the best weapon? (forced Blaster 2 + X, god bot, 6 seeds, boss seconds)**

| X | boss time |
|---|---|
| Blaster 2 only | never (stalls) |
| Drones 3 | 201–213 |
| Spread 5 | 124–136 |
| **Drones 5** | **101–107** (before T26: never) |
| Lance 5 | 89–95 |
| Seeker 5 | 31–32 |

Drones 5 now finishes the boss, but it is still slower than Lance and much slower than Seeker. It does beat Spread 5 against a single boss target, because Spread is a crowd weapon.

## Shared changes needed
- `docs/design.md` → Weapons, Orbit Drones row: add "from L3 each drone fires a 1-dmg spark at the nearest target within 150 px (0.9 / 0.7 / 0.5 s)".

## Follow-ups
- T31: in expert runs the boss's phase 1 (turrets) can run 80–100 s with mid-level Blaster/Spread loadouts (`bal32`, `bal4`). Look at turret HP or bot aim before blaming weapons.
- A plain Blaster L2 under the god bot never finishes the boss. This is the same class of stall but outside T26 (it isn't about drones). T31 may want a minimum-DPS floor check.
