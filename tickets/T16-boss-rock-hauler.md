# T16 — Boss: Rock Hauler
Status: done
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
- [x] Beatable in about 60–90 s with a typical end-of-level loadout (≈ Blaster L3, Spread L3, one more weapon L2). Tests at those stats simulate DPS-only time-to-kill in the 45–75 s range.
- [x] Flung asteroids can be shot apart or repulsed into the boss (the boss is immune, so they just break), and destroy dumb enemies if any remain.
- [x] Unit tests: core untargetable until both turrets die; phase transition; defeat emits events once.

## Out of scope
Additional bosses.

## Contract changes
None. No contract file changed. Additive shared edits:
- `src/content/index.ts` re-exports `./bosses`.
- `GameScene` registers `bossSystem` at the boss slot and `bossLayer` (z 42).

## Notes
- **API (`src/game/boss/index.ts`).** `bossSystem` (boss slot; also runs the `?sandbox` keys), `bossLayer` (z 42, between roster enemies and enemy shots), `activeBoss(w)`, `spawnBoss(w, defId)`, `attachBoss(w)` (the system calls it lazily), `updateBoss`, `bossHp(w)` / `bossMaxHp(w)`, `bossDamageHook`, `clearShotsToSalvage(w, max)`, `RockHauler`, `Phase`, `BossRig` / `PartSlot` (generic parts model in `parts.ts`), `BOSS_SPRITE_IDS`. Loading the module registers the part defs (`registerEnemyDefs`, `isBoss: true`) and the `registerBossDamage` hook.
- **Event flow (per WAVE3).** It listens for `bossRequested`, spawns on the next boss tick and emits `bossSpawned {defId}`. Unknown ids and a second request while a boss is up are ignored. On the core kill, it emits `bossDefeated {defId, x, y}` and `sfx boss_die` once, sets `run.bossDefeated`, adds the score and a kill, and converts the enemy shots on screen into 1-salvage bits (cap 40). It plays no explosions, flash, hitstop or big shake, because T13 owns those on `bossDefeated`. The schematic and the salvage reward are left to T15. The boss stays on screen, sagging, shuddering and strobing, for `deathTime` (2 s) under T13's chain, then releases its parts.
- **Parts.** Six `isBoss` enemies held at rigid offsets: two clamp turrets, the core, and three **hull armor** parts. The armor parts have hp 0, so they absorb shots and add nothing to the HUD bar. Flung or batted rocks also break on them, and they cost you a shield on contact. The rig integrates prevX/prevY, position and velocity itself; the velocity matters because T03's closing check uses it. Turret deaths go through T03's normal path, which gives `enemyKilled`, T13's explosion and score. The boss notices the release on its next tick, then shows the wreck sprite and smoke and emits `shake`. The damage hook absorbs hits during entry, the iris opening and dying, and on the untargetable core, drawing a small deflect spark. It handles the lethal core hit itself, so the core is never released early.
- **Phases.** Entry is a 3 s ease-out descent, invulnerable. Phase 1 strafes between x 62 and 178 with ease-in-out, plus a ±3 px bob. Each turret fires an aimed `burst(3)` (`fair = false`) every 1.6 s, half an interval out of step with the other, and the survivor speeds up to 1.2 s once its twin is wrecked. A medium rock is thrown every 4 s at 90 px/s, aimed at the player; the throw angle is clamped to 10–170°, so it never goes up into the hull. The hopper rattles and the chute glows for 0.6 s before each throw. After both turrets die, the iris takes 1.2 s to open while still armored. Phase 2 then has spinning drills, a faster strafe (4.2 s sweeps), a `ring(8)` of large shots every 2 s rotating 15° per volley, and pairs of rocks at ±15° every 3.6 s.
- **Balance (judgment call).** design.md's 20/60 HP came before the weapon tables and would die in about 8 s. I tuned instead: turrets 135 HP each, core 270, 540 in total. In the headless DPS-only sim (`boss.test.ts`: an invulnerable bot that tracks and leads the current target at real ship speed), Blaster L3 + Spread L3 + Lance L2 kills it in **67.8 s**, and with Seeker L2 instead of Lance in **53.4 s**. The test asserts 45–75 s.
- **Played in Chrome** (port 5116, muted, `?sandbox`, F1×2 F2×3 F3×2, then K). A dodge bot that leads its shots and samples positions to avoid bullets and rocks finished the fight in **60 s** and took 1 hit: about 26 s for the turret phase and 34 s for the core. Without dodging, the ship died during phase 1. A human who leads less precisely should land around 60–90 s. The death sequence, the HUD bar (`ROCK HAULER`), shot-to-salvage conversion and part release all checked out.
- **Sandbox.** `K` emits `bossRequested {defId:'rock_hauler'}`, the same path the director uses. `Shift+K` wrecks both turrets to jump to phase 2. In the dev console, use `(await import('/src/game/boss/sandbox.ts')).bossSandbox.world`, or the `?t=` URL after an HMR update.
- **Art (`boss.sprites.ts`).** Procedural and painted into an index buffer, with automatic top-left bevels, per-pixel sphere and cylinder lighting with Bayer dithering, and seeded rust weathering. Sprites:
  - `boss_rh_hull`: 96×60, 2 frames for the nozzle glow and blinking running lights. It carries the olive hopper with a hazard lip, rust deck, shoulder plates, engine pods, C-clamp jaws, a recessed core socket, the gunmetal prow with a hazard band, drill hubs and the rock chute. Asymmetric touches are a green Syndicate skull stencil and a red beacon mast.
  - `boss_rh_hopper`: the lit rock heap with glowing ore.
  - `boss_rh_turret`: a rust dome in a bolted collar with a green visor, 2 frames.
  - `boss_rh_barrel`: a twin cannon baked at 16 rotations, which tracks the player and recoils on firing.
  - `boss_rh_turret_wreck`: the blown-open dome, torn shards, bent stub and sparking wire, 2 frames, plus smoke puffs drawn without per-puff state.
  - `boss_rh_core`: 9 frames covering the shut X-seam iris pulse, the 3-step opening and the open reactor pulse.
  - `boss_rh_drill`: a fluted cone, 2-frame spin.
  - `boss_rh_chute`, `boss_rh_smoke` and `boss_rh_spark`.

  With drills the composite is about 96×80. The gallery has a "Boss: Rock Hauler" section (`tools/sections/boss.ts`) with four states and a live looping fight.
- **Follow-ups.**
  - There is no throw sfx and no "armor ping" sfx in T04's id list, so throws and deflects are silent.
  - Seeker Pods target the nearest enemy, so they can lock onto hull armor or the shielded core. T09 could skip `isBoss` parts with `hp <= 0`, or skip untargetable ones. This needs a small exported predicate.
  - Turret bursts leave from the turret center (`muzzleY`), not the barrel tip.
  - T18 can tune everything in `content/bosses.ts`.
