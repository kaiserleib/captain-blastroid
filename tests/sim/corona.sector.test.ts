import { describe, expect, it } from 'vitest';
import { activeBoss } from '../../src/game/boss';
import { LensPhase, mem } from '../../src/game/levels/corona/behaviors';
import { flareState, hazardLog, isFlareBurning, shadeSlabs } from '../../src/game/obstacles';
import type { Enemy } from '../../src/sim/types';
import { debugSave } from '../../src/ui/debugSaves';
import { godBot, SKILLS } from './bots';
import { runSim } from './harness';

// Corona Drift's signature beats on a full god playthrough (T38), with the
// act1 save the sector is balanced on: the Arc Coil field test, the practice
// flare and every flare after it (≈ no fizzles), each new enemy doing its
// thing, the storm, the pod, the CME's 3 s burns, and every Heliostat phase
// down to the Shrike schematic.

describe('corona sector', () => {
  it('plays every beat through the Heliostat', () => {
    const phases = new Set<string>();
    const seen = new Set<string>();
    let skimmerFast = false;
    let shadeTucked = false;
    let lensBeam = false;
    let cmeBurn = false;
    let bossSlab = false;
    let log: readonly string[] = [];
    const r = runSim('corona-sector', godBot(SKILLS.typical), 420, {
      levelId: 'corona',
      save: debugSave('act1'),
      onTick: (w) => {
        log = hazardLog(w);
        const f = flareState(w);
        if (f !== undefined && f.phase === 'burn' && f.burn >= 3) cmeBurn = true;
        const es = w.enemies.items;
        for (let i = 0; i < w.enemies.count; i++) {
          const e = es[i] as Enemy;
          if (!e.active || !e.defId.startsWith('co_')) continue;
          seen.add(e.defId);
          if (e.defId === 'co_sunskimmer' && isFlareBurning(w) && Math.hypot(e.vx, e.vy) > 150)
            skimmerFast = true;
          if (e.defId === 'co_shade' && mem(e).tucked) shadeTucked = true;
          if (e.defId === 'co_lens' && mem(e).phase === LensPhase.Beam) lensBeam = true;
        }
        const b = activeBoss(w);
        if (b !== null) {
          phases.add(b.phaseName());
          if (shadeSlabs(w).some((s) => s.active && s.vy !== w.scrollSpeed)) bossSlab = true;
        }
      },
    });
    expect(r.result.outcome).toBe('victory');
    const toasts = r.events.filter((e) => e.type === 'toast').map((e) => e.data);
    for (const t of [
      'HIDE IN THE SHADOWS',
      'CORONA STORM',
      'POD AHEAD',
      'CORONAL MASS',
      'SOLAR FURNACE',
    ])
      expect(
        toasts.some((x) => x.includes(t)),
        t,
      ).toBe(true);
    // The field test hands over the Arc Coil.
    expect(r.stats.weaponsAtBoss).toContain('arc');
    // The practice flare, then 15 real flares before the boss (more during it).
    expect(log.some((l) => l.includes('flare practice'))).toBe(true);
    expect(log.filter((l) => !l.includes('practice')).length).toBeGreaterThanOrEqual(17);
    expect(log.filter((l) => l.includes('fizzle')).length).toBeLessThanOrEqual(1);
    expect(cmeBurn).toBe(true);
    for (const id of ['co_sunskimmer', 'co_shade', 'co_lens', 'co_helio_core'])
      expect(seen).toContain(id);
    expect(skimmerFast).toBe(true);
    expect(shadeTucked).toBe(true);
    expect(lensBeam).toBe(true);
    expect(bossSlab).toBe(true);
    for (const p of ['entry', 'phase1', 'furnace', 'dying']) expect(phases).toContain(p);
    expect(r.stats.schematics).toEqual(['shrike']);
  }, 60_000);
});
