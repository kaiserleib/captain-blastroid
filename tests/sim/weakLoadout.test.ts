import { env } from 'node:process';
import { describe, expect, it } from 'vitest';
import { LEVEL_ORDER } from '../../src/content/levels';
import type { World } from '../../src/sim/world';
import { godBot } from './bots';
import { runSim } from './harness';

// A player who reaches a boss holding only a Blaster L2 must still be able to
// win by surviving: BOSS_ASSIST ramps their damage once the fight runs long.
// Without it the Rock Hauler and Perihelion never die and the rest take 4–6 min.
// The limit counts from the boss's own stall breaker (T43): 150 s after
// `assistAfter`, i.e. 4 min for the default 90 s and 5 min for the Architect.

const FULL = env.SIM === '1';
/** Seconds a Blaster L2 may take once the stall breaker starts ramping. */
const LIMIT_AFTER_ASSIST = 150;

function blasterOnly(w: World): void {
  const ws = w.player.weapons;
  for (let i = ws.length - 1; i >= 0; i--) {
    if (ws[i]!.id !== 'blaster') ws.splice(i, 1);
    else ws[i]!.level = 2;
  }
}

describe('Blaster L2 alone vs every boss', () => {
  for (const levelId of LEVEL_ORDER) {
    it.runIf(FULL || levelId === 'kessler')(
      `${levelId}: an invulnerable Blaster L2 finishes the boss within 150 s of the stall breaker`,
      () => {
        const r = runSim(`weak-${levelId}`, godBot(), 600, { levelId, onTick: blasterOnly });
        expect(r.stats.weaponsAtBoss).toBe('blaster2');
        console.log(
          `WEAK ${levelId} ${r.stats.bossTime.toFixed(0)} s (limit ${r.stats.assistAfter + LIMIT_AFTER_ASSIST})`,
        );
        expect(r.stats.bossDefeated, `boss time ${r.stats.bossTime.toFixed(0)} s`).toBe(true);
        expect(r.stats.bossTime).toBeLessThan(r.stats.assistAfter + LIMIT_AFTER_ASSIST);
      },
      120_000,
    );
  }
});
