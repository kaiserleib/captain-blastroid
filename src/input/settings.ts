export interface InputSettings {
  /** 0..1 */
  stickOpacity: number;
  /** Multiplies the 40 CSS px full-deflection radius. */
  stickRadiusScale: number;
}

export const DEFAULT_INPUT_SETTINGS: Readonly<InputSettings> = Object.freeze({
  stickOpacity: 0.5,
  stickRadiusScale: 1.0,
});

let provider: () => Readonly<InputSettings> = () => DEFAULT_INPUT_SETTINGS;

/** Read on every use rather than cached, so a settings change applies mid-run. */
export function getInputSettings(): Readonly<InputSettings> {
  return provider();
}

/** T05/T17 point this at the saved settings. */
export function setInputSettingsProvider(fn: () => Readonly<InputSettings>): void {
  provider = fn;
}
