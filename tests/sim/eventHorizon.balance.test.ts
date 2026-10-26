import { it } from 'vitest';
// T28 balance probe for Event Horizon (skipped by default). The stock dodger
// can't see black holes, curving shots or Lancer lines (T31 teaches it), so
// `npm run balance` underrates this sector. This wraps the dodger with what a
// human reads off the screen: it keeps clear of hole cores and their sling
// zones, projects shots and rocks along their gravity curves, reads Lancer
// telegraphs and drops under Perihelion's swing during its telegraph.
//   HZ_AWARE=1 [RUNS=50] [SKILL=novice|typical|expert] [BLIND=1] npx vitest run tests/sim/eventHorizon.balance.test.ts --silent=false
//   HZ_HOLD=1 …   boss DPS from a fixed x (does curving around the hole pay?)
import { dodgerBot, godBot as godBotFn, SKILLS, type Bot } from './bots';
import { runSim } from './harness';
import { activeBoss } from '../../src/game/boss';
import { Perihelion } from '../../src/game/levels/eventHorizon';
import type { Anomaly, Bullet, Enemy, Asteroid } from '../../src/sim/types';
import type { World } from '../../src/sim/world';

const env =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const saved: number[] = [];
/** Leans each shot's and rock's velocity by half its gravity over the look-ahead, so the
 * dodger's straight-line projection follows the curve (what a human sees), then restores it. */
function bendPredict(w: World, sign: 1 | -1): void {
  if (sign < 0) {
    let k = 0;
    for (let i = 0; i < w.enemyShots.count; i++) {
      const b = w.enemyShots.items[i] as Bullet;
      b.vx = saved[k++]!;
      b.vy = saved[k++]!;
    }
    for (let i = 0; i < w.asteroids.count; i++) {
      const b = w.asteroids.items[i] as Asteroid;
      b.vx = saved[k++]!;
      b.vy = saved[k++]!;
    }
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.items[i] as Enemy;
      e.vx = saved[k++]!;
      e.vy = saved[k++]!;
    }
    return;
  }
  saved.length = 0;
  const lean = (b: { x: number; y: number; vx: number; vy: number }, mul: number) => {
    saved.push(b.vx, b.vy);
    for (let j = 0; j < w.anomalies.count; j++) {
      const a = w.anomalies.items[j] as Anomaly;
      if (!a.active || a.kind !== 'blackhole') continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d >= a.radius || d < 1) continue;
      const acc = (a.strength * mul * 8) / Math.max(8, d);
      b.vx += (dx / d) * acc * 0.22;
      b.vy += (dy / d) * acc * 0.22;
    }
  };
  for (let i = 0; i < w.enemyShots.count; i++) lean(w.enemyShots.items[i] as Bullet, 1);
  for (let i = 0; i < w.asteroids.count; i++) lean(w.asteroids.items[i] as Asteroid, 0.3);
  // Lancers mid-telegraph: project them along the shown line (a human reads it).
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i] as Enemy;
    saved.push(e.vx, e.vy);
    if (e.active && e.defId === 'hz_lancer' && e.state === 3) {
      const d = Math.hypot(w.player.x - e.x, w.player.y - e.y);
      const v = Math.max(260, d / 0.35);
      e.vx = e.ax * v;
      e.vy = e.ay * v;
    }
  }
}

function holeAware(inner: Bot): Bot {
  return {
    name: `${inner.name}+holes`,
    god: inner.god,
    start: (w) => inner.start(w),
    decide(w) {
      bendPredict(w, 1);
      inner.decide(w);
      bendPredict(w, -1);
      const p = w.player;
      if (w.input.targetX === null || w.input.targetY === null) return;
      let tx = w.input.targetX;
      let ty = w.input.targetY;
      // Shoot past holes, not into them: step aside from a hole between the ship and its target.
      for (let j = 0; j < w.anomalies.count; j++) {
        const a = w.anomalies.items[j] as Anomaly;
        if (!a.active || a.r <= 0 || a.y > ty - 20 || activeBoss(w) !== null) continue;
        if (Math.abs(tx - a.x) < a.r + 22) tx = a.x + (tx < a.x ? -1 : 1) * (a.r + 22);
        // Lead outward: the hole will bend the shot back in.
        else if (Math.abs(tx - a.x) < a.radius * 0.6)
          tx += (tx < a.x ? -1 : 1) * Number(env.LEAD ?? 0);
      }
      for (let j = 0; j < w.anomalies.count; j++) {
        const a = w.anomalies.items[j] as Anomaly;
        if (!a.active || a.r <= 0) continue;
        // Don't chase pickups up into a hole's sling zone.
        if (Math.hypot(tx - a.x, ty - a.y) < 100) ty = Math.max(ty, Math.min(340, a.y + 110));
        const keep = a.r + Number(env.KEEP ?? 62);
        const dx = tx - a.x;
        const dy = ty - a.y;
        const d = Math.hypot(dx, dy);
        if (d < keep) {
          const k = d < 0.5 ? 1 : keep / d;
          tx = a.x + (d < 0.5 ? keep : dx * k);
          ty = a.y + (d < 0.5 ? 0 : dy * k);
        }
        const pd = Math.hypot(p.x - a.x, p.y - a.y);
        if (pd < a.r + 18) {
          tx = p.x + ((p.x - a.x) / Math.max(1, pd)) * 30;
          ty = p.y + ((p.y - a.y) / Math.max(1, pd)) * 30;
        }
      }
      const boss = activeBoss(w);
      if (boss instanceof Perihelion) {
        // A human holds off-axis and lets the hole curve shots in, instead of chasing the core.
        let calm = true;
        for (let j = 0; j < w.enemyShots.count && calm; j++) {
          const b = w.enemyShots.items[j] as Bullet;
          if (!b.active) continue;
          for (let k = 1; k <= 4; k++) {
            const t = k * 0.08;
            if (Math.hypot(b.x + b.vx * t - p.x, b.y + b.vy * t - p.y) < 12) calm = false;
          }
        }
        if (calm && env.HOLD === '1') {
          tx = p.x < boss.hx ? boss.hx - 50 : boss.hx + 50;
          ty = 330;
        }
        if (boss.dive !== 0 && env.NOESC !== '1') ty = 386;
      }
      w.input.targetX = Math.max(10, Math.min(230, tx));
      w.input.targetY = Math.max(40, Math.min(390, ty));
    },
  };
}

it.runIf(env.HZ_AWARE === '1')(
  'probe',
  () => {
    const causes: Record<string, number> = {};
    const deaths: number[] = [];
    const N = Number(env.RUNS ?? 20);
    let clears = 0;
    const bossTimes: number[] = [];
    const shotLog: string[] = [];
    for (let i = 0; i < N; i++) {
      let w0: World | null = null;
      let lastHp = 0;
      let diveInfo = '';
      const track = new Map<number, { src: string; t0: number; a0: number }>();
      const r = runSim(
        `eventHorizon-bal${i}`,
        env.BLIND === '1'
          ? dodgerBot(SKILLS[(env.SKILL ?? 'typical') as 'typical'])
          : holeAware(dodgerBot(SKILLS[(env.SKILL ?? 'typical') as 'typical'])),
        320,
        {
          levelId: 'eventHorizon',
          onTick: (w) => {
            const bb = activeBoss(w);
            if (bb instanceof Perihelion) {
              lastHp = bb.rig.hp();
              if (env.TRACE === '1' && w.tick % Number(env.TEVERY ?? 300) === 0)
                console.log(
                  `T ${w.time.toFixed(0)} ${bb.phaseName()} hp${lastHp} p${w.player.x.toFixed(0)},${w.player.y.toFixed(0)} pods${bb.pods.map((s) => s.enemy?.hp ?? 'x').join('/')} core${bb.core.enemy?.hp} tgt${bb.core.targetable} dive${bb.dive} th${bb.theta.toFixed(2)} by${bb.rig.y.toFixed(0)}`,
                );
              diveInfo = `dive${bb.dive} th${bb.theta.toFixed(2)} dir${bb.dir} since${bb.sinceDive.toFixed(1)} y${bb.rig.y.toFixed(0)}`;
            }
            for (let j = 0; j < w.enemyShots.count; j++) {
              const b = w.enemyShots.items[j] as Bullet;
              if (!b.active || track.has(b.id)) continue;
              let src = '?';
              let bd = 1e9;
              for (let q = 0; q < w.enemies.count; q++) {
                const e = w.enemies.items[q] as Enemy;
                if (!e.active) continue;
                const d = Math.hypot(e.x - b.x, e.y - b.y);
                if (d < bd) {
                  bd = d;
                  src = e.defId;
                }
              }
              track.set(b.id, { src, t0: w.time, a0: Math.atan2(b.vy, b.vx) });
            }
            if (w0 !== null) return;
            w0 = w;
            w.events.on('playerHit', () => {
              const p = w.player;
              let cause = '?';
              let best = 1e9;
              const chk = (b: { active: boolean; x: number; y: number; r: number }, k: string) => {
                if (!b.active) return;
                const d = Math.hypot(b.x - p.x, b.y - p.y) - b.r;
                if (d < best) {
                  best = d;
                  cause = k;
                }
              };
              for (let j = 0; j < w.anomalies.count; j++) {
                const a = w.anomalies.items[j] as Anomaly;
                if (a.r > 0) chk(a, 'hole');
              }
              for (let j = 0; j < w.enemyShots.count; j++)
                chk(w.enemyShots.items[j] as Bullet, 'shot');
              for (let j = 0; j < w.asteroids.count; j++)
                chk(w.asteroids.items[j] as Asteroid, 'rock');
              for (let j = 0; j < w.enemies.count; j++) {
                const e = w.enemies.items[j] as Enemy;
                chk(e, e.defId);
              }
              if (cause === 'shot') {
                let sb: Bullet | null = null;
                let sd = 1e9;
                for (let j = 0; j < w.enemyShots.count; j++) {
                  const b = w.enemyShots.items[j] as Bullet;
                  if (!track.has(b.id)) continue;
                  const d = Math.hypot(b.x - p.x, b.y - p.y);
                  if (d < sd) {
                    sd = d;
                    sb = b;
                  }
                }
                if (sb !== null) {
                  const tr = track.get(sb.id)!;
                  let bend = Math.abs(Math.atan2(sb.vy, sb.vx) - tr.a0) * 57.3;
                  if (bend > 180) bend = 360 - bend;
                  cause = `shot<${tr.src}>`;
                  shotLog.push(
                    `${w.time.toFixed(0)}:${tr.src}:age${(w.time - tr.t0).toFixed(2)}:bend${bend.toFixed(0)}`,
                  );
                }
              }
              if (cause === 'rock') {
                let rb: Asteroid | null = null;
                let rd = 1e9;
                for (let j = 0; j < w.asteroids.count; j++) {
                  const b = w.asteroids.items[j] as Asteroid;
                  if (!b.active) continue;
                  const d = Math.hypot(b.x - p.x, b.y - p.y) - b.r;
                  if (d < rd) {
                    rd = d;
                    rb = b;
                  }
                }
                if (rb !== null) {
                  let hd = 999;
                  for (let j = 0; j < w.anomalies.count; j++) {
                    const a = w.anomalies.items[j] as Anomaly;
                    if (a.active) hd = Math.min(hd, Math.hypot(a.x - p.x, a.y - p.y));
                  }
                  shotLog.push(
                    `${w.time.toFixed(0)}:ROCK:${rb.size}:v${Math.hypot(rb.vx, rb.vy).toFixed(0)}:hp${rb.hp}:hole${hd.toFixed(0)}:p${p.x.toFixed(0)},${p.y.toFixed(0)}`,
                  );
                }
              }
              if (cause === 'hz_orbiter') {
                for (let j = 0; j < w.enemies.count; j++) {
                  const e = w.enemies.items[j] as Enemy;
                  if (!e.active || e.defId !== 'hz_orbiter') continue;
                  if (Math.hypot(e.x - p.x, e.y - p.y) > 20) continue;
                  shotLog.push(
                    `${w.time.toFixed(0)}:ORB:st${e.state}:t${e.t.toFixed(1)}:e${e.x.toFixed(0)},${e.y.toFixed(0)}:v${e.vx.toFixed(0)},${e.vy.toFixed(0)}`,
                  );
                }
              }
              const k = `${Math.floor(w.time / 20) * 20}:${cause}`;
              causes[k] = (causes[k] ?? 0) + 1;
            });
          },
        },
      );
      if (r.result.victory) {
        clears++;
        bossTimes.push(Math.round(r.stats.bossTime));
      } else deaths.push(Math.round(r.result.endT));
      if (r.result.outcome === 'timeout' && !r.stats.reachedBoss)
        console.log('TIMEOUT no boss', r.stats.seed);
      if (r.stats.reachedBoss)
        console.log(
          `boss ${r.result.outcome} ${r.stats.bossPhaseAtEnd} t${r.stats.bossTime.toFixed(0)} ${r.stats.weaponsAtBoss} hits${r.stats.hitsInBoss} hp${lastHp} ${diveInfo}`,
        );
    }
    if (env.SHOTLOG === '1') console.log(shotLog.join(' '));
    console.log('clears', clears, '/', N, 'deaths', deaths.join(','), 'boss', bossTimes.join(','));
    console.log(
      Object.entries(causes)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]) || b[1] - a[1])
        .map(([k, v]) => `${k}=${v}`)
        .join('  '),
    );
  },
  600_000,
);

it.runIf(env.HZ_HOLD === '1')(
  'boss dps by x',
  () => {
    for (const X of [30, 60, 90, 120, 150, 180, 210]) {
      const inner = godBotFn();
      const bot: Bot = {
        name: 'hold',
        god: true,
        start: (w) => inner.start(w),
        decide(w) {
          const b = activeBoss(w);
          if (b === null) return inner.decide(w);
          w.input.x = 0;
          w.input.y = 0;
          w.input.targetX = X;
          w.input.targetY = Number(env.HOLDY ?? 330);
        },
      };
      let p1 = -1;
      let p2 = -1;
      let hp2 = 0;
      const r = runSim(`hold${X}`, bot, 420, {
        levelId: 'eventHorizon',
        loadout: [
          { id: 'blaster', level: 3 },
          { id: 'seeker', level: 2 },
        ],
        onTick: (w) => {
          const b = activeBoss(w);
          if (!(b instanceof Perihelion)) return;
          if (p1 < 0 && b.phaseName() === 'orbit') p1 = w.time;
          if (p2 < 0 && b.phaseName() === 'slingshot') p2 = w.time;
          if (p2 > 0 && b.phaseName() === 'slingshot') hp2 = b.rig.hp();
        },
      });
      console.log(
        `X${X} p1 ${(p2 - p1).toFixed(0)}s total ${r.stats.bossTime.toFixed(0)}s ${r.result.outcome} coreLeft ${hp2}`,
      );
    }
  },
  600_000,
);
