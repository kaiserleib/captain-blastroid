import type { BossPartSpec } from '../../bosses';
import type { SimEnemyDef } from '../../../sim/spawn';

// Janus (docs/design.md → Level 8 boss): a two-faced gate station behind an
// indestructible portal wall. Two pairs connect entry rings in the ship's
// half to exits at the top edge, held over the faces by the ring generators,
// so the faces can only be hit through the rings. Read only by
// game/levels/junction/janus.ts.

export interface JanusDef {
  id: 'wj_janus';
  name: string;
  /** Score for the last face (× chain); the other parts score through their part defs. */
  score: number;
  /** Faces first (Dawn, Dusk), then the generators (left, right). */
  parts: readonly BossPartSpec[];
  entry: { fromY: number; toY: number; duration: number };
  /** Gentle bob while fighting (the station barely moves: the rings are the fight). */
  bob: { amp: number; period: number };
  wall: {
    /** Below the station center, px. */
    oy: number;
    halfWidth: number;
    /** The ship is held this far below the wall. */
    shipPad: number;
  };
  rings: {
    /** Phase 1 entry rings: fixed left (x) and right (240 − x), at this height. */
    entryX: number;
    entryY: number;
    /** Exits sit at the top edge (closed to the ship: their center is off screen). */
    exitY: number;
    /** A free exit (its generator gone) wanders this far either side of its face, rad/s. */
    driftAmp: number;
    driftSpeed: number;
    colors: readonly [string, string];
  };
  /** Phase 2: the entry rings drift (Lissajous paths) and the pairs swap. */
  drift: {
    minX: number;
    maxX: number;
    /** rad/s per ring. */
    speedX: readonly [number, number];
    bobY: number;
    speedY: number;
    swapEvery: number;
  };
  /** Aimed 3-bursts, the living generators taking turns (the faces once both are gone). */
  burst: { interval: number; count: number; gap: number; speed: number };
  /** 16-shot ring from the station's throat, with a glow tell. */
  ring: { interval: number; n: number; speed: number; rotStep: number; tell: number };
  /** Phase 2: the remaining face's 4-arm spiral, in on/off bursts. */
  spiral: {
    arms: number;
    interval: number;
    on: number;
    off: number;
    rotStep: number;
    speed: number;
  };
  blinkers: { every: number; first: number };
  /**
   * Silent assist: less than `minDamage` landed through the rings over the
   * last `after` s → the wall drops for `off` s every `every` s.
   */
  flicker: { after: number; every: number; off: number; minDamage: number };
  /** Salvage sprayed by a wrecked generator and by the first face to crack. */
  partSalvage: { gen: number; face: number };
  /** Stall-breaker threshold, s (the registration's `assistAfter`). */
  assistAfter: number;
  deathTime: number;
  shotSalvageMax: number;
  shake: { mag: number; dur: number };
}

export const JANUS: JanusDef = {
  id: 'wj_janus',
  name: 'JANUS',
  score: 3500,
  parts: [
    { defId: 'wj_janus_face', role: 'core', ox: -30, oy: -4, hp: 460, r: 13, targetable: true },
    { defId: 'wj_janus_face', role: 'core', ox: 30, oy: -4, hp: 460, r: 13, targetable: true },
    { defId: 'wj_janus_gen', role: 'turret', ox: -80, oy: 36, hp: 60, r: 9, targetable: true },
    { defId: 'wj_janus_gen', role: 'turret', ox: 80, oy: 36, hp: 60, r: 9, targetable: true },
  ],
  entry: { fromY: -50, toY: 52, duration: 3 },
  bob: { amp: 2, period: 4.2 },
  wall: { oy: 34, halfWidth: 72, shipPad: 26 },
  rings: {
    entryX: 40,
    entryY: 232,
    exitY: -3,
    driftAmp: 34,
    driftSpeed: 1.1,
    colors: ['orange', 'lime'],
  },
  drift: {
    minX: 36,
    maxX: 204,
    speedX: [0.42, 0.55],
    bobY: 12,
    speedY: 0.9,
    swapEvery: 6,
  },
  burst: { interval: 1.35, count: 3, gap: 0.12, speed: 92 },
  ring: { interval: 2.2, n: 16, speed: 62, rotStep: 11, tell: 0.5 },
  spiral: { arms: 4, interval: 0.2, on: 1.6, off: 1.8, rotStep: 13, speed: 70 },
  blinkers: { every: 8, first: 3 },
  flicker: { after: 40, every: 10, off: 3, minDamage: 60 },
  partSalvage: { gen: 45, face: 90 },
  assistAfter: 90,
  deathTime: 2.5,
  shotSalvageMax: 40,
  shake: { mag: 3, dur: 0.4 },
};

function partOf(role: BossPartSpec['role']): BossPartSpec {
  const p = JANUS.parts.find((s) => s.role === role);
  if (p === undefined) throw new Error(`wj_janus has no ${role} part`);
  return p;
}

/** Part defs for `registerBoss` (spawns pass each spec's own hp and r). */
export const JANUS_PARTS: Readonly<Record<string, SimEnemyDef>> = {
  wj_janus_face: { hp: partOf('core').hp, r: partOf('core').r, score: 1500 },
  wj_janus_gen: { hp: partOf('turret').hp, r: partOf('turret').r, score: 600 },
};
