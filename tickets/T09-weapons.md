# T09 — Weapons: five auto-fire weapons with five levels each
Status: todo
Wave: 2 · Depends on: T02, T03 · Blocks: T12 (pickup resolution calls into it), T16, T18

## Goal
The Vampire Survivors heart of the game: weapons that fire automatically, stack in slots, and level up visibly and audibly. A maxed loadout should be a joyful wall of SNES-colored firepower, and still readable.

## Owns
`src/game/weapons/**` (weaponSystem.ts, weapons/blaster.ts, spread.ts, lance.ts, seeker.ts, drones.ts, resolvePickup.ts, sprites.ts, index.ts, tests), `src/content/weapons.ts`. The `weapons` System and the drones DrawLayer (z 58) registrations.

## Read first
`docs/design.md` → Weapons (table + pickup resolution). T03 spawn helpers and `registerShotBlocker`.

## Requirements
1. **content/weapons.ts:** per weapon, a `levels[5]` array of plain numbers (cooldown, damage, projectile count, spread angle, speed, pierce, homing, drone count/radius). Name, letter (B/S/L/M/D), icon sprite id, and color. **All numbers live here.**
2. **weaponSystem:** for each `WeaponInstance`, cooldown -= dt × fireRateMul. At ≤ 0, call the weapon's `fire(world, player, inst, def)` and reset the cooldown. Damage × `stats.damageMul`. Don't fire while the player is dead.
3. **Weapons:**
   - **Blaster:** straight shots from the nose. Twin = ±4 px offsets, triple = adds a center shot.
   - **Spread Cannon:** fan of N at angles. Short ttl (reaches ~70% screen height) so it's a close/mid-range weapon.
   - **Pulse Lance:** long piercing bolt with a 2-frame shimmer. Pierce from the level table.
   - **Seeker Pods:** missiles launch sideways from the wings, then home (`homing` turn rate). Target via `spatialHash.nearest`, preferring the closest enemy ahead of the ship. Short smoke trail (emit FX event or draw a 2-px trail).
   - **Orbit Drones:** not projectiles. `inst.state` holds the orbit angle. Drones are drawn and collide via their own small check against enemies (contact damage tick 0.25 s per enemy) and via `registerShotBlocker` to delete enemy shots they touch (emit `sfx drone_hit`).
4. **resolvePickup.ts:** `applyWeaponPickup(world, weaponId)` and `applyUpgradeCore(world)` per design.md rules (add, level, or convert to salvage). Emit `weaponAdded`, `weaponLeveled` (with `sfx weapon_up` and a `toast` like `SPREAD LV3`), or salvage/score + toast. T12 calls these.
5. **Visual identity:** each weapon's shots have a distinct shape and color in the player-bullet palette (cool tones, never magenta). Level 5 visibly upgrades the sprite (bigger or brighter).
6. **Sandbox controls** (`?sandbox`): keys `F1–F5` grant/level each weapon, and `F6` maxes everything.

## Acceptance criteria
- [ ] Starting Blaster L1 feels weak but pops Level 1 asteroids in one shot.
- [ ] All five weapons at L5 together keep 60 fps in the sandbox with 40 enemies, and shot count stays within pool capacity (400). If not, tune cooldowns.
- [ ] Drones visibly eat enemy bullets.
- [ ] Unit tests: cooldown + fireRateMul, pickup resolution table (all branches), seeker retargeting when its target dies, pierce counts per level.

## Out of scope
Pickup entities and drops (T12), weapon evolutions (post-MVP).
