import type { Asteroid, Enemy, Pickup } from '../sim/types';

type Listener<P> = (payload: P) => void;
type ListenerMap<E> = { [K in keyof E]?: Listener<E[K]>[] };

/**
 * Synchronous typed event bus. Listener arrays are copy-on-write, so `emit`
 * doesn't allocate and listeners may subscribe or unsubscribe mid-dispatch
 * (the change takes effect on the next emit).
 */
export class EventBus<E extends object> {
  private listeners: ListenerMap<E> = {};

  on<K extends keyof E>(type: K, fn: Listener<E[K]>): () => void {
    this.listeners[type] = [...(this.listeners[type] ?? []), fn];
    return () => this.off(type, fn);
  }

  off<K extends keyof E>(type: K, fn: Listener<E[K]>): void {
    const list = this.listeners[type];
    if (!list) return;
    const i = list.indexOf(fn);
    if (i < 0) return;
    this.listeners[type] = list.length === 1 ? undefined : list.filter((_, j) => j !== i);
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    const list = this.listeners[type];
    if (!list) return;
    for (let i = 0; i < list.length; i++) (list[i] as Listener<E[K]>)(payload);
  }

  /** Removes listeners for one event type, or all of them. */
  clear(type?: keyof E): void {
    if (type === undefined) this.listeners = {};
    else this.listeners[type] = undefined;
  }
}

/** Payload for events that carry no data; emit them with `{}`. */
export type NoPayload = Record<string, never>;

export interface GameEvents {
  enemyHit: { enemy: Enemy; damage: number };
  /** byPlayer=false if an asteroid killed it. */
  enemyKilled: { enemy: Enemy; byPlayer: boolean };
  asteroidHit: { asteroid: Asteroid };
  asteroidDestroyed: { asteroid: Asteroid; byPlayer: boolean };
  playerHit: { shieldLeft: number };
  playerDied: NoPayload;
  pickupCollected: { pickup: Pickup };
  weaponAdded: { weaponId: string };
  weaponLeveled: { weaponId: string; level: number };
  formationCleared: { formationId: number; x: number; y: number };
  /** Director → boss module: spawn this boss (T16 replies with bossSpawned). */
  bossRequested: { defId: string };
  bossSpawned: { defId: string };
  bossDefeated: { defId: string; x: number; y: number };
  levelComplete: NoPayload;
  sfx: { id: string; x?: number };
  shake: { mag: number; dur: number };
  hitstop: { dur: number };
  haptic: { kind: 'light' | 'medium' | 'heavy' };
  toast: { text: string };
  bossWarning: NoPayload;
  pauseRequested: NoPayload;
  runOver: { victory: boolean };
}
