import { describe, expect, it } from 'vitest';
import { WEAPON_ORDER } from '../../src/content';
import { GAUNTLET_ROUNDS } from '../../src/content/levels';
import { activeBoss } from '../../src/game/boss';
import { getDirector } from '../../src/game/director';
import { terrainSolidAt } from '../../src/game/terrain';
import type { World } from '../../src/sim/world';
import { debugSave } from '../../src/ui/debugSaves';
import { godBot, SKILLS } from './bots';
import { runSim } from './harness';

// The Gauntlet on a god playthrough with an endgame hangar (Nova + Wren, all
// eight weapons unlocked): every round's boss in order, the run only won by
// the last, the Warrens den stopping the scroll for the Wyrm and the next
// round starting it again, and a full six-slot L5 rack before the finale.

const SAVE = {
  ...debugSave('all'),
  selectedShip: 'nova',
  selectedPilot: 'wren',
  weaponsUnlocked: [...WEAPON_ORDER],
};

describe('the gauntlet', () => {
  it('chains every round boss into one run and fills the arsenal', () => {
    let wonEarly = false;
    let fullAt = -1;
    let wyrmScrollStopped = false;
    let scrollAfterWyrm = 0;
    let down = 0;
    let wyrmDown = false;
    let subscribed = false;
    const last = GAUNTLET_ROUNDS[GAUNTLET_ROUNDS.length - 1]!.boss;
    const r = runSim('gauntlet-god', godBot(SKILLS.typical), 1500, {
      levelId: 'gauntlet',
      save: SAVE,
      onTick: (w: World) => {
        if (!subscribed) {
          subscribed = true;
          w.events.on('bossDefeated', (e) => {
            down++;
            if (e.defId === 'wr_wyrm') wyrmDown = true;
          });
        }
        if (w.run.bossDefeated && down < GAUNTLET_ROUNDS.length) wonEarly = true;
        // The den's 2-tile walls really are there (not just its mark).
        if (activeBoss(w)?.defId === 'wr_wyrm' && w.scrollSpeed === 0)
          wyrmScrollStopped ||= terrainSolidAt(w, 4, 200) && terrainSolidAt(w, 236, 200);
        if (wyrmDown && getDirector(w)?.phase === 'level')
          scrollAfterWyrm = Math.max(scrollAfterWyrm, w.scrollSpeed);
        const ws = w.player.weapons;
        if (fullAt < 0 && ws.length === 6 && ws.every((x) => x.level === 5)) fullAt = w.time;
      },
    });
    expect(r.result.outcome).toBe('victory');
    const spawned = r.events.filter((e) => e.type === 'bossSpawned').map((e) => e.data);
    const defeated = r.events.filter((e) => e.type === 'bossDefeated').map((e) => e.data);
    GAUNTLET_ROUNDS.forEach((round, i) => {
      expect(spawned[i], `round ${i + 1}`).toContain(round.boss);
      expect(defeated[i], `round ${i + 1}`).toContain(round.boss);
    });
    expect(spawned).toHaveLength(GAUNTLET_ROUNDS.length);
    expect(defeated.at(-1)).toContain(last);
    expect(wonEarly).toBe(false);
    expect(r.events.filter((e) => e.type === 'levelComplete')).toHaveLength(1);
    expect(r.events.filter((e) => e.type === 'runOver')).toHaveLength(1);
    expect(r.events.filter((e) => e.type === 'songRequested')).toHaveLength(GAUNTLET_ROUNDS.length);
    expect(wyrmScrollStopped).toBe(true);
    expect(scrollAfterWyrm).toBeGreaterThan(30);
    // Full power with rounds to spare: the point of the stage.
    const finaleAt = r.events.find((e) => e.type === 'bossSpawned' && e.data.includes(last))!;
    expect(fullAt).toBeGreaterThan(0);
    expect(fullAt).toBeLessThan(finaleAt.tick / 60 - 120);
  }, 120_000);
});
