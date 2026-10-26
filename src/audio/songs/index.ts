import type { SongDef } from '../song';
import { armada } from './armada';
import { armada_boss } from './armada_boss';
import { boss } from './boss';
import { clear } from './clear';
import { horizon } from './horizon';
import { ion } from './ion';
import { level1 } from './level1';
import { pulsar } from './pulsar';
import { title } from './title';

export const SONGS: Record<string, SongDef> = {
  title,
  level1,
  boss,
  clear,
  ion,
  horizon,
  pulsar,
  armada,
  armada_boss,
};
export const SONG_IDS = Object.keys(SONGS);
