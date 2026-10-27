// Weapon roster, per docs/design.md → Weapons. Every tunable lives here; the
// weapon system only reads these tables.

export type WeaponId =
  | 'blaster'
  | 'spread'
  | 'lance'
  | 'seeker'
  | 'orbitDrones'
  // Act II (T35).
  | 'arc'
  | 'ricochet'
  | 'flak';

/** One level's numbers. Fields a weapon doesn't use are 0. */
export interface WeaponLevel {
  /** Seconds between volleys (divided by `stats.fireRateMul`). Unused by drones. */
  cooldown: number;
  /** Per shot, or per drone contact tick. Multiplied by `stats.damageMul`. */
  damage: number;
  /** Shots per volley, or drones in orbit. */
  count: number;
  /** Degrees. Spread: half-width of the fan. Seeker: launch angle off vertical. */
  spread: number;
  /** px/s. */
  speed: number;
  /** Seconds a shot lives. */
  ttl: number;
  /** Extra hits after the first (0 = dies on first hit). */
  pierce: number;
  /** Turn rate, rad/s. */
  homing: number;
  /** Collision radius of a shot or a drone. */
  radius: number;
  /** Blaster: px between parallel barrels. Seeker: px out to the wing pods. */
  offset: number;
  /** Drones: orbit radius around the ship, px. */
  orbitRadius: number;
  /** Drones: rad/s. */
  orbitSpeed: number;
  /** Drones: seconds between contact hits on the same enemy. */
  contactTick: number;
  /** Shot (or drone) sprite id for this level. */
  sprite: string;
  /**
   * Drones: seconds between sparks from each drone (0 = no sparks). The drones
   * take turns, so the whole orbit fires every `sparkCooldown / count` s.
   */
  sparkCooldown: number;
  /** Arc: enemies hit after the first. */
  chain: number;
  /** Arc: reach to the first target, px. */
  range: number;
  /** Ricochet: reflections before a disc stops bouncing. */
  bounces: number;
  /** Flak: fragments per burst (`damage` is the shell's impact hit). */
  fragments: number;
  /** Flak: per fragment. Multiplied by `stats.damageMul`. */
  fragDamage: number;
  /** Flak: enemy bullets within this many px of a burst are erased. */
  eraseR: number;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** Capsule letter. */
  letter: string;
  /** 12×12 HUD icon sprite id. */
  icon: string;
  /** Representative color (HUD pips, toasts). Player-bullet palette only. */
  color: string;
  /** sfx id per volley; '' for none. */
  sfx: string;
  levels: readonly WeaponLevel[];
}

export const WEAPON_MAX_LEVEL = 5;

/** What a pickup turns into when it can't add or level a weapon. */
export const WEAPON_CONVERT = { salvage: 25, score: 100 } as const;

const BASE: WeaponLevel = {
  cooldown: 0,
  damage: 0,
  count: 0,
  spread: 0,
  speed: 0,
  ttl: 0,
  pierce: 0,
  homing: 0,
  radius: 2,
  offset: 0,
  orbitRadius: 0,
  orbitSpeed: 0,
  contactTick: 0,
  sprite: '',
  sparkCooldown: 0,
  chain: 0,
  range: 0,
  bounces: 0,
  fragments: 0,
  fragDamage: 0,
  eraseR: 0,
};

function lv(o: Partial<WeaponLevel>): WeaponLevel {
  return Object.freeze({ ...BASE, ...o });
}

/** Builds 5 levels, each a delta on the previous one. */
function levels(first: Partial<WeaponLevel>, ...deltas: Partial<WeaponLevel>[]): WeaponLevel[] {
  const out = [lv(first)];
  for (const d of deltas) out.push(lv({ ...out[out.length - 1], ...d }));
  if (out.length !== WEAPON_MAX_LEVEL) throw new Error('weapon needs 5 levels');
  return out;
}

export const WEAPONS: Readonly<Record<WeaponId, WeaponDef>> = {
  // L1 1 shot 2.5/s; L2 faster; L3 twin; L4 +1 dmg; L5 triple. L4–L5 (T18) also fire
  // faster: max level should read as a wall of fire.
  blaster: {
    id: 'blaster',
    name: 'BLASTER',
    letter: 'B',
    icon: 'icon_blaster',
    color: '#38d8f8',
    sfx: 'shot_blaster',
    levels: levels(
      {
        cooldown: 0.4,
        damage: 1,
        count: 1,
        speed: 240,
        ttl: 1.8,
        radius: 2,
        offset: 4,
        sprite: 'pbullet_blaster',
      },
      { cooldown: 0.3 },
      { count: 2 },
      { damage: 2, cooldown: 0.25 },
      { count: 3, cooldown: 0.17, offset: 5, radius: 3, sprite: 'pbullet_blaster5' },
    ),
  },
  // 3-way ±12° 1.5/s; wider; wider; 5-way; faster. Short ttl: ~75% screen height.
  spread: {
    id: 'spread',
    name: 'SPREAD CANNON',
    letter: 'S',
    icon: 'icon_spread',
    color: '#f8e030',
    sfx: 'shot_spread',
    levels: levels(
      {
        cooldown: 0.667,
        damage: 1,
        count: 3,
        spread: 12,
        speed: 260,
        ttl: 1.15,
        radius: 3,
        sprite: 'pbullet_spread',
      },
      { spread: 16 },
      { spread: 20 },
      { count: 5, spread: 28 },
      { count: 7, spread: 36, cooldown: 0.4, radius: 4, sprite: 'pbullet_spread5' },
    ),
  },
  // Pierce 2; more pierce; more; thicker; faster.
  lance: {
    id: 'lance',
    name: 'PULSE LANCE',
    letter: 'L',
    icon: 'icon_lance',
    color: '#a8f8f8',
    sfx: 'shot_lance',
    levels: levels(
      {
        cooldown: 1.25,
        damage: 3,
        count: 1,
        speed: 420,
        ttl: 1.1,
        pierce: 2,
        radius: 2,
        sprite: 'pbullet_lance',
      },
      { pierce: 3 },
      { pierce: 4 },
      { radius: 4, sprite: 'pbullet_lance_w' },
      { cooldown: 0.55, pierce: 5, sprite: 'pbullet_lance5' },
    ),
  },
  // 1 missile 1/s; more missiles; then faster turn rate.
  seeker: {
    id: 'seeker',
    name: 'SEEKER PODS',
    letter: 'M',
    icon: 'icon_seeker',
    color: '#f8f8b0',
    sfx: 'shot_seeker',
    levels: levels(
      {
        cooldown: 1,
        damage: 2,
        count: 1,
        spread: 70,
        speed: 170,
        ttl: 2.6,
        homing: 3,
        radius: 3,
        offset: 9,
        sprite: 'pbullet_seeker',
      },
      { count: 2 },
      { count: 3 },
      { homing: 4.5 },
      { count: 6, homing: 6, cooldown: 0.7, sprite: 'pbullet_seeker5' },
    ),
  },
  // 1 drone r22 1 dmg/0.25 s; more drones; then larger radius; then more damage.
  // From L3 (T26) each drone also fires a spark (DRONE_SPARK), so a drone-heavy
  // loadout can still chip a boss it can't touch.
  orbitDrones: {
    id: 'orbitDrones',
    name: 'ORBIT DRONES',
    letter: 'D',
    icon: 'icon_orbitDrones',
    color: '#4088f8',
    sfx: '',
    levels: levels(
      {
        damage: 1,
        count: 1,
        radius: 4,
        orbitRadius: 22,
        orbitSpeed: 3.2,
        contactTick: 0.25,
        sprite: 'drone',
      },
      { count: 2 },
      { count: 3, sparkCooldown: 0.9 },
      { orbitRadius: 28, sparkCooldown: 0.7 },
      { damage: 2, count: 5, radius: 5, sprite: 'drone5', sparkCooldown: 0.5 },
    ),
  },
  // Every 1.2 s an arc hits the nearest enemy within 90 px, then chains 1 link
  // (50 px hops); +1 link; every 0.9 s; range 120 and +1 link; 3 dmg.
  arc: {
    id: 'arc',
    name: 'ARC COIL',
    letter: 'A',
    icon: 'icon_arc',
    color: '#f8f8f8',
    sfx: 'shot_lance',
    levels: levels(
      { cooldown: 1.2, damage: 2, count: 1, chain: 1, range: 90 },
      { chain: 2 },
      { cooldown: 0.9 },
      { range: 120, chain: 3 },
      { damage: 3 },
    ),
  },
  // A disc every 1.1 s alternating ±20°, 2 bounces, pierce 1; +1 bounce; twin
  // discs; +1 dmg; three discs and 4 bounces. Discs hit for 2, not design.md's
  // 1: at 1 the L1 disc dealt under a quarter of the Blaster's damage (T35 table).
  ricochet: {
    id: 'ricochet',
    name: 'RICOCHET',
    letter: 'R',
    icon: 'icon_ricochet',
    color: '#a8f8f8',
    sfx: 'shot_spread',
    levels: levels(
      {
        cooldown: 1.1,
        damage: 2,
        count: 1,
        spread: 20,
        speed: 200,
        ttl: 4,
        pierce: 1,
        radius: 2,
        bounces: 2,
        sprite: 'pbullet_disc',
      },
      { bounces: 3 },
      { count: 2 },
      { damage: 3 },
      { count: 3, bounces: 4 },
    ),
  },
  // A shell every 1.4 s at 140 px/s, bursting at 0.6 s (`ttl`) or on contact
  // into 6 fragments that erase enemy bullets within 12 px; 8 fragments; every
  // 1.1 s; 2-dmg fragments and an 18 px erase; two shells. `spread` fans the
  // L5 pair; fragments fly at FLAK_FRAGMENT's speed and ttl.
  flak: {
    id: 'flak',
    name: 'FLAK',
    letter: 'F',
    icon: 'icon_flak',
    color: '#f8e030',
    sfx: 'shot_seeker',
    levels: levels(
      {
        cooldown: 1.4,
        damage: 2,
        count: 1,
        speed: 140,
        ttl: 0.6,
        radius: 3,
        offset: 5,
        fragments: 6,
        fragDamage: 1,
        eraseR: 12,
        sprite: 'pbullet_flak',
      },
      { fragments: 8 },
      { cooldown: 1.1 },
      { fragDamage: 2, eraseR: 18, damage: 3 },
      { count: 2, spread: 8 },
    ),
  },
};

/**
 * The shot each drone fires from L3: weak, aimed once at the nearest targetable
 * enemy within `range` (straight up if none), no homing.
 */
export const DRONE_SPARK: WeaponLevel = lv({
  damage: 1,
  count: 1,
  speed: 220,
  ttl: 1.6,
  radius: 2,
  sprite: 'pbullet_spark',
});

/** Drone spark auto-aim reach, px. */
export const DRONE_SPARK_RANGE = 150;

/** Arc: max px from one link to the next. */
export const ARC_CHAIN_RANGE = 50;
/** Arc: seconds an arc stays on screen (render only). */
export const ARC_SHOW = 0.13;

/** Flak fragments: px/s, seconds alive, collision radius, sprite. */
export const FLAK_FRAGMENT = { speed: 160, ttl: 0.25, radius: 2, sprite: 'pbullet_frag' } as const;

/** Display and capsule-letter order. Sandbox keys: F1–F5 for the first five, F7–F9 for the rest. */
export const WEAPON_ORDER: readonly WeaponId[] = [
  'blaster',
  'spread',
  'lance',
  'seeker',
  'orbitDrones',
  'arc',
  'ricochet',
  'flak',
];

/** What a fresh save may find in capsules; Act II weapons unlock on their home sector's first clear. */
export const DEFAULT_UNLOCKED_WEAPONS: readonly WeaponId[] = [
  'blaster',
  'spread',
  'lance',
  'seeker',
  'orbitDrones',
];

export function isWeaponId(id: string): id is WeaponId {
  return Object.prototype.hasOwnProperty.call(WEAPONS, id);
}
