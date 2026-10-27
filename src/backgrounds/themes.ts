import type { SpeedLineStyle } from './background';
import { snes, type Rgb } from './color';
import type { NebulaSpec } from './nebula';
import type { SetPieceSpec } from './setpieces';
import type { StarSpec, StreakSpec } from './starfield';

export const THEME_IDS = [
  'kessler',
  'ion',
  'horizon',
  'pulsar',
  'armada',
  'title',
  'corona',
  'warrens',
  'junction',
  'rift',
  'foundry',
] as const;
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
  /** Speed-line look above 50 px/s; the color is a point color. Defaults to `SPEED_LINES` in the streak-head color. */
  speedLines?: SpeedLineStyle & { color?: Rgb };
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
  // Sector 6: a white-hot limb pinned across the top, amber dust bands, umber shadows.
  // The limb tops out at fill value (≤ 35%), so the bullets' white cores still win.
  corona: {
    id: 'corona',
    scrollSpeed: 30,
    base: snes(16, 8, 0),
    stars: {
      colors: [snes(72, 56, 40), snes(112, 96, 72), snes(160, 144, 112)],
      density: 18,
      twinkle: 0.06,
    },
    nebula: {
      colors: [snes(40, 24, 8), snes(64, 40, 16), snes(88, 56, 24)],
      coverage: 0.5,
      patch: 160,
      stretch: 4,
    },
    streaks: { head: snes(160, 128, 80), tail: snes(88, 64, 32), density: 1.3 },
    setPieces: [
      {
        kind: 'limb',
        anchor: 'top',
        at: 0,
        x: 0,
        size: 44,
        colors: [
          snes(40, 16, 0),
          snes(72, 32, 0),
          snes(88, 48, 8),
          snes(88, 64, 24),
          snes(88, 80, 48),
        ],
      },
      // A sail-ship yard's silhouette, backlit by the corona.
      {
        kind: 'station',
        at: 60,
        x: 170,
        size: 56,
        colors: [snes(24, 16, 8), snes(64, 40, 16), snes(88, 72, 32)],
      },
      {
        kind: 'planet',
        at: 125,
        x: -50,
        size: 90,
        colors: [snes(16, 8, 0), snes(32, 16, 8), snes(56, 32, 16), snes(88, 56, 24)],
      },
    ],
  },
  // Sector 7: open space for the approach, then rock strata from the asteroid face on,
  // with faint mining lamps. The strata layer is gated by `start`, so it scrolls in as a wall.
  warrens: {
    id: 'warrens',
    scrollSpeed: 26,
    base: snes(8, 8, 8),
    stars: {
      colors: [snes(56, 56, 56), snes(96, 88, 80), snes(144, 136, 120)],
      density: 26,
      twinkle: 0.08,
    },
    nebula: {
      style: 'strata',
      colors: [snes(16, 16, 24), snes(32, 24, 32), snes(48, 40, 32), snes(64, 48, 24)],
      coverage: 0.78,
      patch: 160,
      start: 8,
      lights: { color: snes(152, 120, 56), count: 16 },
    },
    streaks: { head: snes(120, 104, 80), tail: snes(64, 56, 48), density: 1 },
    setPieces: [
      // The asteroid itself, looming before the cave mouth.
      {
        kind: 'planet',
        at: -60,
        x: -40,
        size: 160,
        colors: [snes(16, 16, 16), snes(32, 24, 24), snes(56, 40, 24), snes(80, 64, 40)],
      },
    ],
  },
  // Sector 8: a green-black void, distant ring gates and lens flares.
  junction: {
    id: 'junction',
    scrollSpeed: 32,
    base: snes(0, 8, 0),
    stars: {
      colors: [snes(40, 64, 48), snes(80, 112, 88), snes(136, 160, 136)],
      density: 30,
      twinkle: 0.12,
    },
    nebula: {
      colors: [snes(0, 16, 8), snes(8, 32, 16), snes(16, 48, 32)],
      coverage: 0.38,
      patch: 160,
    },
    streaks: { head: snes(112, 160, 128), tail: snes(48, 80, 64), density: 1.2 },
    setPieces: [
      {
        kind: 'ring',
        at: 10,
        x: 130,
        size: 80,
        colors: [snes(16, 24, 24), snes(40, 64, 56), snes(16, 56, 64)],
        light: snes(64, 160, 160),
      },
      {
        kind: 'flare',
        at: 45,
        x: 0,
        size: 32,
        colors: [snes(16, 40, 40), snes(32, 64, 64), snes(64, 88, 88)],
      },
      {
        kind: 'ring',
        at: 80,
        x: 10,
        size: 64,
        parallax: 0.15,
        colors: [snes(16, 24, 16), snes(48, 64, 40), snes(56, 40, 16)],
        light: snes(160, 96, 32),
      },
      {
        kind: 'ring',
        at: 135,
        x: 120,
        size: 104,
        colors: [snes(16, 24, 24), snes(40, 64, 56), snes(40, 64, 16)],
        light: snes(120, 160, 48),
      },
      {
        kind: 'flare',
        at: 165,
        x: 0,
        size: 32,
        colors: [snes(24, 40, 16), snes(48, 64, 32), snes(80, 88, 56)],
      },
    ],
  },
  // Sector 9 (the chrono sector): desaturated violet, stars with afterimages, clock-face arcs.
  rift: {
    id: 'rift',
    scrollSpeed: 30,
    base: snes(8, 8, 16),
    stars: {
      colors: [snes(64, 56, 80), snes(112, 104, 128), snes(160, 152, 160)],
      density: 30,
      twinkle: 0.1,
      ghosts: 3,
    },
    nebula: {
      colors: [snes(24, 16, 32), snes(40, 32, 48), snes(64, 56, 72)],
      coverage: 0.42,
      patch: 160,
    },
    streaks: { head: snes(136, 128, 152), tail: snes(64, 56, 80), density: 1 },
    setPieces: [
      {
        kind: 'clock',
        at: 5,
        x: 100,
        size: 120,
        colors: [snes(32, 24, 48), snes(56, 48, 72), snes(88, 80, 88)],
      },
      {
        kind: 'clock',
        at: 60,
        x: -30,
        size: 90,
        parallax: 0.15,
        colors: [snes(32, 24, 48), snes(56, 48, 72), snes(88, 80, 88)],
      },
      {
        kind: 'clock',
        at: 120,
        x: 110,
        size: 150,
        parallax: 0.08,
        colors: [snes(24, 24, 40), snes(48, 48, 64), snes(80, 72, 88)],
      },
    ],
  },
  // Sector 10: a broken Dyson ring around a dying red sun; girders with molten seams.
  // Dense, long, molten speed lines sell the escape's 90 px/s.
  foundry: {
    id: 'foundry',
    scrollSpeed: 30,
    base: snes(16, 0, 0),
    stars: {
      colors: [snes(72, 40, 32), snes(112, 72, 56), snes(160, 120, 96)],
      density: 22,
      twinkle: 0.08,
    },
    nebula: {
      colors: [snes(40, 8, 0), snes(64, 16, 8), snes(88, 32, 8)],
      coverage: 0.4,
      patch: 160,
    },
    streaks: { head: snes(160, 96, 48), tail: snes(88, 40, 16), density: 1.2 },
    speedLines: { count: 28, alpha: 0.34, maxLen: 30, lenPerSpeed: 0.6, color: snes(160, 88, 24) },
    setPieces: [
      // Sinks slowly (0.03×) across the whole level, setting during the escape.
      {
        kind: 'sun',
        at: -230,
        x: 30,
        size: 80,
        parallax: 0.03,
        colors: [snes(40, 8, 0), snes(64, 16, 8), snes(88, 24, 8), snes(88, 48, 16)],
      },
      ...[8, 50, 95, 140, 185, 215].map((at, i): SetPieceSpec => ({
        kind: 'girder',
        at,
        x: 0,
        size: i % 2 ? 28 : 40,
        parallax: i % 2 ? 0.2 : 0.3,
        colors: [snes(16, 16, 16), snes(56, 48, 48), snes(72, 24, 8)],
        light: snes(160, 80, 16),
      })),
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
  chrono: 'rift',
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
