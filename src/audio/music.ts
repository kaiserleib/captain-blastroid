import { getMixer, onAudioReady, type Mixer } from './audio';
import { DRUMS, midiToFreq } from './notes';
import {
  advanceCursor,
  CHANNELS,
  compileSong,
  type CompiledSong,
  type Instrument,
  scheduleWindow,
  type MelodicChannel,
  type SongCursor,
} from './song';
import { SONGS } from './songs';
import { pulseWave } from './waves';

/** How far ahead of the audio clock notes are scheduled, and how often the timer wakes. */
const LOOKAHEAD = 0.12;
const TIMER_MS = 25;
/** Gap at the end of each note so repeated notes re-articulate. */
const NOTE_GAP = 0.006;
const VIBRATO_RATE = 5.5;

const compiled = new Map<string, CompiledSong>();
function song(id: string): CompiledSong | null {
  let c = compiled.get(id);
  if (!c) {
    const def = SONGS[id];
    if (!def) return null;
    c = compileSong(def);
    compiled.set(id, c);
  }
  return c;
}

interface Voice {
  osc: OscillatorNode;
  env: GainNode;
  vib: GainNode;
  inst: Instrument;
}

/** One running song: persistent channel oscillators fed by automation, like a sound chip. */
class Playback {
  readonly out: GainNode;
  private readonly voices: Record<MelodicChannel, Voice>;
  private readonly drums: GainNode;
  private readonly lfo: OscillatorNode;
  private readonly cursor: SongCursor = { entry: 0, step: 0, done: false };
  private nextTime: number;
  stopAt = Infinity;

  constructor(
    private readonly m: Mixer,
    readonly song: CompiledSong,
    start: number,
    gain: number,
  ) {
    const { ctx } = m;
    this.out = ctx.createGain();
    this.out.gain.value = gain;
    this.out.connect(m.music);
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = VIBRATO_RATE;
    this.lfo.start(start);
    const def = song.def;
    this.voices = {
      p1: this.voice(def.p1, 'pulse', start),
      p2: this.voice(def.p2, 'pulse', start),
      tri: this.voice(def.tri, 'triangle', start),
    };
    this.drums = ctx.createGain();
    this.drums.gain.value = def.drums;
    this.drums.connect(this.out);
    this.nextTime = start;
  }

  private voice(inst: Instrument, kind: 'pulse' | 'triangle', start: number): Voice {
    const { ctx } = this.m;
    const osc = ctx.createOscillator();
    if (kind === 'pulse') osc.setPeriodicWave(pulseWave(ctx, inst.duty ?? 0.5));
    else osc.type = 'triangle';
    const env = ctx.createGain();
    env.gain.value = 0;
    const vib = ctx.createGain();
    vib.gain.value = 0;
    this.lfo.connect(vib).connect(osc.detune);
    osc.connect(env).connect(this.out);
    osc.start(start);
    return { osc, env, vib, inst };
  }

  // Bound once so the 25 ms pump doesn't allocate closures.
  private readonly skipStep = (): boolean => {
    if (this.cursor.done) return false;
    advanceCursor(this.song, this.cursor);
    return true;
  };

  private readonly playStep = (t: number): boolean => {
    if (this.cursor.done) return false;
    this.step(t);
    advanceCursor(this.song, this.cursor);
    return true;
  };

  /**
   * Continues the song from its cursor at `t`, dropping whatever was already
   * scheduled past now. Used when un-pausing: the clock kept running, the song
   * didn't.
   */
  rebase(now: number, t: number): void {
    this.nextTime = t;
    for (const ch of CHANNELS) {
      const v = this.voices[ch];
      v.env.gain.cancelScheduledValues(now);
      v.env.gain.setValueAtTime(0, now);
      v.vib.gain.cancelScheduledValues(now);
      v.vib.gain.setValueAtTime(0, now);
    }
  }

  get finished(): boolean {
    return this.m.ctx.currentTime > this.stopAt;
  }

  /** Schedules every step that starts before `horizon`. */
  pump(now: number, horizon: number): void {
    const stepDur = this.song.stepDur;
    // If the timer stalled (throttled tab), skip the missed steps silently so
    // the song stays on its time grid instead of bunching notes up.
    this.nextTime = scheduleWindow(this.nextTime, stepDur, now - 0.01, this.skipStep);
    const until = Math.min(horizon, this.stopAt);
    this.nextTime = scheduleWindow(this.nextTime, stepDur, until, this.playStep);
    if (this.cursor.done && this.stopAt === Infinity) this.stop(this.nextTime + 1.2);
  }

  private step(t: number): void {
    const entry = this.song.entries[this.cursor.entry]!;
    const p = entry.pattern;
    const i = this.cursor.step;
    for (const ch of CHANNELS) {
      const track = p[ch];
      if (!track) continue;
      const note = track.notes[i]!;
      if (note < 0) continue;
      this.note(this.voices[ch], note + entry.transpose, t, track.lengths[i]! * this.song.stepDur);
    }
    const hit = p.noise?.[i] ?? -1;
    if (hit >= 0) this.drum(hit, t);
  }

  private note(v: Voice, midi: number, t: number, dur: number): void {
    const { inst } = v;
    const end = t + dur - NOTE_GAP;
    const a = Math.min(inst.attack, dur * 0.25);
    const r = Math.min(inst.release, dur * 0.3);
    const decEnd = Math.min(t + a + inst.decay, end - r);
    const sus = inst.vol * inst.sustain;
    v.osc.frequency.setValueAtTime(midiToFreq(midi), t);
    const g = v.env.gain;
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(inst.vol, t + a);
    g.linearRampToValueAtTime(sus, decEnd);
    g.setValueAtTime(sus, end - r);
    g.linearRampToValueAtTime(0, end);

    // Delayed vibrato on held notes is the SNES-lead sound.
    const vg = v.vib.gain;
    vg.setValueAtTime(0, t);
    const vd = inst.vibratoDelay ?? 0.25;
    if (inst.vibrato && dur > vd + 0.1) {
      vg.setValueAtTime(0, t + vd);
      vg.linearRampToValueAtTime(inst.vibrato, Math.min(t + vd + 0.15, end));
    }
  }

  private drum(kind: number, t: number): void {
    const { ctx, noise } = this.m;
    const tone = (type: OscillatorType, f0: number, f1: number, vol: number, len: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + len * 0.7);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + len);
      o.connect(g).connect(this.drums);
      o.start(t);
      o.stop(t + len + 0.02);
    };
    const hiss = (filter: BiquadFilterType, freq: number, vol: number, len: number) => {
      const n = ctx.createBufferSource();
      n.buffer = noise;
      n.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = filter;
      f.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0005, t + len);
      n.connect(f).connect(g).connect(this.drums);
      n.start(t, Math.random() * 0.9);
      n.stop(t + len + 0.02);
    };
    switch (kind) {
      case DRUMS.k:
        tone('sine', 170, 42, 1, 0.2);
        hiss('lowpass', 2500, 0.25, 0.02);
        break;
      case DRUMS.s:
        tone('triangle', 240, 140, 0.5, 0.08);
        hiss('highpass', 1200, 0.55, 0.16);
        break;
      case DRUMS.h:
        hiss('highpass', 7500, 0.3, 0.035);
        break;
      case DRUMS.o:
        hiss('highpass', 6500, 0.28, 0.2);
        break;
      case DRUMS.c:
        hiss('highpass', 3500, 0.45, 1.1);
        hiss('bandpass', 9000, 0.2, 0.6);
        break;
      case DRUMS.t:
        tone('triangle', 260, 90, 0.8, 0.18);
        break;
    }
  }

  stop(at: number, fade = 0.03): void {
    if (at >= this.stopAt) return;
    const g = this.out.gain;
    const now = this.m.ctx.currentTime;
    const from = Math.max(at - fade, now);
    g.cancelScheduledValues(from);
    g.setValueAtTime(g.value, from);
    g.linearRampToValueAtTime(0, at);
    this.stopAt = at;
    for (const ch of CHANNELS) this.voices[ch].osc.stop(at + 0.05);
    this.lfo.stop(at + 0.05);
  }

  fadeIn(seconds: number): void {
    const g = this.out.gain;
    const now = this.m.ctx.currentTime;
    g.setValueAtTime(0, now);
    g.linearRampToValueAtTime(1, now + seconds);
  }

  dispose(): void {
    this.out.disconnect();
  }
}

let current: Playback | null = null;
const fading: Playback[] = [];
let pending: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let paused = false;

function pumpAll(): void {
  timer = null;
  const m = getMixer();
  if (!m || paused) return;
  const now = m.ctx.currentTime;
  const horizon = now + LOOKAHEAD;
  if (current) {
    current.pump(now, horizon);
    if (current.finished) {
      current.dispose();
      current = null;
    }
  }
  for (let i = fading.length - 1; i >= 0; i--) {
    const pb = fading[i]!;
    pb.pump(now, horizon);
    if (pb.finished) {
      pb.dispose();
      fading.splice(i, 1);
    }
  }
  if (current || fading.length > 0) timer = setTimeout(pumpAll, TIMER_MS);
}

function ensureTimer(): void {
  if (timer === null) pumpAll();
}

function begin(id: string, fadeSeconds: number): void {
  const m = getMixer();
  const s = song(id);
  if (!s) {
    if (import.meta.env.DEV) console.warn(`audio: unknown song "${id}"`);
    return;
  }
  if (!m || m.ctx.state !== 'running') {
    // Not unlocked yet: remember the request and start on unlock.
    pending = id;
    return;
  }
  pending = null;
  const start = m.ctx.currentTime + 0.05;
  current = new Playback(m, s, start, fadeSeconds > 0 ? 0 : 1);
  if (fadeSeconds > 0) current.fadeIn(fadeSeconds);
  ensureTimer();
}

function retire(fadeSeconds: number): void {
  if (!current) return;
  const m = getMixer()!;
  current.stop(m.ctx.currentTime + Math.max(fadeSeconds, 0.03), Math.max(fadeSeconds, 0.03));
  fading.push(current);
  current = null;
  ensureTimer();
}

/** Starts a song immediately. A no-op if that song is already playing. */
export function playSong(id: string): void {
  if (current?.song.def.id === id && current.stopAt === Infinity) return;
  pending = null;
  retire(0.03);
  begin(id, 0);
}

/** Crossfades from whatever is playing to `id` over `seconds`. */
export function fadeTo(id: string, seconds: number): void {
  if (current?.song.def.id === id && current.stopAt === Infinity) return;
  pending = null;
  retire(seconds);
  begin(id, seconds);
}

export function stop(fadeSeconds = 0.03): void {
  pending = null;
  retire(fadeSeconds);
}

/**
 * Game pause: stops scheduling so the song holds its place; the mixer mutes
 * the music bus meanwhile. Resuming re-anchors the song at the current time.
 */
export function setPaused(p: boolean): void {
  if (p === paused) return;
  paused = p;
  if (p) return;
  const m = getMixer();
  if (m && current) {
    const now = m.ctx.currentTime;
    current.rebase(now, now + 0.06);
  }
  if (current || fading.length > 0) ensureTimer();
}

export function currentSong(): string | null {
  return current && current.stopAt === Infinity ? current.song.def.id : pending;
}

onAudioReady(() => {
  if (pending && !current) begin(pending, 0);
  // The timer may have idled while the context was suspended.
  if (current || fading.length > 0) ensureTimer();
});
