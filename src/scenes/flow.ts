// Scene routing for the out-of-run loop. Scenes call these instead of importing each
// other, and main.ts hands over the SceneManager once at boot.
import type { SceneManager } from '../engine/scene';
import type { RunState } from '../sim/world';
import { GameScene, type GameSceneData } from './GameScene';
import { HangarScene } from './HangarScene';
import { PauseOverlay } from './PauseOverlay';
import { PilotSelectScene } from './PilotSelectScene';
import { RecordsScene } from './RecordsScene';
import { ResultsScene } from './ResultsScene';
import { SettingsOverlay } from './SettingsOverlay';
import { ShipSelectScene } from './ShipSelectScene';
import { TitleScene } from './TitleScene';
import { UpgradesScene } from './UpgradesScene';

export interface ResultsData {
  run: RunState;
  /** Seconds survived. */
  time: number;
  victory: boolean;
  abandoned: boolean;
}

let sm: SceneManager | null = null;

export function initFlow(scenes: SceneManager): void {
  sm = scenes;
}

function scenes(): SceneManager {
  if (!sm) throw new Error('initFlow() has not been called');
  return sm;
}

export const flow = {
  title: (): void => scenes().replace(new TitleScene()),
  hangar: (focus?: string): void => scenes().replace(new HangarScene(), focus),
  pilots: (): void => scenes().replace(new PilotSelectScene()),
  ships: (): void => scenes().replace(new ShipSelectScene()),
  upgrades: (): void => scenes().replace(new UpgradesScene()),
  records: (): void => scenes().replace(new RecordsScene()),
  launch: (data: GameSceneData): void => scenes().replace(new GameScene(), data),
  results: (data: ResultsData): void => scenes().replace(new ResultsScene(), data),
  /** Overlays push over the current scene, which keeps rendering underneath, frozen. */
  pause: (game: GameScene): void => scenes().push(new PauseOverlay(), game),
  /** `transfer` adds save export/import, which only makes sense outside a run. */
  settings: (transfer = false): void => scenes().push(new SettingsOverlay(), { transfer }),
  closeOverlay: (): void => scenes().pop(),
};
