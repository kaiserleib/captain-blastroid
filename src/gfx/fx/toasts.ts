import { measure } from '../font';
import { UI } from '../palette';
import type { Renderer, TextOpts } from '../renderer';
import { drawWindow } from '../ui';

export const TOAST_TIME = 1.2;
export const TOAST_SLIDE = 0.15;
export const TOAST_MAX_VISIBLE = 2;
const QUEUE_MAX = 8;
const TOAST_H = 17;
const TOAST_GAP = 3;
const TOAST_Y = 136;
const TEXT_OPTS: TextOpts = { font: 'ui', color: UI.text, align: 'center' };

interface Slot {
  text: string;
  w: number;
  t: number;
  active: boolean;
}

/** Center-screen SNES-window messages: at most 2 on screen, the rest queue. */
export class Toasts {
  readonly slots: Slot[] = [];
  private readonly queue: string[] = [];

  constructor() {
    for (let i = 0; i < TOAST_MAX_VISIBLE; i++) {
      this.slots.push({ text: '', w: 0, t: 0, active: false });
    }
  }

  get queued(): number {
    return this.queue.length;
  }

  get visible(): number {
    let n = 0;
    for (const s of this.slots) if (s.active) n++;
    return n;
  }

  push(text: string): void {
    if (!text) return;
    // Under a flood, the oldest waiting message is the least relevant.
    if (this.queue.length >= QUEUE_MAX) this.queue.shift();
    this.queue.push(text);
    this.fill();
  }

  update(dt: number): void {
    for (const s of this.slots) {
      if (!s.active) continue;
      s.t += dt;
      if (s.t >= TOAST_TIME) s.active = false;
    }
    this.fill();
  }

  draw(r: Renderer, playfieldW: number): void {
    const cx = playfieldW / 2;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i] as Slot;
      if (!s.active) continue;
      let x = cx - s.w / 2;
      // Slide in from the left, out to the right, eased so it snaps into place.
      if (s.t < TOAST_SLIDE) {
        const k = 1 - s.t / TOAST_SLIDE;
        x -= (cx + s.w / 2) * k * k;
      } else if (s.t > TOAST_TIME - TOAST_SLIDE) {
        const k = (s.t - (TOAST_TIME - TOAST_SLIDE)) / TOAST_SLIDE;
        x += (cx + s.w / 2) * k * k;
      }
      const y = TOAST_Y + i * (TOAST_H + TOAST_GAP);
      drawWindow(r, x, y, s.w, TOAST_H);
      r.text(s.text, Math.round(x + s.w / 2), y + 4, TEXT_OPTS);
    }
  }

  clear(): void {
    this.queue.length = 0;
    for (const s of this.slots) s.active = false;
  }

  private fill(): void {
    for (const s of this.slots) {
      if (s.active) continue;
      const text = this.queue.shift();
      if (text === undefined) return;
      s.text = text;
      s.w = measure(text, 'ui') + 14;
      s.t = 0;
      s.active = true;
    }
  }
}
