// Pickup art: weapon/upgrade capsules, shield cell, magnet, repulsor, salvage,
// schematic and escape pod. Lit from the top-left like the reference sprites.
import { defineCapsule } from '../../gfx/reference.sprites';
import {
  CANOPY,
  COBALT,
  FLAME,
  GLOW,
  OUTLINE,
  PICKUP,
  PLAYER,
  WHITE,
  snes,
} from '../../gfx/palette';
import { defineSprite } from '../../gfx/sprite';

// ---------------------------------------------------------------------------
// Capsules: 3×5 letters (M is narrowed from the 5-wide small-font glyph).

export const CAPSULE_LETTERS: Readonly<Record<string, readonly string[]>> = {
  blaster: ['##.', '#.#', '##.', '#.#', '##.'],
  spread: ['.##', '#..', '.#.', '..#', '##.'],
  lance: ['#..', '#..', '#..', '#..', '###'],
  seeker: ['#.#', '###', '###', '#.#', '#.#'],
  orbitDrones: ['##.', '#.#', '#.#', '#.#', '##.'],
};

/** Sprite id for a weapon capsule; unknown weapon ids fall back to the plain capsule. */
export const WEAPON_CAPSULE_SPRITES: Readonly<Record<string, string>> = {
  blaster: 'capsule_b',
  spread: 'capsule_s',
  lance: 'capsule_l',
  seeker: 'capsule_m',
  orbitDrones: 'capsule_d',
};

for (const id in WEAPON_CAPSULE_SPRITES) {
  defineCapsule(WEAPON_CAPSULE_SPRITES[id] as string, CAPSULE_LETTERS[id] as readonly string[]);
}
defineCapsule('capsule_u', ['#.#', '#.#', '#.#', '#.#', '###']);

// ---------------------------------------------------------------------------
// Shield cell: cyan hex with a white cross. Two-frame glint.

const SHIELD_PAL = {
  o: OUTLINE,
  n: CANOPY.dark,
  c: CANOPY.base,
  a: CANOPY.light,
  h: CANOPY.highlight,
  w: WHITE,
};

defineSprite('pickup_shield', {
  palette: SHIELD_PAL,
  frames: [
    `
    ...oooooo...
    ..ohhaaaco..
    .ohaaaaaaco.
    ohaaawwaaaco
    ohaaawwaaaco
    ohawwwwwwaco
    oaawwwwwwcno
    oaaacwwccnno
    .occcwwccno.
    .occccccnno.
    ..onnnnnno..
    ...oooooo...`,
    `
    ...oooooo...
    ..ohhhhaco..
    .ohhaaaaaco.
    ohhaawwaaaco
    ohaaawwaaaco
    ohawwwwwwaco
    oaawwwwwwcno
    oaaacwwccnno
    .occcwwccno.
    .occccccnno.
    ..onnnnnno..
    ...oooooo...`,
  ],
});

// ---------------------------------------------------------------------------
// Magnet: red horseshoe, silver pole tips pointing up.

const MAGNET_PAL = {
  o: OUTLINE,
  S: WHITE,
  s: PLAYER.light,
  k: PLAYER.dark,
  p: snes('#f87858'),
  R: GLOW.red,
  d: snes('#a01818'),
  x: snes('#580810'),
};

defineSprite('pickup_magnet', {
  palette: MAGNET_PAL,
  frames: [
    `
    .oooo..oooo.
    .oSso..oSso.
    .osko..osko.
    .oooo..oooo.
    .opRo..oRdo.
    .opRo..oRdo.
    .opRo..oRdo.
    .opRRooRRdo.
    .oppRRRRddo.
    ..opRRRddo..
    ...oxxxxo...
    ....oooo....`,
    `
    .oooo..oooo.
    .oSSo..oSSo.
    .osSo..osSo.
    .oooo..oooo.
    .opRo..oRdo.
    .opRo..oRdo.
    .opRo..oRdo.
    .opRRooRRdo.
    .oppRRRRddo.
    ..opRRRddo..
    ...oxxxxo...
    ....oooo....`,
  ],
});

// ---------------------------------------------------------------------------
// Repulsor: concentric violet rings around a white core; rings pulse outward.

const REPULSOR_PAL = {
  o: OUTLINE,
  v: snes('#6830c0'),
  c: snes('#a060f8'),
  a: snes('#d8b0f8'),
  w: WHITE,
};

defineSprite('pickup_repulsor', {
  palette: REPULSOR_PAL,
  frames: [
    `
    ...oooooo...
    ..ovvvvvvo..
    .ova....avo.
    ova.oooo.avo
    ov.ocaaco.vo
    ov.oawwao.vo
    ov.oawwao.vo
    ov.ocaaco.vo
    ova.oooo.avo
    .ova....avo.
    ..ovvvvvvo..
    ...oooooo...`,
    `
    ...oooooo...
    ..occccaco..
    .oca....aco.
    oca.oooo.aco
    oc.ovccvo.co
    oc.ocwwco.co
    oc.ocwwco.co
    oc.ovccvo.co
    oca.oooo.aco
    .oca....aco.
    ..occcccco..
    ...oooooo...`,
  ],
});

// ---------------------------------------------------------------------------
// Salvage: teal chip (1), gold nut (5), gold gear with a teal gem (25).

const SALVAGE_PAL = {
  o: OUTLINE,
  k: PICKUP.shadow,
  d: PICKUP.dark,
  b: PICKUP.base,
  l: PICKUP.light,
  h: PICKUP.highlight,
  t: snes('#106858'),
  e: snes('#20b098'),
  g: snes('#70f0d0'),
  w: WHITE,
};

defineSprite('salvage_s', {
  palette: SALVAGE_PAL,
  frames: [
    `
    .oo.
    oget
    oeto
    .oo.`,
    `
    .oo.
    owgt
    oeto
    .oo.`,
  ],
});

defineSprite('salvage_m', {
  palette: SALVAGE_PAL,
  frames: [
    `
    .oooo.
    ohllbo
    olkkdo
    obkkdo
    obbddo
    .oooo.`,
    `
    .oooo.
    owhlbo
    ohkkdo
    obkkdo
    obbddo
    .oooo.`,
  ],
});

defineSprite('salvage_l', {
  palette: SALVAGE_PAL,
  frames: [
    `
    ..o..o..
    .ohooldo
    ohlggbdo
    .ogwetd.
    .oeettd.
    obdttdko
    .oddoodo
    ..o..o..`,
    `
    ..o..o..
    .ohooldo
    ohlwgbdo
    .ogggtd.
    .oeettd.
    obdttdko
    .oddoodo
    ..o..o..`,
  ],
});

// ---------------------------------------------------------------------------
// Schematic: a blue blueprint between two rolled ends, with white plan lines.

const SCHEMATIC_PAL = {
  o: OUTLINE,
  n: COBALT.dark,
  b: COBALT.base,
  l: COBALT.light,
  h: COBALT.highlight,
  w: WHITE,
};

defineSprite('pickup_schematic', {
  palette: SCHEMATIC_PAL,
  frames: [
    `
    .oooooooooo.
    ohhhllllllbo
    onnnnnnnnnno
    .olbbbbbbno.
    .olwwwwbbno.
    .olwbbwwwno.
    .olwwwwbwno.
    .olbbbwwwno.
    .olbbbbbbno.
    ohhhllllllbo
    onnnnnnnnnno
    .oooooooooo.`,
    `
    .oooooooooo.
    owhhllllllbo
    onnnnnnnnnno
    .olbbbbbbno.
    .olwwwwbbno.
    .olwbbwwwno.
    .olwwwwbwno.
    .olbbbwwwno.
    .olbbbbbbno.
    owhhllllllbo
    onnnnnnnnnno
    .oooooooooo.`,
  ],
});

// ---------------------------------------------------------------------------
// Escape pod: white hull, cyan window, orange stripe, blinking red beacon.

const POD_PAL = {
  o: OUTLINE,
  k: PLAYER.shadow,
  d: PLAYER.dark,
  b: PLAYER.base,
  l: PLAYER.light,
  h: PLAYER.highlight,
  q: CANOPY.dark,
  g: CANOPY.base,
  a: CANOPY.light,
  f: FLAME.base,
  y: FLAME.light,
  r: GLOW.red,
  R: snes('#f8a8a8'),
  x: snes('#581010'),
};

const POD_BODY = `
    ...oooooo...
    ..ohhllbbo..
    .ohlqqqqbdo.
    .ohqaagqbdo.
    .ohqagggbdo.
    .ohlqqqqbdo.
    .offffffffo.
    .oyyyfffffo.
    .olbbbbbddo.
    ..odddddko..
    ...oooooo...
    ....okko....`;

defineSprite('escape_pod', {
  palette: POD_PAL,
  frames: [
    `
    .....oo.....
    ....oRro....
    .....oo.....` + POD_BODY,
    `
    .....oo.....
    ....oxxo....
    .....oo.....` + POD_BODY,
  ],
});
