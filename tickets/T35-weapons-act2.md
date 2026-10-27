# T35 — Weapons: Arc Coil, Ricochet, Flak, the unlock pool and field tests
Status: done
Wave: 8 · Depends on: T31 + the wave-8 contracts commit · Blocks: T38–T43

## Goal
Three new auto-fire weapons with five levels each, plus the meta that gates them: the `weaponsUnlocked` drop pool, field-test capsules, and unlocking on first clear.

## Owns
- `src/game/weapons/**` and `src/content/weapons.ts`
- Weapon and capsule sprites (letters A / R / F)
- The capsule-pool selection in `src/content/dropTables.ts` and `src/game/pickups/**` (only where the weapon is chosen)
- The weapon unlock in `src/meta/progression.ts` → `bankRun` (inside your own helper)
- `tools/sections/` (the weapons section)

## Read first
`docs/design.md` → **"New weapons"** and "Act II structure" (weapon unlocks), the original Weapons section, `tickets/WAVE8-NOTES.md`, and T09's Notes.

## Requirements
1. **Arc Coil:**
   - Nearest enemy within range, then chains (each link to the nearest enemy not yet hit, within 50 px). Needs no line of sight.
   - Uses a preallocated chain buffer.
   - Draw: a jagged 1 px white-and-cyan polyline, re-jittered every 2 frames through `world.rng`-free render jitter (a hash of tick and segment, since render must not touch sim RNG).
2. **Ricochet:**
   - Discs alternate ±20°. They bounce off the side edges, terrain (`raycastSolid` from T34, through the contract hook) and shade slabs and other indestructible bodies, up to the level's bounce count, and pierce 1.
   - They leave at the top.
   - Before T34 merges, bouncing off the edges alone must work.
3. **Flak:**
   - The shell bursts at 0.6 s or on contact into N fragments (evenly spaced, with a random start angle from `world.rng`).
   - Erases enemy bullets within the erase radius, using a pooled query.
4. **Levels:** all three follow the design's leveling table. Toasts as usual ("ARC COIL LV3").
5. **Unlock pool:**
   - Capsule selection (formation clears, carriers, rare drops, the owned-weapon weighting) draws only from `save.weaponsUnlocked` plus the current level's `fieldTestWeapon`.
   - The `forceCapsule` and `guaranteeWeapon` fallbacks may name a locked weapon only if it's the field-test weapon.
   - A ship's starting weapons ignore the lock.
6. **Unlock on first clear:** `bankRun` adds the level's `fieldTestWeapon` to `weaponsUnlocked` on a victory and sets `RunResult.unlockedWeapon` (T32 shows it).
7. **Six slots:** nothing in weapons may assume ≤ 5 slots.
8. **Balance:** first-pass DPS parity with Act I weapons at each level. Use `tests/sim` with a dummy target field and record a table (single-target, crowd, bullet erase) in Notes.
9. **Sandbox and gallery:**
   - Keys to grant and level each new weapon. Extend the existing weapon-grant key table if it is one; otherwise use `;`, `'` and `/`.
   - The gallery shows all levels firing.
10. **Tests:** chain targeting and the no-double-hit rule, bounce counting and edge reflection, burst timing and the erase radius, pool filtering (a locked weapon never drops, the field-test weapon does), and unlock-on-clear.

## Acceptance criteria
- [x] All three weapons work at L1–L5 in the sandbox, with crisp effects and no per-shot allocation.
- [x] Act I is unchanged with the default `weaponsUnlocked`: event-log hashes identical.
- [x] Act I with all eight weapons unlocked: typical clear rate within noise of T31 for every Act I sector (report it; the dilution of the drop pool is the risk).
- [x] build / test / lint / test:sim pass.

## Contract changes
None to the four contract files. Additive changes elsewhere:
- `WeaponLevel` (`content/weapons.ts`) gains `chain`, `range`, `bounces`, `fragments`, `fragDamage` and `eraseR`. They default to 0, so existing levels are unchanged.
- `WEAPON_ORDER` now lists all eight weapons (it sets the display order, the capsule-letter order and `CAPSULE_WEAPON_IDS`). `DEFAULT_UNLOCKED_WEAPONS` is now an explicit list of the five Act I weapons.
- `FireFn` may return `false`, which means "hold". Arc uses it when nothing is in range: it plays no sfx and its cooldown stays at 0.

## Notes (T35)
- **API:**
  - `content/weapons.ts`: real `arc` / `ricochet` / `flak` defs (icons `icon_arc`, `icon_ricochet`, `icon_flak`; capsules `capsule_a`, `capsule_r`, `capsule_f`), plus `ARC_CHAIN_RANGE` (50), `ARC_SHOW` and `FLAK_FRAGMENT`.
  - `content/dropTables.ts`: `capsuleWeaponPool(ids, unlocked, fieldTest?)`.
  - `game/pickups`: `capsulePool(w)` caches each world's pool (`getSave().weaponsUnlocked` plus `LEVELS[levelId].fieldTestWeapon`). `pickCapsuleWeapon(rng, weapons, pool = DEFAULT_CAPSULE_POOL)` and `ownedBias(poolSize)` live there too.
  - `meta`: `unlockFieldTestWeapon(save, result, levels = LEVELS)`. `bankRun` calls it.
- **Arc Coil** (`weapons/arc.ts`):
  - Instant hit. `traceArc` picks the nearest targetable enemy (`isTargetable`, so boss armor and shielded cores are skipped) within `range` of the nose, then up to `chain` hops of at most 50 px each, never revisiting an enemy.
  - Ids go into a preallocated `Int32Array`, and damage is dealt only after the whole chain is traced.
  - The polyline is drawn in `playerShotsLayer` for about 8 ticks. Its jitter is an integer hash of `(tick >> 1, segment, kink)`, so the render never touches the sim RNG.
- **Ricochet** (`weapons/ricochet.ts`):
  - Discs are ordinary player shots. **Remaining bounces are stored in `Bullet.targetId`**, which only homing reads, and discs never home.
  - `updateRicochets` runs in the weapon system before the bullets system moves anything. It reflects a disc off the side edges, off `raycastSolid` hits (the hit point is pushed 0.5 px out along the normal), and off indestructible asteroids (`maxHp <= 0`, normal taken from the rock's center).
  - A disc with no bounces left flies on and leaves the screen, or is absorbed as before.
  - Pierce 1 comes from the existing collision rules, and `hitIds` stops a disc that bounces back from hitting the same enemy again.
  - Shade slabs bounce discs only if T33/T34 route them through the solid query, as WAVE8 plans.
- **Flak** (`weapons/flak.ts`):
  - Shells are not player shots. They live in up to 8 typed-array slots in `WeaponsState`.
  - A shell bursts when its 0.6 s fuse runs out, or when it touches an enemy, asteroid, anomaly or `isSolidAt`.
  - The burst spawns N fragments, evenly spaced from a start angle drawn from `world.rng`, then erases enemy shots within `eraseR` (a linear scan of the enemy-shot pool, no allocation) and records a burst ring that is drawn for 2 ticks.
  - **Decision:** a contact burst deals the shell's `damage` (2 at L1–L3, 3 from L4) to the body it hit, and the fragments skip that body. Without this, all 6–8 fragments hit a point-blank target and Flak became the best single-target weapon.
- **Six slots:** nothing in weapons assumes a slot count. A test fires six weapons together, and T36's Shrike, Ferret and Wraith starts are checked in a real run (`tests/sim/act2Weapons.test.ts`).
- **Unlock pool:**
  - Every capsule (formation clear, carrier, rare drop, the owned weighting, sandbox `0`) draws from `capsulePool(w)`.
  - `spawnDrop(kind 'weapon')` re-picks a named payload that isn't in the pool, which covers `guaranteeWeapon` and the forced-capsule fallback spawn.
  - A content test checks that every level's `forceCapsule` and `guaranteeWeapon` names a default-unlocked weapon or that level's `fieldTestWeapon`.
- **Unlock on clear:** a run with `victory` on a level that has a `fieldTestWeapon` not yet unlocked appends it to `weaponsUnlocked` and sets `result.unlockedWeapon`. This mutates the `RunResult` passed in, as the contract comment describes. Defeats and abandons unlock nothing.
- **Sandbox:** F7 / F8 / F9 grant or level Arc, Ricochet and Flak. F1–F5 and F6 (max all, now all eight) are unchanged. Gallery: a new "Weapons: Act II" section shows all 15 weapon/level combos firing live.
- **Balance decision:** Ricochet hits for **2** instead of design.md's 1 (L4: 3). At 1 dmg, L1 dealt 0.45 dps single-target against the Blaster's 2.5. Other numbers follow design.md.
- **Balance table** (`SIM=1 npx vitest run tests/sim/act2Weapons.test.ts --silent=false`):
  - Static ship, dummies with effectively infinite HP.
  - single = the best of six placements (0/30/60 px off-axis, 80/140 px ahead).
  - crowd = a 5×3 block 60–108 px ahead.
  - erase = bullets per second removed, out of 6/s falling on the ship.

  | weapon | single L1–L5 | crowd L1–L5 | erase/s L1–L5 |
  |---|---|---|---|
  | blaster | 2.5 3.3 6.6 15.8 34.8 | 2.5 3.3 6.6 16.0 35.1 | 0 |
  | spread | 1.5 1.5 1.5 1.5 2.5 | 4.5 4.5 4.5 7.5 17.5 | 0 |
  | lance | 2.4 2.4 2.4 2.4 5.5 | 7.2 7.2 7.2 7.2 16.5 | 0 |
  | seeker | 2.0 4.0 5.9 6.0 16.8 | 2.0 4.0 6.0 6.0 16.8 | 0 |
  | orbitDrones | 0 0 3.3 4.3 9.8 | 0 0 3.3 4.3 9.8 | 0.7 1.3 2.0 1.8 3.5 |
  | **arc** | 1.7 1.7 2.3 2.3 3.5 | 3.4 5.1 6.9 9.2 13.8 | 0 |
  | **ricochet** | 0.9 0.9 1.8 2.7 2.7 | 3.6 3.6 7.2 10.8 16.2 | 0 |
  | **flak** | 1.4 1.4 1.8 2.7 4.5 | 3.4 3.8 4.8 8.7 28.1 | 1.2 1.2 1.4 2.2 1.9 |

  - Crowd damage sits inside the Act I spread at every level.
  - Single-target damage is at the low end for L1–L3 and well under the Act I weapons at L4–L5. That follows from design.md's numbers: these are crowd and utility weapons.
- **Act I hashes:** identical with default saves, before and after merging T36/T37 (17a78586, 66a3e907, 432d4c06, 1c9e54f6, f3426d8c, 0b41ee42, 8b2a6879).
- **Act I with all eight unlocked:**
  - Method: typical dodger, 100 seeds per sector, with `getSave` mocked to unlock everything.
  - Typical clear % for L1–L5:
    - Default save: 94 / 94 / 78 / 84 / 78 (current main, so T31 plus the boss stall breaker).
    - All unlocked, before the bias fix: 89 / 90 / 77 / 69 / 71. Loadouts reached the boss about 0.3 levels lower on average.
  - **Fix:** `ownedBias(poolSize)` raises the owned-weapon bias for pools above five, so the uniform share is (1 − 0.5)·5/n. That makes 0.6875 with eight weapons. A five-weapon pool keeps exactly 0.5, so Act I rolls are bit-identical.
  - All unlocked, after the fix: 94 / 91 / 82 / 71 / 80. L4 is the outlier, so I checked it with a second 100-seed set: default 57%, all unlocked 63%. Pooled over 200 seeds that's 70.5% vs 67%, inside L4's large seed noise. Every sector is within noise.

## Shared changes needed
- None required. Optional: `director.applyCapsuleFixes` writes `k.payload = fix.weaponId` straight onto an existing capsule, which skips `spawnDrop`'s pool guard. Authored levels are covered by the content test. If the director owner wants a runtime guard too, skip the overwrite when `!capsulePool(w).includes(fix.weaponId)`.
- design.md: update the Ricochet row (2 dmg, L4 +1 → 3) and mention Flak's contact impact (2, 3 from L4).
- `content/pickups.ts`: the comment on `CAPSULE_WEAPON_IDS` still says "B/S/L/M/D". It is now B/S/L/M/D/A/R/F.

## Follow-ups
- Sfx: the new weapons reuse `shot_lance` (Arc), `shot_spread` (Ricochet) and `shot_seeker` (Flak), and the flak burst plays none. Dedicated `shot_arc`, `shot_disc` and `flak_burst` sounds belong to the audio owner.
- Bots: `godBot` / `dodgerBot` hold their distance. In a Kessler run, nothing came within Arc's 90 px of the Shrike's nose for the first 40 s. T43's Shrike balance passes will undervalue Arc unless the bot closes in.
- Under `?sandbox`, F6 grants all eight weapons. T32's six-slot HUD strip may overflow, which is harmless in the sandbox.
