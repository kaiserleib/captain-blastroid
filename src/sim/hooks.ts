import type { Anomaly, Bullet, Enemy, PlayerState } from './types';
import type { World } from './world';

// Module-level registries so features can plug into collision/damage without
// T03 importing them. Register once at module load (a feature's index.ts),
// not per scene enter.

/** Return true to consume the enemy shot (drones, escape pods). */
export type ShotBlocker = (w: World, shot: Bullet) => boolean;
export type AnomalyContact = (w: World, a: Anomaly, player: PlayerState) => void;
/** Return true when the boss handled the hit (and any death) itself. */
export type BossDamageHook = (w: World, part: Enemy, amount: number) => boolean;

/**
 * Return false to hide an `isBoss` enemy from auto-targeting (seekers, homing
 * retargets): armor plates and shielded cores would otherwise soak missiles.
 */
export type TargetFilter = (w: World, e: Enemy) => boolean;

const shotBlockers: ShotBlocker[] = [];
const targetFilters: TargetFilter[] = [];
const anomalyContacts: Partial<Record<Anomaly['kind'], AnomalyContact>> = {};
const bossDamageHooks: BossDamageHook[] = [];

function remover<T>(list: T[], fn: T): () => void {
  return () => {
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  };
}

export function registerShotBlocker(fn: ShotBlocker): () => void {
  shotBlockers.push(fn);
  return remover(shotBlockers, fn);
}

/** One handler per kind; registering again replaces it. */
export function registerAnomalyContact(kind: Anomaly['kind'], fn: AnomalyContact): () => void {
  anomalyContacts[kind] = fn;
  return () => {
    if (anomalyContacts[kind] === fn) delete anomalyContacts[kind];
  };
}

export function registerBossDamage(fn: BossDamageHook): () => void {
  bossDamageHooks.push(fn);
  return remover(bossDamageHooks, fn);
}

export function registerTargetFilter(fn: TargetFilter): () => void {
  targetFilters.push(fn);
  return remover(targetFilters, fn);
}

export function getTargetFilters(): readonly TargetFilter[] {
  return targetFilters;
}

export function getShotBlockers(): readonly ShotBlocker[] {
  return shotBlockers;
}

export function getAnomalyContact(kind: Anomaly['kind']): AnomalyContact | undefined {
  return anomalyContacts[kind];
}

export function getBossDamageHooks(): readonly BossDamageHook[] {
  return bossDamageHooks;
}

/** For tests. */
export function clearHooks(): void {
  shotBlockers.length = 0;
  bossDamageHooks.length = 0;
  targetFilters.length = 0;
  delete anomalyContacts.blackhole;
  delete anomalyContacts.pulsar;
}
