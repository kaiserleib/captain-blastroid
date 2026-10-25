# T13 — FX & juice: explosions, particles, screen shake, hitstop, haptics, toasts
Status: todo
Wave: 2 · Depends on: T02, T03 · Blocks: T18

## Goal
Make every hit and kill feel great without hurting readability or performance. This module only *listens* to events.

## Owns
`src/gfx/fx/**` (particles.ts, explosions.ts, shake.ts, toasts.ts, fxSystem.ts, sprites.ts, index.ts, tests). The `fx` System and DrawLayer (z 70) registrations. Wiring of `hitstop` → `loop.hitstop`, `shake` → `renderer.shakeX/Y`, `haptic` → `platform.haptics`.

## Read first
`docs/art-direction.md`. `GameEvents` in the contract.

## Requirements
1. **Particle pool** (capacity 600, separate from the sim pools and allowed to use a *separate* non-sim RNG, since FX don't affect gameplay): point/rect particles with velocity, drag, gravity 0, ttl, and a color ramp over life. Kinds: spark, smoke puff (dithered), rock chunk, debris pixel, ring (expanding pixel circle).
2. **Explosions:** procedural frame sprites at 16/32/48 (white flash → yellow → orange → red → smoke) plus particles. `explode(x, y, size)`. Bosses get chained multi-explosions.
3. **Event reactions:** `enemyHit` (2 sparks), `enemyKilled` (explosion sized by enemy r, plus `sfx enemy_die_*`), `asteroidDestroyed` (chunks + dust), `playerHit` (shield-shatter ring + `haptic medium`), `playerDied` (large explosion + debris), `pickupCollected` (sparkle + `haptic light` for powerups), `bossDefeated` (2 s chain + white screen flash), `shake`, `hitstop`, `toast`.
4. **Screen shake:** decaying random offset (integer pixels), max 4 px. Respects `settings.screenShake` (off/low/full).
5. **Hitstop:** brief sim freeze (≤ 0.12 s) on big kills and player death. Ignore new hitstops while one is active.
6. **Toasts:** queue of short center-screen messages using the 8×8 font, SNES-window-styled, at most 2 visible, 1.2 s each, sliding in.
7. **Score popups:** small 5×7-font numbers floating up from kills when the chain is ×2 or higher.
8. **Performance:** if the particle pool is full, drop new particles (never throw). Skip spark particles when > 400 are active.

## Acceptance criteria
- [ ] Sandbox: killing enemies, rocks and the player all feel punchy. Screen shake toggles with the setting.
- [ ] 60 fps during a 30-kill-per-second asteroid storm.
- [ ] FX never use `world.rng` (sim determinism test: same seed + inputs with FX on/off gives identical world state).

## Out of scope
Sound synthesis (T04; just emit ids).
