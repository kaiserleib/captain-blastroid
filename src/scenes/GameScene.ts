import { Background, createBackgroundPair, themeForLevel } from '../backgrounds';
import { attachAudio, playSong } from '../audio';
import { PLAYFIELD_H } from '../engine/display';
import { randomSeedString } from '../engine/rng';
import type { Scene, ScenePointer } from '../engine/scene';
import { flags } from '../debug/flags';
import { Fx } from '../gfx/fx';
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
import { input } from '../input';
import { pickupsLayer, pickupsSystem, powerupFxLayer } from '../game/pickups';
import { dronesLayer, playerShotsLayer, weaponSystem } from '../game/weapons';
import type { Renderer } from '../gfx/renderer';
import { cleanupSystem } from '../sim/cleanup';
import { collisionSystem } from '../sim/collision';
import { bulletsSystem } from '../sim/motion';
import { createWorld, type DrawLayer, type System, type World } from '../sim/world';

export interface GameSceneData {
  shipId?: string;
  pilotId?: string;
  levelId?: string;
  seed?: string;
}

const BAND_COLOR = '#100818';
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
    // enemies (T11)
    // boss (T16)
    bulletsSystem, // bullets (T03)
    obstaclesSystem, // obstacles (T10)
    pickupsSystem, // pickups (T12)
    collisionSystem, // collision (T03)
    cleanupSystem, // cleanup (T03)
    // director (T15)
    this.fx.system, // fx (T13)
  ];

  /**
   * Sorted by z on construction, so append in any order. z: background 0,
   * anomalies 10, pickups 20, asteroids 30, enemies 40, enemy shots 50,
   * player shots 55, player 60, fx 70, stick 95, HUD 100.
   */
  readonly layers: DrawLayer[] = [
    this.bg.layer,
    input.stickLayer,
    pickupsLayer,
    powerupFxLayer,
    ...this.fx.layers,
    this.hud.layer,
    playerLayer,
    anomalyLayer,
    asteroidLayer,
    playerShotsLayer,
    dronesLayer,
  ];

  private readonly hasPlayerLayer: boolean;

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
    this.world = createWorld(d.seed ?? flags.seed ?? randomSeedString(), { ...d, shipId, pilotId });
    const w = this.world;
    initPlayer(w, computePlayerStats(save, shipId, pilotId));
    warmPlayerSprites(shipId);
    installPlayerSandbox();
    this.background.setTheme(themeForLevel(w.run.levelId), w.run.seed);
    this.background.prebuild();
    // Until T15's director sets the level's scroll speed.
    if (w.scrollSpeed === 0) w.scrollSpeed = this.background.theme.scrollSpeed;
    // Detached by exit()'s events.clear().
    attachAudio(this.world.events);
    this.fx.attach(this.world);
    this.hud.attach(w);
    playSong('level1');
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
