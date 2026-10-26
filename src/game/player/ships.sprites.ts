// Bulwark and Dart, drawn to the Kestrel's spec (gfx/reference.sprites.ts):
// 24 px wide, nose up, lit from the top-left, same palette keys. Frames 0–2
// cruise flame, 3–5 long flame while climbing; `_bank_l/_r` for strafing.
import { CANOPY, COBALT, FLAME, OUTLINE, PLAYER } from '../../gfx/palette';
import { defineSprite, gridRows } from '../../gfx/sprite';

const SHIP_PAL = {
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
): void {
  const anchor = { x: 12, y: anchorY };
  defineSprite(id, { palette: SHIP_PAL, frames: withFlames(hull, nozzles), anchor });
  for (const [suffix, dir] of [
    ['_bank_l', -1],
    ['_bank_r', 1],
  ] as const) {
    defineSprite(id + suffix, {
      palette: SHIP_PAL,
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
