import { flags } from '../../debug/flags';
import { createRng, type Rng } from '../../engine/rng';
import type { GameEvents } from '../../engine/events';
import { getSettings } from '../../meta';
import { platform, type HapticKind } from '../../platform';
import { getEnemyDef } from '../../sim/spawn';
import type { DrawLayer, System, World } from '../../sim/world';
import { FX } from '../palette';
import type { Renderer } from '../renderer';
import { warm } from '../spriteCache';
import { Explosions } from './explosions';
import { FX_SPRITE_IDS, type BoomSize } from './fx.sprites';
import { requestHitstop } from './hitstop';
import { PK, ParticlePool, RAMP } from './particles';
import { ScorePopups } from './popups';
import { installFxSandbox } from './sandbox';
import { Shake, shakeScale } from './shake';
import { Toasts } from './toasts';

export const FX_Z = 70;
/** After fx and before the stick (95), so the stick and HUD never shake. */
export const FX_OVERLAY_Z = 90;

const BOSS_CHAIN_TIME = 2;
const BOSS_CHAIN_POPS = 16;
const FLASH_ALPHA = 0.85;

export interface FxOptions {
  /** Default: `platform.haptics.impact` when `settings.haptics` is on. */
  haptic?: (kind: HapticKind) => void;
  /** Default: from `settings.screenShake`. */
  shakeScale?: () => number;
  /** Default: `requestHitstop` (gated, wired to the loop by main.ts). */
  hitstop?: (dur: number) => void;
}

function defaultHaptic(kind: HapticKind): void {
  if (getSettings().haptics) platform.haptics.impact(kind);
}

function defaultShakeScale(): number {
  return shakeScale(getSettings().screenShake);
}

export function boomSizeFor(r: number): BoomSize {
  return r <= 7 ? 16 : r <= 13 ? 32 : 48;
}

/**
 * Listens to world events and draws the juice. Never writes world state and
 * never touches `world.rng`: it has its own RNG, so toggling FX can't change
 * the sim.
 */
export class Fx {
  readonly particles = new ParticlePool();
  readonly shake = new Shake();
  readonly toasts = new Toasts();
  readonly popups = new ScorePopups();
  readonly explosions: Explosions;
  /** Dev-only per-tick hook (sandbox storms). */
  sandboxTick: ((w: World, dt: number) => void) | null = null;

  private rng: Rng = createRng('fx');
  private world: World | null = null;
  private offs: (() => void)[] = [];
  private flashT = 0;
  private flashDur = 0;
  private tick = 0;
  private readonly sfxP = { id: '', x: 0 };
  private readonly haptic: (kind: HapticKind) => void;
  private readonly shakeScale: () => number;
  private readonly hitstop: (dur: number) => void;

  readonly system: System = {
    name: 'fx',
    update: (w, dt) => this.update(w, dt),
  };

  readonly layers: readonly DrawLayer[] = [
    {
      // Applies shake before the background (z 0) draws.
      name: 'fxShake',
      z: -1,
      draw: (_w, r) => {
        r.shakeX = this.shake.x;
        r.shakeY = this.shake.y;
      },
    },
    { name: 'fx', z: FX_Z, draw: (_w, r, alpha) => this.draw(r, alpha) },
    {
      name: 'fxOverlay',
      z: FX_OVERLAY_Z,
      draw: (w, r) => {
        r.shakeX = 0;
        r.shakeY = 0;
        this.toasts.draw(r, w.width);
      },
    },
  ];

  constructor(opts: FxOptions = {}) {
    this.haptic = opts.haptic ?? defaultHaptic;
    this.shakeScale = opts.shakeScale ?? defaultShakeScale;
    this.hitstop = opts.hitstop ?? ((d) => void requestHitstop(d));
    this.explosions = new Explosions(this.particles, () => this.rng);
  }

  /** Subscribes to `w.events` and resets all effects. Returns an unsubscribe. */
  attach(w: World): () => void {
    this.detach();
    this.world = w;
    this.rng = createRng(`${w.run.seed}#fx`);
    this.particles.clear();
    this.explosions.clear();
    this.shake.reset();
    this.toasts.clear();
    this.popups.clear();
    this.flashT = 0;
    // Bake explosion sheets now so the first kill doesn't hitch.
    if (typeof document !== 'undefined') warm(FX_SPRITE_IDS);
    const ev = w.events;
    this.offs = [
      ev.on('enemyHit', this.onEnemyHit),
      ev.on('enemyKilled', this.onEnemyKilled),
      ev.on('asteroidDestroyed', this.onAsteroidDestroyed),
      ev.on('playerHit', this.onPlayerHit),
      ev.on('playerDied', this.onPlayerDied),
      ev.on('pickupCollected', this.onPickup),
      ev.on('bossDefeated', this.onBossDefeated),
      ev.on('shake', (p) => this.shake.add(p.mag, p.dur)),
      ev.on('hitstop', (p) => this.hitstop(p.dur)),
      ev.on('haptic', (p) => this.haptic(p.kind)),
      ev.on('toast', (p) => this.toasts.push(p.text)),
    ];
    if (flags.sandbox) installFxSandbox(this, () => this.world);
    return () => this.detach();
  }

  detach(): void {
    for (const off of this.offs) off();
    this.offs = [];
    this.world = null;
  }

  explode(x: number, y: number, size: BoomSize, vx = 0, vy = 0): void {
    this.explosions.explode(x, y, size, vx, vy);
  }

  /** Full-playfield white flash that fades over `dur` seconds. */
  flash(dur: number): void {
    if (dur > this.flashT) {
      this.flashT = dur;
      this.flashDur = dur;
    }
  }

  update(w: World, dt: number): void {
    if (this.world !== w) return;
    this.tick++;
    this.sandboxTick?.(w, dt);
    this.particles.update(dt);
    this.explosions.update(dt);
    this.popups.update(dt);
    this.toasts.update(dt);
    this.shake.update(dt, this.rng, this.shakeScale());
    if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
  }

  /** `alpha` is the render interpolation; FX extrapolate back from the latest tick (T18). */
  draw(r: Renderer, alpha = 1): void {
    // Seconds behind the latest tick this frame shows (0 at alpha 1).
    const back = (1 - alpha) / 60;
    this.particles.drawSmoke(r, back);
    this.explosions.draw(r, back);
    this.particles.draw(r, this.tick, back);
    this.popups.draw(r, this.tick);
    if (this.flashT > 0 && this.world) {
      const ctx = r.ctx;
      ctx.globalAlpha = FLASH_ALPHA * (this.flashT / this.flashDur);
      r.rect(-8, -8, this.world.width + 16, this.world.height + 16, FX.white);
      ctx.globalAlpha = 1;
    }
  }

  // Listeners copy what they need off the (reused) payload and never keep it.

  private readonly onEnemyHit = (p: GameEvents['enemyHit']): void => {
    const e = p.enemy;
    // Shots come from below, so sparks spray back down and out.
    const y = e.y + e.r * 0.5;
    for (let i = 0; i < 2; i++) {
      const a = Math.PI * 0.5 + this.rng.range(-1.1, 1.1);
      const s = this.rng.range(70, 140);
      this.particles.spawn(
        PK.spark,
        e.x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        this.rng.range(0.1, 0.2),
        RAMP.hot,
        1,
        0.02,
      );
    }
  };

  private readonly onEnemyKilled = (p: GameEvents['enemyKilled']): void => {
    const e = p.enemy;
    const x = e.x;
    const y = e.y;
    const size = e.isBoss ? 48 : boomSizeFor(e.r);
    this.explode(x, y, size, e.vx, e.vy);
    const w = this.world;
    if (w) {
      this.sfxP.id = size === 16 ? 'enemy_die_s' : 'enemy_die_m';
      this.sfxP.x = x;
      w.events.emit('sfx', this.sfxP);
    }
    if (size === 32) this.shake.add(1.5, 0.15);
    else if (size === 48) {
      this.shake.add(3, 0.3);
      this.hitstop(0.05);
    }
    if (p.byPlayer && w && w.run.chain >= 2) {
      const base = getEnemyDef(e.defId).score ?? 0;
      if (base > 0) this.popups.spawn(x, y - e.r, base * w.run.chain);
    }
  };

  private readonly onAsteroidDestroyed = (p: GameEvents['asteroidDestroyed']): void => {
    const a = p.asteroid;
    const big = a.size === 'large' ? 2 : a.size === 'medium' ? 1 : 0;
    const rng = this.rng;
    const pp = this.particles;
    const chunks = 4 + big * 3;
    for (let i = 0; i < chunks; i++) {
      const ang = rng.range(0, Math.PI * 2);
      const d = rng.range(0, a.r * 0.6);
      const s = rng.range(30, 70 + big * 20);
      pp.spawn(
        PK.chunk,
        a.x + Math.cos(ang) * d,
        a.y + Math.sin(ang) * d,
        a.vx + Math.cos(ang) * s,
        a.vy + Math.sin(ang) * s,
        rng.range(0.4, 0.8),
        RAMP.rock,
        rng.int(1, 2 + big),
        0.35,
      );
    }
    for (let i = 0; i < 2 + big; i++) {
      const ang = rng.range(0, Math.PI * 2);
      const d = rng.range(0, a.r * 0.5);
      pp.spawn(
        PK.smoke,
        a.x + Math.cos(ang) * d,
        a.y + Math.sin(ang) * d,
        a.vx * 0.5 + Math.cos(ang) * 10,
        a.vy * 0.5 + Math.sin(ang) * 10,
        rng.range(0.4, 0.7),
        RAMP.rock,
        1,
        0.2,
      );
    }
    for (let i = 0; i < 4 + big * 2; i++) {
      const ang = rng.range(0, Math.PI * 2);
      const s = rng.range(50, 110);
      pp.spawn(
        PK.debris,
        a.x,
        a.y,
        a.vx + Math.cos(ang) * s,
        a.vy + Math.sin(ang) * s,
        rng.range(0.3, 0.6),
        RAMP.rock,
        1,
        0.2,
      );
    }
    // A brief impact flash keeps rock kills from reading as soft.
    if (big > 0) {
      pp.spawn(PK.ring, a.x, a.y, a.vx, a.vy, 0.16, RAMP.rock, a.r * 0.4, 1, a.r * 4);
      this.shake.add(big, 0.12 * big);
    }
  };

  private readonly onPlayerHit = (p: GameEvents['playerHit']): void => {
    const w = this.world;
    if (!w || !w.player.alive) return;
    const pl = w.player;
    // Shield shatter: a bright double ring and glassy shards.
    this.particles.spawn(PK.ring, pl.x, pl.y, 0, 0, 0.3, RAMP.shield, 8, 1, 70);
    this.particles.spawn(PK.ring, pl.x, pl.y, 0, 0, 0.2, RAMP.shield, 4, 1, 40);
    const n = p.shieldLeft > 0 ? 10 : 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.rng.range(-0.2, 0.2);
      const s = this.rng.range(60, 120);
      this.particles.spawn(
        PK.debris,
        pl.x + Math.cos(a) * 8,
        pl.y + Math.sin(a) * 8,
        Math.cos(a) * s,
        Math.sin(a) * s,
        this.rng.range(0.25, 0.45),
        RAMP.shield,
        this.rng.chance(0.4) ? 2 : 1,
        0.1,
      );
    }
  };

  private readonly onPlayerDied = (): void => {
    const w = this.world;
    if (!w) return;
    const x = w.player.x;
    const y = w.player.y;
    this.explode(x, y, 48);
    this.explosions.chain(x, y, { radius: 14, count: 4, duration: 0.6 });
    for (let i = 0; i < 16; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const s = this.rng.range(40, 140);
      this.particles.spawn(
        PK.chunk,
        x,
        y,
        Math.cos(a) * s,
        Math.sin(a) * s,
        this.rng.range(0.6, 1.1),
        i & 1 ? RAMP.shield : RAMP.ember,
        this.rng.int(1, 2),
        0.3,
      );
    }
    this.hitstop(0.12);
  };

  private readonly onPickup = (p: GameEvents['pickupCollected']): void => {
    const pk = p.pickup;
    for (let i = 0; i < 5; i++) {
      this.particles.spawn(
        PK.sparkle,
        pk.x + this.rng.range(-6, 6),
        pk.y + this.rng.range(-6, 6),
        this.rng.range(-10, 10),
        this.rng.range(-40, -15),
        this.rng.range(0.3, 0.5),
        RAMP.gold,
        2,
        0.2,
      );
    }
    if (pk.kind !== 'salvage') this.haptic('light');
  };

  private readonly onBossDefeated = (p: GameEvents['bossDefeated']): void => {
    this.flash(0.15);
    this.shake.add(2, BOSS_CHAIN_TIME);
    this.explosions.chain(p.x, p.y, {
      radius: 36,
      count: BOSS_CHAIN_POPS,
      duration: BOSS_CHAIN_TIME,
      onDone: this.bossFinale,
    });
  };

  private readonly bossFinale = (x: number, y: number): void => {
    this.explode(x - 14, y + 8, 48);
    this.explode(x + 14, y - 6, 48);
    this.flash(0.6);
    this.shake.add(4, 0.6);
    this.hitstop(0.12);
    this.haptic('heavy');
  };
}
