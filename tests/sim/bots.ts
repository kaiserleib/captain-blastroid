// Bots for the headless harness. Each writes `world.input` once per tick, the
// same MoveIntent path the real game's input system fills.
import { ENEMY_FAIRNESS } from '../../src/content/enemies';
import { BLACK_HOLE, PULSAR, PULSAR_DOUBLE_DELAY } from '../../src/content/obstacles';
import { createRng, type Rng } from '../../src/engine/rng';
import { activeBoss } from '../../src/game/boss';
import { muzzleY } from '../../src/game/enemies';
import { Lance } from '../../src/game/levels/eventHorizon/behaviors';
import { Dive, divePoint, Perihelion } from '../../src/game/levels/eventHorizon/perihelion';
import { Leviathan } from '../../src/game/levels/armada';
import { mem, RayPhase } from '../../src/game/levels/pulsarNursery/behaviors';
import { getTerrainState, nearestOpenX } from '../../src/game/terrain';
import { isSolidAt } from '../../src/sim/hooks';

import {
  bubbleTimeScale,
  bubbles,
  flareProgress,
  flareState,
  inPulsarGap,
  inShade,
  nearestShadeSpot,
  partnerOf,
  portalPairs,
  sinceShipPorted,
  type PortalEnd,
  type ShadeSpot,
} from '../../src/game/obstacles';
import { PORTAL } from '../../src/content/obstacles';
import { ext, isFieldOnly } from '../../src/game/obstacles/anomalies/state';
import { INVERSE_FALLOFF_MIN } from '../../src/sim/forces';
import { isTargetable } from '../../src/sim/targeting';
import type { Anomaly, Asteroid, Bullet, Enemy, Pickup } from '../../src/sim/types';
import type { World } from '../../src/sim/world';

export interface Bot {
  readonly name: string;
  /** Player can't be hurt (`setGodMode`) for the whole run. */
  readonly god: boolean;
  /** Called once per run, after the world is built. Bots seed their own rng from the run seed. */
  start(w: World): void;
  /** Called every tick before the systems run. */
  decide(w: World): void;
}

/** Never moves: proves nothing crashes with no input and the opening is survivable. */
export function idleBot(): Bot {
  return {
    name: 'idle',
    god: false,
    start() {},
    decide(w) {
      w.input.x = 0;
      w.input.y = 0;
      w.input.targetX = null;
      w.input.targetY = null;
    },
  };
}

/**
 * Human-ish skill knobs (T18's balance pass). The dodger re-decides every
 * `reactTicks`, notices fresh shots only after `shotReact`, and overlooks a
 * share of rocks/enemies, so it gets hit like a person would.
 */
export interface BotSkill {
  name: string;
  /** Ticks between decisions (human reaction granularity). */
  reactTicks: number;
  /** Seconds of look-ahead when projecting threats. */
  lookahead: number;
  /** Extra clearance kept from threats, px. */
  margin: number;
  /** Chance per decision to go for pickups at all (vs. busy dodging, distracted). */
  greed: number;
  /** Aim error, px, applied to the drift-under-target x. */
  aimNoise: number;
  /** Fraction of rocks/enemies noticed in any half-second window. */
  awareness: number;
  /** Seconds before a freshly fired enemy shot registers (reaction time). */
  shotReact: number;
}

export const SKILLS = {
  novice: {
    name: 'novice',
    reactTicks: 14,
    lookahead: 0.3,
    margin: 0,
    greed: 0.5,
    aimNoise: 30,
    awareness: 0.75,
    shotReact: 0.45,
  },
  typical: {
    name: 'typical',
    reactTicks: 10,
    lookahead: 0.4,
    margin: 2,
    greed: 0.75,
    aimNoise: 14,
    awareness: 0.88,
    shotReact: 0.3,
  },
  expert: {
    name: 'expert',
    reactTicks: 5,
    lookahead: 0.55,
    margin: 4,
    greed: 0.95,
    aimNoise: 4,
    awareness: 0.97,
    shotReact: 0.15,
  },
} as const satisfies Record<string, BotSkill>;

export type SkillId = keyof typeof SKILLS;

export interface DodgerOptions {
  /**
   * Reads the campaign hazards (T31): black-hole cores and curved shots,
   * pulsar rings, Lancer and dive telegraphs, Warden Ray fans, homing
   * missiles. Default true. `false` is T18's original Level 1 dodger, kept
   * for blind-vs-aware comparisons.
   */
  hazards?: boolean;
}

/** Steers away from projected threats, drifts under targets, grabs pickups when the path is clear. */
export function dodgerBot(skill: BotSkill = SKILLS.typical, o: DodgerOptions = {}): Bot {
  return new Dodger(skill, false, o.hazards ?? true);
}

/** `dodgerBot` that can't die, to reach and finish the boss deterministically. */
export function godBot(skill: BotSkill = SKILLS.expert, o: DodgerOptions = {}): Bot {
  return new Dodger(skill, true, o.hazards ?? true);
}

const SHOT_TTL = ENEMY_FAIRNESS.shotTtl;
const DIRS = 16;
const RINGS = [0, 8, 18, 32, 50];
/** With pulsars up, gaps can be far off: sample wider (T29's ring-aware radii). */
const RINGS_WIDE = [0, 8, 18, 32, 50, 72, 100, 130];
const LOOK_STEPS = 4;
const PREF = { x: 0, y: 0 };

// Hazard model (T31). A human reads these off the screen, so the costs use
// what the game shows: telegraphs, spokes, the hole's pull.
/** Ring foresight beyond the shot look-ahead, s: the telegraph shows the next gaps 0.6–0.8 s early. */
const RING_READ = 1.2;
const RING_STEPS = 12;
const RING_COST = 140;
/** Extra weight on rings that arrive soon: with every way blocked, buy time. */
const RING_SOON = 2;
/** Keep-out from a black-hole core, px beyond its radius (the player drifts in). */
const HOLE_KEEP = 34;
/** Pickups this close to a core are being swallowed: not worth the sling zone. */
const HOLE_PICKUP = 90;
/** Hold-off from Lancer lines and dive paths, px beyond the attacker's radius. */
const LANCE_PAD = 8;
/** Perihelion's half-span (pods at ±30, r 9). */
const DIVE_HALF = 40;
const DIVE_SAMPLES = 24;
/** Warden Ray fan: degrees of padding on each edge, and the cost inside it. */
const RAY_PAD = 6;
const RAY_COST = 70;
/** Where the bot hangs during boss fights; lower under the dreadnought's deck guns. */
const BOSS_Y = 270;
const HULL_Y = 360;
const MAX_SHOTS = 1024;
const MAX_ROCKS = 256;

interface Front {
  /** Seconds from now until the ring leaves the core (negative: already out). */
  start: number;
  rot: number;
}

/**
 * Samples points on rings around the ship and picks the cheapest: projected
 * threat overlap along the path there (each look-ahead step weighted by
 * 1 / (1 + 3t), i.e. by time to impact) plus distance from a preferred spot.
 */
class Dodger implements Bot {
  readonly name: string;
  private rng: Rng = createRng('bot');
  private tick = 0;
  private epoch = 0;
  private tx = 120;
  private ty = 330;
  private aimOff = 0;
  // Per-plan scratch: gravity on each shot and rock (px/s²), by pool index.
  private readonly sAx = new Float32Array(MAX_SHOTS);
  private readonly sAy = new Float32Array(MAX_SHOTS);
  private readonly rAx = new Float32Array(MAX_ROCKS);
  private readonly rAy = new Float32Array(MAX_ROCKS);
  private holes = 0;
  private pulsars = 0;
  private readonly fronts: Front[] = Array.from({ length: 4 }, () => ({ start: 0, rot: 0 }));
  private readonly dive = new Float32Array((DIVE_SAMPLES + 1) * 2);
  private diveOn = false;
  private readonly pt = { x: 0, y: 0 };
  /** Act II hazards (T33), refreshed by `scanHazardsII`. */
  private readonly h2: HazardsIIView = newHazardsIIView();

  constructor(
    readonly skill: BotSkill,
    readonly god: boolean,
    readonly hazards: boolean,
  ) {
    this.name = `${god ? 'god' : 'dodger'}-${skill.name}${hazards ? '' : '-blind'}`;
  }

  start(w: World): void {
    this.rng = createRng(`${w.run.seed}#bot`);
    this.tick = 0;
    this.epoch = 0;
    this.tx = w.player.x;
    this.ty = w.player.y;
    this.aimOff = 0;
  }

  decide(w: World): void {
    const p = w.player;
    if (this.tick++ % this.skill.reactTicks === 0) this.plan(w);
    w.input.x = 0;
    w.input.y = 0;
    w.input.targetX = p.alive ? this.tx : null;
    w.input.targetY = p.alive ? this.ty : null;
  }

  /** Whether this threat is noticed during the current half-second window. */
  private sees(id: number): boolean {
    const h = Math.imul(id ^ Math.imul(this.epoch, 0x9e3779b1), 0x85ebca6b) >>> 0;
    return (h % 1000) / 1000 < this.skill.awareness;
  }

  private plan(w: World): void {
    const p = w.player;
    if (!p.alive) return;
    this.epoch = Math.floor(this.tick / 30);
    if (this.rng.chance(0.15)) this.aimOff = this.rng.range(-1, 1) * this.skill.aimNoise;
    if (this.hazards) this.scan(w);
    const h2 = this.h2;
    if (this.hazards) scanHazardsII(w, h2, this.skill, (x, y) => this.shotDangerAt(w, x, y));
    else h2.any = false;
    const pref = h2.flare ? h2.spotPref : this.preferred(w);
    let best = Infinity;
    let bx = p.x;
    let by = p.y;
    const radii = this.pulsars > 0 ? RINGS_WIDE : RINGS;
    for (let ri = 0; ri < radii.length; ri++) {
      const rad = radii[ri] as number;
      const nd = rad === 0 ? 1 : DIRS;
      for (let d = 0; d < nd; d++) {
        const a = (d / DIRS) * Math.PI * 2;
        const cx = clamp(p.x + Math.cos(a) * rad, 10, 230);
        const cy = clamp(p.y + Math.sin(a) * rad, 40, 390);
        const dx = cx - pref.x;
        const dy = cy - pref.y;
        const cost = this.danger(w, cx, cy) + Math.sqrt(dx * dx + dy * dy) * 0.04;
        if (cost < best) {
          best = cost;
          bx = cx;
          by = cy;
        }
      }
    }
    this.tx = bx;
    this.ty = by;
  }

  /** Once per plan: gravity on shots and rocks, what's on screen, the dive path. */
  private scan(w: World): void {
    this.holes = 0;
    this.pulsars = 0;
    for (let j = 0; j < w.anomalies.count; j++) {
      const a = w.anomalies.items[j] as Anomaly;
      if (!a.active) continue;
      if (a.kind === 'pulsar') this.pulsars++;
      else this.holes++;
    }
    if (this.holes > 0) {
      gravityInto(w, w.enemyShots.items, w.enemyShots.count, 1, this.sAx, this.sAy);
      gravityInto(w, w.asteroids.items, w.asteroids.count, BLACK_HOLE.rockMul, this.rAx, this.rAy);
    }
    this.diveOn = false;
    const boss = activeBoss(w);
    if (boss instanceof Perihelion && boss.dive !== Dive.None) {
      this.diveOn = true;
      for (let i = 0; i <= DIVE_SAMPLES; i++) {
        divePoint(boss.path, i / DIVE_SAMPLES, this.pt);
        this.dive[i * 2] = this.pt.x;
        this.dive[i * 2 + 1] = this.pt.y;
      }
    }
  }

  private preferred(w: World): { x: number; y: number } {
    const p = w.player;
    const out = PREF;
    const boss = activeBoss(w);
    out.y = boss === null ? 330 : this.hazards && boss instanceof Leviathan ? HULL_Y : BOSS_Y;
    out.x = 120;
    // Pickups first, when greedy and the item is reachable (below y 110).
    if (this.rng.chance(this.skill.greed)) {
      let bestD = Infinity;
      for (let i = 0; i < w.pickups.count; i++) {
        const k = w.pickups.items[i] as Pickup;
        if (!k.active || k.y < 110 || k.y > 395) continue;
        // A pod is worth the sling zone (the core costs still keep the ship off the hole).
        if (
          this.holes > 0 &&
          k.kind !== 'escapePod' &&
          nearCore(w, k.x, k.y, 'blackhole', HOLE_PICKUP)
        )
          continue;
        const weight = k.kind === 'salvage' ? 2.2 : 1;
        const d = Math.hypot(k.x - p.x, k.y - p.y) * weight;
        if (d < bestD && d < 170) {
          bestD = d;
          out.x = k.x;
          out.y = Math.max(k.y + 6, 200);
        }
      }
      if (bestD < Infinity) return out;
    }
    // Drift under the nearest damageable enemy (bosses: the live targetable part).
    let bestD = Infinity;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.items[i] as Enemy;
      if (!e.active || e.y < 0 || e.y > p.y - 30 || !isTargetable(w, e)) continue;
      const d = Math.abs(e.x - p.x) + (p.y - e.y) * 0.3;
      if (d < bestD) {
        bestD = d;
        out.x = e.x + this.aimOff;
      }
    }
    if (bestD === Infinity) {
      for (let i = 0; i < w.asteroids.count; i++) {
        const a = w.asteroids.items[i] as Asteroid;
        if (!a.active || a.y < 0 || a.y > p.y - 40) continue;
        const d = Math.abs(a.x - p.x);
        if (d < bestD) {
          bestD = d;
          out.x = a.x + this.aimOff;
        }
      }
    }
    // Shoot past a hole, not into it: its core swallows shots fired straight through.
    if (this.holes > 0 && boss === null) {
      for (let j = 0; j < w.anomalies.count; j++) {
        const a = w.anomalies.items[j] as Anomaly;
        if (!a.active || a.kind !== 'blackhole' || a.r <= 0 || a.y > p.y - 20) continue;
        const clear = a.r + 22;
        if (Math.abs(out.x - a.x) < clear) out.x = a.x + (out.x < a.x ? -clear : clear);
      }
    }
    out.x = clamp(out.x, 12, 228);
    return out;
  }

  private danger(w: World, cx: number, cy: number): number {
    const p = w.player;
    const sk = this.skill;
    let cost = 0;
    const dist = Math.hypot(cx - p.x, cy - p.y);
    const reach = dist / Math.max(1, p.speed);
    for (let s = 0; s <= LOOK_STEPS; s++) {
      const t = (s / LOOK_STEPS) * sk.lookahead;
      const k = reach <= 0 ? 1 : Math.min(1, t / reach);
      const sx = p.x + (cx - p.x) * k;
      const sy = p.y + (cy - p.y) * k;
      const wt = 1 / (1 + t * 3);
      cost += wt * this.overlapShots(w.enemyShots.items, w.enemyShots.count, sx, sy, t);
      cost += wt * this.overlapRocks(w, sx, sy, t);
      cost += wt * this.overlapEnemies(w, sx, sy, t);
      if (this.hazards) cost += wt * this.overlapHazards(w, sx, sy, t);
      if (this.h2.any) cost += wt * hazardsIICost(w, this.h2, sx, sy, t);
    }
    if (getTerrainState(w) !== undefined) cost += terrainCost(w, cx, cy);
    if (this.pulsars > 0) {
      const ringLook = sk.lookahead + RING_READ;
      for (let s = 1; s <= RING_STEPS; s++) {
        const t0 = ((s - 1) / RING_STEPS) * ringLook;
        const t1 = (s / RING_STEPS) * ringLook;
        const k = reach <= 0 ? 1 : Math.min(1, t1 / reach);
        cost += this.overlapRings(w, p.x + (cx - p.x) * k, p.y + (cy - p.y) * k, t0, t1);
      }
    }
    return cost;
  }

  private overlapShots(items: readonly Bullet[], n: number, sx: number, sy: number, t: number) {
    let c = 0;
    const m = this.skill.margin + 4;
    const bend = this.holes > 0 ? 0.5 * t * t : 0;
    const scaled = this.h2.scaleShots;
    for (let i = 0; i < n; i++) {
      const b = items[i] as Bullet;
      if (!b.active || SHOT_TTL - b.ttl < this.skill.shotReact) continue;
      const ts = scaled ? shotTime(this.h2.w, b, t) : t;
      let bx = b.x + b.vx * ts;
      let by = b.y + b.vy * ts;
      if (bend > 0) {
        bx += (this.sAx[i] as number) * bend;
        by += (this.sAy[i] as number) * bend;
      }
      let d = Math.hypot(bx - sx, by - sy) - b.r - m;
      if (ts !== t && t > 0) {
        // Faster shots outrun the look-ahead samples: sweep back to the previous one.
        const back = ts / t;
        d = Math.min(
          d,
          sweptGap(bx, by, b.vx * back, b.vy * back, this.skill.lookahead / LOOK_STEPS, sx, sy) -
            b.r -
            m,
        );
      }
      if (d < 0) c += 100 - d * 10;
    }
    return c;
  }

  /** Enemy-shot danger at a point over the next instant (portal exits). */
  private shotDangerAt(w: World, x: number, y: number): number {
    return this.overlapShots(w.enemyShots.items, w.enemyShots.count, x, y, 0.15);
  }

  private overlapRocks(w: World, sx: number, sy: number, t: number): number {
    let c = 0;
    const m = this.skill.margin + 4;
    const bend = this.holes > 0 ? 0.5 * t * t : 0;
    for (let i = 0; i < w.asteroids.count; i++) {
      const a = w.asteroids.items[i] as Asteroid;
      if (!a.active || !this.sees(a.id)) continue;
      let ax = a.x + a.vx * t;
      let ay = a.y + a.vy * t;
      if (bend > 0) {
        ax += (this.rAx[i] as number) * bend;
        ay += (this.rAy[i] as number) * bend;
      }
      const d = Math.hypot(ax - sx, ay - sy) - a.r - m;
      if (d < 0) c += 60 - d * 6;
    }
    return c;
  }

  private overlapEnemies(w: World, sx: number, sy: number, t: number): number {
    let c = 0;
    const m = this.skill.margin + 4;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.items[i] as Enemy;
      if (!e.active || !this.sees(e.id)) continue;
      const d = Math.hypot(e.x + e.vx * t - sx, e.y + e.vy * t - sy) - e.r - m;
      if (d < 0) c += 80 - d * 8;
    }
    return c;
  }

  /** Hole cores, Lancer lines, Perihelion's dive, Warden Ray fans, homing missiles. */
  private overlapHazards(w: World, sx: number, sy: number, t: number): number {
    let c = 0;
    const pr = w.player.r + this.skill.margin;
    if (this.holes > 0) {
      for (let j = 0; j < w.anomalies.count; j++) {
        const a = w.anomalies.items[j] as Anomaly;
        if (!a.active || a.kind !== 'blackhole' || a.r <= 0 || isFieldOnly(a)) continue;
        const d = Math.hypot(a.x + a.vx * t - sx, a.y + a.vy * t - sy) - a.r - pr;
        if (d < 0) c += 200 - d * 10;
        else if (d < HOLE_KEEP) c += 60 * (1 - d / HOLE_KEEP);
      }
    }
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.items[i] as Enemy;
      if (!e.active) continue;
      if (e.defId === 'hz_lancer' && (e.state === Lance.Telegraph || e.state === Lance.Dash)) {
        // The shown line, out to the edge: it doesn't steer once locked.
        const along = (sx - e.x) * e.ax + (sy - e.y) * e.ay;
        if (along > -e.r) {
          const off = Math.abs((sx - e.x) * e.ay - (sy - e.y) * e.ax);
          const pad = e.r + pr + LANCE_PAD;
          if (off < pad) c += 120 * (1 - off / pad) + 40;
        }
      } else if (e.defId === 'pn_ray') {
        // The telegraph draws the fan's edges; keep out of it until the sweep ends.
        const m = mem(e);
        if (m.a !== RayPhase.Off) {
          const deg = (Math.atan2(sy - muzzleY(e), sx - e.x) * 180) / Math.PI;
          const lo = Math.min(m.far, m.near) - RAY_PAD;
          const hi = Math.max(m.far, m.near) + RAY_PAD;
          if (deg > lo && deg < hi) c += RAY_COST;
        }
      } else if (e.defId === 'ar_missile') {
        // Homing: it turns toward wherever the ship goes, so keep its reach as a bubble.
        const d = Math.hypot(e.x - sx, e.y - sy) - e.r - pr - Math.hypot(e.vx, e.vy) * t - 6;
        if (d < 0) c += 80 - d * 6;
      }
    }
    if (this.diveOn) {
      const pad = DIVE_HALF + pr;
      let near = Infinity;
      for (let i = 0; i <= DIVE_SAMPLES; i++) {
        const d = Math.hypot(
          (this.dive[i * 2] as number) - sx,
          (this.dive[i * 2 + 1] as number) - sy,
        );
        if (d < near) near = d;
      }
      if (near < pad) c += 150 * (1 - near / pad) + 30;
    }
    return c;
  }

  /** A ring (or its `double` echo) sweeping through (sx, sy) during [t0, t1] outside its gaps. */
  private overlapRings(w: World, sx: number, sy: number, t0: number, t1: number): number {
    let c = 0;
    const band = PULSAR.ringThickness / 2 + w.player.r + this.skill.margin + 2;
    // Hug the middle of a gap, not its edge: plans are only refreshed every few ticks.
    const br = w.player.r + this.skill.margin + 6;
    for (let i = 0; i < w.anomalies.count; i++) {
      const a = w.anomalies.items[i] as Anomaly;
      if (!a.active || a.kind !== 'pulsar') continue;
      const core = Math.hypot(sx - a.x - a.vx * t1, sy - a.y - a.vy * t1) - a.r - band;
      if (core < 0) c += 80 - core * 8;
      const dx = sx - a.x;
      const dy = sy - a.y;
      const d = Math.hypot(dx, dy);
      if (d > a.radius + band) continue;
      const n = ringFronts(a, this.fronts);
      const e = ext(a);
      for (let f = 0; f < n; f++) {
        const fr = this.fronts[f] as Front;
        if (t1 < fr.start) continue;
        const r0 = a.r + Math.max(0, t0 - fr.start) * a.strength;
        const r1 = a.r + (t1 - fr.start) * a.strength;
        if (r0 > a.radius || d + band < r0 || d - band > r1) continue;
        if (!inPulsarGap(dx, dy, br, e.gaps, e.gapW, fr.rot))
          c += RING_COST * (1 + RING_SOON / (1 + 3 * t0));
      }
    }
    return c;
  }
}

/**
 * The rings a player can read right now: the live ring and its echo, plus,
 * while the telegraph glows, the next pulse's (its spokes are showing).
 */
function ringFronts(a: Anomaly, out: Front[]): number {
  const e = ext(a);
  let n = 0;
  const half = e.gaps > 0 ? Math.PI / e.gaps : 0;
  const push = (start: number, rot: number) => {
    const f = out[n++] as Front;
    f.start = start;
    f.rot = rot;
  };
  if (e.pulse >= 1) {
    push(-e.clock, e.ringRot);
    if (e.double) push(PULSAR_DOUBLE_DELAY - e.clock, e.ringRot + half);
  }
  const glowFrom = e.period - e.telegraph;
  if (e.collapseDur <= 0 && e.telegraph > 0 && e.clock >= glowFrom) {
    const next = e.period - e.clock;
    push(next, e.nextRot);
    if (e.double) push(next + PULSAR_DOUBLE_DELAY, e.nextRot + half);
  }
  return n;
}

/** Gravity each black hole puts on each body now (px/s²), as `updateBlackHole` applies it. */
function gravityInto(
  w: World,
  items: readonly { active: boolean; x: number; y: number }[],
  n: number,
  mul: number,
  ox: Float32Array,
  oy: Float32Array,
): void {
  for (let i = 0; i < n && i < ox.length; i++) {
    const b = items[i] as { active: boolean; x: number; y: number };
    let ax = 0;
    let ay = 0;
    if (b.active) {
      for (let j = 0; j < w.anomalies.count; j++) {
        const a = w.anomalies.items[j] as Anomaly;
        if (!a.active || a.kind !== 'blackhole') continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d >= a.radius || d === 0) continue;
        const f = (a.strength * mul * INVERSE_FALLOFF_MIN) / Math.max(INVERSE_FALLOFF_MIN, d) / d;
        ax += dx * f;
        ay += dy * f;
      }
    }
    ox[i] = ax;
    oy[i] = ay;
  }
}

/** Within `pad` px of the edge of a black-hole or pulsar core. */
function nearCore(w: World, x: number, y: number, kind: Anomaly['kind'], pad: number): boolean {
  for (let j = 0; j < w.anomalies.count; j++) {
    const a = w.anomalies.items[j] as Anomaly;
    if (!a.active || a.kind !== kind || a.r <= 0) continue;
    if (Math.hypot(x - a.x, y - a.y) < a.r + pad) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Act II hazards (T33): flares and shade, portals, time bubbles. Kept apart
// from the Act I terms; with none of them on screen nothing here runs, so
// Act I plans (and hashes) are unchanged.

/** Cost per look-ahead step outside shade while a flare warns or burns. */
const FLARE_COST = 150;
/** Sit this far below a caster's bottom edge: right under it, the rock cost bites. */
const SHADE_TOP_PAD = 12;
const PORTAL_COST = 90;

interface HazardsIIView {
  w: World;
  any: boolean;
  /** A real (non-practice) flare is warning or burning. */
  flare: boolean;
  /** 0..1 urgency: ramps over the warn, 1 during the burn. */
  flareUrgency: number;
  spot: ShadeSpot;
  spotPref: { x: number; y: number };
  /** Ship-open portal ends worth avoiding this plan, with their exits' danger. */
  ends: PortalEnd[];
  endCost: number[];
  endN: number;
  scaleShots: boolean;
}

function newHazardsIIView(): HazardsIIView {
  return {
    w: null as unknown as World,
    any: false,
    flare: false,
    flareUrgency: 0,
    spot: { x: 0, y: 0, d: 0 },
    spotPref: { x: 0, y: 0 },
    ends: [],
    endCost: [],
    endN: 0,
    scaleShots: false,
  };
}

/** Once per plan: what a player reads off the screen (the flare tint, rings, bubbles). */
function scanHazardsII(
  w: World,
  v: HazardsIIView,
  skill: BotSkill,
  shotDanger: (x: number, y: number) => number,
): void {
  v.w = w;
  const p = w.player;
  const f = flareState(w);
  v.flare = false;
  if (f !== undefined && !f.practice && (f.phase === 'warn' || f.phase === 'burn')) {
    const r = p.r + 1 + skill.margin / 2;
    if (nearestShadeSpot(w, p.x, p.y, r, v.spot, SHADE_TOP_PAD)) {
      v.flare = true;
      v.flareUrgency = f.phase === 'burn' ? 1 : 0.4 + 0.6 * flareProgress(f);
      v.spotPref.x = v.spot.x;
      v.spotPref.y = v.spot.y;
    }
  }
  v.endN = 0;
  if (sinceShipPorted(w) > PORTAL.shipCooldown - 0.2) {
    const here = shotDanger(p.x, p.y);
    for (const pair of portalPairs(w)) {
      if (!pair.active) continue;
      for (const e of [pair.a, pair.b]) {
        if (!e.open) continue;
        const o = partnerOf(e);
        const exit = shotDanger(o.x, o.y);
        // Only worth taking when the exit is clearly safer than staying put.
        if (exit + 20 < here * 0.5) continue;
        v.ends[v.endN] = e;
        v.endCost[v.endN] = PORTAL_COST + exit;
        v.endN++;
      }
    }
  }
  v.scaleShots = w.enemyBulletTimeScale !== 1 || bubbles(w).some((b) => b.active);
  v.any = v.flare || v.endN > 0;
}

/** Effective flight time of a shot over `t` s: the bubble rate where it is and where it'll be. */
function shotTime(w: World, b: Bullet, t: number): number {
  const k = w.enemyBulletTimeScale;
  const s0 = bubbleTimeScale(w, b.x, b.y);
  const s1 = bubbleTimeScale(w, b.x + b.vx * t * s0 * k, b.y + b.vy * t * s0 * k);
  return t * k * 0.5 * (s0 + s1);
}

/** Distance from (sx, sy) to the segment a shot at (bx, by) with velocity (vx, vy) covered over the last `dt`. */
function sweptGap(
  bx: number,
  by: number,
  vx: number,
  vy: number,
  dt: number,
  sx: number,
  sy: number,
): number {
  const ex = -vx * dt;
  const ey = -vy * dt;
  const l2 = ex * ex + ey * ey;
  let u = l2 > 0 ? ((sx - bx) * ex + (sy - by) * ey) / l2 : 0;
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  return Math.hypot(bx + ex * u - sx, by + ey * u - sy);
}

function hazardsIICost(w: World, v: HazardsIIView, sx: number, sy: number, t: number): number {
  let c = 0;
  if (v.flare && !inShade(w, sx, sy, w.player.r + 1)) c += FLARE_COST * v.flareUrgency;
  const pr = w.player.r + 2;
  for (let i = 0; i < v.endN; i++) {
    const e = v.ends[i] as PortalEnd;
    const d = Math.hypot(e.x + e.vx * t - sx, e.y + e.vy * t - sy);
    if (d < PORTAL.r + pr) c += v.endCost[i] as number;
  }
  return c;
}

/**
 * Hit causes for the Act II hazards, or null: `flare` (the burn's hit),
 * `portal` (within the 1 s ship cooldown of going through one) and `bubble-shot`
 * (the nearest enemy shot was in a bubble). The harness's `hitCause` should
 * ask this first.
 */
export function hazardsIIHitCause(w: World): string | null {
  const f = flareState(w);
  if (f !== undefined && f.hitTick === w.tick) return 'flare';
  if (sinceShipPorted(w) < PORTAL.shipCooldown) return 'portal';
  const p = w.player;
  let best = Infinity;
  let nearest: Bullet | null = null;
  for (let i = 0; i < w.enemyShots.count; i++) {
    const b = w.enemyShots.items[i] as Bullet;
    if (!b.active) continue;
    const d = Math.hypot(b.x - p.x, b.y - p.y) - b.r;
    if (d < best) {
      best = d;
      nearest = b;
    }
  }
  if (nearest !== null && best < p.r + 2 && bubbleTimeScale(w, nearest.x, nearest.y) !== 1)
    return 'bubble-shot';
  return null;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// Terrain (T34). Walls are on screen for seconds, so the bot reads them the
// way a player does: stay in the column that is still open ~1.5 s of scroll
// ahead, don't path through rock, and don't sit low under a wall.
const TERRAIN_LOOK = 1.5;
const TERRAIN_STEPS = 6;
const TERRAIN_HW = 7;
const TERRAIN_COST = 90;

/** Solid anywhere in the ship's terrain box (a px wider than the real one). */
function boxSolid(w: World, x: number, y: number): boolean {
  return (
    isSolidAt(w, x, y) ||
    isSolidAt(w, x - TERRAIN_HW, y - TERRAIN_HW) ||
    isSolidAt(w, x + TERRAIN_HW, y - TERRAIN_HW) ||
    isSolidAt(w, x - TERRAIN_HW, y + TERRAIN_HW) ||
    isSolidAt(w, x + TERRAIN_HW, y + TERRAIN_HW)
  );
}

function terrainCost(w: World, cx: number, cy: number): number {
  const p = w.player;
  let c = 0;
  // The way there, through today's walls.
  for (let i = 1; i <= 4; i++) {
    const k = i / 4;
    if (boxSolid(w, p.x + (cx - p.x) * k, p.y + (cy - p.y) * k)) c += TERRAIN_COST;
  }
  // The spot as the terrain scrolls over it: the rows now above it arrive later.
  for (let s = 0; s <= TERRAIN_STEPS; s++) {
    const t = (s / TERRAIN_STEPS) * TERRAIN_LOOK;
    const y = cy - w.scrollSpeed * t;
    if (!boxSolid(w, cx, y)) continue;
    const open = nearestOpenX(w, cx, y, TERRAIN_HW);
    const far = open !== open ? 120 : Math.abs(open - cx);
    c += (TERRAIN_COST + far) / (1 + t);
  }
  // Crush: low on screen with rock right above is a trap.
  if (cy > 340 && boxSolid(w, cx, cy - 24)) c += TERRAIN_COST;
  return c;
}
