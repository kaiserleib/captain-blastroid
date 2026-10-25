# Game Design — Captain Blastroid

A vertical-scrolling shmup for phones, with browser-first development. Inspirations:

- **1942:** constant upward scroll, enemies in formations, red-squadron bonus drops, compact arcade levels.
- **UN Squadron:** SNES presentation, chunky bosses built from destructible parts, a hangar between missions, distinct pilots.
- **Vampire Survivors:** always-on auto-fire, stacking several weapons, a small number of inputs, short runs feeding a persistent unlock meta, characters with passives, a satisfying "number goes up" power curve.

**Design pillars**
1. **One thumb.** Movement is the only input. Every decision is *where to be*.
2. **Readable chaos.** SNES clarity: strong silhouettes, enemy bullets that always contrast with the background, and a hit flash on everything.
3. **Power you can feel within a run.** You start weak (one slow blaster) and leave a level with four weapons spraying the screen.
4. **Runs feed the hangar.** Every run earns salvage, and rare finds (schematics, escape pods) permanently widen the roster.

Everything below marked *(MVP)* is in scope for the first playable. Everything else is design direction for later tickets.

---

## Controls

| Platform | Input | Behavior |
|---|---|---|
| Desktop | Mouse / trackpad | Ship flies toward the cursor at its max speed and eases in over the last ~8 px. It does not teleport. This applies while the pointer is over the canvas, and pointer movement takes priority over keys. |
| Desktop | Arrow keys / WASD | 8-way digital movement at max speed. Diagonals are normalized. |
| Desktop | Esc / P | Pause |
| Mobile | Floating virtual stick | Touching anywhere spawns the stick base under the finger. Drag offset gives direction and magnitude (deadzone 6 px, full deflection at 40 CSS px). If the finger travels past the radius, the base follows it, Vampire Survivors-style. Releasing stops the ship. The stick draws as a translucent ring and knob. |
| Mobile | Pause button | Top corner, inside the safe area, 44 px tap target. The game also auto-pauses on app background. |

The ship **always fires**, with no fire button. Weapons have no ammo.

## The run *(MVP: Level 1 only)*

1. **Hangar:** choose pilot and ship, then launch.
2. **Level:** about 3.5 minutes of scripted waves at a fixed scroll rate, ending in a boss.
3. **Results:** score, salvage banked, discoveries (schematics, rescued pilots).
4. Later: several levels per sortie with weapons carried between them, and a run ends on death or after the final boss. The MVP ends the sortie after Level 1.

### Death and damage
- The ship has **shield segments** (Kestrel: 3). Each hit removes one segment and grants **1.0 s of invulnerability** (the sprite blinks).
- A hit taken at 0 segments destroys the ship and ends the run. Salvage collected so far is kept, because a run is never wasted.
- Contact with an enemy costs 1 segment and deals 5 damage to the enemy. Contact with an asteroid costs 1 segment and destroys the asteroid if it is destructible.

## Scrolling and space
- The visual scroll is **30 px/s** upward in Level 1 (the backgrounds move down).
- Objects enter from the top edge (occasionally the top corners) and are removed after leaving the bottom or the sides by more than their radius plus 16 px.
- The player is clamped to the playfield with an 8 px margin.

## Weapons *(MVP: all five)*

There are up to **N weapon slots**, set by the ship. Each weapon fires automatically on its own cooldown and has **levels 1–5**.

| Weapon | L1 | Leveling direction | Role |
|---|---|---|---|
| **Blaster** (starter) | 1 shot, 2.5 shots/s, 1 dmg, 240 px/s | L2 faster, L3 twin, L4 +1 dmg, L5 triple | Weak and reliable. Destroys Level 1 asteroids in one hit. |
| **Spread Cannon** | 3-way fan at ±12°, 1.5/s, 1 dmg | Wider fan, then 5-way at L4, then faster | Crowd control |
| **Pulse Lance** | Piercing bolt, 0.8/s, 3 dmg, pierce 2 | More pierce, then thicker, then faster | Lines and armored targets |
| **Seeker Pods** | 1 homing missile, 1/s, 2 dmg | More missiles, then faster turn rate | Hits targets off-axis |
| **Orbit Drones** | 1 drone orbiting at radius 22, 1 contact dmg per 0.25 s, **blocks enemy bullets** | More drones, then larger radius, then more damage | VS-style defensive weapon |

**Weapon pickup resolution:** an unowned weapon with a free slot is added at L1. An owned weapon gains a level. If the weapon is at max level, or the slots are full and it isn't owned, it converts to 25 salvage and score. A **Weapon Upgrade core** levels the lowest-level owned weapon that isn't maxed (ties go to the oldest).

There is no mid-run level-up menu, because menus mean friction on mobile. Pickups *are* the progression. A toast confirms what changed (e.g. "SPREAD CANNON LV3").

## Pickups *(MVP: all)*

Pickups drift down at scroll speed plus 10 px/s and blink during their last 2 s before expiring (10 s ttl). The pickup radius is 14 px by default.

| Pickup | Effect | Source |
|---|---|---|
| Weapon capsule | Adds or levels a specific weapon (letter on the capsule: B/S/L/M/D) | Formation-clear bonus, carriers, rare enemy drop |
| Upgrade core | Levels the lowest owned weapon | Uncommon drop |
| Shield cell | +1 shield segment (capped at max). At full shield: +100 score. | Uncommon drop |
| Magnet | 8 s: every pickup on screen homes to the player | Rare drop |
| Repulsor | 6 s: enemy bullets inside 48 px are pushed outward; asteroids are pushed too and can then hit enemies | Rare drop |
| Salvage | Meta currency (1 / 5 / 25 sizes) | Most kills and asteroids |
| Ship schematic | Unlocks a ship blueprint in the hangar | Boss guaranteed (first clear), very rare elite drop |
| Escape pod | Drifts slowly (12 px/s) and is destroyed by enemy fire. Collecting it rescues a pilot. | Scripted, once per level, until all pilots are rescued |

**Drop rule (1942 nod):** destroying every member of a formation drops a weapon capsule where the last member died. The capsule weapon is weighted toward weapons the player owns but hasn't maxed, 50% of the time.

## Obstacles

| Obstacle | Destructible | Behavior | Level |
|---|---|---|---|
| **Small asteroid** | 1 HP | Straight-line drift, spins | L1 *(MVP)* |
| **Medium asteroid** | 1 HP in L1; 4 HP later | Splits into 2 smalls (L2+) | L1 *(MVP, 1 HP, no split)* |
| **Large asteroid** | 10 HP | Splits into 2 mediums | L2+ |
| **Black hole** | Never | Gravity well that pulls the player, pickups and *all* bullets toward it. The core (r=8) absorbs bullets and damages the player. | L3+ |
| **Pulsar** | Never | Pulses an expanding damage ring every 3 s, telegraphed by a 0.6 s glow | L4+ |

Asteroids move **in straight lines** and change course only when a force acts on them: the repulsor, a black hole, or (later) a tractor-beam enemy or weapon. Forces go through a single `applyRadialForce` helper so every source behaves the same. Asteroids do not collide with each other.

**Bullets vs. obstacles:** player shots damage destructible asteroids and are absorbed by indestructible obstacles. Enemy shots are **absorbed** by asteroids without damaging them, so asteroids double as cover.

## Enemies *(MVP: Level 1 roster)*

Enemies don't collide with each other. Asteroids damage enemies they hit, with the asteroid's HP in damage to both. Dumb enemies fly through asteroid fields and get destroyed. Smart enemies steer around asteroids within 40 px ahead of them using a simple avoidance force. No enemy ever dodges player shots.

| Enemy | HP | Smart? | Movement | Attack | Salvage |
|---|---|---|---|---|---|
| **Gnat** | 1 | Dumb | Straight down at 70 px/s, often in V or column formations | None (rams) | 1 |
| **Swooper** | 2 | Dumb | Enters from a top corner on a sine/arc path and exits a side | One aimed shot at 1.2 s | 1 |
| **Gunboat** | 6 | Smart | Descends to y≈80, holds while strafing slowly, leaves after 6 s | 3-way spread every 1.5 s | 5 |
| **Interceptor** | 3 | Smart | Lags behind the player's x, descends, avoids asteroids | Aimed pair every 2 s | 2 |
| **Carrier** (powerup carrier) | 8 | Dumb | Slow straight line across the screen, never shoots | None. Always drops a weapon capsule. | 5 |

**Enemy bullets:** 60–110 px/s in L1. They are always drawn in the high-contrast enemy-bullet palette (magenta/white core). Their hitboxes are smaller than their sprites (r=2 for an 8 px bullet). The player's hitbox is r=4 on a 24 px ship, a forgiving shmup convention.

## Level 1: "The Kessler Belt" *(MVP)*

About 210 s. The difficulty ramps through scripted waves on a timeline, with light procedural spice (asteroid density, formation entry positions via the seeded RNG).

| Time | Beat |
|---|---|
| 0–15 s | Sparse small asteroids only. The player learns to move and sees one shot pop a rock. |
| 15–45 s | Gnat columns and V-formations. First formation-clear capsule (forced to Spread Cannon). |
| 45–75 s | Swoopers from the corners. A denser asteroid band shows dumb enemies dying on rocks. |
| ~60 s | Carrier crosses the screen with a guaranteed capsule. |
| 75–110 s | Gunboats in pairs (smart, steer around rocks). Shield cells start dropping. |
| ~100 s | **Escape pod** drifts down (first rescuable pilot) |
| 110–150 s | Mixed waves with interceptors, and a magnet drop. |
| ~135 s | Second carrier. |
| 150–180 s | Asteroid storm with gnat swarms (the screen-clearing power-fantasy beat). |
| 180 s | Warning siren and the **boss** |

**Boss: Rock Hauler** (a mining barge, about 96×64). It **throws asteroids at you**, which fits the asteroid physics the level already taught.
- Parts: 2 side clamp-turrets (20 HP each, aimed bursts) and the central core (60 HP, exposed only once both turrets are destroyed).
- Phase 1: strafes horizontally at the top. Turrets fire, and every 4 s it flings a medium asteroid toward the player at 90 px/s.
- Phase 2 (core exposed): spins up drills, fires a rotating 8-way bullet ring every 2 s, and asteroids are flung in pairs.
- Defeat: a 2 s chain of explosions, then a schematic drop (first clear) plus 100 salvage, then "SECTOR CLEAR".

## Ships *(MVP: 3 defined; Kestrel unlocked at start)*

| Ship | Shield | Speed | Slots | Starting weapon | Unlock |
|---|---|---|---|---|---|
| **Kestrel** | 3 | 120 px/s | 4 | Blaster | Start |
| **Bulwark** | 5 | 95 px/s | 3 | Blaster + Orbit Drones L1 | Rock Hauler schematic (first L1 clear) + 150 salvage to build |
| **Dart** | 2 | 150 px/s | 5 | Blaster | Rare elite-drop schematic (MVP: second L1 clear) + 300 salvage |

## Pilots *(MVP: 4 defined; Captain Blastroid unlocked at start)*

Each pilot has one passive and a procedurally generated sci-fi portrait with a fixed seed plus trait overrides (see `art-direction.md`).

| Pilot | Passive | Unlock |
|---|---|---|
| **Captain Blastroid** | +10% pickup radius, otherwise balanced | Start |
| **Juno Sparks** | +15% fire rate on all weapons | Escape pod, Level 1 |
| **Old Grieg** | +1 max shield, −10% speed | Escape pod, Level 1 (second pod after Juno) |
| **Zz'kar** (alien) | Powerup durations +50%, +25% salvage | Escape pod (post-MVP level) |

## Meta progression *(MVP: salvage, ship building, pilot rescue, 4 hangar upgrades)*

- **Salvage** is banked after every run, whether you died or won.
- **Hangar upgrades** are permanent, bought with salvage, and have levels like Vampire Survivors' PowerUps:
  - Reinforced Plating: +1 max shield (1 level, 200)
  - Overcharged Capacitors: +5% damage per level (5 levels, 50 × level)
  - Tractor Coils: +15% pickup radius per level (3 levels, 40 × level)
  - Field Generators: +10% powerup duration per level (3 levels, 60 × level)
- **Ships** need a schematic (found in a run) plus salvage to build.
- **Pilots** must be rescued from escape pods during runs and are available immediately afterward.
- Post-MVP: weapon unlocks (new weapons added to the drop pool via achievements, like VS evolutions), and weapon "evolutions" (a max-level weapon plus a specific passive combine into a super weapon).

## Scoring
Score = kills × enemy value, plus asteroid kills (10 each), pickups, and the boss. There is a **chain multiplier** of ×1 to ×8 that rises with kills made within 1.5 s of each other and resets on hit. Score is for arcade bragging and a local high-score table. Salvage is what matters for progression.

## Post-MVP level ideas
2. **Ion Shoals:** large splitting asteroids, tractor-beam enemies that pull rocks, and the first escape-pod gauntlet.
3. **Event Horizon:** black holes curve every bullet (yours too), and a slingshot boss.
4. **Pulsar Nursery:** pulse-ring timing puzzles, with the scroll speed changing mid-level.
5. **The Armada:** UN Squadron-style capital-ship boss fight across a long hull.
