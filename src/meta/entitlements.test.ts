import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PurchaseOutcome, Store } from '../platform/platform';
import { MemoryStorage } from '../platform';
import {
  buyPack,
  canGetPacks,
  CLAIMED_PACKS_KEY,
  packPrice,
  initEntitlements,
  onEntitlementsChange,
  owns,
  ownsPack,
  refreshEntitlements,
  resetEntitlements,
  restorePacks,
  setOwnedPacks,
} from './entitlements';
import {
  bankRun,
  enforceOwnership,
  isLevelUnlocked,
  pilotAvailable,
  selectPilot,
  selectShip,
  shipStatus,
  usableWeapons,
  type RunResult,
} from './progression';
import { createDefaultSave, type SaveData } from './schema';

class FakeStore implements Store {
  ownedIds: string[] = [];
  outcome: PurchaseOutcome = 'purchased';
  offline = false;
  changed: (() => void) | null = null;
  async owned(): Promise<string[]> {
    if (this.offline) throw new Error('offline');
    return [...this.ownedIds];
  }
  async product(id: string): Promise<{ id: string; price: string }> {
    return { id, price: '$2.99' };
  }
  async purchase(id: string): Promise<PurchaseOutcome> {
    if (this.outcome === 'purchased') this.ownedIds.push(id);
    return this.outcome;
  }
  async restore(): Promise<string[]> {
    return this.owned();
  }
  onChange(cb: () => void): () => void {
    this.changed = cb;
    return () => {};
  }
}

/** Everything earned, as a save code from a device that owns Act II would carry it. */
function fullSave(): SaveData {
  const s = createDefaultSave();
  const levels: SaveData['levels'] = {};
  for (const id of ['kessler', 'ionShoals', 'eventHorizon', 'pulsarNursery', 'armada', 'corona'])
    levels[id] = { clears: 1, best: 5000 };
  return {
    ...s,
    levels,
    shipsBuilt: ['kestrel', 'paragon', 'shrike'],
    pilotsRescued: ['blastroid', 'vale', 'ines'],
    weaponsUnlocked: [...s.weaponsUnlocked, 'arc'],
    selectedLevel: 'warrens',
    selectedShip: 'shrike',
    selectedPilot: 'ines',
  };
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

afterEach(() => resetEntitlements());

describe('entitlements', () => {
  it('without a store every pack is owned, unless locked', async () => {
    expect(ownsPack('act2')).toBe(true);
    await initEntitlements(new MemoryStorage(), null);
    expect(ownsPack('act2')).toBe(true);
    expect(canGetPacks()).toBe(false);
    await initEntitlements(new MemoryStorage(), null, { locked: true });
    expect(ownsPack('act2')).toBe(false);
    expect(owns('levels', 'kessler')).toBe(true);
    expect(owns('levels', 'corona')).toBe(false);
  });

  it('a store build starts locked; a free pack is claimed without touching the store', async () => {
    const store = new FakeStore();
    const purchase = vi.spyOn(store, 'purchase');
    const storage = new MemoryStorage();
    await initEntitlements(storage, store);
    await flush();
    expect(ownsPack('act2')).toBe(false);
    expect(canGetPacks()).toBe(true);
    expect(await packPrice('act2')).toBeNull();
    const cb = vi.fn();
    onEntitlementsChange(cb);
    expect(await buyPack('act2')).toBe('purchased');
    expect(ownsPack('act2')).toBe(true);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(purchase).not.toHaveBeenCalled();
    expect(await storage.get(CLAIMED_PACKS_KEY)).toBe('["act2"]');
  });

  it('a claim survives relaunches and store refreshes that report nothing', async () => {
    const storage = new MemoryStorage();
    await storage.set(CLAIMED_PACKS_KEY, '["act2"]');
    const store = new FakeStore();
    await initEntitlements(storage, store);
    expect(ownsPack('act2')).toBe(true);
    await refreshEntitlements();
    store.changed?.();
    await flush();
    expect(ownsPack('act2')).toBe(true);
    expect(await restorePacks()).toBe('nothing');
    expect(ownsPack('act2')).toBe(true);
  });

  it('nothing can be claimed on the web', async () => {
    await initEntitlements(new MemoryStorage(), null, { locked: true });
    expect(canGetPacks()).toBe(false);
    expect(await buyPack('act2')).toBe('failed');
    expect(ownsPack('act2')).toBe(false);
  });
});

describe('progression without the Act II pack', () => {
  it('locks its sectors, ships, pilots and weapons even when the save has them', () => {
    const save = fullSave();
    expect(isLevelUnlocked(save, 'corona')).toBe(true);
    setOwnedPacks([]);
    expect(isLevelUnlocked(save, 'armada')).toBe(true);
    expect(isLevelUnlocked(save, 'corona')).toBe(false);
    expect(isLevelUnlocked(save, 'gauntlet')).toBe(false);
    expect(shipStatus(save, 'shrike')).toBe('pack');
    expect(shipStatus(save, 'nova')).toBe('pack');
    expect(shipStatus(save, 'paragon')).toBe('built');
    expect(() => selectShip(save, 'shrike')).toThrow();
    expect(pilotAvailable(save, 'ines')).toBe(false);
    expect(pilotAvailable(save, 'vale')).toBe(true);
    expect(() => selectPilot(save, 'ines')).toThrow();
    expect(usableWeapons(save)).not.toContain('arc');
    expect(usableWeapons(save)).toContain('blaster');
  });

  it('moves the launch selections to base content and keeps the progress', () => {
    const save = fullSave();
    expect(enforceOwnership(save)).toBe(save);
    setOwnedPacks([]);
    const next = enforceOwnership(save);
    expect(next.selectedLevel).toBe('armada');
    expect(next.selectedShip).toBe('kestrel');
    expect(next.selectedPilot).toBe('blastroid');
    expect(next.shipsBuilt).toContain('shrike');
    expect(next.levels.corona?.clears).toBe(1);
    setOwnedPacks(['act2']);
    expect(shipStatus(next, 'shrike')).toBe('built');
  });

  it('clearing sector 5 does not point LAUNCH at sector 6', () => {
    const save = fullSave();
    const base: SaveData = {
      ...save,
      levels: { ...save.levels, armada: { clears: 0, best: 0 }, corona: { clears: 0, best: 0 } },
      selectedLevel: 'armada',
      selectedShip: 'kestrel',
      selectedPilot: 'blastroid',
    };
    const result: RunResult = {
      shipId: 'kestrel',
      pilotId: 'blastroid',
      levelId: 'armada',
      score: 9000,
      salvage: 10,
      kills: 5,
      schematics: [],
      pilotsRescued: [],
      bossDefeated: true,
      victory: true,
    };
    expect(bankRun(base, result).save.selectedLevel).toBe('corona');
    setOwnedPacks([]);
    expect(bankRun(base, result).save.selectedLevel).toBe('armada');
  });
});
