import { describe, expect, it } from 'vitest';
import { activeBoss } from '../../src/game/boss';
import { Wyrm } from '../../src/game/levels/warrens';
import type { Asteroid, Enemy, Pickup } from '../../src/sim/types';
import type { World } from '../../src/sim/world';
import { godBot, SKILLS, type Bot } from './bots';
import { runSim } from './harness';

// The Warrens' signature beats on a full god playthrough (T39): the cave mouth
// and its toast, turrets in their sockets, the carrier's chamber, the gate
// rows, borers ringing into the far wall, bat flocks, Rook's pod shot out of
// its alcove, the crush's 34 px/s, rock falls in the collapse, the den's scroll
// stop, every Wyrm phase (with FRENZY carving the pillars) and the Ferret.

/** The god bot, but it flies to the pod once it's out of its alcove (a player chasing the rescue). */
function podChaser(): Bot {
  const inner = godBot(SKILLS.typical);
  return {
    name: 'god-podchaser',
    god: true,
    start: (w) => inner.start(w),
    decide(w: World) {
      inner.decide(w);
      for (let i = 0; i < w.pickups.count; i++) {
        const k = w.pickups.items[i] as Pickup;
        if (!k.active || k.kind !== 'escapePod' || k.y < 140) continue;
        w.input.targetX = k.x;
        w.input.targetY = Math.max(k.y + 10, 160);
        return;
      }
    },
  };
}

describe('warrens sector', () => {
  it('plays every beat through the Wyrm', () => {
    const seen = new Set<string>();
    const phases = new Set<string>();
    let maxScroll = 0;
    let minNarrows = Infinity;
    let scrollAtBoss = -1;
    let carved = 0;
    let fallingRocks = 0;
    let ringDigs = 0;
    const r = runSim('warrens-sector', podChaser(), 420, {
      levelId: 'warrens',
      onTick: (w) => {
        for (let i = 0; i < w.enemies.count; i++) {
          const e = w.enemies.items[i] as Enemy;
          if (!e.active) continue;
          seen.add(e.defId);
          if (e.defId === 'wr_borer' && e.state === 4) ringDigs++;
        }
        if (w.time > 116 && w.time < 145) maxScroll = Math.max(maxScroll, w.scrollSpeed);
        if (w.time > 50 && w.time < 68) minNarrows = Math.min(minNarrows, w.scrollSpeed);
        if (w.time > 150 && w.time < 168) {
          for (let i = 0; i < w.asteroids.count; i++) {
            const a = w.asteroids.items[i] as Asteroid;
            if (a.active && a.y < 30 && a.vy > w.scrollSpeed + 20) fallingRocks++;
          }
        }
        const b = activeBoss(w);
        if (b instanceof Wyrm) {
          phases.add(b.phaseName());
          carved = Math.max(carved, b.carved);
          if (scrollAtBoss < 0 && b.phaseName() === 'burrow') scrollAtBoss = w.scrollSpeed;
        }
      },
    });
    expect(r.result.outcome).toBe('victory');
    const toasts = r.events.filter((e) => e.type === 'toast').map((e) => e.data);
    for (const t of ['THE WARRENS,', 'SHOOT THE GATES', 'POD BEHIND THE GATE', 'FRENZY']) {
      expect(
        toasts.some((x) => x.includes(t)),
        t,
      ).toBe(true);
    }
    for (const id of ['wr_turret', 'wr_borer', 'wr_bat', 'carrier', 'gunboat'])
      expect(seen, id).toContain(id);
    expect(ringDigs).toBeGreaterThan(0);
    expect(minNarrows).toBeCloseTo(22, 5);
    expect(maxScroll).toBeCloseTo(34, 5);
    expect(fallingRocks).toBeGreaterThan(0);
    expect(scrollAtBoss).toBe(0);
    for (const p of ['entry', 'burrow', 'frenzy', 'dying']) expect(phases).toContain(p);
    expect(carved).toBeGreaterThan(0);
    expect(r.stats.podRescued).toBe(true);
    expect(r.stats.schematics).toEqual(['ferret']);
    expect(r.stats.bossTime).toBeGreaterThan(20);
  }, 60_000);
});
