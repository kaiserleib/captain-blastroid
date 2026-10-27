# T35 — Weapons: Arc Coil, Ricochet, Flak, the unlock pool and field tests
Status: todo
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
- [ ] All three weapons work at L1–L5 in the sandbox, with crisp effects and no per-shot allocation.
- [ ] Act I is unchanged with the default `weaponsUnlocked`: event-log hashes identical.
- [ ] Act I with all eight weapons unlocked: typical clear rate within noise of T31 for every Act I sector (report it; the dilution of the drop pool is the risk).
- [ ] build / test / lint / test:sim pass.

## Contract changes
