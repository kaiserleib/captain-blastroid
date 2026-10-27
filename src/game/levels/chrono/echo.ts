import { ENEMY_FAIRNESS } from '../../../content/enemies';
import { ECHO, ECHO_WEAPONS, type EchoDef } from '../../../content/levels/chrono';
import { addKillScore, damagePlayer, HIT_FLASH } from '../../../sim/damage';
import { timeScaleAt } from '../../../sim/hooks';
import { spawnEnemy, spawnEnemyShot, type EnemyOverrides, type ShotInit } from '../../../sim/spawn';
import type { Bullet, Enemy, WeaponInstance } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { BossRig, clearShotsToSalvage, type BossController, type PartSlot } from '../../boss';
import { emitToast } from '../../director';
import {
  aimAt,
  aimed,
  emitEnemyShotSfx,
  enemyShotSpeedMul,
  ring,
  SHOT_LARGE,
  SHOT_SMALL,
  shootDir,
} from '../../enemies';
import { removeBubble, spawnBubble, type Bubble } from '../../obstacles';
import { getPlayerRuntime, playerPastPos } from '../../player';

// The Echo: a dark mirror of the player's ship that flies the ship's own path
// from 8 s ago and fires up to three of its weapons as enemy patterns.
// entry → echo (phase 1) → ghost (≤ 60% core: a translucent Ghost Echo splits
// off, 4 s behind, firing only the first mirrored weapon) → paradox (≤ 25%: a
// flip bubble rides the Echo and slow bubbles bloom on the ship's past
// positions) → dying (freeze, rewind 1 s along its own path, shatter) → done.
//
// Bosses aren't time-scaled by the shared boss system, so the Echo scales its
// own clocks by the bubble it sits in. Slow time also stretches its lag behind
// the ship (fast time shrinks it), within the def's bounds.

export const EchoPhase = {
  Entry: 0,
  Echo: 1,
  Ghost: 2,
  Paradox: 3,
  Dying: 4,
  Done: 5,
} as const;
export type EchoPhaseId = (typeof EchoPhase)[keyof typeof EchoPhase];

const PHASE_NAMES = ['entry', 'echo', 'ghost', 'paradox', 'dying', 'done'] as const;

export const W_BLASTER = ECHO_WEAPONS.indexOf('blaster');
export const W_SPREAD = ECHO_WEAPONS.indexOf('spread');
export const W_LANCE = ECHO_WEAPONS.indexOf('lance');
export const W_SEEKER = ECHO_WEAPONS.indexOf('seeker');
export const W_DRONES = ECHO_WEAPONS.indexOf('orbitDrones');
export const W_ARC = ECHO_WEAPONS.indexOf('arc');
export const W_RICOCHET = ECHO_WEAPONS.indexOf('ricochet');
export const W_FLAK = ECHO_WEAPONS.indexOf('flak');

const N_WEAPONS = ECHO_WEAPONS.length;
const MAX_DISCS = 8;
const MAX_SHELLS = 8;
const MAX_MISSILES = 4;
/** Own positions kept for the death rewind: 1 s at 60 Hz, plus the current one. */
export const TRAIL_N = 61;
const DEG = Math.PI / 180;
const ZAP_SHOW = 0.15;

/**
 * Picks the mirrored weapons: the highest-level ones, ties to the oldest (the
 * lower index in the loadout). Writes ECHO_WEAPONS indices and levels; returns
 * how many (unknown ids are skipped).
 */
export function selectMirror(
  weapons: readonly WeaponInstance[],
  max: number,
  outIdx: Int8Array,
  outLv: Int8Array,
): number {
  let n = 0;
  while (n < max) {
    let best = -1;
    let bestLv = -1;
    for (let i = 0; i < weapons.length; i++) {
      const wp = weapons[i] as WeaponInstance;
      const k = ECHO_WEAPONS.indexOf(wp.id as (typeof ECHO_WEAPONS)[number]);
      if (k < 0 || wp.level <= bestLv) continue;
      let taken = false;
      for (let j = 0; j < n; j++) if (outIdx[j] === k) taken = true;
      if (taken) continue;
      best = k;
      bestLv = wp.level;
    }
    if (best < 0) break;
    outIdx[n] = best;
    outLv[n] = bestLv;
    n++;
  }
  for (let j = n; j < outIdx.length; j++) outIdx[j] = -1;
  return n;
}

/** The design's y mapping from the ship's past row into the top band. */
export function echoY(pastY: number, def: EchoDef = ECHO): number {
  const m = def.yMap;
  const y = m.base + (pastY - m.center) * m.k;
  return y < m.min ? m.min : y > m.max ? m.max : y;
}

/** Blockers for a drone level (0 without the weapon). */
export function droneCount(level: number, def: EchoDef = ECHO): number {
  if (level <= 0) return 0;
  const t = def.patterns.orbitDrones.byLevel;
  return t[Math.min(t.length, level) - 1] as number;
}

/** One shooter (the Echo or its ghost): pattern clocks and telegraphs. */
export interface Emitter {
  /** Seconds until each weapon (ECHO_WEAPONS index) fires next. */
  readonly timers: Float64Array;
  /** Lance telegraph seconds left (-1 idle) and its locked heading, degrees. */
  lanceT: number;
  lanceDeg: number;
  /** Arc crackle seconds left (-1 idle), cooldown, and the zap shown after it. */
  arcT: number;
  arcCd: number;
  zapT: number;
  zapHit: boolean;
  /** Seconds since it last fired (muzzle flash). */
  fired: number;
  x: number;
  y: number;
}

function newEmitter(): Emitter {
  return {
    timers: new Float64Array(N_WEAPONS),
    lanceT: -1,
    lanceDeg: 90,
    arcT: -1,
    arcCd: 0,
    zapT: 0,
    zapHit: false,
    fired: 9,
    x: 0,
    y: 0,
  };
}

const PAST = { x: 0, y: 0 };
const PART_O: EnemyOverrides = { isBoss: true, hp: 1, r: 1, vx: 0, vy: 0 };
const MISSILE_O: EnemyOverrides = { vx: 0, vy: 0 };
const SHOT: ShotInit = { x: 0, y: 0, vx: 0, vy: 0, r: 2, damage: 1, ttl: 6, sprite: '' };
const DEFEAT_P = { defId: '', x: 0, y: 0 };
const SFX_P = { id: '', x: 0 as number | undefined };
const SHAKE_P = { mag: 0, dur: 0 };
const FLIP_O = { kind: 'flip' as const, r: 0, vx: 0, vy: 0 };
const SLOW_O = { kind: 'slow' as const, r: 0, ttl: 0, vx: 0, vy: 0 };

export class Echo implements BossController {
  readonly defId: string;
  readonly def: EchoDef;
  readonly rig: BossRig;
  readonly core: PartSlot;
  readonly ghost: PartSlot;
  readonly drones: PartSlot[];
  phase: EchoPhaseId = EchoPhase.Entry;
  phaseT = 0;
  t = 0;
  /** Current lags behind the ship, s (bubbles bend them). */
  delay: number;
  ghostDelay: number;
  /** Seconds since the ghost split off (its blend from the core), -1 before. */
  ghostT = -1;
  gx = 0;
  gy = 0;
  /** Mirrored weapons (ECHO_WEAPONS indices, -1 unused) and their levels. */
  readonly mirror = new Int8Array(3).fill(-1);
  readonly mirrorLv = new Int8Array(3);
  mirrorN = 0;
  readonly echoE: Emitter = newEmitter();
  readonly ghostE: Emitter = newEmitter();
  droneA = 0;
  /** Bubble-scaled time factor at the Echo this tick (draw: the flip's look). */
  timeScale = 1;
  private readonly discs: (Bullet | null)[] = new Array<Bullet | null>(MAX_DISCS).fill(null);
  private readonly discIds = new Int32Array(MAX_DISCS);
  private readonly discBounces = new Int8Array(MAX_DISCS);
  private readonly shells: (Bullet | null)[] = new Array<Bullet | null>(MAX_SHELLS).fill(null);
  private readonly shellIds = new Int32Array(MAX_SHELLS);
  private readonly shellFuse = new Float32Array(MAX_SHELLS);
  private readonly missiles: (Enemy | null)[] = new Array<Enemy | null>(MAX_MISSILES).fill(null);
  private readonly missileIds = new Int32Array(MAX_MISSILES);
  flip: Bubble | null = null;
  private slowT = 0;
  private readonly slowUntil = new Float64Array(8);
  /** Own positions for the death rewind: x, y pairs, newest at trailI − 1. */
  readonly trail = new Float32Array(TRAIL_N * 2);
  trailI = 0;
  trailN = 0;
  pendingDefeat = false;
  defeatEmitted = false;
  /** Seconds since the shatter, -1 before. */
  shatterT = -1;

  constructor(def: EchoDef = ECHO) {
    this.def = def;
    this.defId = def.id;
    this.rig = new BossRig(def.parts);
    const slots = this.rig.slots;
    this.core = slots.find((s) => s.spec.defId === 'cr_echo_core') as PartSlot;
    this.ghost = slots.find((s) => s.spec.defId === 'cr_echo_ghost') as PartSlot;
    this.drones = slots.filter((s) => s.spec.defId === 'cr_echo_drone');
    this.delay = def.delay;
    this.ghostDelay = def.ghostDelay;
  }

  spawn(w: World): boolean {
    const r = this.rig;
    r.x = r.prevX = w.width / 2;
    r.y = r.prevY = this.def.entry.fromY;
    r.vx = r.vy = 0;
    for (const s of r.slots) {
      s.enemy = null;
      s.id = -1;
      s.destroyed = false;
      s.deadT = 0;
    }
    this.selectMirror(w);
    return this.spawnPart(w, this.core, r.x, r.y);
  }

  private spawnPart(w: World, s: PartSlot, x: number, y: number): boolean {
    PART_O.hp = s.spec.hp;
    PART_O.r = s.spec.r;
    const e = spawnEnemy(w, s.spec.defId, x, y, PART_O);
    s.enemy = e;
    s.id = e === null ? -1 : e.id;
    s.destroyed = false;
    s.deadT = 0;
    s.targetable = s.spec.targetable;
    return e !== null;
  }

  get done(): boolean {
    return this.phase === EchoPhase.Done;
  }

  invulnerable(): boolean {
    return this.phase === EchoPhase.Entry || this.phase >= EchoPhase.Dying;
  }

  targetable(_part: Enemy, slot: PartSlot): boolean {
    return !this.invulnerable() && slot.targetable;
  }

  inHpBar(part: Enemy): boolean {
    return part === this.core.enemy;
  }

  phaseName(): string {
    return PHASE_NAMES[this.phase];
  }

  /** Core HP share left (1 → 0). */
  coreShare(): number {
    const e = this.core.enemy;
    if (e === null || !this.rig.alive(this.core)) return 0;
    return Math.max(0, e.hp) / this.core.spec.hp;
  }

  onDamage(part: Enemy, slot: PartSlot, amount: number): boolean {
    if (this.invulnerable()) return true;
    if (slot === this.core && amount >= part.hp) {
      part.hp = 0;
      part.flashT = HIT_FLASH;
      this.pendingDefeat = true;
      this.setPhase(EchoPhase.Dying);
      return true;
    }
    return false;
  }

  private setPhase(p: EchoPhaseId): void {
    this.phase = p;
    this.phaseT = 0;
  }

  /** Refreshes the mirrored set from the live loadout (it can change mid-fight). */
  selectMirror(w: World): void {
    this.mirrorN = selectMirror(w.player.weapons, this.def.maxWeapons, this.mirror, this.mirrorLv);
  }

  /** Level of a mirrored weapon (0 when it isn't mirrored). */
  mirroredLevel(k: number): number {
    for (let j = 0; j < this.mirrorN; j++)
      if (this.mirror[j] === k) return this.mirrorLv[j] as number;
    return 0;
  }

  update(w: World, dt: number): void {
    this.t += dt;
    this.phaseT += dt;
    if (this.pendingDefeat && !this.defeatEmitted) this.defeat(w);
    const ts = this.phase < EchoPhase.Dying ? timeScaleAt(w, this.rig.x, this.rig.y) : 1;
    this.timeScale = ts;
    const edt = dt * ts;
    if (this.phase < EchoPhase.Dying) this.selectMirror(w);

    this.bendDelay(w, ts, dt);
    this.moveCore(w, dt);
    this.moveSatellites(w, dt);
    if (this.phase < EchoPhase.Dying) this.recordTrail();

    switch (this.phase) {
      case EchoPhase.Entry:
        if (this.phaseT >= this.def.entry.duration) {
          this.setPhase(EchoPhase.Echo);
          this.armEmitter(this.echoE, 0.6);
        }
        break;
      case EchoPhase.Echo:
      case EchoPhase.Ghost:
      case EchoPhase.Paradox:
        this.checkPhase(w);
        this.fight(w, dt, edt);
        break;
      case EchoPhase.Dying:
        this.dying(w);
        break;
    }
    this.tickDiscs(w);
    this.tickShells(w, dt);
    this.echoE.fired += dt;
    this.ghostE.fired += dt;
    if (this.echoE.zapT > 0) this.echoE.zapT -= dt;
    if (this.ghostE.zapT > 0) this.ghostE.zapT -= dt;
  }

  // -------------------------------------------------------------------------
  // Movement

  /** Inside slow time the lag stretches, in fast time it shrinks; outside it eases back. */
  private bendDelay(w: World, ts: number, dt: number): void {
    const d = this.def;
    if (ts === 1) {
      this.delay += (d.delay - this.delay) * Math.min(1, d.delayRelax * dt);
    } else {
      this.delay = clamp(this.delay + (1 - ts) * dt, d.delayMin, d.delayMax);
    }
    if (this.ghostT < 0) return;
    const gs = timeScaleAt(w, this.gx, this.gy);
    if (gs === 1) {
      this.ghostDelay += (d.ghostDelay - this.ghostDelay) * Math.min(1, d.delayRelax * dt);
    } else {
      this.ghostDelay = clamp(this.ghostDelay + (1 - gs) * dt, d.ghostDelayMin, d.ghostDelayMax);
    }
  }

  /** Where an echo `delay` s behind flies now (TARGET), strafing if the history is too short. */
  private follow(w: World, delay: number, phase: number): void {
    const h = getPlayerRuntime(w).history;
    const span = (h.count - 1) * h.step;
    if (span < delay - 0.5) {
      const s = this.def.strafe;
      const k = 0.5 + 0.5 * Math.sin((this.t / s.period) * Math.PI * 2 + phase);
      TARGET.x = s.minX + (s.maxX - s.minX) * k;
      TARGET.y = s.y;
      return;
    }
    playerPastPos(w, delay, PAST);
    TARGET.x = clamp(PAST.x, 16, w.width - 16);
    TARGET.y = echoY(PAST.y, this.def);
  }

  private moveCore(w: World, dt: number): void {
    const r = this.rig;
    if (this.phase >= EchoPhase.Dying) {
      this.deathPos();
    } else {
      this.follow(w, this.delay, 0);
      if (this.phase === EchoPhase.Entry) {
        const k = Math.min(1, this.phaseT / this.def.entry.duration);
        const e = 1 - (1 - k) * (1 - k) * (1 - k);
        TARGET.y = this.def.entry.fromY + (TARGET.y - this.def.entry.fromY) * e;
      }
    }
    r.moveTo(TARGET.x, TARGET.y, dt);
    this.echoE.x = r.x;
    this.echoE.y = r.y + this.def.muzzle;
  }

  /** Ghost on its own lag; drones on their orbit. Overrides the rig's rigid placement. */
  private moveSatellites(w: World, dt: number): void {
    const r = this.rig;
    if (this.ghostT >= 0 && this.rig.alive(this.ghost)) {
      this.ghostT += dt;
      this.follow(w, this.ghostDelay, Math.PI);
      // Splits off the Echo over a second.
      const k = Math.min(1, this.ghostT);
      const e = k * k * (3 - 2 * k);
      this.gx = r.x + (TARGET.x - r.x) * e;
      this.gy = r.y + (TARGET.y - r.y) * e;
      place(this.ghost.enemy as Enemy, this.gx, this.gy, dt);
      this.ghostE.x = this.gx;
      this.ghostE.y = this.gy + this.def.muzzle;
    }
    const n = this.drones.length;
    const R = this.def.drones.orbitR;
    for (let i = 0; i < n; i++) {
      const s = this.drones[i] as PartSlot;
      if (!this.rig.alive(s)) continue;
      const a = this.droneA + (i / n) * Math.PI * 2;
      place(s.enemy as Enemy, r.x + Math.cos(a) * R, r.y + Math.sin(a) * R * 0.8, dt);
    }
  }

  private recordTrail(): void {
    const i = this.trailI;
    this.trail[i * 2] = this.rig.x;
    this.trail[i * 2 + 1] = this.rig.y;
    this.trailI = (i + 1) % TRAIL_N;
    if (this.trailN < TRAIL_N) this.trailN++;
  }

  /** Trail sample `back` ticks before the newest (clamped), into TARGET. */
  trailAt(back: number, out: { x: number; y: number }): void {
    const k = Math.max(0, Math.min(back, this.trailN - 1));
    const i = (this.trailI - 1 - k + TRAIL_N * 2) % TRAIL_N;
    out.x = this.trail[i * 2] as number;
    out.y = this.trail[i * 2 + 1] as number;
  }

  // -------------------------------------------------------------------------
  // Phases

  private checkPhase(w: World): void {
    const share = this.coreShare();
    if (this.phase === EchoPhase.Echo && share < this.def.ghostAt) {
      this.splitGhost(w);
      this.setPhase(EchoPhase.Ghost);
    }
    if (this.phase === EchoPhase.Ghost && share < this.def.paradoxAt) this.startParadox(w);
  }

  private splitGhost(w: World): void {
    if (!this.spawnPart(w, this.ghost, this.rig.x, this.rig.y)) return;
    this.ghostT = 0;
    this.gx = this.rig.x;
    this.gy = this.rig.y;
    this.ghostDelay = this.def.ghostDelay;
    this.armEmitter(this.ghostE, 1);
    this.sfx(w, 'boss_throw', this.rig.x);
  }

  private startParadox(w: World): void {
    this.setPhase(EchoPhase.Paradox);
    emitToast(w, 'PARADOX');
    FLIP_O.r = this.def.paradox.flipR;
    this.flip = spawnBubble(w, this.rig.x, this.rig.y, FLIP_O);
    this.slowT = 0.8;
    SHAKE_P.mag = 2;
    SHAKE_P.dur = 0.4;
    w.events.emit('shake', SHAKE_P);
    this.sfx(w, 'magnet_on', this.rig.x);
  }

  private armEmitter(em: Emitter, first: number): void {
    for (let k = 0; k < N_WEAPONS; k++) em.timers[k] = first + (k % 3) * 0.45;
    em.lanceT = -1;
    em.arcT = -1;
    em.arcCd = first;
  }

  private fight(w: World, dt: number, edt: number): void {
    this.droneA += this.def.drones.omega * edt;
    this.runEmitter(w, this.echoE, this.mirrorN, edt, 1);
    if (this.ghostT >= 0 && this.rig.alive(this.ghost) && this.mirrorN > 0) {
      const gs = timeScaleAt(w, this.gx, this.gy);
      this.runEmitter(w, this.ghostE, 1, dt * gs, this.def.ghostEveryMul);
    }
    this.tendDrones(w);
    if (this.phase === EchoPhase.Paradox) this.paradox(w, dt);
  }

  private tendDrones(w: World): void {
    const want = droneCount(this.mirroredLevel(W_DRONES), this.def);
    const R = this.def.drones.orbitR;
    for (let i = 0; i < this.drones.length; i++) {
      const s = this.drones[i] as PartSlot;
      if (i >= want || this.rig.alive(s)) continue;
      if (s.destroyed && s.deadT < this.def.drones.respawn) continue;
      const a = this.droneA + (i / this.drones.length) * Math.PI * 2;
      this.spawnPart(w, s, this.rig.x + Math.cos(a) * R, this.rig.y + Math.sin(a) * R * 0.8);
    }
  }

  private paradox(w: World, dt: number): void {
    const f = this.flip;
    if (f !== null && f.active) {
      f.prevX = f.x;
      f.prevY = f.y;
      f.x = this.rig.x;
      f.y = this.rig.y;
    }
    const pd = this.def.paradox;
    this.slowT -= dt;
    if (this.slowT > 0) return;
    this.slowT += pd.slowEvery;
    let live = 0;
    let free = -1;
    for (let i = 0; i < pd.maxSlow; i++) {
      if ((this.slowUntil[i] as number) > this.t) live++;
      else if (free < 0) free = i;
    }
    if (live >= pd.maxSlow || free < 0 || !w.player.alive) return;
    playerPastPos(w, pd.slowPast, PAST);
    SLOW_O.r = pd.slowR;
    SLOW_O.ttl = pd.slowTtl;
    if (spawnBubble(w, PAST.x, PAST.y, SLOW_O) !== null) this.slowUntil[free] = this.t + pd.slowTtl;
  }

  // -------------------------------------------------------------------------
  // Patterns

  /** Ticks one shooter's mirrored weapons (`count` of them, from the first). */
  private runEmitter(w: World, em: Emitter, count: number, edt: number, everyMul: number): void {
    const p = this.def.patterns;
    if (em.lanceT >= 0) {
      em.lanceT -= edt;
      if (em.lanceT < 0) this.fireLance(w, em);
    }
    for (let j = 0; j < count && j < this.mirrorN; j++) {
      const k = this.mirror[j] as number;
      const lv = this.mirrorLv[j] as number;
      if (k === W_DRONES) continue;
      if (k === W_ARC) {
        this.arc(w, em, edt);
        continue;
      }
      const left = (em.timers[k] as number) - edt;
      if (left > 0) {
        em.timers[k] = left;
        continue;
      }
      let every = 1;
      if (k === W_BLASTER) every = p.blaster.every;
      else if (k === W_SPREAD) every = p.spread.every;
      else if (k === W_LANCE) every = p.lance.every;
      else if (k === W_SEEKER) every = p.seeker.every;
      else if (k === W_RICOCHET) every = p.ricochet.every;
      else if (k === W_FLAK) every = p.flak.every;
      // Held by fairness: try again shortly instead of waiting a full interval.
      em.timers[k] = this.fire(w, em, k, lv) ? left + every * everyMul : 0.25;
    }
  }

  /** Aimed fire only from at least `minAbovePlayer` px above a live ship. */
  private canAim(w: World, y: number): boolean {
    const pl = w.player;
    return pl.alive && y <= pl.y - ENEMY_FAIRNESS.minAbovePlayer;
  }

  private fire(w: World, em: Emitter, k: number, lv: number): boolean {
    const x = em.x;
    const y = em.y;
    if (!this.canAim(w, y)) return false;
    const p = this.def.patterns;
    let n = 0;
    if (k === W_BLASTER) {
      const deg = aimAt(w, x, y);
      if (lv >= p.blaster.twinFrom) {
        const ox = Math.sin(deg * DEG) * p.blaster.twinGap;
        const oy = -Math.cos(deg * DEG) * p.blaster.twinGap;
        n += shootDir(w, x - ox, y - oy, deg, p.blaster.speed, SHOT_SMALL);
        n += shootDir(w, x + ox, y + oy, deg, p.blaster.speed, SHOT_SMALL);
      } else {
        n += shootDir(w, x, y, deg, p.blaster.speed, SHOT_SMALL);
      }
    } else if (k === W_SPREAD) {
      const c = lv >= p.spread.highFrom ? p.spread.nHigh : p.spread.n;
      n += aimed(w, x, y, c, (c - 1) * p.spread.stepDeg, p.spread.speed, SHOT_SMALL);
    } else if (k === W_LANCE) {
      em.lanceT = p.lance.telegraph;
      em.lanceDeg = aimAt(w, x, y);
      this.sfx(w, 'magnet_on', x);
      return true;
    } else if (k === W_SEEKER) {
      const c = lv >= p.seeker.highFrom ? p.seeker.nHigh : p.seeker.n;
      for (let i = 0; i < c; i++) {
        const side = c === 1 ? 0 : i === 0 ? -1 : 1;
        n += this.launchMissile(w, x + side * 10, y - 4, side);
      }
      if (n > 0) this.sfx(w, 'shot_seeker', x);
    } else if (k === W_RICOCHET) {
      n += this.fireDisc(w, x, y);
    } else if (k === W_FLAK) {
      n += this.fireShell(w, x, y);
    }
    if (n > 0) {
      em.fired = 0;
      if (k !== W_SEEKER) emitEnemyShotSfx(w, x);
    }
    return true;
  }

  /** The telegraphed line ends: a short bolt of large rounds down it at an absolute speed. */
  private fireLance(w: World, em: Emitter): void {
    em.lanceT = -1;
    if (!this.canAim(w, em.y) || this.phase >= EchoPhase.Dying) return;
    const p = this.def.patterns.lance;
    const a = em.lanceDeg * DEG;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    let n = 0;
    for (let i = 0; i < p.rounds; i++) {
      const back = i * p.gap * p.speed;
      if (
        this.shot(
          w,
          em.x - cx * back,
          em.y - cy * back,
          cx * p.speed,
          cy * p.speed,
          SHOT_LARGE,
          i * p.gap,
        ) !== null
      )
        n++;
    }
    if (n > 0) {
      em.fired = 0;
      this.sfx(w, 'shot_lance', em.x);
    }
  }

  private launchMissile(w: World, x: number, y: number, side: number): number {
    let slot = -1;
    for (let i = 0; i < MAX_MISSILES; i++) {
      const m = this.missiles[i] ?? null;
      if (m === null || !m.active || m.id !== this.missileIds[i]) {
        slot = i;
        break;
      }
    }
    if (slot < 0) return 0;
    MISSILE_O.vx = side * 24;
    MISSILE_O.vy = 50;
    const e = spawnEnemy(w, 'cr_missile', x, y, MISSILE_O);
    if (e === null) return 0;
    this.missiles[slot] = e;
    this.missileIds[slot] = e.id;
    return 1;
  }

  /** A bank shot: aimed at the ship's mirror image across the nearer side wall. */
  private fireDisc(w: World, x: number, y: number): number {
    const pl = w.player;
    const p = this.def.patterns.ricochet;
    const tx = x < w.width / 2 ? -pl.x : 2 * w.width - pl.x;
    const a = Math.atan2(pl.y - y, tx - x);
    const v = p.speed * enemyShotSpeedMul(w);
    const b = this.shot(w, x, y, Math.cos(a) * v, Math.sin(a) * v, SHOT_LARGE, 0);
    if (b === null) return 0;
    for (let i = 0; i < MAX_DISCS; i++) {
      const d = this.discs[i] ?? null;
      if (d !== null && d.active && d.id === this.discIds[i]) continue;
      this.discs[i] = b;
      this.discIds[i] = b.id;
      this.discBounces[i] = p.bounces;
      break;
    }
    return 1;
  }

  private fireShell(w: World, x: number, y: number): number {
    const p = this.def.patterns.flak;
    const a = aimAt(w, x, y) * DEG;
    const v = p.speed * enemyShotSpeedMul(w);
    const b = this.shot(w, x, y, Math.cos(a) * v, Math.sin(a) * v, SHOT_LARGE, 0);
    if (b === null) return 0;
    for (let i = 0; i < MAX_SHELLS; i++) {
      const s = this.shells[i] ?? null;
      if (s !== null && s.active && s.id === this.shellIds[i]) continue;
      this.shells[i] = b;
      this.shellIds[i] = b.id;
      this.shellFuse[i] = p.fuse;
      break;
    }
    return 1;
  }

  private shot(
    w: World,
    x: number,
    y: number,
    vx: number,
    vy: number,
    s: Readonly<{ sprite: string; r: number }>,
    extraTtl: number,
  ): Bullet | null {
    SHOT.x = x;
    SHOT.y = y;
    SHOT.vx = vx;
    SHOT.vy = vy;
    SHOT.r = s.r;
    SHOT.damage = 1;
    SHOT.ttl = ENEMY_FAIRNESS.shotTtl + extraTtl;
    SHOT.sprite = s.sprite;
    return spawnEnemyShot(w, SHOT);
  }

  /** Discs bounce off the side edges, `bounces` times. */
  private tickDiscs(w: World): void {
    for (let i = 0; i < MAX_DISCS; i++) {
      const b = this.discs[i] ?? null;
      if (b === null) continue;
      if (!b.active || b.id !== this.discIds[i] || (this.discBounces[i] as number) <= 0) {
        this.discs[i] = null;
        continue;
      }
      if (b.x < b.r && b.vx < 0) {
        b.x = b.r;
        b.vx = -b.vx;
        this.discBounces[i] = (this.discBounces[i] as number) - 1;
      } else if (b.x > w.width - b.r && b.vx > 0) {
        b.x = w.width - b.r;
        b.vx = -b.vx;
        this.discBounces[i] = (this.discBounces[i] as number) - 1;
      }
    }
  }

  /** Flak shells burst into slow shards when the fuse ends, or early near the ship. */
  private tickShells(w: World, dt: number): void {
    const p = this.def.patterns.flak;
    const pl = w.player;
    for (let i = 0; i < MAX_SHELLS; i++) {
      const b = this.shells[i] ?? null;
      if (b === null) continue;
      if (!b.active || b.id !== this.shellIds[i]) {
        this.shells[i] = null;
        continue;
      }
      const f =
        (this.shellFuse[i] as number) - dt * timeScaleAt(w, b.x, b.y) * w.enemyBulletTimeScale;
      this.shellFuse[i] = f;
      const near = pl.alive && Math.hypot(pl.x - b.x, pl.y - b.y) < p.burstDist;
      if (f > 0 && !near) continue;
      this.shells[i] = null;
      const x = b.x;
      const y = b.y;
      w.enemyShots.release(b);
      if (this.phase >= EchoPhase.Dying) continue;
      if (
        ring(
          w,
          x,
          y,
          p.shards,
          p.shardSpeed,
          ((this.shellIds[i] as number) * 23) % 60,
          SHOT_SMALL,
        ) > 0
      )
        emitEnemyShotSfx(w, x);
    }
  }

  /** Arc Coil: a 0.5 s crackle, then a zap that can't miss inside `range`. */
  private arc(w: World, em: Emitter, edt: number): void {
    const p = this.def.patterns.arc;
    const pl = w.player;
    const d = Math.hypot(pl.x - em.x, pl.y - (em.y - this.def.muzzle));
    if (em.arcT >= 0) {
      em.arcT -= edt;
      if (em.arcT >= 0) return;
      em.arcT = -1;
      em.arcCd = p.cooldown;
      em.zapT = ZAP_SHOW;
      em.zapHit = pl.alive && d <= p.range;
      if (em.zapHit) damagePlayer(w, 1);
      em.fired = 0;
      this.sfx(w, 'shot_lance', em.x);
      return;
    }
    em.arcCd -= edt;
    if (em.arcCd > 0 || !pl.alive || d > p.range + 12) return;
    em.arcT = p.telegraph;
  }

  // -------------------------------------------------------------------------
  // Death

  private defeat(w: World): void {
    this.defeatEmitted = true;
    const run = w.run;
    run.bossDefeated = true;
    run.kills++;
    addKillScore(w, this.def.score);
    const core = this.core.enemy;
    if (core !== null) core.contactDamage = 0;
    if (this.rig.alive(this.ghost)) w.enemies.release(this.ghost.enemy as Enemy);
    for (const s of this.drones) if (this.rig.alive(s)) w.enemies.release(s.enemy as Enemy);
    for (let i = 0; i < MAX_MISSILES; i++) {
      const m = this.missiles[i] ?? null;
      if (m !== null && m.active && m.id === this.missileIds[i]) w.enemies.release(m);
      this.missiles[i] = null;
    }
    if (this.flip !== null && this.flip.active) removeBubble(w, this.flip);
    this.flip = null;
    this.echoE.lanceT = -1;
    this.echoE.arcT = -1;
    this.ghostE.lanceT = -1;
    this.ghostE.arcT = -1;
    DEFEAT_P.defId = this.def.id;
    DEFEAT_P.x = this.rig.x;
    DEFEAT_P.y = this.rig.y;
    w.events.emit('bossDefeated', DEFEAT_P);
    this.sfx(w, 'boss_die', this.rig.x);
    clearShotsToSalvage(w, this.def.shotSalvageMax);
  }

  /** Death stage: 0 freeze, 1 rewind, 2 shatter. */
  deathStage(): number {
    const d = this.def.death;
    if (this.phaseT < d.freeze) return 0;
    if (this.phaseT < d.freeze + d.rewind) return 1;
    return 2;
  }

  private deathPos(): void {
    const d = this.def.death;
    if (this.deathStage() === 0 || this.phase === EchoPhase.Done) {
      TARGET.x = this.rig.x;
      TARGET.y = this.rig.y;
      return;
    }
    const u = Math.min(1, (this.phaseT - d.freeze) / d.rewind);
    this.trailAt(Math.round(u * (TRAIL_N - 1)), TARGET);
  }

  private dying(w: World): void {
    const d = this.def.death;
    if (this.shatterT < 0 && this.deathStage() === 2) {
      this.shatterT = 0;
      SHAKE_P.mag = 4;
      SHAKE_P.dur = 0.5;
      w.events.emit('shake', SHAKE_P);
      this.sfx(w, 'enemy_die_m', this.rig.x);
    } else if (this.shatterT >= 0) {
      this.shatterT = this.phaseT - d.freeze - d.rewind;
    }
    if (this.phaseT >= d.freeze + d.rewind + d.shatter) {
      this.rig.release(w);
      this.setPhase(EchoPhase.Done);
    }
  }

  // -------------------------------------------------------------------------
  // Dev and tests

  /** Drops the core to just under a phase threshold (or kills it). */
  skipTo(w: World, to: 'ghost' | 'paradox' | 'kill'): void {
    const e = this.core.enemy;
    if (e === null || !this.rig.alive(this.core)) return;
    if (this.phase === EchoPhase.Entry) {
      this.setPhase(EchoPhase.Echo);
      this.armEmitter(this.echoE, 0.6);
    }
    if (to === 'kill') {
      this.onDamage(e, this.core, e.hp);
      return;
    }
    const share = to === 'ghost' ? this.def.ghostAt : this.def.paradoxAt;
    e.hp = Math.min(e.hp, Math.floor(this.core.spec.hp * share) - 1);
    this.checkPhase(w);
  }

  private sfx(w: World, id: string, x?: number): void {
    SFX_P.id = id;
    SFX_P.x = x;
    w.events.emit('sfx', SFX_P);
  }
}

const TARGET = { x: 0, y: 0 };

/** Carries a free-flying part (ghost, drone) to (x, y), after the rig placed it. */
function place(e: Enemy, x: number, y: number, dt: number): void {
  e.vx = dt > 0 ? (x - e.prevX) / dt : 0;
  e.vy = dt > 0 ? (y - e.prevY) / dt : 0;
  e.x = x;
  e.y = y;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
