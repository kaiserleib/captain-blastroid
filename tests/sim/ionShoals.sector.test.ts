import { describe, expect, it } from 'vitest';
import { activeBoss } from '../../src/game/boss';
import { godBot, SKILLS } from './bots';
import { runSim } from './harness';

// Ion Shoals beats on a full god playthrough (T27): the gauntlet's toast,
// tugs throwing rocks before the boss, every Shepherd phase, and the Warden
// schematic on a fresh save.

describe('ionShoals sector', () => {
  it('plays every beat through the Shepherd', () => {
    const phases = new Set<string>();
    let throwsBeforeBoss = 0;
    let bossUp = false;
    let wired = false;
    // The typical skill: the expert shoots tugs down before most of their throws.
    const r = runSim('ionShoals-sector', godBot(SKILLS.typical), 400, {
      levelId: 'ionShoals',
      onTick: (w) => {
        if (!wired) {
          wired = true;
          w.events.on('sfx', (p) => {
            if (p.id === 'boss_throw' && !bossUp) throwsBeforeBoss++;
          });
          w.events.on('bossSpawned', () => void (bossUp = true));
        }
        const b = activeBoss(w);
        if (b !== null) phases.add(b.phaseName());
      },
    });
    expect(r.result.outcome).toBe('victory');
    const toasts = r.events.filter((e) => e.type === 'toast').map((e) => e.data);
    expect(toasts.some((t) => t.includes("ZZ'KAR'S POD"))).toBe(true);
    expect(throwsBeforeBoss).toBeGreaterThanOrEqual(4);
    for (const p of ['entry', 'fight', 'opening', 'exposed', 'dying']) expect(phases).toContain(p);
    expect(r.stats.schematics).toEqual(['warden']);
  }, 60_000);
});
