import type { Scene, SceneManager } from '../engine/scene';
import { GameScene } from './GameScene';

/** Goes straight to the game for now; T17 routes it through save loading and the title screen. */
export class BootScene implements Scene {
  constructor(private readonly scenes: SceneManager) {}

  enter(): void {}
  exit(): void {}

  // Switch on the first update rather than inside enter(), so replace() isn't re-entered.
  update(): void {
    this.scenes.replace(new GameScene());
  }

  render(): void {}
}
