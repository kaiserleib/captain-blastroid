import { PULSAR } from '../../content/obstacles';
import type { Renderer } from '../../gfx/renderer';
import { registerAnomalyContact } from '../../sim/hooks';
import type { Anomaly } from '../../sim/types';
import type { DrawLayer, World } from '../../sim/world';
import { blackHoleContact, updateBlackHole } from './anomalies/blackhole';
import { pulsarContact, pulsarGlow, pulsarRingRadius, updatePulsar } from './anomalies/pulsar';
import {
  ACCRETION,
  BLACKHOLE_FRAMES,
  PULSAR_GLOW_FRAMES,
  PULSAR_IDLE_FRAMES,
  PULSAR_RAMP,
} from './obstacles.sprites';

/** Registers player-contact handlers with T03's collision hook. Safe to call again. */
export function registerAnomalyHooks(): void {
  registerAnomalyContact('blackhole', blackHoleContact);
  registerAnomalyContact('pulsar', pulsarContact);
}

/** Ages, moves and runs every anomaly's effect. Anomalies are indestructible. */
export function updateAnomalies(w: World, dt: number): void {
  const items = w.anomalies.items;
  const n = w.anomalies.count;
  for (let i = 0; i < n; i++) {
    const a = items[i] as Anomaly;
    if (!a.active) continue;
    a.t += dt;
    a.prevX = a.x;
    a.prevY = a.y;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    if (a.kind === 'blackhole') updateBlackHole(w, a, dt);
    else updatePulsar(w, a, dt);
  }
}

const FIELD_DOTS = 40;
const DOT_STEP = (Math.PI * 2) / FIELD_DOTS;
const spriteOpts = { frame: 0 };

/** Dotted circle at the edge of the pull field, slowly turning inward-bound. */
function drawField(r: Renderer, x: number, y: number, radius: number, t: number): void {
  const spin = -t * 0.35;
  for (let i = 0; i < FIELD_DOTS; i++) {
    const ang = i * DOT_STEP + spin;
    const color = i % 4 === 0 ? (ACCRETION[3] as string) : (ACCRETION[2] as string);
    r.rect(x + Math.cos(ang) * radius, y + Math.sin(ang) * radius, 1, 1, color);
  }
}

function drawPulsarRing(r: Renderer, a: Anomaly, x: number, y: number): void {
  const R = pulsarRingRadius(a);
  if (R < 0) return;
  // Leading edge white, trailing edge falls off; the whole ring dims near max radius.
  const fade = R > a.radius * 0.75 ? 1 : 0;
  const th = PULSAR.ringThickness;
  for (let i = 0; i < th; i++) {
    const level = Math.max(0, 4 - i - fade);
    r.circle(x, y, R - i, PULSAR_RAMP[level] as string, false);
  }
}

export const anomalyLayer: DrawLayer = {
  name: 'anomalies',
  z: 10,
  draw(w: World, r: Renderer, alpha: number) {
    const items = w.anomalies.items;
    const n = w.anomalies.count;
    for (let i = 0; i < n; i++) {
      const a = items[i] as Anomaly;
      if (!a.active) continue;
      const x = a.prevX + (a.x - a.prevX) * alpha;
      const y = a.prevY + (a.y - a.prevY) * alpha;
      if (a.kind === 'blackhole') {
        drawField(r, x, y, a.radius, a.t);
        spriteOpts.frame = Math.floor(a.t * 10) % BLACKHOLE_FRAMES;
        r.sprite('anomaly_blackhole', x, y, spriteOpts);
      } else {
        drawPulsarRing(r, a, x, y);
        const g = pulsarGlow(a);
        spriteOpts.frame =
          g > 0
            ? PULSAR_IDLE_FRAMES +
              Math.min(PULSAR_GLOW_FRAMES - 1, Math.floor(g * PULSAR_GLOW_FRAMES))
            : Math.floor(a.t * 8) % PULSAR_IDLE_FRAMES;
        r.sprite('anomaly_pulsar', x, y, spriteOpts);
      }
    }
  },
};
