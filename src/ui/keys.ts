// WASD menu navigation. T01's InputManager only navigates with arrows (so typing can't
// navigate); the game has no text fields, so menus also accept WASD here.

const WASD: Readonly<Record<string, readonly [number, number]>> = {
  KeyW: [0, -1],
  KeyA: [-1, 0],
  KeyS: [0, 1],
  KeyD: [1, 0],
};

/** Direction for a WASD `KeyboardEvent.code`, or null. */
export function wasdNav(code: string): readonly [number, number] | null {
  return WASD[code] ?? null;
}

/** Calls `nav` on WASD key-downs (repeats included). Returns a detach function. */
export function bindWasdNav(nav: (dx: number, dy: number) => void): () => void {
  const onKey = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const d = wasdNav(e.code);
    if (d) nav(d[0], d[1]);
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
