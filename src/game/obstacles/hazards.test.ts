import { beforeEach, describe, expect, it } from 'vitest';
import {
  BLACK_HOLE_VARIANTS,
  BLACK_HOLE_VARIANT_IDS,
  PULSAR,
  PULSAR_DOUBLE_DELAY,
  PULSAR_VARIANTS,
  PULSAR_VARIANT_IDS,
} from '../../content/obstacles';
import { cleanupSystem } from '../../sim/cleanup';
import { collisionSystem } from '../../sim/collision';
import { clearHooks } from '../../sim/hooks';
import { bulletsSystem } from '../../sim/motion';
import { spawnEnemy, spawnPickup, spawnPlayerShot } from '../../sim/spawn';
import type { Anomaly } from '../../sim/types';
import { createWorld, type World } from '../../sim/world';
import {
  anomalyVariant,
  collapseAnomaly,
  flingRock,
  inPulsarGap,
  isCollapsing,
  isFieldOnly,
  isTowed,
  obstaclesSystem,
  pulsarEchoRadius,
  pulsarGapAngles,
  pulsarRingRadius,
  pulseIndex,
  registerAnomalyHooks,
  setPulsarPattern,
  spawnBlackHole,
  spawnFieldOnly,
  spawnPulsar,
  spawnRock,
  towRock,
} from './index';
import { blackHolePixel, blackHoleSize, BLACKHOLE_MAX_R } from './obstacles.sprites';
import { resetTows } from './tractor';

const DT = 1 / 60;
const DEG = Math.PI / 180;

function world(): World {
  const w = createWorld('t23');
  w.player.shield = 5;
  w.player.maxShield = 5;
  w.player.alive = true;
  return w;
}

function step(w: World, n = 1, tick?: (w: World) => void): void {
  for (let i = 0; i < n; i++) {
    w.tick++;
    w.time += DT;
    if (w.player.invulnT > 0) w.player.invulnT = Math.max(0, w.player.invulnT - DT);
    tick?.(w);
    bulletsSystem.update(w, DT);
    obstaclesSystem.update(w, DT);
    collisionSystem.update(w, DT);
    cleanupSystem.update(w, DT);
  }
}

function parkPlayer(w: World, x: number, y: number): void {
  w.player.x = w.player.prevX = x;
  w.player.y = w.player.prevY = y;
}

/** Records the tick of every player hit. */
function hits(w: World): number[] {
  const out: number[] = [];
  w.events.on('playerHit', () => out.push(w.tick));
  return out;
}

beforeEach(() => {
  clearHooks();
  registerAnomalyHooks();
  resetTows();
});

describe('pulsar gap math', () => {
  const gapW = 60 * DEG;
  it('a body at a gap center is safe, a body on a solid arc is not', () => {
    // 3 gaps centered on 90°, 210°, 330°.
    expect(inPulsarGap(0, 100, 3, 3, gapW, 90 * DEG)).toBe(true);
    expect(
      inPulsarGap(100 * Math.cos(210 * DEG), 100 * Math.sin(210 * DEG), 3, 3, gapW, 90 * DEG),
    ).toBe(true);
    // 150° is midway between two gaps: solid.
    expect(
      inPulsarGap(100 * Math.cos(150 * DEG), 100 * Math.sin(150 * DEG), 3, 3, gapW, 90 * DEG),
    ).toBe(false);
  });

  it('accounts for the body radius at that distance', () => {
    // Center 29.5° off a 60° gap's center: 0.5° of room. Far out a 3 px ship fits; close in it doesn't.
    const ang = (90 + 29.5) * DEG;
    const far = 200;
    const near = 10;
    expect(inPulsarGap(far * Math.cos(ang), far * Math.sin(ang), 3, 1, gapW, 90 * DEG)).toBe(false);
    expect(inPulsarGap(far * Math.cos(ang), far * Math.sin(ang), 0.5, 1, gapW, 90 * DEG)).toBe(
      true,
    );
    const ang2 = (90 + 25) * DEG;
    expect(inPulsarGap(far * Math.cos(ang2), far * Math.sin(ang2), 3, 1, gapW, 90 * DEG)).toBe(
      true,
    );
    expect(inPulsarGap(near * Math.cos(ang2), near * Math.sin(ang2), 3, 1, gapW, 90 * DEG)).toBe(
      false,
    );
  });

  it('no gaps means solid everywhere', () => {
    expect(inPulsarGap(0, 100, 3, 0, gapW, 0)).toBe(false);
  });
});

describe('variants', () => {
  it.each(BLACK_HOLE_VARIANT_IDS)('black hole %s spawns with the design numbers', (id) => {
    const w = world();
    const a = spawnBlackHole(w, 120, 100, { variant: id, vy: 0 })!;
    const v = BLACK_HOLE_VARIANTS[id];
    expect([a.r, a.radius, a.strength]).toEqual([v.r, v.radius, v.strength]);
    expect(anomalyVariant(a)).toBe(id);
  });

  it('unknown or missing variants fall back to standard / steady', () => {
    const w = world();
    expect(anomalyVariant(spawnBlackHole(w, 0, 0, { variant: 'toString' })!)).toBe('standard');
    expect(anomalyVariant(spawnBlackHole(w, 0, 0)!)).toBe('standard');
    expect(anomalyVariant(spawnPulsar(w, 0, 0)!)).toBe('steady');
  });

  it.each(PULSAR_VARIANT_IDS)('pulsar %s uses its ring speed and reach', (id) => {
    const w = world();
    const a = spawnPulsar(w, 120, 100, { variant: id, vy: 0 })!;
    expect(a.strength).toBe(PULSAR_VARIANTS[id].ringSpeed);
    expect(a.radius).toBe(PULSAR_VARIANTS[id].maxRadius);
  });

  it('massive holes pull the player harder than small ones', () => {
    const drift = (variant: string): number => {
      const w = world();
      parkPlayer(w, 120, 260);
      spawnBlackHole(w, 120, 200, { variant, vy: 0 });
      step(w, 30);
      return 260 - w.player.y;
    };
    expect(drift('massive')).toBeGreaterThan(drift('standard'));
    expect(drift('standard')).toBeGreaterThan(drift('small'));
  });
});

describe('pulsar rings with gaps', () => {
  it('a player standing in a gap takes no damage; a solid arc hurts once per pulse', () => {
    for (const id of ['steady', 'turning', 'quick'] as const) {
      const v = PULSAR_VARIANTS[id];
      // In the gap: steady and the first pulse of every variant open straight down.
      const w = world();
      parkPlayer(w, 120, 260);
      spawnPulsar(w, 120, 200, { variant: id, vy: 0 });
      const h = hits(w);
      step(w, Math.round((v.period + 1) * 60));
      expect(h, id).toHaveLength(0);
      // On the solid arc halfway between gaps.
      const w2 = world();
      const mid = 90 * DEG + Math.PI / v.gaps;
      parkPlayer(w2, 120 + 60 * Math.cos(mid), 200 + 60 * Math.sin(mid));
      spawnPulsar(w2, 120, 200, { variant: id, vy: 0 });
      const h2 = hits(w2);
      step(w2, Math.round((v.period + 1) * 60));
      expect(h2, id).toHaveLength(1);
    }
  });

  it('turning pulsars rotate the gap pattern each pulse, and the telegraph shows the next one', () => {
    const w = world();
    const v = PULSAR_VARIANTS.turning;
    const a = spawnPulsar(w, 120, 200, { variant: 'turning', vy: 0 })!;
    const out: number[] = [];
    step(w, Math.round(v.period * 60) + 2);
    expect(pulseIndex(a)).toBe(1);
    expect(pulsarGapAngles(a, out)).toBe(2);
    expect(out[0]).toBeCloseTo(90 * DEG, 5);
    // Into the telegraph for pulse 2: the next pattern, turned by gapSpin.
    step(w, Math.round((v.period - v.telegraph / 2) * 60));
    pulsarGapAngles(a, out);
    expect(out[0]).toBeCloseTo((90 + v.gapSpin) * DEG, 5);
  });

  it('phase pre-runs the pulse clock', () => {
    const w = world();
    const a = spawnPulsar(w, 120, 200, { variant: 'steady', vy: 0, phase: 3.5 })!;
    expect(pulseIndex(a)).toBe(1);
    expect(pulsarRingRadius(a)).toBeCloseTo(PULSAR.r + 0.5 * PULSAR_VARIANTS.steady.ringSpeed, 5);
  });
});

describe('programmable pulsar', () => {
  it('setPulsarPattern changes period and gaps from the next pulse', () => {
    const w = world();
    parkPlayer(w, 120, 260);
    const a = spawnPulsar(w, 120, 200, { variant: 'magnetar', vy: 0 })!;
    setPulsarPattern(a, { period: 1.5, gaps: 4, gapDeg: 40, gapSpin: 0 });
    step(w, 92);
    expect(pulseIndex(a)).toBe(1);
    const out: number[] = [];
    expect(pulsarGapAngles(a, out)).toBe(4);
    step(w, 90);
    expect(pulseIndex(a)).toBe(2);
  });

  it("the echo's hit test matches its drawn gaps (half the gap spacing)", () => {
    const w = world();
    // Two gaps start at 90° (down); the echo's sit at 180° (left of the core).
    parkPlayer(w, 60, 200);
    const a = spawnPulsar(w, 120, 200, { variant: 'magnetar', vy: 0 })!;
    setPulsarPattern(a, { period: 3, gaps: 2, gapDeg: 50, gapSpin: 0, double: true });
    const h = hits(w);
    step(w, 181 + Math.round(PULSAR_DOUBLE_DELAY * 60) + 60);
    // The first ring is solid here; the echo's gap is not.
    expect(h).toHaveLength(1);
  });

  it('double fires an echo ring 0.5 s later with its gaps between the first ring gaps', () => {
    const w = world();
    // Dead center of the first ring's gap: the echo's gap starts right here, so the ship is on solid.
    parkPlayer(w, 120, 260);
    const a = spawnPulsar(w, 120, 200, { variant: 'magnetar', vy: 0 })!;
    setPulsarPattern(a, { period: 3, gaps: 2, gapDeg: 50, gapSpin: 0, double: true });
    const h = hits(w);
    step(w, 181);
    expect(pulsarEchoRadius(a)).toBe(-1);
    step(w, Math.round(PULSAR_DOUBLE_DELAY * 60) + 1);
    expect(pulsarEchoRadius(a)).toBeGreaterThan(0);
    step(w, 60);
    expect(h).toHaveLength(1);
    // Without double, the same spot is safe.
    const w2 = world();
    parkPlayer(w2, 120, 260);
    const b = spawnPulsar(w2, 120, 200, { variant: 'magnetar', vy: 0 })!;
    setPulsarPattern(b, { period: 3, gaps: 2, gapDeg: 50, gapSpin: 0 });
    const h2 = hits(w2);
    step(w2, 300);
    expect(h2).toHaveLength(0);
  });
});

describe('tractor beams', () => {
  it('the critically damped spring settles on the target without overshoot', () => {
    const w = world();
    parkPlayer(w, 230, 390);
    const rock = spawnRock(w, { size: 'medium', x: 40, y: 300, vx: 0, vy: 0 })!;
    let minY = Infinity;
    step(w, 240, (w) => {
      towRock(w, rock, 120, 100, 12);
      minY = Math.min(minY, rock.y);
    });
    expect(Math.hypot(rock.x - 120, rock.y - 100)).toBeLessThan(1);
    expect(Math.hypot(rock.vx, rock.vy)).toBeLessThan(2);
    expect(minY).toBeGreaterThan(99);
    expect(isTowed(rock)).toBe(true);
  });

  it('fling sets the speed toward the target and ends the tow', () => {
    const w = world();
    const rock = spawnRock(w, { size: 'large', x: 100, y: 100, vx: 5, vy: 5 })!;
    towRock(w, rock, 100, 80, 12);
    flingRock(w, rock, 95, 100 + 30, 100 + 40);
    expect(rock.vx).toBeCloseTo(95 * 0.6, 6);
    expect(rock.vy).toBeCloseTo(95 * 0.8, 6);
    expect(isTowed(rock)).toBe(false);
  });

  it('towed rocks are never culled, even above the top edge heading up', () => {
    const w = world();
    parkPlayer(w, 230, 390);
    const towed = spawnRock(w, { size: 'large', x: 120, y: -120, vx: 0, vy: -20 })!;
    const loose = spawnRock(w, { size: 'large', x: 60, y: -120, vx: 0, vy: -20 })!;
    step(w, 3, (w) => towRock(w, towed, 120, -200, 4));
    expect(towed.active).toBe(true);
    expect(loose.active).toBe(false);
  });

  it('a rock whose tower stops calling is dropped with its velocity, then culls normally', () => {
    const w = world();
    parkPlayer(w, 230, 390);
    const rock = spawnRock(w, { size: 'medium', x: 120, y: -100, vx: 0, vy: -30 })!;
    step(w, 2, (w) => towRock(w, rock, 120, -300, 4));
    expect(isTowed(rock)).toBe(true);
    const vy = rock.vy;
    step(w, 3);
    expect(isTowed(rock)).toBe(false);
    expect(rock.active).toBe(false);
    expect(vy).toBeLessThan(0);
  });

  it('a towed rock moving into a boss part does not break; an untowed one does', () => {
    for (const tow of [true, false]) {
      const w = world();
      parkPlayer(w, 230, 390);
      spawnEnemy(w, 'dummy', 120, 80, { isBoss: true, hp: 999, r: 12 });
      const rock = spawnRock(w, { size: 'large', x: 120, y: 130, vx: 0, vy: -60 })!;
      const id = rock.id;
      step(w, 50, (w) => {
        if (tow && rock.active && rock.id === id) towRock(w, rock, 120, 80, 12);
      });
      expect(rock.active && rock.id === id, `towed=${tow}`).toBe(tow);
    }
  });

  it('towed rocks keep their HP and still split when shot', () => {
    const w = world();
    parkPlayer(w, 230, 390);
    w.run.levelId = 'ionShoals';
    const rock = spawnRock(w, { size: 'large', x: 120, y: 100, vx: 0, vy: 0, theme: 'ion' })!;
    const hp = rock.hp;
    step(w, 5, (w) => towRock(w, rock, 120, 100, 12));
    expect(rock.hp).toBe(hp);
    spawnPlayerShot(w, { x: 120, y: 120, vx: 0, vy: -300, damage: 99 });
    step(w, 10, (w) => {
      if (rock.active) towRock(w, rock, 120, 100, 12);
    });
    expect(rock.active).toBe(false);
    expect(w.asteroids.count).toBe(2);
  });
});

describe('black hole extras', () => {
  it('escape pods are pulled but never swallowed, and slide past the core', () => {
    const w = world();
    parkPlayer(w, 230, 390);
    spawnBlackHole(w, 120, 150, { variant: 'massive', vy: 0 });
    const pod = spawnPickup(w, {
      kind: 'escapePod',
      x: 120,
      y: 20,
      vy: 12,
      r: 6,
      payload: 'zzkar',
    })!;
    const rock = spawnRock(w, { size: 'small', x: 120, y: 30, vx: 0, vy: 12 })!;
    let pulled = false;
    let maxY = 0;
    step(w, 60 * 20, () => {
      // T12's pickup motion, reduced to the bit that matters: integrate velocity.
      if (pod.active) {
        pod.prevY = pod.y;
        pod.x += pod.vx * DT;
        pod.y += pod.vy * DT;
        if (pod.vy > 13) pulled = true;
        maxY = Math.max(maxY, pod.y);
      }
    });
    expect(pulled).toBe(true);
    expect(rock.active).toBe(false);
    expect(maxY).toBeGreaterThan(150 + 12);
  });

  it('collapse shrinks core and field to 0, then releases the anomaly', () => {
    const w = world();
    const a = spawnBlackHole(w, 120, 150, { variant: 'massive', vy: 0 })!;
    const id = a.id;
    collapseAnomaly(w, a, 1);
    expect(isCollapsing(a)).toBe(true);
    step(w, 30);
    expect(a.r).toBeCloseTo(6, 0);
    expect(a.radius).toBeCloseTo(85, 0);
    step(w, 31);
    expect(a.active && a.id === id).toBe(false);
  });

  it('a collapsing pulsar stops pulsing', () => {
    const w = world();
    const a = spawnPulsar(w, 120, 150, { vy: 0 })!;
    collapseAnomaly(w, a, 10);
    step(w, 200);
    expect(pulseIndex(a)).toBe(0);
    collapseAnomaly(w, a, 0);
    expect(a.active).toBe(false);
  });

  it('field-only: bends shots, no core (no absorb, no contact damage), owner moves it', () => {
    const w = world();
    parkPlayer(w, 120, 200);
    const f = spawnFieldOnly(w, 120, 200, { variant: 'small' }) as Anomaly;
    expect(isFieldOnly(f)).toBe(true);
    expect(f.r).toBe(0);
    expect(f.strength).toBe(BLACK_HOLE_VARIANTS.small.strength * 0.5);
    const rock = spawnRock(w, { size: 'small', x: 160, y: 200, vx: 0, vy: 0 })!;
    const shot = spawnPlayerShot(w, { x: 150, y: 300, vx: 0, vy: -200, ttl: 3 })!;
    step(w, 20, () => {
      f.x = 120;
      f.y = 200;
    });
    expect(w.player.shield).toBe(5);
    expect(shot.vx).toBeLessThan(0);
    expect(rock.vx).toBeLessThan(0);
    parkPlayer(w, 230, 390);
    step(w, 120, () => {
      f.x = 120;
      f.y = 200;
    });
    // The rock falls through the center and out the other side instead of being eaten.
    expect(rock.active).toBe(true);
  });
});

describe('black hole art', () => {
  it('has a black core, a bright ring at the edge, and a halo that ends by 2x the core', () => {
    for (let core = 2; core <= BLACKHOLE_MAX_R; core++) {
      expect(blackHolePixel(core, 0, 0, 0, 0, 0)).toBe('#000000');
      expect(blackHolePixel(core, core, 0, 0, 0, 0)).not.toBeNull();
      expect(blackHolePixel(core, core, 0, 0, 0, 0)).not.toBe('#000000');
      expect(blackHolePixel(core, 0, core * 2 + 1.5, 0, 0, 0)).toBeNull();
      expect(blackHoleSize(core)).toBeGreaterThanOrEqual(core * 4 + 2);
    }
  });
});
