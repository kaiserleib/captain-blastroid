import { actEndedBy, PILOTS, SHIPS, WEAPONS, type WeaponId } from '../content';
import {
  bankRun,
  nextLevelId,
  runResultFrom,
  type BankResult,
  type Discovery,
  type SaveData,
} from '../meta';
import type { RunState } from '../sim/world';

export interface FinishedRun extends BankResult {
  /** The boss went down on a sector that had never been cleared. */
  firstClear: boolean;
  /** First clear of the campaign's last sector. */
  campaignComplete: boolean;
  /** The sector after this one, or null at the end of the campaign. */
  nextLevel: string | null;
  /** First clear of an act's last sector (not the campaign's): the banner, e.g. `ACT I COMPLETE`. */
  actComplete: string | null;
  /** A weapon this run unlocked (T35), and its display name. */
  unlockedWeapon: WeaponId | null;
  unlockedWeaponName: string | null;
}

/** Banks a finished or abandoned run. Run salvage accumulates fractions, so it's floored first. */
export function bankFinishedRun(
  save: SaveData,
  run: RunState,
  victory: boolean,
  abandoned = false,
  now?: Date,
  order?: readonly string[],
): FinishedRun {
  const result = runResultFrom(run, victory, abandoned);
  result.salvage = Math.floor(result.salvage);
  const firstClear = run.bossDefeated && (save.levels[run.levelId]?.clears ?? 0) === 0;
  const nextLevel = nextLevelId(run.levelId, order);
  const banked = bankRun(save, result, now);
  const act = firstClear && nextLevel !== null ? actEndedBy(run.levelId) : null;
  const weapon = unlockedWeaponOf(result.unlockedWeapon, save, banked.save);
  return {
    ...banked,
    firstClear,
    campaignComplete: firstClear && nextLevel === null,
    nextLevel,
    actComplete: act !== null ? `${act.name} COMPLETE` : null,
    unlockedWeapon: weapon,
    unlockedWeaponName: weapon !== null ? (WEAPONS[weapon]?.name ?? weapon.toUpperCase()) : null,
  };
}

/** T35 sets `RunResult.unlockedWeapon`; failing that, the first weapon the save gained. */
export function unlockedWeaponOf(
  reported: WeaponId | undefined,
  before: Pick<SaveData, 'weaponsUnlocked'>,
  after: Pick<SaveData, 'weaponsUnlocked'>,
): WeaponId | null {
  if (reported !== undefined) return reported;
  for (const id of after.weaponsUnlocked) if (!before.weaponsUnlocked.includes(id)) return id;
  return null;
}

export interface ResultBanner {
  text: string;
  /** `campaign` and `act` blink gold/white; `weapon` is green. */
  kind: 'campaign' | 'act' | 'weapon';
}

/** The lines under the results title, in order. Only a victory shows any. */
export function resultBanners(
  f: Pick<FinishedRun, 'campaignComplete' | 'actComplete' | 'unlockedWeaponName'>,
  victory: boolean,
): ResultBanner[] {
  const out: ResultBanner[] = [];
  if (!victory) return out;
  if (f.campaignComplete) out.push({ text: 'CAMPAIGN COMPLETE', kind: 'campaign' });
  else if (f.actComplete !== null) out.push({ text: f.actComplete, kind: 'act' });
  if (f.unlockedWeaponName !== null)
    out.push({ text: `NEW WEAPON: ${f.unlockedWeaponName}`, kind: 'weapon' });
  return out;
}

export interface DiscoveryLine {
  label: string;
  value: string;
  kind: Discovery['kind'];
  /** Pilot id for a portrait, ship id for a sprite. */
  ref?: string;
}

export function discoveryLines(ds: readonly Discovery[]): DiscoveryLine[] {
  return ds.map((d) => {
    if (d.kind === 'schematic') {
      return {
        kind: d.kind,
        label: 'SCHEMATIC FOUND',
        value: (SHIPS[d.shipId]?.name ?? d.shipId).toUpperCase(),
        ref: d.shipId,
      };
    }
    if (d.kind === 'pilot') {
      return {
        kind: d.kind,
        label: 'PILOT RESCUED',
        value: PILOTS[d.pilotId]?.name ?? d.pilotId,
        ref: d.pilotId,
      };
    }
    return {
      kind: d.kind,
      label: d.rank === 1 ? 'NEW HIGH SCORE!' : 'HIGH SCORE',
      value: `RANK ${d.rank} OF 10`,
    };
  });
}
