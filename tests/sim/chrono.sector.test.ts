import { describe, expect, it } from 'vitest';
import { activeBoss } from '../../src/game/boss';
import { chronoState, Echo } from '../../src/game/levels/chrono';
import { bubbles } from '../../src/game/obstacles';
import type { Pickup } from '../../src/sim/types';
import type { World } from '../../src/sim/world';
import { godBot, SKILLS } from './bots';
import { runSim } from './harness';

// Chrono Rift beats on a full god playthrough (T41): the slow and fast field
// toasts, Stutterer crosses, Rewinders, bubble-mine pops, the echo pod and the
// real pod on its exact path, the time storm's flip bubbles, every Echo phase
// with PARADOX, and the Revenant schematic on a fresh save.

describe('chrono sector', () => {
  it('plays every beat through the Echo', () => {
    const phases: string[] = [];
    const kinds = new Set<string>();
    let echoPodAt = -1;
    let realPodAt = -1;
    let replayed = 0;
    let offPath = 0;
    let world: World | null = null;
    const r = runSim('chrono-sector', godBot(SKILLS.typical), 420, {
      levelId: 'chrono',
      onTick: (w) => {
        world = w;
        const b = activeBoss(w);
        if (b instanceof Echo && phases[phases.length - 1] !== b.phaseName())
          phases.push(b.phaseName());
        for (const x of bubbles(w)) if (x.active) kinds.add(x.kind);
        const p = chronoState(w).pod;
        if (p.active && echoPodAt < 0) echoPodAt = w.time;
        if (p.realId >= 0) {
          if (realPodAt < 0) realPodAt = w.time;
          for (let i = 0; i < w.pickups.count; i++) {
            const k = w.pickups.items[i] as Pickup;
            if (!k.active || k.id !== p.realId) continue;
            const age = w.tick - p.realTick;
            if (age <= 0 || age >= p.len) continue;
            replayed++;
            if (Math.abs(k.y - (p.path[age * 2 + 1] as number)) > 1e-6) offPath++;
          }
        }
      },
    });
    expect(r.result.outcome).toBe('victory');
    const toasts = r.events.filter((e) => e.type === 'toast').map((e) => e.data);
    for (const t of [
      'SLOW FIELD',
      'FAST FIELD',
      'FINISH THEM FAST',
      'POD ECHO AHEAD',
      "HALASZ'S POD FOLLOWS",
      'TIME STORM',
      'PARADOX',
    ])
      expect(
        toasts.some((x) => x.includes(t)),
        t,
      ).toBe(true);
    expect(echoPodAt).toBeCloseTo(100, 0);
    expect(realPodAt).toBeCloseTo(106, 0);
    expect(replayed).toBeGreaterThan(60);
    expect(offPath).toBe(0);
    const st = chronoState(world!);
    expect(st.stutterRings).toBeGreaterThan(5);
    expect(st.minePops).toBeGreaterThanOrEqual(5);
    expect(st.rewinds + st.denied).toBeGreaterThanOrEqual(1);
    expect([...kinds].sort()).toEqual(['fast', 'flip', 'slow']);
    expect(phases).toEqual(['entry', 'echo', 'ghost', 'paradox', 'dying']);
    expect(r.stats.bossAt).toBeCloseTo(179, 0);
    expect(r.stats.schematics).toEqual(['revenant']);
    for (const [name, u] of Object.entries(r.stats.pools)) expect(u.dropped, name).toBe(0);
  }, 60_000);
});
