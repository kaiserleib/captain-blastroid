// The Gauntlet (post-campaign): each round's opening beat raises the stakes and
// switches to the next boss's home music. The rounds themselves are content
// (content/levels/gauntlet); the bosses and their sector layers come from the
// sector folders through `LevelDef.hostLevels`.
import { getLevel } from '../../../content/levels';
import { setBossToughness } from '../../boss';
import { emitToast, registerLevelScript, type LevelScriptArgs } from '../../director';
import { setEnemyHpMul, setEnemyShotSpeedMul } from '../../enemies';
import type { World } from '../../../sim/world';

const songP = { id: '' };

function num(args: LevelScriptArgs, key: string, fallback: number): number {
  const v = args[key];
  return typeof v === 'number' ? v : fallback;
}

/** `{ script: 'gauntlet.round', args: { round, of, hp, shot, tough, home } }` */
export function roundScript(w: World, args: LevelScriptArgs): void {
  setEnemyHpMul(w, num(args, 'hp', 1));
  setEnemyShotSpeedMul(w, num(args, 'shot', 1));
  setBossToughness(w, num(args, 'tough', 1));
  const round = num(args, 'round', 1);
  const of = num(args, 'of', round);
  emitToast(w, round === of ? 'FINAL ROUND' : `ROUND ${round} OF ${of}`);
  const home = args.home;
  if (typeof home === 'string') {
    songP.id = getLevel(home).music;
    w.events.emit('songRequested', songP);
  }
}

registerLevelScript('gauntlet.round', roundScript);
