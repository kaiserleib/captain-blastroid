// Anonymous milestone counts: how many installs open the game, finish Act I, see an
// expansion's store page, get it, and play it. Each milestone is reported once per
// install and carries no identifier, so the server can only add one to a daily total.
import type { PackId } from '../content';
import type { StorageAdapter } from '../platform/platform';

export const TELEMETRY_KEY = 'captain-blastroid.telemetry';

export type Milestone =
  | 'first_open'
  | 'act1_clear'
  | `offer_seen_${PackId}`
  | `pack_get_${PackId}`
  | `pack_play_${PackId}`;

/** Resolves true once the server has counted the milestone. */
export type MilestoneSender = (m: Milestone) => Promise<boolean>;

interface State {
  /** Milestones this install has reached (sent or still queued). */
  done: string[];
  /** Reached but not yet counted: the game is playable offline. */
  queue: string[];
}

let storage: StorageAdapter | null = null;
let sender: MilestoneSender | null = null;
let state: State = { done: [], queue: [] };
let flushing = false;

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function persist(): void {
  void storage?.set(TELEMETRY_KEY, JSON.stringify(state)).catch(() => {});
}

/**
 * A null sender turns reporting off: nothing is recorded, so milestones reached in a
 * dev or test session are not sent later by a real one.
 */
export async function initTelemetry(
  s: StorageAdapter,
  send: MilestoneSender | null,
): Promise<void> {
  storage = null;
  sender = send;
  state = { done: [], queue: [] };
  if (!send) return;
  try {
    const raw = await s.get(TELEMETRY_KEY);
    const saved = (raw === null ? null : JSON.parse(raw)) as Partial<State> | null;
    state = { done: strings(saved?.done), queue: strings(saved?.queue) };
  } catch {
    // A bad record starts over; the worst case is a milestone counted twice.
  }
  storage = s;
  milestone('first_open');
  void flushTelemetry();
}

/** Reports `m` the first time this install reaches it. Never throws, never blocks. */
export function milestone(m: Milestone): void {
  if (!sender || state.done.includes(m)) return;
  state.done.push(m);
  state.queue.push(m);
  persist();
  void flushTelemetry();
}

/** Sends what is queued, oldest first, stopping at the first failure. */
export async function flushTelemetry(): Promise<void> {
  const send = sender;
  if (!send || flushing) return;
  flushing = true;
  try {
    while (sender === send && state.queue.length > 0) {
      const next = state.queue[0] as Milestone;
      let ok = false;
      try {
        ok = await send(next);
      } catch {
        ok = false;
      }
      if (!ok || sender !== send) break;
      state.queue = state.queue.filter((q) => q !== next);
      persist();
    }
  } finally {
    flushing = false;
  }
}

export interface TelemetryContext {
  platform: 'ios' | 'android' | 'web';
  version: string;
}

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; keepalive: boolean },
) => Promise<{ ok: boolean }>;

/** POSTs `{ event, platform, version }` as JSON; `key` goes in the `apikey` header (Supabase). */
export function httpSender(
  url: string,
  key: string | null,
  ctx: TelemetryContext,
  fetchFn: FetchLike = (u, init) => fetch(u, init),
): MilestoneSender {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (key) headers.apikey = key;
  return async (m) => {
    const res = await fetchFn(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ event: m, platform: ctx.platform, version: ctx.version }),
      keepalive: true,
    });
    return res.ok;
  };
}

/** Test helper: reporting off, nothing remembered. */
export function resetTelemetry(): void {
  storage = null;
  sender = null;
  state = { done: [], queue: [] };
  flushing = false;
}
