# T12 — Pickups, drop tables, magnet, repulsor, escape pods
Status: done (in-game gnat-formation and rocks-into-enemies checks need T10/T11 merged)
Wave: 2 · Depends on: T02, T03 (calls T09's `applyWeaponPickup`/`applyUpgradeCore`; stub with a TODO if T09 isn't merged) · Blocks: T15, T18

## Goal
Everything the player collects: drops rolled from enemies and asteroids, formation bonuses, timed powerups, salvage, and rare discoveries.

## Owns
`src/game/pickups/**` (pickupSystem.ts, drops.ts, powerups.ts, escapePod.ts, sprites.ts, index.ts, tests), `src/content/dropTables.ts`, `src/content/pickups.ts`. The `pickups` System and DrawLayer (z 20).

## Read first
`docs/design.md` → Pickups (table + drop rule), Weapons (pickup resolution).

## Requirements
1. **dropTables.ts:** weighted tables per enemy and asteroid (`none`, salvage sizes, shield, upgrade, magnet, repulsor, weapon:*). Global modifiers: pity timer (if no non-salvage pickup has dropped for 25 s, the next kill guarantees one), and **no shield cells while at max shield** (re-roll).
2. **drops.ts:** listen for `enemyKilled{byPlayer:true}` and `asteroidDestroyed{byPlayer:true}` and roll via `world.rng`. Listen for `formationCleared` and spawn a weapon capsule (weighted 50% toward owned non-max weapons). Carriers always drop a capsule. Asteroids killed by enemies drop nothing.
3. **Pickup motion:** drift down (scroll + 10 px/s) with a slight sideways bob. Blink during the last 2 s of the 10 s ttl. Salvage sprays out with a small burst velocity and then settles.
4. **Collection:** distance to player < `pickupRadius × stats.pickupRadiusMul` (radius 14 by default). Apply the effect and emit `pickupCollected` + `sfx`:
   - weapon/upgrade → T09 resolve functions
   - shield → +1 (cap) or +100 score
   - salvage → `run.salvage += amount × salvageMul`
   - magnet → `player.magnetT = 8 × durationMul`
   - repulsor → `player.repulsorT = 6 × durationMul`
   - schematic → `run.schematics.push(id)`, toast `SCHEMATIC: BULWARK`
   - escapePod → `run.pilotsRescued.push(id)`, toast `PILOT RESCUED: JUNO SPARKS`
5. **Magnet** (while `magnetT > 0`): every pickup on screen homes toward the player (accelerating, max 300 px/s), shown with a faint shimmer line. **Repulsor** (while `repulsorT > 0`): each tick, `applyRadialForce` pushes enemy shots *and asteroids* outward within 48 px. Show a pulsing pixel ring around the ship. Pushed asteroids then kill enemies they hit, via the existing T03 rules.
6. **Escape pod:** `spawnEscapePod(w, pilotId, x)`, a slow 12 px/s capsule with a blinking beacon. Enemy shots destroy it (register with T03's shot-blocker hook or a small check here). It is lost if it leaves the screen. Toast `POD LOST` on loss.
7. **Sprites:** 12×12 capsules with letter glyphs (B/S/L/M/D, U for upgrade, a shield icon, magnet "horseshoe", repulsor "rings"), salvage bits in 3 sizes (gold/teal scrap), a schematic (blue rolled blueprint), and the escape pod.

## Acceptance criteria
- [ ] Clearing a gnat formation drops a capsule exactly where the last gnat died.
- [ ] Magnet sweeps every pickup on screen into the ship. Repulsor visibly bats away bullets and shoves rocks into enemies.
- [x] Unit tests: drop roll distribution (10k rolls within tolerance), pity timer, shield re-roll at max, each collection effect, pod destruction by enemy shot.

## Out of scope
When pods and carriers appear (T15), HUD timers (T14).

## Contract changes
No contract file changed. Conventions on top:
- Weapon and upgrade pickups only emit `pickupCollected` (payload = weapon id for `weapon`, `''` for `upgrade`). T09 applies them. T12 doesn't import T09.
- Enemy defs may add optional `dropTable?: string` (default `'common'`; `'carrier'` always drops a weapon capsule) and `salvage?: number` (guaranteed salvage per player kill). T12 reads them through `getEnemyDef(id)` and tolerates unknown ids.
- Bosses (`isBoss`) roll no drops. T15/T16 script boss rewards, such as the schematic.
- `run.salvage` gets `amount × salvageMul` unrounded. Floor it when banking (T17).
- Pickup state (pity timer, pod count) lives in a module `WeakMap` keyed by world.

## Notes
- API (`src/game/pickups/index.ts`): `pickupsSystem` (slot "pickups"), `pickupsLayer` (z 20), `powerupFxLayer` (z 57, repulsor rings above the shots and below the ship), `spawnEscapePod(w, pilotId, x)` → `Pickup | null`, `spawnDrop(w, kind, x, y, payload?, amount?)`, `spawnWeaponCapsule(w, x, y)`, `spraySalvage(w, x, y, total)`, `rollDrop(table, rng, filter)`, `pickCapsuleWeapon(rng, weapons)`, `collectPickup`, `collectRadius`, `attachPickups(w)` (idempotent; the system calls it on its first tick), `PICKUP_SPRITE_IDS`.
- Drop tables (`content/dropTables.ts`): `common`, `elite` (includes a rare schematic for the next ship not already found this run), `carrier`, `asteroid_small|medium|large`. Each player kill sprays its def `salvage`, then makes one weighted roll. Pity applies after 25 s without a non-salvage drop (filter to items only, falling back to `common`). Shield is excluded at max shield, which gives the same distribution as a re-roll.
- Escape pods drift at an absolute 12 px/s, never expire, and can be magnetized. The pod shot-blocker is registered at module load. A pod is lost (toast `POD LOST`) when an enemy shot hits it or when it leaves the screen. The pickups system checks for that before cleanup can cull the pod silently.
- Sandbox: 7 = magnet plus 12 scattered salvage sprays, 8 = repulsor plus a ring of 16 inbound enemy shots, 9 = shield cell 90 px above the ship, 0 = weapon capsule above the ship, Shift+0 = escape pod (juno).
- Checked in Chrome (port 5112, muted): gallery sprites, repulsor rings, pod beacon, and magnet sweep with shimmer lines. No console errors. Enemy shots and rocks aren't drawn in this worktree, so bat-away and rock-shove were checked only by unit tests. The formation capsule is unit-tested, but the in-game check needs T11.
