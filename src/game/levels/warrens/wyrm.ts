import { DEN, WYRM, WYRM_PARTS } from '../../../content/levels/warrens';
import { addKillScore, HIT_FLASH } from '../../../sim/damage';
import { setScrollSpeed } from '../../../sim/scroll';
import type { Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { BossRig, clearShotsToSalvage, type BossController, type PartSlot } from '../../boss';
import { emitToast } from '../../director';
import { aimAt, emitEnemyShotSfx, fan, SHOT_SMALL, shootDir } from '../../enemies';
import { spawnRock } from '../../obstacles';
import { carveTiles } from '../../terrain';
import { denBrake, markedRowY } from './scripts';
import { warrensState } from './state';

// The Wyrm (design: Level 7 boss). A head and 8 segments; the segments follow
// the head's path, read back from a preallocated ring of path samples. The
// fight is a loop of motions:
//   under → telegraph (0.8 s dust trail to the exit point) → cross (a smooth
//   arc between two walls or pillars; the mouth is open for 1.4 s after it
//   surfaces) → dive (the body follows the head into the rock) → under.
// FRENZY (< 50% of total HP): faster, two crossings per burrow, a 7-way fan
// from the mouth on surfacing, and the head carves whatever it passes through.
// The scroll is 0 and the arena fixed for the whole fight (the den brake).

export const Motion = {
  Entry: 0,
  Under: 1,
  Telegraph: 2,
  Cross: 3,
  Dive: 4,
  Dying: 5,
  Done: 6,
} as const;
export type MotionId = (typeof Motion)[keyof typeof Motion];

const MOTION_NAMES = ['entry', 'under', 'telegraph', 'cross', 'dive', 'dying', 'done'] as const;

/** Anchor groups: an arc never starts and ends on the same wall or pillar. */
export const Group = { WallL: 0, WallR: 1, PillarL: 2, PillarR: 3, Top: 4 } as const;

const W = WYRM;
const SEGS = W.seg.count;
const PATH = 256;
/** Path samples are this far apart (px) at most. */
const STEP = 2;
const BODY = W.firstGap + (SEGS - 1) * W.gap;
const SPARKS = 12;
const POPS = 12;
const PING_GAP = 0.12;
const HIDE_X = -200;
const HIDE_Y = -200;
const MID_X = 120;
/** Default pillar center y on the fixed arena (when the den isn't marked, e.g. `?t=` or the sandbox). */
const PILLAR_Y = 148;

const DEFEAT_P = { defId: '', x: 0, y: 0 };
const SFX_P = { id: '', x: 0 as number | undefined };
const SHAKE_P = { mag: 0, dur: 0 };
const rockInit = { size: 'small' as const, x: 0, y: 0, vx: 0, vy: 0 };

export class Wyrm implements BossController {
  readonly defId = W.id;
  readonly rig = new BossRig(WYRM_PARTS);
  motion: MotionId = Motion.Entry;
  motionT = 0;
  t = 0;
  frenzy = false;

  // The head.
  hx = MID_X;
  hy = -40;
  hdx = 0;
  hdy = 1;
  under = true;
  /** Seconds since it last surfaced (the mouth is open while < WYRM.surface). */
  surfaceT = 99;
  private fanDue = false;

  // The current arc: E → C → X (quadratic Bézier), parameter bt.
  ex = 0;
  ey = 0;
  cx = 0;
  cy = 0;
  xx = 0;
  xy = 0;
  bt = 0;
  crossLeft = 0;
  /** Anchor index of the arc's end (and of the last exit while under). */
  toAnchor = -1;
  diveLeft = 0;
  /** Telegraph: the underground start and the emergence point (the dust trail runs between them). */
  tsx = 0;
  tsy = 0;
  tex = 0;
  tey = 0;
  fromAnchor = -1;

  // Emergence anchors: wall faces, pillar centers, the top edge.
  readonly anX: Float32Array;
  readonly anY: Float32Array;
  readonly anG: Int8Array;
  private anchorsSet = false;

  // The path: newest sample at pHead; pu = sampled underground.
  readonly px = new Float32Array(PATH);
  readonly py = new Float32Array(PATH);
  readonly pu = new Uint8Array(PATH);
  pHead = 0;
  pN = 0;

  // Per part (slot 0 = head, 1..8 = segments, nose to tail).
  readonly vis = new Uint8Array(SEGS + 1);
  readonly rot = new Float32Array(SEGS + 1);
  readonly lastX = new Float32Array(SEGS + 1);
  readonly lastY = new Float32Array(SEGS + 1);
  readonly side = new Int8Array(SEGS + 1);
  /** Segments popped by the death chain. */
  popped = 0;
  popT = 0;

  /** Armor sparks: x, y, age. Death pops: x, y, age. */
  readonly sparks = new Float32Array(SPARKS * 3).fill(99);
  readonly pops = new Float32Array(POPS * 3).fill(99);
  private sparkI = 0;
  private sparkSeq = 0;
  private popI = 0;
  private pingT = 0;
  private pingWanted = false;
  private pingX = 0;
  private pendingDefeat = false;
  private defeatEmitted = false;
  /** Carved tiles so far (tests and the sector check read it). */
  carved = 0;

  readonly head: PartSlot;

  constructor() {
    this.head = this.rig.slots[0] as PartSlot;
    const n = 4 + 4 + 2 + 3;
    this.anX = new Float32Array(n);
    this.anY = new Float32Array(n);
    this.anG = new Int8Array(n);
  }

  spawn(w: World): boolean {
    const ok = this.rig.spawn(w, HIDE_X, HIDE_Y);
    this.resetPath(this.hx, this.hy, true);
    for (let i = 0; i <= SEGS; i++) this.hide(i);
    return ok;
  }

  get done(): boolean {
    return this.motion === Motion.Done;
  }

  get open(): boolean {
    return !this.under && this.surfaceT < W.surface;
  }

  motionName(): string {
    return MOTION_NAMES[this.motion];
  }

  phaseName(): string {
    if (this.motion === Motion.Entry) return 'entry';
    if (this.motion >= Motion.Dying) return MOTION_NAMES[this.motion];
    return this.frenzy ? 'frenzy' : 'burrow';
  }

  targetable(_part: Enemy, slot: PartSlot): boolean {
    if (this.motion >= Motion.Dying) return false;
    const i = this.rig.slots.indexOf(slot);
    if (i < 0 || this.vis[i] === 0) return false;
    return i === 0 ? this.open : true;
  }

  onDamage(part: Enemy, slot: PartSlot, amount: number): boolean {
    if (this.motion >= Motion.Dying) return true;
    const i = slot === this.head ? 0 : this.rig.slots.indexOf(slot);
    if (i < 0 || this.vis[i] === 0) return true;
    if (i !== 0) return false;
    if (!this.open) {
      this.deflect(part);
      return true;
    }
    if (amount >= part.hp) {
      part.hp = 0;
      part.flashT = HIT_FLASH;
      this.pendingDefeat = true;
      this.setMotion(Motion.Dying);
      return true;
    }
    return false;
  }

  private deflect(part: Enemy): void {
    const k = this.sparkSeq++;
    const i = this.sparkI;
    this.sparks[i * 3] = part.x + (((k * 37) % 11) - 5);
    this.sparks[i * 3 + 1] = part.y + (((k * 13) % 9) - 4);
    this.sparks[i * 3 + 2] = 0;
    this.sparkI = (i + 1) % SPARKS;
    this.pingWanted = true;
    this.pingX = part.x;
  }

  private setMotion(m: MotionId): void {
    this.motion = m;
    this.motionT = 0;
  }

  speed(): number {
    return this.frenzy ? W.speed2 : W.speed1;
  }

  /** Crossing speed: it heaves itself out of the rock slowly and gathers speed over the surfacing. */
  crossSpeed(): number {
    const k = Math.min(1, this.surfaceT / W.surface);
    return this.speed() * (W.surfaceSlow + (1 - W.surfaceSlow) * k * k);
  }

  // -------------------------------------------------------------------------

  update(w: World, dt: number): void {
    this.t += dt;
    this.motionT += dt;
    this.surfaceT += dt;
    for (let i = 2; i < this.sparks.length; i += 3)
      this.sparks[i] = (this.sparks[i] as number) + dt;
    for (let i = 2; i < this.pops.length; i += 3) this.pops[i] = (this.pops[i] as number) + dt;
    this.pingT -= dt;
    if (this.pingWanted) {
      this.pingWanted = false;
      if (this.pingT <= 0 && this.motion < Motion.Dying) {
        this.pingT = PING_GAP;
        this.sfx(w, 'armor_ping', this.pingX);
      }
    }
    if (this.pendingDefeat && !this.defeatEmitted) this.defeat(w);

    switch (this.motion) {
      case Motion.Entry:
        this.entry(w);
        break;
      case Motion.Under:
        if (this.motionT >= W.under) this.startTelegraph(w);
        break;
      case Motion.Telegraph:
        this.telegraph(w);
        break;
      case Motion.Cross:
        this.cross(w, dt);
        break;
      case Motion.Dive:
        this.dive(dt);
        break;
      case Motion.Dying:
        this.dying(w, dt);
        break;
    }
    if (this.motion !== Motion.Done) this.place(w, dt);
    if (this.motion < Motion.Dying && !this.frenzy) this.checkFrenzy(w);
  }

  private entry(w: World): void {
    // The den brake runs in the level system too; this covers the sandbox, where it doesn't.
    const stopped = denBrake(w);
    if (!stopped && this.motionT > 3 && !warrensState(w).marks.has(DEN.id)) setScrollSpeed(w, 0);
    if (w.scrollSpeed > 0) {
      this.motionT = 0;
      return;
    }
    if (this.motionT < W.entryDelay) return;
    this.setAnchors(w);
    this.toAnchor = -1;
    this.setMotion(Motion.Under);
  }

  private setAnchors(w: World): void {
    if (this.anchorsSet) return;
    this.anchorsSet = true;
    let n = 0;
    const add = (x: number, y: number, g: number): void => {
      this.anX[n] = x;
      this.anY[n] = y;
      this.anG[n] = g;
      n++;
    };
    for (const y of W.wallYs) add(DEN.wallL, y, Group.WallL);
    for (const y of W.wallYs) add(DEN.wallR, y, Group.WallR);
    const bottom = markedRowY(w, DEN.id, DEN.pillarRow);
    const py = Number.isNaN(bottom) ? PILLAR_Y : bottom - (DEN.pillarRows * 8) / 2;
    const half = (DEN.pillarW * 8) / 2;
    add(DEN.pillarCols[0] * 8 + half, py, Group.PillarL);
    add(DEN.pillarCols[1] * 8 + half, py, Group.PillarR);
    for (const x of [60, 120, 180]) add(x, -14, Group.Top);
  }

  /** Picks an anchor index: not in group `notG`, at least `minDx` from x, away from the ship. */
  private pickAnchor(w: World, notG: number, x: number, minDx: number): number {
    const p = w.player;
    let count = 0;
    for (let pass = 0; pass < 2 && count === 0; pass++) {
      for (let i = 0; i < this.anX.length; i++) {
        if (!this.anchorOk(i, notG, x, minDx, p.x, p.y, pass === 0)) continue;
        count++;
      }
      if (count === 0) continue;
      let pick = w.rng.int(0, count - 1);
      for (let i = 0; i < this.anX.length; i++) {
        if (!this.anchorOk(i, notG, x, minDx, p.x, p.y, pass === 0)) continue;
        if (pick-- === 0) return i;
      }
    }
    return 0;
  }

  private anchorOk(
    i: number,
    notG: number,
    x: number,
    minDx: number,
    px: number,
    py: number,
    strict: boolean,
  ): boolean {
    if (this.anG[i] === notG) return false;
    if (Math.abs((this.anX[i] as number) - x) < minDx) return false;
    if (!strict) return true;
    const dx = (this.anX[i] as number) - px;
    const dy = (this.anY[i] as number) - py;
    return dx * dx + dy * dy > 60 * 60;
  }

  /** Sets the arc from (sx, sy) to anchor `to`, sagging toward the ship but never below lowestY. */
  private planArc(w: World, sx: number, sy: number, to: number): void {
    const x1 = this.anX[to] as number;
    const y1 = this.anY[to] as number;
    this.ex = sx;
    this.ey = sy;
    this.xx = x1;
    this.xy = y1;
    this.toAnchor = to;
    const sag = w.rng.range(W.sag[0], W.sag[1]);
    const maxCy = 2 * W.lowestY - (sy + y1) / 2;
    this.cx = (sx + x1) / 2;
    this.cy = Math.min(Math.max(sy, y1) + sag, maxCy);
    this.bt = 0;
  }

  private startTelegraph(w: World): void {
    const lastG = this.toAnchor >= 0 ? (this.anG[this.toAnchor] as number) : -1;
    const from = this.pickAnchor(w, lastG, -999, 0);
    const fx = this.anX[from] as number;
    const fy = this.anY[from] as number;
    const to = this.pickAnchor(w, this.anG[from] as number, fx, 70);
    this.fromAnchor = from;
    this.planArc(w, fx, fy, to);
    // The trail comes up to the exit point along the arc's first heading.
    let nx = this.cx - fx;
    let ny = this.cy - fy;
    const d = Math.hypot(nx, ny) || 1;
    nx /= d;
    ny /= d;
    const len = this.speed() * W.telegraph;
    this.tex = fx;
    this.tey = fy;
    this.tsx = fx - nx * len;
    this.tsy = fy - ny * len;
    this.hx = this.tsx;
    this.hy = this.tsy;
    this.hdx = nx;
    this.hdy = ny;
    this.under = true;
    this.crossLeft = this.frenzy ? W.crossings2 : W.crossings1;
    this.record(true);
    this.setMotion(Motion.Telegraph);
  }

  private telegraph(w: World): void {
    const k = Math.min(1, this.motionT / W.telegraph);
    this.hx = this.tsx + (this.tex - this.tsx) * k;
    this.hy = this.tsy + (this.tey - this.tsy) * k;
    if (this.motionT < W.telegraph) return;
    // Surfacing: the mouth opens and it bursts out of the rock.
    this.under = false;
    this.surfaceT = 0;
    this.fanDue = this.frenzy;
    this.setMotion(Motion.Cross);
    this.burst(w, this.tex, this.tey);
  }

  /** Bursting out of (or into) the rock: a hole, a crack and a jolt. */
  private burst(w: World, x: number, y: number): void {
    this.carved += carveTiles(w, x, y, W.carveR);
    this.sfx(w, 'asteroid_break', x);
    SHAKE_P.mag = 1.5;
    SHAKE_P.dur = 0.2;
    w.events.emit('shake', SHAKE_P);
  }

  private cross(w: World, dt: number): void {
    // Arc length step: dt · speed / |B'(t)|.
    const t = this.bt;
    const dx = 2 * (1 - t) * (this.cx - this.ex) + 2 * t * (this.xx - this.cx);
    const dy = 2 * (1 - t) * (this.cy - this.ey) + 2 * t * (this.xy - this.cy);
    const d = Math.hypot(dx, dy) || 1;
    this.bt = Math.min(1, t + (this.crossSpeed() * dt) / d);
    const u = this.bt;
    const a = (1 - u) * (1 - u);
    const b = 2 * u * (1 - u);
    const c = u * u;
    this.hx = a * this.ex + b * this.cx + c * this.xx;
    this.hy = a * this.ey + b * this.cy + c * this.xy;
    this.hdx = dx / d;
    this.hdy = dy / d;
    if (this.frenzy) this.carved += carveTiles(w, this.hx, this.hy, W.carveR);
    if (this.fanDue && this.surfaceT >= W.fan.delay) {
      this.fanDue = false;
      this.spitFan(w);
    }
    if (this.bt < 1) return;
    if (this.crossLeft > 1) {
      // FRENZY: it skims the wall and turns straight into a second crossing,
      // surfacing again (mouth open, slow heave) as it pushes off.
      this.crossLeft--;
      const to = this.pickAnchor(w, this.anG[this.toAnchor] as number, this.xx, 70);
      this.planArc(w, this.xx, this.xy, to);
      this.burst(w, this.xx, this.xy);
      this.surfaceT = 0;
      return;
    }
    this.burst(w, this.xx, this.xy);
    this.under = true;
    this.diveLeft = BODY + 8;
    this.setMotion(Motion.Dive);
  }

  private dive(dt: number): void {
    const step = this.speed() * dt;
    this.hx += this.hdx * step;
    this.hy += this.hdy * step;
    this.diveLeft -= step;
    if (this.diveLeft <= 0) this.setMotion(Motion.Under);
  }

  private spitFan(w: World): void {
    const p = w.player;
    if (!p.alive || this.hy < 0 || this.hy > p.y - 24) return;
    const f = W.fan;
    if (fan(w, this.hx, this.hy, f.n, f.arc, f.speed, SHOT_SMALL, aimAt(w, this.hx, this.hy)) > 0)
      emitEnemyShotSfx(w, this.hx);
  }

  private checkFrenzy(w: World): void {
    if (this.rig.hp() >= this.rig.maxHp() * W.frenzyAt) return;
    this.frenzy = true;
    emitToast(w, 'FRENZY');
    SHAKE_P.mag = 2.5;
    SHAKE_P.dur = 0.4;
    w.events.emit('shake', SHAKE_P);
  }

  // -------------------------------------------------------------------------
  // The path and the parts.

  private resetPath(x: number, y: number, under: boolean): void {
    this.pHead = 0;
    this.pN = 1;
    this.px[0] = x;
    this.py[0] = y;
    this.pu[0] = under ? 1 : 0;
  }

  private record(force: boolean): void {
    const i = this.pHead;
    const ddx = this.hx - (this.px[i] as number);
    const ddy = this.hy - (this.py[i] as number);
    const u = this.under ? 1 : 0;
    if (!force && ddx * ddx + ddy * ddy < STEP * STEP && this.pu[i] === u) return;
    const j = (i + 1) % PATH;
    this.px[j] = this.hx;
    this.py[j] = this.hy;
    this.pu[j] = u;
    this.pHead = j;
    if (this.pN < PATH) this.pN++;
  }

  /** Places the head and walks the path back to place each live segment. */
  private place(w: World, dt: number): void {
    if (this.motion !== Motion.Dying) this.record(false);
    const dying = this.motion === Motion.Dying;
    // Head.
    this.setPart(w, 0, this.hx, this.hy, !this.under || dying, this.hdx, this.hdy, dt);
    // Segments: arc-length walk from the head through the samples, newest first.
    let ax = this.hx;
    let ay = this.hy;
    let au = this.under ? 1 : 0;
    let acc = 0;
    let i = this.pHead;
    let left = this.pN;
    let rank = 0;
    for (let s = 1; s <= SEGS; s++) {
      const slot = this.rig.slots[s] as PartSlot;
      if (slot.destroyed || slot.enemy === null) continue;
      if (!this.rig.alive(slot)) {
        this.lost(w, s);
        continue;
      }
      const want = W.firstGap + rank * W.gap;
      rank++;
      let placed = false;
      while (left > 0) {
        const bx = this.px[i] as number;
        const by = this.py[i] as number;
        const len = Math.hypot(bx - ax, by - ay);
        if (acc + len >= want && len > 0) {
          const f = (want - acc) / len;
          const x = ax + (bx - ax) * f;
          const y = ay + (by - ay) * f;
          const hidden = au === 1 || this.pu[i] === 1;
          this.setPart(w, s, x, y, !hidden, ax - bx, ay - by, dt);
          placed = true;
          break;
        }
        acc += len;
        ax = bx;
        ay = by;
        au = this.pu[i] as number;
        i = (i - 1 + PATH) % PATH;
        left--;
      }
      if (!placed) this.setPart(w, s, ax, ay, false, 0, 1, dt);
    }
  }

  private setPart(
    w: World,
    s: number,
    x: number,
    y: number,
    visible: boolean,
    dx: number,
    dy: number,
    dt: number,
  ): void {
    const slot = this.rig.slots[s] as PartSlot;
    const e = slot.enemy;
    if (e === null || !this.rig.alive(slot)) return;
    const wasVis = this.vis[s] === 1;
    if (!visible) {
      if (wasVis) this.hide(s);
      return;
    }
    this.vis[s] = 1;
    if (!wasVis) {
      e.prevX = x;
      e.prevY = y;
      e.x = x;
      e.y = y;
      this.side[s] = x < MID_X ? -1 : 1;
    } else {
      e.prevX = e.x;
      e.prevY = e.y;
    }
    e.vx = dt > 0 ? (x - e.x) / dt : 0;
    e.vy = dt > 0 ? (y - e.y) / dt : 0;
    e.x = x;
    e.y = y;
    e.t += dt;
    if (dx !== 0 || dy !== 0) this.rot[s] = Math.atan2(dx, -dy);
    this.lastX[s] = x;
    this.lastY[s] = y;
    if (s > 0 && this.motion < Motion.Dying) this.segmentShot(w, s, e);
  }

  private hide(s: number): void {
    this.vis[s] = 0;
    const e = (this.rig.slots[s] as PartSlot).enemy;
    if (e === null) return;
    e.x = e.prevX = HIDE_X;
    e.y = e.prevY = HIDE_Y;
    e.vx = 0;
    e.vy = 0;
  }

  /** One sideways shot (the side facing down) as a segment crosses the cavern's middle. */
  private segmentShot(w: World, s: number, e: Enemy): void {
    const now = e.x < MID_X ? -1 : 1;
    if (now === this.side[s]) return;
    this.side[s] = now;
    const p = w.player;
    if (!p.alive || e.y < 0 || e.y > p.y - 24) return;
    // Perpendicular to the heading, on the side facing the ship.
    const r = this.rot[s] as number;
    const hx = Math.sin(r);
    const hy = -Math.cos(r);
    let nx = -hy;
    let ny = hx;
    if (ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const deg = (Math.atan2(ny, nx) * 180) / Math.PI;
    if (shootDir(w, e.x, e.y, deg, W.segShot.speed, SHOT_SMALL) > 0 && s % 2 === 1)
      emitEnemyShotSfx(w, e.x);
  }

  /** A segment destroyed: the worm closes up behind it and a small rock tumbles out. */
  private lost(w: World, s: number): void {
    const slot = this.rig.slots[s] as PartSlot;
    slot.enemy = null;
    slot.destroyed = true;
    slot.deadT = 0;
    this.vis[s] = 0;
    rockInit.x = this.lastX[s] as number;
    rockInit.y = this.lastY[s] as number;
    rockInit.vx = w.rng.range(-12, 12);
    rockInit.vy = W.rockSpeed + w.scrollSpeed;
    spawnRock(w, rockInit);
  }

  // -------------------------------------------------------------------------
  // Defeat: the head bursts, then the segments pop in sequence along the body.

  private dying(w: World, dt: number): void {
    this.popT -= dt;
    while (this.popT <= 0 && this.popped < SEGS) {
      this.popT += W.popGap;
      this.popped++;
      const s = this.popped;
      const slot = this.rig.slots[s] as PartSlot;
      if (!this.rig.alive(slot) || this.vis[s] === 0) continue;
      const e = slot.enemy as Enemy;
      this.pop(w, e.x, e.y);
      w.enemies.release(e);
      slot.enemy = null;
      slot.destroyed = true;
      this.vis[s] = 0;
    }
    if (this.motionT >= W.dyingTime) {
      this.rig.release(w);
      this.setMotion(Motion.Done);
    }
  }

  private pop(w: World, x: number, y: number): void {
    const i = this.popI;
    this.pops[i * 3] = x;
    this.pops[i * 3 + 1] = y;
    this.pops[i * 3 + 2] = 0;
    this.popI = (i + 1) % POPS;
    this.sfx(w, 'enemy_die_m', x);
    SHAKE_P.mag = 1.5;
    SHAKE_P.dur = 0.15;
    w.events.emit('shake', SHAKE_P);
  }

  private defeat(w: World): void {
    this.defeatEmitted = true;
    const run = w.run;
    run.bossDefeated = true;
    run.kills++;
    addKillScore(w, W.score);
    DEFEAT_P.defId = W.id;
    DEFEAT_P.x = this.hx;
    DEFEAT_P.y = this.hy;
    w.events.emit('bossDefeated', DEFEAT_P);
    this.sfx(w, 'boss_die', this.hx);
    clearShotsToSalvage(w, W.shotSalvageMax);
    // The head goes up with the burst; the body pops after it.
    const h = this.head.enemy;
    if (h !== null && this.rig.alive(this.head)) {
      w.enemies.release(h);
      this.head.enemy = null;
      this.head.destroyed = true;
    }
    this.vis[0] = 0;
    this.popT = 0.35;
  }

  private sfx(w: World, id: string, x?: number): void {
    SFX_P.id = id;
    SFX_P.x = x;
    w.events.emit('sfx', SFX_P);
  }
}
