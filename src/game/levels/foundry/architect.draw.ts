import { ARCHITECT } from '../../../content/levels/foundry';
import { boomSprite, BOOM_FRAMES, type BoomSize } from '../../../gfx/fx';
import type { Renderer, SpriteOpts } from '../../../gfx/renderer';
import type { Enemy } from '../../../sim/types';
import type { World } from '../../../sim/world';
import type { PartSlot } from '../../boss';
import { drawTractorBeam } from '../../obstacles';
import { ArchPhase, type Architect } from './architect';
import {
  ARM_FRAMES,
  CORE1_FRAMES,
  CORE3_FRAMES,
  FD_SPRITES as SPR,
  MOLTEN5,
  TOW5,
  VIOLET5,
} from './foundry.sprites';

const A = ARCHITECT;
const opts: SpriteOpts = { frame: 0, flash: false, rot: 0, alpha: 1 };
const SPARK_LIFE = 0.15;
const POP_LIFE = 0.5;

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}
const SPARK = [hex(MOLTEN5[4]), hex(MOLTEN5[3]), hex(MOLTEN5[2])] as const;
const VIO = [hex(VIOLET5[2]), hex(VIOLET5[3]), hex(VIOLET5[4])] as const;
const SHIELD = hex(TOW5[3]);
const SHIELD_HOT = hex(TOW5[4]);

function spr(
  r: Renderer,
  id: string,
  x: number,
  y: number,
  frame = 0,
  flash = false,
  alpha = 1,
): void {
  opts.frame = frame;
  opts.flash = flash;
  opts.alpha = alpha;
  r.sprite(id, x, y, opts);
}

function lerpX(e: Enemy, alpha: number): number {
  return e.prevX + (e.x - e.prevX) * alpha;
}
function lerpY(e: Enemy, alpha: number): number {
  return e.prevY + (e.y - e.prevY) * alpha;
}

/** A dotted ring (shields, the ignition telegraph), whole pixels only. */
function dotRing(
  r: Renderer,
  x: number,
  y: number,
  rad: number,
  col: string,
  step: number,
  phase: number,
): void {
  const n = Math.max(12, Math.floor((rad * Math.PI * 2) / step));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + phase;
    r.rect(Math.round(x + Math.cos(a) * rad), Math.round(y + Math.sin(a) * rad), 1, 1, col);
  }
}

function live(b: Architect, i: number): Enemy | null {
  const s = b.rig.slots[i] as PartSlot;
  return b.rig.alive(s) ? (s.enemy as Enemy) : null;
}

function drawScaffold(w: World, r: Renderer, b: Architect, alpha: number): void {
  const t = w.time;
  const core = live(b, b.core1I);
  if (core === null) return;
  const cx = lerpX(core, alpha);
  const cy = lerpY(core, alpha);
  spr(r, SPR.archFrame, cx, cy - 2);
  for (let k = 0; k < b.armI.length; k++) {
    const arm = live(b, b.armI[k] as number);
    if (arm === null) {
      // A torn stub where the arm hung.
      const s = b.specs[b.armI[k] as number]!;
      spr(r, SPR.wreck, cx + s.ox, cy + s.oy - 2, Math.floor(t * 6) & 1);
      continue;
    }
    const ax = lerpX(arm, alpha);
    const ay = lerpY(arm, alpha);
    const rock = b.armRock(k);
    if (rock !== null) drawTractorBeam(r, ax, ay + 4, rock.x, rock.y, t);
    spr(
      r,
      SPR.archArm,
      ax,
      ay,
      (b.armHot(k) ? ARM_FRAMES.hot : ARM_FRAMES.idle) + (Math.floor(t * 4 + k) & 1),
      arm.flashT > 0,
    );
  }
  const armored = b.coreArmored();
  spr(
    r,
    SPR.archCore1,
    cx,
    cy,
    (armored ? CORE1_FRAMES.shut : CORE1_FRAMES.open) + (Math.floor(t * 3) & 1),
    core.flashT > 0,
  );
}

function drawFall(w: World, r: Renderer, b: Architect): void {
  const t = b.phaseT;
  // The truss and the arms tumble off below, the bare hub shudders on.
  const drop = 40 * t * t + 20 * t;
  spr(r, SPR.archFrame, b.fallX, b.fallY - 2 + drop, 0, false, Math.max(0, 1 - t / A.transition));
  for (const side of [-1, 1]) {
    spr(
      r,
      SPR.wreck,
      b.fallX + side * (46 + t * 14),
      b.fallY + 6 + drop * 1.2,
      Math.floor(w.time * 8) & 1,
    );
  }
  const jit = Math.sin(w.time * 50) * 1.2;
  spr(r, SPR.archCore1, b.cx + jit, b.cy, CORE1_FRAMES.open + (Math.floor(w.time * 10) & 1));
  // The hole's ignition point glows for the last second.
  const k = (t - (A.transition - 1)) / 1;
  if (k > 0) {
    const holeR = 4 + k * 10;
    dotRing(
      r,
      120,
      A.engine.hole.y,
      holeR,
      VIO[Math.floor(w.time * 12) % 3] as string,
      3,
      w.time * 3,
    );
    dotRing(r, 120, A.engine.hole.y, holeR * 0.5, VIO[2], 3, -w.time * 4);
  }
}

function drawEngine(w: World, r: Renderer, b: Architect, alpha: number): void {
  const t = w.time;
  const core = live(b, b.core2I);
  const cx = core !== null ? lerpX(core, alpha) : b.cx;
  const cy = core !== null ? lerpY(core, alpha) : b.cy;
  // Conduits from each pylon to the core, pulsing violet.
  for (let k = 0; k < b.pylonI.length; k++) {
    const p = live(b, b.pylonI[k] as number);
    if (p === null) continue;
    const px = lerpX(p, alpha);
    const py = lerpY(p, alpha);
    const n = 8;
    for (let j = 1; j < n; j++) {
      if ((j + Math.floor(t * 10)) % 3 === 0) continue;
      r.rect(
        Math.round(px + ((cx - px) * j) / n),
        Math.round(py + ((cy - py) * j) / n),
        1,
        1,
        VIO[(j + k) % 3] as string,
      );
    }
    spr(r, SPR.archPylon, px, py, Math.floor(t * 4 + k) & 1, p.flashT > 0);
  }
  if (core === null) return;
  spr(r, SPR.archCore2, cx, cy, Math.floor(t * 3) & 1, core.flashT > 0);
  if (b.coreArmored())
    dotRing(r, cx, cy, 17, Math.floor(t * 8) & 1 ? SHIELD : SHIELD_HOT, 2, t * 1.5);
}

function drawCollapse(w: World, r: Renderer, b: Architect): void {
  const k = Math.min(1, b.phaseT / A.transition);
  const blink = Math.floor(w.time * (6 + k * 18)) & 1;
  if (k < 0.75) spr(r, SPR.archCore2, b.cx, b.cy, blink, blink === 1, 1 - k);
  if (k > 0.4)
    spr(
      r,
      SPR.archCore3,
      b.cx,
      b.cy,
      Math.floor(w.time * 8) % CORE3_FRAMES,
      false,
      (k - 0.4) / 0.6,
    );
}

function drawParadox(w: World, r: Renderer, b: Architect, alpha: number): void {
  const core = live(b, b.core3I);
  if (core === null) return;
  spr(
    r,
    SPR.archCore3,
    lerpX(core, alpha),
    lerpY(core, alpha),
    Math.floor(w.time * 8) % CORE3_FRAMES,
    core.flashT > 0,
  );
}

function drawSparks(r: Renderer, b: Architect): void {
  const sp = b.sparks;
  for (let i = 0; i < sp.length; i += 3) {
    const age = sp[i + 2] as number;
    if (age >= SPARK_LIFE) continue;
    const x = Math.round(sp[i] as number);
    const y = Math.round(sp[i + 1] as number);
    const col = SPARK[Math.min(2, Math.floor((age / SPARK_LIFE) * 3))] as string;
    r.rect(x, y, 1, 1, col);
    r.rect(x - 1, y + 1, 1, 1, col);
    r.rect(x + 1, y + 1, 1, 1, col);
  }
}

function drawPops(r: Renderer, b: Architect): void {
  const pp = b.pops;
  for (let i = 0; i < pp.length; i += 4) {
    const age = pp[i + 2] as number;
    if (age >= POP_LIFE) continue;
    spr(
      r,
      boomSprite(pp[i + 3] as BoomSize),
      pp[i] as number,
      pp[i + 1] as number,
      Math.min(BOOM_FRAMES - 1, Math.floor((age / POP_LIFE) * BOOM_FRAMES)),
    );
  }
}

/** The boss registration's draw (z 42). */
export function drawArchitect(w: World, r: Renderer, alpha: number, b: Architect): void {
  switch (b.phase) {
    case ArchPhase.Entry:
    case ArchPhase.Scaffold:
      drawScaffold(w, r, b, alpha);
      break;
    case ArchPhase.Fall:
      drawFall(w, r, b);
      break;
    case ArchPhase.Engine:
      drawEngine(w, r, b, alpha);
      break;
    case ArchPhase.Collapse:
      drawCollapse(w, r, b);
      break;
    case ArchPhase.Paradox:
      drawParadox(w, r, b, alpha);
      break;
    case ArchPhase.Dying:
      if (b.phaseT < 0.5 && (Math.floor(w.time * 20) & 1) === 0)
        spr(r, SPR.archCore3, b.cx, b.cy, 0, true);
      break;
  }
  drawSparks(r, b);
  drawPops(r, b);
}
