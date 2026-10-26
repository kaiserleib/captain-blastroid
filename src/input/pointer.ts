import type { Display, Point } from '../engine/display';

/** Screen -> logical mapping, abstracted so InputManager runs in tests without a DOM. */
export interface PointerMapper {
  /** Client (CSS) px -> logical buffer px. */
  toLogical(clientX: number, clientY: number, out: Point): Point;
  /** Top HUD band height; logical y minus this is playfield y. */
  playfieldOffsetY(): number;
  /** A CSS px length -> logical px. */
  cssLength(cssPx: number): number;
}

export function displayMapper(display: Display): PointerMapper {
  return {
    toLogical: (x, y, out) => display.screenToLogical(x, y, out),
    playfieldOffsetY: () => display.layout.playfieldOffsetY,
    cssLength: (cssPx) => cssLengthToLogical(display.layout, cssPx),
  };
}

export function cssLengthToLogical(
  layout: { dpr: number; logicalW: number; destW: number },
  cssPx: number,
): number {
  return (cssPx * layout.dpr * layout.logicalW) / layout.destW;
}

export type PointerPhase = 'down' | 'move' | 'up' | 'cancel';

export interface InputSink {
  /** Returns true when the pointer should be captured (it became the stick finger). */
  handlePointer(
    type: PointerPhase,
    id: number,
    pointerType: string,
    clientX: number,
    clientY: number,
  ): boolean;
  handleMouseLeave(): void;
  /** Returns true when the key was used, so the page default (scrolling) is suppressed. */
  handleKey(code: string, down: boolean, repeat: boolean): boolean;
  clear(): void;
}

/** Pointer Events on the canvas plus keys and lifecycle on the window. Returns a detach function. */
export function bindDom(canvas: HTMLCanvasElement, sink: InputSink): () => void {
  const down = (e: PointerEvent): void => {
    if (sink.handlePointer('down', e.pointerId, e.pointerType, e.clientX, e.clientY)) {
      // Capture keeps the stick finger's moves and up coming even if it slides off the canvas.
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // The pointer can already be gone after a very short tap.
      }
    }
    if (e.pointerType !== 'mouse') e.preventDefault();
  };
  const move = (e: PointerEvent): void => {
    sink.handlePointer('move', e.pointerId, e.pointerType, e.clientX, e.clientY);
  };
  const up = (e: PointerEvent): void => {
    sink.handlePointer('up', e.pointerId, e.pointerType, e.clientX, e.clientY);
  };
  const cancel = (e: PointerEvent): void => {
    sink.handlePointer('cancel', e.pointerId, e.pointerType, e.clientX, e.clientY);
  };
  const leave = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') sink.handleMouseLeave();
  };
  const key = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (sink.handleKey(e.code, e.type === 'keydown', e.repeat)) e.preventDefault();
  };
  const clear = (): void => sink.clear();
  const visibility = (): void => {
    if (document.visibilityState === 'hidden') sink.clear();
  };
  // Older iOS Safari still pinch-zooms despite touch-action and user-scalable=no.
  const gesture = (e: Event): void => e.preventDefault();

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('pointerleave', leave);
  window.addEventListener('keydown', key);
  window.addEventListener('keyup', key);
  window.addEventListener('blur', clear);
  window.addEventListener('pagehide', clear);
  document.addEventListener('visibilitychange', visibility);
  document.addEventListener('gesturestart', gesture);

  return () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', cancel);
    canvas.removeEventListener('pointerleave', leave);
    window.removeEventListener('keydown', key);
    window.removeEventListener('keyup', key);
    window.removeEventListener('blur', clear);
    window.removeEventListener('pagehide', clear);
    document.removeEventListener('visibilitychange', visibility);
    document.removeEventListener('gesturestart', gesture);
  };
}
