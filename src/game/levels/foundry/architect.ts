import {
  ARCHITECT,
  ARCHITECT_PARTS,
  type ArchitectPartKind,
  type ArchitectPartSpec,
} from '../../../content/levels/foundry';
import { addKillScore } from '../../../sim/damage';
import { pinAnomaly } from '../../../sim/scroll';
import type { Anomaly, Asteroid, Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { BossRig, clearShotsToSalvage, type BossController, type PartSlot } from '../../boss';
import { spraySalvage } from '../../pickups';
import { aimAt, aimed, emitEnemyShotSfx, SHOT_SMALL, shootDir } from '../../enemies';
import {
  collapseAnomaly,
  collapsePortalPair,
  flingRock,
  releaseRock,
  removeBubble,
  removeShadeSlab,
  setPulsarPattern,
  spawnBlackHole,
  spawnBubble,
  spawnPortalPair,
  spawnPulsar,
  spawnRock,
  spawnShadeSlab,
  startFlare,
  stopFlares,
  swapPortals,
  towRock,
  type Bubble,
  type PortalPair,
  type ShadeSlab,
} from '../../obstacles';

// The Architect (design.md → Level 10): three forms on one boss bar. Every
// part spawns with the fight; the later forms' parts wait parked off screen
// (untargetable, absorbing nothing) until their form begins, so the HUD bar
// spans the whole fight. Each core dies like any part; the controller then
// plays the transition (invulnerable), cleaning up every hazard of the old
// form before the next one starts.
//   Scaffold: two crane arms orbit and throw hull scrap; the core (armored
//     until both arms fall) fires aimed 5-way fans.
//   Singularity Engine: a captive massive hole sways below the core against
//     its strafe; four pylons fire aimed shots the hole bends; magnetar rings
//     pulse from the core (shielded until three pylons fall).
//   Paradox Core: flares (the boss drops shade slabs first), two portal pairs
//     re-paired every 6 s, a flip bubble around the core, a 6-arm spiral.

export const ArchPhase = {
  Entry: 0,
  Scaffold: 1,
  Fall: 2,
  Engine: 3,
  Collapse: 4,
  Paradox: 5,
  Dying: 6,
  Done: 7,
} as const;
export type ArchPhaseId = (typeof ArchPhase)[keyof typeof ArchPhase];

const PHASE_NAMES = [
  'entry',
  'scaffold',
  'fall',
  'engine',
  'collapse',
  'paradox',
  'dying',
  'done',
] as const;

const A = ARCHITECT;
const SC = A.scaffold;
const EN = A.engine;
const PX = A.paradox;
const TAU = Math.PI * 2;
const SPARKS = 16;
const POPS = 24;
const PING_GAP = 0.12;
const DEFEAT_P = { defId: '', x: 0, y: 0 };
const SFX_P = { id: '', x: 0 as number | undefined };
const SHAKE_P = { mag: 0, dur: 0 };
const HAPTIC_P = { kind: 'medium' as 'light' | 'medium' | 'heavy' };
const ROCK_INIT = { size: 'medium' as const, x: 0, y: 0, vx: 0, vy: 0, hp: 0 };
const HOLE_P = { variant: EN.hole.variant, vx: 0, vy: 0 };
const PULSAR_P = { variant: 'magnetar', vx: 0, vy: 0, phase: EN.ring.period / 2 };
const BUBBLE_P = { kind: 'flip' as const, r: PX.bubbleR, vx: 0, vy: 0 };
const PORTAL_O = { color: 'cyan' as 'cyan' | 'orange' };
const SLAB_O = { vx: 0, vy: PX.slabVy };
const FLARE_O = { warn: PX.flare.warn, burn: PX.flare.burn };
const RING_PATTERN = {
  period: EN.ring.period,
  gaps: EN.ring.gaps,
  gapDeg: EN.ring.gapDeg,
  gapSpin: EN.ring.gapSpin,
  telegraph: EN.ring.telegraph,
  ringSpeed: EN.ring.speed,
};

/** One arm's hull scrap. */
interface ArmRock {
  rock: Asteroid | null;
  rockId: number;
  /** Seconds to the next throw; the emitter glows for the last `telegraph`. */
  throwT: number;
  /** Seconds until a fresh rock is hauled in (after a throw or a break). */
  regrab: number;
  angle: number;
}

export class Architect implements BossController {
  readonly defId = A.id;
  readonly rig: BossRig;
  readonly specs: readonly ArchitectPartSpec[];
  phase: ArchPhaseId = ArchPhase.Entry;
  phaseT = 0;
  t = 0;
  /** Seconds into the current form (entry and transitions count 0). */
  formT = 0;

  /** The live position the current form's core holds (parts hang off it). */
  cx = 120;
  cy: number = A.entry.fromY;

  readonly armI: number[] = [];
  readonly pylonI: number[] = [];
  readonly core1I: number;
  readonly core2I: number;
  readonly core3I: number;
  readonly arms: ArmRock[] = [];
  fanT = 0;
  readonly pylonT: number[] = [];

  hole: Anomaly | null = null;
  holeId = -1;
  holeX = 120;
  /** The massive hole's full pull; the live pull follows the pylons still standing. */
  holeStrength = 0;
  pulsar: Anomaly | null = null;
  pulsarId = -1;

  readonly pairs: (PortalPair | null)[] = [null, null];
  readonly pairIds: number[] = [-1, -1];
  bubble: Bubble | null = null;
  readonly slabs: (ShadeSlab | null)[] = [null, null, null, null];
  slabNext = 0;
  swapT = 0;
  flareT = 0;
  slabsDropped = false;
  spiralT = 0;
  spiralGap = 0;
  spiralRot = 0;

  /** Deflect sparks: x, y, age. */
  readonly sparks = new Float32Array(SPARKS * 3).fill(99);
  /** Death pops and transition pops: x, y, age, size. */
  readonly pops = new Float32Array(POPS * 4).fill(99);
  /** Where the scaffold's wreck started falling (draw). */
  fallX = 120;
  fallY = 0;
  private sparkI = 0;
  private sparkSeq = 0;
  private popI = 0;
  private popT = 0;
  private pingT = 0;
  private pingWanted = false;
  private pingX = 0;
  private defeated = false;
  /** Per slot: its loss was handled (salvage paid, or it went with its form). */
  private readonly handled: boolean[];

  constructor() {
    this.specs = ARCHITECT_PARTS;
    this.rig = new BossRig(ARCHITECT_PARTS);
    this.handled = new Array<boolean>(ARCHITECT_PARTS.length).fill(false);
    ARCHITECT_PARTS.forEach((s, i) => {
      if (s.kind === 'arm') {
        this.armI.push(i);
        this.arms.push({ rock: null, rockId: -1, throwT: 0, regrab: 0, angle: 0 });
      }
      if (s.kind === 'pylon') {
        this.pylonI.push(i);
        this.pylonT.push(0);
      }
    });
    this.core1I = ARCHITECT_PARTS.findIndex((s) => s.kind === 'core1');
    this.core2I = ARCHITECT_PARTS.findIndex((s) => s.kind === 'core2');
    this.core3I = ARCHITECT_PARTS.findIndex((s) => s.kind === 'core3');
  }

  kind(i: number): ArchitectPartKind {
    return (this.specs[i] as ArchitectPartSpec).kind;
  }

  slot(i: number): PartSlot {
    return this.rig.slots[i] as PartSlot;
  }

  /** The form whose parts are out (1–3), or 0 while none are (entry counts as 1). */
  form(): number {
    switch (this.phase) {
      case ArchPhase.Entry:
      case ArchPhase.Scaffold:
        return 1;
      case ArchPhase.Engine:
        return 2;
      case ArchPhase.Paradox:
      case ArchPhase.Dying:
        return 3;
      default:
        return 0;
    }
  }

  spawn(w: World): boolean {
    this.cx = w.width / 2;
    this.cy = A.entry.fromY;
    const ok = this.rig.spawn(w, this.cx, this.cy);
    this.placeParts(w, 0);
    return ok;
  }

  get done(): boolean {
    return this.phase === ArchPhase.Done;
  }

  phaseName(): string {
    return PHASE_NAMES[this.phase];
  }

  private invulnerable(): boolean {
    return (
      this.phase === ArchPhase.Entry ||
      this.phase === ArchPhase.Fall ||
      this.phase === ArchPhase.Collapse ||
      this.phase >= ArchPhase.Dying
    );
  }

  /** Arms alive (Scaffold) / pylons alive (Engine). */
  aliveCount(idx: readonly number[]): number {
    let n = 0;
    for (const i of idx) if (this.rig.alive(this.slot(i))) n++;
    return n;
  }

  /** Whether part i is out on the field (its form is up), not parked. */
  out(i: number): boolean {
    return (this.specs[i] as ArchitectPartSpec).form === this.form();
  }

  coreArmored(): boolean {
    if (this.phase === ArchPhase.Scaffold) return this.aliveCount(this.armI) > 0;
    if (this.phase === ArchPhase.Engine) return this.aliveCount(this.pylonI) > EN.shieldUntil;
    return false;
  }

  targetable(part: Enemy, slot: PartSlot): boolean {
    if (this.invulnerable() || part.y < 8) return false;
    const i = this.rig.slots.indexOf(slot);
    if (i < 0 || !this.out(i)) return false;
    const k = this.kind(i);
    if (k === 'core1' || k === 'core2') return !this.coreArmored();
    return true;
  }

  onDamage(part: Enemy, slot: PartSlot, _amount: number): boolean {
    const i = this.rig.slots.indexOf(slot);
    if (i < 0 || !this.out(i)) return true;
    if (this.invulnerable() || part.y < 0) {
      this.deflect(part);
      return true;
    }
    const k = this.kind(i);
    if ((k === 'core1' || k === 'core2') && this.coreArmored()) {
      this.deflect(part);
      return true;
    }
    return false;
  }

  private deflect(part: Enemy): void {
    const k = this.sparkSeq++;
    const i = this.sparkI;
    this.sparks[i * 3] = part.x + ((((k * 37) % 11) - 5) * part.r) / 6;
    this.sparks[i * 3 + 1] = part.y + part.r * 0.6 + ((k * 13) % 5) - 2;
    this.sparks[i * 3 + 2] = 0;
    this.sparkI = (i + 1) % SPARKS;
    this.pingWanted = true;
    this.pingX = part.x;
  }

  setPhase(p: ArchPhaseId): void {
    this.phase = p;
    this.phaseT = 0;
    this.formT = 0;
  }

  update(w: World, dt: number): void {
    this.t += dt;
    this.phaseT += dt;
    this.formT += dt;
    for (let i = 2; i < this.sparks.length; i += 3)
      this.sparks[i] = (this.sparks[i] as number) + dt;
    for (let i = 2; i < this.pops.length; i += 4) this.pops[i] = (this.pops[i] as number) + dt;
    this.pingT -= dt;
    if (this.pingWanted) {
      this.pingWanted = false;
      if (this.pingT <= 0 && this.phase < ArchPhase.Dying) {
        this.pingT = PING_GAP;
        this.sfx(w, 'armor_ping', this.pingX);
      }
    }

    this.move(w, dt);
    if (this.rig.moveTo(this.cx, this.cy, dt) > 0) this.payParts(w);
    this.placeParts(w, dt);

    switch (this.phase) {
      case ArchPhase.Entry:
        if (this.phaseT >= A.entry.time) this.startScaffold();
        break;
      case ArchPhase.Scaffold:
        this.tickArms(w, dt);
        this.fireFan(w, dt);
        if (this.slot(this.core1I).destroyed) this.startFall(w);
        break;
      case ArchPhase.Fall:
        this.tickPops(w, dt, 0.35);
        if (this.phaseT >= A.transition) this.startEngine(w);
        break;
      case ArchPhase.Engine:
        this.tickEngine(w, dt);
        if (this.slot(this.core2I).destroyed) this.startCollapse(w);
        break;
      case ArchPhase.Collapse:
        this.tickPops(w, dt, 0.4);
        if (this.phaseT >= A.transition) this.startParadox(w);
        break;
      case ArchPhase.Paradox:
        this.tickParadox(w, dt);
        if (this.slot(this.core3I).destroyed) this.defeat(w);
        break;
      case ArchPhase.Dying:
        this.tickPops(w, dt, A.deathPopGap);
        if (this.phaseT >= A.deathTime) {
          this.rig.release(w);
          this.setPhase(ArchPhase.Done);
        }
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Movement

  private move(_w: World, _dt: number): void {
    switch (this.phase) {
      case ArchPhase.Entry: {
        const k = Math.min(1, this.phaseT / A.entry.time);
        const e = 1 - (1 - k) * (1 - k);
        this.cx = 120;
        this.cy = A.entry.fromY + (A.entry.toY - A.entry.fromY) * e;
        return;
      }
      case ArchPhase.Scaffold: {
        this.cx = 120 + Math.sin((this.formT / SC.period) * TAU) * SC.strafe;
        this.cy = SC.y + Math.sin((this.formT / SC.bobPeriod) * TAU) * SC.bob;
        return;
      }
      case ArchPhase.Fall:
      case ArchPhase.Collapse: {
        // Ease back to the middle for the next form.
        const k = Math.min(1, this.phaseT / A.transition);
        const ty = this.phase === ArchPhase.Fall ? EN.y : PX.y;
        this.cx += (120 - this.cx) * Math.min(1, k * 0.2);
        this.cy += (ty - this.cy) * Math.min(1, k * 0.2);
        return;
      }
      case ArchPhase.Engine: {
        const s = Math.sin((this.formT / EN.period) * TAU);
        this.cx = 120 + s * EN.strafe;
        this.cy = EN.y;
        this.holeX = 120 - s * EN.hole.sway;
        return;
      }
      case ArchPhase.Paradox:
        this.cx = PX.x + Math.sin((this.formT / PX.px) * TAU) * PX.ax;
        this.cy = PX.y + Math.sin((this.formT / PX.py) * TAU) * PX.ay;
        return;
    }
  }

  /** Puts every live part where its form wants it; parked parts wait off screen. */
  private placeParts(_w: World, dt: number): void {
    const slots = this.rig.slots;
    const form = this.form();
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i] as PartSlot;
      if (!this.rig.alive(s)) continue;
      const e = s.enemy as Enemy;
      const spec = this.specs[i] as ArchitectPartSpec;
      if (spec.form !== form) {
        e.x = e.prevX = this.cx + spec.ox;
        e.y = e.prevY = A.parkY;
        e.vx = e.vy = 0;
        continue;
      }
      const x = this.cx + spec.ox;
      const y = this.cy + spec.oy;
      // Coming out of the park: no interpolation streak.
      if (e.y <= A.parkY + 1) {
        e.prevX = x;
        e.prevY = y;
      }
      e.x = x;
      e.y = y;
      e.vx = dt > 0 ? (x - e.prevX) / dt : 0;
      e.vy = dt > 0 ? (y - e.prevY) / dt : 0;
    }
  }

  /** Arms and pylons shot down spray salvage where they hung. */
  private payParts(w: World): void {
    const slots = this.rig.slots;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i] as PartSlot;
      if (!s.destroyed || this.handled[i]) continue;
      this.handled[i] = true;
      const k = this.kind(i);
      if (k !== 'arm' && k !== 'pylon') continue;
      const spec = this.specs[i] as ArchitectPartSpec;
      spraySalvage(w, this.cx + spec.ox, this.cy + spec.oy, A.partSalvage[k]);
    }
  }

  // -------------------------------------------------------------------------
  // Form 1: Scaffold

  private startScaffold(): void {
    this.setPhase(ArchPhase.Scaffold);
    this.fanT = SC.fan.first;
    for (let k = 0; k < this.arms.length; k++) {
      const a = this.arms[k] as ArmRock;
      a.throwT = SC.throwEvery * (0.7 + k * 0.5);
      a.regrab = 0.2 + k * 0.4;
      a.angle = k * Math.PI;
    }
  }

  armRock(k: number): Asteroid | null {
    const a = this.arms[k] as ArmRock;
    const r = a.rock;
    return r !== null && r.active && r.id === a.rockId ? r : null;
  }

  /** True while arm k's emitter glows before a throw. */
  armHot(k: number): boolean {
    return (
      this.phase === ArchPhase.Scaffold &&
      this.armRock(k) !== null &&
      (this.arms[k] as ArmRock).throwT <= SC.telegraph
    );
  }

  private tickArms(w: World, dt: number): void {
    const om = TAU / SC.orbitPeriod;
    for (let k = 0; k < this.armI.length; k++) {
      const a = this.arms[k] as ArmRock;
      const s = this.slot(this.armI[k] as number);
      const rock = this.armRock(k);
      if (!this.rig.alive(s)) {
        if (rock !== null) releaseRock(rock);
        a.rock = null;
        continue;
      }
      const arm = s.enemy as Enemy;
      a.angle = (a.angle + (k === 0 ? om : -om) * dt) % TAU;
      if (rock === null) {
        a.rock = null;
        a.regrab -= dt;
        if (a.regrab <= 0) this.haulRock(w, k, arm);
        continue;
      }
      const ca = Math.cos(a.angle);
      const sa = Math.sin(a.angle);
      const tx = arm.x + ca * SC.orbitR;
      const ty = arm.y + sa * SC.orbitR;
      towRock(w, rock, tx, ty, SC.towK, arm.vx - sa * SC.orbitR * om, arm.vy + ca * SC.orbitR * om);
      a.throwT -= dt;
      if (a.throwT > 0) continue;
      a.throwT = SC.throwEvery;
      const p = w.player;
      if (p.alive && rock.y <= p.y - 24 && rock.y > 0) flingRock(w, rock, SC.throwSpeed, p.x, p.y);
      else flingRock(w, rock, SC.throwSpeed * 0.6, rock.x, rock.y + 100);
      a.rock = null;
      a.regrab = SC.regrab;
      this.sfx(w, 'boss_throw', arm.x);
    }
  }

  private haulRock(w: World, k: number, arm: Enemy): void {
    const a = this.arms[k] as ArmRock;
    ROCK_INIT.x = arm.x;
    ROCK_INIT.y = -28;
    ROCK_INIT.vx = 0;
    ROCK_INIT.vy = 40;
    ROCK_INIT.hp = SC.rockHp;
    const r = spawnRock(w, ROCK_INIT);
    if (r === null) {
      a.regrab = 1;
      return;
    }
    a.rock = r;
    a.rockId = r.id;
    // A fresh catch can't be thrown before it is in orbit and has glowed.
    if (a.throwT < SC.telegraph + 1) a.throwT = SC.telegraph + 1;
    towRock(w, r, arm.x, arm.y + SC.orbitR, SC.towK, 0, 0);
  }

  private canShoot(w: World, y: number): boolean {
    const p = w.player;
    return p.alive && this.formT >= A.wake && y <= p.y - 24;
  }

  private fireFan(w: World, dt: number): void {
    this.fanT -= dt;
    if (this.fanT > 0) return;
    this.fanT += SC.fan.interval;
    const my = this.cy + 12;
    if (!this.canShoot(w, my)) return;
    if (aimed(w, this.cx, my, SC.fan.n, SC.fan.spreadDeg, SC.fan.speed, SHOT_SMALL) > 0)
      emitEnemyShotSfx(w, this.cx);
  }

  private startFall(w: World): void {
    this.fallX = this.cx;
    this.fallY = this.cy;
    for (let k = 0; k < this.arms.length; k++) {
      const r = this.armRock(k);
      if (r !== null) releaseRock(r);
      (this.arms[k] as ArmRock).rock = null;
    }
    this.setPhase(ArchPhase.Fall);
    spraySalvage(w, this.cx, this.cy, A.formSalvage);
    this.popT = 0;
    this.big(w, 3.5, 0.7);
  }

  // -------------------------------------------------------------------------
  // Form 2: Singularity Engine

  private startEngine(w: World): void {
    this.setPhase(ArchPhase.Engine);
    this.holeX = 120;
    const h = spawnBlackHole(w, this.holeX, EN.hole.y, HOLE_P);
    if (h !== null) {
      pinAnomaly(h);
      this.hole = h;
      this.holeId = h.id;
      this.holeStrength = h.strength;
    }
    const p = spawnPulsar(w, this.cx, this.cy, PULSAR_P);
    if (p !== null) {
      pinAnomaly(p);
      setPulsarPattern(p, RING_PATTERN);
      p.radius = EN.ring.reach;
      this.pulsar = p;
      this.pulsarId = p.id;
    }
    for (let k = 0; k < this.pylonT.length; k++)
      this.pylonT[k] = EN.pylonShot.first + k * (EN.pylonShot.interval / this.pylonT.length);
    this.sfx(w, 'boss_warning');
  }

  liveHole(): Anomaly | null {
    const a = this.hole;
    return a !== null && a.active && a.id === this.holeId ? a : null;
  }

  livePulsar(): Anomaly | null {
    const a = this.pulsar;
    return a !== null && a.active && a.id === this.pulsarId ? a : null;
  }

  private tickEngine(w: World, dt: number): void {
    const h = this.liveHole();
    if (h !== null) {
      h.x = h.prevX = this.holeX;
      h.y = h.prevY = EN.hole.y;
      h.vx = h.vy = 0;
      const k = this.aliveCount(this.pylonI) / this.pylonI.length;
      h.strength = this.holeStrength * (EN.minPull + (EN.maxPull - EN.minPull) * k);
    }
    const p = this.livePulsar();
    if (p !== null) {
      p.x = p.prevX = this.cx;
      p.y = p.prevY = this.cy;
    }
    for (let k = 0; k < this.pylonI.length; k++) {
      const s = this.slot(this.pylonI[k] as number);
      if (!this.rig.alive(s)) continue;
      const left = (this.pylonT[k] as number) - dt;
      this.pylonT[k] = left;
      if (left > 0) continue;
      this.pylonT[k] = left + EN.pylonShot.interval;
      const e = s.enemy as Enemy;
      const my = e.y + 6;
      if (!this.canShoot(w, my)) continue;
      if (shootDir(w, e.x, my, aimAt(w, e.x, my), EN.pylonShot.speed, SHOT_SMALL) > 0)
        emitEnemyShotSfx(w, e.x);
    }
  }

  private startCollapse(w: World): void {
    const h = this.liveHole();
    if (h !== null) collapseAnomaly(w, h, EN.hole.collapse);
    const p = this.livePulsar();
    if (p !== null) collapseAnomaly(w, p, 0.6);
    this.hole = this.pulsar = null;
    // Pylons still standing go with the engine.
    for (const i of this.pylonI) {
      const s = this.slot(i);
      if (!this.rig.alive(s)) continue;
      this.handled[i] = true;
      const e = s.enemy as Enemy;
      this.pop(e.x, e.y, 32);
      w.enemies.release(e);
    }
    this.setPhase(ArchPhase.Collapse);
    spraySalvage(w, this.cx, this.cy, A.formSalvage);
    this.popT = 0;
    this.big(w, 3, 0.6);
  }

  // -------------------------------------------------------------------------
  // Form 3: Paradox Core

  private startParadox(w: World): void {
    this.setPhase(ArchPhase.Paradox);
    for (let i = 0; i < PX.portals.length; i++) {
      const [ax, ay, bx, by] = PX.portals[i] as readonly [number, number, number, number];
      PORTAL_O.color = i === 0 ? 'cyan' : 'orange';
      const pr = spawnPortalPair(w, ax, ay, bx, by, PORTAL_O);
      this.pairs[i] = pr;
      this.pairIds[i] = pr === null ? -1 : pr.id;
    }
    this.bubble = spawnBubble(w, this.cx, this.cy, BUBBLE_P);
    this.swapT = PX.swapEvery;
    this.flareT = PX.firstFlare;
    this.slabsDropped = false;
    this.spiralT = 0;
    this.spiralGap = A.wake;
    this.sfx(w, 'boss_warning');
  }

  livePair(i: number): PortalPair | null {
    const p = this.pairs[i];
    return p !== null && p !== undefined && p.active && p.id === this.pairIds[i] ? p : null;
  }

  private tickParadox(w: World, dt: number): void {
    const b = this.bubble;
    if (b !== null && b.active) {
      b.prevX = b.x;
      b.prevY = b.y;
      b.x = this.cx;
      b.y = this.cy;
    }
    this.swapT -= dt;
    if (this.swapT <= 0) {
      this.swapT += PX.swapEvery;
      const p = this.livePair(0);
      const q = this.livePair(1);
      if (p !== null && q !== null) swapPortals(w, p, q);
    }
    this.flareT -= dt;
    if (!this.slabsDropped && this.flareT <= PX.slabLead) {
      this.slabsDropped = true;
      this.dropSlabs(w);
    }
    if (this.flareT <= 0) {
      this.flareT += PX.flareEvery;
      this.slabsDropped = false;
      startFlare(w, FLARE_O);
    }
    this.fireSpiral(w, dt);
  }

  private dropSlabs(w: World): void {
    for (const side of [-1, 1]) {
      const x = Math.max(28, Math.min(w.width - 28, this.cx + side * PX.slabDx));
      const old = this.slabs[this.slabNext];
      if (old !== null && old !== undefined && old.active) removeShadeSlab(w, old);
      this.slabs[this.slabNext] = spawnShadeSlab(w, x, this.cy + 60, SLAB_O);
      this.slabNext = (this.slabNext + 1) % this.slabs.length;
    }
    this.sfx(w, 'boss_throw', this.cx);
  }

  private fireSpiral(w: World, dt: number): void {
    const c = PX.spiral;
    this.spiralT += dt;
    const cycle = c.on + c.off;
    if (this.spiralT >= cycle) this.spiralT -= cycle;
    if (this.spiralT >= c.on) return;
    this.spiralGap -= dt;
    if (this.spiralGap > 0) return;
    this.spiralGap += c.gap;
    if (!this.canShoot(w, this.cy)) return;
    let n = 0;
    for (let a = 0; a < c.arms; a++)
      n += shootDir(w, this.cx, this.cy, this.spiralRot + (a * 360) / c.arms, c.speed, SHOT_SMALL);
    if (n > 0 && Math.floor(this.spiralT / 0.6) !== Math.floor((this.spiralT - c.gap) / 0.6))
      emitEnemyShotSfx(w, this.cx);
    this.spiralRot = (this.spiralRot + c.rotStep) % 360;
  }

  /** Every hazard the boss owns goes: portals, bubble, slabs, flares, rocks, hole, pulsar. */
  cleanup(w: World): void {
    for (let i = 0; i < this.pairs.length; i++) {
      const p = this.livePair(i);
      if (p !== null) collapsePortalPair(w, p);
      this.pairs[i] = null;
    }
    const b = this.bubble;
    if (b !== null && b.active) removeBubble(w, b);
    this.bubble = null;
    for (let i = 0; i < this.slabs.length; i++) {
      const s = this.slabs[i];
      if (s !== null && s !== undefined && s.active) removeShadeSlab(w, s);
      this.slabs[i] = null;
    }
    stopFlares(w);
    for (let k = 0; k < this.arms.length; k++) {
      const r = this.armRock(k);
      if (r !== null) releaseRock(r);
    }
    const h = this.liveHole();
    if (h !== null) collapseAnomaly(w, h, 0.3);
    const p = this.livePulsar();
    if (p !== null) collapseAnomaly(w, p, 0.3);
  }

  private defeat(w: World): void {
    if (this.defeated) return;
    this.defeated = true;
    this.cleanup(w);
    const run = w.run;
    run.bossDefeated = true;
    run.kills++;
    addKillScore(w, A.score);
    this.setPhase(ArchPhase.Dying);
    this.popT = 0;
    DEFEAT_P.defId = A.id;
    DEFEAT_P.x = this.cx;
    DEFEAT_P.y = this.cy;
    w.events.emit('bossDefeated', DEFEAT_P);
    this.sfx(w, 'boss_die', this.cx);
    HAPTIC_P.kind = 'heavy';
    w.events.emit('haptic', HAPTIC_P);
    clearShotsToSalvage(w, A.shotSalvageMax);
    // Nothing left on the field may hurt the ship after the win.
    const rocks = w.asteroids.items;
    for (let i = 0; i < w.asteroids.count; i++) {
      const a = rocks[i];
      if (a !== undefined && a.active) w.asteroids.release(a);
    }
  }

  // -------------------------------------------------------------------------
  // Pops (transitions and the death chain)

  private pop(x: number, y: number, size: number): void {
    const i = this.popI;
    this.pops[i * 4] = x;
    this.pops[i * 4 + 1] = y;
    this.pops[i * 4 + 2] = 0;
    this.pops[i * 4 + 3] = size;
    this.popI = (i + 1) % POPS;
  }

  private tickPops(w: World, dt: number, gap: number): void {
    this.popT -= dt;
    let n = 0;
    while (this.popT <= 0) {
      this.popT += gap;
      const rng = w.rng;
      const spread = this.phase === ArchPhase.Fall ? 56 : 22;
      const x = this.cx + rng.range(-spread, spread);
      const y =
        this.cy + rng.range(-14, 18) + (this.phase === ArchPhase.Fall ? this.phaseT * 30 : 0);
      const size = rng.next() < 0.3 ? 48 : rng.next() < 0.6 ? 32 : 16;
      this.pop(x, y, size);
      if (n++ % 2 === 0) this.sfx(w, size === 16 ? 'enemy_die_s' : 'enemy_die_m', x);
      if (size === 48) this.big(w, 2.5, 0.3);
    }
  }

  private big(w: World, mag: number, dur: number): void {
    SHAKE_P.mag = mag;
    SHAKE_P.dur = dur;
    w.events.emit('shake', SHAKE_P);
  }

  private sfx(w: World, id: string, x?: number): void {
    SFX_P.id = id;
    SFX_P.x = x;
    w.events.emit('sfx', SFX_P);
  }

  // -------------------------------------------------------------------------
  // Dev skips (sandbox and browser checks).

  /** Kills the current form's parts so the next transition starts at once. */
  skipForm(w: World): void {
    const ids =
      this.phase === ArchPhase.Scaffold
        ? [...this.armI, this.core1I]
        : this.phase === ArchPhase.Engine
          ? [...this.pylonI, this.core2I]
          : this.phase === ArchPhase.Paradox
            ? [this.core3I]
            : [];
    if (this.phase === ArchPhase.Entry) this.phaseT = A.entry.time;
    for (const i of ids) {
      const s = this.slot(i);
      if (this.rig.alive(s)) w.enemies.release(s.enemy as Enemy);
    }
  }
}
