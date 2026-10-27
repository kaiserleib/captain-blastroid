// Timeline event executors. Each one spawns through the owning module's API.

import type {
  AnomalyEvent,
  FormationEvent,
  ScrollEvent,
  SpawnEvent,
  TimelineEvent,
} from '../../content/levels';
import { getSave, nextRescuablePilot } from '../../meta';
import { getTimelineAction } from '../../sim/hooks';
import { pinAnomaly, setScrollSpeed } from '../../sim/scroll';
import { spawnEnemy, type EnemyOverrides } from '../../sim/spawn';
import type { Anomaly } from '../../sim/types';
import type { World } from '../../sim/world';
import { spawnFormation } from '../enemies';
import { spawnBlackHole, spawnPulsar, type AnomalyPlacement } from '../obstacles';
import { cachePayload, spawnDrop, spawnEscapePod, spraySalvage } from '../pickups';
import { runLevelScript } from './registry';
import { logLine, type DirectorState } from './state';
import { DEFAULT_SPACING, eventKind, formationHalfWidth, resolveX } from './timeline';

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
/** The cache bursts upward, so it opens below the top edge or half of it leaves unseen. */
const CACHE_Y = 40;

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

/** The pilot this level's pod would carry now, or null when it would be a salvage cache. */
function podPilot(w: World, st: DirectorState): string | null {
  const pilot = nextRescuablePilot(getSave(), st.level.id);
  return pilot !== null && w.run.pilotsRescued.includes(pilot) ? null : pilot;
}

function firePod(w: World, st: DirectorState, xSpec: number | 'rand', hp: number): void {
  const x = resolveX(xSpec, w.rng, POD_HALF_WIDTH, w.width);
  const pilot = podPilot(w, st);
  if (pilot !== null) {
    spawnEscapePod(w, pilot, x, hp);
    logLine(st, `${fmt(st.t)} escapePod ${pilot} x=${fmt(x)}${hp > 1 ? ` hp=${hp}` : ''}`);
  } else if (hp > 1) {
    // An escort beat (pod with HP) still has something to escort: an armored cache pod.
    spawnEscapePod(w, cachePayload(st.level.podFallbackSalvage), x, hp);
    logLine(st, `${fmt(st.t)} cachePod x=${fmt(x)} hp=${hp}`);
  } else {
    // Everyone here is rescued: a salvage cache takes the pod's place.
    spraySalvage(w, x, CACHE_Y, st.level.podFallbackSalvage);
    logLine(st, `${fmt(st.t)} salvageCache x=${fmt(x)}`);
  }
}

const placement: Required<AnomalyPlacement> = { vx: 0, vy: 0, variant: '', phase: 0 };

function fireAnomaly(w: World, st: DirectorState, ev: AnomalyEvent): void {
  const x = resolveX(ev.x, w.rng, 0, w.width);
  placement.vx = ev.vx ?? 0;
  placement.vy = ev.vy ?? w.scrollSpeed;
  placement.variant = ev.variant ?? '';
  placement.phase = ev.phase ?? 0;
  const spawn = ev.kind === 'pulsar' ? spawnPulsar : spawnBlackHole;
  const a: Anomaly | null = spawn(w, x, ev.y ?? 0, placement);
  if (a !== null) {
    // The variant decides the core size, so the default y is set after spawning.
    if (ev.y === undefined) a.y = a.prevY = -a.r;
    // Boss arenas hold still: a fixed anomaly ignores later scroll changes.
    if (ev.vy === 0) pinAnomaly(a);
  }
  const v = ev.variant ? ` ${ev.variant}` : '';
  logLine(st, `${fmt(st.t)} anomaly ${ev.kind}${v} x=${fmt(x)}${a ? '' : ' (pool full)'}`);
}

/** Starts a linear ramp of `w.scrollSpeed` (the director advances it); `over` 0 is instant. */
export function startScrollRamp(w: World, st: DirectorState, ev: ScrollEvent): void {
  const r = st.scroll;
  r.from = w.scrollSpeed;
  r.to = ev.to;
  r.over = Math.max(0, ev.over);
  r.t = 0;
  r.active = r.over > 0;
  if (!r.active) setScrollSpeed(w, ev.to);
}

/** Advances the scroll ramp; runs every director tick in every phase. */
export function tickScrollRamp(w: World, st: DirectorState, dt: number): void {
  const r = st.scroll;
  if (!r.active) return;
  r.t += dt;
  const k = Math.min(1, r.t / r.over);
  setScrollSpeed(w, r.from + (r.to - r.from) * k);
  if (k >= 1) r.active = false;
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
    firePod(w, st, ev.escapePod.x, Math.max(1, Math.round(ev.escapePod.hp ?? 1)));
  } else if ('drop' in ev) {
    const d = ev.drop;
    const x = resolveX(d.x, w.rng, POD_HALF_WIDTH, w.width);
    spawnDrop(w, d.kind, x, -8, d.payload ?? '', d.amount ?? 0);
    logLine(st, `${fmt(st.t)} drop ${d.kind} x=${fmt(x)}`);
  } else if ('toast' in ev) {
    const text = ev.ifNoPod !== undefined && podPilot(w, st) === null ? ev.ifNoPod : ev.toast;
    emitToast(w, text);
    logLine(st, `${fmt(st.t)} toast ${text}`);
  } else if ('bossWarning' in ev) {
    w.events.emit('bossWarning', NO_PAYLOAD);
    logLine(st, `${fmt(st.t)} bossWarning`);
  } else if ('anomaly' in ev) {
    fireAnomaly(w, st, ev.anomaly);
  } else if ('scroll' in ev) {
    startScrollRamp(w, st, ev.scroll);
    logLine(st, `${fmt(st.t)} scroll ${fmt(ev.scroll.to)} over ${fmt(ev.scroll.over)}`);
  } else if ('script' in ev) {
    const ran = runLevelScript(w, ev.script, ev.args);
    logLine(st, `${fmt(st.t)} script ${ev.script}${ran ? '' : ' (unknown)'}`);
  } else if (!('boss' in ev)) {
    fireRegistered(w, st, ev);
  } else {
    // The boss module (T16) answers with bossSpawned; the field yields to its thrown rocks.
    st.phase = 'boss';
    stopField(st);
    bossP.defId = ev.boss;
    w.events.emit('bossRequested', bossP);
    logLine(st, `${fmt(st.t)} bossRequested ${ev.boss}`);
  }
}

const warnedKinds = new Set<string>();

/** Act II hazard events: the owning module registered a handler for the kind. */
function fireRegistered(w: World, st: DirectorState, ev: TimelineEvent): void {
  const kind = eventKind(ev);
  const fn = getTimelineAction(kind);
  if (fn === undefined) {
    // Sector stubs may run before the hazard module that owns the kind exists.
    if (!warnedKinds.has(kind)) {
      warnedKinds.add(kind);
      console.warn(`No timeline action registered for '${kind}'`);
    }
    logLine(st, `${fmt(st.t)} ${kind} (unregistered)`);
    return;
  }
  fn(w, (ev as unknown as Record<string, unknown>)[kind]);
  logLine(st, `${fmt(st.t)} ${kind}`);
}

export function stopField(st: DirectorState): void {
  st.fieldStopped = true;
  for (let i = 0; i < st.streams.length; i++) {
    st.streams[i]?.stop();
    st.streams[i] = null;
  }
}
