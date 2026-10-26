// Player weapon art: shots (cool palette only, never magenta), drones and
// 12×12 HUD icons. `pbullet_blaster` (L1–4) is T02's reference sprite.
import { COBALT, OUTLINE, PBULLET, UI, WHITE } from '../../gfx/palette';
import { defineSprite } from '../../gfx/sprite';

const SHOT = {
  w: PBULLET.white,
  a: PBULLET.cyanLight,
  c: PBULLET.cyan,
  d: PBULLET.cyanDark,
  l: PBULLET.yellowLight,
  y: PBULLET.yellow,
  k: PBULLET.yellowDark,
};

// Blaster L5: fatter, white-hot bolt.
defineSprite('pbullet_blaster5', {
  palette: SHOT,
  frames: [
    `
    ..aa..
    .awwa.
    awwwwa
    awwwwa
    awwwwa
    cawwac
    caaaac
    .caac.
    .cddc.
    ..dd..`,
  ],
  rotations: 16,
});

// Spread: yellow diamonds, so they never read as the round enemy bullets.
defineSprite('pbullet_spread', {
  palette: SHOT,
  frames: [
    `
    ..ll..
    .lwwy.
    lwwlyy
    ylyyyk
    .yyyk.
    ..kk..`,
  ],
});

defineSprite('pbullet_spread5', {
  palette: SHOT,
  frames: [
    `
    ...ww...
    ..wwll..
    .wwwlly.
    wwwlllyy
    lwllyyyk
    .lyyyyk.
    ..yyyk..
    ...kk...`,
    `
    ...ll...
    ..lwwl..
    .lwwwly.
    lwwwllyy
    lwllyyyk
    .lyyyyk.
    ..yyyk..
    ...kk...`,
  ],
});

// Pulse Lance: a long bolt with travelling bright bands (2-frame shimmer).
defineSprite('pbullet_lance', {
  palette: SHOT,
  frames: [
    `
    .ww.
    awwa
    awwa
    cwwc
    caac
    awwa
    cwwc
    caac
    awwa
    cwwc
    caac
    .cc.
    .dd.
    .dd.`,
    `
    .ww.
    awwa
    cwwc
    caac
    awwa
    cwwc
    caac
    awwa
    cwwc
    caac
    .aa.
    .cc.
    .cd.
    .d..`,
  ],
  rotations: 16,
});

// L4: thicker.
defineSprite('pbullet_lance_w', {
  palette: SHOT,
  frames: [
    `
    ..ww..
    .awwa.
    cawwac
    cawwac
    cwwwwc
    caaaac
    cawwac
    cwwwwc
    caaaac
    cawwac
    cwwwwc
    caaaac
    .caac.
    .cddc.
    ..dd..
    ..d...`,
    `
    ..ww..
    .awwa.
    cawwac
    cwwwwc
    caaaac
    cawwac
    cwwwwc
    caaaac
    cawwac
    cwwwwc
    caaaac
    .cwwc.
    .caac.
    ..dd..
    ...d..
    ......`,
  ],
  rotations: 16,
});

// L5: thick, longer, yellow-hot edges.
defineSprite('pbullet_lance5', {
  palette: SHOT,
  frames: [
    `
    ..ll..
    .lwwl.
    lawwal
    lwwwwl
    awwwwa
    cawwac
    awwwwa
    cwwwwc
    cawwac
    awwwwa
    cwwwwc
    cawwac
    awwwwa
    caaaac
    .caac.
    .cddc.
    ..dd..
    ..d...`,
    `
    ..ll..
    .lwwl.
    lwwwwl
    awwwwa
    cawwac
    awwwwa
    cwwwwc
    cawwac
    awwwwa
    cwwwwc
    cawwac
    awwwwa
    cwwwwc
    caaaac
    .cwwc.
    .caac.
    ..dd..
    ...d..`,
  ],
  rotations: 16,
});

// Seeker missile: yellow warhead, white body, cyan fins, tiny exhaust.
defineSprite('pbullet_seeker', {
  palette: SHOT,
  frames: [
    `
    ..ll..
    .lyyk.
    .wwad.
    .wwad.
    .waad.
    .wacd.
    dwacdd
    dcccdd
    d.ly.d
    ..k...`,
  ],
  rotations: 16,
});

defineSprite('pbullet_seeker5', {
  palette: SHOT,
  frames: [
    `
    ..ww..
    .wlly.
    .llyk.
    .wwad.
    .wwad.
    .waad.
    awacdc
    acccdc
    a.wl.c
    ..ly..`,
  ],
  rotations: 16,
});

// Orbit drone: cobalt orb with a cyan eye that pulses.
const DRONE = {
  o: OUTLINE,
  u: COBALT.highlight,
  s: COBALT.light,
  c: COBALT.base,
  n: COBALT.dark,
  a: PBULLET.cyanLight,
  q: PBULLET.cyan,
  w: WHITE,
};

defineSprite('drone', {
  palette: DRONE,
  frames: [
    `
    ..oooo..
    .ouusco.
    ouswacno
    osawwqno
    osqwaqno
    occqqnno
    .onnnno.
    ..oooo..`,
    `
    ..oooo..
    .ouusco.
    ousqqcno
    osqaaqno
    oscqqcno
    occccnno
    .onnnno.
    ..oooo..`,
  ],
});

// L5: bigger, with a bright halo ring.
defineSprite('drone5', {
  palette: DRONE,
  frames: [
    `
    ...oooo...
    ..oaaaao..
    .oauussao.
    oauswwacao
    oaswwwaqno
    oaswwaqqno
    oacqqqqnao
    .oacnnnao.
    ..oaaaao..
    ...oooo...`,
    `
    ...oooo...
    ..oqqqqo..
    .oquussqo.
    oquswaacqo
    oqsawwaqno
    oqsaaaqqno
    oqcqqqqnqo
    .oqcnnnqo.
    ..oqqqqo..
    ...oooo...`,
  ],
});

// ---------------------------------------------------------------------------
// HUD icons, 12×12: SNES-blue tile, gray rim, the weapon's shot as a glyph.

const ICON = {
  ...SHOT,
  e: UI.borderOuter,
  b: UI.windowBottom,
  B: UI.windowTop,
  o: OUTLINE,
  u: COBALT.highlight,
  s: COBALT.light,
  n: COBALT.dark,
};

function icon(id: string, glyph: string): void {
  defineSprite(id, { palette: ICON, frames: [glyph] });
}

icon(
  'icon_blaster',
  `
  eeeeeeeeeeee
  eBBBBBBBBBBe
  eBBBBaaBBBBe
  eBBBawwaBBBe
  eBBBawwaBBBe
  eBBBcwwcBBBe
  ebbbcaacbbbe
  ebbbcaacbbbe
  ebbbbccbbbbe
  ebbbbddbbbbe
  ebbbbbbbbbbe
  eeeeeeeeeeee`,
);

icon(
  'icon_spread',
  `
  eeeeeeeeeeee
  elyBBlyBBlye
  eykBBykBByke
  eBkBBBkBBkBe
  eBBkBBkBkBBe
  eBBBkBkkBBBe
  ebbbbaabbbbe
  ebbbawwabbbe
  ebbbcaacbbbe
  ebbbbccbbbbe
  ebbbbbbbbbbe
  eeeeeeeeeeee`,
);

icon(
  'icon_lance',
  `
  eeeeeeeeeeee
  eBBBBwwBBBBe
  eBBBawwaBBBe
  eBBBcwwcBBBe
  eBBBcaacBBBe
  ebbbawwabbbe
  ebbbcwwcbbbe
  ebbbcaacbbbe
  ebbbawwabbbe
  ebbbbccbbbbe
  ebbbbddbbbbe
  eeeeeeeeeeee`,
);

icon(
  'icon_seeker',
  `
  eeeeeeeeeeee
  eBBBBBBBBlle
  eBBBBBBBlyke
  eBBBBBBwwkBe
  eBBBBBwwaBBe
  ebbbbwwadbbe
  ebbbdwadbbbe
  ebbbbddbbbbe
  ebbblkbdbbbe
  ebbykbbbbbbe
  ebkbbbbbbbbe
  eeeeeeeeeeee`,
);

icon(
  'icon_orbitDrones',
  `
  eeeeeeeeeeee
  eBBBdddBBcBe
  eBBdBBBBcwce
  eBdBBBBBBcBe
  edBBBwwBBBBe
  edBBawwaBBde
  edbbcaacbbde
  ebbbbddbbbde
  ebcbbbbbbdbe
  ecwcbbbbdbbe
  ebcbbdddbbbe
  eeeeeeeeeeee`,
);
