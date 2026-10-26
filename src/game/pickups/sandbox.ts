import { POWERUP_TUNING } from '../../content/pickups';
import { flags } from '../../debug/flags';
import { spawnEnemyShot, type ShotInit } from '../../sim/spawn';
import type { World } from '../../sim/world';
import { spawnDrop, spawnWeaponCapsule, spraySalvage } from './drops';
import { spawnEscapePod } from './escapePod';

// ?sandbox keys: 7 magnet (+ salvage to sweep), 8 repulsor (+ a ring of enemy
// shots to bat away), 9 shield cell, 0 random weapon capsule, Shift+0 escape pod.
// Keys only set bits; the pickups system applies them inside the tick.

const MAGNET = 1;
const REPULSOR = 2;
const SHIELD = 4;
const CAPSULE = 8;
const POD = 16;

let pending = 0;

if (flags.sandbox && typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Digit7') pending |= MAGNET;
    else if (e.code === 'Digit8') pending |= REPULSOR;
    else if (e.code === 'Digit9') pending |= SHIELD;
    else if (e.code === 'Digit0') pending |= e.shiftKey ? POD : CAPSULE;
  });
}

const shot: ShotInit = { x: 0, y: 0, vx: 0, vy: 0, r: 3, sprite: 'ebullet_s', ttl: 6 };
const RING_SHOTS = 16;
const RING_R = 110;
const RING_SPEED = 70;

export function pollSandbox(w: World): void {
  if (pending === 0) return;
  const bits = pending;
  pending = 0;
  const p = w.player;
  if (bits & MAGNET) {
    p.magnetT = POWERUP_TUNING.magnetDuration * p.stats.powerupDurationMul;
    for (let i = 0; i < 12; i++) {
      spraySalvage(w, w.rng.range(16, w.width - 16), w.rng.range(20, 220), w.rng.pick([1, 5, 25]));
    }
  }
  if (bits & REPULSOR) {
    p.repulsorT = POWERUP_TUNING.repulsorDuration * p.stats.powerupDurationMul;
    for (let i = 0; i < RING_SHOTS; i++) {
      const a = (i / RING_SHOTS) * Math.PI * 2;
      shot.x = p.x + Math.cos(a) * RING_R;
      shot.y = p.y + Math.sin(a) * RING_R;
      shot.vx = -Math.cos(a) * RING_SPEED;
      shot.vy = -Math.sin(a) * RING_SPEED;
      spawnEnemyShot(w, shot);
    }
  }
  if (bits & SHIELD) spawnDrop(w, 'shield', p.x, p.y - 90);
  if (bits & CAPSULE) spawnWeaponCapsule(w, p.x, p.y - 90);
  if (bits & POD) spawnEscapePod(w, 'juno', p.x);
}
