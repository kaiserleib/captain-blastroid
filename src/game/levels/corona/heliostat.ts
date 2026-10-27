import { HELIOSTAT, type HeliostatDef } from '../../../content/levels/corona';
import { addKillScore, HIT_FLASH } from '../../../sim/damage';
import type { Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { BossRig, clearShotsToSalvage, type BossController, type PartSlot } from '../../boss';
import { emitToast } from '../../director';
import { spraySalvage } from '../../pickups';
import { aimAt, emitEnemyShotSfx, shootDir, SHOT_SMALL } from '../../enemies';
import {
  cancelFlare,
  flarePhase,
  flareState,
  registerShadeCaster,
  spawnShadeSlab,
  startFlare,
  type ShadeSlab,
} from '../../obstacles';

// Heliostat: a mirror-array sun collector. It strafes slowly at the top;
// its hull throws a shadow (the core entity is the registered caster).
//   phase 1   two mirrors at a time sweep beams (lines of shots) at a 25°
//             slant toward the middle, ±30° over 3 s after a 0.6 s
//             telegraph; the pairs alternate every 6 s. A flare every 11 s,
//             each preceded by a shade slab dropped into the lower half.
//   furnace   (3 mirrors down) the core opens: a 6-arm spiral (a 6-way ring
//             every 0.2 s for 1.6 s, then a 2 s pause, turning 11° a ring),
//             flares every 7 s with two slabs first, and the last mirror
//             bends one beam through each burn.

export const HelioPhase = { Entry: 0, P1: 1, Furnace: 2, Dying: 3, Done: 4 } as const;
export type HelioPhaseId = (typeof HelioPhase)[keyof typeof HelioPhase];

const PHASE_NAMES = ['entry', 'phase1', 'furnace', 'dying', 'done'] as const;

/** Per-mirror beam state. */
export const BeamState = { Off: 0, Telegraph: 1, On: 2 } as const;

const DEG = Math.PI / 180;
const SPARKS = 10;
const GLINTS = 36;
const PING_GAP = 0.12;
/** Mirrors push out along their arm this far while beaming, px. */
const REACH = 3;
/** Beam shots leave the mirror's face this far out, px. */
const MUZZLE = 6;
const MAX_DROPS = 2;
const BEAM_MIN_DEG = 20;
const BEAM_MAX_DEG = 160;

const DEFEAT_P = { defId: '', x: 0, y: 0 };
const SFX_P = { id: '', x: 0 as number | undefined };
const SHAKE_P = { mag: 0, dur: 0 };
const SLAB_O = { vx: 0, vy: 0 };
const FLARE_O = { warn: 0 };

interface Drop {
  slab: ShadeSlab | null;
  landY: number;
}

export class Heliostat implements BossController {
  readonly defId: string;
  readonly def: HeliostatDef;
  readonly rig: BossRig;
  readonly core: PartSlot;
  readonly mirrors: PartSlot[];
  phase: HelioPhaseId = HelioPhase.Entry;
  phaseT = 0;
  t = 0;
  fightT = 0;
  /** Strafe clock: it stops while a flare warns or burns, so the hull's shadow holds still. */
  moveT = 0;
  mirrorsLost = 0;
  /** Pair firing now: 0 = the outer mirrors (0, 3), 1 = the inner (1, 2). */
  pair = 0;
  /** Seconds into the current pair's cycle. */
  cycleT = 0;
  /** Sweep direction, flipped each cycle. */
  sweepDir = 1;
  readonly beam: number[];
  /** Beam heading now (degrees) and the sweep's ends. */
  readonly heading: number[];
  readonly from: number[];
  readonly to: number[];
  private readonly emitT: number[];
  /** Seconds the current beam has run / its sweep length. */
  private readonly beamT: number[];
  private readonly beamLen: number[];
  /** Arm extension 0..1 per mirror (eases toward 1 while beaming). */
  readonly reach: number[];
  /** Seconds to the next flare's warning. */
  flareT = 0;
  private slabsDropped = false;
  /** Flares this fight started (the furnace bend beam answers each once). */
  flaresStarted = 0;
  private bendFlare = -1;
  readonly drops: Drop[];
  /** Spiral: rings left in this burst, seconds to the next ring, rotation. */
  private spiralLeft = 0;
  private spiralT = 0;
  spiralRot = 0;
  /** Seconds since the last spiral ring (core flare in the draw). */
  sinceRing = 9;
  pendingDefeat = false;
  defeatEmitted = false;
  readonly sparks = new Float32Array(SPARKS * 3).fill(99);
  private sparkI = 0;
  private sparkSeq = 0;
  /** Shatter glints: x, y, vx, vy per glint; `glintT` is their age. */
  readonly glints = new Float32Array(GLINTS * 4);
  glintN = 0;
  glintT = 0;
  private pingT = 0;
  private pingWanted = false;
  private pingX = 0;

  constructor(def: HeliostatDef = HELIOSTAT) {
    this.def = def;
    this.defId = def.id;
    this.rig = new BossRig(def.parts);
    this.core = this.rig.slots.find((s) => s.spec.role === 'core') as PartSlot;
    this.mirrors = this.rig.slots.filter((s) => s.spec.role === 'turret');
    const z = () => this.mirrors.map(() => 0);
    this.beam = z();
    this.heading = this.mirrors.map(() => 90);
    this.from = this.mirrors.map(() => 90);
    this.to = this.mirrors.map(() => 90);
    this.emitT = z();
    this.beamT = z();
    this.beamLen = z();
    this.reach = z();
    this.drops = [];
    for (let i = 0; i < MAX_DROPS; i++) this.drops.push({ slab: null, landY: 0 });
  }

  spawn(w: World): boolean {
    const ok = this.rig.spawn(w, w.width / 2, this.def.entry.fromY);
    this.flareT = this.def.flare.first;
    return ok;
  }

  get done(): boolean {
    return this.phase === HelioPhase.Done;
  }

  invulnerable(): boolean {
    return this.phase === HelioPhase.Entry || this.phase >= HelioPhase.Dying;
  }

  targetable(_part: Enemy, slot: PartSlot): boolean {
    return !this.invulnerable() && slot.targetable;
  }

  phaseName(): string {
    return PHASE_NAMES[this.phase];
  }

  /** Side of mirror i: -1 left, +1 right. */
  side(i: number): number {
    return (this.mirrors[i] as PartSlot).spec.ox < 0 ? -1 : 1;
  }

  mirrorAlive(i: number): boolean {
    return this.rig.alive(this.mirrors[i] as PartSlot);
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
      this.setPhase(HelioPhase.Dying);
      return true;
    }
    return false;
  }

  private deflect(part: Enemy): void {
    const k = this.sparkSeq++;
    const i = this.sparkI;
    this.sparks[i * 3] = part.x + ((((k * 37) % 11) - 5) * part.r) / 6;
    this.sparks[i * 3 + 1] = part.y + part.r * 0.55 + ((k * 13) % 5) - 2;
    this.sparks[i * 3 + 2] = 0;
    this.sparkI = (i + 1) % SPARKS;
    this.pingWanted = true;
    this.pingX = part.x;
  }

  private setPhase(p: HelioPhaseId): void {
    this.phase = p;
    this.phaseT = 0;
  }

  update(w: World, dt: number): void {
    this.t += dt;
    this.phaseT += dt;
    this.sinceRing += dt;
    for (let i = 2; i < this.sparks.length; i += 3)
      this.sparks[i] = (this.sparks[i] as number) + dt;
    this.pingT -= dt;
    if (this.pingWanted) {
      this.pingWanted = false;
      if (this.pingT <= 0 && this.phase < HelioPhase.Dying) {
        this.pingT = PING_GAP;
        this.sfx(w, 'armor_ping', this.pingX);
      }
    }
    if (this.pendingDefeat && !this.defeatEmitted) this.defeat(w);

    this.move(w, dt);
    this.landSlabs();

    switch (this.phase) {
      case HelioPhase.Entry:
        if (this.phaseT >= this.def.entry.duration) {
          this.setPhase(HelioPhase.P1);
          const c = this.core.enemy;
          if (c !== null && this.rig.alive(this.core))
            registerShadeCaster(w, c.id, this.def.shade.halfWidth, this.def.shade.halfHeight);
        }
        break;
      case HelioPhase.P1:
        this.fightT += dt;
        this.cycleBeams(w, dt);
        this.runFlares(w, dt, this.def.flare.every, 1);
        break;
      case HelioPhase.Furnace:
        this.fightT += dt;
        this.bendBeam(w);
        this.runFlares(w, dt, this.def.flare.everyFurnace, 2);
        this.fireSpiral(w, dt);
        break;
      case HelioPhase.Dying:
        this.glintT += dt;
        this.moveGlints(dt);
        if (this.phaseT >= this.def.deathTime) {
          this.rig.release(w);
          this.setPhase(HelioPhase.Done);
        }
        break;
    }
    this.fireBeams(w, dt);
  }

  // -------------------------------------------------------------------------
  // Movement

  private move(w: World, dt: number): void {
    const d = this.def;
    let x: number;
    let y: number;
    if (this.phase === HelioPhase.Entry) {
      const k = Math.min(1, this.phaseT / d.entry.duration);
      const e = 1 - (1 - k) * (1 - k) * (1 - k);
      x = w.width / 2;
      y = d.entry.fromY + (d.entry.toY - d.entry.fromY) * e;
    } else if (this.phase >= HelioPhase.Dying) {
      x = this.rig.x;
      y = this.rig.y + (this.phase === HelioPhase.Dying ? 4 * dt : 0);
    } else {
      const ph = flarePhase(w);
      if (ph !== 'warn' && ph !== 'burn') this.moveT += dt;
      const s = d.strafe;
      const mid = (s.minX + s.maxX) / 2;
      const amp = (s.maxX - s.minX) / 2;
      x = mid + Math.sin((this.moveT / s.period) * Math.PI * 2) * amp;
      y = d.entry.toY + Math.sin((this.moveT / s.bobPeriod) * Math.PI * 2) * s.bobAmp;
    }
    const lost = this.rig.moveTo(x, y, dt);
    this.placeMirrors(dt);
    if (lost > 0) this.onPartsLost(w);
  }

  /** Mirror i's position for drawing and firing (its arm reaches out while it beams). */
  mirrorX(i: number): number {
    const s = (this.mirrors[i] as PartSlot).spec;
    return this.rig.x + s.ox + this.side(i) * REACH * (this.reach[i] as number);
  }

  mirrorY(i: number): number {
    const s = (this.mirrors[i] as PartSlot).spec;
    return this.rig.y + s.oy + REACH * 0.6 * (this.reach[i] as number);
  }

  private placeMirrors(dt: number): void {
    for (let i = 0; i < this.mirrors.length; i++) {
      const want = this.beam[i] !== BeamState.Off ? 1 : 0;
      const r = this.reach[i] as number;
      this.reach[i] = r + (want - r) * Math.min(1, dt * 8);
      const s = this.mirrors[i] as PartSlot;
      if (!this.rig.alive(s)) continue;
      const e = s.enemy as Enemy;
      e.x = this.mirrorX(i);
      e.y = this.mirrorY(i);
    }
  }

  private onPartsLost(w: World): void {
    let down = 0;
    for (let i = 0; i < this.mirrors.length; i++) {
      const s = this.mirrors[i] as PartSlot;
      if (!s.destroyed) continue;
      down++;
      this.beam[i] = BeamState.Off;
      // Lost this tick: the shattered mirror pays like the Leviathan's guns.
      if (s.deadT === 0 && this.phase < HelioPhase.Dying)
        spraySalvage(w, this.mirrorX(i), this.mirrorY(i), this.def.mirrorSalvage);
    }
    if (down <= this.mirrorsLost) return;
    this.mirrorsLost = down;
    SHAKE_P.mag = this.def.mirrorShake.mag;
    SHAKE_P.dur = this.def.mirrorShake.dur;
    w.events.emit('shake', SHAKE_P);
    if (down >= this.def.furnaceAfter && this.phase === HelioPhase.P1) this.startFurnace(w);
  }

  private startFurnace(w: World): void {
    this.setPhase(HelioPhase.Furnace);
    this.core.targetable = true;
    for (let i = 0; i < this.beam.length; i++) this.beam[i] = BeamState.Off;
    // The next flare comes on the furnace's clock, but never before its slab lead.
    const lead = this.def.flare.slabLead;
    this.flareT = Math.max(lead + 0.6, Math.min(this.flareT, this.def.flare.everyFurnace));
    this.slabsDropped = false;
    this.spiralLeft = 0;
    this.spiralT = 1;
    emitToast(w, 'SOLAR FURNACE');
    SHAKE_P.mag = 4;
    SHAKE_P.dur = 0.5;
    w.events.emit('shake', SHAKE_P);
    this.sfx(w, 'boss_throw', this.rig.x);
  }

  // -------------------------------------------------------------------------
  // Beams

  /** Phase 1: the pairs alternate every `cycle` s; each beam telegraphs, then sweeps. */
  private cycleBeams(w: World, dt: number): void {
    const b = this.def.beam;
    this.cycleT += dt;
    if (this.cycleT >= b.cycle) {
      this.cycleT -= b.cycle;
      this.pair ^= 1;
      this.sweepDir = -this.sweepDir;
    }
    if (this.cycleT - dt > 0 || !w.player.alive) return;
    // A new cycle: whichever of this pair still stands telegraphs. A pair that's
    // all gone hands its turn to the other.
    let pair = this.pair;
    if (!this.pairAlive(pair)) pair ^= 1;
    for (let i = 0; i < this.mirrors.length; i++) {
      if (this.pairOf(i) !== pair || !this.mirrorAlive(i)) continue;
      const c = 90 - this.side(i) * b.slant;
      const a = b.arc * this.sweepDir * this.side(i);
      this.arm(i, c - a, c + a, b.sweep);
    }
  }

  pairOf(i: number): number {
    return i === 0 || i === this.mirrors.length - 1 ? 0 : 1;
  }

  private pairAlive(pair: number): boolean {
    for (let i = 0; i < this.mirrors.length; i++)
      if (this.pairOf(i) === pair && this.mirrorAlive(i)) return true;
    return false;
  }

  /** Starts mirror i's telegraph for a sweep from → to (degrees) over `len` s. */
  private arm(i: number, from: number, to: number, len: number): void {
    this.from[i] = clampDeg(from);
    this.to[i] = clampDeg(to);
    this.heading[i] = this.from[i] as number;
    this.beam[i] = BeamState.Telegraph;
    this.beamT[i] = 0;
    this.beamLen[i] = len;
    this.emitT[i] = 0;
  }

  /** Solar Furnace: the last mirror bends one beam through each burn. */
  private bendBeam(w: World): void {
    const f = flareState(w);
    if (f === undefined || this.flaresStarted === this.bendFlare) return;
    if (f.phase !== 'warn' || f.fizzled || f.practice) return;
    if (f.warn - f.t > this.def.beam.telegraph) return;
    this.bendFlare = this.flaresStarted;
    for (let i = 0; i < this.mirrors.length; i++) {
      if (!this.mirrorAlive(i)) continue;
      // Centered on the ship's bearing, so the sweep crosses its shade.
      const c = aimAt(w, this.mirrorX(i), this.mirrorY(i));
      const a = this.def.beam.arc * this.side(i);
      this.arm(i, c - a, c + a, f.burn);
      return;
    }
  }

  private fireBeams(w: World, dt: number): void {
    const b = this.def.beam;
    const live = this.phase === HelioPhase.P1 || this.phase === HelioPhase.Furnace;
    const py = w.player.y;
    for (let i = 0; i < this.mirrors.length; i++) {
      const st = this.beam[i] as number;
      if (st === BeamState.Off) continue;
      if (!live || !this.mirrorAlive(i)) {
        this.beam[i] = BeamState.Off;
        continue;
      }
      const t = (this.beamT[i] as number) + dt;
      this.beamT[i] = t;
      if (st === BeamState.Telegraph) {
        if (t < b.telegraph) continue;
        this.beam[i] = BeamState.On;
        this.beamT[i] = 0;
        continue;
      }
      const len = this.beamLen[i] as number;
      const k = Math.min(1, t / len);
      const h = (this.from[i] as number) + ((this.to[i] as number) - (this.from[i] as number)) * k;
      this.heading[i] = h;
      let left = (this.emitT[i] as number) - dt;
      let n = 0;
      const mx = this.mirrorX(i);
      const my = this.mirrorY(i);
      while (left <= 0) {
        left += b.gap;
        // Fairness: no beam from a mirror level with (or below) the ship.
        if (!w.player.alive || my > py - 24) continue;
        n += shootDir(
          w,
          mx + Math.cos(h * DEG) * MUZZLE,
          my + Math.sin(h * DEG) * MUZZLE,
          h,
          b.speed,
          SHOT_SMALL,
        );
      }
      this.emitT[i] = left;
      if (n > 0 && Math.floor(t / b.gap) % 4 === 0) emitEnemyShotSfx(w, mx);
      if (t >= len) this.beam[i] = BeamState.Off;
    }
  }

  // -------------------------------------------------------------------------
  // Flares and slabs

  private runFlares(w: World, dt: number, every: number, slabs: number): void {
    const fd = this.def.flare;
    this.flareT -= dt;
    if (!this.slabsDropped && this.flareT <= fd.slabLead) {
      this.slabsDropped = true;
      this.dropSlabs(w, slabs);
    }
    if (this.flareT > 0) return;
    // One already warning or burning (a timeline flare can't be, the clock is
    // frozen, but be safe): try again next tick.
    FLARE_O.warn = fd.warn;
    if (!startFlare(w, FLARE_O)) {
      this.flareT = 0;
      return;
    }
    this.flaresStarted++;
    this.flareT += every;
    this.slabsDropped = false;
  }

  private dropSlabs(w: World, n: number): void {
    const fd = this.def.flare;
    const rng = w.rng;
    const lo = 30;
    const hi = w.width - 30;
    const px = w.player.x;
    // Beside the ship, never over its column: a slab there would eat its fire
    // until the ship moves into the shadow for the flare.
    let side = rng.next() < 0.5 ? -1 : 1;
    for (let k = 0; k < n; k++) {
      if (k === 1) side = -side;
      let tx = px + side * rng.range(fd.minDx, fd.nearPlayer);
      if (tx < lo || tx > hi) tx = px - side * rng.range(fd.minDx, fd.nearPlayer);
      tx = clamp(tx, lo, hi);
      const d = this.drops[k] as Drop;
      const sx = this.rig.x;
      const sy = this.rig.y + this.def.shade.halfHeight + 6;
      d.landY = rng.range(fd.landY[0], fd.landY[1]);
      const time = Math.max(0.3, (d.landY - sy) / fd.dropSpeed);
      SLAB_O.vx = (tx - sx) / time;
      SLAB_O.vy = fd.dropSpeed;
      d.slab = spawnShadeSlab(w, sx, sy, SLAB_O);
    }
    if (n > 0) this.sfx(w, 'boss_throw', this.rig.x);
  }

  /** A dropping slab stops where it was aimed and drifts on slowly. */
  private landSlabs(): void {
    for (const d of this.drops) {
      const s = d.slab;
      if (s === null) continue;
      if (!s.active) {
        d.slab = null;
        continue;
      }
      if (s.y >= d.landY) {
        s.vx = 0;
        s.vy = this.def.flare.drift;
        d.slab = null;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Spiral

  private fireSpiral(w: World, dt: number): void {
    const sp = this.def.spiral;
    this.spiralT -= dt;
    if (this.spiralT > 0) return;
    if (this.spiralLeft <= 0) this.spiralLeft = sp.rings;
    this.spiralLeft--;
    this.spiralT += this.spiralLeft > 0 ? sp.interval : sp.pause + sp.interval;
    if (!w.player.alive) return;
    const c = this.core.enemy;
    if (c === null || !this.rig.alive(this.core)) return;
    let n = 0;
    for (let i = 0; i < sp.arms; i++) {
      const deg = this.spiralRot + (i * 360) / sp.arms;
      const x = c.x + Math.cos(deg * DEG) * (c.r + 2);
      const y = c.y + Math.sin(deg * DEG) * (c.r + 2);
      n += shootDir(w, x, y, deg, sp.speed, SHOT_SMALL);
    }
    if (n > 0) emitEnemyShotSfx(w, c.x);
    this.sinceRing = 0;
    this.spiralRot = (this.spiralRot + sp.turnDeg) % 360;
  }

  // -------------------------------------------------------------------------
  // Defeat

  private defeat(w: World): void {
    this.defeatEmitted = true;
    w.run.bossDefeated = true;
    w.run.kills++;
    addKillScore(w, this.def.score);
    // The furnace is out: a flare still warning or burning just fades.
    cancelFlare(w);
    this.shatter();
    DEFEAT_P.defId = this.def.id;
    DEFEAT_P.x = this.rig.x;
    DEFEAT_P.y = this.rig.y;
    w.events.emit('bossDefeated', DEFEAT_P);
    this.sfx(w, 'boss_die', this.rig.x);
    clearShotsToSalvage(w, this.def.shotSalvageMax);
  }

  /** Every mirror, standing or wrecked, bursts into glints (fixed fan, no rng). */
  private shatter(): void {
    const per = Math.floor(GLINTS / this.mirrors.length);
    let n = 0;
    for (let i = 0; i < this.mirrors.length; i++) {
      const x = this.mirrorX(i);
      const y = this.mirrorY(i);
      for (let k = 0; k < per; k++) {
        const a = ((k * 137 + i * 61) % 360) * DEG;
        const sp = 30 + ((k * 53 + i * 29) % 50);
        const g = n * 4;
        this.glints[g] = x;
        this.glints[g + 1] = y;
        this.glints[g + 2] = Math.cos(a) * sp;
        this.glints[g + 3] = Math.sin(a) * sp - 20;
        n++;
      }
    }
    this.glintN = n;
    this.glintT = 0;
  }

  private moveGlints(dt: number): void {
    for (let i = 0; i < this.glintN; i++) {
      const g = i * 4;
      this.glints[g] = (this.glints[g] as number) + (this.glints[g + 2] as number) * dt;
      this.glints[g + 1] = (this.glints[g + 1] as number) + (this.glints[g + 3] as number) * dt;
      this.glints[g + 3] = (this.glints[g + 3] as number) + 60 * dt;
    }
  }

  private sfx(w: World, id: string, x?: number): void {
    SFX_P.id = id;
    SFX_P.x = x;
    w.events.emit('sfx', SFX_P);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function clampDeg(d: number): number {
  return clamp(d, BEAM_MIN_DEG, BEAM_MAX_DEG);
}
