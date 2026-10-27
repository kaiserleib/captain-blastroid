import { snes } from '../gfx/palette';

export { snes };

/** dark → shadow → base → light, lit from the top-left. */
export interface Ramp {
  readonly dark: string;
  readonly shadow: string;
  readonly base: string;
  readonly light: string;
}

export interface SkinRamp extends Ramp {
  readonly lip: string;
}

function ramp(dark: string, shadow: string, base: string, light: string): Ramp {
  return { dark: snes(dark), shadow: snes(shadow), base: snes(base), light: snes(light) };
}

function skin(dark: string, shadow: string, base: string, light: string, lip: string): SkinRamp {
  return { ...ramp(dark, shadow, base, light), lip: snes(lip) };
}

export const OUTLINE = snes('#100818');

export const SKIN = {
  pale: skin('#a06050', '#d09878', '#f0c8a0', '#f8e0c8', '#c87870'),
  light: skin('#905038', '#c08860', '#e0b080', '#f0c8a0', '#b86858'),
  tan: skin('#784028', '#a87048', '#c89060', '#e0b080', '#a05848'),
  brown: skin('#502818', '#7a5030', '#9a6840', '#b88858', '#804038'),
  deep: skin('#301810', '#4a2c1c', '#684430', '#886048', '#603028'),
  green: skin('#204820', '#408040', '#68b058', '#98d880', '#386830'),
  bluegray: skin('#303848', '#506880', '#7890a8', '#a0b8c8', '#506078'),
  lavender: skin('#483060', '#7860a0', '#a890c8', '#c8b8e8', '#705088'),
} as const;
export type SkinTone = keyof typeof SKIN;
export const HUMAN_SKINS: readonly SkinTone[] = ['pale', 'light', 'tan', 'brown', 'deep'];
export const ALIEN_SKINS: readonly SkinTone[] = ['green', 'bluegray', 'lavender'];

export const HAIR = {
  black: ramp('#080808', '#100c10', '#282028', '#403840'),
  darkBrown: ramp('#180c08', '#281810', '#402818', '#604030'),
  brown: ramp('#281808', '#402818', '#644028', '#886040'),
  auburn: ramp('#381008', '#582010', '#884020', '#b06030'),
  red: ramp('#481008', '#702010', '#a83818', '#d06030'),
  blonde: ramp('#604818', '#987028', '#c8a048', '#e8d070'),
  platinum: ramp('#787060', '#a8a088', '#d0c8b0', '#f0e8d8'),
  gray: ramp('#383840', '#585860', '#808088', '#a8a8b0'),
  white: ramp('#707080', '#a0a0b0', '#c8c8d8', '#f0f0f8'),
  cyan: ramp('#004050', '#087088', '#10b0c8', '#68f0f8'),
  magenta: ramp('#480838', '#801860', '#c83098', '#f070d0'),
  lime: ramp('#204008', '#407010', '#70b018', '#b0f040'),
} as const;
export type HairColor = keyof typeof HAIR;
export const NATURAL_HAIR: readonly HairColor[] = [
  'black',
  'darkBrown',
  'brown',
  'auburn',
  'red',
  'blonde',
  'platinum',
];
export const NEON_HAIR: readonly HairColor[] = ['cyan', 'magenta', 'lime'];

/** Squadron colors for flight suits. */
export const UNIFORM = {
  cobalt: ramp('#101848', '#203888', '#3058c0', '#5888e8'),
  orange: ramp('#582008', '#a04810', '#d87020', '#f8a848'),
  olive: ramp('#182010', '#384818', '#586830', '#7a8c48'),
  purple: ramp('#200c38', '#402068', '#603898', '#8860c0'),
  crimson: ramp('#300810', '#681820', '#982830', '#c84848'),
  teal: ramp('#082020', '#104848', '#207070', '#40a098'),
  gunmetal: ramp('#141418', '#2c2c38', '#4c4c5c', '#747488'),
  sand: ramp('#382818', '#685838', '#988860', '#c0b088'),
} as const;
export type UniformColor = keyof typeof UNIFORM;
export const UNIFORM_COLORS = Object.keys(UNIFORM) as UniformColor[];

export const METAL = ramp('#283038', '#586068', '#8890a0', '#c8d0d8');
export const HELMET = {
  white: ramp('#484c60', '#9098a8', '#d0d8e0', '#f8f8f8'),
  metal: METAL,
  dark: ramp('#101018', '#282830', '#404050', '#686878'),
  /** Hazard yellow: mining hard hats. Not in the random helmet pool. */
  hazard: ramp('#584000', '#987000', '#d8a818', '#f8e060'),
} as const;
export type HelmetColor = keyof typeof HELMET | 'uniform';

export const VISOR = {
  blue: ramp('#081020', '#183060', '#2860a0', '#68b0e8'),
  gold: ramp('#382008', '#805010', '#c09020', '#f8e070'),
  smoke: ramp('#080810', '#202028', '#404858', '#8090a8'),
} as const;
export type VisorTint = keyof typeof VISOR;

export const ACCENT = {
  gold: snes('#e0b030'),
  white: snes('#f0f0f0'),
  red: snes('#d83030'),
  cyan: snes('#38d0e0'),
  yellow: snes('#f8e040'),
} as const;
export type AccentColor = keyof typeof ACCENT;

export const IRIS = {
  green: snes('#3a6a2a'),
  hazel: snes('#6a5020'),
  blue: snes('#2a50a0'),
  brown: snes('#4a2a10'),
  gray: snes('#607080'),
  dark: snes('#201818'),
  gold: snes('#e0b020'),
  red: snes('#d02828'),
  magenta: snes('#c838c0'),
  cyan: snes('#30d8e8'),
} as const;
export const IRIS_HUMAN: readonly string[] = [
  IRIS.green,
  IRIS.hazel,
  IRIS.blue,
  IRIS.brown,
  IRIS.gray,
  IRIS.dark,
];
export const IRIS_ALIEN: readonly string[] = [IRIS.gold, IRIS.red, IRIS.magenta, IRIS.cyan];

export const FACE = {
  eyeWhite: snes('#e8e0d0'),
  pupil: snes('#100818'),
  mouth: snes('#401018'),
  teeth: snes('#f0e8e0'),
  scar: snes('#e0a090'),
  plaster: snes('#e8d0a0'),
  plasterShade: snes('#b89870'),
  patch: snes('#181018'),
  tattoo: snes('#2858a0'),
  lens: snes('#a8d8e8'),
  burn: snes('#c07868'),
} as const;

export const GLOW = {
  red: snes('#f82828'),
  green: snes('#48f848'),
  amber: snes('#f8a020'),
  cyan: snes('#48f8f8'),
  white: snes('#f8f8f8'),
} as const;

/** Background materials, kept at ≤ 35% value so the pilot pops. */
export const BG = {
  steel: ramp('#0c0c14', '#181c28', '#242c3c', '#344058'),
  moss: ramp('#0c100c', '#182018', '#243024', '#344434'),
  rust: ramp('#140c0c', '#241818', '#342420', '#483430'),
  space: snes('#080818'),
  hazard: snes('#585018'),
  hazardDark: snes('#181408'),
} as const;
export type BgTint = 'steel' | 'moss' | 'rust';
