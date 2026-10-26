// Player ships beyond the Kestrel, drawn to its spec (gfx/reference.sprites.ts):
// 24 px wide, nose up, lit from the top-left, same palette keys. Frames 0–2
// cruise flame, 3–5 long flame while climbing; `_bank_l/_r` for strafing.
// Campaign ships swap the hull (k d b l h) and trim (n c s u) ramps.
import {
  CANOPY,
  COBALT,
  CORSAIR,
  FLAME,
  GILT,
  HALCYON,
  OUTLINE,
  PARAGON,
  PLAYER,
  SKY,
  TEAL,
  WARDEN,
} from '../../gfx/palette';
import { defineSprite, gridRows } from '../../gfx/sprite';

type HullRamp = Readonly<{
  shadow: string;
  dark: string;
  base: string;
  light: string;
  highlight: string;
}>;
type TrimRamp = Readonly<{ dark: string; base: string; light: string; highlight: string }>;

function shipPalette(hull: HullRamp, trim: TrimRamp): Readonly<Record<string, string>> {
  return {
    ...SHIP_PAL,
    k: hull.shadow,
    d: hull.dark,
    b: hull.base,
    l: hull.light,
    h: hull.highlight,
    n: trim.dark,
    c: trim.base,
    s: trim.light,
    u: trim.highlight,
  };
}

const SHIP_PAL: Readonly<Record<string, string>> = {
  o: OUTLINE,
  k: PLAYER.shadow,
  d: PLAYER.dark,
  b: PLAYER.base,
  l: PLAYER.light,
  h: PLAYER.highlight,
  n: COBALT.dark,
  c: COBALT.base,
  s: COBALT.light,
  u: COBALT.highlight,
  q: CANOPY.dark,
  g: CANOPY.base,
  a: CANOPY.light,
  w: CANOPY.highlight,
  r: FLAME.dark,
  f: FLAME.base,
  y: FLAME.light,
  e: FLAME.highlight,
};

const DARKER: Readonly<Record<string, string>> = {
  h: 'l',
  l: 'b',
  b: 'd',
  d: 'k',
  u: 's',
  s: 'c',
  c: 'n',
  w: 'a',
  a: 'g',
  g: 'q',
};
const LIGHTER: Readonly<Record<string, string>> = {
  l: 'h',
  b: 'l',
  d: 'b',
  k: 'd',
  s: 'u',
  c: 's',
  n: 'c',
  a: 'w',
  g: 'a',
  q: 'g',
};
// Canopy glass keeps its glint on the lit side only.
const MIRROR_SHADE: Readonly<Record<string, string>> = { ...DARKER, w: 'g', a: 'g' };

function shade(ch: string, map: Readonly<Record<string, string>>): string {
  return map[ch] ?? ch;
}

/** Author the left 12 columns; the right half is mirrored one shade darker (light from the left). */
function symmetric(left: string): string[] {
  return gridRows(left).map((row) => {
    const l = row.padEnd(12, '.');
    let right = '';
    for (let i = 11; i >= 0; i--) right += shade(l[i] as string, MIRROR_SHADE);
    return l + right;
  });
}

/**
 * Derives a bank frame from the level hull: the low wing loses a column at
 * `cut` (foreshortened) and falls into shadow, the high wing catches the light.
 * Columns in [fuseL, fuseR] (the fuselage) are left as drawn.
 */
function bank(hull: string[], dir: -1 | 1, cut: number, fuseL: number, fuseR: number): string[] {
  return hull.map((row) => {
    const cs = row.split('');
    for (let x = 0; x < cs.length; x++) {
      if (x >= fuseL && x <= fuseR) continue;
      const low = dir < 0 ? x < fuseL : x > fuseR;
      cs[x] = shade(cs[x] as string, low ? DARKER : LIGHTER);
    }
    // A diagonal edge's outline pixel on the cut column moves in with the rest.
    const k = dir < 0 ? cut : cs.length - 1 - cut;
    const step = dir < 0 ? -1 : 1;
    let del = k;
    if (cs[k] === 'o' && cs[k + step] === '.') del = k + step;
    cs.splice(del, 1);
    if (dir < 0) cs.unshift('.');
    else cs.push('.');
    return cs.join('');
  });
}

// Per-nozzle flame columns (2 px wide), top row first. Cruise is 4 rows, climb 6.
const NOZZLE_FLAMES: readonly (readonly string[])[] = [
  ['ee', 'yy', 'ff', 'rr'],
  ['ee', 'yf', 'fr', '..'],
  ['ey', 'yy', 'fr', 'r.'],
  ['ee', 'yy', 'yy', 'ff', 'fr', 'r.'],
  ['ee', 'ey', 'yy', 'yf', 'ff', 'rr'],
  ['ee', 'yy', 'yf', 'ff', 'rr', '.r'],
];

/** Hull plus one flame strip per frame; `nozzles` are the left columns of each 2 px nozzle. */
function withFlames(hull: string[], nozzles: readonly number[], width = 24): string[] {
  return NOZZLE_FLAMES.map((strip) => {
    const rows = strip.map((pair) => {
      const cs = '.'.repeat(width).split('');
      for (const n of nozzles) {
        cs[n] = pair[0] as string;
        cs[n + 1] = pair[1] as string;
      }
      return cs.join('');
    });
    return [...hull, ...rows].join('\n');
  });
}

function defineShip(
  id: string,
  hull: string[],
  nozzles: readonly number[],
  cut: number,
  fuse: [number, number],
  anchorY: number,
  palette: Readonly<Record<string, string>> = SHIP_PAL,
): void {
  const anchor = { x: 12, y: anchorY };
  defineSprite(id, { palette, frames: withFlames(hull, nozzles), anchor });
  for (const [suffix, dir] of [
    ['_bank_l', -1],
    ['_bank_r', 1],
  ] as const) {
    defineSprite(id + suffix, {
      palette,
      frames: withFlames(bank(hull, dir, cut, fuse[0], fuse[1]), nozzles),
      anchor,
    });
  }
}

// ---------------------------------------------------------------------------
// Bulwark: a flying brick. Blunt nose, two armored engine nacelles on stub
// wings, three engines. Reads wide and heavy next to the Kestrel's arrow.

const BULWARK = symmetric(`
  ..........oo
  .........ohh
  ........ohlb
  ........ohwg
  .......ohlag
  .......olbgq
  .oooo..olbbb
  ohhlbo.olbsc
  ohlbbooolbsc
  ouscnhhllbsc
  ouscnllbbbsc
  oscnnlbbbbsc
  oscnnbbdddsc
  olbbdddddbsc
  olbbdooooldc
  olbddo..oldb
  odkkdo..oldk
  .oooo...oooo
  .okko....okk
`);

defineShip('bulwark', BULWARK, [2, 10, 12, 20], 6, [7, 16], 10);

// ---------------------------------------------------------------------------
// Dart: needle nose, long canopy, swept-back chevron wings, one engine.

const DART = symmetric(`
  ...........o
  ..........oh
  ..........oh
  ..........ol
  .........ohl
  .........ohw
  .........olw
  .........ola
  .........olg
  ........ohlq
  .......ohlbb
  ......ohlsbb
  .....ohlscbb
  ....ohlscnlb
  ...ohlscnolb
  ..ohlscnoolb
  .ohlscno.olb
  ohlscno..olb
  oscno....odb
  ooo......odb
  .........ooo
  ..........ok
`);

defineShip('dart', DART, [11], 4, [9, 14], 12);

// ---------------------------------------------------------------------------
// Warden: a broad teal escort. Wide shoulders and two forward gun booms that
// read as a fork from above; twin engines.

const WARDEN_HULL = symmetric(`
  ...........o
  ..........oh
  ..........ol
  .........ohl
  .o.......ohw
  ohu......owa
  ohs.....ohag
  ohs.....olgq
  ohc....ohlqq
  olc...ohlbbb
  olc..ohlbscb
  olcoohllbscb
  olchlbbbbscb
  olcbbbbbbscb
  olcbbbbbdscb
  odcbbdddddcb
  odnddkkkkdnb
  oknkooooookd
  .ooo....okko
`);

defineShip('warden', WARDEN_HULL, [9, 13], 5, [8, 15], 10, shipPalette(WARDEN, TEAL));

// ---------------------------------------------------------------------------
// Corsair: a red-and-gold raider with forward-swept wings, gold leading edges.

const CORSAIR_HULL = symmetric(`
  ...........o
  ..........oh
  ..........ol
  .........ohl
  .........ohw
  o........owa
  oso......olg
  ohso.....olq
  .ohso...ohlq
  .ohbso..olbb
  ..ohbsooolbb
  ..ohbbsoolbb
  ...ohbbsolbb
  ...olbbbslbb
  ....olbbbsbb
  ....odbbdbsb
  .....oddkdsb
  ......ooodbb
  ........oddk
  ........okko
`);

defineShip('corsair', CORSAIR_HULL, [9, 13], 3, [8, 15], 11, shipPalette(CORSAIR, GILT));

// ---------------------------------------------------------------------------
// Halcyon: a slim white lancer. Long needle nose, canards, short rear wings
// with tip pods.

const HALCYON_HULL = symmetric(`
  ...........o
  ..........oh
  ..........oh
  ..........ol
  ..........ol
  ..........os
  .........ohs
  .......oohlw
  ......osshla
  .......oohag
  .........olg
  .........olq
  .........olb
  ..oo....ohlb
  .ohso..ohlbs
  .olcsoohlbbc
  .olccsslbbdc
  .odnccbbdddn
  .odnoooddkoo
  ..oo...okko.
`);

defineShip('halcyon', HALCYON_HULL, [8, 14], 3, [8, 15], 12, shipPalette(HALCYON, SKY));

// ---------------------------------------------------------------------------
// Paragon: the flagship interceptor. Flagship blue, a gold-trimmed double delta.

const PARAGON_HULL = symmetric(`
  ...........o
  ..........oh
  ..........ol
  .........ohl
  .........ohw
  ........ouwa
  ........ohag
  .......oulgq
  .......ohlqq
  ......ouhbbb
  .....ouhlbbb
  ....oushlbbb
  ...ouslbbbsb
  ..ouslbbbbsb
  .ousbbbbbbsb
  ousbbbdddosb
  osbbddkkocsb
  ocddooookcsb
  .oooo..oddcb
  .......okkoo
`);

defineShip('paragon', PARAGON_HULL, [9, 13], 4, [8, 15], 11, shipPalette(PARAGON, GILT));
