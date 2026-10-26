import { describe, expect, it } from 'vitest';
import { LEVIATHAN } from '../../src/content/levels/armada';
import { activeBoss } from '../../src/game/boss';
import { Leviathan } from '../../src/game/levels/armada';
import { godBot } from './bots';
import { runSim } from './harness';

// T30: the Armada end to end. The generic every-sector passes (god, determinism,
// pools) live in level1.playthrough; these check the dreadnought's own flow.
const env =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const SEEDS = env.SIM === '1' ? 5 : 2;

describe('armada: fresh Kestrel, god bot', () => {
  for (let i = 0; i < SEEDS; i++) {
    it(`seed armada-plain${i}: every hull phase in order, the Paragon schematic, one victory`, () => {
      const phases: string[] = [];
      let lockedScroll = -1;
      let sunkScroll = -1;
      const r = runSim(`armada-plain${i}`, godBot(), 420, {
        levelId: 'armada',
        onTick: (w) => {
          const b = activeBoss(w);
          if (b instanceof Leviathan) {
            const ph = b.phaseName();
            if (phases[phases.length - 1] !== ph) phases.push(ph);
            if (ph === 'bridge' && lockedScroll < 0) lockedScroll = w.scrollSpeed;
          } else if (phases.includes('dying') && sunkScroll < 0 && w.scrollSpeed > 0) {
            sunkScroll = w.scrollSpeed;
          }
        },
      });
      expect(r.result.outcome).toBe('victory');
      expect(phases).toEqual(['hull', 'bridge', 'launch', 'core', 'dying']);
      expect(lockedScroll).toBe(0);
      // The wreck drifts off as the scroll comes back.
      expect(sunkScroll).toBeGreaterThan(0);
      expect(r.stats.bossAt).toBeCloseTo(145, 0);
      expect(r.stats.schematics).toContain('paragon');
      expect(r.events.filter((e) => e.type === 'bossDefeated')).toHaveLength(1);
      // Hull plus bridge: never faster than the hull takes to scroll in.
      const lockT = (LEVIATHAN.lockY + 690 - LEVIATHAN.startY) / LEVIATHAN.hullSpeed;
      expect(r.stats.bossTime).toBeGreaterThan(lockT);
      for (const [name, u] of Object.entries(r.stats.pools)) {
        expect(u.dropped, `pool ${name}`).toBe(0);
      }
      // Toasts tell the story: the sector, the frigates, the dreadnought.
      const toasts = r.events.filter((e) => e.type === 'toast').map((e) => e.data);
      expect(toasts.some((t) => t.includes('DREADNOUGHT BELOW'))).toBe(true);
      expect(toasts.some((t) => t.includes('FRIGATE'))).toBe(true);
    }, 60_000);
  }

  it('the pod is Commodore Vale, ejected once (from a wreck or at 105 s)', () => {
    let pods = 0;
    let rescued: string[] = [];
    const r = runSim('armada-pod', godBot(), 420, {
      levelId: 'armada',
      onTick: (w) => {
        let n = 0;
        for (let i = 0; i < w.pickups.count; i++) {
          const p = w.pickups.items[i]!;
          if (p.active && p.kind === 'escapePod') n++;
        }
        pods = Math.max(pods, n);
        rescued = w.run.pilotsRescued;
      },
    });
    expect(pods).toBe(1);
    const ejected = r.events.find(
      (e) =>
        e.type === 'toast' && (e.data.includes('POD EJECTED') || e.data.includes('ESCAPE POD')),
    );
    expect(ejected).toBeDefined();
    expect(ejected!.tick / 60).toBeLessThanOrEqual(105.1);
    if (r.stats.podRescued) expect(rescued).toEqual(['vale']);
  }, 60_000);
});
