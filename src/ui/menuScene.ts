import { playSfx } from '../audio';
import { Background } from '../backgrounds';
import type { Scene, ScenePointer } from '../engine/scene';
import type { Renderer } from '../gfx/renderer';
import { input, type UiEvent } from '../input';
import { Menu, type MenuItem } from './menu';

// One backdrop shared by every menu screen, so the starfield doesn't jump between them.
const backdrop = new Background('title', 'HANGAR');
let backdropTime = 0;

export function drawBackdrop(r: Renderer): void {
  backdrop.draw(r.ctx, backdropTime * backdrop.theme.scrollSpeed, backdropTime, r.height);
}

/** Scenes that take menu keys; main.ts routes `input.onUi` and WASD to the top scene. */
export interface UiScene extends Scene {
  onUi(e: UiEvent): void;
}

export function isUiScene(s: Scene | undefined): s is UiScene {
  return !!s && typeof (s as Partial<UiScene>).onUi === 'function';
}

export function sfx(id: 'ui_move' | 'ui_confirm' | 'ui_back' | string): void {
  playSfx(id);
}

/**
 * Base for menu screens and overlays: drawn in buffer coordinates (no playfield offset,
 * no shake), laid out whenever the buffer height changes, and driven by a `Menu`.
 * Scene changes go through `later()` so they run in update(), never inside an input
 * handler: that keeps a key press from also reaching the scene underneath.
 */
export abstract class MenuScene implements UiScene {
  protected t = 0;
  protected width = 240;
  protected height = 0;
  /** Full-screen menus draw the shared starfield; overlays draw over the scene below. */
  protected drawsBackdrop = true;
  protected readonly menu: Menu;
  private next: (() => void) | null = null;

  constructor() {
    this.menu = new Menu({
      activate: (it) => this.activate(it),
      adjust: (it, dx) => this.adjust(it, dx),
      drag: (it, x, first) => this.drag(it, x, first),
      moved: () => sfx('ui_move'),
    });
  }

  enter(_data?: unknown): void {}
  exit(): void {}

  update(dt: number): void {
    this.t += dt;
    backdropTime += dt;
    this.tick(dt);
    const n = this.next;
    if (n) {
      this.next = null;
      n();
    }
  }

  render(r: Renderer): void {
    const oy = r.offsetY;
    const sx = r.shakeX;
    const sy = r.shakeY;
    r.offsetY = 0;
    r.shakeX = 0;
    r.shakeY = 0;
    if (r.height !== this.height || r.width !== this.width) {
      this.width = r.width;
      this.height = r.height;
      this.layout(r.width, r.height);
    }
    if (this.drawsBackdrop) drawBackdrop(r);
    this.draw(r);
    r.offsetY = oy;
    r.shakeX = sx;
    r.shakeY = sy;
  }

  onPointer(e: ScenePointer): void {
    // A touch on a menu also spawned the virtual stick; it must not carry into a run.
    if (e.type === 'down' && e.pointerType !== 'mouse') input.releaseStick();
    this.menu.pointer(e);
  }

  onUi(e: UiEvent): void {
    if (e.kind === 'pause') this.back();
    else if (e.kind === 'confirm') this.menu.confirm();
    else this.nav(e.dx, e.dy);
  }

  /** Re-runs layout on the next frame (after state that changes the item set). */
  protected relayout(): void {
    this.height = 0;
  }

  /** Runs `fn` at the end of this scene's next update. */
  protected later(fn: () => void): void {
    this.next = fn;
  }

  protected nav(dx: number, dy: number): void {
    this.menu.nav(dx, dy);
  }

  protected tick(_dt: number): void {}
  protected back(): void {}
  protected adjust(_it: MenuItem, _dx: number): void {}
  protected drag(_it: MenuItem, _x: number, _first: boolean): void {}

  protected abstract layout(w: number, h: number): void;
  protected abstract draw(r: Renderer): void;
  protected abstract activate(it: MenuItem): void;

  protected button(
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    slider = false,
  ): MenuItem {
    return slider ? { id, x, y, w, h, slider } : { id, x, y, w, h };
  }

  protected focused(id: string): boolean {
    return this.menu.isFocused(id);
  }

  protected pressed(id: string): boolean {
    return this.menu.isPressed(id);
  }
}
