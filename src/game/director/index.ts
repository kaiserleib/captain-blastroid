// Wave director (T15): runs a level's timeline and asteroid field, then the boss handoff and outro.
export {
  DEBUG_LOADOUT,
  OUTRO,
  directorSystem,
  directorTime,
  getDirector,
  startDirector,
  updateDirector,
  type DirectorOptions,
} from './director';
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
