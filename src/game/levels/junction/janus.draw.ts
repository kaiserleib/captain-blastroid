import type { Renderer, SpriteOpts } from '../../../gfx/renderer';
import { warm } from '../../../gfx/spriteCache';
import type { World } from '../../../sim/world';
import type { PartSlot } from '../../boss';
import { Janus, Phase } from './janus';
import { JANUS_SPRITE_IDS, JANUS_SPRITES as SPR } from './janus.sprites';

const opts: SpriteOpts = { frame: 0, flash: false };
const WALL_COLS = ['#30c8e0', '#90e028', '#b8f8f8', '#306808'] as const;
const WHITE = '#f8f8f8';
const LIME = '#90e028';
const LIME_DIM = '#306808';
const GOLD = '#f8d050';
const ORANGE = '#f88820';
let warmed = false;

function sprite(r: Renderer, id: string, x: number, y: number, frame = 0, flash = false): void {
  opts.frame = frame;
  opts.flash = flash;
  r.sprite(id, x, y, opts);
}

function drawFace(
  r: Renderer,
  b: Janus,
  i: number,
  bx: number,
  by: number,
  t: number,
  strobe: boolean,
): void {
  const s = b.faces[i] as PartSlot;
  const x = bx + s.spec.ox;
  const y = by + s.spec.oy;
  const dead = s.destroyed || s.enemy === null;
  const dying = b.phase === Phase.Dying;
  if (dead || (dying && s.enemy !== null && s.enemy.hp <= 0)) {
    sprite(r, i === 0 ? SPR.dawnCracked : SPR.duskCracked, x, y, Math.floor(t * 6 + i));
    return;
  }
  const hot = b.spiralTell() < 0.5 && b.liveFace() === s;
  const f = hot ? Math.floor(t * 16) : Math.floor(t * 2 + i);
  sprite(r, i === 0 ? SPR.dawn : SPR.dusk, x, y, f, strobe || (s.enemy?.flashT ?? 0) > 0);
}

function drawGen(
  r: Renderer,
  b: Janus,
  i: number,
  bx: number,
  by: number,
  t: number,
  strobe: boolean,
): void {
  const s = b.gens[i] as PartSlot;
  const x = bx + s.spec.ox;
  const y = by + s.spec.oy;
  if (s.destroyed || s.enemy === null) {
    sprite(r, SPR.genWreck, x, y, Math.floor(t * 8 + i));
    return;
  }
  sprite(r, SPR.gen, x, y, Math.floor(t * 6 + i), strobe || s.enemy.flashT > 0);
  if (b.phase === Phase.Fight || b.phase === Phase.Frenzy) {
    // The tether: a dotted lime line from the generator up to the exit it holds.
    const ex = b.exitX[i] as number;
    const ey = 6;
    const n = 24;
    const ph = Math.floor(t * 12) % 2;
    for (let k = ph; k < n; k += 2) {
      const u = k / n;
      const px = Math.round(x + (ex - x) * u);
      const py = Math.round(y - 8 + (ey - (y - 8)) * u);
      r.rect(px, py, 2, 1, (k >> 1) % 3 === 0 ? WHITE : LIME);
    }
  }
}

/** The portal wall: a shimmering band, a sparse flicker while down, gone once dying. */
function drawWall(w: World, r: Renderer, b: Janus, bx: number, by: number): void {
  const y = by + b.def.wall.oy;
  const hw = b.def.wall.halfWidth;
  const t = w.time;
  if (b.phase === Phase.Dying) {
    // It collapses: segments fall away from the middle out.
    const k = Math.min(1, b.phaseT / 0.8);
    const gap = Math.round(hw * k);
    for (let x = bx - hw; x <= bx + hw; x += 4) {
      if (Math.abs(x - bx) < gap) continue;
      r.rect(x, y + Math.round(k * 10 * ((x * 7) % 3)), 3, 1, WALL_COLS[(x >> 2) & 3] as string);
    }
    return;
  }
  const down = b.wallDown;
  const step = down ? 8 : 2;
  const ph = Math.floor(t * 15);
  for (let x = bx - hw; x <= bx + hw; x += step) {
    const k = ((x >> 1) + ph) & 3;
    r.rect(x, y - 1, step === 2 ? 2 : 1, 1, WALL_COLS[k] as string);
    if (!down) r.rect(x, y, 2, 1, WALL_COLS[(k + 2) & 3] as string);
    if (!down && ((x >> 1) + ph) % 7 === 0) r.rect(x, y + 1, 1, 1, WHITE);
  }
  // Pylons at the wall's ends.
  r.rect(bx - hw - 2, y - 3, 2, 6, LIME_DIM);
  r.rect(bx + hw + 1, y - 3, 2, 6, LIME_DIM);
}

/** The Janus `draw` (its registration in index.ts). */
export function drawJanus(w: World, r: Renderer, alpha: number, b: Janus): void {
  if (!warmed) {
    warm(JANUS_SPRITE_IDS);
    warmed = true;
  }
  const rig = b.rig;
  const t = w.time;
  let bx = Math.round(rig.prevX + (rig.x - rig.prevX) * alpha);
  const by = Math.round(rig.prevY + (rig.y - rig.prevY) * alpha);
  const dying = b.phase === Phase.Dying;
  const strobe = dying && Math.floor(b.phaseT * 14) % 3 === 0;
  if (dying) bx += Math.floor(b.phaseT * 30) % 2 === 0 ? 1 : -1;

  sprite(r, SPR.hull, bx, by, Math.floor(t * 4), strobe);
  // The 16-ring's tell: the throat swells before each ring.
  const tell = b.ringTell();
  if (tell < b.def.ring.tell) {
    const rad = 3 + Math.round((1 - tell / b.def.ring.tell) * 6);
    r.circle(bx, by + 20, rad, Math.floor(t * 20) % 2 ? LIME : WHITE, false);
  }
  for (let i = 0; i < 2; i++) drawFace(r, b, i, bx, by, t, strobe);
  // The spiral's tell: a ring tightening on the surviving face.
  const st = b.spiralTell();
  const live = b.liveFace();
  if (st > 0 && st < 0.5 && live !== null) {
    const rad = 13 + Math.round((st / 0.5) * 8);
    r.circle(
      bx + live.spec.ox,
      by + live.spec.oy,
      rad,
      Math.floor(t * 20) % 2 ? GOLD : WHITE,
      false,
    );
  }
  for (let i = 0; i < 2; i++) drawGen(r, b, i, bx, by, t, strobe);
  drawWall(w, r, b, bx, by);

  if (dying) {
    // The rings implode where they stood.
    const k = Math.min(1, b.phaseT / 0.5);
    if (k < 1) {
      const rad = Math.max(1, Math.round(14 * (1 - k)));
      for (let i = 0; i < 8; i += 2) {
        const x = b.implodeAt[i] as number;
        const y = b.implodeAt[i + 1] as number;
        if (x === 0 && y === 0) continue;
        r.circle(x, y, rad, k < 0.5 ? WHITE : ORANGE, false);
      }
    }
  }
}
