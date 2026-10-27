import { describe, expect, it } from 'vitest';
import { PLAYER_TUNING } from '../../content/player';
import {
  chunkIds,
  getChunk,
  registerChunks,
  TERRAIN,
  TEST_CORRIDOR,
  Tile,
} from '../../content/terrain';
import { computePlayerStats, createDefaultSave } from '../../meta';
import { getTimelineAction, isSolidAt, raycastSolid, type RayHit } from '../../sim/hooks';
import { spawnAsteroid, spawnEnemy, spawnEnemyShot, spawnPlayerShot } from '../../sim/spawn';
import { createWorld, type World } from '../../sim/world';
import '../enemies';
import { initPlayer } from '../player';
import {
  carveTiles,
  clearTerrain,
  crushCount,
  damageTile,
  getTerrainState,
  nearestOpenX,
  queueChunk,
  registerTurretSpawner,
  rowAtY,
  terrainActive,
  terrainPass,
  terrainQueued,
  tileAt,
  validateChunk,
  validateRows,
  validateSequence,
} from '.';
import { crackStage } from './draw';

const OPEN = '..............................';
const ROCK = '##############################';
// Rock on the left half: x < 120.
const HALF = '###############...............';

registerChunks([
  { id: 't34_half', rows: [HALF, HALF, HALF] },
  { id: 't34_open', rows: Array.from({ length: 50 }, () => OPEN) },
  // A ceiling with an 8-tile gap on the left.
  { id: 't34_ceiling', rows: ['........######################'] },
  // A gate floor on the left (cols 0–14) with open rows above.
  { id: 't34_gate', rows: [OPEN, '===============...............'] },
  { id: 't34_socket', rows: [OPEN, '###T..........................'] },
  {
    id: 't34_stripes',
    rows: Array.from({ length: 100 }, (_, i) => {
      const r = OPEN.split('');
      r[i % 30] = '#';
      return r.join('');
    }),
  },
]);

function world(pilot = 'blastroid'): World {
  const w = createWorld('T34', { pilotId: pilot });
  initPlayer(w, computePlayerStats(createDefaultSave(), 'kestrel', pilot));
  w.scrollSpeed = 60;
  return w;
}

/** Scrolls the terrain by px in one pass (spawning every row on the way). */
function advance(w: World, px: number): void {
  terrainPass(w, px / w.scrollSpeed);
}

/** Scrolls px at 1 px per tick. */
function ticks(w: World, px: number): void {
  for (let i = 0; i < px; i++) {
    w.tick++;
    terrainPass(w, 1 / 60);
  }
}

describe('terrain ring buffer', () => {
  it('spawns rows above the screen and scrolls them down', () => {
    const w = world();
    queueChunk(w, 't34_half', { theme: 'warrens' });
    expect(terrainQueued(w)).toBe(3);
    advance(w, 0);
    const st = getTerrainState(w)!;
    // Two rows fill the spawn band; nothing on screen yet.
    expect(st.nextK).toBe(2);
    expect(tileAt(w, 10, 1)).toBe(Tile.Empty);
    expect(tileAt(w, 10, -4)).toBe(Tile.Rock);
    advance(w, 100);
    expect(tileAt(w, 10, 50)).toBe(Tile.Rock);
    expect(tileAt(w, 130, 50)).toBe(Tile.Empty);
    // The queue ran dry: the last row holds.
    expect(tileAt(w, 10, 0)).toBe(Tile.Rock);
    expect(terrainActive(w)).toBe(true);
  });

  it('wraps the ring without mixing rows up', () => {
    const w = world();
    queueChunk(w, 't34_stripes', { theme: 'foundry' });
    advance(w, 700);
    const st = getTerrainState(w)!;
    expect(st.nextK).toBeGreaterThan(TERRAIN.ringRows + 20);
    const n = getChunk('t34_stripes').rows.length;
    for (let y = 4; y < 400; y += 8) {
      const k = rowAtY(st, y);
      const col = (n - 1 - k) % 30;
      for (let c = 0; c < 30; c++) {
        expect(tileAt(w, c * 8 + 4, y)).toBe(c === col ? Tile.Rock : Tile.Empty);
      }
    }
  });

  it('clearTerrain tapers the walls off, or wipes them now', () => {
    const w = world();
    queueChunk(w, 't34_half', { theme: 'warrens' });
    advance(w, 420);
    clearTerrain(w, { fadeRows: 4 });
    advance(w, 4 * 8 + 16);
    // The taper's top rows are open, and nothing more is coming.
    expect(tileAt(w, 4, 0)).toBe(Tile.Empty);
    expect(tileAt(w, 4, 300)).toBe(Tile.Rock);
    clearTerrain(w, { now: true });
    expect(tileAt(w, 4, 300)).toBe(Tile.Empty);
    expect(terrainActive(w)).toBe(false);
  });

  it('is driven by the registered timeline action and solid query', () => {
    const w = world();
    getTimelineAction('terrain')!(w, { chunk: 't34_half', theme: 'warrens' });
    advance(w, 420);
    expect(isSolidAt(w, 60, 200)).toBe(true);
    expect(isSolidAt(w, 180, 200)).toBe(false);
    getTimelineAction('terrain')!(w, { chunk: '@clear', theme: 'warrens' });
    expect(terrainQueued(w)).toBe(TERRAIN.fadeRows);
  });
});

describe('ship collision', () => {
  it('pushes the ship out sideways along a wall, with no damage', () => {
    const w = world();
    queueChunk(w, 't34_half', { theme: 'warrens' });
    advance(w, 420);
    const p = w.player;
    const shield = p.shield;
    p.x = 124;
    p.y = 203; // the box straddles two rows of the wall face
    p.vx = -50;
    w.tick++;
    terrainPass(w, 1 / 60);
    expect(p.x).toBe(120 + TERRAIN.shipHalfW);
    expect(p.y).toBe(203);
    expect(p.vx).toBe(0);
    expect(p.shield).toBe(shield);
    expect(crushCount(w)).toBe(0);
  });

  it('a ceiling drags the ship down, then crushes it at the bottom edge', () => {
    const w = world();
    queueChunk(w, 't34_open', { theme: 'warrens' });
    queueChunk(w, 't34_ceiling', { theme: 'warrens' });
    const p = w.player;
    const shield = p.shield;
    p.x = 200;
    p.y = 300;
    ticks(w, 900);
    expect(crushCount(w)).toBe(1);
    expect(p.shield).toBe(shield - 1);
    expect(p.invulnT).toBeGreaterThan(0);
    // Moved to the open gap at its row.
    expect(p.x).toBeLessThanOrEqual(64 - TERRAIN.shipHalfW);
    expect(p.y).toBe(400 - PLAYER_TUNING.margin);
  });
});

describe('shots, rocks and enemies', () => {
  it('stops shots on rock, but not on turret sockets', () => {
    const w = world();
    queueChunk(w, 't34_half', { theme: 'warrens' });
    advance(w, 420);
    const a = spawnPlayerShot(w, { x: 60, y: 200, vx: 0, vy: -300 })!;
    const b = spawnPlayerShot(w, { x: 180, y: 200, vx: 0, vy: -300 })!;
    const e = spawnEnemyShot(w, { x: 100, y: 150, vx: 0, vy: 100 })!;
    terrainPass(w, 1 / 60);
    expect(a.active).toBe(false);
    expect(b.active).toBe(true);
    expect(e.active).toBe(false);

    const w2 = world();
    queueChunk(w2, 't34_socket', { theme: 'warrens' });
    advance(w2, 200);
    // Socket at col 3 of the row whose bottom is y = 200.
    expect(tileAt(w2, 28, 196)).toBe(Tile.Socket);
    const s = spawnPlayerShot(w2, { x: 28, y: 196, vx: 0, vy: -300 })!;
    const s2 = spawnEnemyShot(w2, { x: 28, y: 196, vx: 0, vy: 100 })!;
    terrainPass(w2, 1 / 60);
    expect(s.active && s2.active).toBe(true);
  });

  it('breaks rocks and dumb enemies on walls; smart enemies are pushed clear', () => {
    const w = world();
    queueChunk(w, 't34_half', { theme: 'warrens' });
    advance(w, 420);
    const rock = spawnAsteroid(w, { x: 60, y: 200, vx: 0, vy: 30, r: 5, hp: 1, size: 'small' })!;
    const iron = spawnAsteroid(w, { x: 60, y: 100, vx: 0, vy: 30, r: 5, hp: 0, size: 'small' })!;
    const gnat = spawnEnemy(w, 'gnat', 100, 250)!;
    const gun = spawnEnemy(w, 'gunboat', 122, 300)!;
    expect(gun.avoidsAsteroids).toBe(true);
    terrainPass(w, 1 / 60);
    expect(rock.active).toBe(false);
    expect(iron.active).toBe(false);
    expect(gnat.active).toBe(false);
    expect(gun.active).toBe(true);
    expect(gun.x).toBeGreaterThanOrEqual(120 + Math.min(gun.r, TERRAIN.shipHalfW));
  });

  it('spawns turrets from sockets as their row enters', () => {
    const w = world();
    const at: [number, number][] = [];
    const off = registerTurretSpawner('foundry', (_w, x, y) => void at.push([x, y]));
    queueChunk(w, 't34_socket', { theme: 'foundry' });
    advance(w, 0);
    off();
    expect(at).toEqual([[28, -4]]);
  });
});

describe('gates and breakable tiles', () => {
  it('gates take 6 damage, crack in stages and score; rock ignores damage', () => {
    const w = world();
    queueChunk(w, 't34_gate', { theme: 'warrens' });
    advance(w, 200);
    expect(tileAt(w, 20, 196)).toBe(Tile.Gate);
    expect(damageTile(w, 20, 150, 5)).toBe(false);
    const score = w.run.score;
    for (let i = 0; i < 5; i++) {
      const s = spawnPlayerShot(w, { x: 20, y: 196, vx: 0, vy: -300, damage: 1 })!;
      terrainPass(w, 0.0001);
      expect(s.active).toBe(false);
    }
    const st = getTerrainState(w)!;
    const idx = (rowAtY(st, 196) % TERRAIN.ringRows) * 30 + 2;
    expect(st.hp[idx]).toBeCloseTo(1);
    expect(crackStage(st.hp[idx]!, 6)).toBe(2);
    expect(crackStage(4, 6)).toBe(1);
    expect(crackStage(5, 6)).toBe(0);
    expect(damageTile(w, 20, 196, 1)).toBe(true);
    expect(tileAt(w, 20, 196)).toBe(Tile.Empty);
    expect(w.run.score).toBe(score + 25);
  });

  it("Rook's passive breaks gates faster", () => {
    // Rook joins in T36; the passive keys off the pilot id.
    const w = world();
    w.run.pilotId = 'rook';
    queueChunk(w, 't34_gate', { theme: 'warrens' });
    advance(w, 200);
    for (let i = 0; i < 3; i++) expect(damageTile(w, 20, 196, 1)).toBe(false);
    expect(damageTile(w, 20, 196, 1)).toBe(true);
  });

  it('gates crumble on their own at the crumble line', () => {
    const w = world();
    queueChunk(w, 't34_gate', { theme: 'warrens' });
    advance(w, TERRAIN.gateCrumbleY - 1);
    expect(tileAt(w, 20, TERRAIN.gateCrumbleY - 4)).toBe(Tile.Gate);
    const score = w.run.score;
    advance(w, 1);
    for (let c = 0; c < 15; c++) expect(tileAt(w, c * 8 + 4, TERRAIN.gateCrumbleY - 4)).toBe(0);
    expect(w.run.score).toBe(score);
  });

  it('carves every tile within the radius, rock included', () => {
    const w = world();
    queueChunk(w, 't34_half', { theme: 'warrens' });
    advance(w, 420);
    const n = carveTiles(w, 100, 200, 12);
    expect(n).toBeGreaterThan(4);
    expect(tileAt(w, 100, 200)).toBe(Tile.Empty);
    expect(tileAt(w, 20, 200)).toBe(Tile.Rock);
    expect(nearestOpenX(w, 60, 100)).toBe(126);
  });
});

describe('raycastSolid', () => {
  const hit: RayHit = { x: 0, y: 0, nx: 0, ny: 0, t: 0 };

  it('returns the entry point and the face normal', () => {
    const w = world();
    queueChunk(w, 't34_half', { theme: 'warrens' });
    advance(w, 420);
    expect(raycastSolid(w, 200, 200, 60, 200, hit)).toBe(true);
    expect(hit.x).toBeCloseTo(120);
    expect([hit.nx, hit.ny]).toEqual([1, 0]);
    expect(hit.t).toBeCloseTo(80 / 140);
    expect(raycastSolid(w, 200, 200, 200, 20, hit)).toBe(false);
    // Starting inside: t = 0, normal against the ray.
    expect(raycastSolid(w, 60, 200, 200, 200, hit)).toBe(true);
    expect(hit.t).toBe(0);
    expect([hit.nx, hit.ny]).toEqual([-1, 0]);
    // A diagonal enters the wall face.
    expect(raycastSolid(w, 200, 300, 40, 140, hit)).toBe(true);
    expect(hit.x).toBeCloseTo(120);
    expect(hit.y).toBeCloseTo(220);
  });

  it('hits floors from above and ceilings from below', () => {
    const w = world();
    queueChunk(w, 't34_gate', { theme: 'warrens' });
    advance(w, 200);
    // Gate row spans y 192–200 over x < 120.
    expect(raycastSolid(w, 20, 300, 20, 100, hit)).toBe(true);
    expect(hit.y).toBeCloseTo(200);
    expect([hit.nx, hit.ny]).toEqual([0, 1]);
    expect(raycastSolid(w, 20, 100, 20, 300, hit)).toBe(true);
    expect(hit.y).toBeCloseTo(192);
    expect([hit.nx, hit.ny]).toEqual([0, -1]);
    expect(raycastSolid(w, 160, 100, 160, 300, hit)).toBe(false);
  });
});

describe('chunk validator', () => {
  it('passes every chunk in content, and the test corridor as one sequence', () => {
    for (const id of chunkIds()) {
      if (id.startsWith('t34_')) continue;
      expect([id, validateChunk(getChunk(id))]).toEqual([id, []]);
    }
    expect(validateSequence(TEST_CORRIDOR)).toEqual([]);
    expect(validateSequence(TEST_CORRIDOR, { scroll: 30 })).toEqual([]);
  });

  it('flags narrow corridors, bad rows, fast shifts and short gate leads', () => {
    const corridor = (l: number, r: number) =>
      '#'.repeat(l) + '.'.repeat(30 - l - r) + '#'.repeat(r);
    expect(validateRows([corridor(12, 13)])[0]?.msg).toMatch(/no corridor/);
    expect(validateRows([corridor(12, 12)])).toEqual([]);
    expect(validateRows([corridor(12, 12)], { escape: true })[0]?.msg).toMatch(/≥ 7/);
    expect(validateRows(['#'.repeat(29)])[0]?.msg).toMatch(/length/);
    expect(validateRows([OPEN.slice(0, 29) + 'x'])[0]?.msg).toMatch(/bad char/);
    // A corridor jumping 3 tiles a row (top first: it drifts right going up).
    const jump: string[] = [];
    for (let i = 0; i < 6; i++) jump.unshift(corridor(3 + i * 3, 30 - 3 - i * 3 - 8));
    expect(validateRows(jump).some((p) => /can't be followed/.test(p.msg))).toBe(true);
    // One tile a row is fine at 34 px/s but not at escape speed.
    const drift: string[] = [];
    for (let i = 0; i < 16; i++) drift.unshift(corridor(2 + i, 22 - i));
    expect(validateRows(drift)).toEqual([]);
    expect(validateRows(drift, { scroll: 90 }).length).toBeGreaterThan(0);
    // A dead-end branch.
    expect(validateRows([ROCK, corridor(8, 8)]).length).toBeGreaterThan(0);
    // Gates at 120 px/s show for only 2.5 s.
    const gateRow = '########' + '='.repeat(14) + '########';
    const gated = [corridor(8, 8), gateRow, corridor(8, 8)];
    expect(validateRows(gated, { scroll: 90 })).toEqual([]);
    expect(validateRows(gated, { scroll: 120 })[0]?.msg).toMatch(/gates get/);
  });
});
