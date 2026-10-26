import { describe, expect, it } from 'vitest';
import { MINE_P, SHEPHERD, SKIFF_P, TUG_P } from '../../../content/levels/ionShoals';
import { cleanupSystem } from '../../../sim/cleanup';
import { collisionSystem } from '../../../sim/collision';
import { damageEnemy } from '../../../sim/damage';
import { bulletsSystem } from '../../../sim/motion';
import { spawnEnemy } from '../../../sim/spawn';
import type { Asteroid, Enemy } from '../../../sim/types';
import { createWorld, type World } from '../../../sim/world';
import { activeBoss, bossMaxHp, spawnBoss, updateBoss } from '../../boss';
import { updateEnemies } from '../../enemies';
import { isTowed, obstaclesSystem, spawnRock } from '../../obstacles';
import { tugRock } from './behaviors';
import { gauntletState, startGauntlet, updateGauntlet } from './gauntlet';
import { MineState, Phase, Shepherd, Slot, SkiffState, TugState } from './index';

const DT = 1 / 60;

function world(seed = 'T27'): World {
  const w = createWorld(seed, { levelId: 'ionShoals' });
  w.scrollSpeed = 32;
  w.player.x = 120;
  w.player.y = 330;
  w.player.invulnT = 1e9;
  return w;
}

function step(w: World): void {
  w.tick++;
  w.time += DT;
  updateEnemies(w, DT);
  updateBoss(w, DT);
  bulletsSystem.update(w, DT);
  obstaclesSystem.update(w, DT);
  collisionSystem.update(w, DT);
  cleanupSystem.update(w, DT);
  updateGauntlet(w, DT);
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

describe('tug', () => {
  it('reaches for a medium rock on the way in, holds it below itself, then flings it at the ship', () => {
    const w = world();
    const tug = spawnEnemy(w, 'ion_tug', 120, -14, { ay: 70 }) as Enemy;
    const rock = spawnRock(w, { size: 'medium', x: 140, y: 130, vx: 0, vy: 0 }) as Asteroid;
    run(w, 0.3);
    expect(tug.state).toBe(TugState.Descend);
    run(w, 0.4);
    expect(tug.state).toBe(TugState.Tow);
    expect(tugRock(tug)).toBe(rock);
    expect(isTowed(rock)).toBe(true);
    run(w, TUG_P.towTime - 0.4);
    // Held just under the tug by the end of the tow, and the tug is at its line.
    expect(Math.abs(rock.x - tug.x)).toBeLessThan(10);
    expect(Math.abs(rock.y - (tug.y + TUG_P.holdOy))).toBeLessThan(12);
    run(w, 0.4);
    expect(tug.state).toBe(TugState.Hold);
    expect(isTowed(rock)).toBe(false);
    // Flung toward the ship at the design speed.
    expect(Math.hypot(rock.vx, rock.vy)).toBeCloseTo(TUG_P.flingSpeed, 0);
    expect(rock.vy).toBeGreaterThan(0);
    run(w, 1);
    expect(Math.abs(tug.y - 70)).toBeLessThan(3);
  });

  it('fires one aimed shot instead when no rock is in range', () => {
    const w = world();
    spawnEnemy(w, 'ion_tug', 120, -14, { ay: 70 });
    let fired = 0;
    w.events.on('sfx', (p) => {
      if (p.id === 'enemy_shot') fired++;
    });
    // It reaches the hold line at ~1.5 s with its first attempt due: no rock, so it shoots.
    run(w, 1.8);
    expect(shots(w)).toBe(1);
    run(w, TUG_P.interval - 0.3);
    expect(fired).toBe(1);
  });

  it('ignores small rocks and rocks held by someone else', () => {
    const w = world();
    const tug = spawnEnemy(w, 'ion_tug', 120, 70, { ay: 70 }) as Enemy;
    spawnRock(w, { size: 'small', x: 120, y: 140, vx: 0, vy: 0 });
    run(w, TUG_P.firstDelay + 0.1);
    expect(tug.state).toBe(TugState.Hold);
    expect(tugRock(tug)).toBeNull();
  });

  it('drops its rock when it dies, and leaves after its time is up', () => {
    const w = world();
    const tug = spawnEnemy(w, 'ion_tug', 120, 70, { ay: 70 }) as Enemy;
    const rock = spawnRock(w, { size: 'large', x: 120, y: 160, vx: 0, vy: 0 }) as Asteroid;
    run(w, TUG_P.firstDelay + 0.3);
    expect(isTowed(rock)).toBe(true);
    damageEnemy(w, tug, 99, 'player');
    run(w, 0.1);
    expect(isTowed(rock)).toBe(false);

    const t2 = spawnEnemy(w, 'ion_tug', 60, 70, { ay: 70 }) as Enemy;
    run(w, TUG_P.leaveAfter + 0.1);
    expect(t2.state).toBe(TugState.Leave);
    expect(t2.vy).toBeLessThan(0);
  });
});

describe('skiff', () => {
  it('weaves down, fires one aimed shot at 1.4 s, then peels off toward its side', () => {
    const w = world();
    const s = spawnEnemy(w, 'ion_skiff', 80, -10) as Enemy;
    let minX = 999;
    let maxX = -999;
    run(w, SKIFF_P.shootAt - 0.05, () => {
      minX = Math.min(minX, s.x);
      maxX = Math.max(maxX, s.x);
    });
    expect(maxX - minX).toBeGreaterThan(SKIFF_P.amp);
    expect(shots(w)).toBe(0);
    run(w, 0.1);
    expect(shots(w)).toBe(1);
    run(w, SKIFF_P.peelAt - SKIFF_P.shootAt + 0.6);
    expect(s.state).toBe(SkiffState.PeelLeft);
    expect(s.vx).toBeLessThan(0);
    expect(shots(w)).toBe(1);
  });

  it('flies along its spawn velocity for side sweeps, without peeling', () => {
    const w = world();
    const s = spawnEnemy(w, 'ion_skiff', -10, 60, { vx: 120, vy: 50 }) as Enemy;
    run(w, 2.5);
    expect(s.state).toBe(SkiffState.Weave);
    expect(s.x).toBeGreaterThan(200);
  });
});

describe('ion mine', () => {
  it('arms when the ship comes close and bursts into a ring after the tell', () => {
    const w = world();
    const m = spawnEnemy(w, 'ion_mine', 120, 100) as Enemy;
    run(w, 0.6);
    expect(m.state).toBe(MineState.Drift);
    w.player.y = m.y + 30;
    step(w);
    expect(m.state).toBe(MineState.Armed);
    w.player.y = 330;
    run(w, MINE_P.arm - 0.1);
    expect(shots(w)).toBe(0);
    expect(m.active).toBe(true);
    run(w, 0.15);
    expect(shots(w)).toBe(MINE_P.ringN);
    expect(m.active).toBe(false);
  });

  it('bursts on its own after the fuse', () => {
    const w = world();
    const m = spawnEnemy(w, 'ion_mine', 120, -10) as Enemy;
    run(w, MINE_P.fuse + 0.05);
    expect(m.state).toBe(MineState.Armed);
    run(w, MINE_P.arm);
    expect(shots(w)).toBe(MINE_P.ringN);
  });

  it('shot down, it fizzles: no ring', () => {
    const w = world();
    const m = spawnEnemy(w, 'ion_mine', 120, 100) as Enemy;
    run(w, 1);
    damageEnemy(w, m, 3, 'player');
    run(w, MINE_P.fuse + 1);
    expect(shots(w)).toBe(0);
  });
});

describe('gauntlet', () => {
  it('sends skiff sweeps from alternating sides for its duration', () => {
    const w = world();
    const seen: number[] = [];
    startGauntlet(w);
    run(w, 31, () => {
      for (let i = 0; i < w.enemies.count; i++) {
        const e = w.enemies.items[i] as Enemy;
        if (e.active && e.defId === 'ion_skiff' && !seen.includes(e.id)) seen.push(e.id);
      }
      w.player.invulnT = 1e9;
    });
    expect(seen.length).toBeGreaterThanOrEqual(18);
    expect(gauntletState(w).active).toBe(false);
  });
});

function fighting(w: World): Shepherd {
  const b = spawnBoss(w, 'ion_shepherd');
  if (!(b instanceof Shepherd)) throw new Error('no boss');
  run(w, SHEPHERD.entry.duration + 0.05);
  expect(b.phase).toBe(Phase.Fight);
  return b;
}

describe('the Shepherd', () => {
  it('registers with the design HP and descends invulnerable', () => {
    const w = world();
    const b = spawnBoss(w, 'ion_shepherd') as Shepherd;
    expect(activeBoss(w)).toBe(b);
    expect(bossMaxHp(w)).toBe(90 + 90 + 240);
    const em = b.emitters[0]?.enemy as Enemy;
    damageEnemy(w, em, 5, 'player');
    expect(em.hp).toBe(90);
  });

  it('hauls a large rock into orbit for each emitter', () => {
    const w = world();
    const b = fighting(w);
    run(w, SHEPHERD.orbit.towIn);
    for (const s of b.slots) {
      expect(s.mode === Slot.Orbit || s.mode === Slot.Windup).toBe(true);
      const r = b.slotRock(s) as Asteroid;
      expect(r.size).toBe('large');
      expect(isTowed(r)).toBe(true);
    }
  });

  it('throws a rock every interval after a windup tell, then fetches a fresh one', () => {
    const w = world();
    const b = fighting(w);
    let throws = 0;
    let windupSeen = 0;
    w.events.on('sfx', (p) => {
      if (p.id === 'boss_throw') throws++;
    });
    run(w, SHEPHERD.fling.firstDelay + SHEPHERD.fling.interval * 2 + 0.5, () => {
      if (b.slots.some((s) => s.mode === Slot.Windup)) windupSeen++;
    });
    expect(throws).toBeGreaterThanOrEqual(2);
    // Each throw is telegraphed for the windup (≥ 0.5 s at 60 Hz).
    expect(windupSeen).toBeGreaterThanOrEqual(throws * 30);
  });

  it('opens the core once both emitters are wrecked and spins the spiral', () => {
    const w = world();
    const b = fighting(w);
    run(w, 3);
    const core = b.core.enemy as Enemy;
    damageEnemy(w, core, 5, 'player');
    expect(core.hp).toBe(240);
    for (const s of b.emitters) damageEnemy(w, s.enemy as Enemy, 1e6, 'player');
    step(w);
    expect(b.phase).toBe(Phase.Opening);
    run(w, SHEPHERD.coreOpenTime + 0.05);
    expect(b.phase).toBe(Phase.Exposed);
    run(w, SHEPHERD.spiral.firstDelay + 0.5);
    expect(b.spiralOn).toBe(true);
    expect(shots(w)).toBeGreaterThan(SHEPHERD.spiral.arms);
    let skiffs = 0;
    run(w, SHEPHERD.skiffWave.firstDelay + 1, () => {
      let n = 0;
      for (let i = 0; i < w.enemies.count; i++) {
        const e = w.enemies.items[i] as Enemy;
        if (e.active && e.defId === 'ion_skiff') n++;
      }
      skiffs = Math.max(skiffs, n);
    });
    expect(skiffs).toBe(SHEPHERD.skiffWave.count);
  });

  it('dies on the core kill: bossDefeated once, then done', () => {
    const w = world();
    const b = fighting(w);
    let defeated = 0;
    w.events.on('bossDefeated', () => defeated++);
    for (const s of b.emitters) damageEnemy(w, s.enemy as Enemy, 1e6, 'player');
    run(w, SHEPHERD.coreOpenTime + 0.2);
    damageEnemy(w, b.core.enemy as Enemy, 1e6, 'player');
    step(w);
    expect(b.phase).toBe(Phase.Dying);
    expect(defeated).toBe(1);
    expect(w.run.bossDefeated).toBe(true);
    run(w, SHEPHERD.deathTime + 0.1);
    expect(b.done).toBe(true);
    expect(activeBoss(w)).toBeNull();
    expect(defeated).toBe(1);
  });
});
