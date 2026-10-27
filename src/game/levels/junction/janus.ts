import type { AimedPattern } from '../../../content/enemies';
import { JANUS, type JanusDef } from '../../../content/levels/junction';
import { addKillScore, HIT_FLASH } from '../../../sim/damage';
import { spawnEnemy } from '../../../sim/spawn';
import type { Bullet, Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { BossRig, clearShotsToSalvage, type BossController, type PartSlot } from '../../boss';
import { emitToast } from '../../director';
import { spraySalvage } from '../../pickups';
import { burst, emitEnemyShotSfx, ring, SHOT_SMALL } from '../../enemies';
import {
  collapsePortalPair,
  setPortalEnd,
  spawnPortalPair,
  swapPortals,
  type PortalEnd,
  type PortalPair,
} from '../../obstacles';
import { Aim, aimExit, jx, pairLive, type JunctionState } from './state';

// Janus: descend → phase 1 (fight: entry rings fixed under the faces, the
// exits held over the faces by the generators; generator bursts and a
// 16-ring) → one face down → phase 2 (frenzy: entries drift, the pairs swap
// every 6 s, the surviving face spins a 4-arm spiral, Blinkers out of the
// exits) → the last face → dying (wall down, rings implode) → done.
// The portal wall and the shot-turning exits live in the junction pass; the
// boss writes their state every tick.

export const Phase = {
  Entry: 0,
  Fight: 1,
  Frenzy: 2,
  Dying: 3,
  Done: 4,
} as const;
export type PhaseId = (typeof Phase)[keyof typeof Phase];

const PHASE_NAMES = ['entry', 'fight', 'frenzy', 'dying', 'done'] as const;

const DEFEAT_P = { defId: '', x: 0, y: 0 };
const SFX_P = { id: '', x: 0 as number | undefined };
const SHAKE_P = { mag: 0, dur: 0 };
const VOLLEY: AimedPattern = { kind: 'aimed', n: 1, spreadDeg: 0, speed: 92 };
const PING_GAP = 0.12;
const FAIR_ABOVE = 24;
const TOUCH_PAD = 6;

/** Whether a player shot is on `part` right now (the hit that's landing came from one). */
function shotTouching(w: World, part: Enemy): boolean {
  const items = w.playerShots.items;
  for (let i = 0; i < w.playerShots.count; i++) {
    const b = items[i] as Bullet;
    if (!b.active) continue;
    const rr = part.r + b.r + TOUCH_PAD;
    const dx = b.x - part.x;
    const dy = b.y - part.y;
    if (dx * dx + dy * dy < rr * rr) return true;
  }
  return false;
}

export class Janus implements BossController {
  readonly defId: string;
  readonly def: JanusDef;
  readonly rig: BossRig;
  phase: PhaseId = Phase.Entry;
  phaseT = 0;
  t = 0;
  readonly faces: [PartSlot, PartSlot];
  readonly gens: [PartSlot, PartSlot];
  /** Pair i was spawned entry-under-face-i ↔ exit-over-face-i; swaps re-pair the exits. */
  readonly pairs: [PortalPair | null, PortalPair | null] = [null, null];
  readonly pairIds: [number, number] = [-1, -1];
  /** Exit i always hangs over face i (whichever pair holds it now). */
  readonly exits: [PortalEnd | null, PortalEnd | null] = [null, null];
  readonly exitX: [number, number] = [0, 0];
  readonly entryX: [number, number] = [0, 0];
  readonly entryY: [number, number] = [0, 0];
  private readonly phi: [number, number] = [0, 0];
  burstT = 0;
  nextShooter = 0;
  ringT = 0;
  ringRot = 0;
  spiralOn = false;
  spiralT = 0;
  spiralRingT = 0;
  spiralRot = 0;
  blinkT = 0;
  blinkSide = 0;
  swapT = 0;
  swaps = 0;
  /** Seconds since a face was hit with the wall up (through a ring). */
  sinceRingHit = 0;
  /** Ring damage in 1 s buckets over the assist window, and the fight clock it runs on. */
  readonly ringDmg: Float32Array;
  private bucketI = 0;
  private bucketT = 0;
  fightT = 0;
  /** Seconds into the flicker cycle (the silent assist), and how many times the wall dropped. */
  flickerT = 0;
  wallDown = false;
  flickers = 0;
  /** Face hits through a ring, and while the wall was down. */
  ringHits = 0;
  directHits = 0;
  pendingDefeat = false;
  defeatEmitted = false;
  /** Where the rings were when they imploded (draw). */
  readonly implodeAt = new Float32Array(8);
  private world: World | null = null;
  /** Generators 0–1 and faces 2–3 that already paid their salvage. */
  private readonly paid = [false, false, false, false];
  private pingT = 0;
  private pingWanted = false;
  private pingX = 0;

  constructor(def: JanusDef = JANUS) {
    this.def = def;
    this.defId = def.id;
    this.rig = new BossRig(def.parts);
    this.ringDmg = new Float32Array(Math.max(1, Math.round(def.flicker.after)));
    const faces = this.rig.slots.filter((s) => s.spec.defId === 'wj_janus_face');
    const gens = this.rig.slots.filter((s) => s.spec.defId === 'wj_janus_gen');
    this.faces = [faces[0] as PartSlot, faces[1] as PartSlot];
    this.gens = [gens[0] as PartSlot, gens[1] as PartSlot];
  }

  spawn(w: World): boolean {
    const ok = this.rig.spawn(w, w.width / 2, this.def.entry.fromY);
    this.burstT = this.def.burst.interval;
    this.ringT = this.def.ring.interval;
    return ok;
  }

  get done(): boolean {
    return this.phase === Phase.Done;
  }

  invulnerable(): boolean {
    return this.phase === Phase.Entry || this.phase >= Phase.Dying;
  }

  /**
   * Seekers, Arc Coil and drones lock on to the generators. The faces only
   * while the wall is down, or once no generator is left to lock on to.
   */
  targetable(_part: Enemy, slot: PartSlot): boolean {
    if (this.invulnerable() || !slot.targetable || slot.destroyed) return false;
    if (!this.isFace(slot) || this.wallDown) return true;
    return !this.rig.alive(this.gens[0]) && !this.rig.alive(this.gens[1]);
  }

  phaseName(): string {
    return PHASE_NAMES[this.phase];
  }

  isFace(slot: PartSlot): boolean {
    return slot === this.faces[0] || slot === this.faces[1];
  }

  onDamage(part: Enemy, slot: PartSlot, amount: number): boolean {
    if (this.invulnerable()) {
      this.pingWanted = true;
      this.pingX = part.x;
      return true;
    }
    if (!this.isFace(slot)) return false;
    // Only shots reach a face: a Flak shell bursting on it from below, or an arc, is the wall's.
    if (this.world !== null && !this.wallDown && !shotTouching(this.world, part)) {
      this.pingWanted = true;
      this.pingX = part.x;
      return true;
    }
    if (this.wallDown) this.directHits++;
    else {
      this.ringHits++;
      this.sinceRingHit = 0;
      const i = this.bucketI;
      this.ringDmg[i] = (this.ringDmg[i] as number) + Math.min(amount, part.hp);
    }
    const other = slot === this.faces[0] ? this.faces[1] : this.faces[0];
    if (amount >= part.hp && (other.destroyed || !this.rig.alive(other))) {
      part.hp = 0;
      part.flashT = HIT_FLASH;
      this.pendingDefeat = true;
      this.setPhase(Phase.Dying);
      return true;
    }
    return false;
  }

  private setPhase(p: PhaseId): void {
    this.phase = p;
    this.phaseT = 0;
  }

  facesLeft(): number {
    let n = 0;
    for (const f of this.faces) if (!f.destroyed && this.rig.alive(f)) n++;
    return n;
  }

  /** x of face i's center (the rig's live position). */
  faceX(i: number): number {
    return this.rig.x + (this.faces[i] as PartSlot).spec.ox;
  }

  faceY(i: number): number {
    return this.rig.y + (this.faces[i] as PartSlot).spec.oy;
  }

  wallY(): number {
    return this.rig.y + this.def.wall.oy;
  }

  update(w: World, dt: number): void {
    this.world = w;
    this.t += dt;
    this.phaseT += dt;
    this.pingT -= dt;
    if (this.pingWanted) {
      this.pingWanted = false;
      if (this.pingT <= 0) {
        this.pingT = PING_GAP;
        this.sfx(w, 'armor_ping', this.pingX);
      }
    }
    if (this.pendingDefeat && !this.defeatEmitted) this.defeat(w);

    const d = this.def;
    const tx = this.rig.x;
    let ty = this.rig.y;
    if (this.phase === Phase.Entry) {
      const k = Math.min(1, this.phaseT / d.entry.duration);
      const e = 1 - (1 - k) * (1 - k) * (1 - k);
      ty = d.entry.fromY + (d.entry.toY - d.entry.fromY) * e;
    } else if (this.phase < Phase.Dying) {
      ty = d.entry.toY + Math.sin((this.t / d.bob.period) * Math.PI * 2) * d.bob.amp;
    } else if (this.phase === Phase.Dying) {
      ty = this.rig.y + 6 * dt;
    }
    const lost = this.rig.moveTo(tx, ty, dt);
    if (lost > 0) this.onPartsLost(w);

    const s = jx(w);
    switch (this.phase) {
      case Phase.Entry:
        if (this.phaseT >= d.entry.duration) {
          this.setPhase(Phase.Fight);
          this.openRings(w);
          emitToast(w, 'SHOOT THROUGH THE RINGS');
        }
        break;
      case Phase.Fight:
        this.tendRings(w);
        this.fireBursts(w, dt);
        this.fireRing(w, dt);
        this.assist(dt);
        break;
      case Phase.Frenzy:
        this.tendRings(w);
        this.fireBursts(w, dt);
        this.fireSpiral(w, dt);
        this.launchBlinkers(w, dt);
        this.scheduleSwaps(w, dt);
        this.assist(dt);
        break;
      case Phase.Dying:
        if (this.phaseT >= d.deathTime) {
          this.rig.release(w);
          this.setPhase(Phase.Done);
        }
        break;
    }
    this.writeWall(s);
  }

  private writeWall(s: JunctionState): void {
    const wl = s.wall;
    const d = this.def.wall;
    wl.on = this.phase < Phase.Dying;
    wl.down = this.wallDown;
    wl.x0 = this.rig.x - d.halfWidth;
    wl.x1 = this.rig.x + d.halfWidth;
    wl.y = this.wallY();
    wl.shipPad = d.shipPad;
  }

  private onPartsLost(w: World): void {
    // Wrecked parts pay out where they stood (the boss's own reward comes from the director).
    for (let i = 0; i < 2; i++) {
      const g = this.gens[i] as PartSlot;
      if (g.destroyed && !this.paid[i]) {
        this.paid[i] = true;
        spraySalvage(w, this.rig.x + g.spec.ox, this.rig.y + g.spec.oy, this.def.partSalvage.gen);
      }
      const f = this.faces[i] as PartSlot;
      if (f.destroyed && !this.paid[2 + i]) {
        this.paid[2 + i] = true;
        spraySalvage(
          w,
          this.rig.x + f.spec.ox,
          this.rig.y + f.spec.oy + 20,
          this.def.partSalvage.face,
        );
      }
    }
    if (this.phase === Phase.Fight && this.facesLeft() < 2) {
      SHAKE_P.mag = this.def.shake.mag;
      SHAKE_P.dur = this.def.shake.dur;
      w.events.emit('shake', SHAKE_P);
      this.enterFrenzy();
    }
    if (this.facesLeft() === 0 && this.phase < Phase.Dying) {
      // Both faces went in one tick (a pierce shot): no hook saw the last one.
      this.pendingDefeat = true;
      this.setPhase(Phase.Dying);
    }
  }

  private enterFrenzy(): void {
    this.setPhase(Phase.Frenzy);
    const dr = this.def.drift;
    const mid = (dr.minX + dr.maxX) / 2;
    const half = (dr.maxX - dr.minX) / 2;
    // Start each ring's drift where it stands, so nothing jumps.
    for (let i = 0; i < 2; i++) {
      const k = Math.max(-1, Math.min(1, ((this.entryX[i] as number) - mid) / half));
      this.phi[i] = Math.asin(k);
    }
    this.spiralOn = false;
    this.spiralT = this.def.spiral.off * 0.5;
    this.blinkT = this.def.blinkers.first;
    this.swapT = this.def.drift.swapEvery;
  }

  /** Spawns both pairs: entry under face i ↔ exit over face i. */
  private openRings(w: World): void {
    const r = this.def.rings;
    for (let i = 0; i < 2; i++) {
      const old = this.pairs[i] ?? null;
      if (pairLive(old, this.pairIds[i] as number)) collapsePortalPair(w, old);
    }
    for (let i = 0; i < 2; i++) {
      const fx = this.faceX(i);
      this.entryX[i] = i === 0 ? r.entryX : w.width - r.entryX;
      this.entryY[i] = r.entryY;
      this.exitX[i] = fx;
      const p = spawnPortalPair(w, this.entryX[i] as number, r.entryY, fx, r.exitY, {
        color: r.colors[i],
      });
      this.pairs[i] = p;
      this.pairIds[i] = p === null ? -1 : p.id;
      this.exits[i] = p === null ? null : p.b;
    }
  }

  ringsLive(): boolean {
    return pairLive(this.pairs[0], this.pairIds[0]) && pairLive(this.pairs[1], this.pairIds[1]);
  }

  /** Every tick: entries (fixed, or drifting in phase 2) and exits (held, or wandering). */
  private tendRings(w: World): void {
    if (!this.ringsLive()) {
      this.openRings(w);
      if (!this.ringsLive()) return;
    }
    const r = this.def.rings;
    if (this.phase === Phase.Frenzy) {
      const dr = this.def.drift;
      const mid = (dr.minX + dr.maxX) / 2;
      const half = (dr.maxX - dr.minX) / 2;
      const ft = this.phaseT;
      for (let i = 0; i < 2; i++) {
        this.entryX[i] =
          mid + half * Math.sin(ft * (dr.speedX[i] as number) + (this.phi[i] as number));
        this.entryY[i] = r.entryY + Math.sin(ft * dr.speedY + i * Math.PI) * dr.bobY;
      }
    }
    for (let i = 0; i < 2; i++) {
      const fx = this.faceX(i);
      const held = this.rig.alive(this.gens[i] as PartSlot);
      this.exitX[i] = held ? fx : fx + Math.sin(this.t * r.driftSpeed + i * 1.7) * r.driftAmp;
    }
    for (let i = 0; i < 2; i++) {
      const p = this.pairs[i] as PortalPair;
      setPortalEnd(w, p, 'a', this.entryX[i] as number, this.entryY[i] as number);
      const k = p.b === this.exits[0] ? 0 : 1;
      setPortalEnd(w, p, 'b', this.exitX[k] as number, r.exitY);
    }
    for (let k = 0; k < 2; k++) {
      const end = this.exits[k] ?? null;
      if (end === null) continue;
      const held = this.rig.alive(this.gens[k] as PartSlot);
      aimExit(
        w,
        end,
        this.pairIds[0],
        this.pairIds[1],
        held ? Aim.Point : Aim.Down,
        this.faceX(k),
        this.faceY(k),
      );
    }
  }

  /** Which face the entry at index i leads to now (the exit its pair holds). */
  entryLeadsTo(i: number): number {
    const p = this.pairs[i] ?? null;
    if (p === null) return -1;
    return p.b === this.exits[0] ? 0 : 1;
  }

  private scheduleSwaps(w: World, dt: number): void {
    this.swapT -= dt;
    if (this.swapT > 0) return;
    this.swapT += this.def.drift.swapEvery;
    const [p, q] = this.pairs;
    if (p !== null && q !== null && swapPortals(w, p, q)) this.swaps++;
  }

  /** Damage dealt through the rings over the last `flicker.after` seconds. */
  ringDamageRecent(): number {
    let n = 0;
    for (let i = 0; i < this.ringDmg.length; i++) n += this.ringDmg[i] as number;
    return n;
  }

  /**
   * The silent assist. A player who has landed (almost) nothing through the
   * rings for `after` s gets the wall dropped for `off` s every `every` s;
   * sporadic stray hits through a drifting ring don't count as progress.
   * Once started, a window always runs its full length.
   */
  private assist(dt: number): void {
    const f = this.def.flicker;
    this.sinceRingHit += dt;
    this.fightT += dt;
    this.bucketT += dt;
    if (this.bucketT >= 1) {
      this.bucketT -= 1;
      this.bucketI = (this.bucketI + 1) % this.ringDmg.length;
      this.ringDmg[this.bucketI] = 0;
    }
    const struggling = this.fightT >= f.after && this.ringDamageRecent() < f.minDamage;
    if (!struggling && !this.wallDown) {
      this.flickerT = 0;
      return;
    }
    const was = this.wallDown;
    this.wallDown = this.flickerT % f.every < f.off;
    if (this.wallDown && !was) this.flickers++;
    this.flickerT += dt;
  }

  private fireBursts(w: World, dt: number): void {
    this.burstT -= dt;
    if (this.burstT > 0) return;
    const b = this.def.burst;
    this.burstT += b.interval;
    const pl = w.player;
    if (!pl.alive) return;
    VOLLEY.speed = b.speed;
    // The generators take turns; the bursts end with them.
    for (let k = 0; k < 2; k++) {
      const i = (this.nextShooter + k) % 2;
      const g = this.gens[i] as PartSlot;
      if (!this.rig.alive(g)) continue;
      this.nextShooter = (i + 1) % 2;
      const e = g.enemy as Enemy;
      if (e.y <= pl.y - FAIR_ABOVE) burst(w, e, b.count, b.gap, VOLLEY, SHOT_SMALL, false);
      return;
    }
  }

  /** Seconds until the next 16-ring (the throat's glow tell), or a large number. */
  ringTell(): number {
    return this.phase === Phase.Fight ? Math.max(0, this.ringT) : 9;
  }

  /** Where the ring and spiral leave from: the station's throat, under the faces. */
  throatY(): number {
    return this.rig.y + 20;
  }

  private fireRing(w: World, dt: number): void {
    this.ringT -= dt;
    if (this.ringT > 0) return;
    const r = this.def.ring;
    this.ringT += r.interval;
    if (!w.player.alive) return;
    const n = ring(w, this.rig.x, this.throatY(), r.n, r.speed, this.ringRot, SHOT_SMALL);
    if (n > 0) emitEnemyShotSfx(w, this.rig.x);
    this.ringRot = (this.ringRot + r.rotStep) % 360;
  }

  /** The surviving face, or null. */
  liveFace(): PartSlot | null {
    for (const f of this.faces) if (this.rig.alive(f)) return f;
    return null;
  }

  /** Seconds until the next spiral burst (0 while spinning), for the face's glow. */
  spiralTell(): number {
    if (this.phase !== Phase.Frenzy) return 9;
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
      this.spiralRingT = 0;
    }
    if (this.spiralT >= sp.on) {
      this.spiralOn = false;
      this.spiralT = 0;
      return;
    }
    this.spiralRingT -= dt;
    if (this.spiralRingT > 0) return;
    this.spiralRingT += sp.interval;
    const f = this.liveFace();
    if (f === null || !w.player.alive) return;
    const e = f.enemy as Enemy;
    const n = ring(w, e.x, e.y + 8, sp.arms, sp.speed, this.spiralRot, SHOT_SMALL);
    if (n > 0 && Math.round(this.spiralRot / sp.rotStep) % 2 === 0) emitEnemyShotSfx(w, e.x);
    this.spiralRot = (this.spiralRot + sp.rotStep) % 360;
  }

  private launchBlinkers(w: World, dt: number): void {
    this.blinkT -= dt;
    if (this.blinkT > 0) return;
    this.blinkT += this.def.blinkers.every;
    const k = this.blinkSide;
    this.blinkSide = 1 - k;
    // Out of an exit ring at the top edge.
    spawnEnemy(w, 'wj_blinker', this.exitX[k] as number, this.def.rings.exitY + 16);
  }

  private defeat(w: World): void {
    this.defeatEmitted = true;
    // The rings implode with the wall.
    for (let i = 0; i < 2; i++) {
      const p = this.pairs[i] ?? null;
      if (pairLive(p, this.pairIds[i] as number)) {
        this.implodeAt[i * 4] = p.a.x;
        this.implodeAt[i * 4 + 1] = p.a.y;
        this.implodeAt[i * 4 + 2] = p.b.x;
        this.implodeAt[i * 4 + 3] = p.b.y;
        collapsePortalPair(w, p);
      }
      this.pairs[i] = null;
      this.pairIds[i] = -1;
    }
    this.wallDown = false;
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
