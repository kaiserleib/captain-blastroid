import type { EventBus, GameEvents } from '../engine/events';
import { resume, suspend } from './audio';
import * as music from './music';
import { playAt } from './sfx';

export {
  getVolume,
  installAudio,
  isMuted,
  perceptualGain,
  setMuted,
  setVolume,
  unlock as unlockAudio,
  type Bus,
} from './audio';

/** Game pause: the song holds its place and goes quiet; UI sounds keep playing. */
export function suspendAudio(): void {
  suspend();
  music.setPaused(true);
}

export function resumeAudio(): void {
  resume();
  music.setPaused(false);
}
export { activeVoices, play as playSfx, playAt as playSfxAt, type PlayOpts } from './sfx';
export { SFX_IDS, type SfxId } from './presets';
export { SONG_IDS } from './songs';
export { currentSong, fadeTo, playSong, stop as stopMusic } from './music';

/**
 * Subscribes audio to a world's events: every `sfx` event plays its preset
 * (panned by `x`), and the boss/level flow drives the music. Returns an
 * unsubscribe function; clearing the bus also detaches it.
 */
export function attachAudio(events: EventBus<GameEvents>): () => void {
  const offs = [
    events.on('sfx', (e) => {
      playAt(e.id, e.x);
    }),
    // Nobody else emits these two sfx: the warning siren and the non-lethal hit tick.
    events.on('bossWarning', () => {
      music.stop(1.2);
      playAt('boss_warning');
    }),
    events.on('enemyHit', (e) => {
      playAt('enemy_hit', e.enemy.x);
    }),
    events.on('bossSpawned', () => music.playSong('boss')),
    events.on('bossDefeated', () => music.stop(0.4)),
    events.on('levelComplete', () => music.playSong('clear')),
  ];
  return () => {
    for (const off of offs) off();
  };
}
