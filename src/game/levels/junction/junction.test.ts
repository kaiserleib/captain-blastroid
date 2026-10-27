import { describe, expect, it } from 'vitest';
import { AEGIS_P, BLINKER_P, JANUS, LEVEL, PYLON_P } from '../../../content/levels/junction';
import { PORTAL } from '../../../content/obstacles';
import { cleanupSystem } from '../../../sim/cleanup';
import { collisionSystem } from '../../../sim/collision';
import { damageEnemy } from '../../../sim/damage';
import { bulletsSystem } from '../../../sim/motion';
import { spawnEnemy, spawnPlayerShot } from '../../../sim/spawn';
import type { Bullet, Enemy, Pickup } from '../../../sim/types';
import { createWorld, type World } from '../../../sim/world';
import { activeBoss, spawnBoss, updateBoss } from '../../boss';
import { updateEnemies } from '../../enemies';
import { obstaclesSystem, portalPairs, spawnPortalPair, type PortalPair } from '../../obstacles';
import { pickupsSystem, spawnEscapePod } from '../../pickups';
import { pickEnd } from './behaviors';
import { AegisState, BlinkState, Janus, Phase, PylonState } from './index';
import { shieldStops, turn } from './pass';
import { aegisScript, collapseScript, pairScript, pylonScript } from './scripts';
import { Aim, aimedFor, jx, ownedBy, peekJx, taggedPair } from './state';

const DT = 1 / 60;

function world(seed = 'T40'): World {
  const w = createWorld(seed, { levelId: 'junction' });
  w.scrollSpeed = 32;
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
  obstaclesSystem.update(w, DT);
  pickupsSystem.update(w, DT);
  collisionSystem.update(w, DT);
  cleanupSystem.update(w, DT);
}

function run(w: World, seconds: number, each?: () => void): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    each?.();
    step(w);
  }
}

function runUntil(w: World, max: number, done: () => boolean): number {
  for (let i = 0; i < Math.round(max / DT); i++) {
    if (done()) return i * DT;
    step(w);
  }
  return Infinity;
}

function enemyShots(w: World): number {
  let n = 0;
  for (let i = 0; i < w.enemyShots.count; i++) if (w.enemyShots.items[i]?.active) n++;
  return n;
}

function livePairs(w: World): PortalPair[] {
  return portalPairs(w).filter((p) => p.active);
}

const SHOT = { x: 0, y: 0, vx: 0, vy: -300, r: 2, damage: 1, weaponId: 'blaster' as string | null };

function fire(
  w: World,
  x: number,
  y: number,
  vx = 0,
  vy = -300,
  weaponId: string | null = 'blaster',
): Bullet {
  SHOT.x = x;
  SHOT.y = y;
  SHOT.vx = vx;
  SHOT.vy = vy;
  SHOT.weaponId = weaponId;
  return spawnPlayerShot(w, SHOT) as Bullet;
}

describe('Blinker', () => {
  it('dives into a ring, holds at the partner, flashes 0.5 s, fires an aimed 3-burst, then dives again', () => {
    const w = world();
    // Entry ring ahead of it; the partner well above the ship.
    spawnPortalPair(w, 120, 70, 210, 60, { color: 'cyan' });
    const b = spawnEnemy(w, 'wj_blinker', 120, -10) as Enemy;
    run(w, 0.1);
    expect(b.state).toBe(BlinkState.Dive);
    const t = runUntil(w, 4, () => b.state === BlinkState.Hold);
    expect(t).toBeLessThan(4);
    // Came out by the partner at (210, 60).
    expect(Math.hypot(b.x - 210, b.y - 60)).toBeLessThan(PORTAL.r + 12);
    expect(enemyShots(w)).toBe(0);
    run(w, BLINKER_P.flash - 0.1);
    expect(enemyShots(w)).toBe(0);
    run(w, 0.15 + BLINKER_P.burstGap * 2 + 0.02);
    expect(enemyShots(w)).toBe(BLINKER_P.burstCount);
    run(w, BLINKER_P.hold - BLINKER_P.flash);
    expect(b.state).toBe(BlinkState.Dive);
  });

  it('swoops like a Swooper when no ring is on screen, and never fires at a ship it is not 24 px above', () => {
    const w = world();
    const b = spawnEnemy(w, 'wj_blinker', 120, -10) as Enemy;
    run(w, BLINKER_P.search + 1);
    expect(b.state).toBe(BlinkState.Swoop);
    run(w, 3);
    expect(b.active ? b.y : 999).toBeGreaterThan(200);
    expect(enemyShots(w)).toBe(0);
  });

  it('only picks rings whose exit sits well above the ship', () => {
    const w = world();
    const low = spawnPortalPair(w, 120, 100, 120, 310, { color: 'cyan' }) as PortalPair;
    expect(pickEnd(w, 120, 40, BLINKER_P)).toBeNull();
    low.b.y = 120;
    expect(pickEnd(w, 120, 40, BLINKER_P)).toBe(low.a);
  });
});

describe('Gate Pylon', () => {
  it('enters, drifts at 18 px/s carrying its ring beside it, then leaves; its death collapses the pair', () => {
    const w = world();
    pairScript(w, { tag: 'g', ax: 60, ay: 30, bx: 150, by: -20, color: 'lime' });
    const e = pylonScript(w, { tag: 'g', end: 'b', x: 150, holdY: 100, dir: -1 }) as Enemy;
    const pair = taggedPair(w, 'g') as PortalPair;
    run(w, 0.5);
    expect(e.state).toBe(PylonState.Enter);
    runUntil(w, 5, () => e.state === PylonState.Drift);
    run(w, 1);
    expect(e.state).toBe(PylonState.Drift);
    expect(Math.abs(e.vx)).toBeCloseTo(PYLON_P.drift, 5);
    // The carried end hangs beside it, toward the middle.
    expect(pair.b.x - e.x).toBeCloseTo(-PYLON_P.ringDx, 0);
    expect(pair.b.y).toBeCloseTo(e.y, 0);
    expect(pair.a.x).toBe(60);
    expect(ownedBy(w, e)).not.toBeNull();
    damageEnemy(w, e, e.hp, 'player');
    step(w);
    expect(pair.active).toBe(false);
  });

  it('leaves off the nearer side after its drift', () => {
    const w = world();
    const e = spawnEnemy(w, 'wj_pylon', 60, -14, { ax: 1, ay: 90 }) as Enemy;
    runUntil(w, 5, () => e.state === PylonState.Drift);
    run(w, PYLON_P.life + 0.1);
    expect(e.state).toBe(PylonState.Leave);
    expect(Math.sign(e.vx)).toBe(Math.sign(e.x - 120));
  });
});

describe('Aegis', () => {
  it('owns a pair: entry at (x + lowDx, lowY), exit above it aimed at its back', () => {
    const w = world();
    const e = aegisScript(w, { x: 100, lowDx: 50 }) as Enemy;
    step(w);
    const pairs = livePairs(w);
    expect(pairs).toHaveLength(1);
    const p = pairs[0] as PortalPair;
    run(w, 3);
    expect(e.state).toBe(AegisState.Hold);
    expect(p.a.x).toBe(150);
    expect(p.a.y).toBe(AEGIS_P.lowY);
    expect(p.b.y).toBeCloseTo(e.y + AEGIS_P.exitDy, 0);
    const a = aimedFor(w, p.b);
    expect(a?.mode).toBe(Aim.Point);
    expect(a?.ty).toBeCloseTo(e.y, 0);
  });

  it('the shield eats shots from below; shots from above, Seekers and angled Ricochet discs get through', () => {
    const e = { x: 100, y: 60, r: 9 } as Enemy;
    const b = { x: 100, y: 68, vx: 0, vy: -300, weaponId: 'blaster' } as Bullet;
    expect(shieldStops(e, b)).toBe(true);
    expect(shieldStops(e, { ...b, y: 54, vy: 300 })).toBe(false);
    expect(shieldStops(e, { ...b, weaponId: 'seeker' })).toBe(false);
    expect(shieldStops(e, { ...b, weaponId: 'ricochet', vx: 102, vy: -280 })).toBe(false);
    expect(shieldStops(e, { ...b, weaponId: 'ricochet', vx: 10, vy: -300 })).toBe(true);
  });

  it('a straight-up stream under its own ring is turned onto its back and damages it', () => {
    const w = world();
    const e = aegisScript(w, { x: 120, lowDx: 0 }) as Enemy;
    run(w, 2.5);
    expect(e.state).toBe(AegisState.Hold);
    const hp = e.hp;
    run(w, 1.5, () => {
      if (w.tick % 6 === 0) fire(w, e.x, 320);
    });
    expect(e.active ? e.hp : 0).toBeLessThan(hp);
    expect(jx(w).reaimed).toBeGreaterThan(0);
  });

  it('a stream beside its ring hits the shield and does nothing', () => {
    const w = world();
    const e = aegisScript(w, { x: 120, lowDx: 60 }) as Enemy;
    run(w, 2.5);
    const hp = e.hp;
    run(w, 1.5, () => {
      if (w.tick % 6 === 0) fire(w, e.x, 320);
    });
    expect(e.hp).toBe(hp);
    expect(jx(w).shieldAbsorbed).toBeGreaterThan(5);
  });

  it('climbs away after its hold, and its pair collapses when it leaves the screen', () => {
    const w = world();
    const e = aegisScript(w, { x: 120, lowDx: 0 }) as Enemy;
    runUntil(w, 5, () => e.state === AegisState.Hold);
    run(w, AEGIS_P.hold + 0.1);
    expect(e.state).toBe(AegisState.Leave);
    run(w, 4);
    expect(e.active).toBe(false);
    expect(livePairs(w)).toHaveLength(0);
  });
});

describe("Nyx Calder's pod", () => {
  it('falls into the top ring, comes out mid-screen and is carried again by the next ring', () => {
    const w = world();
    w.player.x = 230;
    for (const ev of LEVEL.timeline) {
      if (
        'script' in ev &&
        ev.script === 'junction.pair' &&
        String(ev.args?.tag).startsWith('pod')
      ) {
        pairScript(w, ev.args ?? {});
      }
    }
    const pod = ev(LEVEL.timeline);
    const k = spawnEscapePod(w, 'nyx', pod, 2) as Pickup;
    let jumps = 0;
    let lastY = k.y;
    run(w, 40, () => {
      if (k.active && Math.abs(k.y - lastY) > 40) jumps++;
      lastY = k.y;
    });
    expect(jumps).toBe(2);
  });
});

function ev(timeline: typeof LEVEL.timeline): number {
  for (const e of timeline)
    if ('escapePod' in e && typeof e.escapePod.x === 'number') return e.escapePod.x;
  return 120;
}

describe('aimed exits and tagged pairs', () => {
  it('turn a shot leaving the exit toward the target, keeping its speed', () => {
    const w = world();
    const p = spawnPortalPair(w, 60, 200, 120, 20) as PortalPair;
    const b = { x: 120, y: 4, prevX: 120, prevY: 4, vx: 0, vy: -300 } as Bullet;
    turn(b, { end: p.b, pairA: p.id, pairB: p.id, mode: Aim.Point, tx: 120, ty: 80 });
    expect(b.vy).toBeCloseTo(300, 5);
    expect(b.y).toBeCloseTo(20 + PORTAL.r + PORTAL.exitPad, 5);
  });

  it('collapse by tag, or all of them', () => {
    const w = world();
    pairScript(w, { tag: 'x', ax: 40, ay: 100, bx: 200, by: 100 });
    pairScript(w, { tag: 'y', ax: 40, ay: 200, bx: 200, by: 200 });
    collapseScript(w, { tag: 'x' });
    expect(livePairs(w)).toHaveLength(1);
    collapseScript(w, { tag: '*' });
    expect(livePairs(w)).toHaveLength(0);
  });

  it('leave worlds without junction state alone', () => {
    const w = createWorld('plain', { levelId: 'kessler' });
    step(w);
    expect(peekJx(w)).toBeUndefined();
  });
});

describe('Janus', () => {
  function boss(w: World): Janus {
    expect(spawnBoss(w, JANUS.id)).not.toBeNull();
    return activeBoss(w) as Janus;
  }

  it('descends, opens two pairs (entries left and right, exits over the faces) and holds its wall', () => {
    const w = world();
    const b = boss(w);
    expect(b.phaseName()).toBe('entry');
    run(w, JANUS.entry.duration + 0.1);
    expect(b.phase).toBe(Phase.Fight);
    expect(b.ringsLive()).toBe(true);
    const p0 = b.pairs[0] as PortalPair;
    const p1 = b.pairs[1] as PortalPair;
    expect(p0.a.x).toBe(JANUS.rings.entryX);
    expect(p1.a.x).toBe(240 - JANUS.rings.entryX);
    expect(p0.b.x).toBeCloseTo(b.faceX(0), 0);
    expect(p0.b.y).toBe(JANUS.rings.exitY);
    // Exits are off the top edge: closed to the ship.
    expect(p0.a.open).toBe(false);
    const s = jx(w);
    expect(s.wall.on).toBe(true);
    // The ship is held under the wall.
    w.player.y = 60;
    step(w);
    expect(w.player.y).toBeGreaterThanOrEqual(s.wall.y + JANUS.wall.shipPad);
  });

  it('the wall eats shots from below; a stream into the left ring cracks Dawn', () => {
    const w = world();
    const b = boss(w);
    run(w, JANUS.entry.duration + 0.1);
    const dawn = b.faces[0].enemy as Enemy;
    const hp0 = dawn.hp;
    // Straight at the face from below: the wall takes it.
    run(w, 1, () => {
      if (w.tick % 6 === 0) fire(w, b.faceX(0), 200);
    });
    expect(dawn.hp).toBe(hp0);
    expect(jx(w).wall.absorbed).toBeGreaterThan(0);
    // Into the left entry ring: out over Dawn, turned onto her.
    run(w, 1, () => {
      if (w.tick % 6 === 0) fire(w, JANUS.rings.entryX, 300);
    });
    expect(dawn.hp).toBeLessThan(hp0);
    expect(b.ringHits).toBeGreaterThan(0);
  });

  it('one face down → frenzy: entries drift and the pairs swap every 6 s; Blinkers come out', () => {
    const w = world();
    const b = boss(w);
    run(w, JANUS.entry.duration + 0.1);
    const x0 = b.entryX[0];
    b.wallDown = true;
    const dusk = b.faces[1].enemy as Enemy;
    damageEnemy(w, dusk, dusk.hp, 'player');
    b.wallDown = false;
    step(w);
    expect(b.phase).toBe(Phase.Frenzy);
    const lead = b.entryLeadsTo(0);
    run(w, JANUS.drift.swapEvery + 0.9);
    expect(b.swaps).toBe(1);
    expect(b.entryLeadsTo(0)).toBe(1 - lead);
    expect(b.entryX[0]).not.toBeCloseTo(x0, 0);
    let blinkers = 0;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.items[i] as Enemy;
      if (e.active && e.defId === 'wj_blinker') blinkers++;
    }
    expect(blinkers).toBeGreaterThan(0);
  });

  it('a wrecked generator lets its exit wander and points it straight down', () => {
    const w = world();
    const b = boss(w);
    run(w, JANUS.entry.duration + 0.1);
    const g = b.gens[0].enemy as Enemy;
    damageEnemy(w, g, g.hp, 'player');
    run(w, 1);
    const a = aimedFor(w, b.exits[0]!);
    expect(a?.mode).toBe(Aim.Down);
    expect(b.exitX[0]).not.toBeCloseTo(b.faceX(0), 0);
    expect(aimedFor(w, b.exits[1]!)?.mode).toBe(Aim.Point);
  });

  it('silent assist: no ring damage for 40 s drops the wall 3 s in every 10', () => {
    const w = world();
    const b = boss(w);
    run(w, JANUS.entry.duration + 0.1);
    run(w, JANUS.flicker.after - 0.5);
    expect(b.flickers).toBe(0);
    expect(b.wallDown).toBe(false);
    run(w, 1);
    expect(b.wallDown).toBe(true);
    expect(jx(w).wall.down).toBe(true);
    run(w, JANUS.flicker.off);
    expect(b.wallDown).toBe(false);
    run(w, JANUS.flicker.every - JANUS.flicker.off);
    expect(b.flickers).toBe(2);
  });

  it('only shots reach the faces: an arc or a shell burst on them with the wall up is absorbed', () => {
    const w = world();
    const b = boss(w);
    run(w, JANUS.entry.duration + 0.1);
    const dawn = b.faces[0].enemy as Enemy;
    const hp0 = dawn.hp;
    damageEnemy(w, dawn, 5, 'player');
    expect(dawn.hp).toBe(hp0);
    // Faces aren't auto-targets while a generator stands and the wall is up.
    expect(b.targetable(dawn, b.faces[0])).toBe(false);
    expect(b.targetable(b.gens[0].enemy as Enemy, b.gens[0])).toBe(true);
  });

  it('the last face → dying (rings implode, wall down) → done, with bossDefeated once', () => {
    const w = world();
    const b = boss(w);
    let defeated = 0;
    w.events.on('bossDefeated', () => void defeated++);
    run(w, JANUS.entry.duration + 0.1);
    b.wallDown = true;
    for (const f of b.faces) {
      const e = f.enemy as Enemy;
      damageEnemy(w, e, e.hp, 'player');
      step(w);
    }
    expect(b.phase).toBe(Phase.Dying);
    step(w);
    expect(defeated).toBe(1);
    expect(livePairs(w)).toHaveLength(0);
    expect(jx(w).wall.on).toBe(false);
    run(w, JANUS.deathTime + 0.1);
    expect(b.done).toBe(true);
    expect(activeBoss(w)).toBeNull();
    expect(defeated).toBe(1);
  });
});
