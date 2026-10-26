import type { AimedPattern } from '../../content/enemies';
import { ROCK_HAULER, type RockHaulerDef } from '../../content/bosses';
import { addKillScore, HIT_FLASH } from '../../sim/damage';
import type { Enemy } from '../../sim/types';
import type { World } from '../../sim/world';
import { aimAt, burst, emitEnemyShotSfx, ring, SHOT_LARGE, SHOT_SMALL } from '../enemies';
import { spawnRock } from '../obstacles';
import { spawnDrop } from '../pickups';
import { BossRig, type PartSlot } from './parts';

// Rock Hauler: descend → phase 1 (strafe, clamp-turret bursts, a rock flung
// every 4 s) → both turrets wrecked → the core irises open → phase 2 (faster
// strafe, spinning drills, rotating 8-ring, rocks in pairs) → core destroyed →
// 2 s death throes (T13 plays the explosion chain) → parts released.

export const Phase = {
  Entry: 0,
  Fight: 1,
  Opening: 2,
  Exposed: 3,
  Dying: 4,
  Done: 5,
} as const;
export type PhaseId = (typeof Phase)[keyof typeof Phase];

const DEG = Math.PI / 180;
const SPARKS = 12;
/** Seconds between armor pings: a stream of deflected shots shouldn't become a buzz. */
const PING_GAP = 0.12;
const DEFEAT_P = { defId: '', x: 0, y: 0 };
const SFX_P = { id: '', x: 0 as number | undefined };
const SHAKE_P = { mag: 0, dur: 0 };

export class RockHauler {
  readonly def: RockHaulerDef;
  readonly rig: BossRig;
  phase: PhaseId = Phase.Entry;
  /** Seconds in the current phase. */
  phaseT = 0;
  /** Seconds since spawn. */
  t = 0;
  /** 0..2 sweep accumulator; x eases between the strafe limits. */
  sweep = 0.5;
  turretT: [number, number] = [0, 0];
  /** Seconds since each turret last fired (barrel recoil). */
  turretFired: [number, number] = [9, 9];
  flingT = 0;
  /** Seconds since the last throw (chute flash). */
  flungT = 9;
  ringT = 0;
  ringRot = 0;
  turretsLost = 0;
  /** Set by the damage hook on the killing blow; resolved in update. */
  pendingDefeat = false;
  defeatEmitted = false;
  /** Deflect sparks: x, y, age; a ring buffer filled by the damage hook. */
  readonly sparks = new Float32Array(SPARKS * 3).fill(99);
  private sparkI = 0;
  private sparkSeq = 0;
  private pingT = 0;
  /** Set by `deflect` (inside the damage hook); the sfx goes out on the next update. */
  private pingWanted = false;
  private pingX = 0;

  readonly core: PartSlot;
  readonly turrets: PartSlot[];

  constructor(def: RockHaulerDef = ROCK_HAULER) {
    this.def = def;
    this.rig = new BossRig(def.parts);
    this.core = this.rig.slots.find((s) => s.spec.role === 'core') as PartSlot;
    this.turrets = this.rig.slots.filter((s) => s.spec.role === 'turret');
  }

  spawn(w: World): boolean {
    const ok = this.rig.spawn(w, w.width / 2, this.def.entry.fromY);
    this.turretT[0] = this.def.turret.interval * 0.5;
    this.turretT[1] = this.def.turret.interval;
    this.flingT = this.def.fling.firstDelay;
    return ok;
  }

  /** No damage during the descent, the iris opening and the death throes. */
  invulnerable(): boolean {
    return this.phase === Phase.Entry || this.phase >= Phase.Dying;
  }

  get done(): boolean {
    return this.phase === Phase.Done;
  }

  /** Damage hook for one of our parts. True = we handled (absorbed) the hit. */
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

  private deflect(part: Enemy): void {
    // Spread pings over the part's lower face, where shots arrive.
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
    for (let i = 0; i < 2; i++) this.turretFired[i] = (this.turretFired[i] as number) + dt;
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
    if (lost > 0) this.onPartsLost(w, lost);

    switch (this.phase) {
      case Phase.Entry:
        if (this.phaseT >= this.def.entry.duration) this.setPhase(Phase.Fight);
        break;
      case Phase.Fight:
        this.fireTurrets(w, dt);
        this.fling(w, dt, 1);
        break;
      case Phase.Opening:
        this.fling(w, dt, 2);
        if (this.phaseT >= this.def.coreOpenTime) {
          this.core.targetable = true;
          this.ringT = this.def.ring.firstDelay;
          this.setPhase(Phase.Exposed);
        }
        break;
      case Phase.Exposed:
        this.fireRing(w, dt);
        this.fling(w, dt, 2);
        break;
      case Phase.Dying:
        if (this.phaseT >= this.def.deathTime) {
          this.rig.release(w);
          this.setPhase(Phase.Done);
        }
        break;
    }
  }

  /** Where the controller should be this tick. */
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
      // Death throes: sag slowly while the chain goes off (the shudder is drawn).
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

  private onPartsLost(w: World, _n: number): void {
    let wrecked = 0;
    for (let i = 0; i < this.turrets.length; i++)
      if ((this.turrets[i] as PartSlot).destroyed) wrecked++;
    if (wrecked > this.turretsLost) {
      this.turretsLost = wrecked;
      SHAKE_P.mag = this.def.turretShake.mag;
      SHAKE_P.dur = this.def.turretShake.dur;
      w.events.emit('shake', SHAKE_P);
      if (wrecked >= this.turrets.length && this.phase === Phase.Fight) {
        this.setPhase(Phase.Opening);
        this.flingT = Math.max(this.flingT, this.def.coreOpenTime + 0.5);
      }
    }
  }

  private fireTurrets(w: World, dt: number): void {
    if (!w.player.alive) return;
    const tu = this.def.turret;
    const alone = this.turretsLost > 0;
    for (let i = 0; i < this.turrets.length; i++) {
      const s = this.turrets[i] as PartSlot;
      if (!this.rig.alive(s)) continue;
      const left = (this.turretT[i] as number) - dt;
      this.turretT[i] = left;
      if (left > 0) continue;
      this.turretT[i] = left + (alone ? tu.intervalAlone : tu.interval);
      TURRET_VOLLEY.n = tu.shotsPerVolley;
      TURRET_VOLLEY.spreadDeg = tu.spreadDeg;
      TURRET_VOLLEY.speed = tu.shotSpeed;
      burst(w, s.enemy as Enemy, tu.burstCount, tu.burstGap, TURRET_VOLLEY, SHOT_SMALL, false);
      this.turretFired[i] = 0;
    }
  }

  private fling(w: World, dt: number, n: 1 | 2): void {
    this.flingT -= dt;
    if (this.flingT > 0) return;
    const f = this.def.fling;
    this.flingT += n === 1 ? f.interval1 : f.interval2;
    if (!w.player.alive) return;
    const x = this.rig.x + f.ox;
    const y = this.rig.y + f.oy;
    const aim = aimAt(w, x, y);
    if (n === 1) this.throwRock(w, x, y, aim);
    else {
      this.throwRock(w, x, y, aim - f.pairDeg);
      this.throwRock(w, x, y, aim + f.pairDeg);
    }
    this.sfx(w, 'boss_throw', x);
    this.flungT = 0;
  }

  private throwRock(w: World, x: number, y: number, deg: number): void {
    // Never throw upward into the hull, even if the player slips alongside.
    const a = Math.min(170, Math.max(10, deg)) * DEG;
    spawnRock(w, {
      size: 'medium',
      x,
      y,
      vx: Math.cos(a) * this.def.fling.speed,
      vy: Math.sin(a) * this.def.fling.speed,
    });
  }

  private fireRing(w: World, dt: number): void {
    this.ringT -= dt;
    if (this.ringT > 0) return;
    const r = this.def.ring;
    this.ringT += r.interval;
    if (!w.player.alive) return;
    const core = this.core.enemy;
    if (core === null) return;
    if (ring(w, core.x, core.y, r.n, r.speed, this.ringRot, SHOT_LARGE) > 0)
      emitEnemyShotSfx(w, core.x);
    this.ringRot = (this.ringRot + r.rotStep) % 360;
  }

  /** Seconds until the next throw (the hopper shakes during the telegraph). */
  telegraph(): number {
    if (this.phase !== Phase.Fight && this.phase !== Phase.Opening && this.phase !== Phase.Exposed)
      return 9;
    return this.flingT;
  }

  private defeat(w: World): void {
    this.defeatEmitted = true;
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

const TARGET = { x: 0, y: 0 };
const TURRET_VOLLEY: AimedPattern = { kind: 'aimed', n: 1, spreadDeg: 0, speed: 100 };

/** Converts every live enemy shot into a 1-salvage bit (up to `max`; the rest just vanish). */
export function clearShotsToSalvage(w: World, max: number): number {
  const items = w.enemyShots.items;
  let made = 0;
  for (let i = 0; i < w.enemyShots.count; i++) {
    const b = items[i];
    if (b === undefined || !b.active) continue;
    if (
      made < max &&
      b.y >= 0 &&
      b.y <= w.height &&
      spawnDrop(w, 'salvage', b.x, b.y, '', 1) !== null
    ) {
      made++;
    }
    w.enemyShots.release(b);
  }
  return made;
}
