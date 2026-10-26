import { describe, expect, it } from 'vitest';
import { MAGNETAR } from '../../src/content/levels/pulsarNursery';
import { PULSAR_DOUBLE_DELAY, PULSAR_VARIANTS } from '../../src/content/obstacles';
import { spawnBoss, updateBoss } from '../../src/game/boss';
import { updateEnemies } from '../../src/game/enemies';
import { Magnetar, MagPhase } from '../../src/game/levels/pulsarNursery';
import {
  obstaclesSystem,
  pulsarEchoRadius,
  pulsarGapAngles,
  pulsarGapWidth,
  pulsarGlow,
  pulsarRingRadius,
  pulseIndex,
  spawnPulsar,
} from '../../src/game/obstacles';
import { pulsarEchoRot, pulsarRingRot } from '../../src/game/obstacles/anomalies/pulsar';
import { ext } from '../../src/game/obstacles/anomalies/state';
import { damageEnemy } from '../../src/sim/damage';
import { pinAnomaly } from '../../src/sim/scroll';
import type { Anomaly, Enemy } from '../../src/sim/types';
import { createWorld, type World } from '../../src/sim/world';
import '../../src/game/levels';

// "Every ring hit must be avoidable": a bot that reads each ring's gaps (the
// telegraph's next gaps, or the live ring's) and *flies* to the nearest gap
// at its distance at the ship's speed (Kestrel, 120 px/s) takes no ring hit
// over 10 pulses, for every variant the sector uses. A bot that stands still
// on a solid bearing is hit, so the check isn't vacuous.

const DT = 1 / 60;
const SPEED = 120;
const GAPS = [0, 0, 0, 0, 0, 0, 0, 0];

function world(): World {
  const w = createWorld('gaps', { levelId: 'pulsarNursery' });
  w.scrollSpeed = 0;
  const p = w.player;
  p.alive = true;
  p.shield = p.maxShield = 99;
  p.r = 4;
  return w;
}

interface Next {
  t: number;
  rot: number;
  a: Anomaly;
}

/** Rings that will cross the player's distance next, soonest first. */
function nextRings(list: readonly Anomaly[], px: number, py: number, tele: number): Next[] {
  const out: Next[] = [];
  for (const a of list) {
    if (!a.active) continue;
    const d = Math.hypot(px - a.x, py - a.y);
    const n = pulsarGapAngles(a, GAPS);
    if (n < 1) continue;
    const g = pulsarGlow(a);
    const R = pulsarRingRadius(a);
    if (g > 0) out.push({ t: (1 - g) * tele + (d - a.r) / a.strength, rot: GAPS[0] as number, a });
    // The live ring can still be on its way out while the next one is telegraphed.
    // Until its trailing edge has cleared the hull.
    if (R >= 0 && R < d + 8)
      out.push({ t: Math.max(0, d - R) / a.strength, rot: pulsarRingRot(a), a });
    // A `double` pulsar's echo trails each ring by PULSAR_DOUBLE_DELAY, half a spacing round.
    if (ext(a).double) {
      const half = Math.PI / n;
      if (g > 0)
        out.push({
          t: (1 - g) * tele + PULSAR_DOUBLE_DELAY + (d - a.r) / a.strength,
          rot: (GAPS[0] as number) + half,
          a,
        });
      const E = pulsarEchoRadius(a);
      const toEcho = E >= 0 ? (d - E) / a.strength : (d - R) / a.strength + PULSAR_DOUBLE_DELAY;
      if (R >= 0 && (E < 0 || E < d + 8))
        out.push({ t: Math.max(0, toEcho), rot: pulsarEchoRot(a), a });
    }
  }
  return out.sort((x, y) => x.t - y.t);
}

/** Angular distance from `ang` to the nearest gap of a ring (0 inside one). */
function toGap(ang: number, rot: number, n: number, halfW: number): number {
  const step = (Math.PI * 2) / n;
  let rel = (ang - rot) % step;
  if (rel < 0) rel += step;
  const off = Math.min(rel, step - rel);
  return Math.max(0, off - halfW);
}

/**
 * Steps the player toward the best on-screen point inside one of the next
 * ring's gaps (any distance from the core, or just past its reach), at the
 * ship's top speed. When a second ring follows close behind (meltdown's
 * echo), it waits on the edge of the gap nearest the echo's gap, the way a
 * player learns to. Points nearer than `minD` to the core are skipped.
 */
function fly(w: World, list: readonly Anomaly[], minD: number, tele: number): void {
  const p = w.player;
  p.invulnT = 0;
  const rings = nextRings(list, p.x, p.y, tele);
  const nx = rings[0];
  if (nx === undefined) return;
  const after = rings[1] !== undefined && rings[1].t - nx.t < 1 ? rings[1] : null;
  const a = nx.a;
  const n = pulsarGapAngles(a, GAPS);
  const step = (Math.PI * 2) / n;
  let tx = p.x;
  let ty = p.y;
  let bd = Infinity;
  const consider = (x: number, y: number, extra: number) => {
    if (x < 8 || x > 232 || y < 8 || y > 392) return;
    const c = Math.hypot(x - p.x, y - p.y) + extra;
    if (c < bd) {
      bd = c;
      tx = x;
      ty = y;
    }
  };
  for (let d = minD; d <= a.radius; d += 6) {
    // Keep the whole hull (plus 2 px) inside the gap at this distance.
    const room = pulsarGapWidth(a) / 2 - Math.asin(Math.min(1, (p.r + 3) / d));
    if (room <= 0) continue;
    for (let k = 0; k < n; k++) {
      for (let j = -4; j <= 4; j++) {
        const ang = nx.rot + k * step + (j / 4) * room;
        // Cost of the hop on to the following ring's gap from here (px of arc).
        const hop = after === null ? 0 : toGap(ang, after.rot, n, room) * d * 3;
        consider(a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d, hop);
      }
    }
  }
  // Out of reach also works: the nearest point past the ring's max radius.
  const far = a.radius + 14;
  for (let k = 0; k < 72; k++) {
    const ang = (k / 72) * Math.PI * 2;
    consider(a.x + Math.cos(ang) * far, a.y + Math.sin(ang) * far, 0);
  }
  const dist = Math.hypot(tx - p.x, ty - p.y);
  const k = dist > SPEED * DT ? (SPEED * DT) / dist : 1;
  p.prevX = p.x;
  p.prevY = p.y;
  p.x += (tx - p.x) * k;
  p.y += (ty - p.y) * k;
}

function countHits(w: World): () => number {
  let n = 0;
  w.events.on('playerHit', () => {
    n++;
    if (process.env.DBG) {
      const p = w.player;
      for (let i = 0; i < w.anomalies.count; i++) {
        const a = w.anomalies.items[i]!;
        if (!a.active) continue;
        const k = pulsarGapAngles(a, GAPS);
        console.log(
          'HIT',
          w.time.toFixed(2),
          'p',
          p.x.toFixed(1),
          p.y.toFixed(1),
          'r',
          p.r,
          'd',
          Math.hypot(p.x - a.x, p.y - a.y).toFixed(1),
          'R',
          pulsarRingRadius(a).toFixed(1),
          'g',
          pulsarGlow(a).toFixed(2),
          'ang',
          ((Math.atan2(p.y - a.y, p.x - a.x) * 180) / Math.PI).toFixed(1),
          'gaps',
          GAPS.slice(0, k)
            .map((x) => ((x * 180) / Math.PI).toFixed(0))
            .join('/'),
        );
      }
    }
  });
  return () => n;
}

describe('pulsar gaps are reachable (sector 4 variants)', () => {
  for (const variant of ['steady', 'turning', 'quick'] as const) {
    it(`${variant}: a gap-flying ship takes 0 ring hits over 10 pulses; standing still is hit`, () => {
      const v = PULSAR_VARIANTS[variant];
      for (const fly_ of [true, false]) {
        const w = world();
        const hits = countHits(w);
        const a = spawnPulsar(w, 120, 140, { vy: 0, variant })!;
        pinAnomaly(a);
        const p = w.player;
        p.x = 120 + 150 * Math.cos(0.5);
        p.y = 140 + 150 * Math.sin(0.5);
        while (pulseIndex(a) < 10 || pulsarRingRadius(a) >= 0) {
          if (fly_) fly(w, [a], 40, v.telegraph);
          else p.invulnT = 0;
          w.tick++;
          w.time += DT;
          obstaclesSystem.update(w, DT);
          if (w.time > 40) break;
        }
        if (fly_) expect(hits(), `${variant} flying`).toBe(0);
        else expect(hits(), `${variant} standing`).toBeGreaterThan(0);
      }
    });
  }
});

describe('Magnetar rings are reachable from the bottom of the screen', () => {
  for (const [name, phase] of [
    ['phase 1', MagPhase.P1],
    ['phase 2', MagPhase.P2],
    ['meltdown (ring + echo)', MagPhase.Meltdown],
  ] as const) {
    it(`${name}: 0 ring hits over 10 pulses, never closer than 200 px to the core`, () => {
      const w = world();
      const hits = countHits(w);
      const b = spawnBoss(w, MAGNETAR.id) as Magnetar;
      const p = w.player;
      p.x = 120;
      p.y = 96 + 250;
      const tick = () => {
        w.tick++;
        w.time += DT;
        updateEnemies(w, DT);
        updateBoss(w, DT);
        obstaclesSystem.update(w, DT);
        // Rings only: the guns' shots are another test's business.
        for (let i = 0; i < w.enemyShots.count; i++) {
          const s = w.enemyShots.items[i]!;
          if (s.active) w.enemyShots.release(s);
        }
      };
      while (b.phase === MagPhase.Entry) tick();
      if (phase >= MagPhase.P2) {
        for (const s of b.pylons) if (s.enemy) damageEnemy(w, s.enemy as Enemy, 1e6, 'player');
        tick();
        while (b.shieldDown() < 1) tick();
      }
      if (phase === MagPhase.Meltdown) {
        const c = b.core.enemy as Enemy;
        c.hp = Math.floor(MAGNETAR.parts[4]!.hp * MAGNETAR.meltdownAt * 0.8);
        while (b.echo() === null) tick();
      }
      // Let the pattern settle, then count 10 pulses.
      const a = b.main()!;
      const start = pulseIndex(a) + 1;
      while (pulseIndex(a) < start) tick();
      const before = hits();
      const list = () => [b.main()].filter((x): x is Anomaly => x !== null);
      let guard = 0;
      while (pulseIndex(a) < start + 10 && guard++ < 60 * 40) {
        fly(w, list(), 200, MAGNETAR.ring.telegraph);
        tick();
      }
      expect(pulseIndex(a)).toBeGreaterThanOrEqual(start + 10);
      expect(b.phase).toBe(phase);
      expect(hits() - before).toBe(0);
    });
  }
});
