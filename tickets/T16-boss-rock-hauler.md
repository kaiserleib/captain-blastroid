# T16 — Boss: Rock Hauler
Status: todo
Wave: 3 · Depends on: T09, T10, T11 · Blocks: T18

## Goal
A UN Squadron-style multi-part boss for Level 1: a Syndicate mining barge that flings asteroids at the player, which pays off the level's asteroid mechanics.

## Owns
`src/game/boss/**` (bossSystem.ts, rockHauler.ts, parts.ts, sprites.ts, index.ts, tests), `src/content/bosses.ts`. The `boss` System registration. The boss defeat hook in T03's `damage.ts` (via the extension point; don't rewrite damage).

## Read first
`docs/design.md` → Boss: Rock Hauler. `docs/art-direction.md` → boss size, parts. T11 `patterns.ts`. T10 `spawnAsteroid`.

## Requirements
1. **Parts model:** a boss is a controller plus N part entities, spawned in the `enemies` pool with `isBoss: true` and positions rigidly offset from the controller. Each part has its own HP, flash, hitbox and `targetable` flag (the core is untargetable until both turrets die). `parts.ts` is generic so future bosses reuse it.
2. **Entry:** the boss descends from above over 3 s while invulnerable, then fights.
3. **Phase 1:** strafes left and right across the top (y≈70) with ease-in-out. Each clamp-turret fires `aimed burst(3)` every 1.6 s (alternating). Every 4 s the barge flings a medium asteroid from its hopper toward the player's position at 90 px/s (a real asteroid entity: player shots can destroy it, enemy-collision rules apply, and the repulsor can bat it away).
4. **Phase 2** (both turrets destroyed): the core opens (sprite change), the drills spin (2-frame), a rotating `ring(8)` fires every 2 s, rocks are flung in pairs at ±15°, and strafing gets faster.
5. **Turret death:** medium explosion, the part shows wreck sprite variants (smoking), `shake`.
6. **Defeat:** when core HP hits 0, the boss goes invulnerable, emits a 2 s chain of explosions across its body, `bossDefeated`, `hitstop 0.12` and big `shake`, then releases all parts. Clear remaining enemy shots (convert to salvage bits, a classic shmup reward).
7. **Sprites:** about 96×64 composite. A rusty, chunky hull with hazard stripes, a hopper full of rocks, two clamp turrets, a glowing core and drills. This is the showpiece, so spend effort here.
8. HUD boss bar (T14) reads the total remaining HP of targetable+untargetable parts. Expose `bossHp()` / `bossMaxHp()`.

## Acceptance criteria
- [ ] Beatable in about 60–90 s with a typical end-of-level loadout (≈ Blaster L3, Spread L3, one more weapon L2). Tests at those stats simulate DPS-only time-to-kill in the 45–75 s range.
- [ ] Flung asteroids can be shot apart or repulsed into the boss (the boss is immune, so they just break), and destroy dumb enemies if any remain.
- [ ] Unit tests: core untargetable until both turrets die; phase transition; defeat emits events once.

## Out of scope
Additional bosses.
