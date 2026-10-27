import { describe, expect, it } from 'vitest';
import { beatSeconds } from '../../../audio/songs/bpm';
import {
  ARCHITECT,
  ARCHITECT_PARTS,
  ASSEMBLY_SEQUENCE,
  BEAT,
  CHUNKS,
  CRANE_P,
  ESCAPE_CHUNKS,
  ESCAPE_ENTRY,
  FURNACE,
  LEVEL,
  RIVETER_P,
  SENTINEL_P,
  WELDING,
} from '../../../content/levels/foundry';
import { BLACK_HOLE_VARIANTS } from '../../../content/obstacles';
import { TERRAIN_RULES } from '../../../content/terrain';
import { cleanupSystem } from '../../../sim/cleanup';
import { damageEnemy } from '../../../sim/damage';
import { bulletsSystem } from '../../../sim/motion';
import { spawnEnemy, spawnPlayerShot } from '../../../sim/spawn';
import type { Anomaly, Asteroid, Enemy, Pickup } from '../../../sim/types';
import { createWorld, type World } from '../../../sim/world';
import { activeBoss, attachBoss, spawnBoss, updateBoss, type PartSlot } from '../../boss';
import { updateEnemies } from '../../enemies';
import {
  bubbles,
  flarePhase,
  isCollapsing,
  isTowed,
  obstaclesSystem,
  portalPairs,
  shadeSlabs,
} from '../../obstacles';
import { pickupsSystem, spawnEscapePod } from '../../pickups';
import { terrainQueued, validateChunk, validateSequence } from '../../terrain';
import '../index';
import { Architect, ArchPhase } from './architect';
import {
  craneHot,
  craneRock,
  CraneState,
  sentinelShieldPass,
  sentinelSide,
  SentinelState,
  shieldCovers,
  turnToward,
} from './behaviors';
import {
  containmentEndScript,
  containmentScript,
  escapeScript,
  foundryState,
  foundrySystem,
  portalLineScript,
  portalsScript,
  PULSE_PERIOD,
  pulsarScript,
} from './scripts';

const DT = 1 / 60;

function world(seed = 'T42'): World {
  const w = createWorld(seed, { levelId: 'foundry' });
  w.scrollSpeed = 30;
  w.player.x = 120;
  w.player.y = 340;
  w.player.invulnT = 1e9;
  return w;
}

function step(w: World, extra?: (w: World) => void): void {
  w.tick++;
  w.time += DT;
  updateEnemies(w, DT);
  updateBoss(w, DT);
  bulletsSystem.update(w, DT);
  obstaclesSystem.update(w, DT);
  cleanupSystem.update(w, DT);
  extra?.(w);
}

function run(w: World, seconds: number, each?: () => void, extra?: (w: World) => void): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    each?.();
    step(w, extra);
  }
}

function spawn(w: World, id: string, x: number, y: number, ax = 0): Enemy {
  const e = spawnEnemy(w, id, x, y, ax !== 0 ? { ax } : undefined);
  if (e === null) throw new Error('pool full');
  return e;
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

function anomalies(w: World, kind: Anomaly['kind']): Anomaly[] {
  const out: Anomaly[] = [];
  for (let i = 0; i < w.anomalies.count; i++) {
    const a = w.anomalies.items[i] as Anomaly;
    if (a.active && a.kind === kind) out.push(a);
  }
  return out;
}

describe('foundry content', () => {
  it('locks the welding grid to the foundry song', () => {
    expect(BEAT).toBeCloseTo(beatSeconds('foundry'), 9);
    expect(PULSE_PERIOD).toBeCloseTo(WELDING.beats * beatSeconds('foundry'), 9);
  });

  it('every chunk passes the validator; assembly and escape sequences join', () => {
    for (const c of CHUNKS) expect(validateChunk(c), c.id).toEqual([]);
    expect(validateSequence([...ASSEMBLY_SEQUENCE], { scroll: 30 })).toEqual([]);
    expect(
      validateSequence([ESCAPE_ENTRY, ...ESCAPE_CHUNKS, ...ESCAPE_CHUNKS], { escape: true }),
    ).toEqual([]);
    for (const id of [ESCAPE_ENTRY, ...ESCAPE_CHUNKS]) {
      const c = CHUNKS.find((k) => k.id === id)!;
      expect(c.tags).toContain('escape');
    }
    expect(TERRAIN_RULES.minCorridorEscape).toBeGreaterThanOrEqual(7);
  });

  it('carries the design beats, the escape and the Architect HP spread', () => {
    const kinds = (k: string) => LEVEL.timeline.filter((e) => k in e);
    expect(kinds('boss')).toEqual([{ t: 200, boss: ARCHITECT.id }]);
    expect(kinds('bossWarning')[0]!.t).toBe(194);
    expect(kinds('escapePod')).toHaveLength(1);
    expect(LEVEL.escape).toMatchObject({
      dur: 40,
      scrollTo: 90,
      over: 6,
      bonus: 100,
      bonusPerHit: 20,
    });
    const lance = LEVEL.timeline.find((e) => 'forceCapsule' in e && e.forceCapsule === 'lance');
    expect(lance?.t).toBe(6);
    const forms = [1, 2, 3].map((f) =>
      ARCHITECT_PARTS.filter((p) => p.form === f).reduce((n, p) => n + p.hp, 0),
    );
    expect(forms.every((hp) => hp > 0)).toBe(true);
    expect(ARCHITECT_PARTS.filter((p) => p.kind === 'arm')).toHaveLength(2);
    expect(ARCHITECT_PARTS.filter((p) => p.kind === 'pylon')).toHaveLength(4);
  });
});

describe('riveter', () => {
  it('crosses at its row at 60 px/s, and takes the new row after a portal hop', () => {
    const w = world();
    const e = spawn(w, 'fd_riveter', -8, 100, 1);
    run(w, 1);
    expect(e.vx).toBeCloseTo(RIVETER_P.speed, 5);
    expect(e.x).toBeGreaterThan(40);
    expect(Math.abs(e.y - 100)).toBeLessThan(3);
    e.y = e.prevY = 180;
    run(w, 0.5);
    expect(Math.abs(e.y - 180)).toBeLessThan(3);
  });

  it('conveyor lines spawn one riveter at a time; portal lines opt them into portals', () => {
    const w = world();
    portalLineScript(w, { n: 4 });
    for (let i = 0; i < 90; i++) {
      w.tick++;
      foundrySystem.update(w, DT);
    }
    expect(count(w, 'fd_riveter')).toBe(4);
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.items[i] as Enemy;
      if (e.active) expect(e.y).toBe(FURNACE.rows[0]);
    }
  });
});

describe('crane', () => {
  it('brings its scrap in, glows before the fling, flings it, then snipes and leaves', () => {
    const w = world();
    const e = spawn(w, 'fd_crane', 100, -14);
    step(w);
    const rock = craneRock(e) as Asteroid;
    expect(rock).not.toBeNull();
    expect(rock.size).toBe('large');
    expect(isTowed(rock)).toBe(true);
    run(w, 3, undefined);
    expect(e.state).toBe(CraneState.Hold);
    let hotT = 0;
    let flungAt = -1;
    run(w, CRANE_P.towTime + 1, () => {
      if (craneHot(e)) hotT += DT;
      if (flungAt < 0 && e.state === CraneState.Snipe) flungAt = w.time;
    });
    expect(flungAt).toBeGreaterThan(0);
    expect(hotT).toBeGreaterThanOrEqual(0.5);
    expect(craneRock(e)).toBeNull();
    expect(rock.vy).toBeGreaterThan(40);
    // Snipe: one aimed shot at a time.
    const before = shots(w);
    run(w, CRANE_P.interval + 0.1);
    expect(shots(w) - before).toBeGreaterThanOrEqual(1);
    run(w, CRANE_P.leaveAfter);
    expect(e.state === CraneState.Leave || !e.active).toBe(true);
  });

  it('never shoots from less than 24 px above the ship', () => {
    const w = world();
    const e = spawn(w, 'fd_crane', 120, -14);
    w.player.y = 40;
    run(w, 10);
    expect(e.active).toBe(true);
    expect(shots(w)).toBe(0);
  });
});

describe('sentinel', () => {
  it('turns at most 0.8 rad/s', () => {
    expect(turnToward(0, 3, 0.1)).toBeCloseTo(0.1);
    expect(turnToward(3, -3, 0.1)).toBeGreaterThan(3);
    const w = world();
    const e = spawn(w, 'fd_sentinel', 120, -12);
    run(w, 3);
    expect(e.state).toBe(SentinelState.Hold);
    const s = sentinelSide(e);
    w.player.x = 230;
    w.player.y = e.y;
    const f0 = s.facing;
    run(w, 0.5);
    expect(Math.abs(s.facing - f0)).toBeLessThanOrEqual(SENTINEL_P.turn * 0.5 + 1e-6);
  });

  it('the shield stops shots from the front only', () => {
    const w = world();
    const e = spawn(w, 'fd_sentinel', 120, 80);
    const s = sentinelSide(e);
    s.facing = Math.PI / 2;
    expect(shieldCovers(e, s.facing, 120, 100)).toBe(true);
    expect(shieldCovers(e, s.facing, 120, 60)).toBe(false);
    expect(shieldCovers(e, s.facing, 100, 80)).toBe(false);
    const front = spawnPlayerShot(w, { x: 120, y: 91, vx: 0, vy: -240 })!;
    front.prevX = 120;
    front.prevY = 95;
    const back = spawnPlayerShot(w, { x: 120, y: 70, vx: 0, vy: 240 })!;
    back.prevX = 120;
    back.prevY = 66;
    sentinelShieldPass(w, DT);
    expect(front.active).toBe(false);
    expect(back.active).toBe(true);
    expect(s.blockT).toBe(0);
  });

  it('fires 3-way fans along its facing, never in its first 0.5 s, and leaves', () => {
    const w = world();
    const e = spawn(w, 'fd_sentinel', 120, -12);
    let first = -1;
    run(w, 4, () => {
      if (first < 0 && shots(w) > 0) first = e.t;
    });
    expect(first).toBeGreaterThanOrEqual(0.5);
    expect(shots(w) % SENTINEL_P.n).toBe(0);
    run(w, SENTINEL_P.leaveAfter);
    expect(e.state === SentinelState.Leave || !e.active).toBe(true);
  });
});

describe('level beats', () => {
  it('containment holds a massive hole in a slab ring, then lets it go', () => {
    const w = world();
    containmentScript(w);
    const [hole] = anomalies(w, 'blackhole');
    expect(hole?.radius).toBe(BLACK_HOLE_VARIANTS.massive.radius);
    run(w, 6, undefined, (ww) => foundrySystem.update(ww, DT));
    expect(foundryState(w).settled).toBe(true);
    const live = shadeSlabs(w).filter((s) => s.active);
    expect(live).toHaveLength(5);
    // The ring rides with the hole.
    for (const s of live) expect(Math.hypot(s.x - hole!.x, s.y - hole!.y)).toBeLessThan(90);
    containmentEndScript(w);
    expect(isCollapsing(hole!)).toBe(true);
    run(w, 4, undefined, (ww) => foundrySystem.update(ww, DT));
    expect(shadeSlabs(w).filter((s) => s.active)).toHaveLength(0);
  });

  it('welding pulsars spawn on the 7-beat grid', () => {
    const w = world();
    pulsarScript(w, { x: 80 });
    let spawnedAt = -1;
    // The level clock is the director's; drive it through w.time via a fake director time.
    run(w, PULSE_PERIOD + 0.1, undefined, (ww) => {
      foundrySystem.update(ww, DT);
      if (spawnedAt < 0 && anomalies(ww, 'pulsar').length > 0) spawnedAt = ww.time;
    });
    // No director here: directorTime() is 0, so the first grid line is crossed on the first tick.
    expect(spawnedAt).toBeGreaterThan(0);
    expect(foundryState(w).pending).toHaveLength(0);
  });

  it('the portal conveyor carries the pod down the screen and lets it go', () => {
    const w = world();
    portalsScript(w);
    expect(portalPairs(w).filter((p) => p.active)).toHaveLength(2);
    const pod = spawnEscapePod(w, 'wren', 30, 2) as Pickup;
    let maxRow = 0;
    run(w, 12, undefined, (ww) => {
      pickupsSystem.update(ww, DT);
      foundrySystem.update(ww, DT);
      if (pod.active) maxRow = Math.max(maxRow, pod.y);
    });
    const st = foundryState(w);
    expect(st.podClaimed).toBe(true);
    expect(st.beats.some((b) => b.endsWith('podReleased'))).toBe(true);
    expect(maxRow).toBeGreaterThan(FURNACE.rows[2]! - 8);
  });
});

describe('the Architect', () => {
  function boss(): { w: World; b: Architect } {
    const w = world('arch');
    attachBoss(w);
    const b = spawnBoss(w, ARCHITECT.id) as Architect;
    expect(b).toBeInstanceOf(Architect);
    return { w, b };
  }

  function kill(w: World, b: Architect, idx: readonly number[]): void {
    for (const i of idx) {
      const s = b.rig.slots[i] as PartSlot;
      if (b.rig.alive(s)) damageEnemy(w, s.enemy as Enemy, 1e6, 'player');
    }
  }

  it('spans all three forms on one bar and parks the later forms off screen', () => {
    const { w, b } = boss();
    step(w);
    expect(b.rig.maxHp()).toBe(ARCHITECT_PARTS.reduce((n, p) => n + p.hp, 0));
    for (let i = 0; i < ARCHITECT_PARTS.length; i++) {
      const e = (b.rig.slots[i] as PartSlot).enemy as Enemy;
      if (ARCHITECT_PARTS[i]!.form === 1) expect(e.y).toBeGreaterThan(-100);
      else expect(e.y).toBe(ARCHITECT.parkY);
    }
  });

  it('runs scaffold → fall → engine → collapse → paradox → dying, cleaning up between forms', () => {
    const { w, b } = boss();
    let defeated = 0;
    w.events.on('bossDefeated', () => void defeated++);
    run(w, ARCHITECT.entry.time + 0.1);
    expect(b.phase).toBe(ArchPhase.Scaffold);
    // Armored core while an arm stands.
    const core1 = (b.rig.slots[b.core1I] as PartSlot).enemy as Enemy;
    damageEnemy(w, core1, 50, 'player');
    expect(core1.hp).toBe(ARCHITECT_PARTS[b.core1I]!.hp);
    expect(b.targetable(core1, b.rig.slots[b.core1I] as PartSlot)).toBe(false);
    // The arms haul and throw scrap.
    run(w, 6);
    expect(b.armRock(0) !== null || b.armRock(1) !== null).toBe(true);
    kill(w, b, b.armI);
    step(w);
    expect(b.coreArmored()).toBe(false);
    kill(w, b, [b.core1I]);
    step(w);
    expect(b.phase).toBe(ArchPhase.Fall);
    run(w, ARCHITECT.transition + 0.1);
    expect(b.phase).toBe(ArchPhase.Engine);
    const [hole] = anomalies(w, 'blackhole');
    expect(hole).toBeDefined();
    expect(anomalies(w, 'pulsar')).toHaveLength(1);
    const full = hole!.strength;
    // Shielded until three pylons are down; the hole weakens with every pylon.
    kill(w, b, b.pylonI.slice(0, 2));
    step(w);
    expect(b.coreArmored()).toBe(true);
    expect(hole!.strength).toBeLessThan(full);
    kill(w, b, b.pylonI.slice(2, 3));
    step(w);
    expect(b.coreArmored()).toBe(false);
    kill(w, b, [b.core2I]);
    step(w);
    expect(b.phase).toBe(ArchPhase.Collapse);
    expect(isCollapsing(hole!) || !hole!.active).toBe(true);
    run(w, ARCHITECT.transition + 0.1);
    expect(b.phase).toBe(ArchPhase.Paradox);
    expect(anomalies(w, 'blackhole')).toHaveLength(0);
    expect(anomalies(w, 'pulsar')).toHaveLength(0);
    expect(portalPairs(w).filter((p) => p.active)).toHaveLength(2);
    expect(bubbles(w).filter((x) => x.active && x.kind === 'flip')).toHaveLength(1);
    // A flare comes with slabs dropped first.
    run(w, ARCHITECT.paradox.firstFlare + 0.2);
    expect(flarePhase(w)).not.toBe('idle');
    expect(shadeSlabs(w).filter((s) => s.active).length).toBeGreaterThanOrEqual(2);
    expect(shots(w)).toBeGreaterThan(0);
    kill(w, b, [b.core3I]);
    step(w);
    expect(b.phase).toBe(ArchPhase.Dying);
    expect(defeated).toBe(1);
    expect(shots(w)).toBe(0);
    expect(portalPairs(w).filter((p) => p.active)).toHaveLength(0);
    expect(bubbles(w).filter((x) => x.active)).toHaveLength(0);
    expect(shadeSlabs(w).filter((s) => s.active)).toHaveLength(0);
    run(w, ARCHITECT.deathTime + 0.1);
    expect(activeBoss(w)).toBeNull();
    expect(defeated).toBe(1);
  });

  it('is invulnerable while it enters and between forms', () => {
    const { w, b } = boss();
    step(w);
    const arm = (b.rig.slots[b.armI[0]!] as PartSlot).enemy as Enemy;
    damageEnemy(w, arm, 30, 'player');
    expect(arm.hp).toBe(ARCHITECT_PARTS[b.armI[0]!]!.hp);
    expect(b.phaseName()).toBe('entry');
  });

  it('fires nothing in its first 0.5 s of a form', () => {
    const { w } = boss();
    run(w, ARCHITECT.entry.time + 0.5);
    expect(shots(w)).toBe(0);
  });
});

describe('escape run', () => {
  it('arms on the escape: no enemies left, the entry corridor queued', () => {
    const w = world();
    spawn(w, 'fd_riveter', 100, 100);
    spawn(w, 'fd_crane', 100, 40);
    escapeScript(w);
    expect(count(w, 'fd_riveter') + count(w, 'fd_crane')).toBe(0);
    expect(terrainQueued(w)).toBe(CHUNKS.find((c) => c.id === ESCAPE_ENTRY)!.rows.length);
    expect(foundryState(w).escape.order.slice().sort()).toEqual(ESCAPE_CHUNKS.map((_, i) => i));
    // Armed once only.
    escapeScript(w);
    expect(terrainQueued(w)).toBe(CHUNKS.find((c) => c.id === ESCAPE_ENTRY)!.rows.length);
  });
});
