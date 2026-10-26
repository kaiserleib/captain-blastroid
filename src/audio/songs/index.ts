import type { SongDef } from '../song';
import { boss } from './boss';
import { clear } from './clear';
import { level1 } from './level1';
import { title } from './title';

export const SONGS: Record<string, SongDef> = { title, level1, boss, clear };
export const SONG_IDS = Object.keys(SONGS);
