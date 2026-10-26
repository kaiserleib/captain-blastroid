import { PLAYER_TUNING as T } from '../../content/player';
import { flags } from '../../debug/flags';
import { WHITE } from '../../gfx/palette';
import type { Renderer } from '../../gfx/renderer';
import { warm } from '../../gfx/spriteCache';
import type { DrawLayer, World } from '../../sim/world';
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
  if (flags.debug) r.circle(x, y, p.r, WHITE, false);
}

/** Bakes the ship's level and bank sheets (incl. flash) so the first hit doesn't hitch. */
export function warmPlayerSprites(shipId: string): void {
  warm([shipId, shipId + '_bank_l', shipId + '_bank_r']);
}

export const playerLayer: DrawLayer = { name: 'player', z: 60, draw: drawPlayer };
