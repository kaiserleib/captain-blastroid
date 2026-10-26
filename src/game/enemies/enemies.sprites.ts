// Scrap Syndicate roster: rust, olive and gunmetal hulls with a sickly green
// glow. Every ship flies nose-down, lit from the top-left. Authored as left
// halves and mirrored, so each grid row is half the sprite width.
import { EBULLET, GLOW, GUNMETAL, OLIVE, OUTLINE, SYNDICATE } from '../../gfx/palette';
import { defineSprite, gridRows } from '../../gfx/sprite';

const PAL = {
  o: OUTLINE,
  s: SYNDICATE.shadow,
  d: SYNDICATE.dark,
  r: SYNDICATE.base,
  l: SYNDICATE.light,
  h: SYNDICATE.highlight,
  v: OLIVE.dark,
  e: OLIVE.base,
  f: OLIVE.light,
  i: OLIVE.highlight,
  k: GUNMETAL.dark,
  m: GUNMETAL.base,
  n: GUNMETAL.light,
  w: GUNMETAL.highlight,
  g: GLOW.greenDark,
  G: GLOW.green,
  H: GLOW.greenHot,
  a: GLOW.amber,
};

/** Frame 2 = frame 1 with some rows replaced (engine flicker, blinking lights). */
function frames(base: string, swaps: Record<number, string>): string[] {
  const rows = gridRows(base);
  const alt = rows.map((r, i) => swaps[i] ?? r);
  return [rows.join('\n'), alt.join('\n')];
}

// ---------------------------------------------------------------------------
// Gnat 16×16: a cheap rammer drone with forward mandibles.

const GNAT = `
  ......g.
  .....oGo
  ....okmn
  ...okmnw
  ...odrlh
  o..odrlh
  eo.odrrl
  feoodrrl
  ifeedrlG
  vfeedrgH
  .vveedrg
  ..vvodrr
  ...odosd
  ...omo.o
  ...ono..
  ....o...
`;

defineSprite('enemy_gnat', {
  palette: PAL,
  mirrorX: true,
  frames: frames(GNAT, { 0: '........', 1: '.....oHo', 8: 'ifeedrlH', 9: 'vfeedrgG' }),
});

// ---------------------------------------------------------------------------
// Swooper 16×16: swept-back crescent wings, a single nose gun.

const SWOOPER = `
  ........
  o.....g.
  do...oGo
  rdo.okmn
  lrdookmn
  hlrdkmnw
  ohlrdmnw
  .ohlrdmn
  ..ohrdGH
  ..odrdgG
  ...odrdm
  ....odmk
  .....okk
  ......om
  ......on
  .......o
`;

defineSprite('enemy_swooper', {
  palette: PAL,
  mirrorX: true,
  frames: frames(SWOOPER, {
    1: 'a.......',
    2: 'do....g.',
    3: 'rdo.oHmn',
    8: '..ohrdHG',
    9: '..odrdGg',
  }),
});

// ---------------------------------------------------------------------------
// Gunboat 24×24: armored olive sponsons, rust spine, triple guns.

const GUNBOAT = `
  ............
  ....g.......
  ...gHg......
  ...okmko....
  ..oknwmko...
  ..okmmmkoooo
  .ovefffevodd
  ovefiifevdrl
  ovefffeevdrh
  ovveeeevvdrh
  okvvvvvvodrl
  okmmmmmmodrl
  okmnnnnmodGH
  okmmmmmmodgG
  .okkkkkkodrl
  .ovefffevodr
  .ovveeevvodr
  ..ovvvvvoodd
  ..okmmmkookk
  ...okmko.okm
  ...omno..omn
  ...ono...omn
  ....o....ono
  ..........o.
`;

defineSprite('enemy_gunboat', {
  palette: PAL,
  mirrorX: true,
  frames: frames(GUNBOAT, {
    1: '............',
    2: '...gGg......',
    12: 'okmnnnnmodHG',
    13: 'okmmmmmmodGg',
  }),
});

// ---------------------------------------------------------------------------
// Interceptor 24×24: a gunmetal delta with rust leading edges, twin guns.

const INTERCEPTOR = `
  ............
  ..........g.
  .........gGo
  o.......okmo
  do.....okmnm
  rdo...okmnwn
  lrdo.okmnnwn
  hlrdokmmnnwn
  ohlrdkkmmnnw
  .ohlrdkkmmnn
  ..ohlrdkkmmn
  ...ohlrdkkmn
  ....ohlrdkmn
  .....ohrdkGH
  ......ordkgG
  ......okdkmn
  .....okmokmn
  .....omno.km
  .....omno.om
  .....ono..om
  ......o...on
  ..........on
  ...........o
  ............
`;

defineSprite('enemy_interceptor', {
  palette: PAL,
  mirrorX: true,
  frames: frames(INTERCEPTOR, {
    1: '............',
    2: '.........gHo',
    3: 'a.......okmo',
    13: '.....ohrdkHG',
    14: '......ordkGg',
  }),
});

// ---------------------------------------------------------------------------
// Carrier 32×24: a rust-cab hauler with olive cargo pods slung on struts.

const CARRIER = `
  ................
  ...........g....
  ..........gHg...
  ..........okmko.
  ..ooooo...okmko.
  .ofiiifo.ooooooo
  .ofeeefo.odrrlll
  .oaaaaao.odrlhhh
  .oeeeevo.odrlhhh
  .oeeeevookdrrlll
  .oeeeevokmkdrrrr
  .ovvvvvoknmkoooo
  .oeeeevokmkodmnw
  .oeeeevookodmnnw
  .oaaaaao.odkmmnn
  .oeeeevo.odGHGHH
  .ovvvvvo.odgGgGG
  .okmmmko.odrrrrr
  ..okkko..odrlllh
  ...omo...okdrrrl
  ...ono...okkddrr
  ....o.....okkkdd
  ...........ookkk
  ..............oo
`;

defineSprite('enemy_carrier', {
  palette: PAL,
  mirrorX: true,
  frames: frames(CARRIER, {
    1: '................',
    2: '..........gGg...',
    7: '.oaaaaao.odrlhhh'.replace(/a/g, 'f'),
    14: '.oaaaaao.odkmmnn'.replace(/a/g, 'f'),
    15: '.oeeeevo.odHGHGG',
    16: '.ovvvvvo.odGgGgg',
  }),
});

// ---------------------------------------------------------------------------
// Large enemy bullet 8×8, same ring/core rule as `ebullet_s` (gfx/reference).

defineSprite('ebullet_l', {
  palette: { m: EBULLET.dark, p: EBULLET.ring, l: EBULLET.light, w: EBULLET.core },
  frames: [
    `
    ..mppm..
    .mpllpm.
    mplwwlpm
    plwwwwlp
    plwwwwlp
    mplwwlpm
    .mpllpm.
    ..mppm..`,
    `
    ..mppm..
    .mlwwlm.
    mlwwwwlm
    pwwwwwwp
    pwwwwwwp
    mlwwwwlm
    .mlwwlm.
    ..mppm..`,
  ],
});

export const ENEMY_SPRITE_IDS = [
  'enemy_gnat',
  'enemy_swooper',
  'enemy_gunboat',
  'enemy_interceptor',
  'enemy_carrier',
  'ebullet_s',
  'ebullet_l',
] as const;
