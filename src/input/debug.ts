import type { Renderer } from '../gfx/renderer';
import type { MoveIntent } from '../sim/types';
import type { InputMode } from './input';
import type { StickState } from './stick';

const COLOR = '#f8d878';

function f(n: number): string {
  return (n < 0 ? '' : '+') + n.toFixed(2);
}

/** `?debug` readout of the MoveIntent and stick, below the T00 overlay lines. */
export function drawInputDebug(
  r: Renderer,
  mode: InputMode,
  intent: MoveIntent,
  stick: StickState,
): void {
  const oy = r.offsetY;
  r.offsetY = 0;
  const target =
    intent.targetX === null || intent.targetY === null
      ? '-'
      : `${intent.targetX.toFixed(0)},${intent.targetY.toFixed(0)}`;
  r.text(`IN ${mode} ${f(intent.x)} ${f(intent.y)} T ${target}`, 2, 38, { color: COLOR });
  if (stick.active) {
    r.text(
      `ST ${stick.baseX.toFixed(0)},${stick.baseY.toFixed(0)} K ${stick.knobX.toFixed(0)},${stick.knobY.toFixed(0)}`,
      2,
      47,
      { color: COLOR },
    );
  }
  r.offsetY = oy;
  // Cross at the mouse target, in playfield coords.
  if (intent.targetX !== null && intent.targetY !== null) {
    r.rect(intent.targetX - 3, intent.targetY, 7, 1, COLOR);
    r.rect(intent.targetX, intent.targetY - 3, 1, 7, COLOR);
  }
}
