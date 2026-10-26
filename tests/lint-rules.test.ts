import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const code = 'export const roll = (): number => Math.random();\n';

async function ruleIds(filePath: string): Promise<string[]> {
  const eslint = new ESLint();
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((m) => m.ruleId ?? '');
}

describe('Math.random lint rule', () => {
  it.each(['src/sim/x.ts', 'src/game/enemies/x.ts', 'src/content/x.ts'])(
    'fires in %s',
    async (f) => {
      expect(await ruleIds(f)).toContain('no-restricted-properties');
    },
  );

  it.each(['src/engine/x.ts', 'src/gfx/x.ts', 'src/audio/x.ts'])('passes in %s', async (f) => {
    expect(await ruleIds(f)).toEqual([]);
  });
});
