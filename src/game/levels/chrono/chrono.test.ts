import { describe, expect, it } from 'vitest';
import {
  BUBBLE_MINE_P,
  ECHO,
  ECHO_WEAPONS,
  LEVEL,
  POD,
  REWIND_P,
  STUTTER_P,
} from '../../../content/levels/chrono';
import { ESCAPE_POD_TUNING } from '../../../content/pickups';
import { cleanupSystem } from '../../../sim/cleanup';
import { damageEnemy } from '../../../sim/damage';
import { bulletsSystem } from '../../../sim/motion';
import { spawnEnemy } from '../../../sim/spawn';
import type { Bullet, Enemy, Pickup, WeaponInstance } from '../../../sim/types';
import { createWorld, type World } from '../../../sim/world';
import { activeBoss, attachBoss, spawnBoss, updateBoss } from '../../boss';
import { setEnemyShotSpeedMul, updateEnemies } from '../../enemies';
import { bubbles, spawnBubble, updateHazardsII } from '../../obstacles';
import { attachPickups, pickupsSystem, spawnEscapePod } from '../../pickups';
import { updatePlayer } from '../../player';
import '../index';
import {
  MINE_DRIFT,
  REWIND_RECORD,
  REWIND_SPENT,
  REWIND_WARN,
  STUTTER_FROZEN,
  STUTTER_MOVE,
} from './behaviors';
import { droneCount, Echo, EchoPhase, echoY, selectMirror, W_LANCE } from './echo';
import { echoPod, updatePod } from './pod';
import { chronoState, sweepRecorders } from './state';

const DT = 1 / 60;

function world(seed = 'T41'): World {
  const w = createWorld(seed, { levelId: 'chrono' });
  w.scrollSpeed = 30;
  w.player.x = 120;
  w.player.y = 340;
  w.player.invulnT = 1e9;
  setEnemyShotSpeedMul(w, 1);
  return w;
}

function step(w: World): void {
  w.tick++;
  w.time += DT;
  updatePlayer(w, DT);
  updateEnemies(w, DT);
  updateBoss(w, DT);
  bulletsSystem.update(w, DT);
  updateHazardsII(w, DT);
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

function liveBubbles(w: World): number {
  let n = 0;
  for (const b of bubbles(w)) if (b.active) n++;
  return n;
}

describe('stutterer', () => {
  it('bursts down for 0.4 s, freezes for 0.6 s, and fires a cross on every second freeze', () => {
    const w = world();
    const e = spawn(w, 'cr_stutterer', 120, 20);
    w.player.y = 380;
    const fires: number[] = [];
    let last = 0;
    run(w, 4.05, () => {
      const n = shots(w);
      if (n > last) fires.push(Math.round(w.time * 10) / 10);
      last = n;
      if (e.state === STUTTER_FROZEN) expect(e.vy).toBe(0);
      if (e.state === STUTTER_MOVE && e.t > 0) expect(e.vy).toBe(STUTTER_P.speed);
    });
    // Freezes start at 0.4, 1.4, 2.4, 3.4 s; the cross comes on the 2nd and 4th.
    expect(fires.length).toBe(2);
    expect(fires[0]).toBeCloseTo(1.4, 0);
    expect(fires[1]).toBeCloseTo(3.4, 0);
    expect(chronoState(w).stutterRings).toBe(2);
  });

  it('a 4-shot cross: down, left, up, right', () => {
    const w = world();
    spawn(w, 'cr_stutterer', 120, 40);
    w.player.y = 380;
    run(w, 1.45);
    const dirs = new Set<string>();
    for (let i = 0; i < w.enemyShots.count; i++) {
      const b = w.enemyShots.items[i] as Bullet;
      if (b.active) dirs.add(`${Math.sign(Math.round(b.vx))},${Math.sign(Math.round(b.vy))}`);
    }
    expect([...dirs].sort()).toEqual(['-1,0', '0,-1', '0,1', '1,0']);
  });

  it('runs its clock at the bubble rate (a slow bubble stretches the cycle)', () => {
    const w = world();
    const e = spawn(w, 'cr_stutterer', 120, 60);
    spawnBubble(w, 120, 60, { kind: 'slow', r: 70, vy: 0 });
    run(w, 1);
    // 1 s at ×0.35 is 0.35 s of its own time: still in the first burst.
    expect(e.state).toBe(STUTTER_MOVE);
    expect(e.t).toBeCloseTo(0.35, 1);
  });

  it('holds fire in its first half second and below the 24 px line', () => {
    const w = world();
    spawn(w, 'cr_stutterer', 120, 300);
    w.player.y = 310;
    run(w, 4);
    expect(shots(w)).toBe(0);
  });
});

describe('rewinder', () => {
  it('records, telegraphs for 1 s below half HP, then snaps back to its position and HP 2 s earlier', () => {
    const w = world();
    const e = spawn(w, 'cr_rewinder', 100, 20);
    run(w, 3);
    expect(e.state).toBe(REWIND_RECORD);
    const yAt2 = e.y;
    run(w, 1);
    damageEnemy(w, e, 5, 'player');
    expect(e.hp).toBe(3);
    step(w);
    expect(e.state).toBe(REWIND_WARN);
    run(w, REWIND_P.warn - 0.05);
    expect(e.state).toBe(REWIND_WARN);
    run(w, 0.1);
    expect(e.state).toBe(REWIND_SPENT);
    // Rewound to where it was at about 3 s alive (2 s before the snap at ~5 s): full HP then.
    expect(e.hp).toBe(8);
    expect(Math.abs(e.y - yAt2)).toBeLessThan(5);
    expect(chronoState(w).rewinds).toBe(1);
    // Only once.
    damageEnemy(w, e, 5, 'player');
    run(w, 1.5);
    expect(e.state).toBe(REWIND_SPENT);
    expect(e.hp).toBe(3);
  });

  it('killed inside the window, it is denied', () => {
    const w = world();
    const e = spawn(w, 'cr_rewinder', 100, 20);
    run(w, 2);
    damageEnemy(w, e, 5, 'player');
    run(w, 0.5);
    damageEnemy(w, e, 3, 'player');
    expect(e.active).toBe(false);
    sweepRecorders(w);
    run(w, 1);
    expect(chronoState(w).rewinds).toBe(0);
    expect(chronoState(w).denied).toBe(1);
  });

  it('holds fire while the clock runs', () => {
    const w = world();
    const e = spawn(w, 'cr_rewinder', 120, 20);
    run(w, 2);
    damageEnemy(w, e, 5, 'player');
    step(w);
    const before = shots(w);
    run(w, REWIND_P.warn - 0.1);
    expect(shots(w)).toBe(before);
  });
});

describe('bubble mine', () => {
  it('drifts with the scroll and pops into a 6 s slow bubble when its fuse ends', () => {
    const w = world();
    const e = spawn(w, 'cr_bubblemine', 120, 40);
    step(w);
    expect(e.state).toBe(MINE_DRIFT);
    expect(e.vy).toBe(w.scrollSpeed);
    run(w, BUBBLE_MINE_P.fuse - 0.2);
    expect(e.active).toBe(true);
    expect(liveBubbles(w)).toBe(0);
    run(w, 0.3);
    expect(e.active).toBe(false);
    const b = bubbles(w).find((x) => x.active)!;
    expect(b.kind).toBe('slow');
    expect(b.r).toBe(BUBBLE_MINE_P.bubbleR);
    run(w, BUBBLE_MINE_P.bubbleTtl + 0.1);
    expect(liveBubbles(w)).toBe(0);
  });

  it('pops where it is shot down', () => {
    const w = world();
    const e = spawn(w, 'cr_bubblemine', 80, 100);
    step(w);
    damageEnemy(w, e, 5, 'player');
    const b = bubbles(w).find((x) => x.active)!;
    expect(b.x).toBeCloseTo(80, 0);
    expect(chronoState(w).minePops).toBe(1);
  });
});

describe('echo missile', () => {
  it('turns toward the ship and self-destructs at its ttl', () => {
    const w = world();
    w.player.x = 200;
    const e = spawnEnemy(w, 'cr_missile', 60, 60, { vx: 0, vy: 50 })!;
    run(w, 1);
    expect(e.vx).toBeGreaterThan(0);
    run(w, 4);
    expect(e.active).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The Echo

function arm(w: World, loadout: [string, number][]): void {
  w.player.weapons.length = 0;
  for (const [id, level] of loadout) w.player.weapons.push({ id, level, cooldown: 0, state: 0 });
}

function echoWorld(loadout: [string, number][], seed = 'echo'): { w: World; b: Echo } {
  const w = world(seed);
  w.player.y = 300;
  arm(w, loadout);
  attachBoss(w);
  attachPickups(w);
  // Ten seconds of history, so it follows instead of strafing.
  run(w, 10);
  const b = spawnBoss(w, 'cr_echo');
  if (!(b instanceof Echo)) throw new Error('no echo');
  return { w, b };
}

interface Signature {
  shots: number;
  large: number;
  missiles: number;
  drones: number;
  lance: boolean;
  arcHit: boolean;
  bounced: boolean;
  shards: number;
}

/** Plays `secs` of the fight and records what the Echo did. */
function observe(w: World, b: Echo, secs: number): Signature {
  const sig: Signature = {
    shots: 0,
    large: 0,
    missiles: 0,
    drones: 0,
    lance: false,
    arcHit: false,
    bounced: false,
    shards: 0,
  };
  const seen = new Set<number>();
  const vx = new Map<number, number>();
  w.events.on('playerHit', () => void (sig.arcHit = sig.arcHit || b.echoE.zapT > 0));
  run(w, secs, () => {
    if (b.echoE.lanceT >= 0) sig.lance = true;
    for (let i = 0; i < w.enemyShots.count; i++) {
      const s = w.enemyShots.items[i] as Bullet;
      if (!s.active) continue;
      const prev = vx.get(s.id);
      if (prev !== undefined && Math.sign(prev) !== Math.sign(s.vx) && prev !== 0)
        sig.bounced = true;
      vx.set(s.id, s.vx);
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      sig.shots++;
      if (s.sprite === 'ebullet_l') sig.large++;
      // Shards leave a burst point well below the Echo at low speed.
      if (s.y > b.rig.y + 40 && Math.hypot(s.vx, s.vy) < 60) sig.shards++;
    }
    sig.missiles = Math.max(sig.missiles, count(w, 'cr_missile'));
    let d = 0;
    for (const s of b.drones) if (b.rig.alive(s)) d++;
    sig.drones = Math.max(sig.drones, d);
  });
  return sig;
}

describe('echo: mirrored loadout', () => {
  it('mirrors the three highest-level weapons, ties to the oldest', () => {
    const idx = new Int8Array(3);
    const lv = new Int8Array(3);
    const ws: WeaponInstance[] = [
      { id: 'blaster', level: 2, cooldown: 0, state: 0 },
      { id: 'spread', level: 4, cooldown: 0, state: 0 },
      { id: 'lance', level: 2, cooldown: 0, state: 0 },
      { id: 'seeker', level: 3, cooldown: 0, state: 0 },
    ];
    expect(selectMirror(ws, 3, idx, lv)).toBe(3);
    expect([...idx].map((k) => ECHO_WEAPONS[k])).toEqual(['spread', 'seeker', 'blaster']);
    expect([...lv]).toEqual([4, 3, 2]);
    expect(selectMirror(ws.slice(0, 1), 3, idx, lv)).toBe(1);
    expect([...idx]).toEqual([0, -1, -1]);
  });

  it('maps the past row into the top band, and drones by level', () => {
    expect(echoY(240)).toBe(60);
    expect(echoY(300)).toBe(90);
    expect(echoY(0)).toBe(ECHO.yMap.min);
    expect(echoY(400)).toBe(140);
    expect([0, 1, 2, 3, 4, 5].map((l) => droneCount(l))).toEqual([0, 1, 1, 2, 2, 3]);
  });

  const SIGNS: Record<string, (s: Signature) => boolean> = {
    blaster: (s) => s.shots > 0 && s.large === 0 && s.missiles === 0 && !s.lance,
    spread: (s) => s.shots >= 6 && s.large === 0 && s.missiles === 0,
    lance: (s) => s.lance && s.large >= 3,
    seeker: (s) => s.missiles >= 1 && s.shots === 0,
    orbitDrones: (s) => s.drones >= 2 && s.shots === 0,
    arc: (s) => s.arcHit && s.shots === 0,
    ricochet: (s) => s.bounced && s.large > 0,
    flak: (s) => s.large > 0 && s.shards >= 6,
  };

  for (const id of ECHO_WEAPONS) {
    it(`fires its own pattern for ${id}`, () => {
      const { w, b } = echoWorld([[id, 3]], `echo-${id}`);
      if (id === 'arc') {
        // The zap only reaches a ship within 60 px; park the ship just under the Echo.
        run(w, ECHO.entry.duration);
        let hit = false;
        w.events.on('playerHit', () => void (hit = true));
        for (let i = 0; i < 180 && !hit; i++) {
          w.player.invulnT = 0;
          w.player.x = b.rig.x;
          w.player.y = b.rig.y + 40;
          step(w);
        }
        expect(hit).toBe(true);
        return;
      }
      if (id === 'ricochet') w.player.x = 30;
      const sig = observe(w, b, 8);
      expect(SIGNS[id]!(sig), JSON.stringify(sig)).toBe(true);
    });
  }

  it('changes its pattern set with the loadout (all eight weapons)', () => {
    const sets = new Set<string>();
    for (const id of ECHO_WEAPONS) {
      const { w, b } = echoWorld([[id, 3]], `echo-set-${id}`);
      run(w, ECHO.entry.duration + 0.1);
      sets.add([...b.mirror].join(','));
      expect(b.mirroredLevel(ECHO_WEAPONS.indexOf(id))).toBe(3);
    }
    expect(sets.size).toBe(8);
    // Four weapons: the lowest-level one is left out.
    const { w, b } = echoWorld([
      ['blaster', 3],
      ['lance', 1],
      ['spread', 3],
      ['flak', 2],
    ]);
    run(w, 0.1);
    expect(b.mirroredLevel(W_LANCE)).toBe(0);
    expect(b.mirrorN).toBe(3);
  });

  it('spread fans go 5-way from level 4, blaster twins from level 4', () => {
    const { w, b } = echoWorld([['spread', 4]], 'echo-s4');
    // Spread's first volley comes 1.05 s after the entry, the blaster's at 0.6 s.
    const sig = observe(w, b, ECHO.entry.duration + 1.2);
    expect(sig.shots).toBe(5);
    const t = echoWorld([['blaster', 4]], 'echo-b4');
    const sig2 = observe(t.w, t.b, ECHO.entry.duration + 1.2);
    expect(sig2.shots).toBe(2);
  });

  it('never fires aimed shots from less than 24 px above the ship', () => {
    const { w, b } = echoWorld([
      ['blaster', 5],
      ['spread', 5],
      ['flak', 5],
    ]);
    run(w, ECHO.entry.duration);
    let bad = 0;
    run(w, 6, () => {
      w.player.y = b.rig.y + 30;
      w.player.x = 200;
    });
    for (let i = 0; i < w.enemyShots.count; i++) {
      const s = w.enemyShots.items[i] as Bullet;
      if (s.active && s.vy > 0 && s.y < b.rig.y + 20) bad++;
    }
    expect(bad).toBe(0);
  });
});

describe('echo: movement and phases', () => {
  it('flies the ship path from 8 s ago, x copied and y mapped', () => {
    const w = world('echo-path');
    arm(w, [['blaster', 1]]);
    attachBoss(w);
    w.player.x = 40;
    w.player.y = 300;
    run(w, 4);
    w.player.x = 200;
    w.player.y = 360;
    run(w, 6);
    const b = spawnBoss(w, 'cr_echo') as Echo;
    run(w, ECHO.entry.duration + 0.2);
    // 12.7 s in: 8 s ago was 4.7 s, after the jump.
    expect(b.rig.x).toBeCloseTo(200, 0);
    expect(b.rig.y).toBeCloseTo(echoY(360), 0);
    run(w, 5);
    expect(b.rig.x).toBeCloseTo(200, 0);
  });

  it('strafes when there is no history yet (sandbox)', () => {
    const w = world('echo-strafe');
    arm(w, [['blaster', 1]]);
    attachBoss(w);
    const b = spawnBoss(w, 'cr_echo') as Echo;
    run(w, 4);
    expect(b.rig.y).toBeCloseTo(ECHO.strafe.y, 0);
  });

  it('echo → ghost (60%) → paradox (25%) → dying → done, defeated once', () => {
    const { w, b } = echoWorld([['blaster', 2]], 'echo-phases');
    const toasts: string[] = [];
    let defeated = 0;
    w.events.on('toast', (t) => void toasts.push(t.text));
    w.events.on('bossDefeated', () => void defeated++);
    expect(b.phaseName()).toBe('entry');
    const core = b.core.enemy!;
    damageEnemy(w, core, 50, 'player');
    expect(core.hp).toBe(ECHO.parts[0]!.hp);
    run(w, ECHO.entry.duration + 0.1);
    expect(b.phaseName()).toBe('echo');
    damageEnemy(w, core, core.hp - Math.floor(core.maxHp * 0.59), 'player');
    step(w);
    expect(b.phaseName()).toBe('ghost');
    expect(b.rig.alive(b.ghost)).toBe(true);
    // The ghost settles onto its own 4 s lag.
    run(w, 1.5);
    expect(b.ghostDelay).toBeCloseTo(ECHO.ghostDelay, 1);
    damageEnemy(w, core, core.hp - Math.floor(core.maxHp * 0.24), 'player');
    step(w);
    expect(b.phaseName()).toBe('paradox');
    expect(toasts).toContain('PARADOX');
    const flip = b.flip!;
    expect(flip.kind).toBe('flip');
    expect(Math.hypot(flip.x - b.rig.x, flip.y - b.rig.y)).toBeLessThan(2);
    run(w, 1);
    expect(bubbles(w).some((x) => x.active && x.kind === 'slow')).toBe(true);
    damageEnemy(w, core, core.hp, 'player');
    step(w);
    expect(b.phaseName()).toBe('dying');
    expect(defeated).toBe(1);
    expect(b.rig.alive(b.ghost)).toBe(false);
    expect(flip.active).toBe(false);
    const d = ECHO.death;
    run(w, d.freeze + d.rewind + d.shatter + 0.1);
    expect(b.done).toBe(true);
    expect(activeBoss(w)).toBe(null);
    expect(defeated).toBe(1);
  });

  it('the ghost fires only the first mirrored weapon', () => {
    const { w, b } = echoWorld([
      ['spread', 3],
      ['seeker', 3],
    ]);
    run(w, ECHO.entry.duration + 0.1);
    b.skipTo(w, 'ghost');
    expect(b.phase).toBe(EchoPhase.Ghost);
    const sk = ECHO_WEAPONS.indexOf('seeker');
    const sp = ECHO_WEAPONS.indexOf('spread');
    const seeker0 = b.ghostE.timers[sk];
    const spread0 = b.ghostE.timers[sp]!;
    run(w, 1);
    expect(b.ghostE.timers[sk]).toBe(seeker0);
    expect(b.ghostE.timers[sp]).toBeLessThan(spread0);
  });

  it('its clocks run at the rate of the bubble it is in', () => {
    const { w, b } = echoWorld([['blaster', 1]]);
    run(w, ECHO.entry.duration + 0.1);
    const k = ECHO_WEAPONS.indexOf('blaster');
    b.echoE.timers[k] = 10;
    run(w, 1);
    expect(b.echoE.timers[k]).toBeCloseTo(9, 1);
    spawnBubble(w, b.rig.x, b.rig.y, { kind: 'slow', r: 70, vy: 0 });
    run(w, 1, () => {
      // Keep the bubble on the Echo.
      const bb = bubbles(w).find((x) => x.active)!;
      bb.x = b.rig.x;
      bb.y = b.rig.y;
    });
    expect(b.echoE.timers[k]).toBeCloseTo(9 - 0.35, 1);
    expect(b.delay).toBeGreaterThan(ECHO.delay);
  });

  it('blocker drones respawn 8 s after they are shot down', () => {
    const { w, b } = echoWorld([['orbitDrones', 3]]);
    run(w, ECHO.entry.duration + 0.2);
    const d = b.drones[0]!;
    expect(b.rig.alive(d)).toBe(true);
    damageEnemy(w, d.enemy!, 20, 'player');
    step(w);
    expect(b.rig.alive(d)).toBe(false);
    run(w, ECHO.drones.respawn - 0.2);
    expect(b.rig.alive(d)).toBe(false);
    run(w, 0.4);
    expect(b.rig.alive(d)).toBe(true);
  });
});

describe('pod beat', () => {
  it('the real pod replays the echo pod path exactly, 6 s later, bubbles and all', () => {
    const w = world('pod');
    attachPickups(w);
    const tick = (): void => {
      w.tick++;
      w.time += DT;
      updateHazardsII(w, DT);
      pickupsSystem.update(w, DT);
      updatePod(w, DT);
    };
    w.player.x = 10;
    w.player.y = 390;
    echoPod(w);
    const p = chronoState(w).pod;
    const x0 = p.x;
    expect(x0).toBeGreaterThanOrEqual(POD.margin);
    // A slow bubble on the echo's path that has moved away by the time the real pod passes.
    spawnBubble(w, x0, 40, { kind: 'slow', r: 40, vy: 0, ttl: 4 });
    const echoAt: number[] = [];
    for (let i = 0; i < POD.lead * 60; i++) {
      tick();
      echoAt.push(p.y);
    }
    // The director's escapePod event lands at its own random x; the next pod step claims it.
    const pod: Pickup | null = spawnEscapePod(w, 'halasz', 200, POD.hp);
    expect(pod).not.toBeNull();
    tick();
    expect(pod!.x).toBe(x0);
    expect(pod!.y).toBe(-ESCAPE_POD_TUNING.r - 2);
    for (let i = 0; i < 300; i++) {
      tick();
      expect(pod!.y).toBeCloseTo(echoAt[i]!, 3);
    }
    // The echo slowed in its bubble; a free pod would have fallen further.
    expect(echoAt[239]!).toBeLessThan(-ESCAPE_POD_TUNING.r - 2 + ESCAPE_POD_TUNING.speed * 4 - 5);
  });

  it('the level timeline places the echo at 100 s and the real pod at 106 s', () => {
    const echo = LEVEL.timeline.find((e) => 'script' in e && e.script === 'chrono.echoPod')!;
    const pods = LEVEL.timeline.filter((e) => 'escapePod' in e);
    expect(echo.t).toBe(100);
    expect(pods).toHaveLength(1);
    expect(pods[0]!.t - echo.t).toBe(POD.lead);
  });
});
