import type { DrawLayer, System, World } from '../sim/world';
import type { Background } from './background';

export { Background, PARALLAX, STRIP_H, layerSeed, stripOffset } from './background';
export {
  THEMES,
  THEME_IDS,
  getTheme,
  isThemeId,
  themeForLevel,
  type BackgroundTheme,
  type ThemeId,
} from './themes';
export type { SetPieceKind, SetPieceSpec } from './setpieces';

interface ScrollState {
  world: World | null;
  prevScrollY: number;
}

/**
 * The scroll system (owns `world.scrollY += scrollSpeed * dt`) and the z 0 draw layer
 * for one Background. They share the previous tick's scroll so the layer can interpolate.
 */
export function createBackgroundPair(bg: Background): { system: System; layer: DrawLayer } {
  const st: ScrollState = { world: null, prevScrollY: 0 };
  const system: System = {
    name: 'background',
    update(w, dt) {
      st.world = w;
      st.prevScrollY = w.scrollY;
      w.scrollY += w.scrollSpeed * dt;
    },
  };
  const layer: DrawLayer = {
    name: 'background',
    z: 0,
    draw(w, r, alpha) {
      const prev = st.world === w ? st.prevScrollY : w.scrollY;
      bg.draw(r.ctx, prev + (w.scrollY - prev) * alpha, w.time, r.height);
    },
  };
  return { system, layer };
}
