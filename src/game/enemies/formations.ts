import { spawnEnemy, type EnemyOverrides } from '../../sim/spawn';
import type { World } from '../../sim/world';

export type FormationType = 'column' | 'v' | 'line' | 'stagger';

export interface FormationSpec {
  type: FormationType;
  enemyId: string;
  count: number;
  /** Lead member x (center for `line`). */
  x: number;
  /** Lead member y. Default -16 (just above the top edge). */
  y?: number;
  /** px between neighbours. */
  spacing: number;
  /** Seconds between member spawns (0 = all at once). Default 0. */
  delay?: number;
  /** Applied to every member; `formationId` is always overwritten. */
  overrides?: EnemyOverrides;
}

export const FORMATION_ENTRY_Y = -16;

/**
 * Member i's offset from the lead, written into `out`. column: straight up
 * the screen; line: centered horizontal row; v: leader at the tip, wings
 * trailing up-left/up-right; stagger: a zigzag column.
 */
export function formationOffset(
  type: FormationType,
  i: number,
  count: number,
  spacing: number,
  out: { x: number; y: number },
): void {
  switch (type) {
    case 'column':
      out.x = 0;
      out.y = -i * spacing;
      return;
    case 'line':
      out.x = (i - (count - 1) / 2) * spacing;
      out.y = 0;
      return;
    case 'v': {
      const k = Math.ceil(i / 2);
      out.x = (i % 2 === 1 ? -1 : 1) * k * spacing;
      out.y = -k * spacing * 0.8;
      return;
    }
    case 'stagger':
      out.x = (i % 2 === 0 ? -0.5 : 0.5) * spacing;
      out.y = -i * spacing;
      return;
  }
}

interface PendingSpawn {
  active: boolean;
  timer: number;
  defId: string;
  x: number;
  y: number;
  formationId: number;
  overrides: EnemyOverrides | undefined;
}

const MAX_PENDING = 128;
const pending = new WeakMap<World, PendingSpawn[]>();

function pendingTable(w: World): PendingSpawn[] {
  let t = pending.get(w);
  if (t === undefined) {
    t = [];
    for (let i = 0; i < MAX_PENDING; i++) {
      t.push({
        active: false,
        timer: 0,
        defId: '',
        x: 0,
        y: 0,
        formationId: -1,
        overrides: undefined,
      });
    }
    pending.set(w, t);
  }
  return t;
}

const memberO: EnemyOverrides = {};

function spawnMember(
  w: World,
  defId: string,
  x: number,
  y: number,
  formationId: number,
  o: EnemyOverrides | undefined,
): void {
  for (const k in memberO) delete memberO[k as keyof EnemyOverrides];
  if (o) Object.assign(memberO, o);
  memberO.formationId = formationId;
  if (spawnEnemy(w, defId, x, y, memberO) === null) memberLost(w, formationId);
}

// A member that never spawned can't be killed, so it leaves the count.
function memberLost(w: World, formationId: number): void {
  const f = w.run.formations.get(formationId);
  if (f === undefined) return;
  f.total--;
  f.alive--;
  if (f.total <= 0) w.run.formations.delete(formationId);
}

const off = { x: 0, y: 0 };

/**
 * Spawns a formation and registers it in `run.formations` (alive = total =
 * count, so a delayed member still counts). Clearing it by player kills
 * emits `formationCleared` (sim/damage). Returns the formation id, or -1 if
 * count <= 0.
 */
export function spawnFormation(w: World, spec: FormationSpec): number {
  const n = spec.count;
  if (n <= 0) return -1;
  const id = w.nextId();
  w.run.formations.set(id, { alive: n, total: n, broken: false });
  const y0 = spec.y ?? FORMATION_ENTRY_Y;
  const delay = spec.delay ?? 0;
  const table = delay > 0 ? pendingTable(w) : null;
  let slot = 0;
  for (let i = 0; i < n; i++) {
    formationOffset(spec.type, i, n, spec.spacing, off);
    const x = spec.x + off.x;
    const y = y0 + off.y;
    if (i === 0 || table === null) {
      spawnMember(w, spec.enemyId, x, y, id, spec.overrides);
      continue;
    }
    while (slot < MAX_PENDING && (table[slot] as PendingSpawn).active) slot++;
    if (slot >= MAX_PENDING) {
      memberLost(w, id);
      continue;
    }
    const p = table[slot] as PendingSpawn;
    p.active = true;
    p.timer = delay * i;
    p.defId = spec.enemyId;
    p.x = x;
    p.y = y;
    p.formationId = id;
    p.overrides = spec.overrides;
  }
  return id;
}

/** Spawns delayed formation members whose time has come. Called by the enemies system. */
export function tickFormationSpawns(w: World, dt: number): void {
  const t = pending.get(w);
  if (t === undefined) return;
  for (let i = 0; i < t.length; i++) {
    const p = t[i] as PendingSpawn;
    if (!p.active) continue;
    p.timer -= dt;
    if (p.timer > 0) continue;
    p.active = false;
    spawnMember(w, p.defId, p.x, p.y, p.formationId, p.overrides);
    p.overrides = undefined;
  }
}
