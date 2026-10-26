import type { AimedPattern } from '../../../content/enemies';
import { SHEPHERD, type ShepherdDef } from '../../../content/levels/ionShoals';
import { addKillScore, HIT_FLASH } from '../../../sim/damage';
import { spawnEnemy } from '../../../sim/spawn';
import type { Asteroid, Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { BossRig, clearShotsToSalvage, type BossController, type PartSlot } from '../../boss';
import { aimAt, burst, emitEnemyShotSfx, ring, SHOT_SMALL } from '../../enemies';
import { flingRock, releaseRock, spawnRock, towRock } from '../../obstacles';

// The Shepherd: descend → phase 1 (slow strafe; each tractor emitter keeps a
// large rock in orbit as a shield, they take turns throwing one every 5 s and
// tow a fresh one in from the top; aimed 3-bursts) → both emitters wrecked →
// the leftover rocks go as a pair while the core shutters open → phase 2
// (5-arm ion spiral, skiff waves) → core destroyed → 2 s death throes.

export const Phase = {
  Entry: 0,
  Fight: 1,
  Opening: 2,
  Exposed: 3,
  Dying: 4,
  Done: 5,
} as const;
export type PhaseId = (typeof Phase)[keyof typeof Phase];

const PHASE_NAMES = ['entry', 'fight', 'opening', 'exposed', 'dying', 'done'] as const;

/** What an orbit slot's rock is doing. */
export const Slot = {
  /** No rock; `wait` counts down to the next fetch. */
  Empty: 0,
  /** A fresh rock being hauled in from the top edge. */
  TowIn: 1,
  Orbit: 2,
  /** Swinging down to the release point before a throw (the tell). */
  Windup: 3,
} as const;
export type SlotMode = (typeof Slot)[keyof typeof Slot];

export interface OrbitSlot {
  mode: SlotMode;
  rock: Asteroid | null;
  rockId: number;
  /** Seconds in the current mode. */
  t: number;
  /** Empty: seconds until the next fetch. */
  wait: number;
  /** Windup: degrees added to the aim (the phase-2 pair). */
  aimOff: number;
  /** The emitter is gone; the core hauls this rock (no refetch). */
  orphan: boolean;
}

const DEG = Math.PI / 180;
const SPARKS = 12;
const PING_GAP = 0.12;
/** Seconds of core glow before each spiral burst. */
export const SPIRAL_TELL = 0.5;
const DEFEAT_P = { defId: '', x: 0, y: 0 };
const SFX_P = { id: '', x: 0 as number | undefined };
const SHAKE_P = { mag: 0, dur: 0 };
const TARGET = { x: 0, y: 0 };
const VOLLEY: AimedPattern = { kind: 'aimed', n: 1, spreadDeg: 0, speed: 100 };
const SKIFF_O = { vx: 0, vy: 0 };

export class Shepherd implements BossController {
  readonly defId: string;
  readonly def: ShepherdDef;
  readonly rig: BossRig;
  phase: PhaseId = Phase.Entry;
  phaseT = 0;
  t = 0;
  sweep = 0.5;
  /** Orbit angle of slot 0, radians (slot 1 sits opposite). */
  orbitA = 0;
  readonly slots: [OrbitSlot, OrbitSlot];
  /** Seconds until the next 3-burst; the emitters take turns. */
  burstT = 0;
  nextShooter = 0;
  /** Seconds since each emitter last fired (muzzle flare). */
  emitterFired: [number, number] = [9, 9];
  flingT = 0;
  /** Which emitter throws next. */
  nextThrower = 0;
  /** Seconds since the last throw. */
  flungT = 9;
  spiralOn = false;
  spiralT = 0;
  ringT = 0;
  spiralRot = 0;
  skiffT = 0;
  skiffLeft = 0;
  skiffGapT = 0;
  skiffSide = 1;
  emittersLost = 0;
  pendingDefeat = false;
  defeatEmitted = false;
  readonly sparks = new Float32Array(SPARKS * 3).fill(99);
  private sparkI = 0;
  private sparkSeq = 0;
  private pingT = 0;
  private pingWanted = false;
  private pingX = 0;

  readonly core: PartSlot;
  readonly emitters: PartSlot[];

  constructor(def: ShepherdDef = SHEPHERD) {
    this.def = def;
    this.defId = def.id;
    this.rig = new BossRig(def.parts);
    this.core = this.rig.slots.find((s) => s.spec.role === 'core') as PartSlot;
    this.emitters = this.rig.slots.filter((s) => s.spec.role === 'turret');
    const slot = (): OrbitSlot => ({
      mode: Slot.Empty,
      rock: null,
      rockId: -1,
      t: 0,
      wait: 0,
      aimOff: 0,
      orphan: false,
    });
    this.slots = [slot(), slot()];
  }

  spawn(w: World): boolean {
    const ok = this.rig.spawn(w, w.width / 2, this.def.entry.fromY);
    this.burstT = this.def.burst.interval * 0.5;
    this.flingT = this.def.fling.firstDelay;
    // The shield is fetched during the descent, so it's up when the fight starts.
    this.slots[0].wait = 0.4;
    this.slots[1].wait = 1.1;
    return ok;
  }

  invulnerable(): boolean {
    return this.phase === Phase.Entry || this.phase >= Phase.Dying;
  }

  get done(): boolean {
    return this.phase === Phase.Done;
  }

  targetable(_part: Enemy, slot: PartSlot): boolean {
    return !this.invulnerable() && slot.targetable;
  }

  phaseName(): string {
    return PHASE_NAMES[this.phase];
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
      this.setPhase(Phase.Dying);
      return true;
    }
    return false;
  }

  /** The live rock in a slot, or null (shot apart, swallowed, recycled). */
  slotRock(s: OrbitSlot): Asteroid | null {
    const r = s.rock;
    return r !== null && r.active && r.id === s.rockId ? r : null;
  }

  /** Where slot i's orbit point is, and how fast it moves (written into TARGET-like out). */
  orbitPoint(i: number, out: { x: number; y: number; vx: number; vy: number }): void {
    const o = this.def.orbit;
    const a = this.orbitA + i * Math.PI;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    out.x = this.rig.x + ca * o.rx;
    out.y = this.rig.y + o.oy + sa * o.ry;
    out.vx = this.rig.vx - sa * o.rx * o.speed;
    out.vy = this.rig.vy + ca * o.ry * o.speed;
  }

  /**
   * Where slot i's beam leaves from: its emitter, or the core once the
   * emitter is gone. With `nearX`, the nearer living emitter instead (the
   * draw uses this so a beam never crosses the whole hull).
   */
  beamOrigin(i: number, out: { x: number; y: number }, alpha = 1, nearX?: number): void {
    let src = this.emitters[i] as PartSlot;
    if (src.destroyed || src.enemy === null) src = this.core;
    if (nearX !== undefined) {
      const other = this.emitters[1 - i] as PartSlot;
      if (!other.destroyed && other.enemy !== null) {
        const dSrc = src === this.core ? Infinity : Math.abs(this.rig.x + src.spec.ox - nearX);
        if (Math.abs(this.rig.x + other.spec.ox - nearX) < dSrc) src = other;
      }
    }
    const bx = this.rig.prevX + (this.rig.x - this.rig.prevX) * alpha;
    const by = this.rig.prevY + (this.rig.y - this.rig.prevY) * alpha;
    out.x = bx + src.spec.ox;
    out.y = by + src.spec.oy + (src === this.core ? 0 : 6);
  }

  private deflect(part: Enemy): void {
    const k = this.sparkSeq++;
    const ox = ((k * 37) % 11) - 5;
    const i = this.sparkI;
    this.sparks[i * 3] = part.x + (ox * part.r) / 6;
    this.sparks[i * 3 + 1] = part.y + part.r * 0.55 + ((k * 13) % 5) - 2;
    this.sparks[i * 3 + 2] = 0;
    this.sparkI = (i + 1) % SPARKS;
    this.pingWanted = true;
    this.pingX = part.x;
  }

  private setPhase(p: PhaseId): void {
    this.phase = p;
    this.phaseT = 0;
  }

  update(w: World, dt: number): void {
    this.t += dt;
    this.phaseT += dt;
    for (let i = 2; i < this.sparks.length; i += 3)
      this.sparks[i] = (this.sparks[i] as number) + dt;
    this.emitterFired[0] += dt;
    this.emitterFired[1] += dt;
    this.flungT += dt;
    this.pingT -= dt;
    if (this.pingWanted) {
      this.pingWanted = false;
      if (this.pingT <= 0 && this.phase < Phase.Dying) {
        this.pingT = PING_GAP;
        this.sfx(w, 'armor_ping', this.pingX);
      }
    }

    if (this.pendingDefeat && !this.defeatEmitted) this.defeat(w);

    const { x, y } = this.target(dt);
    const lost = this.rig.moveTo(x, y, dt);
    if (lost > 0) this.onPartsLost(w);
    if (this.phase < Phase.Dying) this.orbitA += this.def.orbit.speed * dt;

    switch (this.phase) {
      case Phase.Entry:
        this.tendSlots(w, dt);
        if (this.phaseT >= this.def.entry.duration) this.setPhase(Phase.Fight);
        break;
      case Phase.Fight:
        this.tendSlots(w, dt);
        this.fireBursts(w, dt);
        this.scheduleThrows(dt);
        break;
      case Phase.Opening:
        this.tendSlots(w, dt);
        if (this.phaseT >= this.def.coreOpenTime) {
          this.core.targetable = true;
          this.ringT = 0;
          this.spiralOn = false;
          this.spiralT = this.def.spiral.off - this.def.spiral.firstDelay;
          this.skiffT = this.def.skiffWave.firstDelay;
          this.setPhase(Phase.Exposed);
        }
        break;
      case Phase.Exposed:
        this.tendSlots(w, dt);
        this.fireSpiral(w, dt);
        this.launchSkiffs(w, dt);
        break;
      case Phase.Dying:
        if (this.phaseT >= this.def.deathTime) {
          this.rig.release(w);
          this.setPhase(Phase.Done);
        }
        break;
    }
  }

  private target(dt: number): { x: number; y: number } {
    const d = this.def;
    const out = TARGET;
    if (this.phase === Phase.Entry) {
      const k = Math.min(1, this.phaseT / d.entry.duration);
      const e = 1 - (1 - k) * (1 - k) * (1 - k);
      out.x = this.rig.x;
      out.y = d.entry.fromY + (d.entry.toY - d.entry.fromY) * e;
      return out;
    }
    if (this.phase >= Phase.Dying) {
      out.x = this.rig.x;
      out.y = this.rig.y + (this.phase === Phase.Dying ? 4 * dt : 0);
      return out;
    }
    const period = this.phase === Phase.Fight ? d.strafe.period1 : d.strafe.period2;
    this.sweep = (this.sweep + dt / period) % 2;
    const s = (1 - Math.cos(Math.PI * this.sweep)) / 2;
    out.x = d.strafe.minX + (d.strafe.maxX - d.strafe.minX) * s;
    const fightT = this.t - d.entry.duration;
    out.y = d.entry.toY + Math.sin((fightT / d.strafe.bobPeriod) * Math.PI * 2) * d.strafe.bobAmp;
    return out;
  }

  private onPartsLost(w: World): void {
    let wrecked = 0;
    for (let i = 0; i < this.emitters.length; i++) {
      const em = this.emitters[i] as PartSlot;
      if (!em.destroyed) continue;
      wrecked++;
      const s = this.slots[i] as OrbitSlot;
      if (!s.orphan) {
        // The core grabs the rock and throws it: a parting shot, telegraphed like any other.
        s.orphan = true;
        if (this.slotRock(s) !== null && s.mode !== Slot.Windup) this.startWindup(s, 0);
        else if (this.slotRock(s) === null) s.mode = Slot.Empty;
      }
    }
    if (wrecked <= this.emittersLost) return;
    this.emittersLost = wrecked;
    SHAKE_P.mag = this.def.emitterShake.mag;
    SHAKE_P.dur = this.def.emitterShake.dur;
    w.events.emit('shake', SHAKE_P);
    if (wrecked >= this.emitters.length && this.phase === Phase.Fight) {
      // The leftovers go as a pair.
      const p = this.def.fling.pairDeg;
      let k = 0;
      for (const s of this.slots) {
        if (this.slotRock(s) === null) continue;
        this.startWindup(s, k === 0 ? -p : p);
        k++;
      }
      this.setPhase(Phase.Opening);
    }
  }

  private startWindup(s: OrbitSlot, aimOff: number): void {
    s.mode = Slot.Windup;
    s.t = 0;
    s.aimOff = aimOff;
  }

  /** Every tick: haul, orbit, wind up and throw each slot's rock; fetch fresh ones. */
  private tendSlots(w: World, dt: number): void {
    const o = this.def.orbit;
    for (let i = 0; i < 2; i++) {
      const s = this.slots[i] as OrbitSlot;
      s.t += dt;
      const rock = this.slotRock(s);
      if (s.mode !== Slot.Empty && rock === null) {
        // Shot apart (its mediums fall away) or swallowed: fetch another.
        s.mode = Slot.Empty;
        s.rock = null;
        s.wait = o.refetch;
      }
      switch (s.mode) {
        case Slot.Empty:
          if (s.orphan || this.phase >= Phase.Opening) break;
          s.wait -= dt;
          if (s.wait <= 0) this.fetch(w, i, s);
          break;
        case Slot.TowIn:
          this.orbitPoint(i, OP);
          towRock(w, rock as Asteroid, OP.x, OP.y, o.towInK, OP.vx, OP.vy);
          if (s.t >= o.towIn) {
            s.mode = Slot.Orbit;
            s.t = 0;
          }
          break;
        case Slot.Orbit:
          this.orbitPoint(i, OP);
          towRock(w, rock as Asteroid, OP.x, OP.y, o.k, OP.vx, OP.vy);
          break;
        case Slot.Windup: {
          const f = this.def.fling;
          this.beamOrigin(i, OP);
          towRock(
            w,
            rock as Asteroid,
            OP.x,
            this.rig.y + f.releaseOy,
            f.windupK,
            this.rig.vx,
            this.rig.vy,
          );
          if (s.t >= f.windup) this.throwRock(w, s, rock as Asteroid);
          break;
        }
      }
    }
  }

  private fetch(w: World, i: number, s: OrbitSlot): void {
    this.orbitPoint(i, OP);
    const x = Math.min(w.width - 20, Math.max(20, OP.x));
    const rock = spawnRock(w, { size: 'large', x, y: this.def.orbit.spawnY, vx: 0, vy: 0 });
    if (rock === null) {
      s.wait = 0.5;
      return;
    }
    s.rock = rock;
    s.rockId = rock.id;
    s.mode = Slot.TowIn;
    s.t = 0;
    towRock(w, rock, OP.x, OP.y, this.def.orbit.towInK, OP.vx, OP.vy);
  }

  private throwRock(w: World, s: OrbitSlot, rock: Asteroid): void {
    const f = this.def.fling;
    const pl = w.player;
    if (pl.alive && rock.y <= pl.y - 24) {
      const a = (aimAt(w, rock.x, rock.y) + s.aimOff) * DEG;
      flingRock(w, rock, f.speed, rock.x + Math.cos(a) * 100, rock.y + Math.sin(a) * 100);
    } else {
      flingRock(w, rock, f.speed, rock.x, rock.y + 100);
    }
    s.mode = Slot.Empty;
    s.rock = null;
    s.wait = 0.3;
    this.flungT = 0;
    this.sfx(w, 'boss_throw', rock.x);
  }

  /** Every `fling.interval` the emitters take turns: the thrower's rock winds up, then goes. */
  private scheduleThrows(dt: number): void {
    this.flingT -= dt;
    if (this.flingT > 0) return;
    for (let k = 0; k < 2; k++) {
      const i = (this.nextThrower + k) % 2;
      const s = this.slots[i] as OrbitSlot;
      if (s.mode !== Slot.Orbit || s.orphan) continue;
      this.startWindup(s, 0);
      this.nextThrower = (i + 1) % 2;
      this.flingT += this.def.fling.interval;
      return;
    }
    // Nothing in orbit yet: check again shortly.
    this.flingT = 0.5;
  }

  private fireBursts(w: World, dt: number): void {
    this.burstT -= dt;
    if (this.burstT > 0) return;
    const b = this.def.burst;
    this.burstT += b.interval;
    if (!w.player.alive) return;
    for (let k = 0; k < this.emitters.length; k++) {
      const i = (this.nextShooter + k) % this.emitters.length;
      const s = this.emitters[i] as PartSlot;
      if (!this.rig.alive(s)) continue;
      VOLLEY.speed = b.speed;
      burst(w, s.enemy as Enemy, b.count, b.gap, VOLLEY, SHOT_SMALL, false);
      this.emitterFired[i] = 0;
      this.nextShooter = (i + 1) % this.emitters.length;
      return;
    }
  }

  /** Seconds until the next spiral burst starts (0 while spinning), for the core's glow. */
  spiralTell(): number {
    if (this.phase !== Phase.Exposed) return 9;
    if (this.spiralOn) return 0;
    return Math.max(0, this.def.spiral.off - this.spiralT);
  }

  private fireSpiral(w: World, dt: number): void {
    const sp = this.def.spiral;
    this.spiralT += dt;
    if (!this.spiralOn) {
      if (this.spiralT < sp.off) return;
      this.spiralOn = true;
      this.spiralT = 0;
      this.ringT = 0;
    }
    if (this.spiralT >= sp.on) {
      this.spiralOn = false;
      this.spiralT = 0;
      return;
    }
    this.ringT -= dt;
    if (this.ringT > 0) return;
    this.ringT += sp.interval;
    const core = this.core.enemy;
    if (core === null || !w.player.alive) return;
    const n = ring(w, core.x, core.y + 4, sp.arms, sp.speed, this.spiralRot, SHOT_SMALL);
    // One sfx every other ring: 15 rings in 2.4 s would be a buzz.
    if (n > 0 && Math.round(this.spiralRot / sp.rotStep) % 2 === 0) emitEnemyShotSfx(w, core.x);
    this.spiralRot = (this.spiralRot + sp.rotStep) % 360;
  }

  private launchSkiffs(w: World, dt: number): void {
    const sw = this.def.skiffWave;
    this.skiffT -= dt;
    if (this.skiffT <= 0) {
      this.skiffT += sw.interval;
      this.skiffLeft = sw.count;
      this.skiffGapT = 0;
      this.skiffSide = -this.skiffSide;
    }
    if (this.skiffLeft <= 0) return;
    this.skiffGapT -= dt;
    if (this.skiffGapT > 0) return;
    this.skiffGapT += sw.gap;
    this.skiffLeft--;
    // Out of the wrecked emitter bays, angling outward then weaving down.
    const em = (this.skiffSide < 0 ? this.emitters[0] : this.emitters[1]) as PartSlot;
    SKIFF_O.vx = this.skiffSide * 45;
    SKIFF_O.vy = 120;
    spawnEnemy(w, 'ion_skiff', this.rig.x + em.spec.ox, this.rig.y + em.spec.oy + 8, SKIFF_O);
  }

  /** Seconds until the next throw's windup starts (draw: emitter charge). */
  telegraph(): number {
    return this.phase === Phase.Fight ? this.flingT : 9;
  }

  /** Lets every held rock go, drifting down with the field. */
  private dropAll(w: World): void {
    for (const s of this.slots) {
      const r = this.slotRock(s);
      if (r !== null) {
        releaseRock(r);
        if (r.vy < w.scrollSpeed) r.vy = w.scrollSpeed;
      }
      s.mode = Slot.Empty;
      s.rock = null;
      s.orphan = true;
    }
  }

  private defeat(w: World): void {
    this.defeatEmitted = true;
    this.dropAll(w);
    const run = w.run;
    run.bossDefeated = true;
    run.kills++;
    addKillScore(w, this.def.score);
    DEFEAT_P.defId = this.def.id;
    DEFEAT_P.x = this.rig.x;
    DEFEAT_P.y = this.rig.y;
    w.events.emit('bossDefeated', DEFEAT_P);
    this.sfx(w, 'boss_die', this.rig.x);
    clearShotsToSalvage(w, this.def.shotSalvageMax);
  }

  private sfx(w: World, id: string, x?: number): void {
    SFX_P.id = id;
    SFX_P.x = x;
    w.events.emit('sfx', SFX_P);
  }
}

const OP = { x: 0, y: 0, vx: 0, vy: 0 };
