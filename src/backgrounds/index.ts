import type { DrawLayer, System, World } from '../sim/world';
import { flags } from '../debug/flags';
import type { Background } from './background';
import { installBackgroundSandbox, runBackgroundSandbox } from './sandbox';

export {
  Background,
  PARALLAX,
  SPEED_LINES,
  type SpeedLineStyle,
  STRIP_H,
  layerSeed,
  speedLineAlpha,
  speedLineLength,
  stripOffset,
} from './background';
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

installBackgroundSandbox();

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
      if (flags.sandbox) runBackgroundSandbox(w, bg);
      st.prevScrollY = w.scrollY;
      // Read every tick, so scroll ramps (T21's `scroll` event) move the parallax too.
      w.scrollY += w.scrollSpeed * dt;
    },
  };
  const layer: DrawLayer = {
    name: 'background',
    z: 0,
    draw(w, r, alpha) {
      const prev = st.world === w ? st.prevScrollY : w.scrollY;
      bg.draw(r.ctx, prev + (w.scrollY - prev) * alpha, w.time, r.height, w.scrollSpeed);
    },
  };
  return { system, layer };
}
