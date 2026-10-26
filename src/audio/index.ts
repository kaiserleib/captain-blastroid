import type { EventBus, GameEvents } from '../engine/events';
import * as music from './music';
import { playAt } from './sfx';

export {
  getVolume,
  installAudio,
  isMuted,
  resume as resumeAudio,
  setMuted,
  setVolume,
  suspend as suspendAudio,
  unlock as unlockAudio,
  type Bus,
} from './audio';
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
    events.on('bossWarning', () => music.stop(1.2)),
    events.on('bossSpawned', () => music.playSong('boss')),
    events.on('bossDefeated', () => music.stop(0.4)),
    events.on('levelComplete', () => music.playSong('clear')),
  ];
  return () => {
    for (const off of offs) off();
  };
}
