// Sector 7, The Warrens (T39): the wall turret, borer and cave bats, the
// chunk marks, cages, rock falls and den stop, and the Wyrm.
import { LEVEL, ROSTER, WYRM, WYRM_PART_DEFS } from '../../../content/levels/warrens';
import { spawnEnemy } from '../../../sim/spawn';
import { registerBoss } from '../../boss';
import { registerLevelLayer, registerLevelScript, registerLevelSystem } from '../../director';
import { registerBehavior, registerEnemyDraw, registerRoster } from '../../enemies';
import { ignoreTerrain, registerTurretSpawner } from '../../terrain';
import { bat, borer, turret } from './behaviors';
import { drawBorer, drawTurret, drawWyrm, rockfallLayer } from './draw';
import { installWarrensSandbox } from './sandbox';
import { markChunk, spawnBats, startRockfall, warrensSystem } from './scripts';
import { WR_SPRITE_IDS } from './warrens.sprites';
import { Wyrm } from './wyrm';

registerRoster(ROSTER);
// Turrets live in their sockets and borers tunnel; the terrain pass leaves both alone.
ignoreTerrain('wr_turret');
ignoreTerrain('wr_borer');

registerBehavior('warrens.turret', turret);
registerBehavior('warrens.borer', borer);
registerBehavior('warrens.bat', bat);
registerEnemyDraw('wr_turret', drawTurret);
registerEnemyDraw('wr_borer', drawBorer);

registerTurretSpawner('warrens', (w, x, y) => {
  spawnEnemy(w, 'wr_turret', x, y);
});

registerBoss(WYRM.id, {
  create: () => new Wyrm(),
  draw: drawWyrm,
  displayName: WYRM.name,
  parts: WYRM_PART_DEFS,
  spriteIds: WR_SPRITE_IDS,
});

registerLevelScript('warrens.mark', markChunk);
registerLevelScript('warrens.bats', spawnBats);
registerLevelScript('warrens.rockfall', startRockfall);
registerLevelSystem(LEVEL.id, warrensSystem);
registerLevelLayer(LEVEL.id, rockfallLayer);

installWarrensSandbox();

export { Motion, Wyrm } from './wyrm';
