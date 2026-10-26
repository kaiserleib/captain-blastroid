import { getMixer, isRunning, type Mixer } from './audio';
import { VoiceLimiter, xToPan } from './limiter';
import {
  presetDuration,
  SFX,
  SFX_LIMITS,
  voiceLength,
  type SfxPreset,
  type SfxVoice,
} from './presets';
import { pulseWave } from './waves';

const limiter = new VoiceLimiter();
const durations = new Map<string, number>();
for (const [id, p] of Object.entries(SFX)) durations.set(id, presetDuration(p));
const warned = new Set<string>();

// Keeps hard-panned sounds from vanishing out of one earbud.
const PAN_WIDTH = 0.7;

export interface PlayOpts {
  /** −1 (left) .. 1 (right). */
  pan?: number;
}

function scheduleVoice(m: Mixer, v: SfxVoice, start: number, pitchMul: number, out: AudioNode) {
  const { ctx } = m;
  const attack = Math.max(v.attack ?? 0, 0.001);
  const hold = v.hold ?? 0;
  const len = voiceLength(v);
  const end = start + len;
  const f0 = v.freq * pitchMul;

  let src: OscillatorNode | AudioBufferSourceNode;
  let pitch: AudioParam;
  if (v.wave === 'noise') {
    const n = ctx.createBufferSource();
    n.buffer = m.noise;
    n.loop = true;
    pitch = n.playbackRate;
    src = n;
  } else {
    const o = ctx.createOscillator();
    if (v.wave === 'square') o.setPeriodicWave(pulseWave(ctx, v.duty ?? 0.5));
    else o.type = v.wave === 'saw' ? 'sawtooth' : v.wave;
    pitch = o.frequency;
    src = o;
  }

  pitch.setValueAtTime(f0, start);
  if (v.freqEnd !== undefined) {
    pitch.exponentialRampToValueAtTime(v.freqEnd * pitchMul, start + (v.slide ?? len));
  } else if (v.arp) {
    const rate = v.arpRate ?? 0.05;
    for (let i = 1; i < v.arp.length; i++) {
      pitch.setValueAtTime(f0 * Math.pow(2, v.arp[i]! / 12), start + i * rate);
    }
  }

  if (v.vibrato) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = v.vibratoRate ?? 8;
    const depth = ctx.createGain();
    depth.gain.value = f0 * v.vibrato;
    lfo.connect(depth).connect(pitch);
    lfo.start(start);
    lfo.stop(end + 0.02);
  }

  let node: AudioNode = src;
  if (v.highpass) {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = v.highpass;
    node = node.connect(hp);
  }
  if (v.lowpass) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(v.lowpass, start);
    if (v.lowpassEnd) lp.frequency.exponentialRampToValueAtTime(v.lowpassEnd, end);
    node = node.connect(lp);
  }

  const env = ctx.createGain();
  const g = env.gain;
  const peak = v.vol;
  const sus = Math.max(peak * (v.sustain ?? 0), 0.0001);
  g.setValueAtTime(0, start);
  g.linearRampToValueAtTime(peak, start + attack);
  // Exponential decay is what makes hits snap rather than fade.
  g.exponentialRampToValueAtTime(sus, start + attack + v.decay);
  g.setValueAtTime(sus, start + attack + v.decay + hold);
  g.linearRampToValueAtTime(0, end);
  node.connect(env).connect(out);

  if (src instanceof AudioBufferSourceNode) src.start(start, Math.random() * 0.9);
  else src.start(start);
  src.stop(end + 0.02);
  return src;
}

/**
 * Plays a preset by id. Returns false if audio isn't unlocked yet, the id is
 * unknown, or the voice limiter refused it (3 per id, 30 ms apart).
 */
export function play(id: string, opts?: PlayOpts): boolean {
  const m = getMixer();
  if (!m || !isRunning()) return false;
  const preset = (SFX as Record<string, SfxPreset>)[id];
  if (!preset) {
    if (import.meta.env.DEV && !warned.has(id)) {
      warned.add(id);
      console.warn(`audio: unknown sfx "${id}"`);
    }
    return false;
  }
  const { ctx } = m;
  const now = ctx.currentTime;
  const limits = (SFX_LIMITS as Record<string, { perId: number; minGap: number } | undefined>)[id];
  if (!limiter.tryStart(id, now, durations.get(id)!, limits)) return false;

  let out: AudioNode = m.sfx;
  let panner: StereoPannerNode | null = null;
  if (opts?.pan && typeof ctx.createStereoPanner === 'function') {
    panner = ctx.createStereoPanner();
    panner.pan.value = opts.pan * PAN_WIDTH;
    panner.connect(m.sfx);
    out = panner;
  }

  // A hair of lookahead so every layer of a preset lands on the same sample.
  const t0 = now + 0.005;
  let last: AudioScheduledSourceNode | null = null;
  let lastEnd = -1;
  for (const v of preset) {
    const reps = v.repeat ?? 1;
    for (let r = 0; r < reps; r++) {
      const start = t0 + (v.delay ?? 0) + r * (v.repeatRate ?? 0);
      const src = scheduleVoice(m, v, start, Math.pow(v.repeatPitch ?? 1, r), out);
      const end = start + voiceLength(v);
      if (end > lastEnd) {
        lastEnd = end;
        last = src;
      }
    }
  }
  if (panner && last) {
    const p = panner;
    last.onended = () => p.disconnect();
  }
  return true;
}

const scratch: PlayOpts = { pan: 0 };

/** Plays a world `sfx` event, panning by its playfield x. */
export function playAt(id: string, x?: number): boolean {
  if (x === undefined) return play(id);
  scratch.pan = xToPan(x);
  return play(id, scratch);
}

/** Live voices, for `?debug` and the audio dev page. */
export function activeVoices(id?: string): number {
  const m = getMixer();
  return m ? limiter.activeCount(m.ctx.currentTime, id) : 0;
}
