import { PERIHELION, type PerihelionDef } from '../../../content/levels/eventHorizon';
import { addKillScore, damageEnemy, HIT_FLASH } from '../../../sim/damage';
import { pinAnomaly } from '../../../sim/scroll';
import type { Anomaly, Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { BossRig, clearShotsToSalvage, type BossController, type PartSlot } from '../../boss';
import { aimed, emitEnemyShotSfx, ring, SHOT_LARGE, SHOT_SMALL } from '../../enemies';
import { collapseAnomaly, isCollapsing, spawnBlackHole } from '../../obstacles';

// Perihelion: entry (its massive hole grows at (120, 150) while it descends)
// → orbit (an ellipse around the hole; the wing pods fire aimed fans the hole
// bends) → both pods wrecked → the core irises open → slingshot (each lap,
// 0.8 s of curved dotted telegraph, then a dive that swings under the hole
// through the player's row and back up, dropping a ring on the climb; between
// dives the core fires 6-way rings) → core destroyed → the hole collapses with
// a flash, 2 s of death throes → parts released.

export const PeriPhase = {
  Entry: 0,
  Orbit: 1,
  Opening: 2,
  Slingshot: 3,
  Dying: 4,
  Done: 5,
} as const;
export type PeriPhaseId = (typeof PeriPhase)[keyof typeof PeriPhase];

const PHASE_NAMES = ['entry', 'orbit', 'opening', 'slingshot', 'dying', 'done'] as const;

export const Dive = { None: 0, Telegraph: 1, Diving: 2 } as const;

const TAU = Math.PI * 2;
const SPARKS = 12;
const PING_GAP = 0.12;
/** Arc-length table resolution for the dive path. */
const DIVE_SAMPLES = 32;
/** Afterimages kept during the dive (x, y pairs). */
export const TRAIL = 4;
const DEFEAT_P = { defId: '', x: 0, y: 0 };
const SFX_P = { id: '', x: 0 as number | undefined };
const SHAKE_P = { mag: 0, dur: 0 };
const HOLE_P = { vx: 0, vy: 0, variant: '' };

export class Perihelion implements BossController {
  readonly defId: string;
  readonly def: PerihelionDef;
  readonly rig: BossRig;
  phase: PeriPhaseId = PeriPhase.Entry;
  phaseT = 0;
  t = 0;
  /** Orbit angle (screen space: 0 = right of the hole, π/2 = below) and direction. */
  theta = -Math.PI / 2;
  dir = 1;
  hole: Anomaly | null = null;
  private holeId = -1;
  private holeR = 0;
  private holeRadius = 0;
  private holeStrength = 0;
  readonly hx: number;
  readonly hy: number;
  podT: [number, number] = [0, 0];
  /** Seconds since each pod last fired (muzzle flash). */
  podFired: [number, number] = [9, 9];
  podsLost = 0;
  ringT = 0;
  ringRot = 0;
  dive: number = Dive.None;
  /** Telegraph: seconds left and total. */
  teleT = 0;
  teleDur = 0;
  sinceDive = 0;
  /** Quadratic Bézier of the current dive: P0, C, P3. */
  readonly path = new Float32Array(6);
  private readonly lut = new Float32Array(DIVE_SAMPLES + 1);
  private diveLen = 1;
  private diveS = 0;
  private diveEndTheta = 0;
  private ringDropped = false;
  /** Seconds since the hole collapsed (the flash), or -1. */
  collapseT = -1;
  /** Dive afterimages: x, y ring buffer, newest at trailI - 1. */
  readonly trail = new Float32Array(TRAIL * 2);
  trailI = 0;
  private trailTick = 0;
  pendingDefeat = false;
  defeatEmitted = false;
  readonly sparks = new Float32Array(SPARKS * 3).fill(99);
  private sparkI = 0;
  private sparkSeq = 0;
  private pingT = 0;
  private pingWanted = false;
  private pingX = 0;

  readonly core: PartSlot;
  readonly pods: PartSlot[];

  constructor(def: PerihelionDef = PERIHELION) {
    this.def = def;
    this.defId = def.id;
    this.rig = new BossRig(def.parts);
    this.core = this.rig.slots.find((s) => s.spec.role === 'core') as PartSlot;
    this.pods = this.rig.slots.filter((s) => s.spec.role === 'turret');
    this.hx = def.hole.x;
    this.hy = def.hole.y;
  }

  spawn(w: World): boolean {
    const ok = this.rig.spawn(w, this.hx, this.def.entry.fromY);
    HOLE_P.variant = this.def.hole.variant;
    const a = spawnBlackHole(w, this.hx, this.hy, HOLE_P);
    if (a !== null) {
      pinAnomaly(a);
      this.hole = a;
      this.holeId = a.id;
      this.holeR = a.r;
      this.holeRadius = a.radius;
      this.holeStrength = a.strength;
      this.growHole(0);
    }
    this.podT[0] = this.def.pods.interval * 0.5;
    this.podT[1] = this.def.pods.interval;
    return ok;
  }

  get done(): boolean {
    return this.phase === PeriPhase.Done;
  }

  invulnerable(): boolean {
    return this.phase === PeriPhase.Entry || this.phase >= PeriPhase.Dying;
  }

  targetable(_part: Enemy, slot: PartSlot): boolean {
    return !this.invulnerable() && slot.targetable;
  }

  phaseName(): string {
    return PHASE_NAMES[this.phase];
  }

  /** The arena hole, while it is still ours. */
  liveHole(): Anomaly | null {
    const a = this.hole;
    return a !== null && a.active && a.id === this.holeId ? a : null;
  }

  onDamage(part: Enemy, slot: PartSlot, amount: number): boolean {
    if (this.invulnerable() || !slot.targetable) {
      this.deflect(part);
      return true;
    }
    if (slot === this.core && amount >= part.hp) {
      part.hp = 0;
      part.flashT = HIT_FLASH;
      this.pendingDefeat = true;
      this.setPhase(PeriPhase.Dying);
      return true;
    }
    return false;
  }

  private deflect(part: Enemy): void {
    const k = this.sparkSeq++;
    const i = this.sparkI;
    this.sparks[i * 3] = part.x + (((k * 37) % 11) - 5) * (part.r / 6);
    this.sparks[i * 3 + 1] = part.y + part.r * 0.55 + ((k * 13) % 5) - 2;
    this.sparks[i * 3 + 2] = 0;
    this.sparkI = (i + 1) % SPARKS;
    this.pingWanted = true;
    this.pingX = part.x;
  }

  private setPhase(p: PeriPhaseId): void {
    this.phase = p;
    this.phaseT = 0;
  }

  update(w: World, dt: number): void {
    this.t += dt;
    this.phaseT += dt;
    for (let i = 2; i < this.sparks.length; i += 3)
      this.sparks[i] = (this.sparks[i] as number) + dt;
    this.podFired[0] += dt;
    this.podFired[1] += dt;
    this.sinceDive += dt;
    if (this.collapseT >= 0) this.collapseT += dt;
    this.pingT -= dt;
    if (this.pingWanted) {
      this.pingWanted = false;
      if (this.pingT <= 0 && this.phase < PeriPhase.Dying) {
        this.pingT = PING_GAP;
        this.sfx(w, 'armor_ping', this.pingX);
      }
    }
    if (this.phase === PeriPhase.Entry) this.growHole(this.phaseT);
    if (this.pendingDefeat && !this.defeatEmitted) this.defeat(w);

    this.move(dt);
    const lost = this.rig.moveTo(TARGET.x, TARGET.y, dt);
    if (lost > 0) this.onPartsLost(w);
    this.recordTrail();

    switch (this.phase) {
      case PeriPhase.Entry:
        if (this.phaseT >= this.def.entry.duration) this.setPhase(PeriPhase.Orbit);
        break;
      case PeriPhase.Orbit:
        this.firePods(w, dt);
        break;
      case PeriPhase.Opening:
        if (this.phaseT >= this.def.coreOpenTime) {
          this.core.targetable = true;
          this.ringT = this.def.ring.firstDelay;
          // The first dive comes on the next pass of the right-hand side.
          this.sinceDive = this.def.dive.every;
          this.setPhase(PeriPhase.Slingshot);
        }
        break;
      case PeriPhase.Slingshot:
        this.slingshot(w, dt);
        break;
      case PeriPhase.Dying:
        if (this.phaseT >= this.def.deathTime) {
          this.rig.release(w);
          const a = this.liveHole();
          if (a !== null) w.anomalies.release(a);
          this.setPhase(PeriPhase.Done);
        }
        break;
    }
  }

  /** The hole grows from a pinprick to full size while the boss descends. */
  private growHole(t: number): void {
    const a = this.liveHole();
    if (a === null || isCollapsing(a)) return;
    const k = Math.min(1, Math.max(0.08, t / this.def.hole.growTime));
    a.r = Math.max(1, this.holeR * k);
    a.radius = this.holeRadius * k;
    a.strength = this.holeStrength * k;
  }

  /** Where the controller goes this tick (written to TARGET). */
  private move(dt: number): void {
    const d = this.def;
    const out = TARGET;
    if (this.phase === PeriPhase.Entry) {
      const k = Math.min(1, this.phaseT / d.entry.duration);
      const e = 1 - (1 - k) * (1 - k) * (1 - k);
      const toY = this.hy - d.orbit.ry;
      out.x = this.hx;
      out.y = d.entry.fromY + (toY - d.entry.fromY) * e;
      return;
    }
    if (this.phase >= PeriPhase.Dying) {
      out.x = this.rig.x;
      out.y = this.rig.y + (this.phase === PeriPhase.Dying ? 4 * dt : 0);
      return;
    }
    if (this.dive === Dive.Diving) {
      this.diveStep(dt);
      return;
    }
    this.theta = (this.theta + (this.dir * TAU * dt) / d.orbit.period) % TAU;
    out.x = this.hx + Math.cos(this.theta) * d.orbit.rx;
    out.y = this.hy + Math.sin(this.theta) * d.orbit.ry;
  }

  private onPartsLost(w: World): void {
    let wrecked = 0;
    for (let i = 0; i < this.pods.length; i++) if ((this.pods[i] as PartSlot).destroyed) wrecked++;
    if (wrecked <= this.podsLost) return;
    this.podsLost = wrecked;
    SHAKE_P.mag = this.def.podShake.mag;
    SHAKE_P.dur = this.def.podShake.dur;
    w.events.emit('shake', SHAKE_P);
    if (wrecked >= this.pods.length && this.phase === PeriPhase.Orbit)
      this.setPhase(PeriPhase.Opening);
  }

  private firePods(w: World, dt: number): void {
    const pl = w.player;
    const pd = this.def.pods;
    const alone = this.podsLost > 0;
    for (let i = 0; i < this.pods.length; i++) {
      const s = this.pods[i] as PartSlot;
      if (!this.rig.alive(s)) continue;
      const left = (this.podT[i] as number) - dt;
      this.podT[i] = left;
      if (left > 0) continue;
      this.podT[i] = left + (alone ? pd.intervalAlone : pd.interval);
      const e = s.enemy as Enemy;
      const my = e.y + 7;
      // T11 fairness: aimed fire only from well above a live player.
      if (!pl.alive || my > pl.y - 24 || Math.hypot(pl.x - e.x, pl.y - my) < pd.minPlayerDist)
        continue;
      if (aimed(w, e.x, my, pd.n, pd.spreadDeg, pd.speed, SHOT_SMALL) > 0) {
        emitEnemyShotSfx(w, e.x);
        this.podFired[i] = 0;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Phase 2

  private slingshot(w: World, dt: number): void {
    const dv = this.def.dive;
    if (this.dive === Dive.None) {
      this.fireRing(w, dt);
      const omega = TAU / this.def.orbit.period;
      const tau = this.angleToDiveSide() / omega;
      if (this.sinceDive >= dv.every - 1.5 && tau <= dv.telegraph && tau > dv.telegraph - 0.1)
        this.startTelegraph(w, tau);
      return;
    }
    if (this.dive === Dive.Telegraph) {
      this.teleT -= dt;
      if (this.teleT <= 0) this.startDive(w);
      return;
    }
    // Diving: the ring drops on the climb once the player is clear of it.
    if (this.ringDropped) return;
    const u = this.diveS / this.diveLen;
    if (u < dv.ringAfter) return;
    const pl = w.player;
    const core = this.core.enemy;
    if (core === null || !pl.alive) return;
    if (Math.hypot(pl.x - core.x, pl.y - core.y) < dv.ringMinDist) return;
    this.ringDropped = true;
    if (ring(w, core.x, core.y, dv.ringN, dv.ringSpeed, this.ringRot, SHOT_LARGE) > 0)
      emitEnemyShotSfx(w, core.x);
  }

  /**
   * Angle still to travel (in the orbit direction) to the side where the
   * orbit next turns downward: θ = 0 going clockwise, θ = π going counter.
   */
  angleToDiveSide(): number {
    const target = this.dir > 0 ? 0 : Math.PI;
    let d = this.dir > 0 ? target - this.theta : this.theta - target;
    d = ((d % TAU) + TAU) % TAU;
    return d;
  }

  private startTelegraph(w: World, tau: number): void {
    const d = this.def;
    const dv = d.dive;
    const side = this.dir > 0 ? 1 : -1;
    const pl = w.player;
    const bx = clamp(pl.alive ? pl.x : this.hx, dv.xMin, dv.xMax);
    const by = clamp(pl.alive ? pl.y : dv.rowMax, dv.rowMin, dv.rowMax);
    const p = this.path;
    p[0] = this.hx + side * d.orbit.rx;
    p[1] = this.hy;
    p[4] = this.hx - side * d.orbit.rx;
    p[5] = this.hy;
    // Quadratic through P0, B (at t = ½) and P3.
    p[2] = 2 * bx - (p[0] + p[4]) / 2;
    p[3] = 2 * by - (p[1] + p[5]) / 2;
    this.dive = Dive.Telegraph;
    this.teleT = tau;
    this.teleDur = tau;
    this.diveEndTheta = this.dir > 0 ? Math.PI : 0;
    this.sfx(w, 'magnet_on', p[0]);
  }

  private startDive(w: World): void {
    const p = this.path;
    let len = 0;
    let px = p[0] as number;
    let py = p[1] as number;
    this.lut[0] = 0;
    for (let i = 1; i <= DIVE_SAMPLES; i++) {
      const t = i / DIVE_SAMPLES;
      const x = bez(p[0] as number, p[2] as number, p[4] as number, t);
      const y = bez(p[1] as number, p[3] as number, p[5] as number, t);
      len += Math.hypot(x - px, y - py);
      this.lut[i] = len;
      px = x;
      py = y;
    }
    this.diveLen = Math.max(1, len);
    this.diveS = 0;
    this.ringDropped = false;
    this.dive = Dive.Diving;
    this.sinceDive = 0;
    this.sfx(w, 'boss_throw', p[0] as number);
  }

  private diveStep(dt: number): void {
    const dv = this.def.dive;
    const u0 = this.diveS / this.diveLen;
    // Slingshot: slow at the lips of the swing, fastest at the bottom.
    this.diveS += dv.speed * (0.55 + 0.7 * Math.sin(Math.PI * u0)) * dt;
    const p = this.path;
    if (this.diveS >= this.diveLen) {
      TARGET.x = p[4] as number;
      TARGET.y = p[5] as number;
      this.theta = this.diveEndTheta;
      this.dive = Dive.None;
      return;
    }
    const t = this.paramAt(this.diveS);
    TARGET.x = bez(p[0] as number, p[2] as number, p[4] as number, t);
    TARGET.y = bez(p[1] as number, p[3] as number, p[5] as number, t);
  }

  /** Bézier parameter for an arc length, by the lookup table. */
  private paramAt(s: number): number {
    const lut = this.lut;
    for (let i = 1; i <= DIVE_SAMPLES; i++) {
      const b = lut[i] as number;
      if (b < s) continue;
      const a = lut[i - 1] as number;
      const f = b > a ? (s - a) / (b - a) : 0;
      return (i - 1 + f) / DIVE_SAMPLES;
    }
    return 1;
  }

  /** Telegraph progress 0..1, or -1 when none is showing. */
  telegraph(): number {
    if (this.dive !== Dive.Telegraph) return -1;
    return this.teleDur > 0 ? 1 - this.teleT / this.teleDur : 1;
  }

  private fireRing(w: World, dt: number): void {
    this.ringT -= dt;
    if (this.ringT > 0) return;
    const r = this.def.ring;
    this.ringT += r.interval;
    const pl = w.player;
    const core = this.core.enemy;
    if (!pl.alive || core === null) return;
    if (Math.hypot(pl.x - core.x, pl.y - core.y) < r.minPlayerDist) return;
    if (ring(w, core.x, core.y, r.n, r.speed, this.ringRot, SHOT_LARGE) > 0)
      emitEnemyShotSfx(w, core.x);
    this.ringRot = (this.ringRot + r.rotStep) % 360;
  }

  private recordTrail(): void {
    if (this.trailTick++ % 3 !== 0) return;
    const i = this.trailI;
    this.trail[i * 2] = this.rig.x;
    this.trail[i * 2 + 1] = this.rig.y;
    this.trailI = (i + 1) % TRAIL;
  }

  private defeat(w: World): void {
    this.defeatEmitted = true;
    const run = w.run;
    run.bossDefeated = true;
    run.kills++;
    addKillScore(w, this.def.score);
    this.dive = Dive.None;
    const a = this.liveHole();
    if (a !== null) collapseAnomaly(w, a, this.def.hole.collapseTime);
    this.collapseT = 0;
    DEFEAT_P.defId = this.def.id;
    DEFEAT_P.x = this.rig.x;
    DEFEAT_P.y = this.rig.y;
    w.events.emit('bossDefeated', DEFEAT_P);
    this.sfx(w, 'boss_die', this.rig.x);
    clearShotsToSalvage(w, this.def.shotSalvageMax);
  }

  /** Sandbox / tests: wreck both pods to jump to phase 2. */
  wreckPods(w: World): void {
    for (const s of this.pods)
      if (this.rig.alive(s) && s.enemy !== null) damageEnemy(w, s.enemy, s.enemy.hp, 'player');
  }

  private sfx(w: World, id: string, x?: number): void {
    SFX_P.id = id;
    SFX_P.x = x;
    w.events.emit('sfx', SFX_P);
  }
}

const TARGET = { x: 0, y: 0 };

function bez(a: number, b: number, c: number, t: number): number {
  const u = 1 - t;
  return u * u * a + 2 * u * t * b + t * t * c;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Point on a dive path at parameter t (draw helper). */
export function divePoint(path: Float32Array, t: number, out: { x: number; y: number }): void {
  out.x = bez(path[0] as number, path[2] as number, path[4] as number, t);
  out.y = bez(path[1] as number, path[3] as number, path[5] as number, t);
}
