import './fx.sprites';

export { Fx, FX_OVERLAY_Z, FX_Z, boomSizeFor, type FxOptions } from './fxSystem';
export { BOOM_FRAMES, BOOM_SIZES, FX_SPRITE_IDS, boomSprite, type BoomSize } from './fx.sprites';
export { HITSTOP_MAX, HitstopGate, requestHitstop, setHitstopSink } from './hitstop';
export {
  PARTICLE_CAPACITY,
  PK,
  ParticlePool,
  RAMP,
  SPARK_SOFT_CAP,
  type ParticleKind,
  type RampId,
} from './particles';
export { SHAKE_MAX, Shake, shakeScale, type ShakeSetting } from './shake';
export { TOAST_MAX_VISIBLE, TOAST_TIME, Toasts } from './toasts';
export { installFxSandbox, type FxSandbox } from './sandbox';
