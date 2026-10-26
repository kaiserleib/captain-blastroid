import { createRng, type Rng } from '../engine/rng';
import {
  ALIEN_SKINS,
  HUMAN_SKINS,
  IRIS_ALIEN,
  IRIS_HUMAN,
  NATURAL_HAIR,
  NEON_HAIR,
  UNIFORM_COLORS,
  type AccentColor,
  type BgTint,
  type HairColor,
  type HelmetColor,
  type SkinTone,
  type UniformColor,
  type VisorTint,
} from './palette';

export const HEAD_SHAPES = ['oval', 'round', 'long', 'square', 'heavy'] as const;
export const EYE_STYLES = ['normal', 'wide', 'narrow', 'round', 'tired', 'large'] as const;
export const NOSE_STYLES = ['straight', 'button', 'long', 'broad', 'hooked', 'none'] as const;
export const MOUTH_STYLES = ['neutral', 'grin', 'grim', 'smirk', 'open'] as const;
export const FACIAL_HAIR = ['none', 'stubble', 'mustache', 'goatee', 'beard', 'fullBeard'] as const;
export const HAIR_STYLES = [
  'bald',
  'buzz',
  'crop',
  'mohawk',
  'longTied',
  'undercut',
  'swept',
  'bob',
  'long',
] as const;
export const HEADGEAR = [
  'none',
  'headset',
  'helmetUp',
  'helmetDown',
  'bandana',
  'cyberCrest',
] as const;
export const ACCESSORIES = [
  'scar',
  'eyepatch',
  'cyberEye',
  'tattoo',
  'plaster',
  'freckles',
] as const;
export const BACKGROUNDS = ['bulkhead', 'porthole', 'hangar'] as const;
export const SUITS = ['flightSuit', 'jacket', 'armored'] as const;
export const INSIGNIA = ['chevron', 'star', 'bolt', 'ring'] as const;

export type Age = 'young' | 'middle' | 'old';
export type Sex = 'm' | 'f';
export type HeadShape = (typeof HEAD_SHAPES)[number];
export type EyeStyle = (typeof EYE_STYLES)[number];
export type NoseStyle = (typeof NOSE_STYLES)[number];
export type MouthStyle = (typeof MOUTH_STYLES)[number];
export type FacialHair = (typeof FACIAL_HAIR)[number];
export type HairStyle = (typeof HAIR_STYLES)[number];
export type Headgear = (typeof HEADGEAR)[number];
export type Accessory = (typeof ACCESSORIES)[number];
export type Background = (typeof BACKGROUNDS)[number];
export type Suit = (typeof SUITS)[number];
export type Insignia = (typeof INSIGNIA)[number];

export interface PortraitTraits {
  age: Age;
  sex: Sex;
  alien: boolean;
  skin: SkinTone;
  /** Alien extras. */
  antennae: boolean;
  browRidge: boolean;
  head: HeadShape;
  eyes: EyeStyle;
  irisColor: string;
  nose: NoseStyle;
  mouth: MouthStyle;
  facialHair: FacialHair;
  hair: HairStyle;
  hairColor: HairColor;
  headgear: Headgear;
  helmetColor: HelmetColor;
  visorTint: VisorTint;
  /** Derived from headgear; forcing it true forces `helmetDown`. Hides the eyes/nose layers. */
  visorDown: boolean;
  accessories: Accessory[];
  uniform: UniformColor;
  suit: Suit;
  shoulderPads: boolean;
  tubes: boolean;
  insignia: Insignia;
  patchColor: AccentColor;
  background: Background;
  bgTint: BgTint;
}

export type PortraitOverrides = Partial<PortraitTraits>;

const FEMALE_HAIR: readonly HairStyle[] = ['crop', 'longTied', 'undercut', 'swept', 'bob', 'long'];
const MALE_HAIR: readonly HairStyle[] = [
  'bald',
  'buzz',
  'crop',
  'crop',
  'mohawk',
  'longTied',
  'undercut',
  'swept',
];
const ALIEN_HAIR: readonly HairStyle[] = ['bald', 'bald', 'bald', 'mohawk', 'long', 'crop'];
const MALE_FACIAL: readonly FacialHair[] = [
  'none',
  'none',
  'none',
  'stubble',
  'mustache',
  'goatee',
  'beard',
  'fullBeard',
];
const HEADGEAR_POOL: readonly Headgear[] = [
  'none',
  'none',
  'none',
  'headset',
  'headset',
  'helmetUp',
  'helmetUp',
  'helmetDown',
  'bandana',
  'cyberCrest',
];

/**
 * Each trait rolls from its own forked stream, so overriding one trait never shifts the
 * rolls of the others. Traits that depend on earlier ones (hair pools by sex) read the
 * final, overridden value.
 */
export function rollTraits(seed: string | number, ov: PortraitOverrides = {}): PortraitTraits {
  // One mulberry round scrambles the seed first; similar seeds ("P1", "P2") otherwise
  // fork into visibly correlated trait streams.
  const root = createRng((createRng(seed).next() * 4294967296) | 0);
  const r = (label: string): Rng => root.fork(label);

  const sex: Sex = ov.sex ?? (r('sex').chance(0.4) ? 'f' : 'm');
  const ageRng = r('age');
  const age: Age =
    ov.age ?? (ageRng.chance(0.3) ? 'young' : ageRng.chance(0.65) ? 'middle' : 'old');

  const alienRng = r('alien');
  const alien = ov.alien ?? (ov.skin ? ALIEN_SKINS.includes(ov.skin) : alienRng.chance(0.08));
  const skin: SkinTone = ov.skin ?? r('skin').pick(alien ? ALIEN_SKINS : HUMAN_SKINS);
  const extras = r('alienExtras');
  const antennae = ov.antennae ?? (alien && extras.chance(0.55));
  const browRidge = ov.browRidge ?? (alien && extras.chance(0.5));

  const head: HeadShape = ov.head ?? r('head').pick(HEAD_SHAPES);
  const eyeRng = r('eyes');
  const eyes: EyeStyle =
    ov.eyes ?? (alien && eyeRng.chance(0.6) ? 'large' : eyeRng.pick(EYE_STYLES.slice(0, 5)));
  const irisColor = ov.irisColor ?? r('iris').pick(alien ? IRIS_ALIEN : IRIS_HUMAN);
  const noseRng = r('nose');
  const nose: NoseStyle =
    ov.nose ?? (alien && noseRng.chance(0.5) ? 'none' : noseRng.pick(NOSE_STYLES.slice(0, 5)));
  const mouth: MouthStyle = ov.mouth ?? r('mouth').pick(MOUTH_STYLES);

  const facialHair: FacialHair =
    ov.facialHair ?? (sex === 'f' || alien ? 'none' : r('facialHair').pick(MALE_FACIAL));
  const hair: HairStyle =
    ov.hair ?? r('hair').pick(alien ? ALIEN_HAIR : sex === 'f' ? FEMALE_HAIR : MALE_HAIR);
  const hcRng = r('hairColor');
  let hairColor: HairColor = hcRng.pick(NATURAL_HAIR);
  if (hcRng.chance(0.12) || alien) hairColor = hcRng.pick(NEON_HAIR);
  if (age === 'old' && hcRng.chance(0.65)) hairColor = hcRng.chance(0.5) ? 'gray' : 'white';
  if (ov.hairColor) hairColor = ov.hairColor;

  const hgRng = r('headgear');
  let headgear: Headgear = ov.headgear ?? hgRng.pick(HEADGEAR_POOL);
  if (ov.visorDown === true) headgear = 'helmetDown';
  else if (ov.visorDown === false && headgear === 'helmetDown') headgear = 'helmetUp';
  const helmetColor: HelmetColor =
    ov.helmetColor ??
    r('helmetColor').pick<HelmetColor>(['white', 'white', 'uniform', 'metal', 'dark']);
  const visorTint: VisorTint =
    ov.visorTint ?? r('visorTint').pick<VisorTint>(['blue', 'gold', 'smoke']);

  const accRng = r('accessories');
  let accessories: Accessory[] = [];
  if (accRng.chance(0.45)) accessories.push(accRng.pick(ACCESSORIES));
  if (accRng.chance(0.12)) {
    const second = accRng.pick(ACCESSORIES);
    if (!accessories.includes(second)) accessories.push(second);
  }
  // An eyepatch and a cyber eye fight over the same socket.
  if (accessories.includes('eyepatch') && accessories.includes('cyberEye')) accessories.pop();
  if (ov.accessories) accessories = [...ov.accessories];

  const uniform: UniformColor = ov.uniform ?? r('uniform').pick(UNIFORM_COLORS);
  const suit: Suit = ov.suit ?? r('suit').pick(SUITS);
  const gear = r('gear');
  const shoulderPads = ov.shoulderPads ?? (suit === 'armored' || gear.chance(0.15));
  const tubes = ov.tubes ?? gear.chance(0.3);
  const insignia: Insignia = ov.insignia ?? r('insignia').pick(INSIGNIA);
  const patchColor: AccentColor =
    ov.patchColor ?? r('patch').pick<AccentColor>(['gold', 'white', 'red', 'cyan', 'yellow']);
  const background: Background = ov.background ?? r('background').pick(BACKGROUNDS);
  const bgTint: BgTint = ov.bgTint ?? r('bgTint').pick<BgTint>(['steel', 'steel', 'moss', 'rust']);

  return {
    age,
    sex,
    alien,
    skin,
    antennae,
    browRidge,
    head,
    eyes,
    irisColor,
    nose,
    mouth,
    facialHair,
    hair,
    hairColor,
    headgear,
    helmetColor,
    visorTint,
    visorDown: headgear === 'helmetDown',
    accessories,
    uniform,
    suit,
    shoulderPads,
    tubes,
    insignia,
    patchColor,
    background,
    bgTint,
  };
}
