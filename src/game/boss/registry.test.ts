import { describe, expect, it } from 'vitest';
import type { BossPartSpec } from '../../content/bosses';
import type { Renderer } from '../../gfx/renderer';
import { getEnemyDef } from '../../sim/spawn';
import type { Enemy } from '../../sim/types';
import { createWorld, type World } from '../../sim/world';
import {
  activeBoss,
  bossDamageHook,
  bossDisplayName,
  bossLayer,
  bossTargetFilter,
  BossRig,
  registerBoss,
  RockHauler,
  spawnBoss,
  updateBoss,
  type BossController,
  type PartSlot,
} from './index';

const PARTS: BossPartSpec[] = [
  { defId: 't21_core', role: 'core', ox: 0, oy: 0, hp: 40, r: 10, targetable: false },
  { defId: 't21_gun', role: 'turret', ox: 20, oy: 0, hp: 10, r: 6, targetable: true },
];

/** The smallest useful controller: shielded core until the gun falls. */
class TestBoss implements BossController {
  readonly defId = 't21_boss';
  readonly rig = new BossRig(PARTS);
  done = false;
  ticks = 0;
  spawn(w: World): boolean {
    return this.rig.spawn(w, 120, 60);
  }
  update(w: World, dt: number): void {
    this.ticks++;
    this.rig.moveTo(this.rig.x, this.rig.y, dt);
    if (!this.rig.alive(this.rig.slots[0] as PartSlot)) {
      this.done = true;
      this.rig.release(w);
    }
  }
  onDamage(_part: Enemy, slot: PartSlot, _amount: number): boolean {
    return !this.targetable(_part, slot);
  }
  targetable(_part: Enemy, slot: PartSlot): boolean {
    return slot.spec.role !== 'core' || (this.rig.slots[1] as PartSlot).destroyed;
  }
  phaseName(): string {
    return this.done ? 'done' : 'fight';
  }
}

let draws = 0;
registerBoss('t21_boss', {
  create: () => new TestBoss(),
  draw: (_w, _r, _a, b) => {
    draws += b.ticks > 0 ? 1 : 0;
  },
  displayName: 'TEST HULK',
  parts: {
    t21_core: { hp: 40, r: 10, score: 0 },
    t21_gun: { hp: 10, r: 6, score: 100 },
  },
});

describe('boss registry', () => {
  it('registers part defs as isBoss and names the boss for the HUD', () => {
    expect(getEnemyDef('t21_core').isBoss).toBe(true);
    expect(bossDisplayName('t21_boss')).toBe('TEST HULK');
    expect(bossDisplayName('rock_hauler')).toBe('ROCK HAULER');
    expect(bossDisplayName('scrap_baron')).toBe('SCRAP BARON');
  });

  it('throws on a second, different registration', () => {
    expect(() =>
      registerBoss('t21_boss', { create: () => new TestBoss(), draw: () => {} }),
    ).toThrow(/duplicate "t21_boss"/);
  });

  it('spawns through bossRequested, routes damage/targeting, and draws through the registration', () => {
    const w = createWorld('reg');
    const spawned: string[] = [];
    w.events.on('bossSpawned', (p) => spawned.push(p.defId));
    w.events.emit('bossRequested', { defId: 't21_boss' });
    updateBoss(w, 0); // subscribes
    w.events.emit('bossRequested', { defId: 't21_boss' });
    updateBoss(w, 1 / 60);
    const b = activeBoss(w) as TestBoss;
    expect(b).toBeInstanceOf(TestBoss);
    expect(spawned).toEqual(['t21_boss']);
    const core = b.rig.slots[0]!.enemy!;
    const gun = b.rig.slots[1]!.enemy!;
    expect(bossTargetFilter(w, core)).toBe(false);
    expect(bossTargetFilter(w, gun)).toBe(true);
    expect(bossDamageHook(w, core, 5)).toBe(true);
    expect(bossDamageHook(w, gun, 5)).toBe(false);
    bossLayer.draw(w, {} as Renderer, 1);
    expect(draws).toBe(1);
    expect(b.phaseName()).toBe('fight');
  });

  it('spawnBoss returns null for unknown ids', () => {
    expect(spawnBoss(createWorld('x'), 'nobody')).toBeNull();
  });

  it('the Rock Hauler is a registered controller with named phases', () => {
    const w = createWorld('rh', { levelId: 'kessler' });
    const b = spawnBoss(w, 'rock_hauler');
    expect(b).toBeInstanceOf(RockHauler);
    expect(b!.defId).toBe('rock_hauler');
    expect(b!.phaseName()).toBe('entry');
  });
});
