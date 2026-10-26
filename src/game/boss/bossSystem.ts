import type { Renderer } from '../../gfx/renderer';
import { registerEnemyDefs, type SimEnemyDef } from '../../sim/spawn';
import type { Enemy } from '../../sim/types';
import type { World } from '../../sim/world';
import type { BossRig, PartSlot } from './parts';

// Boss lifecycle (WAVE3 flow): the director emits `bossRequested`; the next
// boss tick builds the registered controller, spawns it and emits
// `bossSpawned`. The controller emits `bossDefeated` and `sfx boss_die`
// itself; T13 plays the explosions, the director the rewards.

/**
 * One boss fight. Built fresh per fight by its registration's `create`, then
 * driven by the boss system (slot: after enemies, before bullets) until
 * `done`. Parts are `isBoss` enemies held by `rig`.
 */
export interface BossController {
  /** The id it was registered under (also the `bossSpawned`/`bossDefeated` defId). */
  readonly defId: string;
  readonly rig: BossRig;
  /** True once the fight is over and the parts are released; the system then drops it. */
  readonly done: boolean;
  /** Spawns the rig. False if the enemy pool was too full (the system releases the rig). */
  spawn(w: World): boolean;
  update(w: World, dt: number): void;
  /**
   * Damage to one of our parts, before the sim applies it. True = handled
   * (absorbed or resolved here, e.g. armor or the killing blow on the core).
   */
  onDamage(part: Enemy, slot: PartSlot, amount: number): boolean;
  /** Seekers and drones may aim at this part now. */
  targetable(part: Enemy, slot: PartSlot): boolean;
  /** Short phase label for logs and the sim harness (`fight`, `exposed`, `dying`, ...). */
  phaseName(): string;
}

export interface BossRegistration<C extends BossController = BossController> {
  /** Builds a fresh controller for one fight. */
  create(): C;
  /** Draws the boss at z 42 (between roster enemies and enemy shots). Not called once `done`. */
  draw(w: World, r: Renderer, alpha: number, boss: C): void;
  /** HUD boss-bar name. Default: the defId, `rock_hauler` → `ROCK HAULER`. */
  displayName?: string;
  /** Part enemy defs, registered with `registerEnemyDefs` (`isBoss` forced on). */
  parts?: Readonly<Record<string, SimEnemyDef>>;
  /** Sprite ids GameScene bakes at load, so the first frame of the fight doesn't hitch. */
  spriteIds?: readonly string[];
}

const registry = new Map<string, BossRegistration>();

/**
 * Registers a boss under the id timelines use (`{ t, boss: 'hz_perihelion' }`).
 * Call once at module load; a second, different registration throws.
 */
export function registerBoss<C extends BossController>(
  defId: string,
  reg: BossRegistration<C>,
): void {
  const had = registry.get(defId);
  if (had !== undefined && had !== reg) throw new Error(`registerBoss: duplicate "${defId}"`);
  if (reg.parts !== undefined) {
    const parts: Record<string, SimEnemyDef> = {};
    for (const id in reg.parts) parts[id] = { ...(reg.parts[id] as SimEnemyDef), isBoss: true };
    registerEnemyDefs(parts);
  }
  registry.set(defId, reg as unknown as BossRegistration);
}

export function bossRegistration(defId: string): BossRegistration | undefined {
  return registry.get(defId);
}

/** Every registered boss id. */
export function bossIds(): string[] {
  return [...registry.keys()];
}

/** HUD name: the registration's `displayName`, else `rock_hauler` → `ROCK HAULER`. */
export function bossDisplayName(defId: string): string {
  const n = registry.get(defId)?.displayName;
  if (n !== undefined) return n;
  return defId
    .replace(/^boss[_-]?/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toUpperCase();
}

interface BossWorld {
  boss: BossController | null;
  reg: BossRegistration | null;
  requests: string[];
  off: (() => void) | null;
}

const state = new WeakMap<World, BossWorld>();
const SPAWNED_P = { defId: '' };

function stateOf(w: World): BossWorld {
  let s = state.get(w);
  if (s === undefined) {
    s = { boss: null, reg: null, requests: [], off: null };
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
export function activeBoss(w: World): BossController | null {
  return state.get(w)?.boss ?? null;
}

/** Spawns a boss immediately. Returns null for unknown ids, a boss already up, or a full pool. */
export function spawnBoss(w: World, defId: string): BossController | null {
  const s = stateOf(w);
  const reg = registry.get(defId);
  if (s.boss !== null || reg === undefined) return null;
  const boss = reg.create();
  if (!boss.spawn(w)) {
    boss.rig.release(w);
    return null;
  }
  s.boss = boss;
  s.reg = reg;
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
  if (b.done) {
    s.boss = null;
    s.reg = null;
  }
}

/** Draws the active boss through its registration. */
export function drawActiveBoss(w: World, r: Renderer, alpha: number): void {
  const s = state.get(w);
  if (s === undefined || s.boss === null || s.reg === null || s.boss.done) return;
  s.reg.draw(w, r, alpha, s.boss);
}

/** `registerBossDamage` hook: routes a hit on one of the active boss's parts to its controller. */
export function bossDamageHook(w: World, part: Enemy, amount: number): boolean {
  const b = activeBoss(w);
  if (b === null) return false;
  const i = b.rig.slotOf(part);
  if (i < 0) return false;
  return b.onDamage(part, b.rig.slots[i] as PartSlot, amount);
}

/** `registerTargetFilter` hook: seekers skip parts the active boss says can't be hurt now. */
export function bossTargetFilter(w: World, part: Enemy): boolean {
  const b = activeBoss(w);
  if (b === null) return true;
  const i = b.rig.slotOf(part);
  if (i < 0) return true;
  return b.targetable(part, b.rig.slots[i] as PartSlot);
}

/** Remaining HP over every part, targetable or not (0 with no boss). */
export function bossHp(w: World): number {
  return activeBoss(w)?.rig.hp() ?? 0;
}

export function bossMaxHp(w: World): number {
  return activeBoss(w)?.rig.maxHp() ?? 0;
}
