import { isBossId } from '../../content/bosses';
import type { Enemy } from '../../sim/types';
import type { World } from '../../sim/world';
import { RockHauler } from './rockHauler';

// Boss lifecycle (WAVE3 flow): the director emits `bossRequested`; the next
// boss tick spawns it and emits `bossSpawned`. The boss emits `bossDefeated`
// and `sfx boss_die` itself; T13 plays the explosions, T15 the rewards.

interface BossWorld {
  boss: RockHauler | null;
  requests: string[];
  off: (() => void) | null;
}

const state = new WeakMap<World, BossWorld>();
const SPAWNED_P = { defId: '' };

function stateOf(w: World): BossWorld {
  let s = state.get(w);
  if (s === undefined) {
    s = { boss: null, requests: [], off: null };
    state.set(w, s);
  }
  return s;
}

/** Subscribes to `bossRequested`. The system calls this lazily; tests can call it directly. */
export function attachBoss(w: World): void {
  const s = stateOf(w);
  if (s.off !== null) return;
  s.off = w.events.on('bossRequested', (p) => {
    s.requests.push(p.defId);
  });
}

/** The active boss, if any (also during its death throes). */
export function activeBoss(w: World): RockHauler | null {
  return state.get(w)?.boss ?? null;
}

/** Spawns a boss immediately. Returns null for unknown ids, a boss already up, or a full pool. */
export function spawnBoss(w: World, defId: string): RockHauler | null {
  const s = stateOf(w);
  if (s.boss !== null || !isBossId(defId)) return null;
  const boss = new RockHauler();
  if (!boss.spawn(w)) {
    boss.rig.release(w);
    return null;
  }
  s.boss = boss;
  SPAWNED_P.defId = defId;
  w.events.emit('bossSpawned', SPAWNED_P);
  return boss;
}

export function updateBoss(w: World, dt: number): void {
  attachBoss(w);
  const s = stateOf(w);
  while (s.requests.length > 0) spawnBoss(w, s.requests.shift() as string);
  const b = s.boss;
  if (b === null) return;
  b.update(w, dt);
  if (b.done) s.boss = null;
}

/** `registerBossDamage` hook: gates untargetable / invulnerable parts and owns the core kill. */
export function bossDamageHook(w: World, part: Enemy, amount: number): boolean {
  const b = activeBoss(w);
  if (b === null) return false;
  const i = b.rig.slotOf(part);
  if (i < 0) return false;
  return b.onDamage(part, b.rig.slots[i] as (typeof b.rig.slots)[number], amount);
}

/** Remaining HP over every part, targetable or not (0 with no boss). */
export function bossHp(w: World): number {
  return activeBoss(w)?.rig.hp() ?? 0;
}

export function bossMaxHp(w: World): number {
  return activeBoss(w)?.rig.maxHp() ?? 0;
}
