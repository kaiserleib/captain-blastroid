// Obstacles (T10, T23): asteroids, asteroid streams, indestructible anomalies
// (black-hole and pulsar variants, gravity-buoy fields) and tractor beams.
import { flags } from '../../debug/flags';
import type { System } from '../../sim/world';
import { registerAnomalyHooks, updateAnomalies } from './anomalySystem';
import { attachObstacles, tickAsteroidStreams, updateAsteroids } from './asteroidSystem';
import { registerHazardIIHooks, updateHazardsII } from './hazards2';
import { installObstacleSandbox, runObstacleSandbox } from './sandbox';
import { sweepTows } from './tractor';
import './obstacles.sprites';
import './hazards2/hazards2.sprites';

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

// Act II hazards (T33)
export {
  cancelFlare,
  flareProgress,
  flarePhase,
  flareState,
  hazardLog,
  isFlareBurning,
  setFlareImmune,
  shadeReachable,
  startFlare,
  startFlares,
  stopFlares,
  type FlareOptions,
  type FlaresOptions,
} from './hazards2/flare';
export {
  forEachStrip,
  inShade,
  nearestShadeSpot,
  registerShadeCaster,
  removeShadeSlab,
  shadeSlabs,
  slabSolidQuery,
  spawnShadeSlab,
  unregisterShadeCaster,
  type ShadeSpot,
  type SlabOptions,
  type Strip,
} from './hazards2/shade';
export {
  collapsePortalPair,
  partnerOf,
  portalOptIn,
  portalPairs,
  setPortalEnd,
  sinceShipPorted,
  spawnPortalPair,
  swapPortals,
  type PortalPairOptions,
} from './hazards2/portals';
export {
  bubbleScale,
  bubbleTimeScale,
  bubbles,
  flipFlickering,
  flipIsSlow,
  removeBubble,
  spawnBubble,
  type BubbleOptions,
} from './hazards2/bubbles';
export { clearHazardsII, registerHazardIIHooks, updateHazardsII } from './hazards2';
export type {
  Bubble,
  FlarePhase,
  FlareState,
  PortalEnd,
  PortalPair,
  ShadeSlab,
} from './hazards2/state';

registerAnomalyHooks();
registerHazardIIHooks();
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
    updateHazardsII(w, dt);
  },
};
