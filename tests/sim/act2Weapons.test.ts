import { describe, expect, it } from 'vitest';
import { WEAPON_ORDER, type WeaponId } from '../../src/content/weapons';
import { weaponSystem } from '../../src/game/weapons';
import { cleanupSystem } from '../../src/sim/cleanup';
import { collisionSystem } from '../../src/sim/collision';
import { bulletsSystem } from '../../src/sim/motion';
import { spawnEnemy, spawnEnemyShot } from '../../src/sim/spawn';
import { rebuildSpatialHash } from '../../src/sim/spatialHash';
import type { Bullet } from '../../src/sim/types';
import { createWorld, type World } from '../../src/sim/world';

// T35 balance probe: every weapon at every level against a dummy field.
// Single = one dummy at the best of six spots 0 / 30 / 60 px off-axis and
// 80 / 140 px ahead (a player lines up the way the weapon wants); crowd = 15 dummies in a
// 5×3 block 60–108 px ahead; erase = enemy bullets per second (of 6/s aimed
// down at the ship) removed before they reach it. Damage is per second over
// 20 s. `SIM=1 npx vitest run tests/sim/act2Weapons.test.ts --silent=false`
// prints the table.

const DT = 1 / 60;
const SECONDS = 20;
const HP = 1e9;

type Field = 'single' | 'crowd' | 'erase';

function setup(id: WeaponId, level: number): World {
  const w = createWorld(`dps-${id}`);
  const p = w.player;
  p.x = 120;
  p.y = 340;
  p.maxWeaponSlots = 6;
  p.weapons.push({ id, level, cooldown: 0, state: 0 });
  return w;
}

function step(w: World): void {
  w.tick++;
  w.time += DT;
  w.player.invulnT = 1;
  weaponSystem.update(w, DT);
  bulletsSystem.update(w, DT);
  collisionSystem.update(w, DT);
  cleanupSystem.update(w, DT);
}

const SPOTS: readonly (readonly [number, number])[] = [
  [0, 80],
  [30, 80],
  [60, 80],
  [0, 140],
  [30, 140],
  [60, 140],
];

function measure(id: WeaponId, level: number, field: Field, spot = 0): number {
  if (field === 'single' && spot === 0) {
    let best = 0;
    for (let i = 1; i <= SPOTS.length; i++) best = Math.max(best, measure(id, level, field, i));
    return best;
  }
  const w = setup(id, level);
  const p = w.player;
  if (field === 'single') {
    const [dx, dy] = SPOTS[spot - 1]!;
    spawnEnemy(w, 'dummy', p.x + dx, p.y - 12 - dy, { hp: HP, vx: 0, vy: 0 });
  }
  if (field === 'crowd') {
    for (let i = 0; i < 15; i++) {
      const x = p.x - 48 + (i % 5) * 24;
      const y = p.y - 12 - 60 - Math.floor(i / 5) * 24;
      spawnEnemy(w, 'dummy', x, y, { hp: HP, vx: 0, vy: 0 });
    }
  }
  rebuildSpatialHash(w);
  let dmg = 0;
  w.events.on('enemyHit', (e) => void (dmg += e.damage));
  const tracked: { b: Bullet; id: number; y: number }[] = [];
  let erased = 0;
  const ticks = SECONDS * 60;
  for (let t = 0; t < ticks; t++) {
    if (field === 'erase' && t % 10 === 0) {
      const x = p.x - 30 + (t % 70);
      const b = spawnEnemyShot(w, { x, y: 40, vx: (p.x - x) * 0.3, vy: 90, r: 3 });
      if (b) tracked.push({ b, id: b.id, y: b.y });
    }
    step(w);
    for (let i = tracked.length - 1; i >= 0; i--) {
      const s = tracked[i]!;
      if (s.b.active && s.b.id === s.id) {
        s.y = s.b.y;
        continue;
      }
      if (s.y < p.y - 16) erased++;
      tracked.splice(i, 1);
    }
  }
  return field === 'erase' ? erased / SECONDS : dmg / SECONDS;
}

const SIM = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env
  .SIM;

describe.skipIf(SIM !== '1')('Act II weapon balance probe', () => {
  it('prints DPS and erase tables for every weapon and level', () => {
    const rows: string[] = [];
    const table: Record<string, Record<Field, number[]>> = {};
    for (const id of WEAPON_ORDER) {
      table[id] = { single: [], crowd: [], erase: [] };
      for (let lv = 1; lv <= 5; lv++) {
        for (const f of ['single', 'crowd', 'erase'] as const) {
          table[id]![f].push(measure(id, lv, f));
        }
      }
      const fmt = (f: Field) => table[id]![f].map((v) => v.toFixed(1).padStart(5)).join(' ');
      rows.push(`${id.padEnd(12)}│ ${fmt('single')} │ ${fmt('crowd')} │ ${fmt('erase')}`);
    }
    console.log(
      [
        `weapon      │ single-target dps L1–L5       │ crowd dps L1–L5               │ bullets erased/s L1–L5`,
        ...rows,
      ].join('\n'),
    );
    // Every Act II weapon does real damage at every level, and only Flak erases.
    for (const id of ['arc', 'ricochet', 'flak'] as const) {
      for (let i = 0; i < 5; i++) {
        expect(table[id]!.single[i], `${id} L${i + 1}`).toBeGreaterThan(0.5);
        expect(table[id]!.crowd[i], `${id} L${i + 1}`).toBeGreaterThan(1);
      }
    }
    expect(Math.min(...table.flak!.erase)).toBeGreaterThan(0.3);
    expect(Math.max(...table.arc!.erase, ...table.ricochet!.erase)).toBe(0);
  }, 120_000);
});
