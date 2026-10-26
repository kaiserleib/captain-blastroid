import { PILOTS, SHIPS } from '../content';
import { bankRun, runResultFrom, type BankResult, type Discovery, type SaveData } from '../meta';
import type { RunState } from '../sim/world';

/** Banks a finished or abandoned run. Run salvage accumulates fractions, so it's floored first. */
export function bankFinishedRun(
  save: SaveData,
  run: RunState,
  victory: boolean,
  now?: Date,
): BankResult {
  const result = runResultFrom(run, victory);
  result.salvage = Math.floor(result.salvage);
  return bankRun(save, result, now);
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
