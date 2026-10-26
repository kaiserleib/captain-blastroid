import { GUNMETAL, OUTLINE, PICKUP } from '../gfx/palette';
import { defineSprite } from '../gfx/sprite';

const TOP_LEFT = { x: 0, y: 0 };

// Clear star on the sector cards: a gold star with a lit centre line.
defineSprite('ui_star', {
  palette: { o: OUTLINE, h: PICKUP.highlight, l: PICKUP.light, b: PICKUP.base },
  frames: [
    `
    ....o....
    ...olo...
    ooolhlooo
    olllhllbo
    .olllllo.
    ..olllo..
    .olbobbo.
    .obo.obo.
    .oo...oo.`,
  ],
  anchor: TOP_LEFT,
});

// Padlock for locked sector cards.
defineSprite('ui_lock', {
  palette: {
    o: OUTLINE,
    h: GUNMETAL.highlight,
    l: GUNMETAL.light,
    b: GUNMETAL.base,
    d: GUNMETAL.dark,
  },
  frames: [
    `
    ...oooo...
    ..ohllho..
    .oho..oho.
    .olo..olo.
    oooooooooo
    ohhhhhhhlo
    ohllddlllo
    olllddllbo
    olllddlbbo
    olbbbbbbbo
    oooooooooo`,
  ],
  anchor: TOP_LEFT,
});
