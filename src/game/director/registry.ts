import type { DrawLayer, System, World } from '../../sim/world';

// Sector plug-in points owned by the director (T21). Sector folders
// (game/levels/<id>) register at module load; nothing here is per world, so
// per-world state belongs in the sector's own WeakMap<World, ...>.

export type LevelScriptArgs = Readonly<Record<string, number | string>>;

/** A bespoke timeline beat: `{ t, script: 'ionShoals.gauntlet', args }`. Runs once per firing. */
export type LevelScript = (w: World, args: LevelScriptArgs) => void;

const scripts = new Map<string, LevelScript>();
const systems = new Map<string, System[]>();
const layers = new Map<string, DrawLayer[]>();

const NO_ARGS: LevelScriptArgs = Object.freeze({});

/** Names are global: prefix them with the level id (`armada.podFromWreck`). A second, different fn throws. */
export function registerLevelScript(name: string, fn: LevelScript): void {
  const had = scripts.get(name);
  if (had !== undefined && had !== fn) throw new Error(`registerLevelScript: duplicate "${name}"`);
  scripts.set(name, fn);
}

/**
 * Runs a script. Unknown names throw in dev; in prod they return false (the
 * director logs them) so a typo can't crash a run.
 */
export function runLevelScript(w: World, name: string, args: LevelScriptArgs | undefined): boolean {
  const fn = scripts.get(name);
  if (fn === undefined) {
    if (import.meta.env.DEV) throw new Error(`Unknown level script "${name}"`);
    return false;
  }
  fn(w, args ?? NO_ARGS);
  return true;
}

function listFor<T>(m: Map<string, T[]>, levelId: string): T[] {
  let l = m.get(levelId);
  if (l === undefined) {
    l = [];
    m.set(levelId, l);
  }
  return l;
}

/**
 * A system the director runs every tick while `levelId` is the active level:
 * through the timeline, the boss fight and the outro (not under `?sandbox`).
 * It runs in the director's slot (after cleanup, before fx). Systems with
 * the same name for the same level throw.
 */
export function registerLevelSystem(levelId: string, system: System): void {
  const l = listFor(systems, levelId);
  if (l.includes(system)) return;
  if (l.some((s) => s.name === system.name))
    throw new Error(`registerLevelSystem: duplicate "${system.name}" for ${levelId}`);
  l.push(system);
}

/** The live list for a level (the director keeps the reference, so it never allocates per tick). */
export function levelSystems(levelId: string): readonly System[] {
  return listFor(systems, levelId);
}

/**
 * A draw layer GameScene adds while `levelId` is playing, sorted into the
 * usual z order (background 0 … HUD 100). For hulls, beams and setpieces
 * that belong to no single enemy.
 */
export function registerLevelLayer(levelId: string, layer: DrawLayer): void {
  const l = listFor(layers, levelId);
  if (l.includes(layer)) return;
  if (l.some((s) => s.name === layer.name))
    throw new Error(`registerLevelLayer: duplicate "${layer.name}" for ${levelId}`);
  l.push(layer);
}

export function levelLayers(levelId: string): readonly DrawLayer[] {
  return listFor(layers, levelId);
}
