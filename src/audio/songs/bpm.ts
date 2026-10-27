/**
 * Act II song tempos, in a dependency-free module so sector content can
 * phase-lock to a song (e.g. the Foundry's welding-line pulsars) without
 * importing the song data. One beat is 60 / bpm seconds; every song starts on
 * a downbeat, and every pattern is a whole number of bars (4 beats).
 */
export const ACT2_SONG_BPM = {
  corona: 140,
  warrens: 110,
  junction: 126,
  rift: 96,
  foundry: 136,
  boss2: 172,
  foundry_boss: 180,
  escape: 160,
} as const;

export type Act2SongId = keyof typeof ACT2_SONG_BPM;

/** Seconds per beat for an Act II song. */
export function beatSeconds(id: Act2SongId): number {
  return 60 / ACT2_SONG_BPM[id];
}
