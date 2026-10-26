import type { Renderer, SpriteOpts } from '../../../gfx/renderer';
import { warm } from '../../../gfx/spriteCache';
import type { Asteroid } from '../../../sim/types';
import type { World } from '../../../sim/world';
import type { PartSlot } from '../../boss';
import { drawTractorBeam } from '../../obstacles';
import { ION, WHITE } from './ionShoals.sprites';
import { Phase, Slot, SPIRAL_TELL, type OrbitSlot, type Shepherd } from './shepherd';
import {
  SHEP_CORE_FRAMES,
  SHEP_SMOKE_FRAMES,
  SHEP_SPARK_FRAMES,
  SHEP_SPRITE_IDS,
  SHEP_SPRITES as SPR,
} from './shepherd.sprites';

const opts: SpriteOpts = { frame: 0, flash: false };
const SPARK_LIFE = 0.15;
const ORIGIN = { x: 0, y: 0 };
const HEX_WHITE = hex(WHITE);
const HEX_ION = hex(ION[3]);
const HEX_ION_HOT = hex(ION[4]);
let warmed = false;

function hex(col: number): string {
  return `#${col.toString(16).padStart(6, '0')}`;
}

function sprite(r: Renderer, id: string, x: number, y: number, frame = 0, flash = false): void {
  opts.frame = frame;
  opts.flash = flash;
  r.sprite(id, x, y, opts);
}

function smoke(r: Renderer, t: number, x: number, y: number, seed: number, n: number): void {
  for (let j = 0; j < n; j++) {
    const ph = (t * 0.9 + j / n + seed * 0.17) % 1;
    const wob = Math.sin((seed + j) * 2.3 + t * 1.7) * 2;
    sprite(
      r,
      SPR.smoke,
      x + wob + ph * 3 * (j % 2 ? 1 : -1),
      y + ph * 20,
      Math.floor(ph * SHEP_SMOKE_FRAMES),
    );
  }
}

function coreFrame(b: Shepherd, t: number): number {
  if (b.phase === Phase.Opening) {
    const k = Math.min(2, Math.floor((b.phaseT / b.def.coreOpenTime) * 3));
    return SHEP_CORE_FRAMES.opening + k;
  }
  if (b.phase >= Phase.Exposed)
    return SHEP_CORE_FRAMES.open + (Math.floor(t * 10) % SHEP_CORE_FRAMES.openCount);
  return SHEP_CORE_FRAMES.shut + (Math.floor(t * 3) % 2);
}

/** Corner brackets blinking round a rock about to be thrown (the tell). */
function brackets(r: Renderer, x: number, y: number, rad: number, t: number): void {
  const col = Math.floor(t * 14) % 2 === 0 ? HEX_WHITE : HEX_ION_HOT;
  const e = Math.round(rad) + 3;
  const cx = Math.round(x);
  const cy = Math.round(y);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const px = cx + sx * e;
      const py = cy + sy * e;
      r.rect(sx < 0 ? px : px - 3, py, 4, 1, col);
      r.rect(px, sy < 0 ? py : py - 3, 1, 4, col);
    }
  }
}

function drawEmitter(
  r: Renderer,
  s: PartSlot,
  i: number,
  bx: number,
  by: number,
  t: number,
  flashAll: boolean,
  charging: boolean,
): void {
  const x = bx + s.spec.ox;
  const y = by + s.spec.oy;
  if (s.destroyed || s.enemy === null) {
    sprite(r, SPR.wreck, x, y, Math.floor(t * 8 + i));
    smoke(r, t, x, y - 2, i * 3 + 1, 4);
    return;
  }
  const f = charging ? Math.floor(t * 16) : Math.floor(t * 4 + i);
  sprite(r, SPR.emitter, x, y, f, flashAll || s.enemy.flashT > 0);
}

function drawSlotBeam(w: World, r: Renderer, b: Shepherd, i: number, alpha: number): void {
  const s = b.slots[i] as OrbitSlot;
  if (s.mode === Slot.Empty) return;
  const rock = b.slotRock(s) as Asteroid | null;
  if (rock === null) return;
  const rx = rock.prevX + (rock.x - rock.prevX) * alpha;
  const ry = rock.prevY + (rock.y - rock.prevY) * alpha;
  b.beamOrigin(i, ORIGIN, alpha, rx);
  drawTractorBeam(r, ORIGIN.x, ORIGIN.y, rx, ry, w.time + i * 0.11);
  if (s.mode === Slot.Windup) brackets(r, rx, ry, rock.r, w.time);
}

/** The Shepherd's `draw` (its registration in index.ts). */
export function drawShepherd(w: World, r: Renderer, alpha: number, b: Shepherd): void {
  if (!warmed) {
    warm(SHEP_SPRITE_IDS);
    warmed = true;
  }
  const rig = b.rig;
  const t = w.time;
  let bx = Math.round(rig.prevX + (rig.x - rig.prevX) * alpha);
  const by = Math.round(rig.prevY + (rig.y - rig.prevY) * alpha);
  const dying = b.phase === Phase.Dying;
  const strobe = dying && Math.floor(b.phaseT * 14) % 3 === 0;
  if (dying) bx += Math.floor(b.phaseT * 30) % 2 === 0 ? 1 : -1;

  sprite(r, SPR.hull, bx, by, Math.floor(t * 6), strobe);

  const core = b.core;
  const coreFlash = strobe || (core.enemy !== null && core.enemy.flashT > 0);
  sprite(r, SPR.core, bx + core.spec.ox, by + core.spec.oy, coreFrame(b, t), coreFlash);
  // The spiral's tell: a ring tightening on the core before each burst.
  const tell = b.spiralTell();
  if (tell > 0 && tell < SPIRAL_TELL) {
    const rad = 14 + Math.round((tell / SPIRAL_TELL) * 10);
    r.circle(
      bx + core.spec.ox,
      by + core.spec.oy,
      rad,
      Math.floor(t * 20) % 2 ? HEX_ION : HEX_WHITE,
      false,
    );
  }

  // An emitter charges (its dish strobes) while its rock winds up.
  for (let i = 0; i < b.emitters.length; i++) {
    const charging = (b.slots[i] as OrbitSlot).mode === Slot.Windup;
    drawEmitter(r, b.emitters[i] as PartSlot, i, bx, by, t, strobe, charging);
  }
  if (!dying) for (let i = 0; i < 2; i++) drawSlotBeam(w, r, b, i, alpha);

  if (dying) {
    smoke(r, t, bx - 22, by - 8, 7, 3);
    smoke(r, t, bx + 20, by + 2, 11, 3);
    smoke(r, t, bx, by + 16, 5, 3);
  }

  const sp = b.sparks;
  for (let i = 0; i < sp.length; i += 3) {
    const age = sp[i + 2] as number;
    if (age >= SPARK_LIFE) continue;
    sprite(
      r,
      SPR.spark,
      sp[i] as number,
      sp[i + 1] as number,
      Math.min(SHEP_SPARK_FRAMES - 1, Math.floor((age / SPARK_LIFE) * SHEP_SPARK_FRAMES)),
    );
  }
}
