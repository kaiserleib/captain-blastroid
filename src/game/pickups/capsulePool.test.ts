import { afterEach, describe, expect, it } from 'vitest';
import { capsuleWeaponPool } from '../../content/dropTables';
import { LEVEL1, LEVELS, type LevelDef } from '../../content/levels';
import { CAPSULE_WEAPON_IDS, PICKUP_TUNING } from '../../content/pickups';
import { DEFAULT_UNLOCKED_WEAPONS, WEAPON_ORDER, type WeaponId } from '../../content/weapons';
import { createRng } from '../../engine/rng';
import {
  bankRun,
  createDefaultSave,
  getSave,
  initSave,
  resetSaveStore,
  setSave,
  unlockFieldTestWeapon,
  type RunResult,
} from '../../meta';
import { MemoryStorage } from '../../platform';
import { createWorld } from '../../sim/world';
import {
  capsulePool,
  capsuleWeights,
  DEFAULT_CAPSULE_POOL,
  ownedBias,
  pickCapsuleWeapon,
} from './drops';
import { spawnDrop } from './index';

const TEST_LEVEL = 'zz_fieldtest';

function addTestLevel(fieldTestWeapon: WeaponId): void {
  (LEVELS as Record<string, LevelDef>)[TEST_LEVEL] = { ...LEVEL1, id: TEST_LEVEL, fieldTestWeapon };
}

afterEach(() => {
  delete (LEVELS as Record<string, LevelDef>)[TEST_LEVEL];
  resetSaveStore();
});

function draws(pool: readonly string[], owned: string[] = [], n = 4000): Set<string> {
  const rng = createRng('pool');
  const weapons = owned.map((id) => ({ id, level: 1, cooldown: 0, state: 0 }));
  const seen = new Set<string>();
  for (let i = 0; i < n; i++) seen.add(pickCapsuleWeapon(rng, weapons, pool));
  return seen;
}

describe('capsule pool', () => {
  it('a fresh save on an Act I sector is exactly the five Act I weapons, in order', () => {
    expect(DEFAULT_CAPSULE_POOL).toEqual(['blaster', 'spread', 'lance', 'seeker', 'orbitDrones']);
    expect(capsulePool(createWorld('p', { levelId: 'armada' }))).toEqual(DEFAULT_CAPSULE_POOL);
  });

  it('locked weapons never drop, even when owned (a ship start ignores the lock)', () => {
    const seen = draws(DEFAULT_CAPSULE_POOL, ['arc', 'flak']);
    expect([...seen].sort()).toEqual([...DEFAULT_UNLOCKED_WEAPONS].sort());
  });

  it("the sector's field-test weapon joins the pool, owned weighting included", () => {
    const pool = capsuleWeaponPool(CAPSULE_WEAPON_IDS, DEFAULT_UNLOCKED_WEAPONS, 'ricochet');
    expect(pool).toEqual([...DEFAULT_UNLOCKED_WEAPONS, 'ricochet']);
    const seen = draws(pool, ['ricochet']);
    expect(seen.has('ricochet')).toBe(true);
    expect(seen.has('arc')).toBe(false);
    expect(seen.has('flak')).toBe(false);
  });

  it('reads save.weaponsUnlocked and the level once per world', async () => {
    await initSave(new MemoryStorage());
    setSave({ ...getSave(), weaponsUnlocked: [...DEFAULT_UNLOCKED_WEAPONS, 'flak'] });
    addTestLevel('arc');
    const w = createWorld('p', { levelId: TEST_LEVEL });
    expect(capsulePool(w)).toEqual([...DEFAULT_UNLOCKED_WEAPONS, 'arc', 'flak']);
    const all = createWorld('q', { levelId: 'kessler' });
    setSave({ ...getSave(), weaponsUnlocked: [...WEAPON_ORDER] });
    expect(capsulePool(all)).toEqual(WEAPON_ORDER);
  });

  it('a bigger pool raises the owned bias; Act I pools keep 0.5', () => {
    expect(ownedBias(5)).toBe(0.5);
    expect(ownedBias(6)).toBeCloseTo(1 - 0.5 * (5 / 6));
    expect(ownedBias(8)).toBeCloseTo(0.6875);
  });

  it('a named capsule of a locked weapon is re-picked unless it is the field test', () => {
    addTestLevel('arc');
    const w = createWorld('p', { levelId: TEST_LEVEL });
    expect(spawnDrop(w, 'weapon', 100, 100, 'arc')!.payload).toBe('arc');
    for (let i = 0; i < 50; i++) {
      const k = spawnDrop(w, 'weapon', 100, 100, 'flak')!;
      expect(k.payload).not.toBe('flak');
      expect(capsulePool(w)).toContain(k.payload);
    }
  });

  it('Act II weapons drop at a lower weight in Act I sectors only (T43)', async () => {
    await initSave(new MemoryStorage());
    expect(capsuleWeights(createWorld('p', { levelId: 'kessler' }))).toBeNull();
    setSave({ ...getSave(), weaponsUnlocked: [...WEAPON_ORDER] });
    const k = PICKUP_TUNING.act2WeaponWeightInAct1;
    const w = createWorld('p', { levelId: 'kessler' });
    expect(capsuleWeights(w)).toEqual([1, 1, 1, 1, 1, k, k, k]);
    expect(capsuleWeights(createWorld('q', { levelId: 'corona' }))).toBeNull();
    // Uniform part only (no owned weapons): each Act II weapon at k / (5 + 3k).
    const rng = createRng('weights');
    let late = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const id = pickCapsuleWeapon(rng, [], capsulePool(w), capsuleWeights(w));
      if (!(DEFAULT_UNLOCKED_WEAPONS as readonly string[]).includes(id)) late++;
    }
    expect(late / n).toBeCloseTo((3 * k) / (5 + 3 * k), 1);
  });

  it('authored forceCapsule / guaranteeWeapon only name a locked weapon as the field test', () => {
    for (const level of Object.values(LEVELS)) {
      const ok = (id: string) =>
        (DEFAULT_UNLOCKED_WEAPONS as readonly string[]).includes(id) ||
        id === level.fieldTestWeapon;
      if (level.guaranteeWeapon) expect(ok(level.guaranteeWeapon.weapon), level.id).toBe(true);
      for (const ev of level.timeline) {
        const forced = (ev as { forceCapsule?: string }).forceCapsule;
        if (forced !== undefined) expect(ok(forced), `${level.id} ${forced}`).toBe(true);
      }
    }
  });
});

describe('unlock on first clear', () => {
  const levels = { [TEST_LEVEL]: { ...LEVEL1, id: TEST_LEVEL, fieldTestWeapon: 'arc' } } as Record<
    string,
    LevelDef
  >;
  const result = (victory: boolean): RunResult => ({
    shipId: 'kestrel',
    pilotId: 'blastroid',
    levelId: TEST_LEVEL,
    score: 0,
    salvage: 0,
    kills: 0,
    schematics: [],
    pilotsRescued: [],
    bossDefeated: victory,
    victory,
  });

  it('a victory adds the field-test weapon and reports it once', () => {
    const save = createDefaultSave();
    const won = result(true);
    const list = unlockFieldTestWeapon(save, won, levels);
    expect(list).toEqual([...DEFAULT_UNLOCKED_WEAPONS, 'arc']);
    expect(won.unlockedWeapon).toBe('arc');
    const again = result(true);
    expect(unlockFieldTestWeapon({ ...save, weaponsUnlocked: list }, again, levels)).toBe(list);
    expect(again.unlockedWeapon).toBeUndefined();
  });

  it('a defeat unlocks nothing', () => {
    const lost = result(false);
    expect(unlockFieldTestWeapon(createDefaultSave(), lost, levels)).toEqual(
      DEFAULT_UNLOCKED_WEAPONS,
    );
    expect(lost.unlockedWeapon).toBeUndefined();
  });

  it('bankRun applies it through the real level table', () => {
    addTestLevel('flak');
    const won = result(true);
    const { save } = bankRun(createDefaultSave(), won);
    expect(save.weaponsUnlocked).toContain('flak');
    expect(won.unlockedWeapon).toBe('flak');
    const act1 = bankRun(createDefaultSave(), { ...result(true), levelId: 'kessler' });
    expect(act1.save.weaponsUnlocked).toEqual(DEFAULT_UNLOCKED_WEAPONS);
  });
});
