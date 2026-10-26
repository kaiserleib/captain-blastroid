// Perihelion: a Syndicate slingshot racer, nose-down, lit from the top-left.
// Swept wings carry the two gun pods, twin gravitic drives at the stern burn
// violet, gold racing stripes run nose to tail. Separate part sprites (hull,
// pods and their wrecks, the reactor core) so each part flashes and breaks on
// its own, as on the Rock Hauler.
import { createRng } from '../../../engine/rng';
import { FX, GLOW } from '../../../gfx/palette';
import { B, c, D, H, L, proc, S, type Mask, type Paint } from './paint';
import { GOLD5, GUN5, RUST5, VIOLET5 } from './eventHorizon.sprites';

export const PERI_SPRITES = {
  hull: 'hz_peri_hull',
  pod: 'hz_peri_pod',
  podWreck: 'hz_peri_pod_wreck',
  core: 'hz_peri_core',
  spark: 'hz_peri_spark',
  smoke: 'hz_peri_smoke',
} as const;

export const PERI_SPRITE_IDS: readonly string[] = Object.values(PERI_SPRITES);

/** Hull frames: [level, bank left, bank right] × 2 engine-flicker frames. */
export const HULL_FRAMES = { level: 0, left: 2, right: 4 } as const;
/** Core frames: 0–1 shut (glow through the shutters), 2–4 opening, 5–8 open. */
export const PERI_CORE_FRAMES = { shut: 0, opening: 2, open: 5, openCount: 4 } as const;
export const PERI_SPARK_FRAMES = 3;
export const PERI_SMOKE_FRAMES = 4;

const WHITE = c('#f8f8f8');
const GREEN = c(GLOW.green);
const GREEN_HOT = c(GLOW.greenHot);
const GREEN_DARK = c(GLOW.greenDark);
const SOOT = c('#181010');
const EMBER = c(GLOW.amber);
const RED = c(GLOW.red);

// ---------------------------------------------------------------------------
// Hull 80×48 (82×50 with the outline). Center (40, 24) is the boss origin.

const HW = 80;
const HH = 48;
const CX = 40;
const CY = 24;

function dx(x: number): number {
  return Math.abs(x + 0.5 - CX);
}

const lead = (d: number): number => CY + 12 - d * 0.33;
const trail = (d: number): number => CY - 4 - d * 0.27;
const inWing: Mask = (x, y) => {
  const d = dx(x);
  return d >= 6 && d <= 36 && y >= trail(d) && y <= lead(d);
};
const fuseHalf = (y: number): number => {
  if (y < 6) return 3 + (y - 2) * 0.6;
  if (y <= CY + 8) return 7;
  return 7 - (y - CY - 8) * 0.48;
};
const inFuse: Mask = (x, y) => y >= 3 && y <= HH - 2 && dx(x) <= fuseHalf(y);
const inNacelle: Mask = (x, y) => {
  const d = dx(x);
  return y >= 4 && y <= 19 && d >= 9 && d <= 15 - (y > 16 ? y - 16 : 0);
};
const inCoreWell: Mask = (x, y) => {
  const ex = x + 0.5 - CX;
  const ey = y + 0.5 - (CY - 2);
  return ex * ex + ey * ey <= 11 * 11;
};

function paintHull(p: Paint, f: number): void {
  const bank = f >> 1;
  const flick = f & 1;
  // Bank: the dipping wing turns away from the light, the rising one catches it.
  const lw = bank === 1 ? D : bank === 2 ? L : B;
  const rw = bank === 1 ? L : bank === 2 ? D : B;
  p.shape((x, y) => inWing(x, y) && x < CX, GUN5, lw);
  p.shape((x, y) => inWing(x, y) && x >= CX, GUN5, rw);
  // Rust leading edges and gold racing chevrons on the wings.
  for (let x = 0; x < HW; x++) {
    const d = dx(x);
    if (d < 6 || d > 36) continue;
    const ly = Math.floor(lead(d));
    const side = x < CX ? lw : rw;
    p.set(x, ly, RUST5[Math.max(S, side - 1)] as number);
    p.set(x, ly - 1, RUST5[side] as number);
    if (d >= 14 && d <= 26) {
      const cy = Math.floor(trail(d) + 5 + (d - 14) * 0.12);
      p.set(x, cy, GOLD5[Math.min(H, side + 1)] as number);
      p.set(x, cy + 1, GOLD5[side] as number);
    }
    // Panel seams.
    if (Math.floor(d) % 7 === 3) {
      for (let y = Math.ceil(trail(d)) + 2; y < ly - 2; y++) p.set(x, y, GUN5[S] as number);
    }
  }
  // Wingtip pod mounts (the pods themselves are parts).
  for (const s of [-1, 1]) {
    const mx = CX + s * 30;
    for (let y = CY - 3; y <= CY - 1; y++)
      for (let x = mx - 3; x <= mx + 2; x++) p.set(x, y, GUN5[y === CY - 3 ? L : D] as number);
  }
  // Gravitic drive nacelles: cylinders with violet drive rings at the stern.
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? CX - 15 : CX + 9;
    p.shape((x, y) => inNacelle(x, y) && x >= x0 && x <= x0 + 6, GUN5);
    for (let x = x0; x <= x0 + 6; x++) {
      const k = x === x0 ? H : x === x0 + 1 ? L : x >= x0 + 5 ? D : B;
      p.set(x, 4, VIOLET5[k] as number);
      p.set(x, 5, VIOLET5[Math.max(S, k - 1)] as number);
      p.set(x, 13, RUST5[Math.max(S, k - 1)] as number);
    }
    p.rivet(x0 + 2, 9, GUN5);
  }
  p.shape(inFuse, GUN5);
  // Rust spine plates either side of the gold stripe.
  for (let y = 6; y <= CY + 14; y++) {
    const h = fuseHalf(y);
    for (let x = 0; x < HW; x++) {
      const d = dx(x);
      if (d > h - 2 || d < 2) continue;
      if (inCoreWell(x, y)) continue;
      p.set(x, y, RUST5[x < CX ? (y < 10 ? H : L) : y < 10 ? B : D] as number);
    }
  }
  // Gold racing stripe down the center line.
  for (let y = 3; y <= HH - 4; y++) {
    if (inCoreWell(CX, y)) continue;
    p.set(CX - 1, y, GOLD5[y < 8 ? H : L] as number);
    p.set(CX, y, GOLD5[y < 8 ? L : B] as number);
  }
  // The reactor well the core part sits in.
  for (let y = 0; y < HH; y++) {
    for (let x = 0; x < HW; x++) {
      if (!inCoreWell(x, y)) continue;
      const ex = x + 0.5 - CX;
      const ey = y + 0.5 - (CY - 2);
      const r2 = ex * ex + ey * ey;
      let col = GUN5[S] as number;
      if (r2 > 9.6 * 9.6) col = ex + ey < 0 ? (GUN5[D] as number) : (GUN5[L] as number);
      p.set(x, y, col);
    }
  }
  // Canopy near the nose.
  for (let y = CY + 12; y <= CY + 16; y++) {
    const h = y === CY + 12 || y === CY + 16 ? 1 : 2;
    for (let x = CX - h; x < CX + h; x++) {
      const hot = y === CY + 13 && x === CX - h;
      p.set(x, y, hot ? GREEN_HOT : y <= CY + 13 ? GREEN : GREEN_DARK);
    }
  }
  // Nose spike.
  p.set(CX - 1, HH - 2, GUN5[L] as number);
  p.set(CX, HH - 2, GUN5[D] as number);
  p.set(CX - 1, HH - 1, GUN5[H] as number);
  // Drive flames above the stern: violet into white, flickering.
  for (const s of [-1, 1]) {
    const fx = s < 0 ? CX - 12 : CX + 12;
    const len = flick ? 4 : 3;
    for (let i = 0; i < len; i++) {
      const y = 3 - i;
      const col = i === 0 ? WHITE : i === 1 ? (VIOLET5[H] as number) : (VIOLET5[L] as number);
      p.set(fx - 1, y, col);
      p.set(fx, y, col);
      if (i < 2) {
        p.set(fx - 2, y, VIOLET5[B] as number);
        p.set(fx + 1, y, VIOLET5[B] as number);
      }
    }
  }
}

proc(PERI_SPRITES.hull, HW, HH, 6, paintHull);

// ---------------------------------------------------------------------------
// Gun pod 18×18: an armored capsule with a gold collar and twin barrels down.

function paintPod(p: Paint, f: number): void {
  const cx = 9;
  p.sphere(cx, 8, 6.4, 6.6, GUN5, 0.02);
  // Rust cap.
  for (let y = 2; y <= 5; y++) {
    for (let x = 3; x <= 14; x++) {
      const nx = (x + 0.5 - cx) / 6.4;
      const ny = (y + 0.5 - 8) / 6.6;
      if (nx * nx + ny * ny > 0.9) continue;
      p.set(x, y, RUST5[y === 2 ? H : x < cx ? L : x < cx + 3 ? B : D] as number);
    }
  }
  p.torus(cx, 9, 6.6, 1.4, 1.6, GOLD5);
  // Barrels.
  for (const bx of [cx - 3, cx + 2]) {
    for (let y = 12; y <= 17; y++) {
      p.set(bx, y, GUN5[L] as number);
      p.set(bx + 1, y, GUN5[D] as number);
    }
    p.set(bx, 17, f === 1 ? c(FX.yellow) : (GUN5[S] as number));
    p.set(bx + 1, 17, f === 1 ? EMBER : (GUN5[S] as number));
  }
  // Sensor eye.
  p.set(cx - 1, 7, f === 1 ? GREEN_HOT : GREEN);
  p.set(cx, 7, GREEN_DARK);
}

proc(PERI_SPRITES.pod, 18, 18, 2, paintPod);

function paintWreck(p: Paint, f: number): void {
  const rng = createRng(`hz_peri_wreck#${f}`);
  const cx = 9;
  p.sphere(cx, 9, 6, 5.4, GUN5, -0.25);
  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < 18; x++) {
      const v = p.get(x, y);
      if (v < 0) continue;
      if (rng.next() < 0.35) p.set(x, y, SOOT);
    }
  }
  // Torn barrel stub and glowing breaches.
  p.set(cx - 3, 13, GUN5[D] as number);
  p.set(cx - 3, 14, GUN5[S] as number);
  p.set(cx + 1, 6, f ? EMBER : RED);
  p.set(cx - 2, 9, f ? RED : EMBER);
  p.set(cx + 3, 10, f ? EMBER : SOOT);
}

proc(PERI_SPRITES.podWreck, 18, 18, 2, paintWreck);

// ---------------------------------------------------------------------------
// Reactor core 22×22: a violet singularity drive behind gold iris shutters.

function paintCore(p: Paint, f: number): void {
  const cx = 11;
  const cy = 11;
  const F = PERI_CORE_FRAMES;
  // 0 = shut … 1 = fully open.
  const open = f < F.opening ? 0 : f < F.open ? (f - F.opening + 1) / 4 : 1;
  const pulse = f < F.opening ? f : (f - F.open) % 2;
  p.sphere(cx, cy, 8.6, 8.6, VIOLET5, open > 0 ? 0.15 + pulse * 0.15 : -0.1 + pulse * 0.1);
  if (open >= 1) {
    // Bright singularity seed with a turning white glint.
    p.sphere(cx, cy, 3.2, 3.2, VIOLET5, 0.6);
    const a = ((f - F.open) / F.openCount) * Math.PI * 2;
    p.set(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5, WHITE);
    p.set(cx - 1, cy - 1, WHITE);
  }
  // Six iris shutters: gold blades that retract outward as it opens.
  const inner = 2 + open * 6.5;
  for (let y = 0; y < 22; y++) {
    for (let x = 0; x < 22; x++) {
      const ex = x + 0.5 - cx;
      const ey = y + 0.5 - cy;
      const d = Math.hypot(ex, ey);
      if (d > 9.6 || d < inner) continue;
      const a = Math.atan2(ey, ex) + Math.PI;
      const blade = (a / (Math.PI * 2)) * 6;
      const along = blade - Math.floor(blade);
      // A gap between blades shows the glow while shut.
      if (open === 0 && along < 0.08) {
        p.set(x, y, VIOLET5[pulse ? H : L] as number);
        continue;
      }
      const lit = -(ex * -0.48 + ey * -0.56) / d;
      const k = along > 0.8 ? D : lit > 0.3 ? L : lit < -0.3 ? D : B;
      p.set(x, y, GOLD5[d > 8.6 ? Math.max(S, k - 1) : k] as number);
    }
  }
  if (open === 0) p.set(cx, cy, VIOLET5[pulse ? H : L] as number);
}

proc(PERI_SPRITES.core, 22, 22, 9, paintCore);

// ---------------------------------------------------------------------------
// Deflect sparks and wreck smoke.

proc(
  PERI_SPRITES.spark,
  5,
  5,
  PERI_SPARK_FRAMES,
  (p, f) => {
    const hot = f === 0 ? WHITE : f === 1 ? c(FX.yellow) : EMBER;
    p.set(2, 2, hot);
    const arm = f === 0 ? 1 : 2;
    for (let i = 1; i <= arm; i++) {
      const col = i === arm ? EMBER : hot;
      p.set(2 - i, 2 - i, col);
      p.set(2 + i, 2 - i, col);
      if (f > 0) p.set(2, 2 + i, col);
    }
  },
  false,
);

proc(
  PERI_SPRITES.smoke,
  7,
  7,
  PERI_SMOKE_FRAMES,
  (p, f) => {
    const r = 1.6 + f * 0.7;
    const light = c(FX.smoke);
    const dark = c(FX.smokeDark);
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const d = Math.hypot(x + 0.5 - 3.5, y + 0.5 - 3.5);
        if (d > r) continue;
        // Thins out with age: drop dithered pixels on the last frames.
        if (f >= 2 && ((x + y + f) & 1) === 0) continue;
        p.set(x, y, x + y < 6 ? light : dark);
      }
    }
  },
  false,
);
