import {
  MAGNETAR,
  type MagnetarDef,
  type MagnetarRingPattern,
} from '../../../content/levels/pulsarNursery';
import { PULSAR_FIRST_GAP_DEG } from '../../../content/obstacles';
import { addKillScore, HIT_FLASH } from '../../../sim/damage';
import { pinAnomaly, setScrollSpeed } from '../../../sim/scroll';
import type { Anomaly, Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { BossRig, clearShotsToSalvage, type BossController, type PartSlot } from '../../boss';
import { emitToast } from '../../director';
import { aimed, emitEnemyShotSfx, shootDir, SHOT_SMALL } from '../../enemies';
import {
  collapseAnomaly,
  pulsarGapAngles,
  pulsarGlow,
  pulseIndex,
  setPulsarPattern,
  spawnPulsar,
  spawnRock,
} from '../../obstacles';

// Magnetar: a forge station around a captive magnetar. It descends to y≈96
// and holds (no strafe) while the arena's scroll speed swells 30 → 50 → 30
// every 12 s. Four pylons orbit the core and fire aimed shots; the core owns
// a `magnetar` pulsar it reprograms per phase:
//   phase 1  ring every 3 s, 4 × 45° gaps turning 30° a pulse
//   phase 2  (3 pylons down, the shield falls) ring every 2 s, 3 × 50° gaps
//            turning 60°, plus a 4-arm spiral between rings
//   meltdown (core < 30%) every ring gets an echo 0.5 s later with its gaps
//            turned half a gap spacing (the pulsar's `double` ring), so the
//            player has to move between them

export const MagPhase = {
  Entry: 0,
  P1: 1,
  P2: 2,
  Meltdown: 3,
  Dying: 4,
  Done: 5,
} as const;
export type MagPhaseId = (typeof MagPhase)[keyof typeof MagPhase];

const PHASE_NAMES = ['entry', 'phase1', 'phase2', 'meltdown', 'dying', 'done'] as const;

const DEG = Math.PI / 180;
const SPARKS = 12;
const PING_GAP = 0.12;
/** Spiral shots leave from the containment collar's rim, px. */
const SPIRAL_R = 18;
/**
 * A `double` pattern takes hold only this soon after a main pulse, so the
 * first echo leaves the core 0.5 s after its ring like every later one,
 * instead of popping up mid-screen.
 */
const ECHO_LATEST = 0.4;

const DEFEAT_P = { defId: '', x: 0, y: 0 };
const SFX_P = { id: '', x: 0 as number | undefined };
const SHAKE_P = { mag: 0, dur: 0 };
const PLACE = { vx: 0, vy: 0, variant: 'magnetar', phase: 0 };
const GAPS: number[] = [0, 0, 0, 0, 0, 0, 0, 0];

export class Magnetar implements BossController {
  readonly defId: string;
  readonly def: MagnetarDef;
  readonly rig: BossRig;
  readonly core: PartSlot;
  readonly pylons: PartSlot[];
  phase: MagPhaseId = MagPhase.Entry;
  phaseT = 0;
  t = 0;
  /** Seconds since the fight began (entry done); drives the scroll cycle. */
  fightT = 0;
  /** Pylon ring rotation, radians. */
  spin = 0;
  readonly pylonT: number[];
  /** Seconds since each pylon last fired (muzzle flash). */
  readonly pylonFired: number[];
  pylonsLost = 0;
  /** The core's pulsar (the id guards a recycled pool slot). */
  pulsar: Anomaly | null = null;
  private pulsarId = -1;
  /** Main runs a `double` pattern (meltdown's echo). */
  private echoOn = false;
  /** Pattern waiting for a safe moment (a shorter period must not fire before its telegraph). */
  private pending: MagnetarRingPattern | null = null;
  /** Pulses fired since the current pattern took hold. */
  private pulsesOnPattern = 0;
  private lastPulse = 0;
  /** Main's programmed gap turn per pulse, degrees. */
  private spinNow = 0;
  /** Seconds since the main pulsar's latest pulse. */
  sincePulse = 0;
  /** Seconds since the shield started to fall (-1: still up). */
  shieldT = -1;
  private spiralT = 0;
  spiralRot = 0;
  private rockT = 0;
  private scroll0 = 30;
  pendingDefeat = false;
  defeatEmitted = false;
  readonly sparks = new Float32Array(SPARKS * 3).fill(99);
  private sparkI = 0;
  private sparkSeq = 0;
  private pingT = 0;
  private pingWanted = false;
  private pingX = 0;

  constructor(def: MagnetarDef = MAGNETAR) {
    this.def = def;
    this.defId = def.id;
    this.rig = new BossRig(def.parts);
    this.core = this.rig.slots.find((s) => s.spec.role === 'core') as PartSlot;
    this.pylons = this.rig.slots.filter((s) => s.spec.role === 'turret');
    this.pylonT = this.pylons.map(() => 0);
    this.pylonFired = this.pylons.map(() => 9);
  }

  spawn(w: World): boolean {
    const ok = this.rig.spawn(w, w.width / 2, this.def.entry.fromY);
    const p = this.def.pylons;
    for (let i = 0; i < this.pylonT.length; i++) this.pylonT[i] = p.firstDelay + p.stagger * i;
    this.scroll0 = w.scrollSpeed;
    this.rockT = this.def.rocks.every;
    return ok;
  }

  get done(): boolean {
    return this.phase === MagPhase.Done;
  }

  invulnerable(): boolean {
    return this.phase === MagPhase.Entry || this.phase >= MagPhase.Dying;
  }

  targetable(_part: Enemy, slot: PartSlot): boolean {
    return !this.invulnerable() && slot.targetable;
  }

  phaseName(): string {
    return PHASE_NAMES[this.phase];
  }

  /** The active ring pattern (phase 1 until the shield falls). */
  pattern(): MagnetarRingPattern {
    const r = this.def.ring;
    return this.phase >= MagPhase.Meltdown ? r.p3 : this.phase >= MagPhase.P2 ? r.p2 : r.p1;
  }

  /** 0..1 while the shield is falling, 1 once it is down, 0 while up. */
  shieldDown(): number {
    if (this.shieldT < 0) return 0;
    return Math.min(1, this.shieldT / this.def.shieldDrop);
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
      this.setPhase(MagPhase.Dying);
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

  private setPhase(p: MagPhaseId): void {
    this.phase = p;
    this.phaseT = 0;
  }

  update(w: World, dt: number): void {
    this.t += dt;
    this.phaseT += dt;
    for (let i = 2; i < this.sparks.length; i += 3)
      this.sparks[i] = (this.sparks[i] as number) + dt;
    for (let i = 0; i < this.pylonFired.length; i++)
      this.pylonFired[i] = (this.pylonFired[i] as number) + dt;
    this.pingT -= dt;
    if (this.pingWanted) {
      this.pingWanted = false;
      if (this.pingT <= 0 && this.phase < MagPhase.Dying) {
        this.pingT = PING_GAP;
        this.sfx(w, 'armor_ping', this.pingX);
      }
    }
    if (this.pendingDefeat && !this.defeatEmitted) this.defeat(w);

    this.move(w, dt);
    this.driveScroll(w, dt);
    this.trackPulsars(dt);

    switch (this.phase) {
      case MagPhase.Entry:
        if (this.phaseT >= this.def.entry.duration) {
          this.setPhase(MagPhase.P1);
          this.spawnCorePulsar(w);
        }
        break;
      case MagPhase.P1:
        this.fightT += dt;
        this.firePylons(w, dt);
        this.trickleRocks(w, dt);
        break;
      case MagPhase.P2:
        this.fightT += dt;
        this.dropShield(dt);
        this.firePylons(w, dt);
        this.fireSpiral(w, dt);
        this.trickleRocks(w, dt);
        this.checkMeltdown(w);
        break;
      case MagPhase.Meltdown:
        this.fightT += dt;
        this.dropShield(dt);
        this.firePylons(w, dt);
        this.fireSpiral(w, dt);
        break;
      case MagPhase.Dying:
        if (this.phaseT >= this.def.deathTime) {
          this.rig.release(w);
          this.setPhase(MagPhase.Done);
        }
        break;
    }
    this.applyPending();
    this.pinPulsars();
  }

  // -------------------------------------------------------------------------
  // Movement

  private move(w: World, dt: number): void {
    const d = this.def;
    let x = this.rig.x;
    let y: number;
    if (this.phase === MagPhase.Entry) {
      const k = Math.min(1, this.phaseT / d.entry.duration);
      const e = 1 - (1 - k) * (1 - k) * (1 - k);
      x = w.width / 2;
      y = d.entry.fromY + (d.entry.toY - d.entry.fromY) * e;
    } else if (this.phase >= MagPhase.Dying) {
      y = this.rig.y + (this.phase === MagPhase.Dying ? 3 * dt : 0);
    } else {
      y = d.entry.toY + Math.sin((this.fightT / d.bob.period) * Math.PI * 2) * d.bob.amp;
    }
    const spinRate = this.phase === MagPhase.Meltdown ? d.pylons.spin * 1.6 : d.pylons.spin;
    if (this.phase < MagPhase.Dying) this.spin += spinRate * dt;
    const lost = this.rig.moveTo(x, y, dt);
    this.placePylons(spinRate);
    if (lost > 0) this.onPartsLost(w);
  }

  /** Pylon i's angle on the ring, radians. */
  pylonAngle(i: number): number {
    return this.spin + Math.PI / 4 + (i * Math.PI) / 2;
  }

  /** Moves the live pylons onto the turning ring (the rig holds fixed offsets). */
  private placePylons(rate: number): void {
    const R = this.def.pylons.radius;
    for (let i = 0; i < this.pylons.length; i++) {
      const s = this.pylons[i] as PartSlot;
      if (!this.rig.alive(s)) continue;
      const e = s.enemy as Enemy;
      const a = this.pylonAngle(i);
      e.x = this.rig.x + Math.cos(a) * R;
      e.y = this.rig.y + Math.sin(a) * R;
      e.vx = this.rig.vx - Math.sin(a) * R * rate;
      e.vy = this.rig.vy + Math.cos(a) * R * rate;
    }
  }

  private onPartsLost(w: World): void {
    let down = 0;
    for (const s of this.pylons) if (s.destroyed) down++;
    if (down <= this.pylonsLost) return;
    this.pylonsLost = down;
    SHAKE_P.mag = this.def.pylonShake.mag;
    SHAKE_P.dur = this.def.pylonShake.dur;
    w.events.emit('shake', SHAKE_P);
    if (down >= 3 && this.phase === MagPhase.P1) {
      this.setPhase(MagPhase.P2);
      this.shieldT = 0;
      this.pending = this.def.ring.p2;
      this.sfx(w, 'boss_throw', this.rig.x);
    }
  }

  private dropShield(dt: number): void {
    if (this.shieldT < 0) return;
    this.shieldT += dt;
    if (this.shieldT >= this.def.shieldDrop) this.core.targetable = true;
  }

  private checkMeltdown(w: World): void {
    const c = this.core.enemy;
    if (c === null || !this.rig.alive(this.core)) return;
    if (c.hp >= this.core.spec.hp * this.def.meltdownAt) return;
    this.setPhase(MagPhase.Meltdown);
    // Same period and turn as phase 2, wider gaps and the echo; `applyPending`
    // starts it just after a pulse.
    this.pending = this.def.ring.p3;
    emitToast(w, 'MELTDOWN');
    SHAKE_P.mag = 4;
    SHAKE_P.dur = 0.5;
    w.events.emit('shake', SHAKE_P);
  }

  // -------------------------------------------------------------------------
  // Scroll and rocks

  private driveScroll(w: World, dt: number): void {
    const s = this.def.scroll;
    let v: number;
    if (this.phase === MagPhase.Entry) {
      const k = Math.min(1, this.phaseT / this.def.entry.duration);
      v = this.scroll0 + (s.min - this.scroll0) * k;
    } else if (this.phase >= MagPhase.Dying) {
      v = w.scrollSpeed + (s.min - w.scrollSpeed) * Math.min(1, dt * 2);
    } else {
      v = s.min + ((s.max - s.min) * (1 - Math.cos((this.fightT / s.period) * Math.PI * 2))) / 2;
    }
    setScrollSpeed(w, v);
  }

  /** Small rocks down the flanks, clear of the station, so the scroll's pull shows. */
  private trickleRocks(w: World, dt: number): void {
    this.rockT -= dt;
    if (this.rockT > 0) return;
    this.rockT += this.def.rocks.every;
    const rng = w.rng;
    const left = rng.next() < 0.5;
    const x = left ? rng.range(14, 64) : rng.range(176, 226);
    const [s0, s1] = this.def.rocks.speed;
    spawnRock(w, { size: 'small', x, y: -8, vx: 0, vy: rng.range(s0, s1) + w.scrollSpeed });
  }

  // -------------------------------------------------------------------------
  // Pulsars

  private spawnCorePulsar(w: World): void {
    const p1 = this.def.ring.p1;
    // First pulse half a period after the fight starts (the telegraph shows first).
    PLACE.phase = p1.period / 2;
    const a = spawnPulsar(w, this.rig.x, this.rig.y, PLACE);
    if (a === null) return;
    this.pulsar = a;
    this.pulsarId = a.id;
    this.program(a, p1);
    this.lastPulse = pulseIndex(a);
    this.sincePulse = PLACE.phase;
    this.pulsesOnPattern = 1;
  }

  private program(a: Anomaly, p: MagnetarRingPattern): void {
    if (a === this.pulsar) this.spinNow = p.gapSpin;
    this.echoOn = p.double === true;
    pinAnomaly(a);
    setPulsarPattern(a, {
      period: p.period,
      gaps: p.gaps,
      gapDeg: p.gapDeg,
      gapSpin: p.gapSpin,
      double: this.echoOn,
      telegraph: this.def.ring.telegraph,
      ringSpeed: p.ringSpeed,
    });
    a.radius = this.def.ring.reach;
  }

  /** The main pulsar while it is ours, else null. */
  main(): Anomaly | null {
    const a = this.pulsar;
    return a !== null && a.active && a.id === this.pulsarId ? a : null;
  }

  /** The pulsar firing meltdown's echo rings (main itself, once `double` is on), else null. */
  echo(): Anomaly | null {
    return this.echoOn ? this.main() : null;
  }

  private trackPulsars(dt: number): void {
    const a = this.main();
    this.sincePulse += dt;
    if (a === null) return;
    const k = pulseIndex(a);
    if (k !== this.lastPulse) {
      this.lastPulse = k;
      this.sincePulse = 0;
      this.pulsesOnPattern++;
    }
  }

  /**
   * Applies a pending pattern only early in the current period, so a shorter
   * period can't fire the next pulse before its telegraph has shown.
   */
  private applyPending(): void {
    const a = this.main();
    const p = this.pending;
    if (a === null || p === null) return;
    if (this.sincePulse > p.period - this.def.ring.telegraph - 0.2) return;
    if (p.double === true && !this.echoOn && this.sincePulse > ECHO_LATEST) return;
    if (p.offsetDeg !== undefined && !this.lands(a, p)) return;
    this.program(a, p);
    this.pending = null;
    this.pulsesOnPattern = 0;
  }

  /**
   * Whether main's next ring (its rotation was fixed by the current spin when
   * the last pulse fired) sits `offsetDeg` either side of straight down, so
   * the new pattern's flips stay on that pair (e.g. ±30° with 3 gaps turning
   * 60°: every pattern, and meltdown's echo, keeps a gap reachable from the
   * bottom of the screen). If not, wait a pulse: phase 1's 30° turn changes it.
   * Main's next ring was turned by the spin programmed when its last pulse fired.
   */
  private lands(a: Anomaly, p: MagnetarRingPattern): boolean {
    if (pulseIndex(a) < 1 || pulsarGlow(a) > 0 || pulsarGapAngles(a, GAPS) < 1) return false;
    const spacing = 360 / p.gaps;
    const next = (GAPS[0] as number) / DEG + this.spinNow - PULSAR_FIRST_GAP_DEG;
    const off = ((next % spacing) + spacing) % spacing;
    const want = p.offsetDeg as number;
    return Math.abs(off - want) < 1 || Math.abs(off - (spacing - want)) < 1;
  }

  private pinPulsars(): void {
    const x = this.rig.x;
    const y = this.rig.y;
    const a = this.main();
    if (a !== null) {
      a.x = a.prevX = x;
      a.y = a.prevY = y;
    }
  }

  // -------------------------------------------------------------------------
  // Guns

  private firePylons(w: World, dt: number): void {
    const p = w.player;
    const d = this.def.pylons;
    for (let i = 0; i < this.pylons.length; i++) {
      const s = this.pylons[i] as PartSlot;
      const left = (this.pylonT[i] as number) - dt;
      this.pylonT[i] = left;
      if (left > 0) continue;
      this.pylonT[i] = left + d.interval;
      if (!this.rig.alive(s) || !p.alive) continue;
      const e = s.enemy as Enemy;
      // Fairness: aimed shots only from at least 24 px above the player.
      if (e.y > p.y - 24) continue;
      if (aimed(w, e.x, e.y, 1, 0, d.shotSpeed, SHOT_SMALL) > 0) emitEnemyShotSfx(w, e.x);
      this.pylonFired[i] = 0;
    }
  }

  /** The 4-arm spiral runs between rings and pauses for each ring's telegraph. */
  private fireSpiral(w: World, dt: number): void {
    const sp = this.def.spiral;
    const melt = this.phase === MagPhase.Meltdown;
    const period = this.def.ring.p2.period;
    const open =
      this.sincePulse >= (melt ? sp.afterMeltdown : sp.after) &&
      this.sincePulse <= period - this.def.ring.telegraph;
    this.spiralT -= dt;
    if (!open || this.shieldDown() < 1) {
      if (this.spiralT < 0) this.spiralT = 0;
      return;
    }
    if (this.spiralT > 0) return;
    this.spiralT += melt ? sp.intervalMeltdown : sp.interval;
    if (!w.player.alive) return;
    // From the collar rim: the core's own pulsar would swallow shots born at its center.
    let n = 0;
    for (let i = 0; i < sp.arms; i++) {
      const deg = this.spiralRot + (i * 360) / sp.arms;
      const x = this.rig.x + Math.cos(deg * DEG) * SPIRAL_R;
      const y = this.rig.y + Math.sin(deg * DEG) * SPIRAL_R;
      n += shootDir(w, x, y, deg, sp.speed, SHOT_SMALL);
    }
    if (n > 0) emitEnemyShotSfx(w, this.rig.x);
    this.spiralRot = (this.spiralRot + sp.turnDeg) % 360;
  }

  // -------------------------------------------------------------------------
  // Defeat

  private defeat(w: World): void {
    this.defeatEmitted = true;
    w.run.bossDefeated = true;
    w.run.kills++;
    addKillScore(w, this.def.score);
    const a = this.main();
    if (a !== null) collapseAnomaly(w, a, 0.6);
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
