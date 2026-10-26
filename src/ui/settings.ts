import type { ScreenShake } from '../meta';

export type SliderKey = 'music' | 'sfx' | 'stickOpacity' | 'stickRadiusScale';

export interface SliderDef {
  key: SliderKey;
  label: string;
  min: number;
  max: number;
  step: number;
}

// Volumes use 5% steps so music can sit well under the old 35% default.
export const SLIDERS: readonly SliderDef[] = [
  { key: 'music', label: 'MUSIC', min: 0, max: 1, step: 0.05 },
  { key: 'sfx', label: 'SFX', min: 0, max: 1, step: 0.05 },
  { key: 'stickOpacity', label: 'STICK ALPHA', min: 0.1, max: 1, step: 0.1 },
  { key: 'stickRadiusScale', label: 'STICK SIZE', min: 0.6, max: 1.6, step: 0.1 },
];

const SHAKES: readonly ScreenShake[] = ['off', 'low', 'full'];

/** Snaps to the slider's step grid and clamps; rounding keeps 0.35 + 0.05 from drifting. */
export function snapSetting(def: SliderDef, v: number): number {
  const n = Math.round((v - def.min) / def.step);
  const out = def.min + n * def.step;
  return Math.round(Math.min(def.max, Math.max(def.min, out)) * 100) / 100;
}

export function cycleShake(s: ScreenShake, dx: number): ScreenShake {
  const i = SHAKES.indexOf(s);
  return SHAKES[(i + dx + SHAKES.length) % SHAKES.length] as ScreenShake;
}
