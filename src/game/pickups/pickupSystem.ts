import { PICKUP_TUNING, POWERUP_TUNING } from '../../content/pickups';
import { PILOTS } from '../../content/pilots';
import { SHIPS } from '../../content/ships';
import type { Renderer } from '../../gfx/renderer';
import { isOffscreen } from '../../sim/cleanup';
import type { Pickup } from '../../sim/types';
import type { DrawLayer, System, World } from '../../sim/world';
import { attachDrops, spraySalvage } from './drops';
import { cacheSalvage, isCachePod, losePod } from './escapePod';
import { WEAPON_CAPSULE_SPRITES } from './pickups.sprites';
import { drawRepulsor, drawShimmer, homePickup, updatePowerups } from './powerups';
import { pollSandbox } from './sandbox';
import { emitSfx, emitToast, getPickupState, pickupP } from './state';

const attached = new WeakSet<World>();

/** Subscribes drops to the world's events. Idempotent; the system calls it on its first tick. */
export function attachPickups(w: World): void {
  if (attached.has(w)) return;
  attached.add(w);
  attachDrops(w);
}

export function collectRadius(w: World): number {
  const p = w.player;
  const base = p.pickupRadius > 0 ? p.pickupRadius : PICKUP_TUNING.defaultPickupRadius;
  return base * p.stats.pickupRadiusMul;
}

function upper(name: string | undefined, fallback: string): string {
  return (name ?? fallback).toUpperCase();
}

/**
 * Applies a pickup's effect, emits `pickupCollected` + `sfx`, and releases it.
 * Weapon and upgrade effects belong to T09, which listens for `pickupCollected`.
 */
export function collectPickup(w: World, k: Pickup): void {
  if (!k.active) return;
  const p = w.player;
  const run = w.run;
  let sfx = 'pickup';
  switch (k.kind) {
    case 'weapon':
    case 'upgrade':
      sfx = 'weapon_up';
      break;
    case 'shield':
      if (p.shield < p.maxShield) p.shield++;
      else run.score += PICKUP_TUNING.shieldFullScore;
      sfx = 'shield_up';
      break;
    case 'salvage':
      run.salvage += k.amount * p.stats.salvageMul;
      break;
    case 'magnet':
      p.magnetT = POWERUP_TUNING.magnetDuration * p.stats.powerupDurationMul;
      sfx = 'magnet_on';
      break;
    case 'repulsor':
      p.repulsorT = POWERUP_TUNING.repulsorDuration * p.stats.powerupDurationMul;
      sfx = 'repulsor_on';
      break;
    case 'schematic':
      if (k.payload && !run.schematics.includes(k.payload)) run.schematics.push(k.payload);
      emitToast(w, `SCHEMATIC: ${upper(SHIPS[k.payload]?.name, k.payload)}`);
      sfx = 'weapon_up';
      break;
    case 'escapePod': {
      if (isCachePod(k)) {
        spraySalvage(w, k.x, k.y, cacheSalvage(k));
        emitToast(w, 'SALVAGE CACHE SECURED');
      } else {
        if (k.payload && !run.pilotsRescued.includes(k.payload)) run.pilotsRescued.push(k.payload);
        emitToast(w, `PILOT RESCUED: ${upper(PILOTS[k.payload]?.name, k.payload)}`);
      }
      const st = getPickupState(w);
      if (st.pods > 0) st.pods--;
      sfx = 'pod_rescue';
      break;
    }
  }
  run.pickupsCollected[k.kind]++;
  pickupP.pickup = k;
  w.events.emit('pickupCollected', pickupP);
  emitSfx(w, sfx, k.x);
  w.pickups.release(k);
}

export function updatePickups(w: World, dt: number): void {
  attachPickups(w);
  const st = getPickupState(w);
  st.sinceItem += dt;
  st.sinceFormationCapsule += dt;
  pollSandbox(w);
  updatePowerups(w, dt);

  const p = w.player;
  const magnetOn = p.magnetT > 0 && p.alive;
  const cr = collectRadius(w);
  const cr2 = cr * cr;
  const driftY = w.scrollSpeed + PICKUP_TUNING.driftExtra;
  const settle = PICKUP_TUNING.settleRate * dt < 1 ? PICKUP_TUNING.settleRate * dt : 1;
  const bobPhase = w.time * PICKUP_TUNING.bobFreq;
  let pods = 0;

  const items = w.pickups.items;
  const n = w.pickups.count;
  for (let i = 0; i < n; i++) {
    const k = items[i] as Pickup;
    if (!k.active) continue;
    k.prevX = k.x;
    k.prevY = k.y;
    if (magnetOn && k.y > -k.r) k.magnetized = true;
    if (k.magnetized && p.alive) {
      homePickup(w, k, dt);
    } else {
      // Settle onto the drift; salvage bursts decay into it.
      const pod = k.kind === 'escapePod';
      const tvx = pod ? 0 : Math.sin(bobPhase + k.id) * PICKUP_TUNING.bobSpeed;
      const tvy = pod ? k.vy : driftY;
      k.vx += (tvx - k.vx) * settle;
      k.vy += (tvy - k.vy) * settle;
    }
    k.x += k.vx * dt;
    k.y += k.vy * dt;

    if (p.alive) {
      const dx = p.x - k.x;
      const dy = p.y - k.y;
      if (dx * dx + dy * dy < cr2) {
        collectPickup(w, k);
        continue;
      }
    }
    if (k.kind === 'escapePod') {
      // Checked before cleanup culls it, so the loss gets announced.
      if (isOffscreen(k)) {
        losePod(w, k);
        continue;
      }
      pods++;
    } else if (!k.magnetized) {
      k.ttl -= dt;
      if (k.ttl <= 0) w.pickups.release(k);
    }
  }
  st.pods = pods;
}

export const pickupsSystem: System = { name: 'pickups', update: updatePickups };

export function salvageSprite(amount: number): string {
  return amount >= 25 ? 'salvage_l' : amount >= 5 ? 'salvage_m' : 'salvage_s';
}

export function pickupSprite(k: Pickup): string {
  switch (k.kind) {
    case 'weapon':
      return WEAPON_CAPSULE_SPRITES[k.payload] ?? 'capsule';
    case 'upgrade':
      return 'capsule_u';
    case 'shield':
      return 'pickup_shield';
    case 'magnet':
      return 'pickup_magnet';
    case 'repulsor':
      return 'pickup_repulsor';
    case 'salvage':
      return salvageSprite(k.amount);
    case 'schematic':
      return 'pickup_schematic';
    case 'escapePod':
      return 'escape_pod';
  }
}

export const PICKUP_SPRITE_IDS: readonly string[] = [
  ...Object.values(WEAPON_CAPSULE_SPRITES),
  'capsule',
  'capsule_u',
  'pickup_shield',
  'pickup_magnet',
  'pickup_repulsor',
  'salvage_s',
  'salvage_m',
  'salvage_l',
  'pickup_schematic',
  'escape_pod',
];

const spriteOpts = { frame: 0 };

function drawPickups(w: World, r: Renderer, alpha: number): void {
  const p = w.player;
  const t = w.time;
  const px = p.prevX + (p.x - p.prevX) * alpha;
  const py = p.prevY + (p.y - p.prevY) * alpha;
  const shimmerFrame = Math.floor(t * 4) & 1;
  const items = w.pickups.items;
  const n = w.pickups.count;
  for (let i = 0; i < n; i++) {
    const k = items[i] as Pickup;
    if (!k.active) continue;
    if (k.ttl < PICKUP_TUNING.blinkT && Math.floor(k.ttl * 8) % 2 === 0) continue;
    const x = k.prevX + (k.x - k.prevX) * alpha;
    const y = k.prevY + (k.y - k.prevY) * alpha;
    if (k.magnetized && p.alive) drawShimmer(r, x, y, px, py, t);
    // Pods blink their beacon slower than the capsule shimmer.
    spriteOpts.frame = k.kind === 'escapePod' ? Math.floor(t * 2) & 1 : (shimmerFrame + k.id) & 1;
    r.sprite(pickupSprite(k), x, y, spriteOpts);
  }
}

export const pickupsLayer: DrawLayer = { name: 'pickups', z: 20, draw: drawPickups };

function drawPowerupFx(w: World, r: Renderer, alpha: number): void {
  const p = w.player;
  if (p.repulsorT <= 0 || !p.alive) return;
  const px = p.prevX + (p.x - p.prevX) * alpha;
  const py = p.prevY + (p.y - p.prevY) * alpha;
  drawRepulsor(r, px, py, p.repulsorT, w.time);
}

/** Repulsor rings sit above both shot layers (50/55) and under the ship (60). */
export const powerupFxLayer: DrawLayer = { name: 'powerupFx', z: 57, draw: drawPowerupFx };
