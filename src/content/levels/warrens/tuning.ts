// Level 7 tunables (T39): the wall turret, borer and cave bats, the pod and
// core cages, the collapse's rock falls, and the Wyrm. game/levels/warrens
// reads only these tables. Shot speeds are before the level's
// enemyShotSpeedMul (1.25).

import type { BossPartSpec } from '../../bosses';
import type { SimEnemyDef } from '../../../sim/spawn';

/** Wall Turret: fixed in a `T` socket, scrolls with the terrain. */
export const TURRET = {
  hp: 4,
  r: 6,
  /** The turret sits on the wall face: this far from the socket's center, toward the open side. */
  faceOffset: 4,
  /** Seconds on screen before the first burst (design: no earlier than 0.6 s). */
  firstOnScreen: 0.6,
  /** It stops firing once it scrolls below this y: point-blank flank shots in a corridor can't be dodged. */
  maxY: 250,
  interval: 2.2,
  burst: 3,
  burstGap: 0.16,
  speed: 80,
  salvage: 5,
  score: 150,
} as const;

/** Borer: a dust plume on a wall, then it crosses the corridor and digs into the far wall. */
export const BORER = {
  hp: 6,
  r: 7,
  /** The plume's telegraph, seconds (design: 0.6). */
  warn: 0.6,
  speed: 90,
  /** It starts this deep inside the near wall (out of reach of shots), px. */
  depth: 12,
  /** The hole it carves: tiles whose centers are within this many px (a 2-tile bore). */
  carveR: 8,
  /** Px it digs into the far wall before it's gone. */
  digIn: 20,
  /** The ring it drops as it enters the far wall. */
  ring: { n: 4, speed: 72, rot: 45 },
  salvage: 6,
  score: 200,
} as const;

/** Cave Bat: loose boids that chase the ship for a while. */
export const BAT = {
  hp: 1,
  r: 5,
  speed: 70,
  /** Seconds before a bat loses interest and flies off. */
  interest: 6,
  fleeSpeed: 80,
  /** Steering accel cap, px/s². */
  accel: 220,
  /** Neighbors closer than this push apart; within `nbrR` they align and cohere. */
  sepR: 12,
  nbrR: 40,
  wSep: 3.2,
  wAli: 0.9,
  wCoh: 0.6,
  wSeek: 1.6,
  wWall: 4,
  /** Wall probes, px ahead along the velocity and to the sides. */
  probe: 14,
  /** Flock size cap per scan (preallocated neighbor list). */
  maxBats: 64,
  /** Flocks enter spread over this width, px. */
  spread: 60,
  salvage: 2,
  score: 40,
} as const;

/** Rook Mbeki's pod (the fork's alcove) and the right branch's upgrade core. */
export const CAGE = {
  podHp: 2,
  /** A caged pickup that reaches this y is let go regardless (the gates crumble at 300). */
  releaseY: 304,
  /** Freed pod: drifts down this much faster than the scroll and eases to the branch's middle. */
  podDrop: 10,
  podSteer: 1.6,
} as const;

/** The collapse: dust trickles from the ceiling for `warn` s, then a rock falls. */
export const ROCKFALL = {
  warn: 0.6,
  /** Fall speed on top of the scroll, px/s. */
  speed: 46,
  /** Sizes by weight. */
  medium: 0.35,
  maxPending: 8,
} as const;

/** The den's scroll stop: deceleration, px/s². */
export const DEN_BRAKE = 13;

export const WYRM = {
  id: 'wr_wyrm',
  name: 'WYRM',
  score: 6000,
  head: { defId: 'wr_wyrm_head', hp: 260, r: 14 },
  seg: { defId: 'wr_wyrm_seg', hp: 30, r: 7, count: 8, score: 300 },
  /** Path distance from the head to the first segment, and between segments, px. */
  firstGap: 17,
  gap: 13,
  /** Seconds after the scroll stops before the first dust trail. */
  entryDelay: 1.2,
  speed1: 110,
  speed2: 150,
  /** The dust trail shows where it'll come out this long ahead (design: 0.8 s). */
  telegraph: 0.8,
  /** Mouth open (head unarmored) for this long after it emerges. */
  surface: 1.7,
  /** Speed share as it surfaces, easing up to full over the surfacing window. */
  surfaceSlow: 0.4,
  /** Seconds fully underground between the dive and the next telegraph. */
  under: 0.3,
  /** Below this share of total HP: FRENZY. */
  frenzyAt: 0.5,
  /** Crossings per burrow in each phase. */
  crossings1: 1,
  crossings2: 2,
  /** The arc's sag below the line between its ends, px, and the lowest it may reach. */
  sag: [30, 90] as const,
  lowestY: 230,
  /** Emergence points: wall faces and pillar centers, y on the fixed arena (screen px). */
  wallYs: [60, 110, 160, 210] as const,
  /** One sideways shot per segment as it passes the cavern's middle. */
  segShot: { speed: 80, band: 10 },
  /** FRENZY: a 7-way fan from the mouth, `delay` s after surfacing. */
  fan: { n: 7, arc: 72, speed: 84, delay: 0.5 },
  /** FRENZY carves what the head passes through (the pillars). */
  carveR: 10,
  /** Defeat: the segments pop this far apart along the body, seconds. */
  popGap: 0.14,
  dyingTime: 2.2,
  shotSalvageMax: 24,
  /** A destroyed segment drops a small rock this fast, px/s. */
  rockSpeed: 30,
} as const;

/** Rig specs: the head is the core, segments are turrets (bossSystem roles); positions come from the path. */
export const WYRM_PARTS: readonly BossPartSpec[] = [
  {
    defId: WYRM.head.defId,
    role: 'core',
    ox: 0,
    oy: 0,
    hp: WYRM.head.hp,
    r: WYRM.head.r,
    targetable: false,
  },
  ...Array.from({ length: WYRM.seg.count }, (): BossPartSpec => ({
    defId: WYRM.seg.defId,
    role: 'turret',
    ox: 0,
    oy: 0,
    hp: WYRM.seg.hp,
    r: WYRM.seg.r,
    targetable: true,
  })),
];

export const WYRM_PART_DEFS: Readonly<Record<string, SimEnemyDef>> = {
  [WYRM.head.defId]: { hp: WYRM.head.hp, r: WYRM.head.r, score: 0, contactDamage: 1 },
  [WYRM.seg.defId]: { hp: WYRM.seg.hp, r: WYRM.seg.r, score: WYRM.seg.score, contactDamage: 1 },
};
