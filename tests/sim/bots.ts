// Bots for the headless harness. Each writes `world.input` once per tick, the
// same MoveIntent path the real game's input system fills.
import { ENEMY_FAIRNESS } from '../../src/content/enemies';
import { createRng, type Rng } from '../../src/engine/rng';
import { activeBoss } from '../../src/game/boss';
import { isTargetable } from '../../src/sim/targeting';
import type { Asteroid, Bullet, Enemy, Pickup } from '../../src/sim/types';
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

/** Steers away from projected threats, drifts under targets, grabs pickups when the path is clear. */
export function dodgerBot(skill: BotSkill = SKILLS.typical): Bot {
  return new Dodger(skill, false);
}

/** `dodgerBot` that can't die, to reach and finish the boss deterministically. */
export function godBot(skill: BotSkill = SKILLS.expert): Bot {
  return new Dodger(skill, true);
}

const SHOT_TTL = ENEMY_FAIRNESS.shotTtl;
const DIRS = 16;
const RINGS = [0, 8, 18, 32, 50];
const LOOK_STEPS = 4;
const PREF = { x: 0, y: 0 };

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

  constructor(
    readonly skill: BotSkill,
    readonly god: boolean,
  ) {
    this.name = `${god ? 'god' : 'dodger'}-${skill.name}`;
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
    const pref = this.preferred(w);
    let best = Infinity;
    let bx = p.x;
    let by = p.y;
    for (let ri = 0; ri < RINGS.length; ri++) {
      const rad = RINGS[ri] as number;
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

  private preferred(w: World): { x: number; y: number } {
    const p = w.player;
    const out = PREF;
    out.y = activeBoss(w) !== null ? 270 : 330;
    out.x = 120;
    // Pickups first, when greedy and the item is reachable (below y 110).
    if (this.rng.chance(this.skill.greed)) {
      let bestD = Infinity;
      for (let i = 0; i < w.pickups.count; i++) {
        const k = w.pickups.items[i] as Pickup;
        if (!k.active || k.y < 110 || k.y > 395) continue;
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
    }
    return cost;
  }

  private overlapShots(items: readonly Bullet[], n: number, sx: number, sy: number, t: number) {
    let c = 0;
    const m = this.skill.margin + 4;
    for (let i = 0; i < n; i++) {
      const b = items[i] as Bullet;
      if (!b.active || SHOT_TTL - b.ttl < this.skill.shotReact) continue;
      const d = Math.hypot(b.x + b.vx * t - sx, b.y + b.vy * t - sy) - b.r - m;
      if (d < 0) c += 100 - d * 10;
    }
    return c;
  }

  private overlapRocks(w: World, sx: number, sy: number, t: number): number {
    let c = 0;
    const m = this.skill.margin + 4;
    for (let i = 0; i < w.asteroids.count; i++) {
      const a = w.asteroids.items[i] as Asteroid;
      if (!a.active || !this.sees(a.id)) continue;
      const d = Math.hypot(a.x + a.vx * t - sx, a.y + a.vy * t - sy) - a.r - m;
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
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
