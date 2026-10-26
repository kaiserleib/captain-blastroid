// Weapon roster, per docs/design.md → Weapons. Every tunable lives here; the
// weapon system only reads these tables.

export type WeaponId = 'blaster' | 'spread' | 'lance' | 'seeker' | 'orbitDrones';

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
  // L1 1 shot 2.5/s; L2 faster; L3 twin; L4 +1 dmg; L5 triple.
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
      { damage: 2 },
      { count: 3, cooldown: 0.25, offset: 5, radius: 3, sprite: 'pbullet_blaster5' },
    ),
  },
  // 3-way ±12° 1.5/s; wider; wider; 5-way; faster. Short ttl: ~70% screen height.
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
        ttl: 1.05,
        radius: 3,
        sprite: 'pbullet_spread',
      },
      { spread: 16 },
      { spread: 20 },
      { count: 5, spread: 28 },
      { cooldown: 0.45, radius: 4, sprite: 'pbullet_spread5' },
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
      { cooldown: 0.8, pierce: 5, sprite: 'pbullet_lance5' },
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
      { count: 4, homing: 6, cooldown: 0.8, sprite: 'pbullet_seeker5' },
    ),
  },
  // 1 drone r22 1 dmg/0.25 s; more drones; then larger radius; then more damage.
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
      { count: 3 },
      { orbitRadius: 28 },
      { damage: 2, count: 4, radius: 5, sprite: 'drone5' },
    ),
  },
};

/** Display / sandbox key order (F1–F5). */
export const WEAPON_ORDER: readonly WeaponId[] = [
  'blaster',
  'spread',
  'lance',
  'seeker',
  'orbitDrones',
];

export function isWeaponId(id: string): id is WeaponId {
  return Object.prototype.hasOwnProperty.call(WEAPONS, id);
}
