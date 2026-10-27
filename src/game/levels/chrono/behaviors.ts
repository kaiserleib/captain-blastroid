import { BUBBLE_MINE_P } from '../../../content/levels/chrono';
import { damageEnemy } from '../../../sim/damage';
import type { Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { canFire, emitEnemyShotSfx, ring } from '../../enemies';
import { spawnBubble } from '../../obstacles';
import {
  chronoState,
  claimRecorder,
  pushSample,
  recorderOf,
  REC_SAMPLES,
  sampleIndex,
  type Recorder,
} from './state';

// Custom behaviors for the Chrono Rift roster. Each owns e.vx/e.vy (desired
// velocity; the enemy system integrates), e.state (0 = first tick) and the
// e.ax/e.ay scratch, and reads e.t (seconds alive before this tick). The enemy
// system hands them the bubble-scaled dt, so every timer here runs at the
// rate of the bubble the enemy is in.

type P = Readonly<Record<string, number>>;

const SFX_P = { id: '', x: 0 as number | undefined };

function sfx(w: World, id: string, x: number): void {
  SFX_P.id = id;
  SFX_P.x = x;
  w.events.emit('sfx', SFX_P);
}

// ---------------------------------------------------------------------------
// Stutterer: bursts down for `burst` s, freezes for `freeze` s; every
// `ringEvery`-th freeze opens with a 4-shot cross ring. ax = seconds into the
// current half, ay = freezes so far.

export const STUTTER_MOVE = 1;
export const STUTTER_FROZEN = 2;

export function stutter(w: World, e: Enemy, p: P, dt: number): void {
  if (e.state === 0) {
    e.state = STUTTER_MOVE;
    e.ax = 0;
    e.ay = 0;
  }
  e.ax += dt;
  if (e.state === STUTTER_MOVE) {
    if (e.ax >= (p.burst as number)) {
      e.ax -= p.burst as number;
      e.state = STUTTER_FROZEN;
      e.ay++;
      if (e.ay % (p.ringEvery as number) === 0 && canFire(w, e)) {
        const n = ring(w, e.x, e.y, p.ringN as number, p.ringSpeed as number, p.ringRot as number);
        if (n > 0) {
          emitEnemyShotSfx(w, e.x);
          chronoState(w).stutterRings++;
        }
      }
    }
  } else if (e.ax >= (p.freeze as number)) {
    e.ax -= p.freeze as number;
    e.state = STUTTER_MOVE;
  }
  e.vx = 0;
  e.vy = e.state === STUTTER_MOVE ? (p.speed as number) : 0;
}

/** The next freeze fires the cross (drawn as charged ports while it moves there). */
export function stutterCharged(e: Enemy, ringEvery: number): boolean {
  return (e.ay + 1) % ringEvery === 0;
}

// ---------------------------------------------------------------------------
// Rewinder: shadows the player's x while descending (the Interceptor's
// movement), recording (x, y, HP) every `sample` s. The first time HP drops
// below `threshold` of max, the clock telegraph runs for `warn` s; if it
// survives, it snaps back to its position and HP from `record` s before that
// moment. ax = x offset, ay = recorder index.

export const REWIND_RECORD = 1;
export const REWIND_WARN = 2;
export const REWIND_SPENT = 3;

export function rewind(w: World, e: Enemy, p: P, dt: number): void {
  if (e.state === 0) {
    e.ax = ((e.id % 3) - 1) * (p.spread as number);
    e.ay = claimRecorder(w, e);
    e.state = REWIND_RECORD;
    const r0 = recorderOf(w, e, e.ay);
    if (r0 !== null) pushSample(r0, e.x, e.y, e.hp);
  }
  const pl = w.player;
  const want = (pl.x + e.ax - e.x) * (p.lag as number);
  const max = p.maxVx as number;
  e.vx = want > max ? max : want < -max ? -max : want;
  e.vy = p.descend as number;
  const r = e.ay >= 0 ? recorderOf(w, e, e.ay) : null;
  if (r === null) return;
  record(r, e, p, dt);
  if (e.state === REWIND_RECORD) {
    if (e.hp > 0 && e.hp < e.maxHp * (p.threshold as number)) startRewind(w, r, e, p);
    return;
  }
  if (e.state !== REWIND_WARN) return;
  r.warnT -= dt;
  // No fire while the clock runs: the window is for finishing it.
  if (e.fireT < r.warnT + 0.3) e.fireT = r.warnT + 0.3;
  if (r.warnT > 0) return;
  r.warnT = -1;
  e.state = REWIND_SPENT;
  e.x = r.tx;
  e.y = r.ty;
  e.prevX = r.tx;
  e.prevY = r.ty;
  e.hp = Math.max(e.hp, Math.min(e.maxHp, r.thp));
  chronoState(w).rewinds++;
  sfx(w, 'boss_throw', e.x);
}

function record(r: Recorder, e: Enemy, p: P, dt: number): void {
  const step = p.sample as number;
  r.acc += dt;
  while (r.acc >= step) {
    r.acc -= step;
    pushSample(r, e.x, e.y, e.hp);
  }
}

function startRewind(w: World, r: Recorder, e: Enemy, p: P): void {
  // At the rewind, `record` s back is `record − warn` s before now.
  const back = Math.round(((p.record as number) - (p.warn as number)) / (p.sample as number));
  const i = sampleIndex(r, Math.min(back, REC_SAMPLES - 1));
  r.tx = r.xs[i] as number;
  r.ty = r.ys[i] as number;
  r.thp = r.hps[i] as number;
  r.warnT = p.warn as number;
  e.state = REWIND_WARN;
  sfx(w, 'magnet_on', e.x);
}

/** Telegraph progress 0..1 for a Rewinder mid-warning, else -1. */
export function rewindProgress(w: World, e: Enemy, warn: number): number {
  if (e.state !== REWIND_WARN || e.ay < 0) return -1;
  const r = recorderOf(w, e, e.ay);
  if (r === null || r.warnT < 0) return -1;
  return 1 - r.warnT / warn;
}

/** Where a warning Rewinder will snap to (draw helper), or null. */
export function rewindTarget(w: World, e: Enemy): Recorder | null {
  if (e.state !== REWIND_WARN || e.ay < 0) return null;
  return recorderOf(w, e, e.ay);
}

// ---------------------------------------------------------------------------
// Bubble Mine: drifts with the scroll. Killed (shot, rammed, or its own fuse
// after `fuse` s) it pops into a slow bubble that drifts on with the scroll.

export const MINE_DRIFT = 1;

export function bubbleMine(w: World, e: Enemy, p: P, dt: number): void {
  if (e.state === 0) {
    attachMineListener(w);
    e.state = MINE_DRIFT;
  }
  e.vx = 0;
  e.vy = w.scrollSpeed;
  if (e.t + dt >= (p.fuse as number)) damageEnemy(w, e, e.hp, 'hazard');
}

/** Pops a mine's bubble at (x, y). */
export function popMine(w: World, x: number, y: number): void {
  const st = chronoState(w);
  st.minePops++;
  BUBBLE_O.vy = w.scrollSpeed;
  spawnBubble(w, x, y, BUBBLE_O);
  sfx(w, 'repulsor_on', x);
}

const BUBBLE_O = {
  kind: 'slow' as const,
  r: BUBBLE_MINE_P.bubbleR as number,
  ttl: BUBBLE_MINE_P.bubbleTtl as number,
  vy: 0,
};

/** Subscribes the world once: every Bubble Mine death pops a bubble. */
export function attachMineListener(w: World): void {
  const st = chronoState(w);
  if (st.mineListener) return;
  st.mineListener = true;
  w.events.on('enemyKilled', (k) => {
    const e = k.enemy;
    if (e.defId === 'cr_bubblemine') popMine(w, e.x, e.y);
  });
}

// ---------------------------------------------------------------------------
// Echo missile: turns toward the player at `turn` rad/s at a constant `speed`
// (blind inside `blind` px, so a late sidestep beats it), self-destructing
// after `ttl` s. ax = heading (radians, canvas).

export const MISSILE_FLY = 1;

export function missile(w: World, e: Enemy, p: P, dt: number): void {
  if (e.state === 0) {
    e.ax = e.vx === 0 && e.vy === 0 ? Math.PI / 2 : Math.atan2(e.vy, e.vx);
    e.state = MISSILE_FLY;
  }
  if (e.t + dt >= (p.ttl as number)) {
    damageEnemy(w, e, e.hp, 'hazard');
    return;
  }
  const pl = w.player;
  const dx = pl.x - e.x;
  const dy = pl.y - e.y;
  const blind = p.blind as number;
  if (pl.alive && dx * dx + dy * dy > blind * blind) {
    let da = Math.atan2(dy, dx) - e.ax;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const max = (p.turn as number) * dt;
    e.ax += da > max ? max : da < -max ? -max : da;
  }
  const s = p.speed as number;
  e.vx = Math.cos(e.ax) * s;
  e.vy = Math.sin(e.ax) * s;
}
