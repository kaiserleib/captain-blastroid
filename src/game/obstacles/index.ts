// Obstacles (T10): asteroids, asteroid streams, and indestructible anomalies.
import { flags } from '../../debug/flags';
import type { System } from '../../sim/world';
import { registerAnomalyHooks, updateAnomalies } from './anomalySystem';
import { attachObstacles, tickAsteroidStreams, updateAsteroids } from './asteroidSystem';
import { installObstacleSandbox, runObstacleSandbox } from './sandbox';
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
export { anomalyLayer, registerAnomalyHooks } from './anomalySystem';
export { spawnBlackHole, type AnomalyPlacement } from './anomalies/blackhole';
export { pulsarGlow, pulsarRingRadius, spawnPulsar } from './anomalies/pulsar';
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
    tickAsteroidStreams(w, dt);
    updateAnomalies(w, dt);
    updateAsteroids(w, dt);
  },
};
