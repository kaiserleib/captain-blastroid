import { describe, expect, it } from 'vitest';
import type { World } from '../../src/sim/world';
import { godBot } from './bots';
import { runSim } from './harness';

// T26: a drone-heavy loadout must be able to finish the Rock Hauler. Before
// drone sparks, drones only dealt contact damage and the core stalled.
const FORCED: Readonly<Record<string, number>> = { blaster: 2, orbitDrones: 5 };
const LOADOUT = Object.entries(FORCED).map(([id, level]) => ({ id, level }));

/** Keeps the loadout fixed: pickups can't add or level weapons. */
function forceLoadout(w: World): void {
  const ws = w.player.weapons;
  for (let i = ws.length - 1; i >= 0; i--) {
    const inst = ws[i]!;
    const level = FORCED[inst.id];
    if (level === undefined) ws.splice(i, 1);
    else inst.level = level;
  }
}

describe('orbit drones vs the Rock Hauler', () => {
  for (let i = 0; i < 3; i++) {
    it(`seed drones${i}: Blaster 2 + Drones 5 defeats the boss within 150 s`, () => {
      const r = runSim(`drones${i}`, godBot(), 480, { loadout: LOADOUT, onTick: forceLoadout });
      expect(r.stats.weaponsAtBoss).toBe('blaster2 orbitDrones5');
      expect(r.stats.reachedBoss).toBe(true);
      expect(r.stats.bossDefeated, `boss time ${r.stats.bossTime.toFixed(0)} s`).toBe(true);
      expect(r.stats.bossTime).toBeLessThan(150);
      expect(r.result.outcome).toBe('victory');
    }, 60_000);
  }
});
