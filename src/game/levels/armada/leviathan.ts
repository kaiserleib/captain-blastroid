import {
  LEVIATHAN,
  LEVIATHAN_PARTS,
  type LeviathanPartKind,
  type LeviathanPartSpec,
} from '../../../content/levels/armada';
import { addKillScore, damageEnemy, HIT_FLASH } from '../../../sim/damage';
import { setScrollSpeed } from '../../../sim/scroll';
import { spawnEnemy, type EnemyOverrides } from '../../../sim/spawn';
import type { Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { BossRig, clearShotsToSalvage, type BossController, type PartSlot } from '../../boss';
import {
  aimAt,
  aimed,
  emitEnemyShotSfx,
  ring,
  SHOT_LARGE,
  SHOT_SMALL,
  shootDir,
} from '../../enemies';
import { spawnRock } from '../../obstacles';
import { spawnDrop, spraySalvage } from '../../pickups';
import { releaseFrigates } from './frigate';
import { armadaState, type HullView } from './state';
import { lineBurst } from './behaviors';

// Dreadnought Leviathan (UN Squadron style). The hull is one BossRig whose
// anchor (the bow tip) scrolls down at 20 px/s with the world scroll; parts
// sit at −depth offsets and arrive section by section: bow flak, forward
// battery, missile bays, shield generators, bridge. Parts that scroll off the
// bottom are released (not kills). The anchor stops when the bridge reaches
// lockY (scroll 0). Bridge phase 1 → the bridge breaks → the escape core rises
// out of the wreck (phase 2) → core destroyed → a 3 s chain across the hull.

export const LevPhase = {
  Hull: 0,
  Bridge: 1,
  Launch: 2,
  Core: 3,
  Dying: 4,
  Done: 5,
} as const;
export type LevPhaseId = (typeof LevPhase)[keyof typeof LevPhase];

const PHASE_NAMES = ['hull', 'bridge', 'launch', 'core', 'dying', 'done'] as const;
const BAR_PARTS: ReadonlySet<string> = new Set(
  LEVIATHAN_PARTS.filter(
    (s) => s.kind === 'gen' || s.kind === 'gun' || s.kind === 'bridge' || s.kind === 'core',
  ).map((s) => s.defId),
);

const L = LEVIATHAN;
const SPARKS = 16;
const POPS = 28;
const PING_GAP = 0.12;
const DEFEAT_P = { defId: '', x: 0, y: 0 };
const SFX_P = { id: '', x: 0 as number | undefined };
const SHAKE_P = { mag: 0, dur: 0 };
const HAPTIC_P = { kind: 'medium' as 'light' | 'medium' | 'heavy' };
const missileO: EnemyOverrides = {};
const rockInit = { size: 'small' as const, x: 0, y: 0, vx: 0, vy: 0 };
const DEG = Math.PI / 180;

export class Leviathan implements BossController, HullView {
  readonly defId = L.id;
  readonly rig: BossRig;
  readonly specs: readonly LeviathanPartSpec[];
  phase: LevPhaseId = LevPhase.Hull;
  phaseT = 0;
  t = 0;
  /** Seconds since the bridge locked in (0 before). */
  lockedT = 0;

  /** Per slot: scrolled off the bottom (released, not a kill). */
  readonly passed: boolean[];
  /** Per slot: seconds on screen. */
  readonly onT: Float32Array;
  /** Per slot: seconds to the next volley / launch. */
  readonly fireT: Float32Array;
  /** Per slot: seconds since it last fired (recoil, bay doors). */
  readonly firedT: Float32Array;
  /** Per slot: destruction handled (salvage paid or overload). */
  readonly handled: boolean[];
  readonly overloaded: boolean[];

  readonly bridge: PartSlot;
  readonly core: PartSlot;
  readonly bridgeI: number;
  readonly coreI: number;
  readonly genI: number[] = [];
  genAlive = true;

  ringT = 0;
  ringRot = 0;
  coreX = 120;
  coreY = 0;
  corePrevX = 120;
  corePrevY = 0;
  sweep = 0.5;
  spiralT = 0;
  spiralGap = 0;
  spiralRot = 0;
  debrisT = 0;
  popT = 0;

  /** Deflect sparks: x, y, age. */
  readonly sparks = new Float32Array(SPARKS * 3).fill(99);
  /** Death-chain pops: x, y, age, size (16/32/48). */
  readonly pops = new Float32Array(POPS * 4).fill(99);
  private sparkI = 0;
  private sparkSeq = 0;
  private popI = 0;
  private pingT = 0;
  private pingWanted = false;
  private pingX = 0;
  private pendingLaunch = false;
  private pendingDefeat = false;
  private defeatEmitted = false;
  /** Set while this boss kills its own parts (overload, scuttling) so the hook lets it through. */
  private selfHarm = false;

  // HullView (the hull layer and the level system read these).
  anchorY: number = L.startY;
  anchorPrevY: number = L.startY;
  sunk = false;
  sunkT = 0;

  constructor() {
    this.specs = LEVIATHAN_PARTS;
    this.rig = new BossRig(LEVIATHAN_PARTS);
    const n = LEVIATHAN_PARTS.length;
    this.passed = new Array<boolean>(n).fill(false);
    this.handled = new Array<boolean>(n).fill(false);
    this.overloaded = new Array<boolean>(n).fill(false);
    this.onT = new Float32Array(n);
    this.fireT = new Float32Array(n);
    this.firedT = new Float32Array(n).fill(9);
    this.bridgeI = LEVIATHAN_PARTS.findIndex((s) => s.kind === 'bridge');
    this.coreI = LEVIATHAN_PARTS.findIndex((s) => s.kind === 'core');
    this.bridge = this.rig.slots[this.bridgeI] as PartSlot;
    this.core = this.rig.slots[this.coreI] as PartSlot;
    LEVIATHAN_PARTS.forEach((s, i) => {
      if (s.kind === 'gen') this.genI.push(i);
    });
  }

  kind(i: number): LeviathanPartKind {
    return (this.specs[i] as LeviathanPartSpec).kind;
  }

  spawn(w: World): boolean {
    releaseFrigates(w);
    const ok = this.rig.spawn(w, w.width / 2, L.startY);
    this.anchorY = this.anchorPrevY = L.startY;
    // Stagger the guns so a row doesn't fire in lockstep.
    for (let i = 0; i < this.specs.length; i++) {
      const k = this.kind(i);
      const iv =
        k === 'flak'
          ? L.flak.interval
          : k === 'deck'
            ? L.deck.interval
            : k === 'gun'
              ? L.gun.interval
              : L.bay.interval;
      this.fireT[i] = k === 'bay' ? L.bay.firstDelay + (i % 2) * 1.2 : iv * (0.3 + (i % 2) * 0.5);
    }
    setScrollSpeed(w, L.hullSpeed);
    armadaState(w).hull = this;
    return ok;
  }

  get done(): boolean {
    return this.phase === LevPhase.Done;
  }

  phaseName(): string {
    return PHASE_NAMES[this.phase];
  }

  /** The bar is the bridge fight (generators, guns, bridge, core): hull guns may scroll off unkilled. */
  inHpBar(part: Enemy): boolean {
    return BAR_PARTS.has(part.defId);
  }

  /** Screen y of slot i at the current anchor. */
  slotY(i: number): number {
    return this.anchorY + (this.specs[i] as LeviathanPartSpec).oy;
  }

  private invulnerable(): boolean {
    return this.phase === LevPhase.Launch || this.phase >= LevPhase.Dying;
  }

  targetable(part: Enemy, slot: PartSlot): boolean {
    if (this.invulnerable() || part.y < 8 || part.maxHp <= 0) return false;
    if (slot === this.bridge) return !this.genAlive && part.hp > 0;
    if (slot === this.core) return this.phase === LevPhase.Core;
    return slot.targetable;
  }

  onDamage(part: Enemy, slot: PartSlot, amount: number): boolean {
    if (this.selfHarm) return false;
    if (this.invulnerable()) {
      if (part.hp > 0) this.deflect(part);
      return true;
    }
    // Not on screen yet: nothing can reach it fairly.
    if (part.y < 0) return true;
    if (slot === this.bridge) {
      if (this.genAlive) {
        this.deflect(part);
        return true;
      }
      if (amount >= part.hp) {
        part.hp = 0;
        part.flashT = HIT_FLASH;
        this.pendingLaunch = true;
        return true;
      }
      return false;
    }
    if (slot === this.core) {
      if (this.phase !== LevPhase.Core) {
        this.deflect(part);
        return true;
      }
      if (amount >= part.hp) {
        part.hp = 0;
        part.flashT = HIT_FLASH;
        this.pendingDefeat = true;
        this.setPhase(LevPhase.Dying);
        return true;
      }
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

  private setPhase(p: LevPhaseId): void {
    this.phase = p;
    this.phaseT = 0;
  }

  update(w: World, dt: number): void {
    this.t += dt;
    this.phaseT += dt;
    for (let i = 2; i < this.sparks.length; i += 3)
      this.sparks[i] = (this.sparks[i] as number) + dt;
    for (let i = 2; i < this.pops.length; i += 4) this.pops[i] = (this.pops[i] as number) + dt;
    for (let i = 0; i < this.firedT.length; i++) this.firedT[i] = (this.firedT[i] as number) + dt;
    this.pingT -= dt;
    if (this.pingWanted) {
      this.pingWanted = false;
      if (this.pingT <= 0 && this.phase < LevPhase.Dying) {
        this.pingT = PING_GAP;
        this.sfx(w, 'armor_ping', this.pingX);
      }
    }
    if (this.pendingLaunch && this.phase === LevPhase.Bridge) this.launch(w);
    if (this.pendingLaunch && this.phase === LevPhase.Hull) {
      // Bridge broken before the lock: the hull stops where it is.
      this.lock(w);
      this.launch(w);
    }
    if (this.pendingDefeat && !this.defeatEmitted) this.defeat(w);

    this.anchorPrevY = this.anchorY;
    if (this.phase === LevPhase.Hull) {
      this.anchorY += L.hullSpeed * dt;
      const lockAt = L.lockY - (this.specs[this.bridgeI] as LeviathanPartSpec).oy;
      if (this.anchorY >= lockAt) {
        this.anchorY = lockAt;
        this.lock(w);
      }
    } else this.lockedT += dt;

    this.releasePassed(w);
    const lost = this.rig.moveTo(w.width / 2, this.anchorY, dt);
    if (this.phase >= LevPhase.Launch) this.placeCore();
    if (lost > 0) this.onPartsLost(w);
    this.tickParts(w, dt);

    switch (this.phase) {
      case LevPhase.Hull:
      case LevPhase.Bridge:
        this.fireParts(w, dt);
        if (this.phase === LevPhase.Bridge) this.fireRing(w, dt);
        break;
      case LevPhase.Launch:
        this.rise(dt);
        this.debris(w, dt);
        if (this.phaseT >= L.launchTime) {
          this.core.targetable = true;
          this.spiralT = 0;
          this.spiralGap = 0.4;
          this.setPhase(LevPhase.Core);
        }
        break;
      case LevPhase.Core:
        this.strafe(dt);
        this.fireSpiral(w, dt);
        this.debris(w, dt);
        break;
      case LevPhase.Dying:
        this.deathChain(w, dt);
        if (this.phaseT >= L.deathTime) {
          this.rig.release(w);
          this.sunk = true;
          this.setPhase(LevPhase.Done);
        }
        break;
    }
  }

  private lock(w: World): void {
    if (this.phase !== LevPhase.Hull) return;
    setScrollSpeed(w, 0);
    this.ringT = L.ring.firstDelay;
    this.lockedT = 0;
    this.setPhase(LevPhase.Bridge);
    SHAKE_P.mag = 2;
    SHAKE_P.dur = 0.4;
    w.events.emit('shake', SHAKE_P);
  }

  /** Releases parts that have scrolled off the bottom; the rig then skips them. */
  private releasePassed(w: World): void {
    const slots = this.rig.slots;
    for (let i = 0; i < slots.length; i++) {
      if (this.passed[i]) continue;
      const s = slots[i] as PartSlot;
      if (s.destroyed || !this.rig.alive(s)) continue;
      if (i === this.coreI && this.phase >= LevPhase.Launch) continue;
      if (this.slotY(i) - s.spec.r <= L.passY) continue;
      w.enemies.release(s.enemy as Enemy);
      s.enemy = null;
      this.passed[i] = true;
    }
  }

  private tickParts(w: World, dt: number): void {
    let gens = false;
    const slots = this.rig.slots;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i] as PartSlot;
      if (!this.rig.alive(s)) continue;
      const e = s.enemy as Enemy;
      if (e.y >= 4) this.onT[i] = (this.onT[i] as number) + dt;
      if (this.kind(i) !== 'gen') continue;
      if ((this.onT[i] as number) >= L.gen.overloadAfter && this.phase < LevPhase.Launch) {
        this.overload(w, i, e);
        continue;
      }
      gens = true;
    }
    this.genAlive = gens;
  }

  /** An unshot generator burns out on its own so the bridge can never stay armored. */
  private overload(w: World, i: number, e: Enemy): void {
    this.overloaded[i] = true;
    this.selfHarm = true;
    damageEnemy(w, e, e.hp, 'hazard');
    this.selfHarm = false;
  }

  private onPartsLost(w: World): void {
    const slots = this.rig.slots;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i] as PartSlot;
      if (!s.destroyed || this.handled[i]) continue;
      this.handled[i] = true;
      const k = this.kind(i);
      if (this.overloaded[i] || k === 'bridge' || k === 'core' || this.phase >= LevPhase.Dying)
        continue;
      spraySalvage(w, w.width / 2 + s.spec.ox, this.slotY(i), L.partSalvage);
    }
  }

  /** Fairness: on screen for wakeT, and well above a live player (the deck guns can't depress). */
  private canShoot(w: World, i: number, e: Enemy): boolean {
    const p = w.player;
    return (
      p.alive &&
      (this.onT[i] as number) >= L.wakeT &&
      e.y >= 8 &&
      e.y <= p.y - L.minAbove &&
      e.x >= 0 &&
      e.x <= w.width
    );
  }

  private fireParts(w: World, dt: number): void {
    const slots = this.rig.slots;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i] as PartSlot;
      if (!this.rig.alive(s)) continue;
      const k = this.kind(i);
      if (k === 'armor' || k === 'gen' || k === 'bridge' || k === 'core') continue;
      const e = s.enemy as Enemy;
      if ((this.onT[i] as number) <= 0) continue;
      const left = (this.fireT[i] as number) - dt;
      this.fireT[i] = left;
      if (k === 'bay') {
        this.tickBay(w, i, e, left);
        continue;
      }
      if (left > 0) continue;
      this.fireT[i] =
        left + (k === 'flak' ? L.flak.interval : k === 'deck' ? L.deck.interval : L.gun.interval);
      if (!this.canShoot(w, i, e)) continue;
      const my = e.y + e.r * 0.5;
      if (k === 'flak') {
        lineBurst(w, e.x, my, aimAt(w, e.x, my), L.flak.speed, L.flak.burstCount, L.flak.burstGap);
      } else if (k === 'deck') {
        // A fan pointing down the deck, leaning toward the player.
        const lean = L.deck.leanDeg;
        const a = Math.max(90 - lean, Math.min(90 + lean, aimAt(w, e.x, my)));
        const step = L.deck.arcDeg / (L.deck.n - 1);
        for (let j = 0; j < L.deck.n; j++)
          shootDir(w, e.x, my, a - L.deck.arcDeg / 2 + step * j, L.deck.speed, SHOT_SMALL);
        emitEnemyShotSfx(w, e.x);
      } else {
        if (aimed(w, e.x, my, L.gun.n, L.gun.spreadDeg, L.gun.speed, SHOT_SMALL) > 0)
          emitEnemyShotSfx(w, e.x);
      }
      this.firedT[i] = 0;
    }
  }

  /** Bays: doors crack `telegraph` s before each launch of two homing missiles. */
  private tickBay(w: World, i: number, e: Enemy, left: number): void {
    if (left > 0) return;
    if (!this.canShoot(w, i, e)) {
      // Hold the doors shut until the bay is a fair launcher again.
      this.fireT[i] = L.bay.telegraph + 0.2;
      return;
    }
    this.fireT[i] = left + L.bay.interval;
    this.firedT[i] = 0;
    const b = L.bay;
    for (let j = 0; j < b.perLaunch; j++) {
      const side = j % 2 === 0 ? -1 : 1;
      const a = (-90 + side * b.splayDeg) * DEG;
      for (const k in missileO) delete missileO[k as keyof EnemyOverrides];
      missileO.vx = Math.cos(a) * L.missile.speed;
      missileO.vy = Math.sin(a) * L.missile.speed;
      spawnEnemy(w, 'ar_missile', e.x + side * 5, e.y - 4, missileO);
    }
    this.sfx(w, 'boss_throw', e.x);
  }

  /** Seconds until slot i's next missile launch (bay door telegraph), or 9. */
  bayCountdown(i: number): number {
    return this.kind(i) === 'bay' ? (this.fireT[i] as number) : 9;
  }

  private fireRing(w: World, dt: number): void {
    if (!this.rig.alive(this.bridge) || (this.bridge.enemy as Enemy).hp <= 0) return;
    this.ringT -= dt;
    if (this.ringT > 0) return;
    const rg = L.ring;
    this.ringT += rg.interval;
    if (!w.player.alive) return;
    const b = this.bridge.enemy as Enemy;
    if (ring(w, b.x, b.y + 8, rg.n, rg.speed, this.ringRot, SHOT_LARGE) > 0)
      emitEnemyShotSfx(w, b.x);
    this.ringRot = (this.ringRot + rg.rotStep) % 360;
  }

  /** The bridge broke: its guns go with it and the escape core starts to rise. */
  private launch(w: World): void {
    this.pendingLaunch = false;
    this.selfHarm = true;
    const slots = this.rig.slots;
    for (let i = 0; i < slots.length; i++) {
      if (this.kind(i) !== 'gun' && this.kind(i) !== 'gen') continue;
      const s = slots[i] as PartSlot;
      if (!this.rig.alive(s)) continue;
      this.overloaded[i] = true;
      const e = s.enemy as Enemy;
      damageEnemy(w, e, e.hp, 'hazard');
    }
    this.selfHarm = false;
    const b = this.bridge.enemy;
    this.coreX = this.corePrevX = w.width / 2;
    this.coreY = this.corePrevY = b !== null ? b.y : this.slotY(this.coreI);
    const c = this.core.enemy;
    if (c !== null) c.r = L.core.r;
    this.debrisT = 0.6;
    spawnDrop(w, L.launchDrop, this.coreX, this.coreY + 24);
    this.setPhase(LevPhase.Launch);
    SHAKE_P.mag = 4;
    SHAKE_P.dur = 0.7;
    w.events.emit('shake', SHAKE_P);
    HAPTIC_P.kind = 'heavy';
    w.events.emit('haptic', HAPTIC_P);
    this.sfx(w, 'enemy_die_m', this.coreX);
    this.sfx(w, 'boss_warning');
  }

  /** The core leaves the rig's rigid offsets once it detaches. */
  private placeCore(): void {
    const c = this.core.enemy;
    if (c === null || !c.active || c.id !== this.core.id) return;
    c.prevX = this.corePrevX;
    c.prevY = this.corePrevY;
    c.x = this.coreX;
    c.y = this.coreY;
  }

  private moveCore(x: number, y: number, dt: number): void {
    this.corePrevX = this.coreX;
    this.corePrevY = this.coreY;
    this.coreX = x;
    this.coreY = y;
    const c = this.core.enemy;
    if (c === null || !c.active || c.id !== this.core.id) return;
    c.prevX = this.corePrevX;
    c.prevY = this.corePrevY;
    c.x = x;
    c.y = y;
    c.vx = dt > 0 ? (x - this.corePrevX) / dt : 0;
    c.vy = dt > 0 ? (y - this.corePrevY) / dt : 0;
  }

  private rise(dt: number): void {
    const k = Math.min(1, this.phaseT / L.launchTime);
    const e = 1 - (1 - k) * (1 - k) * (1 - k);
    const from = L.lockY;
    this.moveCore(
      120 + Math.sin(this.phaseT * 30) * (1 - k) * 1.5,
      from + (L.core.y - from) * e,
      dt,
    );
  }

  private strafe(dt: number): void {
    const c = L.core;
    this.sweep = (this.sweep + dt / c.period) % 2;
    const s = (1 - Math.cos(Math.PI * this.sweep)) / 2;
    const x = c.minX + (c.maxX - c.minX) * s;
    const y = c.y + Math.sin((this.phaseT / c.bobPeriod) * Math.PI * 2) * c.bobAmp;
    this.moveCore(x, y, dt);
  }

  private fireSpiral(w: World, dt: number): void {
    const c = L.core;
    this.spiralT += dt;
    const cycle = c.on + c.off;
    if (this.spiralT >= cycle) this.spiralT -= cycle;
    if (this.spiralT >= c.on) return;
    this.spiralGap -= dt;
    if (this.spiralGap > 0) return;
    this.spiralGap += c.gap;
    if (!w.player.alive) return;
    let n = 0;
    for (let a = 0; a < c.arms; a++)
      n += shootDir(
        w,
        this.coreX,
        this.coreY + 6,
        this.spiralRot + (a * 360) / c.arms,
        c.speed,
        SHOT_SMALL,
      );
    if (n > 0 && Math.floor(this.spiralT / 0.5) !== Math.floor((this.spiralT - c.gap) / 0.5))
      emitEnemyShotSfx(w, this.coreX);
    this.spiralRot = (this.spiralRot + c.rotStep) % 360;
  }

  /** Debris tumbling off the burning bridge. */
  private debris(w: World, dt: number): void {
    this.debrisT -= dt;
    if (this.debrisT > 0) return;
    const d = L.debris;
    this.debrisT += d.every;
    const rng = w.rng;
    const a = (90 + rng.range(-d.spreadDeg, d.spreadDeg)) * DEG;
    const v = rng.range(d.speed[0], d.speed[1]);
    rockInit.x = w.width / 2 + rng.range(-26, 26);
    rockInit.y = L.lockY + 14;
    rockInit.vx = Math.cos(a) * v;
    rockInit.vy = Math.sin(a) * v;
    spawnRock(w, rockInit);
  }

  private deathChain(w: World, dt: number): void {
    this.popT -= dt;
    let n = 0;
    while (this.popT <= 0) {
      this.popT += L.deathPopGap;
      const rng = w.rng;
      // Pops walk down the visible hull from the core outward.
      const k = Math.min(1, this.phaseT / L.deathTime);
      const y = rng.range(0, 60 + 340 * k);
      const hw = Math.max(20, Math.min(100, 30 + y));
      const x = w.width / 2 + rng.range(-hw, hw);
      const size = rng.next() < 0.3 ? 48 : rng.next() < 0.6 ? 32 : 16;
      const i = this.popI;
      this.pops[i * 4] = x;
      this.pops[i * 4 + 1] = y;
      this.pops[i * 4 + 2] = 0;
      this.pops[i * 4 + 3] = size;
      this.popI = (i + 1) % POPS;
      if (n++ % 2 === 0) this.sfx(w, size === 16 ? 'enemy_die_s' : 'enemy_die_m', x);
      if (size === 48) {
        SHAKE_P.mag = 2.5;
        SHAKE_P.dur = 0.3;
        w.events.emit('shake', SHAKE_P);
      }
    }
  }

  private defeat(w: World): void {
    this.defeatEmitted = true;
    const run = w.run;
    run.bossDefeated = true;
    run.kills++;
    addKillScore(w, L.score);
    DEFEAT_P.defId = L.id;
    DEFEAT_P.x = this.coreX;
    DEFEAT_P.y = this.coreY;
    w.events.emit('bossDefeated', DEFEAT_P);
    this.sfx(w, 'boss_die', this.coreX);
    HAPTIC_P.kind = 'heavy';
    w.events.emit('haptic', HAPTIC_P);
    clearShotsToSalvage(w, L.shotSalvageMax);
    // Nothing on the field may kill the player after the win: debris goes, the core stops ramming.
    const c = this.core.enemy;
    if (c !== null) c.contactDamage = 0;
    const rocks = w.asteroids.items;
    for (let i = 0; i < w.asteroids.count; i++) {
      const a = rocks[i];
      if (a !== undefined && a.active) w.asteroids.release(a);
    }
    // Missiles and mines still in the air go up with the ship.
    const items = w.enemies.items;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = items[i] as Enemy;
      if (e.active && !e.isBoss && (e.defId === 'ar_missile' || e.defId === 'ar_mine'))
        damageEnemy(w, e, e.hp, 'hazard');
    }
    this.popT = 0;
  }

  /** After the fight: the wreck drifts off as the scroll picks back up. */
  outro(w: World, dt: number): void {
    if (!this.sunk) return;
    this.sunkT += dt;
    const v = Math.min(1, this.sunkT / 2.5) * L.outroScroll;
    if (Math.abs(w.scrollSpeed - v) > 0.01) setScrollSpeed(w, v);
    this.anchorPrevY = this.anchorY;
    this.anchorY += v * dt;
    for (let i = 2; i < this.pops.length; i += 4) this.pops[i] = (this.pops[i] as number) + dt;
  }

  private sfx(w: World, id: string, x?: number): void {
    SFX_P.id = id;
    SFX_P.x = x;
    w.events.emit('sfx', SFX_P);
  }
}
