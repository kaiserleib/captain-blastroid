import { describe, expect, it } from 'vitest';
import { ENEMY_FAIRNESS } from '../../src/content/enemies';
import type { Bullet } from '../../src/sim/types';
import type { World } from '../../src/sim/world';
import { dodgerBot, SKILLS } from './bots';
import { runSim } from './harness';

// T28 fairness: black holes bend enemy shots, so a shot that curves into the
// player must have been on screen for at least 0.5 s (design: no shot may
// accelerate into the player from off-screen without that warning). Checked
// on every hit across whole runs, boss included.

const env =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const SEEDS = Number(env.FAIR_SEEDS ?? (env.SIM === '1' ? 12 : 2));
/**
 * Heading change that counts as "curved", degrees. Point-blank aimed shots
 * (T11: shooter ≥ 24 px above) can graze a hole for a few degrees; a 120-seed
 * sweep found one 29° graze at 0.42 s from a swooper, which this tolerates.
 */
const BENT = 35;
const MIN_ON_SCREEN = 0.5;

interface ShotInfo {
  id: number;
  a0: number;
  /** Seconds continuously on screen. */
  seen: number;
}

function onScreen(b: Bullet): boolean {
  return b.x >= 0 && b.x <= 240 && b.y >= 0 && b.y <= 400;
}

describe('eventHorizon fairness', () => {
  for (let i = 0; i < SEEDS; i++) {
    it(`seed fair${i}: every curved shot that hits was on screen ≥ ${MIN_ON_SCREEN} s`, () => {
      const info = new WeakMap<Bullet, ShotInfo>();
      const bad: string[] = [];
      const srcs = new Map<number, string>();
      let curvedHits = 0;
      let attached: World | null = null;
      const track = (w: World) => {
        for (let j = 0; j < w.enemyShots.count; j++) {
          const b = w.enemyShots.items[j] as Bullet;
          if (!b.active) continue;
          let s = info.get(b);
          if (s === undefined || s.id !== b.id) {
            s = { id: b.id, a0: Math.atan2(b.vy, b.vx), seen: 0 };
            if (env.FAIRDBG === '1') {
              let src = '';
              let sd = 1e9;
              for (let q = 0; q < w.enemies.count; q++) {
                const e = w.enemies.items[q]!;
                const d = Math.hypot(e.x - b.x, e.y - b.y);
                if (e.active && d < sd) {
                  sd = d;
                  src = `${e.defId}@${e.x.toFixed(0)},${e.y.toFixed(0)}`;
                }
              }
              srcs.set(
                b.id,
                `${src} p${w.player.x.toFixed(0)},${w.player.y.toFixed(0)} t${w.time.toFixed(1)}`,
              );
            }
            info.set(b, s);
          }
          s.seen = onScreen(b) ? s.seen + 1 / 60 : 0;
        }
      };
      runSim(`eventHorizon-fair${i}`, dodgerBot(SKILLS.typical), 320, {
        levelId: 'eventHorizon',
        onTick: (w) => {
          track(w);
          if (attached !== null) return;
          attached = w;
          w.events.on('playerHit', () => {
            const p = w.player;
            // The shot that hit is released this tick but still sits in its slot.
            let hit: Bullet | null = null;
            let best = Infinity;
            for (let j = 0; j < w.enemyShots.count; j++) {
              const b = w.enemyShots.items[j] as Bullet;
              const s = info.get(b);
              if (s === undefined || s.id !== b.id) continue;
              const d = Math.hypot(b.x - p.x, b.y - p.y) - b.r - p.r;
              if (d < best) {
                best = d;
                hit = b;
              }
            }
            if (hit === null || best > 4) return;
            const s = info.get(hit) as ShotInfo;
            let bend = Math.abs(Math.atan2(hit.vy, hit.vx) - s.a0) * (180 / Math.PI);
            if (bend > 180) bend = 360 - bend;
            if (bend < BENT) return;
            curvedHits++;
            if (s.seen < MIN_ON_SCREEN)
              bad.push(
                `t${w.time.toFixed(1)} bend ${bend.toFixed(0)}° seen ${s.seen.toFixed(2)} s ${srcs.get(hit.id) ?? ''}`,
              );
          });
        },
      });
      expect(bad, `curved hits: ${curvedHits}`).toEqual([]);
      expect(ENEMY_FAIRNESS.minAge).toBeGreaterThanOrEqual(0.5);
    }, 60_000);
  }
});
