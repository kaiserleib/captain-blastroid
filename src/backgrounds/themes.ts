import { snes, type Rgb } from './color';
import type { NebulaSpec } from './nebula';
import type { SetPieceSpec } from './setpieces';
import type { StarSpec, StreakSpec } from './starfield';

export const THEME_IDS = ['kessler', 'ion', 'horizon', 'pulsar', 'title'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export interface BackgroundTheme {
  id: ThemeId;
  /** Nominal px/s; T15's level def sets the real `world.scrollSpeed`. */
  scrollSpeed: number;
  /** Fills the whole buffer, HUD bands included. */
  base: Rgb;
  stars: StarSpec;
  nebula: NebulaSpec;
  streaks: StreakSpec;
  setPieces: readonly SetPieceSpec[];
}

/** Fills (base, nebula, set pieces) stay at or under this HSV value, per art-direction rule 7. */
export const MAX_FILL_VALUE = 0.35;
/** Single-pixel stars and streaks may be brighter, but stay well under bullet/ship brightness. */
export const MAX_POINT_VALUE = 0.65;

export const THEMES: Readonly<Record<ThemeId, BackgroundTheme>> = {
  // Level 1: warm gray-brown dust and a dim amber nebula.
  kessler: {
    id: 'kessler',
    scrollSpeed: 30,
    base: snes(16, 8, 8),
    stars: {
      colors: [snes(64, 56, 48), snes(104, 96, 80), snes(160, 152, 128)],
      density: 30,
      twinkle: 0.08,
    },
    nebula: {
      colors: [snes(40, 24, 16), snes(64, 40, 24), snes(88, 56, 32)],
      coverage: 0.5,
      patch: 160,
    },
    streaks: { head: snes(136, 120, 104), tail: snes(72, 64, 56), density: 1.2 },
    setPieces: [
      {
        kind: 'belt',
        at: 12,
        x: 0,
        size: 56,
        colors: [snes(40, 32, 24), snes(56, 48, 40), snes(80, 64, 48), snes(88, 80, 64)],
      },
      {
        kind: 'planet',
        at: 70,
        x: 120,
        size: 150,
        colors: [snes(24, 16, 16), snes(40, 24, 24), snes(64, 40, 32), snes(88, 64, 40)],
      },
      {
        kind: 'station',
        at: 150,
        x: 18,
        size: 64,
        colors: [snes(24, 24, 24), snes(56, 48, 48), snes(88, 72, 32)],
      },
    ],
  },
  ion: {
    id: 'ion',
    scrollSpeed: 32,
    base: snes(0, 8, 16),
    stars: {
      colors: [snes(40, 64, 72), snes(72, 104, 112), snes(120, 160, 160)],
      density: 32,
      twinkle: 0.1,
    },
    nebula: {
      colors: [snes(0, 32, 40), snes(8, 56, 64), snes(24, 80, 88)],
      coverage: 0.55,
      patch: 128,
    },
    streaks: { head: snes(112, 152, 152), tail: snes(48, 80, 88), density: 1.3 },
    setPieces: [
      {
        kind: 'planet',
        at: 30,
        x: -170,
        size: 130,
        colors: [snes(0, 16, 24), snes(16, 40, 48), snes(32, 64, 72), snes(56, 88, 88)],
      },
      {
        kind: 'station',
        at: 120,
        x: 150,
        size: 72,
        colors: [snes(16, 24, 32), snes(40, 64, 72), snes(88, 88, 40)],
      },
    ],
  },
  horizon: {
    id: 'horizon',
    scrollSpeed: 30,
    base: snes(8, 0, 16),
    stars: {
      colors: [snes(56, 40, 72), snes(96, 80, 112), snes(152, 136, 160)],
      density: 24,
      twinkle: 0.08,
    },
    nebula: {
      colors: [snes(24, 8, 40), snes(48, 16, 64), snes(72, 32, 88)],
      coverage: 0.45,
      patch: 160,
    },
    streaks: { head: snes(136, 112, 152), tail: snes(64, 48, 80), density: 1 },
    setPieces: [
      {
        kind: 'planet',
        at: 20,
        x: -40,
        size: 160,
        colors: [snes(8, 0, 16), snes(24, 8, 32), snes(40, 24, 56), snes(64, 48, 80)],
      },
      {
        kind: 'belt',
        at: 130,
        x: 0,
        size: 48,
        colors: [snes(24, 16, 32), snes(40, 32, 56), snes(64, 48, 80), snes(88, 72, 88)],
      },
    ],
  },
  pulsar: {
    id: 'pulsar',
    scrollSpeed: 34,
    base: snes(0, 0, 16),
    stars: {
      colors: [snes(56, 64, 96), snes(104, 112, 144), snes(152, 160, 160)],
      density: 40,
      twinkle: 0.16,
    },
    nebula: {
      colors: [snes(8, 16, 48), snes(16, 32, 72), snes(48, 64, 88)],
      coverage: 0.5,
      patch: 128,
    },
    streaks: { head: snes(144, 152, 160), tail: snes(64, 72, 104), density: 1.6 },
    setPieces: [
      {
        kind: 'station',
        at: 40,
        x: 30,
        size: 80,
        colors: [snes(16, 16, 40), snes(48, 56, 88), snes(88, 88, 72)],
      },
      {
        kind: 'planet',
        at: 110,
        x: 140,
        size: 110,
        colors: [snes(8, 8, 32), snes(24, 32, 64), snes(48, 56, 80), snes(80, 88, 88)],
      },
    ],
  },
  // Menus: a slow drift with a planet already in view.
  title: {
    id: 'title',
    scrollSpeed: 8,
    base: snes(8, 8, 24),
    stars: {
      colors: [snes(56, 56, 88), snes(96, 96, 128), snes(152, 152, 160)],
      density: 34,
      twinkle: 0.14,
    },
    nebula: {
      colors: [snes(24, 16, 48), snes(40, 32, 72), snes(64, 48, 88)],
      coverage: 0.5,
      patch: 160,
    },
    streaks: { head: snes(128, 128, 152), tail: snes(56, 56, 88), density: 0.8 },
    setPieces: [
      {
        kind: 'planet',
        at: -650,
        x: 70,
        size: 170,
        colors: [snes(8, 8, 32), snes(24, 24, 56), snes(40, 40, 72), snes(64, 56, 88)],
      },
    ],
  },
};

export function isThemeId(id: string): id is ThemeId {
  return (THEME_IDS as readonly string[]).includes(id);
}

export function getTheme(id: ThemeId): BackgroundTheme {
  return THEMES[id];
}

/** Until T15's level defs carry a `theme`, a level id that names a theme uses it; anything else gets kessler. */
export function themeForLevel(levelId: string): ThemeId {
  return isThemeId(levelId) ? levelId : 'kessler';
}
