import { describe, expect, it } from 'vitest';
import { CHUNK_ORDER, CHUNKS, DEN, FORK, TURRET, WYRM } from '../../../content/levels/warrens';
import { getChunk, Tile } from '../../../content/terrain';
import { cleanupSystem } from '../../../sim/cleanup';
import { damageEnemy } from '../../../sim/damage';
import { bulletsSystem } from '../../../sim/motion';
import { spawnEnemy } from '../../../sim/spawn';
import type { Enemy } from '../../../sim/types';
import { createWorld, type World } from '../../../sim/world';
import { activeBoss, attachBoss, spawnBoss, updateBoss } from '../../boss';
import { setEnemyShotSpeedMul, updateEnemies } from '../../enemies';
import {
  getTerrainState,
  queueChunk,
  terrainPass,
  tileAt,
  validateChunk,
  validateSequence,
} from '../../terrain';
import '../index';
import {
  BAT_CHASE,
  BAT_FLEE,
  BORER_CROSS,
  BORER_DIG,
  BORER_OUT,
  BORER_WARN,
  TURRET_ON,
  turretSocketX,
} from './behaviors';
import { denBrake, markChunk, markedRowY, spawnBats } from './scripts';
import { warrensState } from './state';
import { Motion, Wyrm } from './wyrm';

const DT = 1 / 60;

function world(seed = 'T39'): World {
  const w = createWorld(seed, { levelId: 'warrens' });
  w.scrollSpeed = 26;
  w.player.x = 120;
  w.player.y = 340;
  w.player.invulnT = 1e9;
  setEnemyShotSpeedMul(w, 1);
  return w;
}

function step(w: World): void {
  w.tick++;
  w.time += DT;
  updateEnemies(w, DT);
  updateBoss(w, DT);
  bulletsSystem.update(w, DT);
  terrainPass(w, DT);
  cleanupSystem.update(w, DT);
}

function run(w: World, seconds: number, each?: () => boolean | void): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    if (each?.() === true) return;
    step(w);
  }
}

function shots(w: World): number {
  let n = 0;
  for (let i = 0; i < w.enemyShots.count; i++) if (w.enemyShots.items[i]?.active) n++;
  return n;
}

function all(w: World, defId: string): Enemy[] {
  const out: Enemy[] = [];
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i] as Enemy;
    if (e.active && e.defId === defId) out.push(e);
  }
  return out;
}

describe('warrens chunks', () => {
  it('every chunk and the whole sequence pass the T34 validator', () => {
    for (const c of CHUNKS) expect(validateChunk(c), c.id).toEqual([]);
    expect(validateSequence(CHUNK_ORDER)).toEqual([]);
    expect(validateSequence(CHUNK_ORDER, { scroll: 34 })).toEqual([]);
  });

  it('anchors sit on the tiles they name', () => {
    const fork = getChunk(FORK.id).rows;
    const at = (rows: readonly string[], fromBottom: number, col: number): string =>
      (rows[rows.length - 1 - fromBottom] as string)[col] as string;
    for (const c of FORK.podGateCols) expect(at(fork, FORK.podGateRow, c)).toBe('=');
    expect(at(fork, FORK.podRow, FORK.podX / 8)).toBe('.');
    // The pocket is walled off from the branch.
    expect(at(fork, FORK.podRow, 3)).toBe('#');
    for (const r of FORK.coreGateRows) expect(at(fork, r, FORK.coreX / 8)).toBe('=');
    expect(at(fork, FORK.coreRow, FORK.coreX / 8)).toBe('.');
    const den = getChunk(DEN.id).rows;
    expect(den).toHaveLength(DEN.rows);
    for (const c of DEN.pillarCols) {
      for (let r = 0; r < DEN.pillarRows; r++) expect(at(den, DEN.pillarRow + r, c)).toBe('#');
    }
    expect(at(den, DEN.pillarRow + DEN.pillarRows, DEN.pillarCols[0])).toBe('.');
    expect(den[0]).toBe('##..........................##');
  });
});

describe('wall turret', () => {
  it('spawns on its socket face, waits 0.6 s on screen, then fires aimed bursts', () => {
    const w = world();
    queueChunk(w, 'wr_tunnel', { theme: 'warrens' });
    terrainPass(w, DT);
    let firstShotY = NaN;
    let onScreenAt = NaN;
    run(w, 8, () => {
      const ts = all(w, 'wr_turret');
      const t = ts.sort((a, b) => b.y - a.y)[0];
      if (t && t.y >= 0 && Number.isNaN(onScreenAt)) onScreenAt = w.time;
      if (shots(w) > 0 && Number.isNaN(firstShotY)) firstShotY = w.time;
    });
    const ts = all(w, 'wr_turret');
    expect(ts.length).toBeGreaterThan(0);
    for (const t of ts) {
      expect(t.state).toBe(TURRET_ON);
      expect(tileAt(w, turretSocketX(t), t.y)).toBe(Tile.Socket);
      // Leaning out toward the open side.
      expect(tileAt(w, t.x + t.ax * 6, t.y)).toBe(Tile.Empty);
    }
    expect(firstShotY - onScreenAt).toBeGreaterThan(TURRET.firstOnScreen - DT);
  });

  it('dies with its socket when the rock is carved away', () => {
    const w = world();
    queueChunk(w, 'wr_tunnel', { theme: 'warrens' });
    run(w, 3);
    const t = all(w, 'wr_turret')[0]!;
    getTerrainState(w)!.tiles.fill(Tile.Empty);
    step(w);
    expect(t.active && t.defId === 'wr_turret' && t.state === TURRET_ON && t.hp > 0).toBe(false);
  });
});

describe('borer', () => {
  it('telegraphs 0.6 s in the wall, bores out, crosses, rings into the far wall and digs in', () => {
    const w = world();
    queueChunk(w, 'wr_narrows', { theme: 'warrens' });
    run(w, 12);
    const b = spawnEnemy(w, 'wr_borer', -18, 200)!;
    step(w);
    expect(b.state).toBe(BORER_WARN);
    expect(tileAt(w, b.x, b.y)).not.toBe(Tile.Empty);
    const startX = b.x;
    const seen = new Set<number>();
    let warnEnd = NaN;
    let ringShots = 0;
    run(w, 4, () => {
      if (!b.active || b.defId !== 'wr_borer') return true;
      seen.add(b.state);
      if (b.state >= BORER_OUT && Number.isNaN(warnEnd)) warnEnd = b.t;
      if (b.state === BORER_DIG && ringShots === 0) ringShots = shots(w);
      if (b.state === BORER_WARN) expect(b.x).toBe(startX);
    });
    expect(warnEnd).toBeGreaterThanOrEqual(0.58);
    expect([...seen]).toEqual(
      expect.arrayContaining([BORER_WARN, BORER_OUT, BORER_CROSS, BORER_DIG]),
    );
    expect(ringShots).toBe(4);
    // Gone, not killed: it dug in.
    expect(b.active && b.defId === 'wr_borer').toBe(false);
    // The bore through the near wall is open now.
    expect(tileAt(w, startX + 4, b.y)).toBe(Tile.Empty);
  });

  it('with no wall on its row it comes in from the edge', () => {
    const w = world();
    const b = spawnEnemy(w, 'wr_borer', w.width + 18, 120)!;
    run(w, 1);
    expect(b.ax).toBe(-1);
    expect(b.x).toBeLessThan(w.width);
  });
});

describe('cave bats', () => {
  it('flock after the ship, keep apart, then lose interest and climb away', () => {
    const w = world();
    spawnBats(w, { n: 10, x: 120 });
    run(w, 2.5);
    const bats = all(w, 'wr_bat');
    expect(bats).toHaveLength(10);
    for (const b of bats) {
      expect(b.state).toBe(BAT_CHASE);
      expect(Math.hypot(b.vx, b.vy)).toBeLessThanOrEqual(70.01);
    }
    let minD = Infinity;
    for (const a of bats)
      for (const b of bats) if (a !== b) minD = Math.min(minD, Math.hypot(a.x - b.x, a.y - b.y));
    expect(minD).toBeGreaterThan(3);
    // Closer to the ship than where they started.
    const cy = bats.reduce((s, b) => s + b.y, 0) / bats.length;
    expect(cy).toBeGreaterThan(80);
    run(w, 4);
    for (const b of all(w, 'wr_bat')) {
      expect(b.state).toBe(BAT_FLEE);
      expect(b.vy).toBeLessThan(0);
    }
  });

  it('shares one neighbor list per tick (no per-bat arrays)', () => {
    const w = world();
    spawnBats(w, { n: 12, x: 100 });
    step(w);
    const st = warrensState(w);
    const list = st.bats;
    expect(st.batCount).toBe(12);
    run(w, 1);
    expect(warrensState(w).bats).toBe(list);
  });
});

describe('den stop', () => {
  it('brakes so the den lands with its bottom row at stopY and the scroll at 0', () => {
    const w = world();
    queueChunk(w, 'wr_collapse', { theme: 'warrens' });
    markChunk(w, { chunk: DEN.id });
    queueChunk(w, DEN.id, { theme: 'warrens' });
    let stoppedAt = -1;
    run(w, 60, () => {
      if (denBrake(w) && stoppedAt < 0) stoppedAt = w.time;
    });
    expect(stoppedAt).toBeGreaterThan(0);
    expect(w.scrollSpeed).toBe(0);
    expect(Math.abs(markedRowY(w, DEN.id, 0) - DEN.stopY)).toBeLessThan(1);
    // Pillars where the Wyrm expects them.
    const py = markedRowY(w, DEN.id, DEN.pillarRow) - 4;
    expect(tileAt(w, DEN.pillarCols[0] * 8 + 4, py)).toBe(Tile.Rock);
  });
});

describe('Wyrm', () => {
  function arena(): { w: World; b: Wyrm } {
    const w = world('T39-wyrm');
    markChunk(w, { chunk: DEN.id });
    queueChunk(w, DEN.id, { theme: 'warrens' });
    // Fast-forward the den's arrival; the brake still lands it.
    w.scrollSpeed = 100;
    attachBoss(w);
    const b = spawnBoss(w, WYRM.id) as Wyrm;
    return { w, b };
  }

  it('waits for the scroll stop, then loops under → telegraph → cross (open) → dive', () => {
    const { w, b } = arena();
    expect(b).toBeInstanceOf(Wyrm);
    expect(b.phaseName()).toBe('entry');
    const order: number[] = [];
    let teleT = 0;
    let openOnSurface = false;
    run(w, 40, () => {
      const m = b.motion;
      if (order[order.length - 1] !== m) {
        if (order[order.length - 1] === Motion.Telegraph) teleT = Math.max(teleT, b.t);
        order.push(m);
        if (m === Motion.Cross) openOnSurface = b.open;
      }
      // Hidden parts are never targetable.
      for (let s = 0; s < b.rig.slots.length; s++) {
        const e = b.rig.slots[s]!.enemy;
        if (e !== null && b.vis[s] === 0) expect(b.targetable(e, b.rig.slots[s]!)).toBe(false);
      }
    });
    expect(w.scrollSpeed).toBe(0);
    const seq = order.join(',');
    expect(seq).toContain(
      [Motion.Under, Motion.Telegraph, Motion.Cross, Motion.Dive, Motion.Under].join(','),
    );
    expect(openOnSurface).toBe(true);
    expect(b.phaseName()).toBe('burrow');
  });

  it('telegraphs for 0.8 s and the head is armored once the mouth closes', () => {
    const { w, b } = arena();
    let tele = 0;
    let armoredHit = false;
    run(w, 30, () => {
      if (b.motion === Motion.Telegraph) tele = b.motionT;
      const h = b.head.enemy!;
      if (b.motion === Motion.Cross && !b.open && b.vis[0] === 1 && !armoredHit) {
        const hp = h.hp;
        damageEnemy(w, h, 5, 'player');
        expect(h.hp).toBe(hp);
        armoredHit = true;
      }
    });
    expect(tele).toBeGreaterThanOrEqual(WYRM.telegraph - DT * 1.5);
    expect(armoredHit).toBe(true);
  });

  it('segments follow the head along its path, spaced by the gap', () => {
    const { w, b } = arena();
    let checked = false;
    run(w, 30, () => {
      if (checked || b.motion !== Motion.Cross || b.surfaceT < 2.5) return;
      const s1 = b.rig.slots[1]!.enemy!;
      const s2 = b.rig.slots[2]!.enemy!;
      if (b.vis[1] === 0 || b.vis[2] === 0) return;
      const d = Math.hypot(s1.x - s2.x, s1.y - s2.y);
      expect(d).toBeGreaterThan(WYRM.gap * 0.8);
      expect(d).toBeLessThanOrEqual(WYRM.gap + 0.5);
      checked = true;
    });
    expect(checked).toBe(true);
  });

  it('goes FRENZY below 50%, carves the pillars, then dies in a pop chain', () => {
    const { w, b } = arena();
    const toasts: string[] = [];
    let defeated = 0;
    w.events.on('toast', (p) => toasts.push(p.text));
    w.events.on('bossDefeated', () => defeated++);
    run(w, 20);
    expect(b.phaseName()).toBe('burrow');
    // Segments down to 1 HP, then the head below the line.
    for (const s of b.rig.slots) if (s !== b.head && s.enemy) s.enemy.hp = 1;
    b.head.enemy!.hp -= b.rig.hp() - (b.rig.maxHp() * WYRM.frenzyAt - 1);
    step(w);
    expect(b.frenzy).toBe(true);
    expect(b.phaseName()).toBe('frenzy');
    expect(toasts).toContain('FRENZY');
    const carved0 = b.carved;
    run(w, 40);
    expect(b.carved).toBeGreaterThan(carved0);
    // Kill it while the mouth is open.
    run(w, 30, () => {
      if (!b.open) return;
      damageEnemy(w, b.head.enemy!, 1e6, 'player');
      return true;
    });
    step(w);
    expect(b.motion).toBe(Motion.Dying);
    expect(defeated).toBe(1);
    run(w, WYRM.dyingTime + 0.2);
    expect(activeBoss(w)).toBeNull();
    expect(b.done).toBe(true);
    expect(all(w, WYRM.seg.defId)).toHaveLength(0);
  });

  it('a destroyed segment shortens the worm and drops a small rock', () => {
    const { w, b } = arena();
    let done = false;
    run(w, 30, () => {
      if (done || b.vis[3] === 0) return;
      const e = b.rig.slots[3]!.enemy!;
      damageEnemy(w, e, 1e6, 'player');
      step(w);
      expect(b.rig.slots[3]!.destroyed).toBe(true);
      let n = 0;
      for (let i = 0; i < w.asteroids.count; i++) if (w.asteroids.items[i]?.active) n++;
      expect(n).toBeGreaterThan(0);
      done = true;
    });
    expect(done).toBe(true);
  });
});
