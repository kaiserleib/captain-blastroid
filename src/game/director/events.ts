// Timeline event executors. Each one spawns through the owning module's API.

import type { FormationEvent, SpawnEvent, TimelineEvent } from '../../content/levels';
import { getSave, nextRescuablePilot } from '../../meta';
import { spawnEnemy, type EnemyOverrides } from '../../sim/spawn';
import type { World } from '../../sim/world';
import { spawnFormation } from '../enemies';
import { spawnDrop, spawnEscapePod, spraySalvage } from '../pickups';
import { logLine, type DirectorState } from './state';
import { DEFAULT_SPACING, formationHalfWidth, resolveX } from './timeline';

const toastP = { text: '' };
const bossP = { defId: '' };
const NO_PAYLOAD = Object.freeze({}) as Record<string, never>;

/** Side entries sit just outside the edge (inside cleanup's margin). */
const SIDE_X = 18;
const CORNER_X = 8;
const ENTRY_Y = -16;
const DEFAULT_SIDE_Y = 90;
/** Pods and drops stay away from the edges so they're reachable. */
const POD_HALF_WIDTH = 24;

function fmt(n: number): string {
  return n.toFixed(1);
}

function fireFormation(
  w: World,
  st: DirectorState,
  f: FormationEvent,
  forceCapsule: string | undefined,
): void {
  const x = resolveX(f.x, w.rng, formationHalfWidth(f), w.width);
  const id = spawnFormation(w, {
    type: f.type,
    enemyId: f.enemy,
    count: f.count,
    x,
    spacing: f.spacing ?? DEFAULT_SPACING[f.type],
    delay: f.delay,
    overrides: f.overrides,
  });
  if (forceCapsule && id >= 0) st.forced.set(id, forceCapsule);
  logLine(st, `${fmt(st.t)} formation ${f.type} ${f.enemy}x${f.count} x=${fmt(x)}`);
}

const spawnO: EnemyOverrides = {};

function fireSpawn(w: World, st: DirectorState, s: SpawnEvent): void {
  let x: number;
  let y = ENTRY_Y;
  switch (s.from ?? 'top') {
    case 'left':
      x = -SIDE_X;
      y = s.y ?? DEFAULT_SIDE_Y;
      break;
    case 'right':
      x = w.width + SIDE_X;
      y = s.y ?? DEFAULT_SIDE_Y;
      break;
    case 'topLeft':
      x = -CORNER_X;
      y = -CORNER_X;
      break;
    case 'topRight':
      x = w.width + CORNER_X;
      y = -CORNER_X;
      break;
    default:
      x = resolveX(s.x ?? 'rand', w.rng, 0, w.width);
  }
  for (const k in spawnO) delete spawnO[k as keyof EnemyOverrides];
  if (s.overrides) Object.assign(spawnO, s.overrides);
  const e = spawnEnemy(w, s.enemy, x, y, spawnO);
  logLine(st, `${fmt(st.t)} spawn ${s.enemy} x=${fmt(x)} y=${fmt(y)}${e ? '' : ' (pool full)'}`);
}

function firePod(w: World, st: DirectorState, xSpec: number | 'rand'): void {
  const x = resolveX(xSpec, w.rng, POD_HALF_WIDTH, w.width);
  let pilot = nextRescuablePilot(getSave(), st.level.id);
  if (pilot !== null && w.run.pilotsRescued.includes(pilot)) pilot = null;
  if (pilot !== null) {
    spawnEscapePod(w, pilot, x);
    logLine(st, `${fmt(st.t)} escapePod ${pilot} x=${fmt(x)}`);
  } else {
    // Everyone here is rescued: a salvage cache takes the pod's place.
    spraySalvage(w, x, 0, st.level.podFallbackSalvage);
    logLine(st, `${fmt(st.t)} salvageCache x=${fmt(x)}`);
  }
}

export function emitToast(w: World, text: string): void {
  toastP.text = text;
  w.events.emit('toast', toastP);
}

/** Runs one timeline event. Boss events change the director phase. */
export function fireEvent(w: World, st: DirectorState, ev: TimelineEvent): void {
  if ('formation' in ev) {
    fireFormation(w, st, ev.formation, ev.forceCapsule);
  } else if ('spawn' in ev) {
    fireSpawn(w, st, ev.spawn);
  } else if ('escapePod' in ev) {
    firePod(w, st, ev.escapePod.x);
  } else if ('drop' in ev) {
    const d = ev.drop;
    const x = resolveX(d.x, w.rng, POD_HALF_WIDTH, w.width);
    spawnDrop(w, d.kind, x, -8, d.payload ?? '', d.amount ?? 0);
    logLine(st, `${fmt(st.t)} drop ${d.kind} x=${fmt(x)}`);
  } else if ('toast' in ev) {
    emitToast(w, ev.toast);
    logLine(st, `${fmt(st.t)} toast ${ev.toast}`);
  } else if ('bossWarning' in ev) {
    w.events.emit('bossWarning', NO_PAYLOAD);
    logLine(st, `${fmt(st.t)} bossWarning`);
  } else {
    // The boss module (T16) answers with bossSpawned; the field yields to its thrown rocks.
    st.phase = 'boss';
    stopField(st);
    bossP.defId = ev.boss;
    w.events.emit('bossRequested', bossP);
    logLine(st, `${fmt(st.t)} bossRequested ${ev.boss}`);
  }
}

export function stopField(st: DirectorState): void {
  st.fieldStopped = true;
  for (let i = 0; i < st.streams.length; i++) {
    st.streams[i]?.stop();
    st.streams[i] = null;
  }
}
