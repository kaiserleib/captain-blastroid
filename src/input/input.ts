import { flags } from '../debug/flags';
import type { Point } from '../engine/display';
import type { NoPayload } from '../engine/events';
import { clamp } from '../engine/math';
import type { ScenePointer } from '../engine/scene';
import type { Renderer } from '../gfx/renderer';
import type { MoveIntent } from '../sim/types';
import { WORLD_H, WORLD_W, type DrawLayer, type System, type World } from '../sim/world';
import { drawInputDebug } from './debug';
import { arrowNav, keyAction, KeyState } from './keyboard';
import type { InputSink, PointerMapper, PointerPhase } from './pointer';
import { getInputSettings } from './settings';
import {
  createStick,
  drawStick,
  STICK_DEADZONE_CSS,
  STICK_EDGE_INSET_CSS,
  STICK_RADIUS_CSS,
  stickDown,
  stickMove,
  stickRelease,
  type StickState,
} from './stick';

export type InputMode = 'keys' | 'mouse' | 'touch';

export type UiEvent =
  { kind: 'pause' } | { kind: 'confirm' } | { kind: 'nav'; dx: number; dy: number };

const NO_PAYLOAD: NoPayload = {};
const UI_PAUSE: UiEvent = { kind: 'pause' };
const UI_CONFIRM: UiEvent = { kind: 'confirm' };

/** Used until `attach()` provides the display mapping: identity, no HUD band. */
const IDENTITY_MAPPER: PointerMapper = {
  toLogical: (x, y, out) => {
    out.x = x;
    out.y = y;
    return out;
  },
  playfieldOffsetY: () => 0,
  cssLength: (px) => px,
};

/**
 * Turns keyboard, mouse/trackpad and touch into one MoveIntent per tick. The
 * mode follows whichever device was used last. DOM-free: `bindDom` (pointer.ts)
 * feeds it, and tests call the handlers directly.
 */
export class InputManager implements InputSink {
  mode: InputMode = 'keys';
  readonly stick: StickState = createStick();
  /** Every pointer, in logical buffer coords. The object is reused: copy what you keep. */
  onPointer: ((e: ScenePointer) => void) | null = null;
  /** Menu keys: pause (Esc/P), confirm (Enter/Space), nav (arrows, repeats while held). */
  onUi: ((e: UiEvent) => void) | null = null;

  private mapper: PointerMapper = IDENTITY_MAPPER;
  private readonly keys = new KeyState();
  private mouseOver = false;
  private mouseX = 0;
  private mouseY = 0;
  private lastMouseClientX = NaN;
  private lastMouseClientY = NaN;
  private pausePending = false;
  private readonly pt: Point = { x: 0, y: 0 };
  private readonly scenePt: ScenePointer = {
    type: 'move',
    id: 0,
    pointerType: '',
    x: 0,
    y: 0,
  };
  private readonly navDir = { x: 0, y: 0 };
  private readonly nav = { kind: 'nav' as const, dx: 0, dy: 0 };

  setMapper(mapper: PointerMapper): void {
    this.mapper = mapper;
  }

  /** Full-deflection radius in logical px (40 CSS px x the settings scale). */
  get stickRadius(): number {
    return this.mapper.cssLength(STICK_RADIUS_CSS * getInputSettings().stickRadiusScale);
  }

  get stickDeadzone(): number {
    return this.mapper.cssLength(STICK_DEADZONE_CSS);
  }

  handlePointer(
    type: PointerPhase,
    id: number,
    pointerType: string,
    clientX: number,
    clientY: number,
  ): boolean {
    const p = this.mapper.toLogical(clientX, clientY, this.pt);
    const py = p.y - this.mapper.playfieldOffsetY();
    let capture = false;

    if (pointerType === 'mouse') {
      if (type === 'up' || type === 'cancel') {
        // Releasing a button doesn't take the mouse off the canvas.
      } else {
        // Some browsers fire a zero-distance pointermove (e.g. on scroll or layout);
        // that mustn't steal control back from the keys.
        const moved = clientX !== this.lastMouseClientX || clientY !== this.lastMouseClientY;
        this.lastMouseClientX = clientX;
        this.lastMouseClientY = clientY;
        this.mouseOver = true;
        this.mouseX = clamp(p.x, 0, WORLD_W);
        this.mouseY = clamp(py, 0, WORLD_H);
        if (moved || type === 'down') this.mode = 'mouse';
      }
    } else {
      const s = this.stick;
      if (type === 'down') {
        // Secondary touches only reach the UI while a stick finger is down.
        if (!s.active) {
          const inset = this.mapper.cssLength(STICK_EDGE_INSET_CSS);
          stickDown(s, id, clamp(p.x, inset, WORLD_W - inset), py);
          this.mode = 'touch';
          capture = true;
        }
      } else if (s.active && id === s.pointerId) {
        if (type === 'move') stickMove(s, p.x, py, this.stickRadius, this.stickDeadzone);
        else stickRelease(s);
      }
    }

    if (this.onPointer) {
      const e = this.scenePt;
      e.type = type;
      e.id = id;
      e.pointerType = pointerType;
      e.x = p.x;
      e.y = p.y;
      this.onPointer(e);
    }
    return capture;
  }

  handleMouseLeave(): void {
    this.mouseOver = false;
  }

  handleKey(code: string, down: boolean, repeat: boolean): boolean {
    const action = keyAction(code);
    if (action === null) return false;
    if (action === 'move') {
      this.keys.set(code, down);
      if (down) this.mode = 'keys';
      if (down && this.onUi && arrowNav(code, this.navDir)) {
        this.nav.dx = this.navDir.x;
        this.nav.dy = this.navDir.y;
        this.onUi(this.nav);
      }
      return true;
    }
    if (down && !repeat) {
      if (action === 'pause') {
        this.pausePending = true;
        this.onUi?.(UI_PAUSE);
      } else {
        this.onUi?.(UI_CONFIRM);
      }
    }
    return true;
  }

  /** Drops held keys, the stick and mouse hover, so nothing sticks after blur or backgrounding. */
  clear(): void {
    this.keys.clear();
    stickRelease(this.stick);
    this.mouseOver = false;
    this.pausePending = false;
  }

  /** Cancels the stick, e.g. when a UI widget claims the touch that spawned it. */
  releaseStick(): void {
    stickRelease(this.stick);
  }

  writeIntent(out: MoveIntent): void {
    out.targetX = null;
    out.targetY = null;
    if (this.mode === 'keys') {
      this.keys.vector(out);
    } else if (this.mode === 'mouse') {
      out.x = out.y = 0;
      if (this.mouseOver) {
        out.targetX = this.mouseX;
        out.targetY = this.mouseY;
      }
    } else {
      out.x = this.stick.x;
      out.y = this.stick.y;
    }
  }

  /** True once per Esc/P press, if a tick consumes it before `endTick()`. */
  consumePause(): boolean {
    const p = this.pausePending;
    this.pausePending = false;
    return p;
  }

  /**
   * Called after each sim tick. Drops an unconsumed pause so a press made while a
   * menu was on top doesn't re-pause the game the moment it resumes.
   */
  endTick(): void {
    this.pausePending = false;
  }

  /** Whether a movement key is held (for tests and debug). */
  get keysHeld(): boolean {
    return this.keys.anyHeld;
  }

  /** First in GameScene's system order: writes `world.input`, emits `pauseRequested`. */
  readonly system: System = {
    name: 'input',
    update: (w: World) => {
      this.writeIntent(w.input);
      if (this.consumePause()) w.events.emit('pauseRequested', NO_PAYLOAD);
    },
  };

  readonly stickLayer: DrawLayer = {
    name: 'stick',
    z: 95,
    draw: (w: World, r: Renderer) => {
      drawStick(r, this.stick, this.stickRadius, getInputSettings().stickOpacity);
      if (flags.debug) drawInputDebug(r, this.mode, w.input, this.stick);
    },
  };
}
