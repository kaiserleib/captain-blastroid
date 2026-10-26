import { UI } from '../palette';
import type { Renderer, TextOpts } from '../renderer';

const POPUP_CAPACITY = 24;
const POPUP_TIME = 0.7;
const POPUP_RISE = 18;
const TEXT_OPTS: TextOpts = { font: 'small', color: UI.textGold, align: 'center' };

interface Popup {
  x: number;
  y: number;
  t: number;
  text: string;
  active: boolean;
}

/** Chain-kill score numbers floating up from the kill. */
export class ScorePopups {
  readonly items: Popup[] = [];

  constructor() {
    for (let i = 0; i < POPUP_CAPACITY; i++) {
      this.items.push({ x: 0, y: 0, t: 0, text: '', active: false });
    }
  }

  get count(): number {
    let n = 0;
    for (const p of this.items) if (p.active) n++;
    return n;
  }

  spawn(x: number, y: number, value: number): void {
    // When full, recycle the oldest so the newest kill always shows.
    let slot: Popup | undefined;
    let oldest: Popup | undefined;
    for (const p of this.items) {
      if (!p.active) {
        slot = p;
        break;
      }
      if (!oldest || p.t > oldest.t) oldest = p;
    }
    slot ??= oldest;
    if (!slot) return;
    slot.x = x;
    slot.y = y;
    slot.t = 0;
    slot.text = String(value);
    slot.active = true;
  }

  update(dt: number): void {
    for (const p of this.items) {
      if (!p.active) continue;
      p.t += dt;
      if (p.t >= POPUP_TIME) p.active = false;
    }
  }

  draw(r: Renderer, tick: number): void {
    for (const p of this.items) {
      if (!p.active) continue;
      const k = p.t / POPUP_TIME;
      if (k > 0.7 && (tick & 2) !== 0) continue;
      // Fast pop up, then hang.
      const rise = POPUP_RISE * (1 - (1 - k) * (1 - k));
      r.text(p.text, p.x, p.y - 4 - rise, TEXT_OPTS);
    }
  }

  clear(): void {
    for (const p of this.items) p.active = false;
  }
}
