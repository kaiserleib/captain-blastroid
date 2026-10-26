// Persistent save format. Pure data + validation; no I/O.
import { PILOTS, SHIPS, UPGRADES } from '../content';

export const SAVE_VERSION = 1;
export const HIGH_SCORE_LIMIT = 10;
export const DEFAULT_SHIP = 'kestrel';
export const DEFAULT_PILOT = 'blastroid';

export type ScreenShake = 'off' | 'low' | 'full';

export interface Settings {
  /** Volume 0..1. */
  music: number;
  /** Volume 0..1. */
  sfx: number;
  haptics: boolean;
  /** Virtual stick alpha 0..1. */
  stickOpacity: number;
  /** Multiplier on the stick's base radius. */
  stickRadiusScale: number;
  screenShake: ScreenShake;
}

export interface HighScore {
  score: number;
  pilot: string;
  ship: string;
  /** ISO 8601. */
  date: string;
}

export interface SaveStats {
  runs: number;
  kills: number;
  deaths: number;
  bossKills: number;
}

export interface SaveData {
  version: number;
  salvage: number;
  totalSalvageEarned: number;
  /** Upgrade id → owned level. Missing = 0. */
  upgrades: Record<string, number>;
  schematics: string[];
  shipsBuilt: string[];
  pilotsRescued: string[];
  selectedShip: string;
  selectedPilot: string;
  /** Sorted by score, highest first; at most HIGH_SCORE_LIMIT. */
  highScores: HighScore[];
  stats: SaveStats;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  music: 0.8,
  sfx: 0.8,
  haptics: true,
  stickOpacity: 0.5,
  stickRadiusScale: 1,
  screenShake: 'full',
});

export function createDefaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    salvage: 0,
    totalSalvageEarned: 0,
    upgrades: {},
    schematics: [],
    shipsBuilt: [DEFAULT_SHIP],
    pilotsRescued: [DEFAULT_PILOT],
    selectedShip: DEFAULT_SHIP,
    selectedPilot: DEFAULT_PILOT,
    highScores: [],
    stats: { runs: 0, kills: 0, deaths: 0, bossKills: 0 },
    settings: { ...DEFAULT_SETTINGS },
  };
}

export class SaveFormatError extends Error {}

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function count(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
}

function unit(v: unknown, fallback: number, max = 1): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : fallback;
}

function idList(v: unknown, known: Readonly<Record<string, unknown>>): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const id of v) if (typeof id === 'string' && id in known && !out.includes(id)) out.push(id);
  return out;
}

function withDefault(list: string[], id: string): string[] {
  return list.includes(id) ? list : [id, ...list];
}

function normalizeSettings(v: unknown): Settings {
  const s = isObj(v) ? v : {};
  const d = DEFAULT_SETTINGS;
  return {
    music: unit(s.music, d.music),
    sfx: unit(s.sfx, d.sfx),
    haptics: typeof s.haptics === 'boolean' ? s.haptics : d.haptics,
    stickOpacity: unit(s.stickOpacity, d.stickOpacity),
    stickRadiusScale:
      typeof s.stickRadiusScale === 'number' && s.stickRadiusScale > 0
        ? unit(s.stickRadiusScale, d.stickRadiusScale, 3)
        : d.stickRadiusScale,
    screenShake:
      s.screenShake === 'off' || s.screenShake === 'low' || s.screenShake === 'full'
        ? s.screenShake
        : d.screenShake,
  };
}

function normalizeHighScores(v: unknown): HighScore[] {
  if (!Array.isArray(v)) return [];
  const out: HighScore[] = [];
  for (const h of v) {
    if (!isObj(h)) continue;
    out.push({
      score: count(h.score, 0),
      pilot: typeof h.pilot === 'string' ? h.pilot : DEFAULT_PILOT,
      ship: typeof h.ship === 'string' ? h.ship : DEFAULT_SHIP,
      date: typeof h.date === 'string' ? h.date : '',
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, HIGH_SCORE_LIMIT);
}

/**
 * Coerces a v1-shaped object into a valid SaveData: unknown ids dropped,
 * bad fields defaulted, starter ship/pilot always present.
 */
export function normalize(raw: Obj): SaveData {
  const d = createDefaultSave();
  const upgrades: Record<string, number> = {};
  if (isObj(raw.upgrades)) {
    for (const [id, lvl] of Object.entries(raw.upgrades)) {
      const def = UPGRADES[id];
      const n = count(lvl, 0);
      if (def && n > 0) upgrades[id] = Math.min(n, def.maxLevel);
    }
  }
  const shipsBuilt = withDefault(idList(raw.shipsBuilt, SHIPS), DEFAULT_SHIP);
  const pilotsRescued = withDefault(idList(raw.pilotsRescued, PILOTS), DEFAULT_PILOT);
  const stats = isObj(raw.stats) ? raw.stats : {};
  const schematics = Array.isArray(raw.schematics)
    ? [...new Set(raw.schematics.filter((s): s is string => typeof s === 'string'))]
    : [];
  return {
    version: SAVE_VERSION,
    salvage: count(raw.salvage, d.salvage),
    totalSalvageEarned: count(raw.totalSalvageEarned, d.totalSalvageEarned),
    upgrades,
    schematics,
    shipsBuilt,
    pilotsRescued,
    selectedShip:
      typeof raw.selectedShip === 'string' && shipsBuilt.includes(raw.selectedShip)
        ? raw.selectedShip
        : DEFAULT_SHIP,
    selectedPilot:
      typeof raw.selectedPilot === 'string' && pilotsRescued.includes(raw.selectedPilot)
        ? raw.selectedPilot
        : DEFAULT_PILOT,
    highScores: normalizeHighScores(raw.highScores),
    stats: {
      runs: count(stats.runs, 0),
      kills: count(stats.kills, 0),
      deaths: count(stats.deaths, 0),
      bossKills: count(stats.bossKills, 0),
    },
    settings: normalizeSettings(raw.settings),
  };
}

/**
 * Upgrades any stored version to the current one. Throws SaveFormatError when
 * the data isn't a save at all; the caller treats that as corruption.
 */
export function migrate(raw: unknown): SaveData {
  if (!isObj(raw) || typeof raw.version !== 'number') {
    throw new SaveFormatError('Not a save object');
  }
  const data: Obj = { ...raw };
  const version = raw.version;
  // Version steps go here as the format evolves, e.g.:
  // if (version < 2) { data.foo = ...; }
  if (version > SAVE_VERSION) {
    // A newer build wrote this; keep what we understand rather than wiping progress.
    console.warn(`Save version ${version} read by a v${SAVE_VERSION} build`);
  }
  return normalize(data);
}

/** Parses a stored blob. Throws on invalid JSON or a non-save object. */
export function parseSave(json: string): SaveData {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new SaveFormatError(`Invalid JSON: ${(e as Error).message}`);
  }
  return migrate(raw);
}

export function serializeSave(save: SaveData): string {
  return JSON.stringify(save);
}
