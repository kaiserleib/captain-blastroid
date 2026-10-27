// The Kestrel lives in gfx's reference set; the game must register it too.
import '../../gfx/reference.sprites';
import './ships.sprites';

export { blinkVisible, playerLayer, warmPlayerSprites } from './playerDraw';
export {
  getPlayerRuntime,
  initPlayer,
  playerPastPos,
  isGodMode,
  playerSystem,
  setGodMode,
  toggleGodMode,
  updatePlayer,
} from './playerSystem';
export { installPlayerSandbox } from './sandbox';
export { HISTORY_SECONDS } from './history';
