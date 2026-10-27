import type { BossPartSpec } from '../../bosses';
import type { EnemyDef } from '../../enemies';
import type { SimEnemyDef } from '../../../sim/spawn';
import type { AsteroidFieldSegment, LevelDef, TimelineEvent } from '../types';

// Sector 6, per docs/design.md → Level 6 "Corona Drift". Cover: solar flares
// burn everything in the light, and the only shade is under rocks (that your
// own guns wear away) and indestructible shade slabs. Beats:
//   0–12    sparse basalt, a drifting slab, the Arc Coil supply run at 8, practice flare at 12
//   14–40   sunskimmer pairs, gnat lines; flares at 26 and 40, each after a large-rock band
//   32      carrier
//   40–70   Shades lurking in rock shadow, interceptors; Lens Drone at 55; flares 54, 66
//   70–75   breather and a shield
//   75–110  corona storm: flares every 10 s over a lane of shade slabs, gunboats, two Lens Drones
//   94      pod (Ines Solano), 2 HP, drifting beside its own slab
//   110–145 finale-lite: flares every 9 s, larges weighted, magnet at 120
//   145–172 coronal mass ejection: a 3 s burn every 12 s, big rocks only, gnats burn up
//   174 warning, 178 Heliostat

// ---------------------------------------------------------------------------
// Roster (ids `co_`). Authored at sector numbers; enemyHpMul doesn't touch them.

export const ROSTER: Readonly<Record<string, EnemyDef>> = {
  co_sunskimmer: {
    id: 'co_sunskimmer',
    name: 'Sunskimmer',
    hp: 3,
    r: 6,
    // Drawn by its registerEnemyDraw (rotated to its heading, sail flaring in a burn).
    sprite: '',
    behavior: {
      kind: 'custom',
      behavior: 'corona.skimmer',
      // speed px/s along a `dive`° slant; ×burnMul while a flare burns.
      // One aimed shot crossing mid-screen.
      p: { speed: 120, dive: 26, burnMul: 1.5, shotSpeed: 95 },
    },
    fire: null,
    avoidsAsteroids: false,
    contactDamage: 1,
    score: 150,
    salvage: 6,
    dropTable: 'common',
  },
  co_shade: {
    id: 'co_shade',
    name: 'Shade',
    hp: 6,
    r: 8,
    sprite: '',
    behavior: {
      kind: 'custom',
      behavior: 'corona.shade',
      p: {
        descend: 55,
        /** Cruise height while no strip is in reach. */
        holdY: 70,
        /** It only takes strips this high up, so it never sits on the player's row. */
        maxY: 200,
        /** px horizontally it looks for a strip, and its tucking speed. */
        reach: 110,
        tuck: 60,
        /** Pad below the caster's bottom edge, px. */
        pad: 4,
        leaveAfter: 12,
        exitVy: -60,
      },
    },
    fire: {
      pattern: { kind: 'aimed', n: 2, spreadDeg: 12, speed: 85 },
      firstDelay: 1.2,
      interval: 1.4,
      bullet: 's',
    },
    avoidsAsteroids: true,
    contactDamage: 1,
    score: 250,
    salvage: 10,
    dropTable: 'common',
  },
  co_lens: {
    id: 'co_lens',
    name: 'Lens Drone',
    hp: 9,
    r: 9,
    sprite: '',
    behavior: {
      kind: 'custom',
      behavior: 'corona.lens',
      p: {
        descend: 50,
        holdY: 48,
        /** px/s it drifts toward the player's x between burns. */
        drift: 16,
        leaveAfter: 26,
        exitVy: -50,
        /** Per burn: telegraph (aim locked at its start), then the beam. */
        telegraph: 0.6,
        beam: 0.4,
        /** Beam: one shot every `gap` s along the locked line. */
        gap: 0.03,
        speed: 170,
      },
    },
    fire: null,
    avoidsAsteroids: true,
    contactDamage: 1,
    score: 400,
    salvage: 18,
    dropTable: 'common',
  },
};

// ---------------------------------------------------------------------------
// Placed cover

/** A band of large rocks set ahead of a flare so cover exists (the fizzle rule is the backstop). */
export const BAND = {
  /** Rocks across the playfield, evenly spaced with ±jitter px. */
  n: 3,
  jitter: 12,
  margin: 30,
  /** Own speed px/s (the scroll is added). */
  speed: 8,
  /**
   * Band rocks are heavy basalt: auto-fire from right underneath wears a
   * 14 HP large away inside one warn and burn, so placed cover would be gone
   * before the light arrives.
   */
  hp: 22,
} as const;

/** The pod's slab: drifts at the pod's speed, this far to one side and a little above. */
export const POD_SLAB = { dx: 30, dy: -6 } as const;

/** A flare's slab enters within `spread` px of the player's x (inside `margin`). */
export const NEAR_SLAB = { spread: 50, margin: 30 } as const;

// ---------------------------------------------------------------------------
// Boss: Heliostat (`co_heliostat`)

export interface HeliostatDef {
  id: 'co_heliostat';
  name: string;
  score: number;
  parts: readonly BossPartSpec[];
  entry: { fromY: number; toY: number; duration: number };
  strafe: { minX: number; maxX: number; period: number; bobAmp: number; bobPeriod: number };
  /** The hull's shadow: half-width and center-to-bottom (the core entity is the caster). */
  shade: { halfWidth: number; halfHeight: number };
  beam: {
    telegraph: number;
    /** Sweep seconds, ±deg around the slant, the slant off straight down (toward the middle). */
    sweep: number;
    arc: number;
    slant: number;
    /** Seconds per pair (telegraph + sweep + rest), so the pairs alternate every `cycle` s. */
    cycle: number;
    gap: number;
    speed: number;
  };
  flare: {
    /** Warning per flare (the sector's `WARN`). */
    warn: number;
    /** Seconds between flares, phase 1 and Solar Furnace. */
    every: number;
    everyFurnace: number;
    /** First flare this long after the fight starts. */
    first: number;
    /** Slabs drop this long before each flare's warning. */
    slabLead: number;
    /** Slab drop speed, landing band (y) and drift once landed, px/s. */
    dropSpeed: number;
    landY: readonly [number, number];
    drift: number;
    /**
     * Landing x is `minDx`..`nearPlayer` px to one side of the player (the
     * furnace's second slab on the other side), so the slab is cover in
     * reach, not a lottery, and doesn't sit over the ship's line of fire.
     */
    minDx: number;
    nearPlayer: number;
  };
  spiral: {
    arms: number;
    interval: number;
    rings: number;
    pause: number;
    turnDeg: number;
    speed: number;
  };
  /** Mirrors down before the core is exposed (Solar Furnace). */
  furnaceAfter: number;
  /** Salvage each mirror sprays when it shatters (the Leviathan's guns pay 10). */
  mirrorSalvage: number;
  deathTime: number;
  shotSalvageMax: number;
  mirrorShake: { mag: number; dur: number };
}

const MIRROR_R = 8;
const CORE_R = 13;
const MIRROR_HP = 45;
const CORE_HP = 200;

/** Mirrors in pair order: 0/3 the outer (upper) pair, 1/2 the inner (lower) pair. */
function mirror(ox: number, oy: number): BossPartSpec {
  return {
    defId: 'co_helio_mirror',
    role: 'turret',
    ox,
    oy,
    hp: MIRROR_HP,
    r: MIRROR_R,
    targetable: true,
  };
}

export const HELIOSTAT: HeliostatDef = {
  id: 'co_heliostat',
  name: 'HELIOSTAT',
  score: 2800,
  parts: [
    mirror(-52, -6),
    mirror(-30, 20),
    mirror(30, 20),
    mirror(52, -6),
    {
      defId: 'co_helio_core',
      role: 'core',
      ox: 0,
      oy: 2,
      hp: CORE_HP,
      r: CORE_R,
      targetable: false,
    },
  ],
  entry: { fromY: -50, toY: 74, duration: 3.5 },
  strafe: { minX: 76, maxX: 164, period: 14, bobAmp: 3, bobPeriod: 4 },
  shade: { halfWidth: 26, halfHeight: 16 },
  beam: { telegraph: 0.6, sweep: 3, arc: 30, slant: 25, cycle: 6, gap: 0.2, speed: 100 },
  flare: {
    warn: 1.6,
    every: 11,
    everyFurnace: 7,
    first: 6,
    slabLead: 2,
    dropSpeed: 110,
    landY: [214, 246],
    drift: 12,
    minDx: 34,
    nearPlayer: 76,
  },
  spiral: { arms: 6, interval: 0.2, rings: 8, pause: 2, turnDeg: 11, speed: 62 },
  furnaceAfter: 3,
  mirrorSalvage: 45,
  deathTime: 2.2,
  shotSalvageMax: 20,
  mirrorShake: { mag: 3, dur: 0.3 },
};

/** Part defs for the boss registry (`isBoss` is forced on). */
export const HELIOSTAT_PARTS: Readonly<Record<string, SimEnemyDef>> = {
  co_helio_mirror: { hp: MIRROR_HP, r: MIRROR_R, score: 400 },
  co_helio_core: { hp: CORE_HP, r: CORE_R, score: 0 },
};

// ---------------------------------------------------------------------------
// Level

const LARGE = { large: 1 } as const;
const OPEN = { small: 2, medium: 1, large: 1 } as const;
const MIXED = { small: 2, medium: 2, large: 3 } as const;
const HEAVY = { small: 1, medium: 2, large: 3 } as const;

// Basalt is tough (large 14, medium 6) and splits, so the field stays
// moderate: slabs carry the cover the flares rely on.
const FIELD: readonly AsteroidFieldSegment[] = [
  { from: 0, to: 12, rate: 0.3, rateTo: 0.4, sizes: OPEN, speed: [10, 24] },
  { from: 12, to: 40, rate: 0.4, rateTo: 0.45, sizes: MIXED, speed: [10, 28] },
  { from: 40, to: 70, rate: 0.45, sizes: MIXED, speed: [10, 28] },
  { from: 70, to: 75, rate: 0.12, sizes: OPEN },
  { from: 75, to: 110, rate: 0.32, sizes: MIXED, speed: [10, 26] },
  { from: 110, to: 145, rate: 0.45, rateTo: 0.52, sizes: HEAVY, speed: [8, 24] },
  // The CME: big slow rocks only.
  { from: 145, to: 172, rate: 0.28, sizes: LARGE, speed: [4, 14] },
  { from: 172, to: 176, rate: 0.15, rateTo: 0.05, sizes: LARGE, speed: [4, 14] },
];

/**
 * Warning for this sector's flares. Design default 1.2 s: with strips only
 * 24 px wide under large rocks, 1.2 s left the typical bot short of cover on
 * about a third of flares; 1.6 s gives a human time to read and commit.
 */
export const WARN = 1.4;
const CME_BURN = 3;
const BURN = 1.2;

/**
 * A slab entering near the player (or `away` px toward the middle), over the
 * ship's row at `mid` (slabs drift at the 30 px/s scroll).
 */
function slabFor(mid: number, away = 0): TimelineEvent {
  return { t: mid - 7.5, script: 'corona.slab', args: { away } };
}

/**
 * A flare at `t` with cover placed ahead of it: a slab near the player, and
 * for the first two (the design's 14–40 s beat) a large-rock band that is
 * mid-screen during the burn (rocks at 38 px/s).
 */
function coveredFlare(t: number, opts: { intro?: boolean; band?: boolean } = {}): TimelineEvent[] {
  const warn = opts.intro === true ? 2 : WARN;
  const mid = t + warn + BURN / 2;
  const out: TimelineEvent[] = [slabFor(mid), { t, flare: opts.intro === true ? {} : { warn } }];
  if (opts.band === true) out.push({ t: mid - 5.2, script: 'corona.band' });
  return out;
}

/**
 * A CME flare: a 3 s burn. The big rocks of the field drift through the
 * light too fast to hide under for all of it, so two slabs come first.
 */
function cmeFlare(t: number): TimelineEvent[] {
  const mid = t + WARN + CME_BURN / 2;
  return [slabFor(mid), slabFor(mid, 90), { t, flare: { warn: WARN, burn: CME_BURN } }];
}

function skimmers(t: number, side: 'left' | 'right', y: number): TimelineEvent {
  return { t, spawn: { enemy: 'co_sunskimmer', from: side, y }, repeat: { every: 0.32, times: 2 } };
}

export const LEVEL: LevelDef = {
  id: 'corona',
  number: 6,
  name: 'CORONA DRIFT',
  theme: 'corona',
  music: 'corona',
  bossMusic: 'boss2',
  scrollSpeed: 30,
  duration: 260,
  rockTheme: 'basalt',
  enemyHpMul: 1.5,
  enemyShotSpeedMul: 1.22,
  guaranteeWeapon: { by: 25, weapon: 'arc' },
  fieldTestWeapon: 'arc',
  bossSalvage: 240,
  podFallbackSalvage: 90,
  schematicOnClear: ['shrike'],
  asteroidField: FIELD,

  timeline: [
    { t: 0.5, toast: 'CORONA DRIFT' },
    { t: 2, shadeSlab: { x: 120 } },
    { t: 3, toast: 'SOLAR FLARES — HIDE IN THE SHADOWS' },
    { t: 4.5, formation: { type: 'line', enemy: 'gnat', count: 4, x: 120 } },

    // Supply run: the Arc Coil field test.
    { t: 8, formation: { type: 'v', enemy: 'gnat', count: 5, x: 120 }, forceCapsule: 'arc' },
    // Practice flare: the shadows are outlined, nothing burns.
    { t: 12, flare: { practice: true } },

    // Sunskimmer pairs and gnat lines; flares behind rock bands. Formations and
    // carriers are timed to be gone before each burn: a flare kill drops no
    // salvage and breaks the formation's capsule.
    skimmers(15, 'left', 40),
    { t: 17, formation: { type: 'line', enemy: 'gnat', count: 5, x: 'rand' } },
    { t: 19, spawn: { enemy: 'gunboat', x: 'rand' } },
    skimmers(21, 'right', 56),
    { t: 20.5, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },
    ...coveredFlare(26, { intro: true, band: true }),
    skimmers(29, 'left', 48),
    { t: 30, spawn: { enemy: 'interceptor', x: 'rand' }, repeat: { every: 0.8, times: 2 } },
    { t: 30.5, spawn: { enemy: 'carrier', from: 'right', y: 84 } },
    { t: 34, formation: { type: 'line', enemy: 'gnat', count: 5, x: 'rand' } },
    skimmers(36.5, 'right', 40),
    ...coveredFlare(40, { band: true }),

    // Shades in the rock shadows, interceptors, the first Lens Drone.
    { t: 43, spawn: { enemy: 'co_shade', x: 70 } },
    { t: 44, spawn: { enemy: 'co_shade', x: 170 } },
    { t: 46, formation: { type: 'column', enemy: 'gnat', count: 5, x: 'rand' } },
    { t: 48, spawn: { enemy: 'interceptor', x: 'rand' }, repeat: { every: 0.8, times: 2 } },
    { t: 48.5, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },
    { t: 51, spawn: { enemy: 'gunboat', x: 70 } },
    ...coveredFlare(54),
    { t: 55, spawn: { enemy: 'co_lens', x: 120 } },
    { t: 57, spawn: { enemy: 'co_shade', x: 60 } },
    { t: 58, spawn: { enemy: 'co_shade', x: 180 } },
    skimmers(61, 'left', 44),
    { t: 59.5, formation: { type: 'line', enemy: 'gnat', count: 5, x: 'rand' } },
    { t: 63.5, spawn: { enemy: 'interceptor', x: 'rand' }, repeat: { every: 0.8, times: 2 } },
    ...coveredFlare(66),

    // Breather.
    { t: 70, drop: { kind: 'shield', x: 'rand' } },
    { t: 71, shadeSlab: { x: 70 } },
    { t: 73, toast: 'CORONA STORM' },

    // The storm: flares every 10 s over a lane of slabs, each over the ship's
    // row mid-burn, with the light on the gaps between.
    { t: 75, shadeSlab: { x: 170 } },
    { t: 76, spawn: { enemy: 'gunboat', x: 80 } },
    { t: 78, flares: { every: 10, until: 109, warn: WARN } },
    { t: 80, spawn: { enemy: 'co_lens', x: 60 } },
    { t: 81, shadeSlab: { x: 120 } },
    { t: 84, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.5, times: 3 } },
    { t: 82.5, formation: { type: 'line', enemy: 'gnat', count: 5, x: 'rand' } },
    { t: 85, shadeSlab: { x: 190 } },
    { t: 86, spawn: { enemy: 'gunboat', x: 160, overrides: { ay: 96 } } },
    { t: 90, spawn: { enemy: 'interceptor', x: 'rand' }, repeat: { every: 0.8, times: 2 } },
    { t: 91, shadeSlab: { x: 100 } },
    { t: 92, spawn: { enemy: 'co_lens', x: 180 } },
    skimmers(95, 'right', 40),
    { t: 97, shadeSlab: { x: 40 } },
    // The pod comes right after a burn: one flare (108) takes 1 HP, the next (115) the last.
    { t: 99, toast: 'ESCAPE POD AHEAD', ifNoPod: 'SALVAGE CACHE AHEAD' },
    { t: 100, escapePod: { x: 150, hp: 2 } },
    { t: 100, script: 'corona.podSlab', args: { x: 150 } },
    { t: 101, shadeSlab: { x: 80 } },
    { t: 102, spawn: { enemy: 'co_shade', x: 90 } },
    { t: 102.5, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },
    { t: 104, spawn: { enemy: 'gunboat', x: 60 } },

    // Finale-lite: flares every 9 s, larges weighted.
    { t: 108.5, drop: { kind: 'shield', x: 'rand' } },
    { t: 111, spawn: { enemy: 'swooper', from: 'topLeft' }, repeat: { every: 0.5, times: 3 } },
    skimmers(113, 'right', 50),
    ...coveredFlare(115),
    { t: 117, spawn: { enemy: 'co_shade', x: 120 } },
    { t: 118, spawn: { enemy: 'carrier', from: 'left', y: 90 } },
    { t: 120, drop: { kind: 'magnet', x: 'rand' } },
    skimmers(121, 'left', 40),
    { t: 122, spawn: { enemy: 'gunboat', x: 170 } },
    ...coveredFlare(124),
    { t: 126, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.5, times: 3 } },
    { t: 129, spawn: { enemy: 'interceptor', x: 'rand' }, repeat: { every: 0.8, times: 2 } },
    { t: 127, formation: { type: 'v', enemy: 'gnat', count: 5, x: 'rand' } },
    ...coveredFlare(133),
    skimmers(134, 'right', 46),
    { t: 138, spawn: { enemy: 'co_shade', x: 70 } },
    { t: 139, spawn: { enemy: 'co_shade', x: 170 } },
    { t: 136.5, formation: { type: 'line', enemy: 'gnat', count: 6, x: 'rand' } },
    { t: 140, spawn: { enemy: 'gunboat', x: 'rand' } },
    ...coveredFlare(142),

    // Coronal mass ejection: gnat swarms timed into each burn, which thins them out.
    { t: 144, toast: 'CORONAL MASS EJECTION' },
    { t: 145, drop: { kind: 'shield', x: 'rand' } },
    { t: 147, formation: { type: 'stagger', enemy: 'gnat', count: 7, x: 'rand' } },
    ...cmeFlare(148),
    skimmers(153, 'left', 44),
    { t: 154, spawn: { enemy: 'gunboat', x: 70 } },
    { t: 155, spawn: { enemy: 'swooper', from: 'topRight' }, repeat: { every: 0.5, times: 3 } },
    { t: 159, formation: { type: 'stagger', enemy: 'gnat', count: 7, x: 'rand' } },
    ...cmeFlare(160),
    skimmers(165, 'right', 48),
    { t: 166, spawn: { enemy: 'gunboat', x: 170 } },
    { t: 167, spawn: { enemy: 'interceptor', x: 'rand' }, repeat: { every: 0.8, times: 2 } },
    { t: 171, formation: { type: 'stagger', enemy: 'gnat', count: 7, x: 'rand' } },
    ...cmeFlare(172),

    { t: 174, bossWarning: true },
    { t: 176, drop: { kind: 'shield', x: 120 } },
    { t: 178, boss: 'co_heliostat' },
  ],
};
