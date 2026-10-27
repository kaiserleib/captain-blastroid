import { PILOT_ABILITY_TUNING as A } from '../../content/pilots';
import { PLAYER_TUNING as T } from '../../content/player';
import { flags } from '../../debug/flags';
import { COBALT, GILT, SKY, WHITE } from '../../gfx/palette';
import type { Renderer } from '../../gfx/renderer';
import { warm } from '../../gfx/spriteCache';
import { WORLD_H, WORLD_W, type DrawLayer, type World } from '../../sim/world';
import { getPlayerRuntime, isGodMode } from './playerSystem';

/** Engine flame frames per strip: 0–2 cruise, 3–5 climb (ships.sprites.ts). */
const FLAME_FRAMES = 3;

const opts = { frame: 0, flash: false };

/** Visible on even half-periods of the blink (15 Hz → 30 toggles per second). */
export function blinkVisible(invulnT: number): boolean {
  return Math.floor(invulnT * T.blinkHz * 2) % 2 === 0;
}

export function drawPlayer(w: World, r: Renderer, alpha: number): void {
  const p = w.player;
  if (!p.alive) return;
  const rt = getPlayerRuntime(w);
  if (rt.bulletT > 0) drawBulletTimeVignette(r, rt.bulletT);
  const x = p.prevX + (p.x - p.prevX) * alpha;
  const y = p.prevY + (p.y - p.prevY) * alpha;

  const flash = rt.hitFlashT > 0;
  // God mode pins invulnT, so it doesn't count as a hit to blink for.
  const hidden = !flash && p.invulnT > 0 && !isGodMode() && !blinkVisible(p.invulnT);
  if (!hidden) {
    const id = rt.bank < 0 ? rt.spriteBankL : rt.bank > 0 ? rt.spriteBankR : rt.spriteLevel;
    opts.frame = (Math.floor(rt.animT * T.flameFps) % FLAME_FRAMES) + (rt.boost ? FLAME_FRAMES : 0);
    opts.flash = flash;
    r.sprite(id, x, y, opts);
  }
  if (rt.goldFlashT > 0) drawSolarSparkle(r, x, y, rt.goldFlashT);
  if (flags.debug) r.circle(x, y, p.r, WHITE, false);
}

// Four glints on the diagonals, then the cardinals, as the ring opens.
const GLINT_DX = [-1, 1, 1, -1, 0, 1, 0, -1];
const GLINT_DY = [-1, -1, 1, 1, -1, 0, 1, 0];

/** Ines' regen: a gold ring opening from the hull plus twinkling glints. No toast. */
function drawSolarSparkle(r: Renderer, x: number, y: number, t: number): void {
  const k = 1 - t / A.solarFlash;
  const rad = 7 + k * 9;
  r.circle(x, y, rad, k < 0.5 ? GILT.highlight : GILT.light, false);
  const set = k < 0.5 ? 0 : 4;
  const d = rad + 3;
  for (let i = set; i < set + 4; i++) {
    const gx = x + (GLINT_DX[i] as number) * d * (set === 0 ? 0.71 : 1);
    const gy = y + (GLINT_DY[i] as number) * d * (set === 0 ? 0.71 : 1);
    r.rect(gx - 1, gy, 3, 1, GILT.highlight);
    r.rect(gx, gy - 1, 1, 3, GILT.highlight);
    r.rect(gx, gy, 1, 1, WHITE);
  }
}

/**
 * Halász' bullet time: a dithered blue frame around the playfield. It thins out
 * over the last half second so the return to full speed reads.
 */
function drawBulletTimeVignette(r: Renderer, left: number): void {
  const fading = left < 0.5;
  const outer = COBALT.dark;
  const inner = fading ? COBALT.dark : SKY.dark;
  r.rect(0, 0, WORLD_W, 1, outer);
  r.rect(0, WORLD_H - 1, WORLD_W, 1, outer);
  r.rect(0, 0, 1, WORLD_H, outer);
  r.rect(WORLD_W - 1, 0, 1, WORLD_H, outer);
  if (fading) return;
  // Every other pixel on the second ring, every fourth on the third.
  for (let x = 1; x < WORLD_W - 1; x += 2) {
    r.rect(x, 1, 1, 1, inner);
    r.rect(x + 1, WORLD_H - 2, 1, 1, inner);
  }
  for (let y = 1; y < WORLD_H - 1; y += 2) {
    r.rect(1, y, 1, 1, inner);
    r.rect(WORLD_W - 2, y + 1, 1, 1, inner);
  }
  for (let x = 2; x < WORLD_W - 2; x += 4) {
    r.rect(x, 2, 1, 1, outer);
    r.rect(x + 2, WORLD_H - 3, 1, 1, outer);
  }
  for (let y = 2; y < WORLD_H - 2; y += 4) {
    r.rect(2, y, 1, 1, outer);
    r.rect(WORLD_W - 3, y + 2, 1, 1, outer);
  }
}

/** Bakes the ship's level and bank sheets (incl. flash) so the first hit doesn't hitch. */
export function warmPlayerSprites(shipId: string): void {
  warm([shipId, shipId + '_bank_l', shipId + '_bank_r']);
}

export const playerLayer: DrawLayer = { name: 'player', z: 60, draw: drawPlayer };
