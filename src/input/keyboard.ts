const SQRT1_2 = Math.SQRT1_2;

function has(list: readonly string[], code: string): boolean {
  return list.includes(code);
}

export const KEYS_LEFT = ['ArrowLeft', 'KeyA'] as const;
export const KEYS_RIGHT = ['ArrowRight', 'KeyD'] as const;
export const KEYS_UP = ['ArrowUp', 'KeyW'] as const;
export const KEYS_DOWN = ['ArrowDown', 'KeyS'] as const;
export const KEYS_PAUSE = ['Escape', 'KeyP'] as const;
export const KEYS_CONFIRM = ['Enter', 'NumpadEnter', 'Space'] as const;

export type KeyAction = 'move' | 'pause' | 'confirm' | null;

/** Classifies a `KeyboardEvent.code`. Codes, not keys, so WASD works on any layout. */
export function keyAction(code: string): KeyAction {
  if (isMoveKey(code)) return 'move';
  if (has(KEYS_PAUSE, code)) return 'pause';
  if (has(KEYS_CONFIRM, code)) return 'confirm';
  return null;
}

export function isMoveKey(code: string): boolean {
  return (
    has(KEYS_LEFT, code) || has(KEYS_RIGHT, code) || has(KEYS_UP, code) || has(KEYS_DOWN, code)
  );
}

/** -1, 0 or 1 for an arrow key (UI navigation); WASD is excluded so typing never navigates. */
export function arrowNav(code: string, out: { x: number; y: number }): boolean {
  out.x = code === 'ArrowLeft' ? -1 : code === 'ArrowRight' ? 1 : 0;
  out.y = code === 'ArrowUp' ? -1 : code === 'ArrowDown' ? 1 : 0;
  return out.x !== 0 || out.y !== 0;
}

/** Tracks held movement keys. Opposing keys cancel; diagonals are normalized. */
export class KeyState {
  private l = 0;
  private r = 0;
  private u = 0;
  private d = 0;

  set(code: string, down: boolean): void {
    const b = bit(code);
    if (has(KEYS_LEFT, code)) this.l = down ? this.l | b : this.l & ~b;
    else if (has(KEYS_RIGHT, code)) this.r = down ? this.r | b : this.r & ~b;
    else if (has(KEYS_UP, code)) this.u = down ? this.u | b : this.u & ~b;
    else if (has(KEYS_DOWN, code)) this.d = down ? this.d | b : this.d & ~b;
  }

  clear(): void {
    this.l = this.r = this.u = this.d = 0;
  }

  get anyHeld(): boolean {
    return (this.l | this.r | this.u | this.d) !== 0;
  }

  vector(out: { x: number; y: number }): void {
    keyVector(this.l !== 0, this.r !== 0, this.u !== 0, this.d !== 0, out);
  }
}

// Arrow and letter for the same direction are tracked separately, so releasing one
// while the other is held doesn't stop the ship.
function bit(code: string): number {
  return code.startsWith('Arrow') ? 1 : 2;
}

export function keyVector(
  left: boolean,
  right: boolean,
  up: boolean,
  down: boolean,
  out: { x: number; y: number },
): void {
  const x = (right ? 1 : 0) - (left ? 1 : 0);
  const y = (down ? 1 : 0) - (up ? 1 : 0);
  const k = x !== 0 && y !== 0 ? SQRT1_2 : 1;
  out.x = x * k;
  out.y = y * k;
}
