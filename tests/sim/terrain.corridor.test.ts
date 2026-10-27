import { describe, expect, it } from 'vitest';
import { TEST_CORRIDOR, type TerrainTheme } from '../../src/content/terrain';
import { crushCount, queueChunk } from '../../src/game/terrain';
import { setScrollSpeed } from '../../src/sim/scroll';
import { dodgerBot, SKILLS, type BotSkill } from './bots';
import { createSimWorld, DT, SIM_SYSTEMS } from './harness';

// T34: a corridor-only level (the sandbox test corridor, no director, no rock
// field) flown by the dodger. Crushes must average under 1 per run.

const env =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const SEEDS = env.SIM === '1' ? 8 : 3;
const SYSTEMS = SIM_SYSTEMS.filter((s) => s.name !== 'director');

function corridorRun(seed: string, skill: BotSkill, theme: TerrainTheme, scroll: number) {
  const w = createSimWorld(seed);
  setScrollSpeed(w, scroll);
  for (const id of TEST_CORRIDOR) queueChunk(w, id, { theme });
  const bot = dodgerBot(skill);
  bot.start(w);
  // Rows: ~218 of them at `scroll` px/s, plus the screen.
  const seconds = (218 * 8 + 400) / scroll;
  let hits = 0;
  w.events.on('playerHit', () => void hits++);
  for (let t = 0; t < seconds && w.player.alive; t += DT) {
    bot.decide(w);
    w.tick++;
    w.time += DT;
    for (const s of SYSTEMS) s.update(w, DT);
    // Nothing else can hurt it here; keep it flying the whole corridor.
    w.player.shield = Math.max(w.player.shield, 1);
  }
  return { crushes: crushCount(w), hits };
}

describe('bots in a corridor-only level', () => {
  for (const [skill, scroll] of [
    [SKILLS.typical, 30],
    [SKILLS.typical, 34],
    [SKILLS.novice, 30],
  ] as const) {
    it(`${skill.name} at ${scroll} px/s: < 1 crush per run`, () => {
      let crushes = 0;
      for (let i = 0; i < SEEDS; i++) {
        const theme = i % 2 === 0 ? 'warrens' : 'foundry';
        crushes += corridorRun(`corridor${i}`, skill, theme, scroll).crushes;
      }
      expect(crushes / SEEDS).toBeLessThan(1);
    });
  }
});
