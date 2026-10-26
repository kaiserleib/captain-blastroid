import { describe, expect, it } from 'vitest';
import { ENEMY_FAIRNESS } from '../../src/content/enemies';
import { PULSAR } from '../../src/content/obstacles';
import { createRng, type Rng } from '../../src/engine/rng';
import { activeBoss } from '../../src/game/boss';
import {
  inPulsarGap,
  pulsarGapAngles,
  pulsarGapWidth,
  pulsarGlow,
  pulsarRingRadius,
} from '../../src/game/obstacles';
import { pulsarRingRot } from '../../src/game/obstacles/anomalies/pulsar';
import { isTargetable } from '../../src/sim/targeting';
import type { Anomaly, Asteroid, Bullet, Enemy, Pickup } from '../../src/sim/types';
import type { World } from '../../src/sim/world';
import { BALANCE_MAX_T, formatBalanceReport, type BalanceRun } from './balance.report';
import { dodgerBot, SKILLS, type Bot, type BotSkill, type SkillId } from './bots';
import { runSim } from './harness';

// Sector 4 balance with a pulsar-aware bot. The shared dodger can't see pulse
// rings (T31 teaches it), so on its own most of its hits here are rings
// (measured: 23 of 36 hits over 10 typical runs). `PulsarDodger` is the shared
// dodger (tests/sim/bots.ts, copied: it isn't exported) plus one more cost
// term: a sample point is dangerous while a ring sweeps through it outside a
// gap. Rings get a longer look-ahead than shots (lookahead + 0.6 s), standing
// in for the telegraph spokes a person reads before the pulse.
//
//   BALANCE=1 [RUNS=50] [SKILLS=novice,typical,expert,god] \
//     npx vitest run tests/sim/pulsarNursery.balance.test.ts --silent=false
// (`LEVEL=pulsarNursery npm run balance` runs the blind shared bot.)

const env =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const BALANCE = env.BALANCE === '1';
const RUNS = Number(env.RUNS ?? 50);
const PASSES = (env.SKILLS ?? 'typical').split(',').map((s) => s.trim());

const SHOT_TTL = ENEMY_FAIRNESS.shotTtl;
const DIRS = 16;
const RADII = [0, 8, 18, 32, 50, 72, 100, 130];
const LOOK_STEPS = 4;
const RING_STEPS = 12;
/** Extra seconds of ring foresight: the telegraph shows the next gaps 0.7–0.8 s ahead. */
const TELEGRAPH_READ = Number(env.READ ?? 1.2);
const PREF = { x: 0, y: 0 };
const GAPS = [0, 0, 0, 0, 0, 0, 0, 0];
const RING_COST = Number(env.RING_COST ?? 140);

class PulsarDodger implements Bot {
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
    this.name = `${god ? 'god' : 'dodger'}-${skill.name}+rings`;
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
    for (let ri = 0; ri < RADII.length; ri++) {
      const rad = RADII[ri] as number;
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
    const ringLook = sk.lookahead + TELEGRAPH_READ;
    for (let s = 1; s <= RING_STEPS; s++) {
      const t0 = ((s - 1) / RING_STEPS) * ringLook;
      const t1 = (s / RING_STEPS) * ringLook;
      const k = reach <= 0 ? 1 : Math.min(1, t1 / reach);
      cost += this.overlapRings(w, p.x + (cx - p.x) * k, p.y + (cy - p.y) * k, t0, t1);
    }
    return cost;
  }

  /** A ring sweeping through (sx, sy) during [t0, t1] outside its gaps. */
  private overlapRings(w: World, sx: number, sy: number, t0: number, t1: number): number {
    let c = 0;
    const band = PULSAR.ringThickness / 2 + w.player.r + this.skill.margin + 2;
    for (let i = 0; i < w.anomalies.count; i++) {
      const a = w.anomalies.items[i] as Anomaly;
      if (!a.active || a.kind !== 'pulsar') continue;
      // The core itself, where it will be (it drifts with the scroll).
      const core = Math.hypot(sx - a.x - a.vx * t1, sy - a.y - a.vy * t1) - a.r - band;
      if (core < 0) c += 80 - core * 8;
      const dx = sx - a.x;
      const dy = sy - a.y;
      const d = Math.hypot(dx, dy);
      if (d > a.radius + band) continue;
      const speed = a.strength;
      const g = pulsarGlow(a);
      const n = pulsarGapAngles(a, GAPS);
      const gw = pulsarGapWidth(a);
      // Hug the middle of a gap, not its edge: plans are only refreshed every few ticks.
      const br = w.player.r + this.skill.margin + 6;
      if (g > 0) {
        // Next ring: starts at the core when the glow fills.
        const tp = (1 - g) * 0.7;
        if (t1 >= tp) {
          const r0 = a.r + Math.max(0, t0 - tp) * speed;
          const r1 = a.r + (t1 - tp) * speed;
          if (
            d + band >= r0 &&
            d - band <= r1 &&
            !inPulsarGap(dx, dy, br, n, gw, GAPS[0] as number)
          )
            c += RING_COST;
        }
      }
      // The live ring (still on its way out while the next one may be telegraphed).
      const R = pulsarRingRadius(a);
      if (R < 0) continue;
      const r0 = R + t0 * speed;
      const r1 = R + t1 * speed;
      if (d + band < r0 || d - band > r1) continue;
      if (!inPulsarGap(dx, dy, br, n, gw, pulsarRingRot(a))) c += RING_COST;
    }
    return c;
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

export function pulsarDodger(skill: BotSkill = SKILLS.typical, god = false): Bot {
  return new PulsarDodger(skill, god);
}

/** Counts shield losses that happen while a pulse ring overlaps the ship. */
export function ringHitCounter(): { onTick: (w: World) => void; hits: () => number } {
  let shield = -1;
  let n = 0;
  return {
    onTick(w) {
      const s = w.player.shield;
      if (shield >= 0 && s < shield) {
        const p = w.player;
        for (let i = 0; i < w.anomalies.count; i++) {
          const a = w.anomalies.items[i] as Anomaly;
          if (!a.active || a.kind !== 'pulsar') continue;
          const R = pulsarRingRadius(a);
          const band = PULSAR.ringThickness / 2 + p.r + 2;
          if (R >= 0 && Math.abs(Math.hypot(p.x - a.x, p.y - a.y) - R) <= band) {
            n++;
            break;
          }
        }
      }
      shield = s;
    },
    hits: () => n,
  };
}

describe('pulsar-aware bot', () => {
  it('reads rings: far fewer ring hits than the blind dodger over the same seeds', () => {
    let blind = 0;
    let aware = 0;
    for (let i = 0; i < 4; i++) {
      const c1 = ringHitCounter();
      runSim(`pn-ring${i}`, dodgerBot(), 60, { levelId: 'pulsarNursery', onTick: c1.onTick });
      blind += c1.hits();
      const c2 = ringHitCounter();
      runSim(`pn-ring${i}`, pulsarDodger(), 60, { levelId: 'pulsarNursery', onTick: c2.onTick });
      aware += c2.hits();
    }
    expect(blind).toBeGreaterThan(3);
    expect(aware).toBeLessThan(blind / 2);
  }, 60_000);
});

describe.skipIf(!BALANCE)('pulsarNursery balance (pulsar-aware bot)', () => {
  // `<skill>-perfect` refunds every ring hit: the same runs with perfect ring
  // reading, i.e. what the level's guns, rocks and rams cost on their own.
  for (const pass of PASSES) {
    it(
      pass,
      () => {
        const perfect = pass.endsWith('-perfect');
        const base = perfect ? pass.slice(0, -'-perfect'.length) : pass;
        const isGod = base === 'god';
        const skill = SKILLS[(isGod ? 'typical' : base) as SkillId];
        expect(skill, `unknown skill "${pass}"`).toBeDefined();
        const make = () => pulsarDodger(skill, isGod);
        const runs: BalanceRun[] = [];
        let ringHits = 0;
        for (let i = 0; i < RUNS; i++) {
          const rings = ringHitCounter();
          const r = runSim(`pulsarNursery-${isGod ? 'god' : 'bal'}${i}`, make(), BALANCE_MAX_T, {
            levelId: 'pulsarNursery',
            onTick: (w) => {
              const before = rings.hits();
              rings.onTick(w);
              if (perfect && rings.hits() > before) w.player.shield++;
            },
          });
          ringHits += rings.hits();
          runs.push({ result: r.result, stats: r.stats });
        }
        console.log(
          `\n${formatBalanceReport(`${make().name}${perfect ? ' (rings refunded)' : ''}`, runs, 'Level 4 PULSAR NURSERY')}`,
        );
        console.log(
          `  ring hits: ${ringHits} over ${RUNS} runs (${(ringHits / RUNS).toFixed(2)} per run)\n`,
        );
      },
      900_000,
    );
  }
});
