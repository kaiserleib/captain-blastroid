import { FRIGATE } from '../../../content/levels/armada';
import type { BossPartSpec } from '../../../content/bosses';
import type { Renderer, SpriteOpts } from '../../../gfx/renderer';
import type { Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import { BossRig, type PartSlot } from '../../boss';
import { aimAt, canFire, emitEnemyShotSfx, muzzleY, ring, SHOT_LARGE } from '../../enemies';
import { spawnWeaponCapsule, spraySalvage } from '../../pickups';
import { AR_SPRITES, GLOW_FRAMES, SMOKE_FRAMES, SPARK_FRAMES } from './armada.sprites';
import { onFrigateWrecked } from './pod';
import { addWreck } from './state';
import { lineBurst } from './behaviors';

// Frigate mid-boss: the hull is a roster enemy (`ar_frigate`) whose behavior
// carries a BossRig of two turrets and two armor plates. The hull is armored
// until both turrets are wrecked, then its reactor fires 8-rings. Killing it
// pays salvage and a guaranteed capsule; letting it cross releases it.

const MAX_FRIGATES = 4;
const SPARKS = 8;
const SPARK_LIFE = 0.15;
const PING_GAP = 0.12;
const RECOIL_T = 0.1;

function specs(dir: 1 | -1): BossPartSpec[] {
  const out: BossPartSpec[] = [];
  for (const t of FRIGATE.turrets) {
    out.push({
      defId: 'ar_frigate_turret',
      role: 'turret',
      ox: t.ox * dir,
      oy: t.oy,
      hp: FRIGATE.turretHp,
      r: FRIGATE.turretR,
      targetable: true,
    });
  }
  for (const a of FRIGATE.armor) {
    out.push({
      defId: 'ar_frigate_armor',
      role: 'hull',
      ox: a.ox * dir,
      oy: a.oy,
      hp: 0,
      r: a.r,
      targetable: false,
    });
  }
  return out;
}

export interface Frigate {
  used: boolean;
  hullId: number;
  hull: Enemy | null;
  dir: 1 | -1;
  rig: BossRig;
  readonly rigs: { readonly right: BossRig; readonly left: BossRig };
  turretT: Float32Array;
  turretFired: Float32Array;
  ringT: number;
  ringRot: number;
  /** Seconds since the last ring (reactor flash). */
  rangT: number;
  readonly sparks: Float32Array;
  sparkI: number;
  pingT: number;
}

const tables = new WeakMap<World, Frigate[]>();

function table(w: World): Frigate[] {
  let t = tables.get(w);
  if (t === undefined) {
    t = [];
    for (let i = 0; i < MAX_FRIGATES; i++) {
      const right = new BossRig(specs(1));
      t.push({
        used: false,
        hullId: -1,
        hull: null,
        dir: 1,
        rig: right,
        rigs: { right, left: new BossRig(specs(-1)) },
        turretT: new Float32Array(2),
        turretFired: new Float32Array(2).fill(9),
        ringT: 0,
        ringRot: 0,
        rangT: 9,
        sparks: new Float32Array(SPARKS * 3).fill(9),
        sparkI: 0,
        pingT: 0,
      });
    }
    tables.set(w, t);
  }
  return t;
}

/** The frigate whose hull is `e`, or null. */
export function frigateOf(w: World, e: Enemy): Frigate | null {
  const t = tables.get(w);
  if (t === undefined) return null;
  for (let i = 0; i < t.length; i++) {
    const f = t[i] as Frigate;
    if (f.used && f.hull === e && f.hullId === e.id) return f;
  }
  return null;
}

export function turretsAlive(f: Frigate): number {
  let n = 0;
  for (let i = 0; i < FRIGATE.turrets.length; i++) if (f.rig.alive(f.rig.slots[i] as PartSlot)) n++;
  return n;
}

function claim(w: World, e: Enemy, dir: 1 | -1): Frigate | null {
  const t = table(w);
  for (let i = 0; i < t.length; i++) {
    const f = t[i] as Frigate;
    if (f.used) continue;
    f.used = true;
    f.hull = e;
    f.hullId = e.id;
    f.dir = dir;
    f.rig = dir > 0 ? f.rigs.right : f.rigs.left;
    f.rig.spawn(w, e.x, e.y);
    f.turretT[0] = FRIGATE.turret.firstDelay;
    f.turretT[1] = FRIGATE.turret.firstDelay + FRIGATE.turret.interval * 0.5;
    f.turretFired.fill(9);
    f.ringT = FRIGATE.ring.firstDelay;
    f.ringRot = 0;
    f.rangT = 9;
    f.sparks.fill(9);
    return f;
  }
  return null;
}

function free(w: World, f: Frigate): void {
  f.rig.release(w);
  f.used = false;
  f.hull = null;
  f.hullId = -1;
}

/** Releases every frigate (not kills): the dreadnought fight starts with a clean slate. */
export function releaseFrigates(w: World): void {
  const t = tables.get(w);
  if (t === undefined) return;
  for (const f of t) {
    if (!f.used) continue;
    const e = f.hull;
    if (e !== null && e.active && e.id === f.hullId) w.enemies.release(e);
    free(w, f);
  }
}

/** `armada.frigate`: ax = heading (±1), ay = cruise height. */
export function frigateBehavior(
  w: World,
  e: Enemy,
  p: Readonly<Record<string, number>>,
  dt: number,
): void {
  let f: Frigate | null;
  if (e.state === 0) {
    const dir: 1 | -1 = e.x < w.width / 2 ? 1 : -1;
    e.ax = dir;
    if (e.ay <= 0) e.ay = e.y;
    e.state = 1;
    f = claim(w, e, dir);
  } else f = frigateOf(w, e);

  const dir = e.ax;
  e.vx = dir * (p.speed ?? FRIGATE.speed);
  const bob = Math.sin(((e.t + dt) / FRIGATE.bobPeriod) * Math.PI * 2) * FRIGATE.bobAmp;
  e.vy = (e.ay + bob - e.y) * 3;

  const gone = dir > 0 ? e.x > w.width + FRIGATE.exitMargin : e.x < -FRIGATE.exitMargin;
  if (gone) {
    if (f !== null) free(w, f);
    w.enemies.release(e);
    return;
  }
  if (f === null) return;

  f.rig.moveTo(e.x + e.vx * dt, e.y + e.vy * dt, dt);
  for (let i = 0; i < 2; i++) f.turretFired[i] = (f.turretFired[i] as number) + dt;
  for (let i = 2; i < f.sparks.length; i += 3) f.sparks[i] = (f.sparks[i] as number) + dt;
  f.rangT += dt;
  f.pingT -= dt;

  if (!w.player.alive) return;
  const tu = FRIGATE.turret;
  let alive = 0;
  for (let i = 0; i < FRIGATE.turrets.length; i++) {
    const s = f.rig.slots[i] as PartSlot;
    if (!f.rig.alive(s)) continue;
    alive++;
    const left = (f.turretT[i] as number) - dt;
    f.turretT[i] = left;
    if (left > 0) continue;
    f.turretT[i] = left + tu.interval;
    const te = s.enemy as Enemy;
    if (!canFire(w, te)) continue;
    const my = muzzleY(te);
    lineBurst(w, te.x, my, aimAt(w, te.x, my), tu.speed, tu.burstCount, tu.burstGap);
    f.turretFired[i] = 0;
  }
  if (alive > 0) return;
  // Both turrets down: the reactor opens and fires rings.
  f.ringT -= dt;
  if (f.ringT > 0) return;
  const rg = FRIGATE.ring;
  f.ringT += rg.interval;
  if (e.x < 0 || e.x > w.width || e.y > w.player.y - 24) return;
  if (ring(w, e.x, e.y, rg.n, rg.speed, f.ringRot, SHOT_LARGE) > 0) emitEnemyShotSfx(w, e.x);
  f.ringRot = (f.ringRot + rg.rotStep) % 360;
  f.rangT = 0;
}

const SFX_P = { id: 'armor_ping', x: 0 as number | undefined };
const SHAKE_P = { mag: 4, dur: 0.5 };

/** `registerBossDamage` hook for frigate hulls: armored while a turret stands. */
export function frigateDamage(w: World, part: Enemy, amount: number): boolean {
  if (part.defId !== 'ar_frigate') return false;
  const f = frigateOf(w, part);
  if (f !== null && turretsAlive(f) > 0) {
    const i = f.sparkI;
    f.sparks[i * 3] = part.x + ((((i * 37) % 11) - 5) * part.r) / 6;
    f.sparks[i * 3 + 1] = part.y + part.r * 0.5;
    f.sparks[i * 3 + 2] = 0;
    f.sparkI = (i + 1) % SPARKS;
    if (f.pingT <= 0) {
      f.pingT = PING_GAP;
      SFX_P.x = part.x;
      w.events.emit('sfx', SFX_P);
    }
    return true;
  }
  if (amount >= part.hp) frigateDown(w, part, f);
  return false;
}

/** Rewards and the wreck; damageEnemy then scores the kill and plays the explosion. */
function frigateDown(w: World, e: Enemy, f: Frigate | null): void {
  spraySalvage(w, e.x, e.y, FRIGATE.salvage);
  spawnWeaponCapsule(w, e.x, e.y + 4);
  w.events.emit('shake', SHAKE_P);
  addWreck(w, e.x, e.y, e.vx * 0.4, e.ax < 0);
  if (f !== null) free(w, f);
  onFrigateWrecked(w, e.x, e.y);
}

/** Seekers and drones skip the hull while it's armored. */
export function frigateTargetFilter(w: World, e: Enemy): boolean {
  if (e.defId !== 'ar_frigate') return true;
  const f = frigateOf(w, e);
  return f === null || turretsAlive(f) === 0;
}

// ---------------------------------------------------------------------------
// Draw (the hull's registerEnemyDraw, z 40).

const opts: SpriteOpts = { frame: 0, flash: false, rot: 0, flipX: false };

function spr(r: Renderer, id: string, x: number, y: number, frame = 0, flash = false, rot = 0) {
  opts.frame = frame;
  opts.flash = flash;
  opts.rot = rot;
  opts.flipX = false;
  r.sprite(id, x, y, opts);
}

export function drawFrigate(w: World, r: Renderer, e: Enemy, x: number, y: number): void {
  const t = w.time;
  opts.frame = Math.floor(t * 4 + e.id) % 2;
  opts.flash = e.flashT > 0;
  opts.rot = 0;
  opts.flipX = e.ax < 0;
  r.sprite(AR_SPRITES.frigate, x, y, opts);
  const f = frigateOf(w, e);
  if (f === null) return;
  const p = w.player;
  for (let i = 0; i < FRIGATE.turrets.length; i++) {
    const s = f.rig.slots[i] as PartSlot;
    const tx = x + s.spec.ox;
    const ty = y + s.spec.oy;
    if (!f.rig.alive(s)) {
      spr(r, AR_SPRITES.wreck, tx, ty, Math.floor(t * 8 + i) % 2);
      const ph = (t * 0.9 + i * 0.37) % 1;
      spr(
        r,
        AR_SPRITES.smoke,
        tx + Math.sin(t * 2 + i) * 2,
        ty - 2 - ph * 12,
        Math.floor(ph * SMOKE_FRAMES),
      );
      continue;
    }
    const te = s.enemy as Enemy;
    const a = Math.atan2(p.y - ty, p.x - tx);
    const kick = (f.turretFired[i] as number) < RECOIL_T ? 1.5 : 0;
    spr(
      r,
      AR_SPRITES.frigateBarrel,
      tx - Math.cos(a) * kick,
      ty - Math.sin(a) * kick,
      0,
      te.flashT > 0,
      a - Math.PI / 2,
    );
    spr(r, AR_SPRITES.frigateTurret, tx, ty, Math.floor(t * 3 + i) % 2, te.flashT > 0);
  }
  // Reactor: glows up through the ring telegraph and flares on the shot.
  if (turretsAlive(f) === 0) {
    const tele = FRIGATE.ring.telegraph;
    if (f.ringT < tele || f.rangT < 0.15) {
      const k = f.rangT < 0.15 ? GLOW_FRAMES - 1 : Math.floor((1 - f.ringT / tele) * GLOW_FRAMES);
      spr(r, AR_SPRITES.frigateGlow, x, y, Math.max(0, Math.min(GLOW_FRAMES - 1, k)));
    }
  }
  const sp = f.sparks;
  for (let i = 0; i < sp.length; i += 3) {
    const age = sp[i + 2] as number;
    if (age >= SPARK_LIFE) continue;
    spr(
      r,
      AR_SPRITES.spark,
      sp[i] as number,
      sp[i + 1] as number,
      Math.min(SPARK_FRAMES - 1, Math.floor((age / SPARK_LIFE) * SPARK_FRAMES)),
    );
  }
}
