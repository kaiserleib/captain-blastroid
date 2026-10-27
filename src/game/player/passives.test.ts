import { describe, expect, it } from 'vitest';
import type { DropTable } from '../../content/dropTables';
import { PILOT_ABILITY_TUNING as A } from '../../content/pilots';
import type { Rng } from '../../engine/rng';
import { computePlayerStats, createDefaultSave } from '../../meta';
import { playerShotVsAsteroid } from '../../sim/collisionRules';
import { damagePlayer } from '../../sim/damage';
import { spawnAsteroid, spawnPlayerShot } from '../../sim/spawn';
import type { Asteroid } from '../../sim/types';
import { createWorld, type World } from '../../sim/world';
import { attachPickups, rollDrop } from '../pickups';
import { getPlayerRuntime, initPlayer, updatePlayer } from './playerSystem';

const DT = 1 / 60;

function world(ship: string, pilot: string): World {
  const w = createWorld('PASSIVE', { shipId: ship, pilotId: pilot });
  initPlayer(w, computePlayerStats(createDefaultSave(), ship, pilot));
  return w;
}

function run(w: World, seconds: number): void {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) updatePlayer(w, DT);
}

describe('Ines: solar cells', () => {
  it('regains one shield after 25 s without a hit, then needs another 25 s', () => {
    const w = world('kestrel', 'ines');
    const sfx: string[] = [];
    w.events.on('sfx', (e) => sfx.push(e.id));
    damagePlayer(w, 2);
    expect(w.player.shield).toBe(1);
    run(w, A.solarRegenAfter - 0.1);
    expect(w.player.shield).toBe(1);
    run(w, 0.1);
    expect(w.player.shield).toBe(2);
    expect(getPlayerRuntime(w).goldFlashT).toBeGreaterThan(0);
    expect(sfx).toContain('shield_up');
    run(w, A.solarRegenAfter - 0.1);
    expect(w.player.shield).toBe(2);
    run(w, 0.1);
    expect(w.player.shield).toBe(3);
  });

  it('restarts the clock on every hit', () => {
    const w = world('kestrel', 'ines');
    damagePlayer(w, 1);
    run(w, 20);
    w.player.invulnT = 0;
    damagePlayer(w, 1);
    run(w, 20);
    expect(w.player.shield).toBe(1);
    run(w, 5);
    expect(w.player.shield).toBe(2);
  });

  it('never goes over max, and tops up as soon as a shield is missing', () => {
    const w = world('kestrel', 'ines');
    run(w, 60);
    expect(w.player.shield).toBe(w.player.maxShield);
    // Shield lost without a hit event (e.g. a scripted drain) refills on the next tick.
    w.player.shield--;
    run(w, DT);
    expect(w.player.shield).toBe(w.player.maxShield);
  });

  it('other pilots never regenerate', () => {
    const w = world('kestrel', 'blastroid');
    damagePlayer(w, 1);
    run(w, 60);
    expect(w.player.shield).toBe(2);
  });
});

describe('Halasz: bullet time', () => {
  it('slows enemy bullets to 0.5x for 2 s after a hit, then restores 1x', () => {
    const w = world('kestrel', 'halasz');
    expect(w.enemyBulletTimeScale).toBe(1);
    damagePlayer(w, 1);
    expect(w.enemyBulletTimeScale).toBe(A.bulletTimeScale);
    run(w, A.bulletTimeDur - 0.1);
    expect(w.enemyBulletTimeScale).toBe(A.bulletTimeScale);
    run(w, 0.1);
    expect(w.enemyBulletTimeScale).toBe(1);
  });

  it('a second hit refreshes the window', () => {
    const w = world('kestrel', 'halasz');
    damagePlayer(w, 1);
    run(w, 1.5);
    w.player.invulnT = 0;
    damagePlayer(w, 1);
    run(w, 1.5);
    expect(w.enemyBulletTimeScale).toBe(A.bulletTimeScale);
    run(w, 0.5);
    expect(w.enemyBulletTimeScale).toBe(1);
  });

  it('the killing hit does not start it, and death ends it', () => {
    const w = world('dart', 'halasz');
    damagePlayer(w, 1);
    expect(w.enemyBulletTimeScale).toBe(A.bulletTimeScale);
    w.player.invulnT = 0;
    damagePlayer(w, 5);
    expect(w.player.alive).toBe(false);
    run(w, DT);
    expect(w.enemyBulletTimeScale).toBe(1);
  });

  it('other pilots leave the scale alone', () => {
    const w = world('kestrel', 'vale');
    damagePlayer(w, 1);
    expect(w.enemyBulletTimeScale).toBe(1);
  });
});

describe('Wren: slots and shield', () => {
  it('flies a Nova with 6 slots (capped) and a 3-shield hull', () => {
    const w = world('nova', 'wren');
    expect(w.player.maxWeaponSlots).toBe(6);
    expect(w.player.maxShield).toBe(3);
  });

  it('a 2-shield ship keeps 1 shield', () => {
    const w = world('wraith', 'wren');
    expect(w.player.maxShield).toBe(1);
    expect(w.player.shield).toBe(1);
  });
});

describe('Rook: rock damage and salvage', () => {
  function rockWorld(pilot: string): World {
    const w = world('ferret', pilot);
    attachPickups(w);
    return w;
  }

  function shoot(w: World, damage: number): Asteroid {
    const a = spawnAsteroid(w, { x: 120, y: 100, vx: 0, vy: 0, r: 10, hp: 10, size: 'large' });
    const s = spawnPlayerShot(w, { x: 120, y: 100, vx: 0, vy: -300, damage });
    if (!a || !s) throw new Error('pool');
    playerShotVsAsteroid(w, s, a);
    return a;
  }

  function salvageOnField(w: World): number {
    let n = 0;
    for (const p of w.pickups.items.slice(0, w.pickups.count)) {
      if (p.active && p.kind === 'salvage') n += p.amount;
    }
    return n;
  }

  it('player shots do 1.5x to asteroids for Rook only', () => {
    expect(shoot(rockWorld('rook'), 2).hp).toBe(7);
    expect(shoot(rockWorld('blastroid'), 2).hp).toBe(8);
  });

  it('every asteroid the player destroys drops one more salvage, on top of the same roll', () => {
    const rook = rockWorld('rook');
    const base = rockWorld('blastroid');
    shoot(rook, 20);
    shoot(base, 20);
    expect(salvageOnField(rook)).toBe(salvageOnField(base) + 1);
  });
});

describe('Nyx: rare drops', () => {
  const table: DropTable = [
    { kind: 'none', weight: 1 },
    { kind: 'shield', weight: 1 },
  ];
  const fixed = (v: number) => ({ next: () => v }) as unknown as Rng;

  it('weights shield/upgrade/magnet/repulsor entries by rareDropMul', () => {
    // total 2 → 0.9 lands in `none`; total 2.25 → 1.0125 lands in `shield`.
    expect(rollDrop(table, fixed(0.45))?.kind).toBe('none');
    expect(rollDrop(table, fixed(0.45), 0, 1.25)?.kind).toBe('shield');
  });

  it('a 1x multiplier is the plain roll', () => {
    for (const v of [0, 0.2, 0.4999, 0.5, 0.9]) {
      expect(rollDrop(table, fixed(v), 0, 1)).toBe(rollDrop(table, fixed(v)));
    }
  });
});
