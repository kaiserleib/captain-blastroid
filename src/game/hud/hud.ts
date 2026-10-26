import type { Layout } from '../../engine/display';
import type { NoPayload } from '../../engine/events';
import type { ScenePointer } from '../../engine/scene';
import type { Renderer } from '../../gfx/renderer';
import { input } from '../../input';
import type { DrawLayer, World } from '../../sim/world';
import './hud.sprites';
import {
  computeHudLayout,
  defaultViewport,
  inRect,
  viewportFromLayout,
  type HudLayout,
  type HudViewport,
} from './layout';
import { HudState } from './state';
import {
  drawBand,
  drawBossBar,
  drawPauseButton,
  drawSalvage,
  drawScore,
  drawShield,
  drawTimers,
  drawWarning,
  drawWeapons,
  formatChain,
  formatCount,
  formatScore,
  MAX_SLOTS,
  NumberText,
} from './widgets';

const NO_PAYLOAD: NoPayload = {};

let viewport: HudViewport | null = null;
let viewportVersion = 0;

/** main.ts forwards every display layout here so the HUD knows safe areas and CSS scale. */
export function setHudViewport(layout: Layout): void {
  viewport = viewportFromLayout(layout);
  viewportVersion++;
}

/**
 * In-game HUD: reads the world, never writes it. GameScene registers `layer`,
 * calls `attach(world)` on enter and forwards pointers to `onPointer`.
 */
export class Hud {
  readonly state = new HudState();
  private world: World | null = null;
  private layout: HudLayout | null = null;
  // What the cached layout was built from; -1 version = the fallback viewport.
  private keyVersion = -2;
  private keyH = 0;
  private keyOy = 0;
  private readonly score = new NumberText(formatScore);
  private readonly salvage = new NumberText(formatCount);
  private readonly chain = new NumberText(formatChain);

  attach(w: World): void {
    this.world = w;
    this.state.reset();
    // Listeners are dropped by the scene's events.clear() on exit.
    w.events.on('bossSpawned', (e) => this.state.onBossSpawned(e.defId));
    w.events.on('bossDefeated', () => this.state.onBossDefeated());
    w.events.on('bossWarning', () => this.state.onBossWarning());
  }

  /** The last layout drawn (null before the first frame). */
  get currentLayout(): HudLayout | null {
    return this.layout;
  }

  /** Returns true when the HUD consumed the pointer (pause button). */
  onPointer(e: ScenePointer): boolean {
    const l = this.layout;
    const w = this.world;
    if (!l || !w || e.type !== 'down' || !inRect(l.pauseHit, e.x, e.y)) return false;
    // The touch also started a stick; cancel it so the ship doesn't lurch on resume.
    input.releaseStick();
    w.events.emit('pauseRequested', NO_PAYLOAD);
    return true;
  }

  readonly layer: DrawLayer = {
    name: 'hud',
    z: 100,
    draw: (w: World, r: Renderer) => this.draw(w, r),
  };

  private layoutFor(r: Renderer): HudLayout {
    const usable =
      viewport !== null && viewport.height === r.height && viewport.playfieldOffsetY === r.offsetY;
    const version = usable ? viewportVersion : -1;
    if (
      this.layout &&
      version === this.keyVersion &&
      r.height === this.keyH &&
      r.offsetY === this.keyOy
    ) {
      return this.layout;
    }
    this.keyVersion = version;
    this.keyH = r.height;
    this.keyOy = r.offsetY;
    this.layout = computeHudLayout(
      usable && viewport ? viewport : defaultViewport(r.width, r.height, r.offsetY),
    );
    return this.layout;
  }

  draw(w: World, r: Renderer): void {
    const l = this.layoutFor(r);
    const st = this.state;
    st.update(w);
    const p = w.player;
    const run = w.run;

    // The HUD works in buffer coordinates and never shakes.
    const oy = r.offsetY;
    const sx = r.shakeX;
    const sy = r.shakeY;
    r.offsetY = 0;
    r.shakeX = 0;
    r.shakeY = 0;

    if (l.topBand) drawBand(r, l.topBandRect, l.pfTop - 1, l.pfTop - 2);
    if (l.bottomBand) drawBand(r, l.bottomBandRect, l.pfBottom, l.pfBottom + 1);

    if (st.warningT > 0) drawWarning(r, l, st);
    if (st.bossActive && st.bossMaxHp > 0) drawBossBar(r, l, st);

    const ty = l.topRowY;
    drawShield(r, st, l.left, ty + 1, p.shield, p.maxShield);
    drawScore(
      r,
      l.width / 2,
      ty,
      this.score.get(run.score),
      run.chain,
      this.chain.get(run.chain),
      l.topBand,
    );
    drawSalvage(r, l.pauseIcon.x - 5, ty, this.salvage.get(run.salvage));
    drawPauseButton(r, l.pauseIcon);

    const by = l.bottomRowY;
    drawWeapons(r, l.left, by, p.weapons, Math.min(MAX_SLOTS, p.maxWeaponSlots));
    drawTimers(r, l.right, by, p.magnetT, st.magnetMax, p.repulsorT, st.repulsorMax);

    r.offsetY = oy;
    r.shakeX = sx;
    r.shakeY = sy;
  }
}
