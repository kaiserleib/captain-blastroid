import type { Renderer, SpriteOpts } from '../../gfx/renderer';
import { warm } from '../../gfx/spriteCache';
import type { DrawLayer, World } from '../../sim/world';
import {
  BOSS_LAYOUT,
  BOSS_SPRITE_IDS,
  BOSS_SPRITES as SPR,
  CHUTE_FRAMES,
  CORE_FRAMES,
  SMOKE_FRAMES,
  SPARK_FRAMES,
} from './boss.sprites';
import { activeBoss } from './bossSystem';
import type { PartSlot } from './parts';
import { Phase, type RockHauler } from './rockHauler';

const opts: SpriteOpts = { frame: 0, flash: false, rot: 0 };
const SPARK_LIFE = 0.15;
const RECOIL_T = 0.1;
let warmed = false;

function sprite(
  r: Renderer,
  id: string,
  x: number,
  y: number,
  frame = 0,
  flash = false,
  rot = 0,
): void {
  opts.frame = frame;
  opts.flash = flash;
  opts.rot = rot;
  r.sprite(id, x, y, opts);
}

/** Puffs drifting down with the scroll from (x, y); stateless, phased by `seed`. */
function smoke(r: Renderer, t: number, x: number, y: number, seed: number, n: number): void {
  for (let j = 0; j < n; j++) {
    const ph = (t * 0.9 + j / n + seed * 0.17) % 1;
    const wob = Math.sin((seed + j) * 2.3 + t * 1.7) * 2;
    sprite(
      r,
      SPR.smoke,
      x + wob + ph * 3 * (j % 2 ? 1 : -1),
      y + ph * 20,
      Math.floor(ph * SMOKE_FRAMES),
    );
  }
}

function coreFrame(b: RockHauler, t: number): number {
  if (b.phase === Phase.Opening) {
    const k = Math.min(2, Math.floor((b.phaseT / b.def.coreOpenTime) * 3));
    return CORE_FRAMES.opening + k;
  }
  if (b.phase >= Phase.Exposed)
    return CORE_FRAMES.open + (Math.floor(t * 8) % CORE_FRAMES.openCount);
  return CORE_FRAMES.shut + (Math.floor(t * 3) % 2);
}

function drawTurret(
  r: Renderer,
  w: World,
  b: RockHauler,
  s: PartSlot,
  i: number,
  bx: number,
  by: number,
  t: number,
  flashAll: boolean,
): void {
  const x = bx + s.spec.ox;
  const y = by + s.spec.oy;
  if (s.destroyed || s.enemy === null) {
    sprite(r, SPR.wreck, x, y, Math.floor(t * 8 + i));
    smoke(r, t, x, y - 2, i * 3 + 1, 4);
    return;
  }
  const p = w.player;
  const a = Math.atan2(p.y - y, p.x - x);
  const kick = (b.turretFired[i] as number) < RECOIL_T ? 2 : 0;
  sprite(
    r,
    SPR.barrel,
    x - Math.cos(a) * kick,
    y - Math.sin(a) * kick,
    0,
    flashAll,
    a - Math.PI / 2,
  );
  sprite(r, SPR.turret, x, y, Math.floor(t * 3 + i), flashAll || s.enemy.flashT > 0);
}

function drawBoss(w: World, r: Renderer, alpha: number): void {
  const b = activeBoss(w);
  if (b === null || b.done) return;
  if (!warmed) {
    warm(BOSS_SPRITE_IDS);
    warmed = true;
  }
  const rig = b.rig;
  const t = w.time;
  let bx = Math.round(rig.prevX + (rig.x - rig.prevX) * alpha);
  const by = Math.round(rig.prevY + (rig.y - rig.prevY) * alpha);
  const dying = b.phase === Phase.Dying;
  // Death throes: shudder, and the whole hull strobes white.
  const strobe = dying && Math.floor(b.phaseT * 14) % 3 === 0;
  if (dying) bx += Math.floor(b.phaseT * 30) % 2 === 0 ? 1 : -1;

  const spin = b.phase >= Phase.Opening ? Math.floor(t * 16) : Math.floor(t * 1.5);
  sprite(r, SPR.drill, bx + BOSS_LAYOUT.drillL.x, by + BOSS_LAYOUT.drillL.y, spin, strobe);
  sprite(r, SPR.drill, bx + BOSS_LAYOUT.drillR.x, by + BOSS_LAYOUT.drillR.y, spin + 1, strobe);
  sprite(r, SPR.hull, bx, by, Math.floor(t * 3), strobe);

  // The hopper load rattles while a throw winds up and kicks after it.
  const tele = b.telegraph();
  const winding = tele < b.def.fling.telegraph;
  const jig = winding ? (Math.floor(t * 24) % 2 === 0 ? 1 : -1) : 0;
  const kick = b.flungT < 0.12 ? -1 : 0;
  sprite(
    r,
    SPR.hopper,
    bx + BOSS_LAYOUT.hopper.x + jig,
    by + BOSS_LAYOUT.hopper.y + kick,
    0,
    strobe,
  );

  const core = b.core;
  const coreFlash = strobe || (core.enemy !== null && core.enemy.flashT > 0);
  sprite(r, SPR.core, bx + core.spec.ox, by + core.spec.oy, coreFrame(b, t), coreFlash);

  for (let i = 0; i < b.turrets.length; i++) {
    drawTurret(r, w, b, b.turrets[i] as PartSlot, i, bx, by, t, strobe);
  }

  if (winding || b.flungT < 0.2) {
    const f =
      b.flungT < 0.2
        ? CHUTE_FRAMES - 1
        : Math.min(CHUTE_FRAMES - 1, Math.floor((1 - tele / b.def.fling.telegraph) * CHUTE_FRAMES));
    sprite(r, SPR.chute, bx + BOSS_LAYOUT.chute.x, by + BOSS_LAYOUT.chute.y, f);
  }

  if (dying) {
    smoke(r, t, bx - 20, by - 6, 7, 3);
    smoke(r, t, bx + 18, by + 4, 11, 3);
    smoke(r, t, bx, by + 14, 5, 3);
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
      Math.min(SPARK_FRAMES - 1, Math.floor((age / SPARK_LIFE) * SPARK_FRAMES)),
    );
  }
}

/** Between roster enemies (40) and enemy shots (50). */
export const bossLayer: DrawLayer = { name: 'boss', z: 42, draw: drawBoss };
