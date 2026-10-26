import type { Display } from '../engine/display';
import { InputManager } from './input';
import { bindDom, displayMapper } from './pointer';

export { InputManager, type InputMode, type UiEvent } from './input';
export {
  DEFAULT_INPUT_SETTINGS,
  getInputSettings,
  setInputSettingsProvider,
  type InputSettings,
} from './settings';
export type { StickState } from './stick';

/** The app's single input manager. GameScene registers `input.system` and `input.stickLayer`. */
export const input = new InputManager();

/** Called once from main.ts. Returns a detach function. */
export function attachInput(display: Display): () => void {
  input.setMapper(displayMapper(display));
  return bindDom(display.canvas, input);
}
