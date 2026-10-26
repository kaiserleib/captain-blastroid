// Reference sprites: the quality bar for every later art ticket. Files named
// `*.sprites.ts` anywhere under src/ are picked up by the gallery automatically.
import { CANOPY, COBALT, EBULLET, FLAME, OUTLINE, PBULLET, PICKUP, PLAYER, WHITE } from './palette';
import { defineSprite, gridRows } from './sprite';

// ---------------------------------------------------------------------------
// Kestrel: 24×24, nose up, lit from the top-left.

const KESTREL_PAL = {
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

const KESTREL_HULL = `
  ...........oo...........
  ..........ohbo..........
  ..........ohdo..........
  .........ohlbdo.........
  .........ohwgdo.........
  ........ohwaggdo........
  ........olaggqdo........
  ........olggqqdo........
  ........olbqqbdo........
  .......ohlbccbdlo.......
  ......ohllbscbdblo......
  .o...ohlslbscbdcblo...o.
  oso.ohlsclbscbdncblo.oco
  osoohlscblbscbddncblooco
  oshlscbbblbscndddncblnco
  ochlscbbdlbscndkddncblno
  onlscbdddlbccbdkkkdncbno
  .onnddddoldkkbdokkkknno.
  ..ooooooolboobdoooooooo.
  ........okkookko........
`;

// Banking: the low wing foreshortens and falls into shadow, the high wing catches the light.
const KESTREL_BANK_L = `
  ...........oo...........
  ..........ohbo..........
  ..........ohdo..........
  .........ohlbdo.........
  .........ohwgdo.........
  ........ohwaggdo........
  ........olaggqdo........
  ........olggqqdo........
  ........olbqqbdo........
  .......ollbccbdho.......
  ......olblbscbdlho......
  ...o..obclbscbdslho..o..
  ..ocoolcnlbscbdcslhooso.
  ..ocolbndlbscbdbcslhoso.
  ..ocbcnddlbscndbbcslcso.
  ..ocbcndklbscnddbbcshco.
  ..obcndkklbccbddddbclco.
  ..onnkkkoldkkbdoddddco..
  ...oooooolboobdooooooo..
  ........okkookko........
`;

const KESTREL_BANK_R = `
  ...........oo...........
  ..........ohbo..........
  ..........ohdo..........
  .........ohlbdo.........
  .........ohwgdo.........
  ........ohwaggdo........
  ........olaggqdo........
  ........olggqqdo........
  ........olbqqbdo........
  .......ohlbccbdbo.......
  ......ohhlbscbddbo......
  ..o..ohhulbscbdndo..o...
  .ouoohhuslbscbdnnboono..
  .ouohhusllbscbdkndbono..
  .ouhusllllbscndkkndbno..
  .oshusllblbscndkknndno..
  .ochslbbblbccbdkkknndo..
  ..ocbbbboldkkbdokkknno..
  ...oooooolboobdoooooo...
  ........okkookko........
`;

// One engine-flame strip per frame, under the two nozzles.
const KESTREL_FLAMES = [
  `
  .........ee..ee.........
  .........yy..yy.........
  .........ff..ff.........
  .........rr..rr.........`,
  `
  .........ee..ee.........
  .........yf..yf.........
  .........fr..fr.........
  ........................`,
  `
  .........ey..ey.........
  .........yy..yy.........
  .........fr..fr.........
  .........r....r.........`,
];

function withFlames(hull: string): string[] {
  return KESTREL_FLAMES.map((f) => hull + f);
}

defineSprite('kestrel', { palette: KESTREL_PAL, frames: withFlames(KESTREL_HULL) });
defineSprite('kestrel_bank_l', { palette: KESTREL_PAL, frames: withFlames(KESTREL_BANK_L) });
defineSprite('kestrel_bank_r', { palette: KESTREL_PAL, frames: withFlames(KESTREL_BANK_R) });

// ---------------------------------------------------------------------------
// Bullets.

defineSprite('ebullet_s', {
  palette: { m: EBULLET.dark, p: EBULLET.ring, l: EBULLET.light, w: EBULLET.core },
  frames: [
    `
    .mppm.
    mpllpm
    plwwlp
    plwwlp
    mpllpm
    .mppm.`,
    `
    .mppm.
    mlwwlm
    pwwwwp
    pwwwwp
    mlwwlm
    .mppm.`,
  ],
});

defineSprite('pbullet_blaster', {
  palette: { w: PBULLET.white, a: PBULLET.cyanLight, c: PBULLET.cyan, d: PBULLET.cyanDark },
  frames: [
    `
    .aa.
    awwa
    awwa
    cwwc
    caac
    caac
    .cc.
    .dd.`,
  ],
  rotations: 16,
});

// ---------------------------------------------------------------------------
// Pickup capsule: amber shell, pale band, 3×5 letter. Two-frame shimmer.

const CAPSULE_PAL = {
  o: OUTLINE,
  k: PICKUP.shadow,
  d: PICKUP.dark,
  b: PICKUP.base,
  l: PICKUP.light,
  h: PICKUP.highlight,
  w: PICKUP.highlight,
  W: WHITE,
  x: PICKUP.letter,
};

const CAPSULE_TEMPLATE = [
  `
  ..oooooooo..
  .ohhllllbdo.
  ohllbbbbbbdo
  olwww...wwdo
  olwww...wwdo
  olwww...wwdo
  olwww...wwdo
  olwww...wwdo
  obbbbbbbbbdo
  obbbbbbbdddo
  .odddddddko.
  ..oooooooo..`,
  `
  ..oooooooo..
  .ohhllllbdo.
  ohllbbbbbbdo
  olwwW...wwdo
  olwWw...wwdo
  olWww...wWdo
  olwww...Wwdo
  olwww...wwdo
  obbbbbbbbbdo
  obbbbbbbdddo
  .odddddddko.
  ..oooooooo..`,
];

/**
 * Registers a capsule pickup stamped with a 3×5 letter (`#` = ink), e.g. the small
 * font's glyph rows. The letter occupies columns 5–7, rows 3–7.
 */
export function defineCapsule(id: string, letter: readonly string[]): void {
  const frames = CAPSULE_TEMPLATE.map((t) =>
    gridRows(t)
      .map((row, y) => {
        const lr = y >= 3 && y <= 7 ? (letter[y - 3] ?? '') : null;
        if (lr === null) return row;
        let out = row.slice(0, 5);
        for (let i = 0; i < 3; i++) out += lr[i] === '#' ? 'x' : 'w';
        return out + row.slice(8);
      })
      .join('\n'),
  );
  defineSprite(id, { palette: CAPSULE_PAL, frames });
}

defineCapsule('capsule', ['##.', '#.#', '##.', '#..', '#..']);
