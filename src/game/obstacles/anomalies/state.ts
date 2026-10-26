// Per-anomaly data that doesn't fit the Anomaly contract (variants, pulse
// clock, gap pattern, collapse). Pool slots are permanent objects, so each
// slot gets one record, reset whenever it holds a new entity id.
import {
  BLACK_HOLE_VARIANTS,
  DEFAULT_BLACK_HOLE_VARIANT,
  DEFAULT_PULSAR_VARIANT,
  PULSAR_FIRST_GAP_DEG,
  PULSAR_VARIANTS,
  type BlackHoleVariantId,
  type PulsarVariantId,
} from '../../../content/obstacles';
import type { Anomaly } from '../../../sim/types';

export const DEG = Math.PI / 180;

export interface AnomalyExt {
  id: number;
  variant: string;
  // Black holes
  playerPull: number;
  /** Gravity buoy: no core, no absorb, no contact damage, not drawn. */
  fieldOnly: boolean;
  // Collapse (0 = not collapsing)
  collapseDur: number;
  collapseT: number;
  baseR: number;
  baseRadius: number;
  basePull: number;
  // Pulsars
  period: number;
  telegraph: number;
  gaps: number;
  /** Gap width, radians. */
  gapW: number;
  /** Pattern turn per pulse, radians. */
  gapSpin: number;
  double: boolean;
  /** Seconds since the latest pulse (or since the clock started, before the first). */
  clock: number;
  /** Pulses fired so far. */
  pulse: number;
  /** Gap rotation of the live ring, and of the next one (shown by the telegraph). */
  ringRot: number;
  nextRot: number;
  /** Pulse index each ring last hit the player on. */
  hitPulse: number;
  hitPulse2: number;
}

const table = new WeakMap<Anomaly, AnomalyExt>();

function blank(): AnomalyExt {
  return {
    id: -1,
    variant: '',
    playerPull: 0,
    fieldOnly: false,
    collapseDur: 0,
    collapseT: 0,
    baseR: 0,
    baseRadius: 0,
    basePull: 0,
    period: 1,
    telegraph: 0,
    gaps: 0,
    gapW: 0,
    gapSpin: 0,
    double: false,
    clock: 0,
    pulse: 0,
    ringRot: 0,
    nextRot: 0,
    hitPulse: 0,
    hitPulse2: 0,
  };
}

const own = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

export function blackHoleVariantId(id: string | undefined): BlackHoleVariantId {
  return id !== undefined && own(BLACK_HOLE_VARIANTS, id)
    ? (id as BlackHoleVariantId)
    : DEFAULT_BLACK_HOLE_VARIANT;
}

export function pulsarVariantId(id: string | undefined): PulsarVariantId {
  return id !== undefined && own(PULSAR_VARIANTS, id)
    ? (id as PulsarVariantId)
    : DEFAULT_PULSAR_VARIANT;
}

/** Fills `e` with a variant's defaults. Anomalies spawned without our helpers get the default variant. */
export function initExt(e: AnomalyExt, a: Anomaly, variant: string | undefined): void {
  e.id = a.id;
  e.fieldOnly = false;
  e.collapseDur = 0;
  e.collapseT = 0;
  e.clock = 0;
  e.pulse = 0;
  e.hitPulse = 0;
  e.hitPulse2 = 0;
  e.double = false;
  if (a.kind === 'blackhole') {
    const id = blackHoleVariantId(variant);
    e.variant = id;
    e.playerPull = BLACK_HOLE_VARIANTS[id].playerPull;
  } else {
    const id = pulsarVariantId(variant);
    const v = PULSAR_VARIANTS[id];
    e.variant = id;
    e.playerPull = 0;
    e.period = v.period;
    e.telegraph = v.telegraph;
    e.gaps = v.gaps;
    e.gapW = v.gapDeg * DEG;
    e.gapSpin = v.gapSpin * DEG;
    e.ringRot = PULSAR_FIRST_GAP_DEG * DEG;
    e.nextRot = e.ringRot;
  }
}

export function ext(a: Anomaly): AnomalyExt {
  let e = table.get(a);
  if (e === undefined) {
    e = blank();
    table.set(a, e);
  }
  if (e.id !== a.id) initExt(e, a, undefined);
  return e;
}

/** The variant id the anomaly was spawned with. */
export function anomalyVariant(a: Anomaly): string {
  return ext(a).variant;
}

/** True for gravity-buoy fields (spawnFieldOnly). */
export function isFieldOnly(a: Anomaly): boolean {
  return a.kind === 'blackhole' && ext(a).fieldOnly;
}
