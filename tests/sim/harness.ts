// Headless Level 1 runner with a heuristic "human-ish" bot, for the T18
// balance pass. T20 builds the real bot harness; this is the measuring stick
// the balance log in tickets/T18-integration-balance.md was taken with.
//
// The bot plays like a reasonable player rather than a perfect one: it
// re-decides only every `reactTicks`, looks a short way ahead, keeps a safety
// margin, drifts under the nearest target, and grabs pickups when the path
// looks clear. It writes a mouse-style target into `world.input`, the same
// path the real game uses.
import { ENEMY_FAIRNESS } from '../../src/content/enemies';
import { getLevel } from '../../src/content/levels';
import { createRng, type Rng } from '../../src/engine/rng';
import { getDirector, startDirector, updateDirector } from '../../src/game/director';
import { enemySystem } from '../../src/game/enemies';
import { activeBoss, bossSystem, Phase } from '../../src/game/boss';
import { obstaclesSystem } from '../../src/game/obstacles';
import { pickupsSystem } from '../../src/game/pickups';
import { initPlayer, playerSystem } from '../../src/game/player';
import { weaponSystem } from '../../src/game/weapons';
import { computePlayerStats, createDefaultSave, type SaveData } from '../../src/meta';
import { cleanupSystem } from '../../src/sim/cleanup';
import { collisionSystem } from '../../src/sim/collision';
import { bulletsSystem } from '../../src/sim/motion';
import { isTargetable } from '../../src/sim/targeting';
import type { Asteroid, Bullet, Enemy, Pickup } from '../../src/sim/types';
import { createWorld, type System, type World } from '../../src/sim/world';

export const DT = 1 / 60;
const SHOT_TTL = ENEMY_FAIRNESS.shotTtl;

const SYSTEMS: System[] = [
  { name: 'scroll', update: (w, dt) => void (w.scrollY += w.scrollSpeed * dt) },
  playerSystem,
  weaponSystem,
  enemySystem,
  bossSystem,
  bulletsSystem,
  obstaclesSystem,
  pickupsSystem,
  collisionSystem,
  cleanupSystem,
  { name: 'director', update: updateDirector },
];

export interface BotSkill {
  name: string;
  /** Ticks between decisions (human reaction granularity). */
  reactTicks: number;
  /** Seconds of look-ahead when projecting threats. */
  lookahead: number;
  /** Extra clearance kept from threats, px. */
  margin: number;
  /** Chance per decision to ignore pickups (busy dodging, distracted). */
  greed: number;
  /** Aim error, px (stddev-ish), applied to the drift-under-target x. */
  aimNoise: number;
  /** Fraction of threats noticed in any half-second window (humans miss things). */
  awareness: number;
  /** Seconds before a freshly fired enemy shot registers (reaction time). */
  shotReact: number;
}

export const SKILLS: Readonly<Record<string, BotSkill>> = {
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
};

export interface RunStats {
  seed: string;
  skill: string;
  victory: boolean;
  /** Level time at death / clear. */
  endT: number;
  reachedBoss: boolean;
  /** Seconds from bossSpawned to bossDefeated (or to death). */
  bossTime: number;
  bossPhaseAtEnd: number;
  hits: number;
  hitsBefore45: number;
  hitsInBoss: number;
  /** Hit causes, keyed `level:shot`, `boss:rock`, … (nearest threat at the moment of the hit). */
  hitCauses: Record<string, number>;
  salvage: number;
  weaponsAtBoss: string;
  weaponCountAt: Record<number, number>;
  salvageAt: Record<number, number>;
  levelSumAtBoss: number;
  peakEnemyShotsLevel: number;
  peakEnemyShotsBoss: number;
  peakPlayerShots: number;
  peakEnemies: number;
  peakAsteroids: number;
  capsulesSpawned: number;
  pickupsCollected: Record<string, number>;
  podRescued: boolean;
  schematics: string[];
  updateMsAvg: number;
  updateMsMax: number;
}

export interface RunOptions {
  seed: string;
  skill: BotSkill;
  shipId?: string;
  pilotId?: string;
  save?: SaveData;
  /** Hard stop, level seconds. */
  maxT?: number;
  god?: boolean;
  debug?: boolean;
}

function weaponsString(w: World): string {
  return w.player.weapons.map((x) => `${x.id}${x.level}`).join(' ');
}

/** Plays one run to death or victory and returns the measurements. */
export function playRun(opts: RunOptions): RunStats {
  const save = opts.save ?? createDefaultSave();
  const shipId = opts.shipId ?? 'kestrel';
  const pilotId = opts.pilotId ?? 'blastroid';
  const w = createWorld(opts.seed, { shipId, pilotId, levelId: 'kessler' });
  initPlayer(w, computePlayerStats(save, shipId, pilotId));
  const level = getLevel('kessler');
  w.scrollSpeed = level.scrollSpeed;
  startDirector(w, level, {});
  const bot = new Bot(opts.skill, createRng(`${opts.seed}#bot`));

  const st: RunStats = {
    seed: opts.seed,
    skill: opts.skill.name,
    victory: false,
    endT: 0,
    reachedBoss: false,
    bossTime: 0,
    bossPhaseAtEnd: -1,
    hits: 0,
    hitsBefore45: 0,
    hitsInBoss: 0,
    hitCauses: {},
    salvage: 0,
    weaponsAtBoss: '',
    weaponCountAt: {},
    salvageAt: {},
    levelSumAtBoss: 0,
    peakEnemyShotsLevel: 0,
    peakEnemyShotsBoss: 0,
    peakPlayerShots: 0,
    peakEnemies: 0,
    peakAsteroids: 0,
    capsulesSpawned: 0,
    pickupsCollected: {},
    podRescued: false,
    schematics: [],
    updateMsAvg: 0,
    updateMsMax: 0,
  };
  let bossAt = -1;
  let over: boolean | null = null;
  w.events.on('playerHit', () => {
    const key = `${bossAt >= 0 ? 'boss' : 'level'}:${hitCause(w)}`;
    st.hitCauses[key] = (st.hitCauses[key] ?? 0) + 1;
    st.hits++;
    if (w.time < 45) st.hitsBefore45++;
    if (bossAt >= 0) st.hitsInBoss++;
  });
  w.events.on('bossSpawned', () => {
    bossAt = w.time;
    st.reachedBoss = true;
    st.weaponsAtBoss = weaponsString(w);
    st.levelSumAtBoss = w.player.weapons.reduce((n, x) => n + x.level, 0);
  });
  w.events.on('bossDefeated', () => {
    st.bossTime = w.time - bossAt;
  });
  w.events.on('runOver', (e) => {
    over ??= e.victory;
  });
  const capsuleIds = new Set<number>();

  const maxT = opts.maxT ?? 300;
  let ticks = 0;
  let msSum = 0;
  const marks = [30, 45, 60, 90, 120, 150, 180];
  let lastLog = 0;
  while (over === null && w.time < maxT) {
    if (opts.debug && bossAt >= 0 && w.time - lastLog > 2) {
      lastLog = w.time;
      const b = activeBoss(w);
      const core = b?.core.enemy;
      console.log(
        `t${w.time.toFixed(0)} ph${b?.phase} core ${core?.hp.toFixed(0)} cx ${core?.x.toFixed(0)} px ${w.player.x.toFixed(0)} py ${w.player.y.toFixed(0)} ps ${w.playerShots.count} pu ${w.pickups.count} es ${w.enemyShots.count} rocks ${w.asteroids.count} ${weaponsString(w)}`,
      );
    }
    if (opts.god) w.player.invulnT = 1;
    bot.decide(w);
    const t0 = performance.now();
    w.tick++;
    w.time += DT;
    for (const s of SYSTEMS) s.update(w, DT);
    const ms = performance.now() - t0;
    msSum += ms;
    ticks++;
    if (ms > st.updateMsMax) st.updateMsMax = ms;
    for (const m of marks) {
      if (st.weaponCountAt[m] === undefined && w.time >= m) {
        st.weaponCountAt[m] = w.player.weapons.length;
        st.salvageAt[m] = Math.floor(w.run.salvage);
      }
    }
    const es = countActive(w.enemyShots.items, w.enemyShots.count);
    const boss = activeBoss(w);
    if (boss !== null && boss.phase === Phase.Exposed) {
      if (es > st.peakEnemyShotsBoss) st.peakEnemyShotsBoss = es;
    } else if (boss === null && es > st.peakEnemyShotsLevel) st.peakEnemyShotsLevel = es;
    st.peakPlayerShots = Math.max(st.peakPlayerShots, w.playerShots.count);
    st.peakEnemies = Math.max(st.peakEnemies, w.enemies.count);
    st.peakAsteroids = Math.max(st.peakAsteroids, w.asteroids.count);
    for (let i = 0; i < w.pickups.count; i++) {
      const k = w.pickups.items[i] as Pickup;
      if (k.active && (k.kind === 'weapon' || k.kind === 'upgrade')) capsuleIds.add(k.id);
    }
  }
  if (bossAt >= 0 && st.bossTime === 0) st.bossTime = w.time - bossAt;
  st.capsulesSpawned = capsuleIds.size;
  st.victory = over === true;
  st.endT = w.time;
  st.bossPhaseAtEnd = activeBoss(w)?.phase ?? -1;
  st.salvage = Math.floor(w.run.salvage);
  st.pickupsCollected = { ...w.run.pickupsCollected };
  st.podRescued = w.run.pilotsRescued.length > 0;
  st.schematics = [...w.run.schematics];
  st.updateMsAvg = msSum / Math.max(1, ticks);
  void getDirector;
  return st;
}

function hitCause(w: World): string {
  const p = w.player;
  let best = Infinity;
  let cause = '?';
  const check = (b: { active: boolean; x: number; y: number; r: number }, kind: string) => {
    if (!b.active) return;
    const d = Math.hypot(b.x - p.x, b.y - p.y) - b.r;
    if (d < best) {
      best = d;
      cause = kind;
    }
  };
  for (let i = 0; i < w.enemyShots.count; i++) check(w.enemyShots.items[i] as Bullet, 'shot');
  for (let i = 0; i < w.asteroids.count; i++) check(w.asteroids.items[i] as Asteroid, 'rock');
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i] as Enemy;
    check(e, e.isBoss ? 'hull' : `ram-${e.defId}`);
  }
  return cause;
}

function countActive(items: readonly { active: boolean }[], n: number): number {
  let c = 0;
  for (let i = 0; i < n; i++) if ((items[i] as { active: boolean }).active) c++;
  return c;
}

const DIRS = 16;
const RINGS = [0, 8, 18, 32, 50];

/** Heuristic dodger: samples nearby points, scores projected threat overlap plus preference. */
class Bot {
  private tick = 0;
  private tx = 120;
  private ty = 330;
  private aimOff = 0;

  constructor(
    readonly skill: BotSkill,
    readonly rng: Rng,
  ) {}

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

  private epoch = 0;

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
        let cost = this.danger(w, cx, cy);
        const dx = cx - pref.x;
        const dy = cy - pref.y;
        cost += Math.sqrt(dx * dx + dy * dy) * 0.04;
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
    // Pickups first, when greedy and the item is reachable (below y 120).
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
    const steps = 4;
    for (let s = 0; s <= steps; s++) {
      const t = (s / steps) * sk.lookahead;
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

const PREF = { x: 0, y: 0 };

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function summarize(runs: readonly RunStats[]): string {
  const n = runs.length;
  const avg = (f: (r: RunStats) => number, sel = runs) =>
    sel.length === 0 ? NaN : sel.reduce((s, r) => s + f(r), 0) / sel.length;
  const boss = runs.filter((r) => r.reachedBoss);
  const wins = runs.filter((r) => r.victory);
  const deaths = runs.filter((r) => !r.victory);
  const midDeaths = deaths.filter((r) => !r.reachedBoss);
  const lines = [
    `runs ${n} (${runs[0]?.skill}) · reach boss ${boss.length}/${n} · clear ${wins.length}/${n}`,
    `death T: ${deaths.map((r) => r.endT.toFixed(0)).join(',') || '-'}`,
    `hits <45s avg ${avg((r) => r.hitsBefore45).toFixed(2)} · hits total avg ${avg((r) => r.hits).toFixed(1)}`,
    `weapons @30/45/60/90/120/180: ${[30, 45, 60, 90, 120, 180].map((m) => avg((r) => r.weaponCountAt[m] ?? 0).toFixed(1)).join(' / ')}`,
    `salvage @45/90/120/150/180: ${[45, 90, 120, 150, 180].map((m) => avg((r) => r.salvageAt[m] ?? NaN).toFixed(0)).join(' / ')}`,
    `at boss: ${boss.map((r) => r.weaponsAtBoss).join(' | ')}`,
    `level sum at boss avg ${avg((r) => r.levelSumAtBoss, boss).toFixed(1)} · capsules spawned avg ${avg((r) => r.capsulesSpawned).toFixed(1)}`,
    `timeouts: ${runs
      .filter((r) => !r.victory && r.endT >= 299)
      .map((r) => `[${r.seed} ${r.weaponsAtBoss} ph${r.bossPhaseAtEnd}]`)
      .join(' ')}`,
    `boss time (wins) ${wins.map((r) => r.bossTime.toFixed(0)).join(',') || '-'} · boss hits avg ${avg((r) => r.hitsInBoss, boss).toFixed(1)}`,
    `salvage: clear ${wins.map((r) => r.salvage).join(',') || '-'} · mid-death ${midDeaths.map((r) => r.salvage).join(',') || '-'} · boss-death ${
      deaths
        .filter((r) => r.reachedBoss)
        .map((r) => r.salvage)
        .join(',') || '-'
    }`,
    `peak enemy shots level ${Math.max(...runs.map((r) => r.peakEnemyShotsLevel))} · boss P2 ${Math.max(...runs.map((r) => r.peakEnemyShotsBoss))} · player shots ${Math.max(...runs.map((r) => r.peakPlayerShots))} · enemies ${Math.max(...runs.map((r) => r.peakEnemies))} · rocks ${Math.max(...runs.map((r) => r.peakAsteroids))}`,
    `hit causes: ${Object.entries(
      runs.reduce<Record<string, number>>((acc, r) => {
        for (const [k, v] of Object.entries(r.hitCauses)) acc[k] = (acc[k] ?? 0) + v;
        return acc;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}`,
    `pod rescued ${runs.filter((r) => r.podRescued).length}/${n} · update ms avg ${avg((r) => r.updateMsAvg).toFixed(3)} max ${Math.max(...runs.map((r) => r.updateMsMax)).toFixed(2)}`,
  ];
  return lines.join('\n');
}
