export interface DebugFlags {
  /** FPS, tick time, entity counts, hitboxes. */
  readonly debug: boolean;
  readonly god: boolean;
  readonly sandbox: boolean;
  readonly seed: string | null;
  readonly level: number | null;
  /** Skip to this many seconds into the level. */
  readonly t: number | null;
}

function num(v: string | null): number | null {
  if (v === null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Cheat flags work only in dev builds; `?seed=` is allowed everywhere so runs can be shared. */
export function parseFlags(search: string, dev: boolean): DebugFlags {
  const q = new URLSearchParams(search);
  const seed = q.get('seed');
  return Object.freeze({
    debug: dev && q.has('debug'),
    god: dev && q.has('god'),
    sandbox: dev && q.has('sandbox'),
    seed: seed ? seed : null,
    level: dev ? num(q.get('level')) : null,
    t: dev ? num(q.get('t')) : null,
  });
}

export const flags: DebugFlags = parseFlags(
  typeof location === 'undefined' ? '' : location.search,
  import.meta.env.DEV,
);
