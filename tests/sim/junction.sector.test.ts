import { describe, expect, it } from 'vitest';
import { PORTAL } from '../../src/content/obstacles';
import { activeBoss } from '../../src/game/boss';
import { AegisState, BlinkState, Janus } from '../../src/game/levels/junction';
import { portalPairs } from '../../src/game/obstacles';
import { spawnPlayerShot } from '../../src/sim/spawn';
import type { Enemy, Pickup } from '../../src/sim/types';
import type { World } from '../../src/sim/world';
import { debugSave } from '../../src/ui/debugSaves';
import { godBot, SKILLS } from './bots';
import { createSimWorld, runSim, SIM_SYSTEMS } from './harness';

// Wormhole Junction beats on a full god playthrough (T40): the portal teacher
// at 25 s, Blinkers going through rings, pylons carrying ends, Nyx's pod
// carried by the ring chain, the rush's swaps, the feedback loop pouring
// bodies round, and every Janus phase with face hits through the rings.

const DT = 1 / 60;

function step(w: World): void {
  w.tick++;
  w.time += DT;
  for (const s of SIM_SYSTEMS) s.update(w, DT);
}

describe('junction sector', () => {
  it('plays every beat through Janus', () => {
    const phases = new Set<string>();
    let blinkerHolds = 0;
    let pylonCarries = 0;
    let podJumps = 0;
    let loopJumps = 0;
    let swapsStarted = 0;
    let janus: Janus | null = null;
    const podY = new Map<number, number>();
    const gnatY = new Map<number, number>();
    const seenHold = new Set<number>();
    const r = runSim('junction-sector', godBot(SKILLS.typical), 420, {
      levelId: 'junction',
      save: debugSave('act1'),
      onTick: (w) => {
        for (const p of portalPairs(w)) {
          if (p.active && p.swapT > PORTAL.swapTime - DT * 1.5) swapsStarted++;
        }
        for (let i = 0; i < w.enemies.count; i++) {
          const e = w.enemies.items[i] as Enemy;
          if (!e.active) continue;
          if (e.defId === 'wj_blinker' && e.state === BlinkState.Hold && !seenHold.has(e.id)) {
            seenHold.add(e.id);
            blinkerHolds++;
          }
          if (e.defId === 'wj_pylon' && e.state === 2) pylonCarries++;
          if (e.defId === 'gnat') {
            const y = gnatY.get(e.id);
            if (y !== undefined && y - e.y > 200 && w.time > 145) loopJumps++;
            gnatY.set(e.id, e.y);
          }
        }
        for (let i = 0; i < w.pickups.count; i++) {
          const k = w.pickups.items[i] as Pickup;
          if (!k.active || k.kind !== 'escapePod') continue;
          const y = podY.get(k.id);
          if (y !== undefined && Math.abs(k.y - y) > 40) podJumps++;
          podY.set(k.id, k.y);
        }
        const b = activeBoss(w);
        if (b instanceof Janus) {
          janus = b;
          phases.add(b.phaseName());
        }
      },
    });
    expect(r.result.outcome).toBe('victory');
    const toasts = r.events.filter((e) => e.type === 'toast').map((e) => e.data);
    for (const t of [
      'PORTALS: WHAT GOES IN COMES OUT',
      'SHOOT THROUGH THE RING',
      "NYX CALDER'S POD",
      'JUNCTION RUSH',
      'FEEDBACK LOOP',
      'SHOOT THROUGH THE RINGS',
    ]) {
      expect(
        toasts.some((x) => x.includes(t)),
        t,
      ).toBe(true);
    }
    expect(blinkerHolds).toBeGreaterThanOrEqual(4);
    expect(pylonCarries).toBeGreaterThan(0);
    // Nyx's pod falls into the top ring and comes out mid-screen (the god bot grabs it
    // there; the whole chain is a unit test in game/levels/junction).
    expect(podJumps).toBeGreaterThanOrEqual(1);
    expect(r.stats.podRescued).toBe(true);
    // Three rush swaps (two pairs flicker per swap) and bodies going round the loop.
    expect(swapsStarted).toBeGreaterThanOrEqual(6);
    expect(loopJumps).toBeGreaterThan(0);
    for (const p of ['entry', 'fight', 'frenzy', 'dying']) expect(phases).toContain(p);
    const j = janus as unknown as Janus;
    expect(j.ringHits).toBeGreaterThan(20);
    expect(j.swaps).toBeGreaterThan(0);
    expect(r.stats.schematics).toEqual(['wraith']);
  }, 120_000);

  it('teaching beat: a straight-up stream into the low ring damages the first Aegis', () => {
    const w = createSimWorld('junction-teach', { levelId: 'junction', save: debugSave('act1') });
    w.player.invulnT = 1e9;
    let aegis: Enemy | null = null;
    while (w.time < 30 && aegis === null) {
      step(w);
      for (let i = 0; i < w.enemies.count; i++) {
        const e = w.enemies.items[i] as Enemy;
        if (e.active && e.defId === 'wj_aegis' && e.state === AegisState.Hold) aegis = e;
      }
    }
    expect(aegis).not.toBeNull();
    const a = aegis as Enemy;
    // The ring sits right under it at the ship's level.
    const ring = portalPairs(w).find((p) => p.active && Math.abs(p.b.x - a.x) < 2);
    expect(ring).toBeDefined();
    const hp = a.hp;
    const shot = { x: 0, y: 0, vx: 0, vy: -300, r: 2, damage: 1, weaponId: 'blaster' };
    for (let i = 0; i < 90 && a.active; i++) {
      if (i % 6 === 0) {
        shot.x = (ring as { a: { x: number } }).a.x;
        shot.y = 330;
        spawnPlayerShot(w, shot);
      }
      step(w);
    }
    expect(a.active ? a.hp : 0).toBeLessThan(hp);
  });
});
