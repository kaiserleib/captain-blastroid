import { setVolume } from '../audio';
import type { Settings } from '../meta';

/** Pushes the saved volumes into the mixer; main.ts calls this on load and on every save change. */
export function applyAudioSettings(s: Readonly<Settings>): void {
  setVolume('music', s.music);
  setVolume('sfx', s.sfx);
}
