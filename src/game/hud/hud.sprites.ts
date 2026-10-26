import { CANOPY, COBALT, GUNMETAL, OUTLINE, PICKUP, SYNDICATE, UI, WHITE } from '../../gfx/palette';
import { defineSprite } from '../../gfx/sprite';

const TOP_LEFT = { x: 0, y: 0 };

// Shield pips: 7×7 hexes, cyan like the shield bar. Frames 1–3 are a glint sweeping
// down-right, shown when a segment is gained.
const PIP_PAL = {
  o: OUTLINE,
  w: WHITE,
  h: CANOPY.highlight,
  l: CANOPY.light,
  b: CANOPY.base,
  d: CANOPY.dark,
  g: GUNMETAL.dark,
  k: UI.barBack,
  m: GUNMETAL.base,
};

defineSprite('hud_pip', {
  palette: PIP_PAL,
  frames: [
    `
    ..ooo..
    .ohllo.
    ohllllo
    ollllbo
    olllbbo
    .obbdo.
    ..ooo..`,
    `
    ..ooo..
    .owwlo.
    owwlllo
    owlllbo
    olllbbo
    .obbdo.
    ..ooo..`,
    `
    ..ooo..
    .ohwwo.
    ohwwllo
    owwllbo
    owllbbo
    .obbdo.
    ..ooo..`,
    `
    ..ooo..
    .ohllo.
    ohllwwo
    ollwwbo
    olwwbbo
    .owwdo.
    ..ooo..`,
  ],
  anchor: TOP_LEFT,
});

defineSprite('hud_pip_empty', {
  palette: PIP_PAL,
  frames: [
    `
    ..ooo..
    .omgko.
    omkkkko
    ogkkkko
    ogkkkko
    .okkko.
    ..ooo..`,
  ],
  anchor: TOP_LEFT,
});

// Salvage: a hex nut with a dark bore.
defineSprite('hud_scrap', {
  palette: {
    o: OUTLINE,
    h: GUNMETAL.highlight,
    l: GUNMETAL.light,
    b: GUNMETAL.base,
    d: GUNMETAL.dark,
    k: OUTLINE,
    r: SYNDICATE.light,
  },
  frames: [
    `
    ..oooo..
    .ohhllo.
    ohlkkbbo
    olk..kbo
    olk..kdo
    obrkkddo
    .obddro.
    ..oooo..`,
  ],
  anchor: TOP_LEFT,
});

// Pause: a tiny SNES window button with two bars.
defineSprite('hud_pause', {
  palette: { o: OUTLINE, g: UI.borderOuter, b: COBALT.base, d: COBALT.dark, w: WHITE },
  frames: [
    `
    .ggggggg.
    gbbbbbbbg
    gbwwbwwbg
    gbwwbwwbg
    gbwwbwwdg
    gbwwbwwdg
    gbwwbwwdg
    gbbbbdddg
    .ggggggg.`,
  ],
  anchor: TOP_LEFT,
});

// Magnet: red horseshoe with silver tips, opening down.
defineSprite('hud_magnet', {
  palette: {
    o: OUTLINE,
    l: '#f87050',
    r: '#d02818',
    d: '#781010',
    w: WHITE,
    s: GUNMETAL.light,
  },
  frames: [
    `
    .ooooo.
    ollllro
    olrordo
    olrordo
    olrordo
    owsowso
    .oo.oo.`,
  ],
  anchor: TOP_LEFT,
});

// Repulsor: a ring around a white core.
defineSprite('hud_repulsor', {
  palette: { o: OUTLINE, h: CANOPY.highlight, l: CANOPY.light, b: CANOPY.base, w: WHITE },
  frames: [
    `
    ..ooo..
    .ohllo.
    oho.olo
    ol.w.bo
    olo.obo
    .olbbo.
    ..ooo..`,
  ],
  anchor: TOP_LEFT,
});

// Weapon slot frame (12×12), shared by real icons' backdrop, fallbacks and empty slots.
const SLOT_PAL = {
  g: UI.borderOuter,
  w: UI.border,
  b: COBALT.dark,
  k: UI.barBack,
  y: PICKUP.light,
};

defineSprite('hud_slot', {
  palette: SLOT_PAL,
  frames: [
    `
    .gggggggggg.
    gwwwwwwwwwwg
    gwbbbbbbbbwg
    gwbbbbbbbbwg
    gwbbbbbbbbwg
    gwbbbbbbbbwg
    gwbbbbbbbbwg
    gwbbbbbbbbwg
    gwbbbbbbbbwg
    gwbbbbbbbbwg
    gwwwwwwwwwwg
    .gggggggggg.`,
  ],
  anchor: TOP_LEFT,
});

defineSprite('hud_slot_empty', {
  palette: SLOT_PAL,
  frames: [
    `
    .gggggggggg.
    gkkkkkkkkkkg
    gkkkkkkkkkkg
    gkkkkkkkkkkg
    gkkkkkkkkkkg
    gkkkkkkkkkkg
    gkkkkkkkkkkg
    gkkkkkkkkkkg
    gkkkkkkkkkkg
    gkkkkkkkkkkg
    gkkkkkkkkkkg
    .gggggggggg.`,
  ],
  anchor: TOP_LEFT,
});
