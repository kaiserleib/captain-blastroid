import type { ScenePointer } from '../engine/scene';

/** A focusable rectangle in logical buffer coordinates. */
export interface MenuItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Sliders take left/right (and pointer drags) instead of moving focus sideways. */
  slider?: boolean;
  /** Takes left/right like a slider, but taps activate it (toggles, cyclers). */
  adjustable?: boolean;
}

export interface MenuHandlers {
  activate(item: MenuItem): void;
  /** Left/right on a slider (dx = -1 | 1). */
  adjust?(item: MenuItem, dx: number): void;
  /** Pointer press or drag on a slider, at buffer x. */
  drag?(item: MenuItem, x: number, first: boolean): void;
  /** Focus moved (keyboard, hover or tap). */
  moved?(item: MenuItem): void;
}

/** Minimum hit size in logical px; main.ts keeps it at 44 CSS px for the current display. */
let minHit = 22;

export function setMinHitSize(px: number): void {
  minHit = Math.max(1, px);
}

export function getMinHitSize(): number {
  return minHit;
}

/**
 * Index of the item under (x, y), or -1. Each rect is grown to the minimum tap size
 * around its centre; where grown rects overlap, the nearest centre wins.
 */
export function hitTest(items: readonly MenuItem[], x: number, y: number, min = minHit): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < items.length; i++) {
    const it = items[i] as MenuItem;
    const cx = it.x + it.w / 2;
    const cy = it.y + it.h / 2;
    const hw = Math.max(it.w, min) / 2;
    const hh = Math.max(it.h, min) / 2;
    const ddx = x - cx;
    const ddy = y - cy;
    if (Math.abs(ddx) > hw || Math.abs(ddy) > hh) continue;
    // Inside the real rect beats a grown neighbour.
    const inside = Math.abs(ddx) <= it.w / 2 && Math.abs(ddy) <= it.h / 2;
    const d = (inside ? 0 : 1e6) + ddx * ddx + ddy * ddy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Spatial navigation: the nearest item whose centre lies in direction (dx, dy) from
 * `from`, weighting sideways offset double. Vertical moves wrap around; horizontal don't.
 */
export function navTarget(
  items: readonly MenuItem[],
  from: number,
  dx: number,
  dy: number,
): number {
  const cur = items[from];
  if (!cur) return items.length > 0 ? 0 : -1;
  const cx = cur.x + cur.w / 2;
  const cy = cur.y + cur.h / 2;
  let best = -1;
  let bestS = Infinity;
  for (let i = 0; i < items.length; i++) {
    if (i === from) continue;
    const it = items[i] as MenuItem;
    const ox = it.x + it.w / 2 - cx;
    const oy = it.y + it.h / 2 - cy;
    const along = ox * dx + oy * dy;
    if (along <= 0.5) continue;
    const side = Math.abs(dx !== 0 ? oy : ox);
    const s = along + side * 2;
    if (s < bestS) {
      bestS = s;
      best = i;
    }
  }
  if (best >= 0 || dy === 0) return best;
  // Wrap: the furthest item the other way, preferring the same column.
  let wrapS = -Infinity;
  for (let i = 0; i < items.length; i++) {
    if (i === from) continue;
    const it = items[i] as MenuItem;
    const ox = it.x + it.w / 2 - cx;
    const oy = it.y + it.h / 2 - cy;
    const back = -oy * dy;
    if (back <= 0.5) continue;
    const s = back - Math.abs(ox) * 2;
    if (s > wrapS) {
      wrapS = s;
      best = i;
    }
  }
  return best;
}

/** Focus, keyboard navigation and pointer press/release tracking for one screen's items. */
export class Menu {
  items: MenuItem[] = [];
  focus = 0;
  /** Item held down by a pointer, or -1. */
  pressed = -1;
  private pressedPointer = -1;

  constructor(private readonly h: MenuHandlers) {}

  get focused(): MenuItem | undefined {
    return this.items[this.focus];
  }

  /** Replaces the items, keeping focus on the same id when it still exists. */
  setItems(items: MenuItem[], focusId?: string): void {
    const keep = focusId ?? this.focused?.id;
    this.items = items;
    const i = keep === undefined ? -1 : items.findIndex((it) => it.id === keep);
    this.focus = i >= 0 ? i : Math.min(this.focus, Math.max(0, items.length - 1));
    this.pressed = -1;
  }

  focusId(id: string, notify = false): void {
    const i = this.items.findIndex((it) => it.id === id);
    if (i >= 0) this.setFocus(i, notify);
  }

  isFocused(id: string): boolean {
    return this.focused?.id === id;
  }

  isPressed(id: string): boolean {
    return this.pressed >= 0 && this.items[this.pressed]?.id === id;
  }

  nav(dx: number, dy: number): void {
    const cur = this.focused;
    if ((cur?.slider || cur?.adjustable) && dx !== 0 && dy === 0 && this.h.adjust) {
      this.h.adjust(cur, dx);
      return;
    }
    const next = navTarget(this.items, this.focus, dx, dy);
    if (next >= 0) this.setFocus(next, true);
  }

  confirm(): void {
    const cur = this.focused;
    if (cur) this.h.activate(cur);
  }

  pointer(e: ScenePointer): void {
    if (e.type === 'cancel') {
      if (e.id === this.pressedPointer) this.release();
      return;
    }
    const hit = hitTest(this.items, e.x, e.y);
    if (e.type === 'down') {
      if (hit < 0) return;
      this.setFocus(hit, true);
      this.pressed = hit;
      this.pressedPointer = e.id;
      const it = this.items[hit] as MenuItem;
      if (it.slider) this.h.drag?.(it, e.x, true);
      return;
    }
    if (e.type === 'move') {
      if (this.pressed >= 0) {
        if (e.id !== this.pressedPointer) return;
        const it = this.items[this.pressed] as MenuItem;
        if (it.slider) this.h.drag?.(it, e.x, false);
        return;
      }
      // Hover focus is a mouse-only affordance; touch has no hover.
      if (e.pointerType === 'mouse' && hit >= 0 && hit !== this.focus) this.setFocus(hit, true);
      return;
    }
    // up
    if (e.id !== this.pressedPointer || this.pressed < 0) return;
    const p = this.pressed;
    this.release();
    const it = this.items[p] as MenuItem;
    if (it.slider) return;
    if (hit === p) this.h.activate(it);
  }

  private release(): void {
    this.pressed = -1;
    this.pressedPointer = -1;
  }

  private setFocus(i: number, notify: boolean): void {
    if (i === this.focus) return;
    this.focus = i;
    const it = this.items[i];
    if (notify && it) this.h.moved?.(it);
  }
}
