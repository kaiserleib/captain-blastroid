import type { SongDef } from '../song';
import { armada } from './armada';
import { armada_boss } from './armada_boss';
import { boss } from './boss';
import { boss2 } from './boss2';
import { clear } from './clear';
import { corona } from './corona';
import { escape } from './escape';
import { foundry } from './foundry';
import { foundry_boss } from './foundry_boss';
import { horizon } from './horizon';
import { ion } from './ion';
import { junction } from './junction';
import { level1 } from './level1';
import { pulsar } from './pulsar';
import { rift } from './rift';
import { title } from './title';
import { warrens } from './warrens';

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
  corona,
  warrens,
  junction,
  rift,
  foundry,
  boss2,
  foundry_boss,
  escape,
};
export const SONG_IDS = Object.keys(SONGS);
