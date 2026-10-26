import { snes, type Rgb } from './color';
import type { NebulaSpec } from './nebula';
import type { SetPieceSpec } from './setpieces';
import type { StarSpec, StreakSpec } from './starfield';

export const THEME_IDS = ['kessler', 'ion', 'horizon', 'pulsar', 'armada', 'title'] as const;
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
      // A faint, distant accretion disk: the sector's black holes, writ large.
      {
        kind: 'disk',
        at: 70,
        x: 100,
        size: 120,
        colors: [snes(8, 0, 16), snes(48, 32, 24), snes(72, 56, 24), snes(88, 72, 32)],
      },
    ],
  },
  // Pink and gold stellar nursery: the nebula ramp warms from magenta to gold at its peaks.
  pulsar: {
    id: 'pulsar',
    scrollSpeed: 34,
    base: snes(16, 0, 24),
    stars: {
      colors: [snes(80, 56, 80), snes(128, 104, 120), snes(160, 152, 144)],
      density: 40,
      twinkle: 0.16,
    },
    nebula: {
      colors: [snes(40, 8, 40), snes(72, 24, 64), snes(88, 64, 48)],
      coverage: 0.65,
      patch: 128,
    },
    streaks: { head: snes(160, 136, 128), tail: snes(88, 56, 80), density: 1.6 },
    setPieces: [
      {
        kind: 'station',
        at: 40,
        x: 30,
        size: 80,
        colors: [snes(24, 16, 32), snes(64, 48, 72), snes(88, 80, 40)],
      },
      {
        kind: 'planet',
        at: 110,
        x: 140,
        size: 110,
        colors: [snes(24, 8, 24), snes(48, 24, 48), snes(72, 40, 56), snes(88, 64, 48)],
      },
    ],
  },
  // Sector 5: cold steel blues around a gas giant, with the Syndicate fleet at anchor.
  armada: {
    id: 'armada',
    scrollSpeed: 24,
    base: snes(8, 8, 24),
    stars: {
      colors: [snes(48, 56, 72), snes(88, 104, 120), snes(136, 152, 160)],
      density: 30,
      twinkle: 0.08,
    },
    nebula: {
      colors: [snes(16, 24, 40), snes(32, 48, 64), snes(56, 72, 88)],
      coverage: 0.4,
      patch: 160,
    },
    streaks: { head: snes(128, 144, 160), tail: snes(56, 72, 88), density: 1 },
    setPieces: [
      // Already filling the right side at launch; at 0.1× it stays in view the whole approach.
      {
        kind: 'giant',
        at: -100,
        x: 110,
        size: 180,
        colors: [snes(16, 16, 32), snes(32, 40, 56), snes(56, 64, 80), snes(88, 80, 72)],
      },
      {
        kind: 'fleet',
        at: 4,
        x: 0,
        size: 72,
        parallax: 0.2,
        colors: [snes(8, 8, 16), snes(40, 48, 64), snes(72, 40, 24)],
        light: snes(160, 40, 32),
      },
      {
        kind: 'fleet',
        at: 75,
        x: 0,
        size: 64,
        parallax: 0.2,
        colors: [snes(8, 8, 16), snes(40, 48, 64), snes(72, 40, 24)],
        light: snes(160, 40, 32),
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

const LEVEL_THEMES: Readonly<Record<string, ThemeId>> = {
  kessler: 'kessler',
  ionShoals: 'ion',
  eventHorizon: 'horizon',
  pulsarNursery: 'pulsar',
  armada: 'armada',
};

/** A campaign level id maps to its sector's theme, a theme id to itself, anything else to kessler. */
export function themeForLevel(levelId: string): ThemeId {
  return LEVEL_THEMES[levelId] ?? (isThemeId(levelId) ? levelId : 'kessler');
}
