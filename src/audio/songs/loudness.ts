import { DRUMS } from '../notes';
import { CHANNELS, compileSong, type Instrument, type SongDef } from '../song';

/**
 * A rough loudness estimate computed straight from a song's notes, with no
 * audio context: the music module only renders through Web Audio, so tests
 * can't do an offline render. It mirrors music.ts closely enough to rank songs:
 * each sounding step contributes its envelope level times the waveform's RMS,
 * and each drum hit an energy and a peak taken from music.ts's drum recipes.
 */
export interface LoudnessEstimate {
  /** Root-mean-square level over one loop. */
  rms: number;
  /** Highest summed onset level on any step. */
  peak: number;
}

// RMS of a peak-normalized, DC-free pulse of duty d is sqrt(d / (1 − d)); a triangle's is 1/√3.
const pulseRms = (duty: number): number => Math.sqrt(duty / (1 - duty));
const TRI_RMS = 1 / Math.sqrt(3);

// Per drum code: [energy in amplitude²·s, peak amplitude], from music.ts's tone/hiss layers.
// An exponential fade to 0.0005 over `len` has energy ≈ vol²·len / 15.
const e = (vol: number, len: number): number => (vol * vol * len) / 15;
const DRUM_LOUDNESS: Record<number, readonly [number, number]> = {
  [DRUMS.k]: [e(1, 0.2) + e(0.25, 0.02), 1.25],
  [DRUMS.s]: [e(0.5, 0.08) + e(0.55, 0.16), 1.05],
  [DRUMS.h]: [e(0.3, 0.035), 0.3],
  [DRUMS.o]: [e(0.28, 0.2), 0.28],
  [DRUMS.c]: [e(0.45, 1.1) + e(0.2, 0.6), 0.65],
  [DRUMS.t]: [e(0.8, 0.18), 0.8],
};

function waveRms(ch: (typeof CHANNELS)[number], inst: Instrument): number {
  return ch === 'tri' ? TRI_RMS : pulseRms(inst.duty ?? 0.5);
}

export function estimateLoudness(def: SongDef): LoudnessEstimate {
  const song = compileSong(def);
  const dt = song.stepDur;
  const first = Math.max(0, song.loop);
  let energy = 0;
  let steps = 0;
  let peak = 0;
  for (let ei = first; ei < song.entries.length; ei++) {
    const p = song.entries[ei]!.pattern;
    // Remaining steps of the note still sounding on each channel, and whether it's the onset.
    const left = { p1: 0, p2: 0, tri: 0 };
    for (let i = 0; i < p.steps; i++) {
      let onset = 0;
      for (const ch of CHANNELS) {
        const inst = def[ch];
        const track = p[ch];
        let level = 0;
        if (track && track.lengths[i]! > 0) {
          left[ch] = track.lengths[i]!;
          level = (inst.vol + inst.vol * inst.sustain) / 2;
          onset += inst.vol;
        } else if (left[ch] > 0) {
          level = inst.vol * inst.sustain;
        }
        if (left[ch] > 0) left[ch]--;
        const a = level * waveRms(ch, inst);
        energy += a * a * dt;
      }
      const hit = p.noise?.[i] ?? -1;
      const drum = hit >= 0 ? DRUM_LOUDNESS[hit] : undefined;
      if (drum) {
        energy += drum[0] * def.drums * def.drums;
        onset += drum[1] * def.drums;
      }
      if (onset > peak) peak = onset;
      steps++;
    }
  }
  return { rms: Math.sqrt(energy / Math.max(dt, steps * dt)), peak };
}
