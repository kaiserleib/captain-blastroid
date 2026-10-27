import { describe, expect, it } from 'vitest';
import { BEAT } from '../../src/content/levels/foundry';
import { activeBoss } from '../../src/game/boss';
import { directorTime, escapeTimeLeft } from '../../src/game/director';
import { foundryState, PULSE_PERIOD } from '../../src/game/levels/foundry/scripts';
import { bubbles, flareState, portalPairs, pulseIndex, shadeSlabs } from '../../src/game/obstacles';
import { terrainActive } from '../../src/game/terrain';
import type { Anomaly, Enemy } from '../../src/sim/types';
import { debugSave } from '../../src/ui/debugSaves';
import { godBot, SKILLS } from './bots';
import { runSim } from './harness';

// The Foundry's signature beats on a god playthrough (T42): Cranes throwing
// scrap in the yard, the captive massive hole in its slab ring, turning
// pulsars pulsing on the `foundry` beat during the 30 → 60 surge, flares and
// the portal conveyor carrying the pod, assembly corridors with slow bubbles,
// every Architect form, and the escape's corridors through to the win.

describe('foundry sector', () => {
  it('plays every beat through the Architect and the escape', () => {
    const phases = new Set<string>();
    let throwsBeforeBoss = 0;
    let bossUp = false;
    let wired = false;
    let containment = false;
    let surgePulsar = false;
    const offBeat: number[] = [];
    const lastPulse = new Map<number, number>();
    let maxPairs = 0;
    let maxFlares = 0;
    let assemblyTerrain = false;
    let assemblyBubble = false;
    let escapeTerrain = false;
    let escapeEnemies = 0;
    let escapeRocks = 0;
    const r = runSim('foundry-sector', godBot(SKILLS.typical), 420, {
      levelId: 'foundry',
      save: debugSave('act1'),
      loadout: [{ id: 'blaster', level: 4 }],
      onTick: (w) => {
        if (!wired) {
          wired = true;
          w.events.on('sfx', (p) => {
            if (p.id === 'boss_throw' && !bossUp) throwsBeforeBoss++;
          });
          w.events.on('bossSpawned', () => void (bossUp = true));
        }
        const t = directorTime(w);
        const b = activeBoss(w);
        if (b !== null) phases.add(b.phaseName());
        for (let i = 0; i < w.anomalies.count; i++) {
          const a = w.anomalies.items[i] as Anomaly;
          if (!a.active) continue;
          if (a.kind === 'blackhole' && t > 40 && t < 75 && a.radius >= 160) {
            if (shadeSlabs(w).filter((s) => s.active).length >= 4) containment = true;
          }
          if (a.kind === 'pulsar' && t > 80 && t < 116) {
            if (w.scrollSpeed > 55) surgePulsar = true;
            const k = pulseIndex(a);
            if (k !== (lastPulse.get(a.id) ?? 0)) {
              lastPulse.set(a.id, k);
              // Each pulse lands on the beat (within a tick).
              const off = t % BEAT;
              offBeat.push(Math.min(off, BEAT - off));
            }
          }
        }
        if (t > 115 && t < 150) {
          maxPairs = Math.max(maxPairs, portalPairs(w).filter((p) => p.active).length);
          maxFlares = Math.max(maxFlares, flareState(w)?.count ?? 0);
        }
        if (t > 152 && t < 186 && b === null) {
          if (terrainActive(w)) assemblyTerrain = true;
          if (bubbles(w).some((x) => x.active && x.kind === 'slow')) assemblyBubble = true;
        }
        if (escapeTimeLeft(w) >= 0 && escapeTimeLeft(w) < 36) {
          if (terrainActive(w)) escapeTerrain = true;
          for (let i = 0; i < w.enemies.count; i++) {
            const e = w.enemies.items[i] as Enemy;
            if (e.active && !e.isBoss) escapeEnemies++;
          }
          for (let i = 0; i < w.asteroids.count; i++)
            if (w.asteroids.items[i]!.active) escapeRocks++;
        }
      },
    });
    expect(r.result.outcome).toBe('victory');
    expect(throwsBeforeBoss).toBeGreaterThanOrEqual(3);
    expect(containment).toBe(true);
    expect(surgePulsar).toBe(true);
    expect(offBeat.length).toBeGreaterThanOrEqual(5);
    for (const d of offBeat) expect(d).toBeLessThan(1 / 60 + 0.002);
    expect(PULSE_PERIOD / BEAT).toBeCloseTo(7, 9);
    expect(maxPairs).toBe(2);
    expect(maxFlares).toBeGreaterThanOrEqual(2);
    expect(r.stats.podRescued).toBe(true);
    expect(assemblyTerrain).toBe(true);
    expect(assemblyBubble).toBe(true);
    for (const p of ['entry', 'scaffold', 'fall', 'engine', 'collapse', 'paradox', 'dying'])
      expect(phases).toContain(p);
    const types = r.events.map((e) => e.type);
    expect(types.indexOf('bossDefeated')).toBeLessThan(types.indexOf('levelComplete'));
    expect(types).toContain('escapeStarted');
    expect(escapeTerrain).toBe(true);
    expect(escapeEnemies).toBe(0);
    expect(escapeRocks).toBeGreaterThan(0);
    const toasts = r.events.filter((e) => e.type === 'toast').map((e) => e.data);
    expect(toasts.some((t) => t.includes('ESCAPE BONUS'))).toBe(true);
    expect(r.stats.schematics).toEqual(['nova']);
    expect(foundryState).toBeDefined();
  }, 120_000);
});
