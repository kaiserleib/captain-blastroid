export type Bus = 'master' | 'sfx' | 'music';

export interface Mixer {
  ctx: AudioContext;
  master: GainNode;
  sfx: GainNode;
  music: GainNode;
  /** 1 s of white noise, shared by every noise voice. */
  noise: AudioBuffer;
}

const volumes: Record<Bus, number> = { master: 0.9, sfx: 1, music: 0.35 };
let muted = false;
// Game pause only silences the music bus (UI sounds keep playing on the pause
// menu); page visibility suspends the whole context. Tracked separately so one
// can't undo the other.
let gamePaused = false;
let hidden = false;
let mixer: Mixer | null = null;
const readyListeners: (() => void)[] = [];

type Ctor = typeof AudioContext;

function audioCtor(): Ctor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function createMixer(ctx: AudioContext): Mixer {
  // A fast, gentle compressor so stacked explosions duck instead of clipping.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 8;
  comp.ratio.value = 6;
  comp.attack.value = 0.002;
  comp.release.value = 0.12;
  comp.connect(ctx.destination);

  const master = ctx.createGain();
  master.connect(comp);
  const sfx = ctx.createGain();
  sfx.connect(master);
  const music = ctx.createGain();
  music.connect(master);

  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  // Audio isn't part of the seeded sim, so Math.random is fine here.
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const m = { ctx, master, sfx, music, noise };
  applyGains(m);
  return m;
}

/**
 * Slider position (0..1) → gain. Loudness is roughly logarithmic in gain, so a
 * linear slider crams all its audible change into the top few steps; squaring
 * spreads it out (0.5 ≈ −12 dB, 0.35 ≈ −18 dB).
 */
export function perceptualGain(v: number): number {
  return v * v;
}

function applyGains(m: Mixer): void {
  const t = m.ctx.currentTime;
  m.master.gain.setTargetAtTime(muted ? 0 : volumes.master, t, 0.015);
  m.sfx.gain.setTargetAtTime(perceptualGain(volumes.sfx), t, 0.015);
  m.music.gain.setTargetAtTime(gamePaused ? 0 : perceptualGain(volumes.music), t, 0.03);
}

/**
 * The mixer, or null until `unlock()` has run inside a user gesture. Callers
 * treat null as "drop this sound": creating a context earlier logs autoplay
 * warnings and on iOS yields a context that never starts.
 */
export function getMixer(): Mixer | null {
  return mixer;
}

/** True once the context exists and is actually producing sound. */
export function isRunning(): boolean {
  return mixer !== null && mixer.ctx.state === 'running' && !hidden;
}

/** Runs `fn` each time the context starts running (first unlock and every resume). */
export function onAudioReady(fn: () => void): void {
  readyListeners.push(fn);
}

function notifyReady(): void {
  for (const fn of readyListeners) fn();
}

/** Call from a user gesture. Safe to call repeatedly. */
export function unlock(): void {
  if (!mixer) {
    const Ctor = audioCtor();
    if (!Ctor) return;
    mixer = createMixer(new Ctor({ latencyHint: 'interactive' }));
    mixer.ctx.addEventListener('statechange', () => {
      if (mixer?.ctx.state === 'running') notifyReady();
    });
  }
  const { ctx } = mixer;
  if (hidden) return;
  if (ctx.state !== 'running') void ctx.resume().catch(() => {});
  // iOS only un-mutes Web Audio after a buffer has been started inside a gesture.
  const src = ctx.createBufferSource();
  src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  src.connect(ctx.destination);
  src.start(0);
}

function syncContext(): void {
  if (!mixer) return;
  const { ctx } = mixer;
  if (hidden) {
    if (ctx.state === 'running') void ctx.suspend().catch(() => {});
  } else if (ctx.state !== 'running') {
    // iOS can leave the context "interrupted" after a call or backgrounding.
    void ctx.resume().catch(() => {});
  }
}

/** Game pause: mutes the music bus (music.ts also holds the song in place). SFX stay live. */
export function suspend(): void {
  gamePaused = true;
  if (mixer) applyGains(mixer);
}

export function resume(): void {
  gamePaused = false;
  if (mixer) applyGains(mixer);
}

export function isGamePaused(): boolean {
  return gamePaused;
}

function setHidden(h: boolean): void {
  hidden = h;
  syncContext();
}

export function setMuted(m: boolean): void {
  muted = m;
  if (mixer) applyGains(mixer);
}

export function isMuted(): boolean {
  return muted;
}

export function setVolume(bus: Bus, v: number): void {
  volumes[bus] = v < 0 ? 0 : v > 1 ? 1 : v;
  if (mixer) applyGains(mixer);
}

export function getVolume(bus: Bus): number {
  return volumes[bus];
}

let installed = false;

/**
 * Wires the gesture unlock and page lifecycle. Listens to several gesture
 * events because iOS Safari only counts some of them (touchend, pointerup) as
 * user activation for audio; stays subscribed until the context is running.
 */
export function installAudio(target: EventTarget = window): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  const gestures = ['pointerdown', 'pointerup', 'touchend', 'keydown'];
  const onGesture = (): void => {
    unlock();
    if (mixer?.ctx.state === 'running') {
      for (const g of gestures) target.removeEventListener(g, onGesture, true);
    }
  };
  for (const g of gestures) target.addEventListener(g, onGesture, { capture: true, passive: true });

  const sync = (): void => setHidden(document.visibilityState === 'hidden');
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', () => setHidden(true));
  window.addEventListener('pageshow', sync);
}
