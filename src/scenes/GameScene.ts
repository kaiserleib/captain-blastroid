import { Background, createBackgroundPair, themeForLevel } from '../backgrounds';
import { attachAudio, playSong } from '../audio';
import { PLAYFIELD_H } from '../engine/display';
import { randomSeedString } from '../engine/rng';
import type { Scene } from '../engine/scene';
import { flags } from '../debug/flags';
import { input } from '../input';
import type { Renderer } from '../gfx/renderer';
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

  /**
   * Fixed order. Each ticket inserts its system at its slot:
   * input → player → weapons → enemies → boss → bullets → obstacles →
   * pickups → collision → cleanup → director → fx
   */
  readonly systems: System[] = [
    // Owns world.scrollY (T07).
    this.bg.system,
    input.system,
    // player (T08)
    // weapons (T09)
    // enemies (T11)
    // boss (T16)
    // bullets (T03)
    // obstacles (T10)
    // pickups (T12)
    // collision (T03)
    // cleanup (T03)
    // director (T15)
    // fx (T13)
  ];

  /**
   * Sorted by z on construction, so append in any order. z: background 0,
   * anomalies 10, pickups 20, asteroids 30, enemies 40, enemy shots 50,
   * player shots 55, player 60, fx 70, stick 95, HUD 100.
   */
  readonly layers: DrawLayer[] = [this.bg.layer, input.stickLayer];

  private readonly hasPlayerLayer: boolean;

  constructor() {
    this.layers.sort((a, b) => a.z - b.z);
    this.hasPlayerLayer = this.layers.some((l) => l.name === 'player');
  }

  enter(data?: unknown): void {
    const d = (data ?? {}) as GameSceneData;
    this.world = createWorld(d.seed ?? flags.seed ?? randomSeedString(), d);
    const w = this.world;
    this.background.setTheme(themeForLevel(w.run.levelId), w.run.seed);
    this.background.prebuild();
    // Until T15's director sets the level's scroll speed.
    if (w.scrollSpeed === 0) w.scrollSpeed = this.background.theme.scrollSpeed;
    // Detached by exit()'s events.clear().
    attachAudio(this.world.events);
    playSong('level1');
  }

  exit(): void {
    this.world.events.clear();
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
