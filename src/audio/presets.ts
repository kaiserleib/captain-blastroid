/**
 * sfxr-style voice parameters. A preset layers one or more voices; punchy
 * hits pair a pitched transient with a noise body.
 */
export interface SfxVoice {
  wave: 'square' | 'saw' | 'triangle' | 'sine' | 'noise';
  /** Start pitch in Hz. For noise: playback rate, 1 = full-band white noise. */
  freq: number;
  /** Pitch at the end of `slide` seconds (exponential). */
  freqEnd?: number;
  /** Defaults to the whole envelope. */
  slide?: number;
  /** Square only. */
  duty?: 0.125 | 0.25 | 0.5;
  attack?: number;
  decay: number;
  /** Fraction of `vol` held for `hold` seconds after the decay. */
  sustain?: number;
  hold?: number;
  release?: number;
  vol: number;
  /** Vibrato as a fraction of the pitch, e.g. 0.05. */
  vibrato?: number;
  vibratoRate?: number;
  /** Low-pass cutoff, optionally swept to `lowpassEnd` over the envelope. */
  lowpass?: number;
  lowpassEnd?: number;
  highpass?: number;
  /** Semitone offsets applied every `arpRate` seconds, like sfxr's "change". */
  arp?: number[];
  arpRate?: number;
  /** Re-triggers the whole voice this many times in total. */
  repeat?: number;
  repeatRate?: number;
  /** Per-repeat pitch multiplier, for rising or falling repeats. */
  repeatPitch?: number;
  /** Seconds after the preset starts. */
  delay?: number;
}

export type SfxPreset = readonly SfxVoice[];

export function voiceLength(v: SfxVoice): number {
  return (v.attack ?? 0) + v.decay + (v.hold ?? 0) + (v.release ?? 0.01);
}

/** Seconds from start until the last layer and repeat has finished. */
export function presetDuration(p: SfxPreset): number {
  let end = 0;
  for (const v of p) {
    const reps = v.repeat ?? 1;
    const t = (v.delay ?? 0) + (reps - 1) * (v.repeatRate ?? 0) + voiceLength(v);
    if (t > end) end = t;
  }
  return end;
}

// Player shots sit low in the mix (vol ≤ 0.12); hits and explosions are the stars.
export const SFX = {
  shot_blaster: [
    {
      wave: 'square',
      duty: 0.25,
      freq: 1400,
      freqEnd: 380,
      decay: 0.055,
      vol: 0.08,
      lowpass: 5000,
    },
  ],
  shot_spread: [
    { wave: 'square', duty: 0.5, freq: 900, freqEnd: 260, decay: 0.06, vol: 0.06, lowpass: 3500 },
    { wave: 'noise', freq: 0.6, freqEnd: 0.25, decay: 0.05, vol: 0.06, lowpass: 3000 },
  ],
  shot_lance: [
    {
      wave: 'square',
      duty: 0.125,
      freq: 2200,
      freqEnd: 600,
      decay: 0.09,
      vol: 0.06,
      vibrato: 0.08,
      vibratoRate: 45,
      lowpass: 6000,
    },
    { wave: 'saw', freq: 220, freqEnd: 110, decay: 0.08, vol: 0.05, lowpass: 1500 },
  ],
  shot_seeker: [
    { wave: 'triangle', freq: 260, freqEnd: 1100, decay: 0.1, vol: 0.12 },
    { wave: 'noise', freq: 0.3, freqEnd: 0.8, attack: 0.02, decay: 0.1, vol: 0.05, lowpass: 2000 },
  ],
  drone_hit: [
    { wave: 'square', duty: 0.5, freq: 1300, freqEnd: 700, decay: 0.03, vol: 0.08, lowpass: 4000 },
  ],
  enemy_hit: [
    { wave: 'square', duty: 0.5, freq: 520, freqEnd: 140, decay: 0.06, vol: 0.3, lowpass: 3500 },
    {
      wave: 'noise',
      freq: 1,
      freqEnd: 0.4,
      decay: 0.05,
      vol: 0.28,
      lowpass: 5000,
      lowpassEnd: 1200,
    },
  ],
  enemy_die_s: [
    { wave: 'square', duty: 0.5, freq: 240, freqEnd: 40, decay: 0.14, vol: 0.45, lowpass: 2000 },
    {
      wave: 'noise',
      freq: 1,
      freqEnd: 0.25,
      decay: 0.3,
      vol: 0.6,
      lowpass: 7000,
      lowpassEnd: 400,
    },
  ],
  enemy_die_m: [
    { wave: 'triangle', freq: 160, freqEnd: 28, decay: 0.35, vol: 0.8 },
    { wave: 'square', duty: 0.25, freq: 300, freqEnd: 45, decay: 0.2, vol: 0.35, lowpass: 1800 },
    {
      wave: 'noise',
      freq: 0.9,
      freqEnd: 0.15,
      decay: 0.6,
      vol: 0.75,
      lowpass: 6000,
      lowpassEnd: 250,
    },
    {
      wave: 'noise',
      freq: 0.6,
      freqEnd: 0.2,
      decay: 0.25,
      vol: 0.4,
      lowpass: 3000,
      lowpassEnd: 300,
      delay: 0.12,
    },
  ],
  asteroid_break: [
    {
      wave: 'noise',
      freq: 0.5,
      freqEnd: 0.12,
      decay: 0.38,
      vol: 0.6,
      lowpass: 2600,
      lowpassEnd: 300,
    },
    {
      wave: 'square',
      duty: 0.125,
      freq: 110,
      freqEnd: 45,
      decay: 0.05,
      vol: 0.25,
      lowpass: 1200,
      repeat: 3,
      repeatRate: 0.045,
      repeatPitch: 0.8,
    },
  ],
  player_hit: [
    {
      wave: 'square',
      duty: 0.5,
      freq: 420,
      freqEnd: 70,
      decay: 0.28,
      vol: 0.5,
      vibrato: 0.25,
      vibratoRate: 28,
      lowpass: 3000,
    },
    { wave: 'noise', freq: 1, freqEnd: 0.3, decay: 0.2, vol: 0.45, lowpass: 6000, lowpassEnd: 800 },
  ],
  player_die: [
    { wave: 'triangle', freq: 220, freqEnd: 22, decay: 0.9, vol: 0.9 },
    {
      wave: 'square',
      duty: 0.5,
      freq: 900,
      freqEnd: 50,
      decay: 1.1,
      vol: 0.3,
      vibrato: 0.12,
      vibratoRate: 18,
      lowpass: 2500,
    },
    {
      wave: 'noise',
      freq: 1,
      freqEnd: 0.12,
      decay: 1.4,
      vol: 0.85,
      lowpass: 7000,
      lowpassEnd: 150,
    },
    {
      wave: 'noise',
      freq: 0.7,
      freqEnd: 0.2,
      decay: 0.35,
      vol: 0.5,
      lowpass: 4000,
      lowpassEnd: 300,
      delay: 0.25,
      repeat: 2,
      repeatRate: 0.3,
    },
  ],
  shield_up: [
    {
      wave: 'triangle',
      freq: 380,
      freqEnd: 1500,
      decay: 0.32,
      vol: 0.35,
      vibrato: 0.04,
      vibratoRate: 14,
    },
    {
      wave: 'square',
      duty: 0.125,
      freq: 760,
      decay: 0.3,
      vol: 0.08,
      arp: [0, 7, 12, 19],
      arpRate: 0.06,
      delay: 0.04,
    },
  ],
  pickup: [
    {
      wave: 'square',
      duty: 0.5,
      freq: 988,
      decay: 0.08,
      sustain: 0.6,
      hold: 0.08,
      release: 0.08,
      vol: 0.22,
      arp: [0, 5],
      arpRate: 0.06,
    },
  ],
  weapon_up: [
    {
      wave: 'square',
      duty: 0.25,
      freq: 523,
      decay: 0.08,
      sustain: 0.7,
      hold: 0.24,
      release: 0.12,
      vol: 0.25,
      arp: [0, 4, 7, 12, 16, 19, 24],
      arpRate: 0.045,
    },
    { wave: 'triangle', freq: 262, decay: 0.3, vol: 0.3, arp: [0, 7, 12], arpRate: 0.09 },
  ],
  magnet_on: [
    {
      wave: 'saw',
      freq: 110,
      freqEnd: 330,
      decay: 0.35,
      vol: 0.28,
      vibrato: 0.15,
      vibratoRate: 10,
      lowpass: 900,
      lowpassEnd: 2500,
    },
  ],
  repulsor_on: [
    {
      wave: 'noise',
      freq: 0.25,
      freqEnd: 1,
      decay: 0.32,
      vol: 0.45,
      lowpass: 400,
      lowpassEnd: 7000,
    },
    { wave: 'square', duty: 0.25, freq: 700, freqEnd: 90, decay: 0.25, vol: 0.25, lowpass: 2500 },
  ],
  pod_rescue: [
    {
      wave: 'square',
      duty: 0.25,
      freq: 659,
      decay: 0.06,
      sustain: 0.7,
      hold: 0.26,
      release: 0.12,
      vol: 0.22,
      arp: [0, 3, 7, 12, 15],
      arpRate: 0.06,
    },
    {
      wave: 'triangle',
      freq: 1319,
      decay: 0.05,
      sustain: 0.6,
      hold: 0.2,
      release: 0.1,
      vol: 0.2,
      delay: 0.24,
    },
  ],
  boss_warning: [
    {
      wave: 'square',
      duty: 0.5,
      freq: 440,
      decay: 0.05,
      sustain: 0.9,
      hold: 1.3,
      release: 0.1,
      vol: 0.32,
      arp: [0, -5, 0, -5, 0, -5],
      arpRate: 0.24,
      lowpass: 2200,
      vibrato: 0.015,
      vibratoRate: 6,
    },
    {
      wave: 'saw',
      freq: 110,
      decay: 0.05,
      sustain: 0.9,
      hold: 1.3,
      release: 0.1,
      vol: 0.18,
      arp: [0, -5, 0, -5, 0, -5],
      arpRate: 0.24,
      lowpass: 800,
    },
  ],
  boss_die: [
    { wave: 'triangle', freq: 130, freqEnd: 20, decay: 1.6, vol: 1 },
    {
      wave: 'noise',
      freq: 1,
      freqEnd: 0.1,
      decay: 2.2,
      vol: 0.9,
      lowpass: 8000,
      lowpassEnd: 120,
    },
    {
      wave: 'noise',
      freq: 0.8,
      freqEnd: 0.2,
      decay: 0.3,
      vol: 0.6,
      lowpass: 5000,
      lowpassEnd: 400,
      delay: 0.15,
      repeat: 5,
      repeatRate: 0.22,
      repeatPitch: 0.9,
    },
    {
      wave: 'square',
      duty: 0.5,
      freq: 1200,
      freqEnd: 40,
      decay: 1.8,
      vol: 0.22,
      vibrato: 0.1,
      vibratoRate: 12,
      lowpass: 3000,
    },
  ],
  ui_move: [{ wave: 'square', duty: 0.25, freq: 660, decay: 0.035, vol: 0.12 }],
  ui_confirm: [
    {
      wave: 'square',
      duty: 0.5,
      freq: 784,
      decay: 0.05,
      sustain: 0.6,
      hold: 0.06,
      release: 0.06,
      vol: 0.18,
      arp: [0, 7],
      arpRate: 0.05,
    },
  ],
  ui_back: [
    {
      wave: 'square',
      duty: 0.5,
      freq: 587,
      decay: 0.05,
      sustain: 0.5,
      hold: 0.04,
      release: 0.05,
      vol: 0.15,
      arp: [0, -5],
      arpRate: 0.05,
    },
  ],
} satisfies Record<string, SfxPreset>;

export type SfxId = keyof typeof SFX;
export const SFX_IDS = Object.keys(SFX) as SfxId[];
