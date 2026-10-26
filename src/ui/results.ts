import { PILOTS, SHIPS } from '../content';
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
  return {
    ...bankRun(save, result, now),
    firstClear,
    campaignComplete: firstClear && nextLevel === null,
    nextLevel,
  };
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
