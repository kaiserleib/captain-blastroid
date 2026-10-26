// Obstacles (T10, T23): asteroids, asteroid streams, indestructible anomalies
// (black-hole and pulsar variants, gravity-buoy fields) and tractor beams.
import { flags } from '../../debug/flags';
import type { System } from '../../sim/world';
import { registerAnomalyHooks, updateAnomalies } from './anomalySystem';
import { attachObstacles, tickAsteroidStreams, updateAsteroids } from './asteroidSystem';
import { installObstacleSandbox, runObstacleSandbox } from './sandbox';
import { sweepTows } from './tractor';
import './obstacles.sprites';

export {
  AsteroidStream,
  activeAsteroidStreams,
  asteroidLayer,
  asteroidTheme,
  attachObstacles,
  breakAsteroid,
  spawnAsteroidStream,
  spawnRock,
  stopAllAsteroidStreams,
  type AsteroidStreamConfig,
  type RockInit,
} from './asteroidSystem';
export { anomalyLayer, collapseAnomaly, isCollapsing, registerAnomalyHooks } from './anomalySystem';
export {
  spawnBlackHole,
  spawnFieldOnly,
  type AnomalyPlacement,
  type FieldOnlyOptions,
} from './anomalies/blackhole';
export {
  inPulsarGap,
  pulsarEchoRadius,
  pulsarGapAngles,
  pulsarGapWidth,
  pulsarGlow,
  pulsarRingRadius,
  pulseIndex,
  setPulsarPattern,
  spawnPulsar,
  type PulsarPattern,
} from './anomalies/pulsar';
export { anomalyVariant, isFieldOnly } from './anomalies/state';
export { drawTractorBeam, flingRock, isTowed, releaseRock, towRock } from './tractor';
export { rockIdsForTheme } from './obstacles.sprites';

registerAnomalyHooks();
installObstacleSandbox();

/**
 * Slot: after `bullets`, before `pickups`/`collision`. Streams spawn, anomaly
 * forces act on this tick's velocities, then rocks and anomalies move.
 */
export const obstaclesSystem: System = {
  name: 'obstacles',
  update(w, dt) {
    attachObstacles(w);
    if (flags.sandbox) runObstacleSandbox(w);
    sweepTows(w);
    tickAsteroidStreams(w, dt);
    updateAnomalies(w, dt);
    updateAsteroids(w, dt);
  },
};
