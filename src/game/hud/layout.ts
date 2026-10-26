import { PLAYFIELD_H, type Insets, type Layout } from '../../engine/display';

/** Bands at least this tall (after the safe area) get a solid strip; thinner ones overlay. */
export const BAND_MIN = 20;
/** Overlay height limits from the ticket: the HUD may cover this much of the playfield. */
export const OVERLAY_TOP_H = 14;
export const OVERLAY_BOTTOM_H = 16;
/** Minimum pause tap target, CSS px (Apple HIG). */
export const PAUSE_HIT_CSS = 44;
export const PAUSE_ICON = 9;
const EDGE = 3;
/** Fallback when no display layout was supplied (tests, gallery): ~1.6 CSS px per logical px. */
const DEFAULT_LOGICAL_PER_CSS = 0.62;

/** What the HUD needs from the display, in logical buffer px. */
export interface HudViewport {
  width: number;
  height: number;
  playfieldOffsetY: number;
  /** Safe-area insets overlapping the logical buffer, logical px. */
  safe: Insets;
  /** Logical px per CSS px. */
  logicalPerCss: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HudLayout {
  width: number;
  height: number;
  /** Playfield top/bottom in buffer px. */
  pfTop: number;
  pfBottom: number;
  topBand: boolean;
  bottomBand: boolean;
  /** Band fill extents (empty when overlaying). */
  topBandRect: Rect;
  bottomBandRect: Rect;
  /** Top-left of the top HUD row and of the bottom HUD row, buffer px. */
  topRowY: number;
  bottomRowY: number;
  left: number;
  right: number;
  pauseIcon: Rect;
  pauseHit: Rect;
  /** First free playfield row below the top HUD (boss bar goes here). */
  bossY: number;
}

/**
 * Logical-px safe-area insets: the part of each CSS inset that overlaps the
 * logical buffer's destination rect. computeLayout already fits the buffer
 * inside the safe area, so this is normally 0; it guards against layouts
 * that let the buffer run under a notch.
 */
export function safeInsetsLogical(l: Layout): Insets {
  const sx = l.logicalW / l.destW;
  const sy = l.logicalH / l.destH;
  const i = l.insets;
  return {
    top: Math.max(0, i.top * l.dpr - l.destY) * sy,
    bottom: Math.max(0, l.destY + l.destH - (l.canvasH - i.bottom * l.dpr)) * sy,
    left: Math.max(0, i.left * l.dpr - l.destX) * sx,
    right: Math.max(0, l.destX + l.destW - (l.canvasW - i.right * l.dpr)) * sx,
  };
}

export function viewportFromLayout(l: Layout): HudViewport {
  const s = safeInsetsLogical(l);
  return {
    width: l.logicalW,
    height: l.logicalH,
    playfieldOffsetY: l.playfieldOffsetY,
    safe: {
      top: Math.ceil(s.top),
      bottom: Math.ceil(s.bottom),
      left: Math.ceil(s.left),
      right: Math.ceil(s.right),
    },
    logicalPerCss: (l.dpr * l.logicalW) / l.destW,
  };
}

export function defaultViewport(width: number, height: number, offsetY: number): HudViewport {
  return {
    width,
    height,
    playfieldOffsetY: offsetY,
    safe: { top: 0, right: 0, bottom: 0, left: 0 },
    logicalPerCss: DEFAULT_LOGICAL_PER_CSS,
  };
}

const EMPTY: Rect = { x: 0, y: 0, w: 0, h: 0 };

export function computeHudLayout(v: HudViewport): HudLayout {
  const pfTop = v.playfieldOffsetY;
  const pfBottom = pfTop + PLAYFIELD_H;
  const topSpace = pfTop - v.safe.top;
  const bottomSpace = v.height - v.safe.bottom - pfBottom;
  const topBand = topSpace >= BAND_MIN;
  const bottomBand = bottomSpace >= BAND_MIN;

  // In a band the HUD row hugs the playfield edge, so it stays near the action
  // and away from the status bar and the home indicator.
  const topRowY = topBand ? pfTop - BAND_MIN + 2 : Math.max(pfTop, v.safe.top) + 2;
  const bottomRowY = bottomBand
    ? pfBottom + 3
    : Math.min(pfBottom, v.height - v.safe.bottom) - OVERLAY_BOTTOM_H + 2;

  const left = v.safe.left + EDGE;
  const right = v.width - v.safe.right - EDGE;

  const pauseIcon: Rect = { x: right - PAUSE_ICON, y: topRowY, w: PAUSE_ICON, h: PAUSE_ICON };
  const hit = Math.max(PAUSE_ICON + 4, Math.ceil(PAUSE_HIT_CSS * v.logicalPerCss));
  let hx = pauseIcon.x + PAUSE_ICON / 2 - hit / 2;
  let hy = pauseIcon.y + PAUSE_ICON / 2 - hit / 2;
  hx = Math.min(Math.max(hx, 0), v.width - hit);
  hy = Math.min(Math.max(hy, 0), v.height - hit);

  return {
    width: v.width,
    height: v.height,
    pfTop,
    pfBottom,
    topBand,
    bottomBand,
    topBandRect: topBand ? { x: 0, y: 0, w: v.width, h: pfTop } : EMPTY,
    bottomBandRect: bottomBand ? { x: 0, y: pfBottom, w: v.width, h: v.height - pfBottom } : EMPTY,
    topRowY,
    bottomRowY,
    left,
    right,
    pauseIcon,
    pauseHit: { x: Math.round(hx), y: Math.round(hy), w: hit, h: hit },
    bossY: topBand ? pfTop + 3 : Math.max(pfTop, v.safe.top) + OVERLAY_TOP_H + 2,
  };
}

export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}
