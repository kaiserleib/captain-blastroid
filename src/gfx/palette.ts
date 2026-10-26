// SNES BGR555: 5 bits per channel, so every channel is a multiple of 8 (0..248).
// Ramps run dark → base → light → highlight with the light source at the top-left.

function q(v: number): number {
  const c = Math.round(v / 8) * 8;
  return c < 0 ? 0 : c > 248 ? 248 : c;
}

function hex2(v: number): string {
  return v.toString(16).padStart(2, '0');
}

/** Quantizes to 15-bit color: `snes('#2244a3')` or `snes(34, 68, 163)` → `'#2040a0'`. */
export function snes(hexOrR: string | number, g?: number, b?: number): string {
  let r: number;
  if (typeof hexOrR === 'string') {
    const m = /^#?([0-9a-f]{6})$/i.exec(hexOrR.trim());
    if (!m) throw new Error(`snes(): bad color "${hexOrR}"`);
    const n = parseInt(m[1] as string, 16);
    r = (n >> 16) & 255;
    g = (n >> 8) & 255;
    b = n & 255;
  } else {
    r = hexOrR;
  }
  return `#${hex2(q(r))}${hex2(q(g ?? 0))}${hex2(q(b ?? 0))}`;
}

/** True if `hex` is `#rrggbb` with every channel a multiple of 8. */
export function isSnesColor(hex: string): boolean {
  const m = /^#([0-9a-f]{6})$/.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1] as string, 16);
  return ((n >> 16) & 7) === 0 && ((n >> 8) & 7) === 0 && (n & 7) === 0;
}

/** Linear blend of two colors, re-quantized. For building in-between ramp steps and gradients. */
export function mix(a: string, b: string, t: number): string {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  const ch = (s: number) => ((x >> s) & 255) + (((y >> s) & 255) - ((x >> s) & 255)) * t;
  return snes(ch(16), ch(8), ch(0));
}

type Ramp = Readonly<Record<string, string>>;

function ramp<T extends Record<string, string>>(r: T): Readonly<T> {
  const out: Record<string, string> = {};
  for (const k in r) out[k] = snes(r[k] as string);
  return Object.freeze(out) as Readonly<T>;
}

/** Default sprite outline: a near-black violet, never pure black. */
export const OUTLINE = snes('#100818');
export const WHITE = snes('#f8f8f8');
export const BLACK = snes('#000000');
export const TRANSPARENT = 'transparent';

/** Kestrel hull: white-gray with a cool cast. */
export const PLAYER = ramp({
  shadow: '#283048',
  dark: '#586078',
  base: '#9098b0',
  light: '#c8d0e0',
  highlight: '#f8f8f8',
});

/** Player accent: cobalt stripes and fins. */
export const COBALT = ramp({
  dark: '#102070',
  base: '#2048c8',
  light: '#4088f8',
  highlight: '#90c8f8',
});

export const CANOPY = ramp({
  dark: '#082840',
  base: '#1068a0',
  light: '#38b0e8',
  highlight: '#c0f8f8',
});

/** Engine flame, hottest last. */
export const FLAME = ramp({
  dark: '#a02000',
  base: '#f06800',
  light: '#f8b800',
  highlight: '#f8f8a0',
});

/** Scrap Syndicate rust. */
export const SYNDICATE = ramp({
  shadow: '#300808',
  dark: '#601810',
  base: '#a03020',
  light: '#d05830',
  highlight: '#f09058',
});
export const SYN = SYNDICATE;

export const OLIVE = ramp({
  dark: '#283010',
  base: '#506028',
  light: '#809040',
  highlight: '#b0c068',
});

export const GUNMETAL = ramp({
  dark: '#202028',
  base: '#404858',
  light: '#687080',
  highlight: '#a0a8b8',
});

/** Cockpit and engine glows. Sickly green is Syndicate-only. */
export const GLOW = ramp({
  greenDark: '#307810',
  green: '#90f040',
  greenHot: '#e0f8a0',
  amber: '#f8a800',
  red: '#f83030',
});

/** Level 1 asteroids: warm grays and browns. */
export const ROCK = ramp({
  shadow: '#201810',
  dark: '#403028',
  base: '#685040',
  light: '#988068',
  highlight: '#c8b090',
});

export const ICE = ramp({
  shadow: '#101830',
  dark: '#284060',
  base: '#4878a0',
  light: '#88b8d8',
  highlight: '#d0f0f8',
});

export const BASALT = ramp({
  shadow: '#080810',
  dark: '#181820',
  base: '#303038',
  light: '#505058',
  highlight: '#808088',
});

/** SNES menu windows. */
export const UI = ramp({
  windowTop: '#4060d0',
  windowBottom: '#081850',
  border: '#f8f8f8',
  borderOuter: '#606878',
  borderShade: '#202838',
  text: '#f8f8f8',
  textDim: '#a0a8c0',
  textGold: '#f8d850',
  textDebug: '#78f878',
  cursor: '#f8f8f8',
  barBack: '#181028',
  barFill: '#40c8f8',
  barHigh: '#b0f0f8',
  barWarn: '#f84838',
  shadow: '#000000',
});

/** Enemy bullets: magenta/pink ring with a white core. Nothing else may use this pairing. */
export const EBULLET = ramp({
  dark: '#901060',
  ring: '#f858b8',
  light: '#f8a0d8',
  core: '#f8f8f8',
});

/** Player bullets: cool tones only, never magenta. */
export const PBULLET = ramp({
  cyanDark: '#0878a8',
  cyan: '#38d8f8',
  cyanLight: '#a8f8f8',
  yellowDark: '#a87800',
  yellow: '#f8e030',
  yellowLight: '#f8f8b0',
  white: '#f8f8f8',
});

/** Pickup capsules: amber shell, deep letter. */
export const PICKUP = ramp({
  shadow: '#401800',
  dark: '#884000',
  base: '#d08800',
  light: '#f8c830',
  highlight: '#f8f0b0',
  letter: '#381000',
  band: '#f8f8f8',
});

export const FX = ramp({
  white: '#f8f8f8',
  yellow: '#f8e070',
  orange: '#f89030',
  red: '#c83818',
  smoke: '#584048',
  smokeDark: '#302030',
  spark: '#a8f8f8',
});

/** Every named ramp, for the gallery and the quantization test. Append new ramps here. */
export const RAMPS: Readonly<Record<string, Ramp>> = {
  PLAYER,
  COBALT,
  CANOPY,
  FLAME,
  SYNDICATE,
  OLIVE,
  GUNMETAL,
  GLOW,
  ROCK,
  ICE,
  BASALT,
  UI,
  EBULLET,
  PBULLET,
  PICKUP,
  FX,
  MISC: { OUTLINE, WHITE, BLACK },
};
