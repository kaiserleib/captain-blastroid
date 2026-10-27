import {
  ASTEROID_SIZES,
  ASTEROID_SIZE_IDS,
  ASTEROID_STREAM_DEFAULTS,
  MAX_STREAM_ANGLE,
  ROCK_THEME_IDS,
  ROCK_VARIANTS,
  rockThemeForLevel,
  type AsteroidSize,
  type RockTheme,
} from '../../content/obstacles';
import { TAU } from '../../engine/math';
import type { Renderer } from '../../gfx/renderer';
import { warm } from '../../gfx/spriteCache';
import { timeScaleAt } from '../../sim/hooks';
import { spawnAsteroid } from '../../sim/spawn';
import type { Asteroid } from '../../sim/types';
import type { DrawLayer, World } from '../../sim/world';
import { drawSlabs } from './hazards2/draw';
import { ROCK_IDS, rockFrame, rockIdsForTheme, sizeIndex } from './obstacles.sprites';

// ---------------------------------------------------------------------------
// Spawning

export interface RockInit {
  size: AsteroidSize;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Default: the level's theme (`rockThemeForLevel(run.levelId)`). */
  theme?: RockTheme;
  /** Shape 0..ROCK_VARIANTS-1. Default random. */
  shape?: number;
  /** Override the content HP; <= 0 makes the rock indestructible. */
  hp?: number;
  /** rad/s. Default random within the size's spin range. */
  spin?: number;
  rot?: number;
}

export function themeIndex(theme: RockTheme): number {
  return theme === 'kessler' ? 0 : theme === 'ion' ? 1 : 2;
}

/** The theme a rock was spawned with (encoded in `variant`). */
export function asteroidTheme(a: Asteroid): RockTheme {
  return ROCK_THEME_IDS[Math.floor(a.variant / ROCK_VARIANTS)] ?? 'kessler';
}

export function levelRockTheme(w: World): RockTheme {
  return rockThemeForLevel(w.run.levelId);
}

/**
 * Spawns one rock with content radius/HP, random spin and shape from
 * `world.rng`. Returns null when the pool is full. For T16's flung rocks and
 * anything else that places single rocks.
 */
export function spawnRock(w: World, o: RockInit): Asteroid | null {
  const def = ASTEROID_SIZES[o.size];
  const theme = o.theme ?? levelRockTheme(w);
  const rng = w.rng;
  const shape = o.shape ?? rng.int(0, ROCK_VARIANTS - 1);
  let spin = o.spin;
  if (spin === undefined) {
    spin = rng.range(def.spin[0], def.spin[1]);
    if (rng.next() < 0.5) spin = -spin;
  }
  scratchInit.x = o.x;
  scratchInit.y = o.y;
  scratchInit.vx = o.vx;
  scratchInit.vy = o.vy;
  scratchInit.r = def.r;
  scratchInit.hp = o.hp ?? def.hp[theme];
  scratchInit.size = o.size;
  scratchInit.rot = o.rot ?? rng.range(0, TAU);
  scratchInit.spin = spin;
  scratchInit.variant = themeIndex(theme) * ROCK_VARIANTS + shape;
  return spawnAsteroid(w, scratchInit);
}

const scratchInit = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  r: 0,
  hp: 0,
  size: 'small' as AsteroidSize,
  rot: 0,
  spin: 0,
  variant: 0,
};

// ---------------------------------------------------------------------------
// Streams (T15's director)

export interface AsteroidStreamConfig {
  /** Rocks per second. 0 pauses the stream. */
  rate: number;
  /** Relative weights; sizes with weight 0 never spawn. */
  sizeWeights: Readonly<Partial<Record<AsteroidSize, number>>>;
  /** Heading off straight down in degrees, clamped to ±25. */
  angleRange: readonly [number, number];
  /** Own speed px/s; `world.scrollSpeed` is added to vy on top. */
  speedRange: readonly [number, number];
  xRange: readonly [number, number];
  /** Interval jitter, 0 = metronome. */
  jitter: number;
  /** Seconds until the stream stops itself. Infinity = until `stop()`. */
  duration: number;
  /** Default: the level's theme. */
  theme?: RockTheme;
  /** Chance a spawned rock is indestructible (hp 0). */
  indestructibleChance: number;
  /** Pool slots left free for splits and boss rocks. */
  poolReserve: number;
}

/**
 * A rate-driven rock emitter. Rocks enter just above the top edge, heading
 * within ±25° of straight down, and include the scroll drift in vy.
 *
 * Use it either way:
 * - `spawnAsteroidStream(w, cfg)` registers it on the world and the obstacles
 *   system ticks it until `stop()` or `duration` runs out;
 * - or `new AsteroidStream(cfg)` and call `update(w, dt)` yourself.
 *
 * Config fields can be changed live (e.g. ramp `rate` over a wave).
 */
export class AsteroidStream {
  readonly config: AsteroidStreamConfig;
  elapsed = 0;
  active = true;
  spawned = 0;
  private wait = -1;

  constructor(cfg: Partial<AsteroidStreamConfig> = {}) {
    const d = ASTEROID_STREAM_DEFAULTS;
    this.config = {
      rate: cfg.rate ?? d.rate,
      sizeWeights: cfg.sizeWeights ?? d.sizeWeights,
      angleRange: cfg.angleRange ?? d.angleRange,
      speedRange: cfg.speedRange ?? d.speedRange,
      xRange: cfg.xRange ?? d.xRange,
      jitter: cfg.jitter ?? d.jitter,
      duration: cfg.duration ?? Infinity,
      theme: cfg.theme,
      indestructibleChance: cfg.indestructibleChance ?? 0,
      poolReserve: cfg.poolReserve ?? d.poolReserve,
    };
  }

  stop(): void {
    this.active = false;
  }

  /** Advances the emitter; returns how many rocks it spawned this call. */
  update(w: World, dt: number): number {
    if (!this.active) return 0;
    const c = this.config;
    this.elapsed += dt;
    if (this.elapsed >= c.duration) {
      this.active = false;
      return 0;
    }
    if (c.rate <= 0) return 0;
    // First rock arrives part-way into an interval so parallel streams don't sync.
    if (this.wait < 0) this.wait = w.rng.next() / c.rate;
    this.wait -= dt;
    let n = 0;
    while (this.wait <= 0) {
      this.wait += (1 + (w.rng.next() * 2 - 1) * Math.min(0.95, c.jitter)) / c.rate;
      if (this.spawnOne(w)) n++;
      if (n > 8) {
        this.wait = Math.max(this.wait, 0);
        break;
      }
    }
    this.spawned += n;
    return n;
  }

  private spawnOne(w: World): boolean {
    const pool = w.asteroids;
    if (pool.count >= pool.capacity - this.config.poolReserve) return false;
    const c = this.config;
    const size = pickSize(w, c.sizeWeights);
    if (size === null) return false;
    const rng = w.rng;
    const lo = Math.max(-MAX_STREAM_ANGLE, Math.min(c.angleRange[0], c.angleRange[1]));
    const hi = Math.min(MAX_STREAM_ANGLE, Math.max(c.angleRange[0], c.angleRange[1]));
    const ang = (rng.range(lo, hi) * Math.PI) / 180;
    const speed = rng.range(c.speedRange[0], c.speedRange[1]);
    const def = ASTEROID_SIZES[size];
    rockInit.size = size;
    rockInit.x = rng.range(c.xRange[0], c.xRange[1]);
    rockInit.y = -def.sprite / 2 - 1;
    rockInit.vx = Math.sin(ang) * speed;
    rockInit.vy = Math.cos(ang) * speed + w.scrollSpeed;
    rockInit.theme = c.theme;
    rockInit.hp = c.indestructibleChance > 0 && rng.next() < c.indestructibleChance ? 0 : undefined;
    return spawnRock(w, rockInit) !== null;
  }
}

const rockInit: RockInit = { size: 'small', x: 0, y: 0, vx: 0, vy: 0 };

function pickSize(w: World, weights: AsteroidStreamConfig['sizeWeights']): AsteroidSize | null {
  let total = 0;
  for (const s of ASTEROID_SIZE_IDS) total += Math.max(0, weights[s] ?? 0);
  if (total <= 0) return null;
  let roll = w.rng.next() * total;
  for (const s of ASTEROID_SIZE_IDS) {
    roll -= Math.max(0, weights[s] ?? 0);
    if (roll < 0) return s;
  }
  return 'small';
}

const streams = new WeakMap<World, AsteroidStream[]>();

/** Starts a stream the obstacles system ticks for you. Keep the handle to stop or retune it. */
export function spawnAsteroidStream(
  w: World,
  cfg: Partial<AsteroidStreamConfig> = {},
): AsteroidStream {
  const s = new AsteroidStream(cfg);
  let list = streams.get(w);
  if (!list) streams.set(w, (list = []));
  list.push(s);
  return s;
}

export function activeAsteroidStreams(w: World): readonly AsteroidStream[] {
  return streams.get(w) ?? [];
}

export function stopAllAsteroidStreams(w: World): void {
  const list = streams.get(w);
  if (!list) return;
  for (const s of list) s.stop();
  list.length = 0;
}

export function tickAsteroidStreams(w: World, dt: number): void {
  const list = streams.get(w);
  if (!list) return;
  for (let i = 0; i < list.length; i++) (list[i] as AsteroidStream).update(w, dt);
  for (let i = list.length - 1; i >= 0; i--)
    if (!(list[i] as AsteroidStream).active) list.splice(i, 1);
}

// ---------------------------------------------------------------------------
// Motion and breaking

/** Straight lines only: velocity changes come from forces (repulsor, black holes). */
export function updateAsteroids(w: World, dt: number): void {
  const items = w.asteroids.items;
  const n = w.asteroids.count;
  for (let i = 0; i < n; i++) {
    const a = items[i] as Asteroid;
    if (!a.active) continue;
    // Time bubbles (T33); exactly dt outside them.
    const rdt = dt * timeScaleAt(w, a.x, a.y);
    a.prevX = a.x;
    a.prevY = a.y;
    a.x += a.vx * rdt;
    a.y += a.vy * rdt;
    let rot = a.rot + a.spin * rdt;
    if (rot >= TAU) rot -= TAU;
    else if (rot < 0) rot += TAU;
    a.rot = rot;
  }
}

const sfxP = { id: 'asteroid_break', x: 0 as number | undefined };
const childInit: RockInit = { size: 'small', x: 0, y: 0, vx: 0, vy: 0 };

/** asteroidDestroyed: crunch sfx and, if the theme has a split rule, children. */
export function breakAsteroid(w: World, a: Asteroid): void {
  sfxP.id = 'asteroid_break';
  sfxP.x = a.x;
  w.events.emit('sfx', sfxP);
  const theme = asteroidTheme(a);
  const rule = ASTEROID_SIZES[a.size].split[theme];
  if (rule === null || rule.count <= 0) return;
  const childR = ASTEROID_SIZES[rule.into].r;
  const speed = Math.hypot(a.vx, a.vy);
  // Children split sideways across the parent's heading.
  let px = 1;
  let py = 0;
  if (speed > 1e-3) {
    px = -a.vy / speed;
    py = a.vx / speed;
  }
  const rng = w.rng;
  const n = rule.count;
  for (let i = 0; i < n; i++) {
    const side = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    const jitter = rng.range(-0.25, 0.25);
    const kick = rule.kick * (side + jitter * (n === 1 ? 4 : 1));
    childInit.size = rule.into;
    childInit.theme = theme;
    childInit.x = a.x + px * side * childR;
    childInit.y = a.y + py * side * childR;
    childInit.vx = a.vx * rule.inherit + px * kick + rng.range(-6, 6);
    childInit.vy = a.vy * rule.inherit + py * kick + rng.range(-6, 6);
    spawnRock(w, childInit);
  }
}

const attached = new WeakSet<World>();

/** Subscribes the obstacles module to a world's events. Idempotent; the system calls it. */
export function attachObstacles(w: World): void {
  if (attached.has(w)) return;
  attached.add(w);
  w.events.on('asteroidDestroyed', (e) => breakAsteroid(w, e.asteroid));
}

// ---------------------------------------------------------------------------
// Drawing

const drawOpts = { frame: 0, flash: false };
const warmed = new Set<RockTheme>();

/** Bakes the level's rocks before the first one appears, so a rock's first frame doesn't hitch. */
function warmTheme(theme: RockTheme): void {
  if (warmed.has(theme)) return;
  warmed.add(theme);
  warm(rockIdsForTheme(theme));
}

export const asteroidLayer: DrawLayer = {
  name: 'asteroids',
  z: 30,
  draw(w: World, r: Renderer, alpha: number) {
    warmTheme(levelRockTheme(w));
    const items = w.asteroids.items;
    const n = w.asteroids.count;
    for (let i = 0; i < n; i++) {
      const a = items[i] as Asteroid;
      if (!a.active) continue;
      const row = ROCK_IDS[a.variant] ?? (ROCK_IDS[0] as readonly string[]);
      const id = row[sizeIndex(a.size)] as string;
      drawOpts.frame = rockFrame(a.rot);
      drawOpts.flash = a.flashT > 0;
      r.sprite(id, a.prevX + (a.x - a.prevX) * alpha, a.prevY + (a.y - a.prevY) * alpha, drawOpts);
    }
    drawSlabs(w, r, alpha);
  },
};
