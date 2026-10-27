import { describe, expect, it } from 'vitest';
import { getLevel } from '../../src/content/levels';
import { startDirector } from '../../src/game/director';
import type { WeaponInstance } from '../../src/sim/types';
import type { World } from '../../src/sim/world';
import { debugSave } from '../../src/ui/debugSaves';
import { dodgerBot, SKILLS, type Bot } from './bots';
import { createSimWorld, DT, SIM_SYSTEMS } from './harness';

// T41: the Echo by the player's weapon count. Each run starts the chrono
// timeline at 168 s (the ship's history fills before the Echo arrives at
// 179 s) with an `act1` save and a fixed loadout of N weapons at level 3, then
// plays the fight to the end. The report (ECHO=1, or under BALANCE=1) prints
// fight time and hits per minute for the typical bot, mortal and god, and the
// mortal clear rate. The default suite runs one short smoke run.
const env =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const REPORT = env.ECHO === '1' || env.BALANCE === '1';
const RUNS = Number(env.RUNS ?? 20);

const ORDER = ['blaster', 'spread', 'seeker', 'lance', 'orbitDrones'] as const;
const START_T = 168;
const MAX_FIGHT = 240;

export interface EchoRun {
  cleared: boolean;
  died: boolean;
  fightT: number;
  hits: number;
}

function loadout(n: number, level: number): WeaponInstance[] {
  return ORDER.slice(0, n).map((id) => ({ id, level, cooldown: 0, state: 0 }));
}

/** One Echo fight with `n` weapons at `level`. A `tank` ship can't run out of shield, so every hit counts. */
export function echoFight(seed: string, bot: Bot, n: number, level = 3, tank = false): EchoRun {
  const save = debugSave('act1');
  const w: World = createSimWorld(seed, { levelId: 'chrono', save });
  startDirector(w, getLevel('chrono'), { startT: START_T });
  w.player.weapons.length = 0;
  for (const x of loadout(n, level)) w.player.weapons.push(x);
  if (tank) w.player.shield = w.player.maxShield = 999;
  let spawnedAt = -1;
  let defeatedAt = -1;
  let hits = 0;
  let died = false;
  w.events.on('bossSpawned', () => void (spawnedAt = w.time));
  w.events.on('bossDefeated', () => void (defeatedAt = w.time));
  w.events.on('playerHit', () => {
    if (spawnedAt >= 0 && defeatedAt < 0) hits++;
  });
  w.events.on('playerDied', () => void (died = true));
  bot.start(w);
  while (!died && defeatedAt < 0) {
    if (spawnedAt >= 0 && w.time - spawnedAt > MAX_FIGHT) break;
    bot.decide(w);
    w.tick++;
    w.time += DT;
    for (let i = 0; i < SIM_SYSTEMS.length; i++) SIM_SYSTEMS[i]!.update(w, DT);
  }
  const end = defeatedAt >= 0 ? defeatedAt : w.time;
  return { cleared: defeatedAt >= 0, died, fightT: spawnedAt < 0 ? 0 : end - spawnedAt, hits };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? NaN : (s[(s.length - 1) >> 1]! + s[s.length >> 1]!) / 2;
}

describe('chrono: the Echo by weapon count', () => {
  it('a short fight with two weapons ends in a defeat (smoke)', () => {
    const r = echoFight('echo-smoke', dodgerBot(SKILLS.typical), 2, 4, true);
    expect(r.cleared).toBe(true);
    expect(r.fightT).toBeGreaterThan(10);
  }, 60_000);

  it.runIf(REPORT)(
    'report: fight time and hit rate by weapon count (typical bot)',
    () => {
      const rows: string[] = [
        "| weapons | fight s (median, can't die) | hits/min | clear (mortal) | fight s on clears |",
        '|---|---|---|---|---|',
      ];
      const godRate: number[] = [];
      for (let n = 1; n <= 5; n++) {
        const gT: number[] = [];
        let gHits = 0;
        let gTime = 0;
        const mT: number[] = [];
        let clears = 0;
        for (let i = 0; i < RUNS; i++) {
          const g = echoFight(`echo-n${n}-${i}`, dodgerBot(SKILLS.typical), n, 3, true);
          gT.push(g.fightT);
          gHits += g.hits;
          gTime += g.fightT;
          const m = echoFight(`echo-n${n}-${i}`, dodgerBot(SKILLS.typical), n);
          if (m.cleared) {
            clears++;
            mT.push(m.fightT);
          }
        }
        godRate.push((gHits / gTime) * 60);
        rows.push(
          `| ${n} | ${median(gT).toFixed(0)} | ${((gHits / gTime) * 60).toFixed(1)} | ${clears}/${RUNS} | ${median(mT).toFixed(0)} |`,
        );
      }
      console.log(
        `\nEcho by weapon count (${RUNS} seeds, level-3 weapons, act1 save)\n${rows.join('\n')}\n`,
      );
      expect(godRate.length).toBe(5);
    },
    1_800_000,
  );
});
