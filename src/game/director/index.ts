// Wave director (T15): runs a level's timeline and asteroid field, then the boss handoff and outro.
export {
  DEBUG_LOADOUT,
  NO_SCHEMATIC_SALVAGE_MUL,
  OUTRO,
  SUPPLY_DROP,
  directorSystem,
  directorTime,
  getDirector,
  startDirector,
  updateDirector,
  type DirectorOptions,
} from './director';
export { emitToast } from './events';
export {
  levelLayers,
  levelSystems,
  registerLevelLayer,
  registerLevelScript,
  registerLevelSystem,
  runLevelScript,
  type LevelScript,
  type LevelScriptArgs,
} from './registry';
export type { DirectorPhase, DirectorState } from './state';
export {
  buildSchedule,
  eventKind,
  fieldRate,
  pickSchematic,
  resolveX,
  segmentRate,
  type ScheduledFire,
} from './timeline';
