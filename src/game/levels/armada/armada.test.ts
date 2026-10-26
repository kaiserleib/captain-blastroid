import { describe, expect, it } from 'vitest';
import { FRIGATE, LEVIATHAN, LEVIATHAN_PARTS, MINE, POD } from '../../../content/levels/armada';
import { cleanupSystem } from '../../../sim/cleanup';
import { damageEnemy } from '../../../sim/damage';
import { bulletsSystem } from '../../../sim/motion';
import { spawnEnemy } from '../../../sim/spawn';
import type { Enemy, Pickup } from '../../../sim/types';
import { createWorld, type World } from '../../../sim/world';
import { activeBoss, attachBoss, spawnBoss, updateBoss, type PartSlot } from '../../boss';
import { setEnemyShotSpeedMul, updateEnemies } from '../../enemies';
import { attachPickups } from '../../pickups';
import '../index';
import { ESCORT_DIVE, ESCORT_STRAFE, lineBurst, MINE_ARMED, MINE_DRIFT } from './behaviors';
import { frigateOf, turretsAlive } from './frigate';
import { Leviathan, LevPhase } from './leviathan';
import { podFallback } from './pod';
import { armadaState } from './state';

const DT = 1 / 60;

function world(seed = 'T30'): World {
  const w = createWorld(seed, { levelId: 'armada' });
  w.scrollSpeed = 24;
  w.player.x = 120;
  w.player.y = 340;
  w.player.invulnT = 1e9;
  return w;
}

function step(w: World): void {
  w.tick++;
  w.time += DT;
  updateEnemies(w, DT);
  updateBoss(w, DT);
  bulletsSystem.update(w, DT);
  cleanupSystem.update(w, DT);
}

function run(w: World, seconds: number, each?: () => void): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    each?.();
    step(w);
  }
}

function shots(w: World): number {
  let n = 0;
  for (let i = 0; i < w.enemyShots.count; i++) if (w.enemyShots.items[i]?.active) n++;
  return n;
}

function count(w: World, defId: string): number {
  let n = 0;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i];
    if (e?.active && e.defId === defId) n++;
  }
  return n;
}

function spawn(w: World, id: string, x: number, y: number): Enemy {
  const e = spawnEnemy(w, id, x, y);
  if (e === null) throw new Error('pool full');
  return e;
}

describe('escort fighter', () => {
  it('dives to its hold line on an outward arc, then strafes off the far side', () => {
    const w = world();
    const e = spawn(w, 'ar_escort', 60, -16);
    step(w);
    expect(e.state).toBe(ESCORT_DIVE);
    expect(e.ax).toBe(1);
    expect(e.vx).toBeLessThan(0);
    run(w, 3.2, () => {
      if (e.state === ESCORT_STRAFE) return;
      expect(e.y).toBeLessThan(e.ay + 4);
    });
    expect(e.state).toBe(ESCORT_STRAFE);
    expect(e.vx).toBeGreaterThan(40);
  });

  it('an override sends a centered wing one way, and it holds fire after its pass', () => {
    const w = world();
    const e = spawnEnemy(w, 'ar_escort', 120, -16, { ax: -1 }) as Enemy;
    run(w, 3.5);
    expect(e.vx).toBeLessThan(0);
    run(w, 0.2);
    expect(e.fireT).toBe(Infinity);
  });

  it('never fires in its first half second', () => {
    const w = world();
    spawn(w, 'ar_escort', 120, 120);
    run(w, 0.5);
    expect(shots(w)).toBe(0);
  });
});

describe('minelayer and ion mines', () => {
  it('crosses at its height dropping a mine every 1.5 s over the field', () => {
    const w = world();
    const e = spawn(w, 'ar_minelayer', -18, 40);
    run(w, 6);
    expect(e.y).toBeCloseTo(40, 5);
    expect(e.vx).toBeGreaterThan(0);
    const mines = count(w, 'ar_mine');
    expect(mines).toBeGreaterThanOrEqual(3);
    expect(mines).toBeLessThanOrEqual(4);
  });

  it('arms when the player comes close and bursts into a ring arm s later', () => {
    const w = world();
    const m = spawn(w, 'ar_mine', 120, 312);
    w.scrollSpeed = 0;
    step(w);
    expect(m.state).toBe(MINE_ARMED);
    run(w, MINE.arm - 0.1);
    expect(shots(w)).toBe(0);
    run(w, 0.15);
    expect(m.active).toBe(false);
    expect(shots(w)).toBe(MINE.n);
  });

  it('bursts on its own after the fuse, and shot down first it just pops', () => {
    const w = world();
    const a = spawn(w, 'ar_mine', 40, 40);
    const b = spawn(w, 'ar_mine', 200, 40);
    w.scrollSpeed = 0;
    step(w);
    expect(a.state).toBe(MINE_DRIFT);
    damageEnemy(w, b, 99, 'player');
    run(w, MINE.fuse);
    expect(a.active).toBe(false);
    expect(shots(w)).toBe(MINE.n);
  });
});

describe('homing missile', () => {
  it('turns toward the player at most turn rad/s and self-destructs at its ttl', () => {
    const w = world();
    const m = spawnEnemy(w, 'ar_missile', 120, 200, { vx: 0, vy: -70 }) as Enemy;
    step(w);
    const h0 = m.ax;
    step(w);
    expect(Math.abs(m.ax - h0)).toBeLessThanOrEqual(LEVIATHAN.missile.turn * DT + 1e-9);
    expect(Math.hypot(m.vx, m.vy)).toBeCloseTo(LEVIATHAN.missile.speed, 5);
    let killed = 0;
    w.events.on('enemyKilled', (p) => {
      if (p.enemy.defId === 'ar_missile') killed++;
    });
    run(w, LEVIATHAN.missile.ttl);
    expect(m.active).toBe(false);
    expect(killed).toBe(1);
  });
});

describe('lineBurst', () => {
  it('fires every round down one line, trailing by gap × speed', () => {
    const w = world();
    setEnemyShotSpeedMul(w, 1);
    expect(lineBurst(w, 100, 100, 90, 100, 3, 0.1)).toBe(3);
    const ys = w.enemyShots.items.filter((b) => b.active).map((b) => b.y);
    expect(ys).toEqual([100, 90, 80]);
    for (const b of w.enemyShots.items.filter((s) => s.active)) expect(b.vx).toBeCloseTo(0, 9);
  });
});

describe('frigate mid-boss', () => {
  it('carries two turrets, keeps its hull armored until both fall, and stays off the boss bar', () => {
    const w = world();
    attachPickups(w);
    const hull = spawn(w, 'ar_frigate', -18, 80);
    step(w);
    const f = frigateOf(w, hull);
    expect(f).not.toBeNull();
    expect(turretsAlive(f!)).toBe(2);
    expect(activeBoss(w)).toBeNull();
    damageEnemy(w, hull, 10, 'player');
    expect(hull.hp).toBe(FRIGATE.hullHp);
    for (let i = 0; i < 2; i++) {
      const t = f!.rig.slots[i] as PartSlot;
      damageEnemy(w, t.enemy as Enemy, 1e6, 'player');
    }
    step(w);
    expect(turretsAlive(f!)).toBe(0);
    damageEnemy(w, hull, 10, 'player');
    expect(hull.hp).toBe(FRIGATE.hullHp - 10);
  });

  it('pays a capsule and salvage on death, leaves a wreck, and ejects the armed pod', () => {
    const w = world();
    attachPickups(w);
    armadaState(w).podArmed = true;
    const hull = spawn(w, 'ar_frigate', 250, 90);
    step(w);
    const f = frigateOf(w, hull)!;
    for (let i = 0; i < 2; i++) damageEnemy(w, f.rig.slots[i]!.enemy as Enemy, 1e6, 'player');
    step(w);
    damageEnemy(w, hull, 1e6, 'player');
    const kinds = w.pickups.items.filter((p) => p.active).map((p: Pickup) => p.kind);
    expect(kinds).toContain('weapon');
    expect(kinds).toContain('salvage');
    expect(kinds).toContain('escapePod');
    expect(armadaState(w).wrecks.some((k) => k.active)).toBe(true);
    expect(armadaState(w).podDone).toBe(true);
    // No parts are left behind.
    expect(count(w, 'ar_frigate_turret') + count(w, 'ar_frigate_armor')).toBe(0);
  });

  it('is released, not killed, once it crosses the far side', () => {
    const w = world();
    const hull = spawn(w, 'ar_frigate', -18, 80);
    let kills = 0;
    w.events.on('enemyKilled', () => kills++);
    run(w, (w.width + 18 + FRIGATE.exitMargin) / FRIGATE.speed + 1);
    expect(hull.active).toBe(false);
    expect(kills).toBe(0);
    expect(count(w, 'ar_frigate_turret') + count(w, 'ar_frigate_armor')).toBe(0);
  });
});

describe('pod fallback', () => {
  it('drifts in from the top once, and the armed wreck no longer ejects a second', () => {
    const w = world();
    podFallback(w);
    podFallback(w);
    expect(w.pickups.items.filter((p) => p.active && p.kind === 'escapePod')).toHaveLength(1);
    expect(armadaState(w).podDone).toBe(true);
    expect(POD.hp).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------

function leviathan(w: World): Leviathan {
  attachBoss(w);
  const b = spawnBoss(w, LEVIATHAN.id);
  if (!(b instanceof Leviathan)) throw new Error('no leviathan');
  return b;
}

function slotOf(b: Leviathan, kind: string, n = 0): PartSlot {
  let k = 0;
  for (let i = 0; i < b.specs.length; i++) {
    if (b.kind(i) !== kind) continue;
    if (k++ === n) return b.rig.slots[i] as PartSlot;
  }
  throw new Error(kind);
}

const LOCK_T = (LEVIATHAN.lockY + 690 - LEVIATHAN.startY) / LEVIATHAN.hullSpeed;

describe('Dreadnought Leviathan', () => {
  it('spawns the whole hull above the screen and scrolls it down at 20 px/s', () => {
    const w = world();
    const b = leviathan(w);
    expect(w.scrollSpeed).toBe(LEVIATHAN.hullSpeed);
    expect(b.rig.slots.length).toBe(LEVIATHAN_PARTS.length);
    for (const s of b.rig.slots) expect((s.enemy as Enemy).y).toBeLessThanOrEqual(LEVIATHAN.startY);
    run(w, 5);
    expect(b.anchorY).toBeCloseTo(LEVIATHAN.startY + 5 * LEVIATHAN.hullSpeed, 3);
    expect(b.phaseName()).toBe('hull');
  });

  it('parts are untouchable above the screen', () => {
    const w = world();
    const b = leviathan(w);
    step(w);
    const gun = slotOf(b, 'gun').enemy as Enemy;
    damageEnemy(w, gun, 10, 'player');
    expect(gun.hp).toBe(gun.maxHp);
  });

  it('releases parts that scroll past (no kill, no salvage) and locks at the bridge', () => {
    const w = world();
    attachPickups(w);
    const b = leviathan(w);
    let kills = 0;
    w.events.on('enemyKilled', (p) => {
      if (p.enemy.isBoss) kills++;
    });
    run(w, LOCK_T + 0.2);
    expect(b.phaseName()).toBe('bridge');
    expect(w.scrollSpeed).toBe(0);
    expect((b.bridge.enemy as Enemy).y).toBeCloseTo(LEVIATHAN.lockY, 3);
    const flak = slotOf(b, 'flak');
    expect(flak.enemy).toBeNull();
    expect(flak.destroyed).toBe(false);
    expect(b.passed.filter((p) => p).length).toBeGreaterThanOrEqual(8);
    expect(kills).toBe(0);
    const anchor = b.anchorY;
    run(w, 2);
    expect(b.anchorY).toBe(anchor);
  });

  it('keeps the bridge armored while a generator lives; unshot generators overload', () => {
    const w = world();
    const b = leviathan(w);
    run(w, LOCK_T + 0.5);
    const bridge = b.bridge.enemy as Enemy;
    damageEnemy(w, bridge, 10, 'player');
    expect(bridge.hp).toBe(bridge.maxHp);
    expect(b.genAlive).toBe(true);
    run(w, 30);
    expect(b.genAlive).toBe(false);
    expect(b.overloaded.some((o) => o)).toBe(true);
    damageEnemy(w, bridge, 10, 'player');
    expect(bridge.hp).toBe(bridge.maxHp - 10);
  });

  it('bridge broken → the core launches (invulnerable), then strafes in phase 2', () => {
    const w = world();
    const b = leviathan(w);
    run(w, LOCK_T + 0.5);
    for (const i of b.genI) damageEnemy(w, b.rig.slots[i]!.enemy as Enemy, 1e6, 'player');
    step(w);
    damageEnemy(w, b.bridge.enemy as Enemy, 1e6, 'player');
    step(w);
    expect(b.phaseName()).toBe('launch');
    expect(slotOf(b, 'gun').enemy).toBeNull();
    const core = b.core.enemy as Enemy;
    damageEnemy(w, core, 10, 'player');
    expect(core.hp).toBe(core.maxHp);
    run(w, LEVIATHAN.launchTime + 0.1);
    expect(b.phaseName()).toBe('core');
    run(w, 1);
    expect(core.y).toBeLessThan(LEVIATHAN.lockY - 20);
    expect(core.r).toBe(LEVIATHAN.core.r);
    expect(shots(w)).toBeGreaterThan(0);
    damageEnemy(w, core, 10, 'player');
    expect(core.hp).toBe(core.maxHp - 10);
  });

  it('the core kill emits bossDefeated once, chains for 3 s, then releases the hull', () => {
    const w = world();
    const b = leviathan(w);
    let defeated = 0;
    w.events.on('bossDefeated', () => defeated++);
    run(w, LOCK_T + 0.5);
    for (const i of b.genI) damageEnemy(w, b.rig.slots[i]!.enemy as Enemy, 1e6, 'player');
    step(w);
    damageEnemy(w, b.bridge.enemy as Enemy, 1e6, 'player');
    run(w, LEVIATHAN.launchTime + 0.5);
    damageEnemy(w, b.core.enemy as Enemy, 1e6, 'player');
    step(w);
    expect(defeated).toBe(1);
    expect(b.phaseName()).toBe('dying');
    expect(shots(w)).toBe(0);
    expect(w.run.bossDefeated).toBe(true);
    run(w, LEVIATHAN.deathTime - 0.1);
    expect(b.done).toBe(false);
    run(w, 0.2);
    expect(b.done).toBe(true);
    expect(activeBoss(w)).toBeNull();
    expect(w.enemies.items.some((e) => e.active && e.isBoss)).toBe(false);
    expect(defeated).toBe(1);
    expect(b.sunk).toBe(true);
  });

  it('turrets hold fire unless well above the player (fairness)', () => {
    const w = world();
    const b = leviathan(w);
    w.player.y = 60;
    run(w, 20);
    expect(shots(w)).toBe(0);
    expect(b.phase).toBe(LevPhase.Hull);
  });
});
