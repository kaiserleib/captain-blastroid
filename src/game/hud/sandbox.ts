import { flags } from '../../debug/flags';
import type { Enemy, WeaponInstance } from '../../sim/types';
import type { System, World } from '../../sim/world';

/**
 * `?sandbox&hud`: a scripted loop of fake state so every HUD widget can be seen
 * changing (all six weapon slots, hits, salvage, chain, timers, boss, the escape
 * countdown and its white-out). Dev only; it writes the
 * world the way gameplay systems would, which the HUD itself never does.
 */
export const hudDemoEnabled =
  flags.sandbox &&
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).has('hud');

const LOOP = 26;
const WEAPON_ORDER = ['blaster', 'spread', 'lance', 'seeker', 'orbitDrones', 'arc'];
/** The escape countdown starts once the demo boss is down and ends before the loop does. */
const ESCAPE_AT = 20.5;
const ESCAPE_DUR = 3.5;
const BOSS_DEF = 'scrap_baron';
const PART_HP = [120, 60, 60];

function weapon(id: string): WeaponInstance {
  return { id, level: 1, cooldown: 0, state: 0 };
}

function spawnBossPart(w: World, x: number, y: number, hp: number): void {
  const e = w.enemies.spawn();
  if (!e) return;
  e.id = w.nextId();
  e.x = e.prevX = x;
  e.y = e.prevY = y;
  e.vx = e.vy = 0;
  e.r = 0;
  e.hp = e.maxHp = hp;
  e.flashT = 0;
  e.defId = BOSS_DEF;
  e.t = 0;
  e.state = 0;
  e.ax = e.ay = 0;
  e.fireT = 1e9;
  e.avoidsAsteroids = false;
  e.formationId = -1;
  e.isBoss = true;
  e.contactDamage = 0;
}

function eachBoss(w: World, fn: (e: Enemy, i: number) => void): void {
  let n = 0;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i] as Enemy;
    if (e.active && e.isBoss) fn(e, n++);
  }
}

export function createHudDemoSystem(): System {
  let last = -1;
  let hooked: World | null = null;
  const crossed = (a: number, t: number): boolean => last < a && t >= a;
  return {
    name: 'hudDemo',
    update(w: World, dt: number) {
      if (hooked !== w) {
        hooked = w;
        // GameScene doesn't open a pause menu yet (T17); log so the button can be checked.
        w.events.on('pauseRequested', () => console.info('[hud demo] pauseRequested'));
      }
      const p = w.player;
      const run = w.run;
      const t = w.time % LOOP;
      if (t < last) last = -1;

      if (crossed(0, t)) {
        p.maxShield = 5;
        p.shield = 5;
        p.maxWeaponSlots = 6;
        p.weapons.length = 0;
        p.weapons.push(weapon('blaster'));
        run.score = 0;
        run.salvage = 0;
        run.chain = 1;
      }
      for (let i = 1; i < WEAPON_ORDER.length; i++) {
        if (crossed(i * 1.5, t)) p.weapons.push(weapon(WEAPON_ORDER[i] as string));
      }
      for (let s = 2; s < 12; s += 0.75) {
        if (crossed(s, t)) {
          const wi = p.weapons[Math.floor(s * 4) % p.weapons.length];
          if (wi && wi.level < 5) wi.level++;
        }
      }
      if (crossed(3, t) || crossed(5, t) || crossed(15, t)) p.shield = Math.max(0, p.shield - 1);
      if (crossed(9, t) || crossed(20, t)) p.shield = Math.min(p.maxShield, p.shield + 1);
      if (crossed(7, t)) p.magnetT = 8;
      if (crossed(8, t)) p.repulsorT = 6;
      p.magnetT = Math.max(0, p.magnetT - dt);
      p.repulsorT = Math.max(0, p.repulsorT - dt);

      run.score += Math.floor(dt * 1500);
      if (Math.floor(t * 3) !== Math.floor(Math.max(0, last) * 3)) run.salvage += 1;
      run.chain = t < 4 ? 1 : 1 + (Math.floor(t / 1.5) % 8);

      if (crossed(11, t)) w.events.emit('bossWarning', {});
      if (crossed(ESCAPE_AT, t)) w.events.emit('escapeStarted', { dur: ESCAPE_DUR });
      if (crossed(13.5, t)) {
        spawnBossPart(w, 120, 70, PART_HP[0] as number);
        spawnBossPart(w, 80, 80, PART_HP[1] as number);
        spawnBossPart(w, 160, 80, PART_HP[2] as number);
        w.events.emit('bossSpawned', { defId: BOSS_DEF });
      }
      if (t > 14.5 && Math.floor(t * 4) !== Math.floor(last * 4)) {
        // Wing parts die first, then the core.
        let alive = 0;
        eachBoss(w, () => alive++);
        eachBoss(w, (e, i) => {
          if (alive > 1 && i === 0) return;
          e.hp -= alive > 1 ? 7 : 10;
          if (e.hp <= 0) w.enemies.release(e);
        });
      }
      last = t;
    },
  };
}
