// Playtest run log: one record per finished run, kept apart from the save so it can be
// copied out as plain text and compared with the sim bots' balance tables.
import type { StorageAdapter } from '../platform/platform';

export const RUN_LOG_KEY = 'captain-blastroid.runlog';
export const RUN_LOG_MAX = 200;

export type RunOutcome = 'clear' | 'death' | 'quit';

export interface RunLogEntry {
  /** ISO time the run ended. */
  at: string;
  level: string;
  ship: string;
  pilot: string;
  outcome: RunOutcome;
  /** Seconds survived. */
  time: number;
  /** Run time the boss arrived, or null. */
  bossAt: number | null;
  /** Seconds from the boss's arrival to its defeat or the run's end. */
  bossTime: number | null;
  score: number;
  /** Salvage banked (after multipliers). */
  salvage: number;
  kills: number;
  pod: boolean;
  /** `<phase>:<cause>` → count; phase is `level`, `boss` or `escape`. Causes match the sim harness. */
  hits: Record<string, number>;
  deathCause: string | null;
  /** `blaster4 arc3 …` at the end of the run. */
  weapons: string;
}

let storage: StorageAdapter | null = null;
let entries: RunLogEntry[] = [];
let writing: Promise<void> = Promise.resolve();

/** Loads the log; boot calls it beside `initSave`. A bad or missing log starts empty. */
export async function initRunLog(s: StorageAdapter): Promise<void> {
  storage = s;
  entries = [];
  try {
    const raw = await s.get(RUN_LOG_KEY);
    if (raw) entries = parseEntries(raw);
  } catch {
    entries = [];
  }
}

export function parseEntries(raw: string): RunLogEntry[] {
  const v: unknown = JSON.parse(raw);
  if (!Array.isArray(v)) return [];
  return v.filter(
    (e): e is RunLogEntry =>
      typeof e === 'object' && e !== null && typeof (e as RunLogEntry).level === 'string',
  );
}

export function runLogEntries(): readonly RunLogEntry[] {
  return entries;
}

export function appendRunLog(e: RunLogEntry): Promise<void> {
  entries.push(e);
  if (entries.length > RUN_LOG_MAX) entries.splice(0, entries.length - RUN_LOG_MAX);
  return persist();
}

export function clearRunLog(): Promise<void> {
  entries = [];
  return persist();
}

function persist(): Promise<void> {
  const s = storage;
  if (!s) return Promise.resolve();
  const json = JSON.stringify(entries);
  // Writes queue so an older log can never land after a newer one.
  writing = writing.then(() => s.set(RUN_LOG_KEY, json)).catch(() => {});
  return writing;
}

export interface RunLogHeader {
  build: string;
  device: string;
  /** Level ids in campaign order, for the per-sector summary. */
  levelOrder: readonly string[];
}

/** Plain text a tester can paste into a message: a per-sector summary, then every run, newest first. */
export function formatRunLog(list: readonly RunLogEntry[], h: RunLogHeader): string {
  const out: string[] = [
    `CAPTAIN BLASTROID RUN LOG · build ${h.build} · ${list.length} run${list.length === 1 ? '' : 's'}`,
    `device: ${h.device}`,
    '',
  ];
  if (list.length === 0) {
    out.push('No runs yet.');
    return out.join('\n');
  }
  out.push('SECTOR          tries clears deaths quits  deaths by cause');
  const ids = [...h.levelOrder];
  for (const e of list) if (!ids.includes(e.level)) ids.push(e.level);
  for (const id of ids) {
    const runs = list.filter((e) => e.level === id);
    if (runs.length === 0) continue;
    const n = (o: RunOutcome): number => runs.filter((e) => e.outcome === o).length;
    const causes: Record<string, number> = {};
    for (const e of runs) {
      if (e.outcome === 'death') {
        const c = e.deathCause ?? '?';
        causes[c] = (causes[c] ?? 0) + 1;
      }
    }
    out.push(
      `${pad(levelTag(id, h.levelOrder), 15)} ${lpad(runs.length, 5)} ${lpad(n('clear'), 6)} ${lpad(n('death'), 6)} ${lpad(n('quit'), 5)}  ${counts(causes) || '-'}`,
    );
  }
  out.push('', 'RUNS (newest first)');
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i] as RunLogEntry;
    const boss =
      e.bossAt === null ? 'no boss' : `boss ${secs(e.bossAt)} fight ${secs(e.bossTime ?? 0)}`;
    out.push(
      `${stamp(e.at)} ${levelTag(e.level, h.levelOrder)} ${e.outcome.toUpperCase()} ${secs(e.time)} ${e.ship}/${e.pilot} ${boss} score ${e.score} salvage ${e.salvage} kills ${e.kills} pod ${e.pod ? 'Y' : 'N'}`,
    );
    const hits = (['level', 'boss', 'escape'] as const)
      .map((ph) => {
        const c: Record<string, number> = {};
        for (const [k, v] of Object.entries(e.hits)) {
          const [p, cause] = splitKey(k);
          if (p === ph) c[cause] = v;
        }
        const s = counts(c);
        return s ? `${ph}: ${s}` : '';
      })
      .filter(Boolean)
      .join(' | ');
    out.push(`  hits ${hits || 'none'}${e.deathCause ? ` · died to ${e.deathCause}` : ''}`);
    out.push(`  weapons ${e.weapons || '-'}`);
  }
  return out.join('\n');
}

function splitKey(k: string): [string, string] {
  const i = k.indexOf(':');
  return i < 0 ? ['level', k] : [k.slice(0, i), k.slice(i + 1)];
}

/** Highest count first: `shot 3, flare 2`. */
function counts(c: Record<string, number>): string {
  return Object.entries(c)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
}

function levelTag(id: string, order: readonly string[]): string {
  const i = order.indexOf(id);
  return i < 0 ? id : `L${i + 1} ${id}`;
}

function secs(t: number): string {
  return `${Math.round(t)}s`;
}

/** `2026-10-27 14:02` in the tester's local time. */
function stamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const z = (v: number): string => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
}

function pad(s: string, n: number): string {
  return s.padEnd(n);
}

function lpad(v: number, n: number): string {
  return String(v).padStart(n);
}
