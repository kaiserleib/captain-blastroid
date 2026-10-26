const HARMONICS = 48;
const cache = new WeakMap<BaseAudioContext, Map<number, PeriodicWave>>();

/** Pulse-wave Fourier coefficients for duty `d`: aₙ = 2·sin(πnd)/(πn). Pure, so it's testable. */
export function pulseCoefficients(duty: number, harmonics = HARMONICS): Float32Array {
  const real = new Float32Array(harmonics + 1);
  for (let n = 1; n <= harmonics; n++) real[n] = (2 * Math.sin(Math.PI * n * duty)) / (Math.PI * n);
  return real;
}

/** NES-style pulse wave (12.5 %, 25 %, 50 % duty), cached per context. */
export function pulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  let byDuty = cache.get(ctx);
  if (!byDuty) {
    byDuty = new Map();
    cache.set(ctx, byDuty);
  }
  let w = byDuty.get(duty);
  if (!w) {
    const real = pulseCoefficients(duty);
    w = ctx.createPeriodicWave(real, new Float32Array(real.length));
    byDuty.set(duty, w);
  }
  return w;
}
