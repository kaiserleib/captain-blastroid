// T33: the dodger reads flares, portals and time bubbles. Each hazard runs in
// an isolated scene (no director) for both the hazard-aware bot and the
// hazard-blind one; the aware bot must take fewer hits from it.
import { describe, expect, it } from 'vitest';
import {
  spawnBubble,
  spawnPortalPair,
  spawnRock,
  spawnShadeSlab,
  startFlares,
} from '../../src/game/obstacles';
import { initPlayer } from '../../src/game/player';
import { computePlayerStats, createDefaultSave } from '../../src/meta';
import { spawnEnemy, spawnEnemyShot } from '../../src/sim/spawn';
import { createWorld, type World } from '../../src/sim/world';
import { dodgerBot, hazardsIIHitCause, SKILLS, type Bot } from './bots';
import { DT, SIM_SYSTEMS } from './harness';

const SYSTEMS = SIM_SYSTEMS.filter((s) => s.name !== 'director');

interface Scene {
  setup(w: World): void;
  tick(w: World): void;
}

function play(scene: Scene, bot: Bot, seed: string, seconds: number) {
  const save = createDefaultSave();
  const w = createWorld(seed, { levelId: 'kessler' });
  initPlayer(w, computePlayerStats(save, save.selectedShip, save.selectedPilot));
  w.player.shield = w.player.maxShield = 99;
  w.scrollSpeed = 30;
  scene.setup(w);
  const causes: Record<string, number> = {};
  let hits = 0;
  w.events.on('playerHit', () => {
    hits++;
    const c = hazardsIIHitCause(w) ?? 'other';
    causes[c] = (causes[c] ?? 0) + 1;
  });
  bot.start(w);
  while (w.time < seconds) {
    bot.decide(w);
    w.tick++;
    w.time += DT;
    scene.tick(w);
    for (const s of SYSTEMS) s.update(w, DT);
  }
  return { hits, causes };
}

function compare(scene: Scene, cause: string, seconds: number, seeds = ['a', 'b', 'c']) {
  let aware = 0;
  let blind = 0;
  let awareAll = 0;
  let blindAll = 0;
  for (const seed of seeds) {
    const a = play(scene, dodgerBot(SKILLS.typical), `t33-${seed}`, seconds);
    const b = play(scene, dodgerBot(SKILLS.typical, { hazards: false }), `t33-${seed}`, seconds);
    aware += a.causes[cause] ?? 0;
    blind += b.causes[cause] ?? 0;
    awareAll += a.hits;
    blindAll += b.hits;
  }
  console.log(`${cause}: aware ${aware} (${awareAll} total) vs blind ${blind} (${blindAll} total)`);
  return { aware, blind, awareAll, blindAll };
}

const SIM = process.env.SIM === '1';

describe.runIf(SIM)('T33 bots survive Act II hazards', () => {
  it('flares: hides in the shade during the warn', () => {
    let next = 0;
    const scene: Scene = {
      setup(w) {
        next = 0;
        startFlares(w, { every: 5, until: 999, warn: 1.2, burn: 1.2 });
      },
      tick(w) {
        // A large rock every 2.5 s and a slab every 7 s, somewhere across the top.
        if (w.time >= next) {
          next += 2.5;
          const x = w.rng.range(30, 210);
          if (Math.round(next / 2.5) % 3 === 0) spawnShadeSlab(w, x, -6);
          else spawnRock(w, { size: 'large', x, y: -16, vx: 0, vy: w.scrollSpeed, hp: 0 });
        }
      },
    };
    const r = compare(scene, 'flare', 60);
    expect(r.aware).toBeLessThan(r.blind);
  });

  it('portals: stays out of a ring whose exit is a trap', () => {
    const scene: Scene = {
      setup(w) {
        // A sits where the bot likes to park; B is ringed by hulls (shots
        // would just fall into B and come out of A, so the trap is contact).
        spawnPortalPair(w, 120, 330, 120, 90, { color: 'cyan' });
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          spawnEnemy(w, 'dummy', 120 + Math.cos(a) * 23, 90 + Math.sin(a) * 23, {
            hp: 1e6,
            r: 6,
          });
        }
        w.player.x = w.player.prevX = 60;
      },
      tick() {},
    };
    const r = compare(scene, 'portal', 40);
    expect(r.aware).toBeLessThan(r.blind);
  });

  it('bubbles: predicts shots that speed up inside a fast bubble', () => {
    let shotT = 0;
    const scene: Scene = {
      setup(w) {
        spawnBubble(w, 120, 290, { kind: 'fast', r: 70, vy: 0 });
        spawnBubble(w, 40, 200, { kind: 'slow', r: 36, vy: 0 });
        shotT = 0;
      },
      tick(w) {
        if ((shotT -= DT) > 0) return;
        shotT = 0.16;
        const p = w.player;
        const x = w.rng.range(20, 220);
        const dx = p.x - x;
        const dy = p.y - 10;
        const d = Math.hypot(dx, dy);
        spawnEnemyShot(w, { x, y: 10, vx: (dx / d) * 80, vy: (dy / d) * 80, r: 3 });
      },
    };
    const r = compare(scene, 'bubble-shot', 40, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(r.aware).toBeLessThan(r.blind);
  });
});
