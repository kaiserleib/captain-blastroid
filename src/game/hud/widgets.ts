import { drawText, measure } from '../../gfx/font';
import { mix, OUTLINE, PICKUP, UI, WHITE } from '../../gfx/palette';
import type { Renderer } from '../../gfx/renderer';
import { drawBar } from '../../gfx/ui';
import type { WeaponInstance } from '../../sim/types';
import { drawEmptySlot, drawWeaponIcon, SLOT } from './icons';
import type { HudLayout, Rect } from './layout';
import { PIP_GAIN_T, type HudState } from './state';

export const MAX_SLOTS = 5;
export const MAX_LEVEL = 5;
const PIP_W = 8;
const SLOT_STEP = 18;
const TIMER_STEP = 13;
const SCORE_DIGITS = 7;

export const HUD_COLORS = {
  band: mix(UI.windowTop, UI.windowBottom, 0.8),
  bandEdge: UI.border,
  bandEdgeOuter: UI.borderOuter,
  score: UI.text,
  chain: UI.textGold,
  salvage: UI.textGold,
  levelOn: PICKUP.light,
  levelOff: UI.barBack,
  boss: UI.barWarn,
  bossHigh: '#f8a898',
  warnStripe: PICKUP.light,
  warnBack: '#781010',
} as const;

const SCORE_TEXT = { color: HUD_COLORS.score, align: 'center' } as const;
const CHAIN_TEXT = { color: HUD_COLORS.chain, align: 'center' } as const;
const CHAIN_TEXT_LEFT = { color: HUD_COLORS.chain } as const;
const SALVAGE_TEXT = { color: HUD_COLORS.salvage, align: 'right' } as const;
const BOSS_TEXT = { color: UI.text, align: 'center' } as const;
const BOSS_BAR = { fill: HUD_COLORS.boss, highlight: HUD_COLORS.bossHigh } as const;
const BOSS_BAR_FLASH = { fill: WHITE, highlight: WHITE } as const;
const TIMER_BAR = { fill: UI.barFill, highlight: UI.barHigh } as const;
const WARN_TEXT = { color: HUD_COLORS.warnStripe, align: 'center', scale: 2 } as const;

/** Formats numbers into strings only when they change, so steady frames don't allocate. */
export class NumberText {
  private value = NaN;
  text = '';
  constructor(private readonly format: (n: number) => string) {}

  get(n: number): string {
    if (n !== this.value) {
      this.value = n;
      this.text = this.format(n);
    }
    return this.text;
  }
}

export const formatScore = (n: number): string =>
  String(Math.max(0, Math.floor(n))).padStart(SCORE_DIGITS, '0');
export const formatCount = (n: number): string => String(Math.max(0, Math.floor(n)));
export const formatChain = (n: number): string => `×${Math.floor(n)}`;

/** Solid band with a window-style double edge (white on the playfield side, then gray). */
export function drawBand(r: Renderer, rect: Rect, whiteY: number, grayY: number): void {
  if (rect.h <= 0) return;
  r.rect(rect.x, rect.y, rect.w, rect.h, HUD_COLORS.band);
  r.rect(rect.x, whiteY, rect.w, 1, HUD_COLORS.bandEdge);
  r.rect(rect.x, grayY, rect.w, 1, HUD_COLORS.bandEdgeOuter);
}

export function drawShield(
  r: Renderer,
  st: HudState,
  x: number,
  y: number,
  shield: number,
  maxShield: number,
): void {
  const n = Math.min(st.pipLostT.length, Math.max(0, Math.floor(maxShield)));
  const blink = Math.floor(st.t * 16) % 2 === 0;
  for (let i = 0; i < n; i++) {
    const px = x + i * PIP_W;
    const lost = st.pipLostT[i] as number;
    const gain = st.pipGainT[i] as number;
    if (i < shield) {
      const frame = gain > 0 ? 1 + Math.min(2, Math.floor((1 - gain / PIP_GAIN_T) * 3)) : 0;
      PIP_FRAME.frame = frame;
      r.sprite('hud_pip', px, y, PIP_FRAME);
    } else if (lost > 0 && blink) {
      r.sprite('hud_pip', px, y, FLASH);
    } else {
      r.sprite('hud_pip_empty', px, y);
    }
  }
}
const FLASH = { flash: true } as const;
const PIP_FRAME = { frame: 0 };

export function drawScore(
  r: Renderer,
  cx: number,
  y: number,
  score: string,
  chain: number,
  chainText: string,
  stacked: boolean,
): void {
  r.text(score, cx, y, SCORE_TEXT);
  if (chain < 2) return;
  if (stacked) r.text(chainText, cx, y + 9, CHAIN_TEXT);
  else r.text(chainText, cx + Math.ceil(measure(score) / 2) + 3, y, CHAIN_TEXT_LEFT);
}

/** Salvage count right-aligned to `right`, with the scrap icon in front of it. */
export function drawSalvage(r: Renderer, right: number, y: number, text: string): void {
  r.text(text, right, y + 1, SALVAGE_TEXT);
  r.sprite('hud_scrap', right - measure(text) - 10, y);
}

export function drawPauseButton(r: Renderer, icon: Rect): void {
  r.sprite('hud_pause', icon.x, icon.y);
}

export function drawWeapons(
  r: Renderer,
  x: number,
  y: number,
  weapons: readonly WeaponInstance[],
  maxSlots: number,
): void {
  const slots = Math.min(MAX_SLOTS, Math.max(maxSlots, weapons.length));
  for (let i = 0; i < slots; i++) {
    const sx = x + i * SLOT_STEP;
    const w = weapons[i];
    if (!w) {
      drawEmptySlot(r, sx, y);
      continue;
    }
    drawWeaponIcon(r, w.id, sx, y);
    // Level pips: a column right of the icon, filling bottom-up.
    r.rect(sx + SLOT, y + 1, 4, 11, OUTLINE);
    const lv = Math.min(MAX_LEVEL, Math.max(0, Math.floor(w.level)));
    for (let j = 0; j < MAX_LEVEL; j++) {
      r.rect(
        sx + SLOT + 1,
        y + 10 - j * 2,
        2,
        1,
        j < lv ? HUD_COLORS.levelOn : HUD_COLORS.levelOff,
      );
    }
  }
}

/** Magnet and repulsor: icon over a shrinking bar, right-aligned to `right`. */
export function drawTimers(
  r: Renderer,
  right: number,
  y: number,
  magnetT: number,
  magnetMax: number,
  repulsorT: number,
  repulsorMax: number,
): void {
  let x = right - 11;
  if (repulsorT > 0) {
    drawTimer(r, 'hud_repulsor', x, y, repulsorT, repulsorMax);
    x -= TIMER_STEP;
  }
  if (magnetT > 0) drawTimer(r, 'hud_magnet', x, y, magnetT, magnetMax);
}

function drawTimer(r: Renderer, icon: string, x: number, y: number, t: number, max: number): void {
  // Blink the last second so expiry isn't a surprise.
  if (t > 1 || Math.floor(t * 8) % 2 === 0) r.sprite(icon, x + 2, y);
  drawBar(r, x, y + 8, 11, 4, t, max > 0 ? max : t, TIMER_BAR);
}

export function drawBossBar(r: Renderer, l: HudLayout, st: HudState): void {
  const y = l.bossY;
  r.text(st.bossName, l.width / 2, y, BOSS_TEXT);
  const w = 160;
  drawBar(
    r,
    (l.width - w) / 2,
    y + 9,
    w,
    6,
    st.bossHp,
    st.bossMaxHp,
    st.bossFlashT > 0 ? BOSS_BAR_FLASH : BOSS_BAR,
  );
}

const WARN_H = 30;
const STRIPE_H = 4;
const STRIPE_W = 6;

export function drawWarning(r: Renderer, l: HudLayout, st: HudState): void {
  const y = Math.round(l.pfTop + 140);
  const w = l.width;
  r.rect(0, y, w, WARN_H, HUD_COLORS.warnBack);
  // Hazard stripes slide sideways; each row shifts by one to fake a diagonal.
  const scroll = Math.floor(st.t * 24) % (STRIPE_W * 2);
  for (let row = 0; row < STRIPE_H; row++) {
    const off = scroll + row;
    for (let sx = -STRIPE_W * 2; sx < w + STRIPE_W; sx += STRIPE_W * 2) {
      r.rect(sx + off, y + row, STRIPE_W, 1, HUD_COLORS.warnStripe);
      r.rect(sx - off + STRIPE_W, y + WARN_H - STRIPE_H + row, STRIPE_W, 1, HUD_COLORS.warnStripe);
    }
  }
  r.rect(0, y + STRIPE_H, w, 1, OUTLINE);
  r.rect(0, y + WARN_H - STRIPE_H - 1, w, 1, OUTLINE);
  if (Math.floor(st.t * 5) % 2 === 0) {
    drawText(r.ctx, 'WARNING', Math.round(w / 2), y + 9, WARN_TEXT);
  }
}
