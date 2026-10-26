import { describe, expect, it } from 'vitest';
import { PLAYER_TUNING as T } from '../../content/player';
import { computePlayerStats, createDefaultSave } from '../../meta';
import { damagePlayer } from '../../sim/damage';
import type { MoveIntent } from '../../sim/types';
import { createWorld, type World } from '../../sim/world';
import { approachVelocity, clampToPlayfield, desiredVelocity, stepMovement } from './movement';
import { blinkVisible } from './playerDraw';
import { getPlayerRuntime, initPlayer, setGodMode, updatePlayer } from './playerSystem';

const DT = 1 / 60;

function intent(x: number, y: number, tx: number | null = null, ty: number | null = null) {
  return { x, y, targetX: tx, targetY: ty } satisfies MoveIntent;
}

function world(ship = 'kestrel', pilot = 'blastroid'): World {
  const w = createWorld('PLAYER', { shipId: ship, pilotId: pilot });
  initPlayer(w, computePlayerStats(createDefaultSave(), ship, pilot));
  return w;
}

describe('movement', () => {
  it('clamps to the playfield with an 8 px margin and kills velocity into the wall', () => {
    const k = { x: -5, y: 500, vx: -50, vy: 40 };
    clampToPlayfield(k);
    expect(k).toEqual({ x: 8, y: 392, vx: 0, vy: 0 });
    const k2 = { x: 300, y: 2, vx: 10, vy: 10 };
    clampToPlayfield(k2);
    expect(k2).toEqual({ x: 232, y: 8, vx: 0, vy: 10 });
  });

  it('accelerates to full speed in ~60 ms and stops in ~40 ms', () => {
    const k = { x: 120, y: 200, vx: 0, vy: 0 };
    let ticks = 0;
    while (k.vx < 120) {
      approachVelocity(k, 120, 0, 120, DT);
      ticks++;
    }
    expect(ticks * DT).toBeCloseTo(T.accelTime, 1);
    ticks = 0;
    while (k.vx > 0) {
      approachVelocity(k, 0, 0, 120, DT);
      ticks++;
    }
    expect(ticks).toBeLessThanOrEqual(Math.ceil(T.stopTime / DT));
    expect(ticks).toBeGreaterThan(1);
  });

  it('brakes at the stop rate when reversing', () => {
    const k = { x: 0, y: 0, vx: 120, vy: 0 };
    approachVelocity(k, -120, 0, 120, DT);
    expect(k.vx).toBeCloseTo(120 - 120 / T.stopTime / 60);
  });

  it('mouse target: full speed far away, d × gain inside the arrival zone', () => {
    const out = { x: 0, y: 0 };
    desiredVelocity({ x: 100, y: 200, vx: 0, vy: 0 }, intent(0, 0, 200, 200), 120, out);
    expect(out.x).toBeCloseTo(120);
    expect(out.y).toBeCloseTo(0);
    desiredVelocity({ x: 100, y: 200, vx: 0, vy: 0 }, intent(0, 0, 100, 205), 120, out);
    expect(out.x).toBeCloseTo(0);
    expect(out.y).toBeCloseTo(5 * T.arriveGain);
    desiredVelocity({ x: 100, y: 200, vx: 0, vy: 0 }, intent(0, 0, 100, 200), 120, out);
    expect(out).toEqual({ x: 0, y: 0 });
  });

  it('mouse target: settles without overshoot, then holds perfectly still', () => {
    const k = { x: 100, y: 300, vx: 0, vy: 0 };
    const i = intent(0, 0, 140, 280);
    let prevD = Infinity;
    for (let t = 0; t < 90; t++) {
      stepMovement(k, i, 120, DT);
      const d = Math.hypot(140 - k.x, 280 - k.y);
      expect(d).toBeLessThanOrEqual(prevD + 1e-9);
      expect(k.x).toBeLessThanOrEqual(140);
      prevD = d;
    }
    expect(k).toEqual({ x: 140, y: 280, vx: 0, vy: 0 });
    for (let t = 0; t < 60; t++) stepMovement(k, i, 120, DT);
    expect(k).toEqual({ x: 140, y: 280, vx: 0, vy: 0 });
  });

  it('mouse target outside the clamp is pulled inside so the ship rests at the wall', () => {
    const k = { x: 20, y: 200, vx: 0, vy: 0 };
    for (let t = 0; t < 60; t++) stepMovement(k, intent(0, 0, 0, 200), 120, DT);
    expect(k.x).toBe(8);
    expect(k.vx).toBe(0);
  });

  it('keys: diagonal intent moves at speed along the normalized direction', () => {
    const k = { x: 120, y: 200, vx: 0, vy: 0 };
    for (let t = 0; t < 10; t++) stepMovement(k, intent(Math.SQRT1_2, -Math.SQRT1_2), 120, DT);
    expect(Math.hypot(k.vx, k.vy)).toBeCloseTo(120);
  });
});

describe('initPlayer', () => {
  it('applies ship, pilot and save stats', () => {
    const w = world('bulwark', 'grieg');
    const p = w.player;
    expect(p.x).toBe(120);
    expect(p.y).toBe(340);
    expect(p.r).toBe(4);
    expect(p.maxShield).toBe(6); // 5 + Grieg's +1
    expect(p.shield).toBe(6);
    expect(p.speed).toBeCloseTo(95 * 0.9);
    expect(p.maxWeaponSlots).toBe(3);
    expect(p.weapons.map((x) => [x.id, x.level])).toEqual([
      ['blaster', 1],
      ['orbitDrones', 1],
    ]);
    expect(p.pickupRadius).toBe(14); // Grieg has no pickup bonus
  });

  it('applies hangar upgrades and the pilot pickup bonus', () => {
    const save = { ...createDefaultSave(), upgrades: { tractor: 2, plating: 1 } };
    const w = createWorld('UPG');
    const loadout = computePlayerStats(save, 'kestrel', 'blastroid');
    initPlayer(w, loadout);
    expect(w.player.maxShield).toBe(4);
    // Blastroid +10%, Tractor Coils 2 × 15%.
    expect(loadout.stats.pickupRadiusMul).toBeGreaterThan(1.3);
    expect(w.player.pickupRadius).toBeCloseTo(14 * loadout.stats.pickupRadiusMul);
    expect(w.player.stats).not.toBe(loadout.stats);
  });
});

describe('player system', () => {
  it('counts invulnerability down', () => {
    const w = world();
    damagePlayer(w, 1);
    expect(w.player.invulnT).toBe(1);
    for (let t = 0; t < 30; t++) updatePlayer(w, DT);
    expect(w.player.invulnT).toBeCloseTo(0.5);
    for (let t = 0; t < 40; t++) updatePlayer(w, DT);
    expect(w.player.invulnT).toBe(0);
  });

  it('flashes and plays player_hit on a non-lethal hit', () => {
    const w = world();
    const sfx: string[] = [];
    w.events.on('sfx', (e) => sfx.push(e.id));
    damagePlayer(w, 1);
    expect(getPlayerRuntime(w).hitFlashT).toBeGreaterThan(0);
    expect(sfx).toEqual(['player_hit']);
  });

  it('banks past 40% of speed and lengthens the flame when climbing', () => {
    const w = world();
    w.input.x = -1;
    for (let t = 0; t < 10; t++) updatePlayer(w, DT);
    expect(getPlayerRuntime(w).bank).toBe(-1);
    w.input.x = 0.3;
    for (let t = 0; t < 10; t++) updatePlayer(w, DT);
    expect(getPlayerRuntime(w).bank).toBe(0);
    w.input.x = 0;
    w.input.y = -1;
    for (let t = 0; t < 10; t++) updatePlayer(w, DT);
    expect(getPlayerRuntime(w).boost).toBe(true);
  });

  it('death: hides, ignores input, hitstop + sfx, then runOver after 2 s', () => {
    const w = world();
    const log: string[] = [];
    w.events.on('sfx', (e) => log.push('sfx:' + e.id));
    w.events.on('hitstop', (e) => log.push('hitstop:' + e.dur));
    let over: boolean | null = null;
    let overTick = -1;
    w.events.on('runOver', (e) => {
      over = e.victory;
      overTick = w.tick;
    });
    w.player.shield = 0;
    damagePlayer(w, 1);
    expect(w.player.alive).toBe(false);
    expect(log).toEqual(['sfx:player_die', 'hitstop:0.12']);

    const x = w.player.x;
    w.input.x = 1;
    for (let t = 1; t <= 130; t++) {
      w.tick = t;
      updatePlayer(w, DT);
    }
    expect(w.player.x).toBe(x);
    expect(over).toBe(false);
    expect(overTick).toBe(120);
  });

  it('sandbox god mode keeps damagePlayer from landing', () => {
    const w = world();
    setGodMode(true);
    try {
      updatePlayer(w, DT);
      expect(damagePlayer(w, 5)).toBe(false);
      expect(w.player.alive).toBe(true);
    } finally {
      setGodMode(false);
    }
  });

  it('re-initialising the same world does not double-subscribe', () => {
    const w = world();
    initPlayer(w, computePlayerStats(createDefaultSave(), 'dart', 'blastroid'));
    const sfx: string[] = [];
    w.events.on('sfx', (e) => sfx.push(e.id));
    damagePlayer(w, 1);
    expect(sfx).toEqual(['player_hit']);
    expect(getPlayerRuntime(w).spriteBankL).toBe('dart_bank_l');
  });
});

describe('blink', () => {
  it('toggles at 15 Hz', () => {
    let toggles = 0;
    let prev = blinkVisible(1);
    for (let t = 1; t > 0; t -= 1 / 600) {
      const v = blinkVisible(t);
      if (v !== prev) toggles++;
      prev = v;
    }
    expect(toggles).toBeGreaterThanOrEqual(29);
    expect(toggles).toBeLessThanOrEqual(30);
  });
});
