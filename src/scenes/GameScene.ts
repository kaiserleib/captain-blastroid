import { Background, createBackgroundPair, isThemeId, themeForLevel } from '../backgrounds';
import { attachAudio, playSong, songOr } from '../audio';
import { PLAYFIELD_H } from '../engine/display';
import { randomSeedString } from '../engine/rng';
import type { Scene, ScenePointer } from '../engine/scene';
import { flags } from '../debug/flags';
import { Fx, FX_SPRITE_IDS } from '../gfx/fx';
import { warm } from '../gfx/spriteCache';
import { getLevel, levelIdForNumber } from '../content/levels';
import { directorSystem, levelLayers, startDirector } from '../game/director';
import { createHudDemoSystem, Hud, hudDemoEnabled } from '../game/hud';
import {
  initPlayer,
  installPlayerSandbox,
  playerLayer,
  playerSystem,
  warmPlayerSprites,
} from '../game/player';
import { computePlayerStats, getSave } from '../meta';
import { anomalyLayer, asteroidLayer, obstaclesSystem } from '../game/obstacles';
import { ENEMY_SPRITE_IDS, enemyLayers, enemySystem } from '../game/enemies';
import { bossIds, bossLayer, bossRegistration, bossSystem } from '../game/boss';
// Sector registrations (rosters, behaviors, bosses, scripts, level systems and layers).
import '../game/levels';
// Terrain (T34) runs inside the collision system; only its layer is listed here.
import { terrainLayer } from '../game/terrain';
import { input } from '../input';
import {
  PICKUP_SPRITE_IDS,
  pickupsLayer,
  pickupsSystem,
  podOverlayLayer,
  powerupFxLayer,
} from '../game/pickups';
import { dronesLayer, playerShotsLayer, WEAPON_SPRITE_IDS, weaponSystem } from '../game/weapons';
import type { Renderer } from '../gfx/renderer';
import { cleanupSystem } from '../sim/cleanup';
import { collisionSystem } from '../sim/collision';
import { bulletsSystem } from '../sim/motion';
import { createWorld, type DrawLayer, type System, type World } from '../sim/world';
import { flow } from './flow';

export interface GameSceneData {
  shipId?: string;
  pilotId?: string;
  levelId?: string;
  seed?: string;
}

const BAND_COLOR = '#100818';

let gameplayWarmed = false;
let levelFlagUsed = false;

/**
 * Bakes every gameplay sprite (flash and rotation sheets included) once, at
 * the first run's load, so the first capsule, boss or explosion doesn't hitch.
 */
function warmGameplaySprites(): void {
  if (gameplayWarmed || typeof document === 'undefined') return;
  gameplayWarmed = true;
  const bossSprites = bossIds().flatMap((id) => bossRegistration(id)?.spriteIds ?? []);
  warm([
    ...PICKUP_SPRITE_IDS,
    ...WEAPON_SPRITE_IDS,
    ...ENEMY_SPRITE_IDS,
    ...bossSprites,
    ...FX_SPRITE_IDS,
  ]);
}
const PLAYFIELD_COLOR = '#000000';
const PLACEHOLDER_SHIP_COLOR = '#3868f8';

export class GameScene implements Scene {
  world!: World;
  /** T15 picks the level's theme with `background.setTheme(level.theme, seed)`. */
  readonly background = new Background();
  private readonly bg = createBackgroundPair(this.background);
  readonly fx = new Fx();
  readonly hud = new Hud();

  /**
   * Fixed order. Each ticket inserts its system at its slot:
   * input → player → weapons → enemies → boss → bullets → obstacles →
   * pickups → collision → cleanup → director → fx
   */
  readonly systems: System[] = [
    // Owns world.scrollY (T07).
    this.bg.system,
    input.system,
    playerSystem, // player (T08)
    weaponSystem, // weapons (T09)
    enemySystem, // enemies (T11)
    bossSystem, // boss (T16)
    bulletsSystem, // bullets (T03)
    obstaclesSystem, // obstacles (T10)
    pickupsSystem, // pickups (T12)
    collisionSystem, // collision (T03)
    cleanupSystem, // cleanup (T03)
    directorSystem, // director (T15)
    this.fx.system, // fx (T13)
  ];

  /**
   * Sorted by z on construction, so append in any order. z: background 0,
   * terrain 5, anomalies 10, pickups 20, asteroids 30, enemies 40, enemy shots 50,
   * player shots 55, player 60, fx 70, stick 95, HUD 100.
   */
  readonly layers: DrawLayer[] = [
    this.bg.layer,
    input.stickLayer,
    pickupsLayer,
    podOverlayLayer,
    powerupFxLayer,
    ...this.fx.layers,
    this.hud.layer,
    playerLayer,
    anomalyLayer,
    asteroidLayer,
    playerShotsLayer,
    dronesLayer,
    ...enemyLayers,
    bossLayer,
    terrainLayer,
  ];

  private readonly hasPlayerLayer: boolean;
  /** `registerLevelLayer` layers of the level playing now (swapped in by enter). */
  private levelLayers: readonly DrawLayer[] = [];
  // Acted on after the tick's systems, never mid-tick (T17).
  private pauseWanted = false;
  private runOver: boolean | null = null;

  constructor() {
    if (hudDemoEnabled) this.systems.push(createHudDemoSystem());
    this.layers.sort((a, b) => a.z - b.z);
    this.hasPlayerLayer = this.layers.some((l) => l.name === 'player');
  }

  enter(data?: unknown): void {
    const d = (data ?? {}) as GameSceneData;
    const save = getSave();
    const shipId = d.shipId ?? save.selectedShip;
    const pilotId = d.pilotId ?? save.selectedPilot;
    // `?level=N` (dev) wins over the hangar's choice so any sector is one URL away.
    // `?level=N` picks the first launch only, so NEXT SECTOR / RETRY still go where they ask.
    const flagLevel = levelFlagUsed ? null : levelIdForNumber(flags.level);
    levelFlagUsed = true;
    const levelId = flagLevel ?? d.levelId;
    this.world = createWorld(d.seed ?? flags.seed ?? randomSeedString(), {
      ...d,
      shipId,
      pilotId,
      levelId,
    });
    const w = this.world;
    initPlayer(w, computePlayerStats(save, shipId, pilotId));
    warmPlayerSprites(shipId);
    warmGameplaySprites();
    installPlayerSandbox();
    const level = getLevel(w.run.levelId);
    const theme = isThemeId(level.theme) ? level.theme : themeForLevel(w.run.levelId);
    this.background.setTheme(theme, w.run.seed);
    this.background.prebuild();
    w.scrollSpeed = level.scrollSpeed;
    this.useLevelLayers(levelLayers(level.id));
    startDirector(w, level, { startT: flags.t ?? 0, debugLoadout: true });
    // Detached by exit()'s events.clear().
    attachAudio(this.world.events, { bossSong: level.bossMusic ?? 'boss' });
    this.fx.attach(this.world);
    this.hud.attach(w);
    playSong(songOr(level.music, 'level1'));
    this.pauseWanted = false;
    this.runOver = null;
    w.events.on('pauseRequested', () => {
      this.pauseWanted = true;
    });
    w.events.on('runOver', (e) => {
      this.runOver ??= e.victory;
    });
  }

  private useLevelLayers(next: readonly DrawLayer[]): void {
    const old = this.levelLayers;
    for (let i = this.layers.length - 1; i >= 0; i--) {
      if (old.includes(this.layers[i] as DrawLayer)) this.layers.splice(i, 1);
    }
    this.levelLayers = next;
    this.layers.push(...next);
    // Stable sort: equal z keeps the base layers first.
    this.layers.sort((a, b) => a.z - b.z);
  }

  /** Opens the pause overlay now (visibility loss: no tick will run until the page is back). */
  pauseNow(): void {
    this.pauseWanted = false;
    if (this.runOver === null) flow.pause(this);
  }

  exit(): void {
    this.world.events.clear();
  }

  onPointer(e: ScenePointer): void {
    this.hud.onPointer(e);
  }

  update(dt: number): void {
    const w = this.world;
    w.tick++;
    w.time += dt;
    for (let i = 0; i < this.systems.length; i++) this.systems[i]?.update(w, dt);
    if (this.runOver !== null) {
      flow.results({ run: w.run, time: w.time, victory: this.runOver, abandoned: false });
    } else if (this.pauseWanted) {
      this.pauseNow();
    }
  }

  render(r: Renderer, alpha: number): void {
    const w = this.world;
    // HUD bands span the whole buffer; the playfield is the 400 px strip inside.
    r.ctx.fillStyle = BAND_COLOR;
    r.ctx.fillRect(0, 0, r.width, r.height);
    r.rect(0, 0, w.width, PLAYFIELD_H, PLAYFIELD_COLOR);

    for (let i = 0; i < this.layers.length; i++) this.layers[i]?.draw(w, r, alpha);

    // Placeholder until T08's player layer exists, so scaling is visible.
    if (!this.hasPlayerLayer) {
      const p = w.player;
      r.rect(p.x - 6, p.y - 8, 12, 16, PLACEHOLDER_SHIP_COLOR);
    }
  }
}
