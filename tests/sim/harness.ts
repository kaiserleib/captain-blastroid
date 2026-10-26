// Headless Level 1 runner (T20). Builds a World the way GameScene.enter does,
// minus rendering, audio, fx and the DOM-bound input/background systems, then
// steps it at 60 Hz with a bot writing `world.input`.
//
// Nothing here touches the DOM: sim/game/content import cleanly under Node.
import { getLevel } from '../../src/content/levels';
import type { GameEvents } from '../../src/engine/events';
import type { Pool } from '../../src/engine/pool';
import { activeBoss, bossSystem, Phase } from '../../src/game/boss';
import { directorSystem, startDirector } from '../../src/game/director';
import { enemySystem } from '../../src/game/enemies';
import { obstaclesSystem } from '../../src/game/obstacles';
import { pickupsSystem } from '../../src/game/pickups';
import { initPlayer, playerSystem, setGodMode } from '../../src/game/player';
import { weaponSystem } from '../../src/game/weapons';
import { computePlayerStats, createDefaultSave, type SaveData } from '../../src/meta';
import { cleanupSystem } from '../../src/sim/cleanup';
import { collisionSystem } from '../../src/sim/collision';
import { bulletsSystem } from '../../src/sim/motion';
import type { Asteroid, Bullet, Enemy, Pickup } from '../../src/sim/types';
import { createWorld, type PoolCapacities, type System, type World } from '../../src/sim/world';
import type { Bot } from './bots';

export const DT = 1 / 60;

/** Stand-in for the background's system, which owns `scrollY` in GameScene. */
const scrollSystem: System = {
  name: 'scroll',
  update: (w, dt) => void (w.scrollY += w.scrollSpeed * dt),
};

/**
 * GameScene's systems in GameScene's order, keyed by the identifier GameScene
 * uses, so `harness.test.ts` can diff the two lists. Left out on purpose:
 * the background (`scrollSystem` stands in), `input.system` (the bot writes
 * `world.input`) and fx (presentation only).
 */
export const GAME_SYSTEMS = {
  playerSystem,
  weaponSystem,
  enemySystem,
  bossSystem,
  bulletsSystem,
  obstaclesSystem,
  pickupsSystem,
  collisionSystem,
  cleanupSystem,
  directorSystem,
} as const satisfies Record<string, System>;

/** GameScene system entries the harness replaces or skips. */
export const PRESENTATION_SYSTEMS = ['this.bg.system', 'input.system', 'this.fx.system'];

export const SIM_SYSTEMS: readonly System[] = [scrollSystem, ...Object.values(GAME_SYSTEMS)];

/** Every GameEvents key; `satisfies` makes the compiler flag a new event missing here. */
const EVENT_TYPES = Object.keys({
  enemyHit: 1,
  enemyKilled: 1,
  asteroidHit: 1,
  asteroidDestroyed: 1,
  playerHit: 1,
  playerDied: 1,
  pickupCollected: 1,
  weaponAdded: 1,
  weaponLeveled: 1,
  formationCleared: 1,
  bossRequested: 1,
  bossSpawned: 1,
  bossDefeated: 1,
  levelComplete: 1,
  sfx: 1,
  shake: 1,
  hitstop: 1,
  haptic: 1,
  toast: 1,
  bossWarning: 1,
  pauseRequested: 1,
  runOver: 1,
} satisfies Record<keyof GameEvents, 1>) as (keyof GameEvents)[];

/** Hashed but kept out of the readable log: they fire hundreds of times per run. */
const NOISY = new Set<keyof GameEvents>([
  'enemyHit',
  'asteroidHit',
  'sfx',
  'shake',
  'hitstop',
  'haptic',
]);

export interface LoggedEvent {
  tick: number;
  type: keyof GameEvents;
  /** Payload snapshot (payload objects are reused, so they're serialized at emit time). */
  data: string;
}

export type Outcome = 'victory' | 'death' | 'timeout';

export interface SimResult {
  outcome: Outcome;
  victory: boolean;
  /** Level time at the end (death / runOver / timeout), seconds. */
  endT: number;
  ticks: number;
}

export interface PoolUsage {
  capacity: number;
  peak: number;
  dropped: number;
}

export interface RunStats {
  seed: string;
  bot: string;
  reachedBoss: boolean;
  /** Level time of `bossSpawned`, or -1. */
  bossAt: number;
  /** Seconds from bossSpawned to bossDefeated (or to the end). */
  bossTime: number;
  bossDefeated: boolean;
  levelComplete: boolean;
  bossPhaseAtEnd: number;
  hits: number;
  hitsBefore45: number;
  hitsInBoss: number;
  /** Hit causes, keyed `level:shot`, `boss:rock`, … (nearest threat at the moment of the hit). */
  hitCauses: Record<string, number>;
  /** Floored, as banking floors it. */
  salvage: number;
  score: number;
  weaponsAtBoss: string;
  levelSumAtBoss: number;
  avgLevelAtBoss: number;
  weaponsAtEnd: string;
  avgLevelAtEnd: number;
  weaponCountAt: Record<number, number>;
  salvageAt: Record<number, number>;
  peakEnemyShotsLevel: number;
  peakEnemyShotsBoss: number;
  capsulesSpawned: number;
  pickupsCollected: Record<string, number>;
  podRescued: boolean;
  schematics: string[];
  pools: Record<string, PoolUsage>;
  updateMsAvg: number;
  updateMsMax: number;
}

export interface SimRun {
  /** Readable log (noisy per-hit events left out). */
  events: LoggedEvent[];
  /** FNV-1a over every event, noisy ones included, plus the final world state. */
  hash: string;
  eventCount: number;
  result: SimResult;
  stats: RunStats;
}

export interface SimOptions {
  shipId?: string;
  pilotId?: string;
  save?: SaveData;
  /** Weapons granted after init (merged by id, levels raised): the "debug-boosted loadout". */
  loadout?: readonly { id: string; level: number }[];
  /** Called after every tick (for test probes). */
  onTick?: (w: World) => void;
  /** Log boss progress every 2 s. */
  debug?: boolean;
  /** Pool capacity overrides (to prove the overflow counters are watched). */
  capacities?: Partial<PoolCapacities>;
}

/** Builds a world exactly as GameScene.enter does (save, loadout, scroll, director). */
export function createSimWorld(seed: string, opts: SimOptions = {}): World {
  const save = opts.save ?? createDefaultSave();
  const shipId = opts.shipId ?? save.selectedShip;
  const pilotId = opts.pilotId ?? save.selectedPilot;
  const w = createWorld(seed, {
    shipId,
    pilotId,
    levelId: 'kessler',
    capacities: opts.capacities,
  });
  initPlayer(w, computePlayerStats(save, shipId, pilotId));
  if (opts.loadout) grant(w, opts.loadout);
  const level = getLevel(w.run.levelId);
  w.scrollSpeed = level.scrollSpeed;
  startDirector(w, level, { startT: 0, debugLoadout: true });
  return w;
}

function grant(w: World, loadout: readonly { id: string; level: number }[]): void {
  const p = w.player;
  for (const g of loadout) {
    const owned = p.weapons.find((x) => x.id === g.id);
    if (owned) owned.level = Math.max(owned.level, g.level);
    else p.weapons.push({ id: g.id, level: g.level, cooldown: 0, state: 0 });
  }
}

/** Plays one run until runOver, or `seconds` of level time, whichever is first. */
export function runSim(seed: string, bot: Bot, seconds: number, opts: SimOptions = {}): SimRun {
  setGodMode(bot.god);
  try {
    return play(seed, bot, seconds, opts);
  } finally {
    setGodMode(false);
  }
}

const MARKS = [30, 45, 60, 90, 120, 150, 180];

function play(seed: string, bot: Bot, seconds: number, opts: SimOptions): SimRun {
  const w = createSimWorld(seed, opts);
  const events: LoggedEvent[] = [];
  let hash = FNV_OFFSET;
  let eventCount = 0;
  for (const type of EVENT_TYPES) {
    w.events.on(type, (payload: unknown) => {
      const data = fmt(payload);
      eventCount++;
      hash = fnv(hash, `${w.tick}|${type}|${data}`);
      if (!NOISY.has(type)) events.push({ tick: w.tick, type, data });
    });
  }

  const st: RunStats = {
    seed,
    bot: bot.name,
    reachedBoss: false,
    bossAt: -1,
    bossTime: 0,
    bossDefeated: false,
    levelComplete: false,
    bossPhaseAtEnd: -1,
    hits: 0,
    hitsBefore45: 0,
    hitsInBoss: 0,
    hitCauses: {},
    salvage: 0,
    score: 0,
    weaponsAtBoss: '',
    levelSumAtBoss: 0,
    avgLevelAtBoss: 0,
    weaponsAtEnd: '',
    avgLevelAtEnd: 0,
    weaponCountAt: {},
    salvageAt: {},
    peakEnemyShotsLevel: 0,
    peakEnemyShotsBoss: 0,
    capsulesSpawned: 0,
    pickupsCollected: {},
    podRescued: false,
    schematics: [],
    pools: {},
    updateMsAvg: 0,
    updateMsMax: 0,
  };
  let over: boolean | null = null;
  let died = false;
  w.events.on('playerHit', () => {
    const key = `${st.reachedBoss ? 'boss' : 'level'}:${hitCause(w)}`;
    st.hitCauses[key] = (st.hitCauses[key] ?? 0) + 1;
    st.hits++;
    if (w.time < 45) st.hitsBefore45++;
    if (st.reachedBoss) st.hitsInBoss++;
  });
  w.events.on('playerDied', () => void (died = true));
  w.events.on('bossSpawned', () => {
    st.reachedBoss = true;
    st.bossAt = w.time;
    st.weaponsAtBoss = weaponsString(w);
    st.levelSumAtBoss = levelSum(w);
    st.avgLevelAtBoss = st.levelSumAtBoss / Math.max(1, w.player.weapons.length);
  });
  w.events.on('bossDefeated', () => {
    st.bossDefeated = true;
    st.bossTime = w.time - st.bossAt;
  });
  w.events.on('levelComplete', () => void (st.levelComplete = true));
  w.events.on('runOver', (e) => void (over ??= e.victory));

  const pools = poolsOf(w);
  for (const [name, p] of pools) st.pools[name] = { capacity: p.capacity, peak: 0, dropped: 0 };
  const capsuleIds = new Set<number>();
  bot.start(w);

  let ticks = 0;
  let msSum = 0;
  let lastLog = 0;
  while (over === null && w.time < seconds) {
    bot.decide(w);
    const t0 = performance.now();
    w.tick++;
    w.time += DT;
    for (let i = 0; i < SIM_SYSTEMS.length; i++) SIM_SYSTEMS[i]!.update(w, DT);
    const ms = performance.now() - t0;
    msSum += ms;
    ticks++;
    if (ms > st.updateMsMax) st.updateMsMax = ms;
    opts.onTick?.(w);

    for (const m of MARKS) {
      if (st.weaponCountAt[m] === undefined && w.time >= m) {
        st.weaponCountAt[m] = w.player.weapons.length;
        st.salvageAt[m] = Math.floor(w.run.salvage);
      }
    }
    for (const [name, p] of pools) {
      const u = st.pools[name]!;
      if (p.count > u.peak) u.peak = p.count;
    }
    const es = countActive(w.enemyShots.items, w.enemyShots.count);
    const boss = activeBoss(w);
    if (boss !== null && boss.phase === Phase.Exposed) {
      if (es > st.peakEnemyShotsBoss) st.peakEnemyShotsBoss = es;
    } else if (boss === null && es > st.peakEnemyShotsLevel) st.peakEnemyShotsLevel = es;
    for (let i = 0; i < w.pickups.count; i++) {
      const k = w.pickups.items[i] as Pickup;
      if (k.active && (k.kind === 'weapon' || k.kind === 'upgrade')) capsuleIds.add(k.id);
    }
    if (opts.debug && boss !== null && w.time - lastLog > 2) {
      lastLog = w.time;
      const core = boss.core.enemy;
      console.log(
        `t${w.time.toFixed(0)} ph${boss.phase} core ${core?.hp.toFixed(0)} px ${w.player.x.toFixed(0)} es ${es} ${weaponsString(w)}`,
      );
    }
  }

  if (st.reachedBoss && !st.bossDefeated) st.bossTime = w.time - st.bossAt;
  for (const [name, p] of pools) st.pools[name]!.dropped = p.droppedSpawns;
  st.capsulesSpawned = capsuleIds.size;
  st.bossPhaseAtEnd = activeBoss(w)?.phase ?? -1;
  st.salvage = Math.floor(w.run.salvage);
  st.score = w.run.score;
  st.weaponsAtEnd = weaponsString(w);
  st.avgLevelAtEnd = levelSum(w) / Math.max(1, w.player.weapons.length);
  st.pickupsCollected = { ...w.run.pickupsCollected };
  st.podRescued = w.run.pilotsRescued.length > 0;
  st.schematics = [...w.run.schematics];
  st.updateMsAvg = msSum / Math.max(1, ticks);

  const p = w.player;
  hash = fnv(hash, `end|${w.tick}|${fmt(p.x)},${fmt(p.y)}|${w.run.score}|${fmt(w.run.salvage)}`);
  const victory = over === true;
  const outcome: Outcome = victory ? 'victory' : over === false || died ? 'death' : 'timeout';
  return {
    events,
    hash: (hash >>> 0).toString(16).padStart(8, '0'),
    eventCount,
    result: { outcome, victory, endT: w.time, ticks },
    stats: st,
  };
}

function poolsOf(w: World): [string, Pool<{ active: boolean }>][] {
  return [
    ['playerShots', w.playerShots],
    ['enemyShots', w.enemyShots],
    ['enemies', w.enemies],
    ['asteroids', w.asteroids],
    ['anomalies', w.anomalies],
    ['pickups', w.pickups],
  ];
}

const FNV_OFFSET = 0x811c9dc5;

/** FNV-1a; the trailing separator keeps "ab"+"c" and "a"+"bc" apart. */
function fnv(h: number, s: string): number {
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.imul(h ^ 0x0a, 0x01000193);
}

/** Compact, deterministic payload snapshot. Entities print as `#id kind @x,y`. */
function fmt(v: unknown): string {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3);
  if (v === null || typeof v !== 'object') return String(v);
  const o = v as Record<string, unknown>;
  if (typeof o.id === 'number' && 'x' in o) {
    const tag = (o.defId ?? o.kind ?? '') as string;
    return `#${o.id}${tag}@${fmt(o.x)},${fmt(o.y)}`;
  }
  let s = '{';
  for (const k in o) s += `${k}:${fmt(o[k])},`;
  return `${s}}`;
}

function weaponsString(w: World): string {
  return w.player.weapons.map((x) => `${x.id}${x.level}`).join(' ');
}

function levelSum(w: World): number {
  return w.player.weapons.reduce((n, x) => n + x.level, 0);
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
