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

## The run

1. **Hangar:** choose pilot and ship, then launch.
2. **Level:** about 3.5 minutes of scripted waves at a fixed scroll rate, ending in a boss.
3. **Results:** score, salvage banked, discoveries (schematics, rescued pilots).
4. Each level is its own run. Five sectors unlock in order (see "Campaign" below). After a victory, NEXT SECTOR launches the next one with a fresh loadout.

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
| **Orbit Drones** | 1 drone orbiting at radius 22, 1 contact dmg per 0.25 s, **blocks enemy bullets** | More drones, then larger radius, then more damage. From L3 each drone fires a 1-dmg spark at the nearest target within 150 px (every 0.9 / 0.7 / 0.5 s at L3 / L4 / L5). | VS-style defensive weapon |

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


---

# Campaign: Levels 2–5 *(post-MVP, tickets T21–T31)*

## Campaign structure

- **Five sectors in a fixed order** (`LEVEL_ORDER`): `kessler` → `ionShoals` → `eventHorizon` → `pulsarNursery` → `armada`.
- **Each sector is its own run.** A run starts from the ship's starting loadout and ends on death, abandon or that sector's boss. Weapons, score and chain never carry between sectors. Only meta carries: salvage, schematics, ships, pilots and hangar upgrades. That keeps every sector a 3–4 minute mobile session, and lets a player replay any unlocked sector to farm salvage or hunt a pod.
- **Unlocks:** sector N+1 unlocks when sector N has at least one clear (`save.levels[id].clears > 0`). Sector 1 is always open. `?save=all` unlocks everything, and `?level=N` still jumps straight in (dev).
- **Hangar:** a new **SECTOR** row under SHIP shows the selected sector ("2 ION SHOALS"). It opens the **Sector Select** screen: five stacked cards, each with number, name, best score, a clear star (with the clear count), a "POD" marker while that sector still has an unrescued pilot, and a "SCHEMATIC" marker while its boss still has an unfound schematic. Locked cards are dimmed and read "CLEAR SECTOR N−1". LAUNCH flies `save.selectedLevel`.
- **Results → next sector:** after a victory the results screen offers **NEXT SECTOR** (focused by default, if a next sector exists) above **HANGAR**. NEXT SECTOR launches the next sector with the same ship and pilot and a fresh seed. The first clear of sector N also moves `selectedLevel` to N+1, so LAUNCH continues the campaign. Defeat offers RETRY (same sector) and HANGAR.
- **High scores** are per sector (each `HighScore` carries `level`). Records shows one table per sector, paged left/right. Abandoned runs never enter the table, and nor does a score under 1,000.

## Difficulty curve

The ship always starts weak, so later sectors get harder through **density, bullet speed and new mechanics**, not by inflating HP. Formation enemies stay 1–2 hits so the starting Blaster stays useful.

| | L1 Kessler | L2 Ion Shoals | L3 Event Horizon | L4 Pulsar Nursery | L5 Armada |
|---|---|---|---|---|---|
| Scroll px/s | 30 | 32 | 34 | 28 → 70 → 18 → 36 | 24 (hull: 20) |
| Length to boss | 180 s | 185 s | 185 s | 190 s | 150 s + hull |
| Roster HP mul (`enemyHpMul`) | 1.0 | 1.0 | 1.15 | 1.25 | 1.35 |
| Enemy shot speed mul | 1.0 | 1.05 | 1.10 | 1.15 | 1.20 |
| Peak enemy shots, waves / boss | 36 / 36 | 40 / 45 | 45 / 50 | 45 / 55 | 55 / 70 |
| First forced capsule | ~20 s (Spread) | ~12 s (Spread) | ~10 s (Seeker) | ~10 s (Spread) | ~8 s (Lance) |
| `guaranteeWeapon` fallback | Spread by 45 s | Spread by 35 s | Seeker by 30 s | Spread by 30 s | Lance by 25 s |
| Boss salvage | 50 | 70 | 120 | 180 | 220 |
| Typical clear salvage (target) | 200–300 | 280–380 | 340–450 | 400–520 | 520–700 |
| Typical-bot clear rate (target) | ~90% | **~90%** | ~80% | ~75% | ~70% |
| Novice-bot clear rate (target, T31) | ~52% (measured) | ≥ 47% | ≥ 37% | ≥ 27% | ≥ 17% |

- `enemyHpMul` applies to the Level 1 roster when reused, rounded, minimum 1 (a gnat stays 1 HP). New enemies are authored at their sector's numbers and ignore it.
- **Guaranteed weapon** (`guaranteeWeapon: { by, weapon }`, a director rule). If the player still holds only one weapon at `by` seconds, the director drops a capsule of `weapon` ahead of the ship. This replaces Level 1's fragile "only if a forced formation was cleared" rule and fixes its known follow-up.
- Every sector after L1 opens with a short **supply run**: a forced-capsule formation inside the first 12 s and a carrier before 60 s, so a fresh Kestrel has two weapons by the first real wave.

## Rewards by sector

| Sector | Pod pilot(s) | Boss schematic (first ship not yet found or built, in order) | Notes |
|---|---|---|---|
| 1 Kessler Belt | Juno, then Grieg | Bulwark, Dart | unchanged |
| 2 Ion Shoals | **Zz'kar** (escape-pod gauntlet) | **Warden**, then Dart, Bulwark | Fallbacks let a player who skipped the L1 rewards still get them |
| 3 Event Horizon | **Sable Okoro** | **Corsair** | |
| 4 Pulsar Nursery | **Pip Tanaka** | **Halcyon** | |
| 5 The Armada | **Commodore Vale** | **Paragon** | Final boss. A first clear shows "CAMPAIGN COMPLETE" on results. |

When a sector has no rescuable pilot left, its pod becomes a salvage cache (`podFallbackSalvage`: 30 / 40 / 50 / 60 / 80). When its schematics are all found, the boss drops +50% boss salvage instead.

### New ships

| Ship | Shield | Speed | Slots | Starting weapons | Schematic | Build cost |
|---|---|---|---|---|---|---|
| **Warden** | 4 | 110 | 4 | Blaster L1 + Seeker L1 | L2 boss | 400 |
| **Corsair** | 3 | 135 | 4 | Blaster L2 | L3 boss | 600 |
| **Halcyon** | 3 | 120 | 4 | Blaster L1 + Lance L1 | L4 boss | 800 |
| **Paragon** | 4 | 130 | 5 | Blaster L2 + Orbit Drones L1 | L5 boss | 1200 |

Sprites follow the Kestrel rules (24×24, a 2–3 frame engine flame, bank-left/right frames). Each has its own silhouette and accent: Warden is a broad teal escort hull, Corsair a swept red-and-gold raider, Halcyon a slim white lancer with a long nose, and Paragon a gold-trimmed flagship-blue interceptor.

### New pilots

| Pilot | Passive | Rescued |
|---|---|---|
| **Zz'kar** (alien, exists) | Powerup durations +50%, +25% salvage | L2 pod |
| **Sable Okoro** | +20% damage, −15% pickup radius | L3 pod |
| **Pip Tanaka** | +15% speed, +20% pickup radius | L4 pod |
| **Commodore Vale** | +1 max shield, +10% fire rate, −10% salvage | L5 pod |

Portraits use the existing generator with a fixed seed plus overrides. Sable: dark skin, shaved sides, red visor-up helmet, scar. Pip: young, neon-green dyed hair, headset, freckles if the generator has them. Vale: older, gray hair, officer collar with gold insignia, no headgear.

### New hangar upgrades (late-game salvage sinks)

| Upgrade | Effect | Levels / cost |
|---|---|---|
| **Hull Lattice** | +1 max shield | 1 level, 600. Requires Reinforced Plating. |
| **Munitions Cache** | Start each run with the ship's first starting weapon at +1 level | 1 level, 450 |

## Shared mechanics

### Tractor beams (L2)
Any enemy or boss can **tow** a rock: `towRock(w, rock, x, y, k)` pulls a rock toward a point with a damped spring (`k` 1/s², damping 2√k). It's drawn as a dashed cyan beam, `#58d0f8`/`#d0f8f8`, two px wide, scrolling. A **fling** releases the rock with a velocity aimed at the player. Killing the tower drops the rock with its current velocity. Towed rocks keep their HP and still split when shot.

### Black holes (L3)
These use the existing anomaly (core r 8, field 128, every bullet bends toward it, the player drifts gently). New variants:

| Variant | Core r | Field | Strength | Player pull | Notes |
|---|---|---|---|---|---|
| `small` | 6 | 96 | 1100 | 24 | early teaching |
| `standard` | 8 | 128 | 1500 | 34 | current values |
| `massive` | 12 | 170 | 2100 | 44 | late beats and the boss |

They drift with the scroll by default. A timeline `anomaly` event can give them a slow sideways drift (±8 px/s). The core swallows shots and rocks, and touching it costs a shield. Their draw gets a lensing ring: a 1 px bright accretion ring at the core plus a dithered dark halo at r×2.

### Pulsars (L4)
Rings get **gaps**, which makes them timing-and-position puzzles instead of unavoidable damage:
- Each pulsar variant has `period`, `telegraph`, `gaps` (count), `gapDeg` (width) and `gapSpin` (degrees per pulse the gap pattern rotates).
- During the telegraph, the gap directions are drawn as bright spokes from the core, so the player knows where to stand before the ring reaches them.
- The ring hurts only where it is solid. One hit per pulse per pulsar, as now.

| Variant | Period | Telegraph | Gaps × width | Spin / pulse | Ring speed | Max r |
|---|---|---|---|---|---|---|
| `steady` | 3.0 s | 1.0 s | 3 × 64° | 0° | 110 | 220 |
| `turning` | 3.0 s | 1.0 s | 3 × 52° | 40° | 120 | 220 |
| `quick` | 2.0 s | 0.8 s | 2 × 58° | 90° | 140 | 200 |
| `magnetar` (boss) | set by boss | 0.7 s | set by boss | set by boss | 130 | 260 |

The L4 music runs at 120 BPM, so a 3.0 s period is exactly six beats. Pulses land on the bar line, and the timeline places pulsars so their phase matches the music.

### Scroll-speed changes (L4, L5)
A timeline `scroll { to, over }` event ramps `world.scrollSpeed` linearly. World-anchored bodies (rocks, anomalies) change their `vy` by the same delta every tick, so the field speeds up as one piece. Pickups already re-read the scroll speed. Enemies fly under their own power and are unaffected. The background parallax follows `world.scrollSpeed`. Speed lines (1 px streaks at 1.5× scroll) appear above 50 px/s.

## Level 2: "Ion Shoals"

A blue-green ion nebula full of big crystalline rocks (rock theme `ion`: mediums have 4 HP and split into 2 smalls; larges have 10 HP and split into 2 mediums). The Syndicate's **tugs** herd rocks with tractor beams. About 185 s to the boss.

**New enemies**

| Enemy | HP | Smart? | Movement | Attack | Salvage |
|---|---|---|---|---|---|
| **Tug** | 10 | Smart | Descends to y≈60–90 and holds, drifting slowly toward the player's x. Leaves after 14 s. | Tows the nearest medium or large rock within 130 px to a point 30 px below itself for 1.6 s, then **flings** it at the player at 95 px/s. Every 4.5 s. If no rock is in range, one aimed shot. | 6 |
| **Skiff** | 2 | Dumb | Fast sine weave (130 px/s down, amplitude 40, 0.9 Hz) in groups of 4–6 | A single aimed shot at 1.4 s, once | 1 |
| **Ion Mine** | 3 | Dumb | Drifts with the scroll and blinks | When the player comes within 36 px, or 6 s after spawn, bursts into an 8-shot ring at 60 px/s. Shooting it detonates it harmlessly (the ring isn't fired). | 2 |

**Timeline**

| Time | Beat |
|---|---|
| 0–12 s | Sparse smalls and a few mediums. The player learns that mediums take 4 hits and split. |
| 8 s | Supply run: a gnat V with a forced Spread capsule |
| 14–40 s | Skiff weaves, two at a time, and the first lone **Large** (10 HP) splitting into mediums |
| 32 s | Carrier with a guaranteed capsule |
| 40–70 s | First **Tug** pair with a medium-rock band to tow. Swoopers from the corners. |
| 70–75 s | Breather and a shield drop |
| 75–110 s | Ion mines sown in lanes, with skiffs through them and two Tugs flinging larges |
| 110–145 s | **Escape-pod gauntlet** (below) |
| 145–175 s | "Ion storm": dense ion rocks (larges weighted), Tugs ×3, gunboats. A magnet drops at 150 s. |
| 176–181 s | The field clears, a warning at 181, the boss at 183 |

**Escape-pod gauntlet (~110–145 s).** A toast reads "ZZ'KAR'S POD — ESCORT IT!". The pod enters at the top center and drifts at 12 px/s. In this sector it has **3 HP** (a `hp` option on the `escapePod` event), drawn as pips over the pod. For 30 s skiff waves sweep in from both sides, and a pair of gunboats holds at the top edge firing fans that cross the pod's path. The player screens the pod with the ship, Orbit Drones or the repulsor, and by killing the shooters. If the pod survives into the pickup radius, Zz'kar is rescued. If it is destroyed, a toast reads "POD LOST" and nothing is gained. Once Zz'kar is rescued, the gauntlet still runs, carrying a salvage cache with 3 HP.

**Boss: The Shepherd** (an ion tug-mothership, about 112×64). It **herds rocks**: it keeps a rotating shield of towed asteroids around itself and throws them.
- **Parts:** 2 tractor emitters (90 HP each), a central core (240 HP, armored until both emitters are gone), 3 armor hull pieces.
- **Phase 1:** slow strafe at the top (period 8 s). Each emitter tows one **large** rock into an orbit 46 px from the boss (angular speed 1.2 rad/s). The rocks block the player's shots and break normally (10 HP, splitting into mediums that fall away). Every 5 s one emitter flings its rock at the player at 95 px/s, then tows a fresh large rock in from the top edge over 2 s. Emitters also fire aimed 3-bursts every 1.8 s.
- **Phase 2 (core open):** the core fires a 5-arm rotating ion spiral (one 5-way ring every 0.16 s for 2.4 s, then a 2 s pause, turning 9° per ring, 75 px/s). Every 9 s it launches a skiff wave of 4. The remaining towed rocks are released toward the player as a pair.
- **Defeat:** the usual chain explosion. The schematic list is Warden, then Dart, then Bulwark. 70 salvage.

## Level 3: "Event Horizon"

A dark violet void around a dying star, with black holes that **bend every bullet, yours too**. The theme is learning to shoot *past* a hole and let it curve the shot into enemies, and noticing that enemy shots curve too. Rock theme `basalt`, sparse. About 185 s to the boss.

**New enemies**

| Enemy | HP | Smart? | Movement | Attack | Salvage |
|---|---|---|---|---|---|
| **Orbiter** | 6 | Dumb | Spawns at a black hole's edge and circles it at 54 px (1.4 rad/s) for 10 s, then exits down | A 2-shot outward fan every 1.3 s. The hole curves the shots into strange arcs. | 3 |
| **Lancer** | 5 | Smart | Descends to y≈70, aims a 0.7 s telegraph line at the player, then dashes along it at 260 px/s, wraps out of the screen and is gone | Contact only (the dash) | 3 |
| **Gravity Buoy** | 12 | Dumb | Drifts with the scroll. While it lives, it projects a *small* black-hole field (no core) at 0.5× strength. | None. Killing it collapses the field. | 5 |

**Timeline**

| Time | Beat |
|---|---|
| 0–10 s | One `small` black hole drifts down the right third. Shots fired straight up beside it visibly curve. |
| 6 s | Supply run: a gnat column with a forced Seeker capsule. Seekers home, and homing plus gravity is fun. |
| 15–45 s | Swoopers and gnats past a `standard` hole on the left. The first Orbiters circle it. |
| 40 s | Carrier |
| 45–80 s | Two holes at once (left and right), interceptors in between. The first Lancers. |
| 80–85 s | Breather and a shield |
| 85–120 s | Gravity Buoys in a line of three, each warping the lane. Gunboats behind them. Their fans curve in. |
| ~100 s | **Pod (Sable Okoro)** drifts between two holes, so the gravity pulls it. Pods aren't absorbed by a core; they slide past it. |
| 120–160 s | A `massive` hole centered with a slow sideways drift (±6 px/s). Orbiter rings, Lancer volleys of 3. A magnet at 130 s. |
| 160–176 s | "Event storm": basalt rocks spiraling into the massive hole (a rock lane aimed at it), gnat swarms |
| 178 s | Warning. Boss at 182 s. |

**Boss: Perihelion** (a slingshot racer, about 80×48). It flies **orbits around its own black hole** and uses it to sling.
- **Arena:** at spawn a `massive` black hole is placed at (120, 150) and stays fixed (it doesn't scroll during the fight). It is removed on defeat.
- **Parts:** 2 gun pods (80 HP each) and a core (260 HP, armored until both pods are gone).
- **Phase 1 (orbit):** the boss circles the hole on an ellipse (rx 80, ry 50) with a 9 s period. The pods fire an aimed 3-way fan (±10°) every 1.6 s, and the hole bends both its shots and the player's. The player wins by leading shots around the hole.
- **Phase 2 (slingshot):** every 6 s the boss telegraphs a dive for 0.8 s (a dotted line from its position, curving around the hole, toward the player's row). It slingshots around the hole at about 280 px/s, crosses the bottom third, and climbs back into orbit. During the dive it drops a 12-shot ring. Between dives the core fires an 8-way ring every 1.2 s, and the hole curves those shots too.
- **Defeat:** the hole collapses (a 0.5 s shrink plus a white flash). Corsair schematic, 90 salvage.

## Level 4: "Pulsar Nursery"

A pink-and-gold stellar nursery seeded with young pulsars. This sector is about **rhythm** (pulse rings with gaps, timed to the music) and **speed** (the scroll surges and stalls). Rock theme `ion`, light. About 190 s to the boss.

**New enemies**

| Enemy | HP | Smart? | Movement | Attack | Salvage |
|---|---|---|---|---|---|
| **Pulse Drone** | 4 | Dumb | Drifts down slowly (20 px/s) | Fires a 10-shot ring on the beat: every 3.0 s, phase-locked to the nearest pulsar's pulse | 2 |
| **Streaker** | 3 | Dumb | Only during fast scroll. Enters from the bottom edge at 150 px/s upward, angled ±15°. | One aimed shot as it passes y=200 | 2 |
| **Warden Ray** | 14 | Smart | Holds near the top. Sweeps a beam slowly from side to side (the beam is a line of spaced 3 px bullets released every 0.08 s along its heading). | The sweeping bullet line, 1.5 s on, 2.2 s off | 7 |

**Timeline (scroll speed in brackets)**

| Time | Beat |
|---|---|
| 0–10 s [28] | A `steady` pulsar drifts down the center. The first ring telegraphs its 3 gap spokes. A toast reads "STAND IN THE GAPS". |
| 6 s | Supply run: a forced Spread capsule |
| 12–45 s [28] | Pulse Drones in pairs on the beat, gnat lines between pulses. A second `steady` pulsar, out of phase by half a period. |
| 35 s | Carrier |
| 45–70 s [28] | `turning` pulsars (rotating gaps). Swoopers. Warden Ray ×1. |
| 70–75 s [28 → 70 over 3 s] | A toast reads "CURRENT SURGE": the scroll ramps up |
| 75–105 s [70] | **The current:** dense small-rock rain, Streakers from below, one `quick` pulsar rushing past. No pod here. |
| 105–110 s [70 → 18 over 4 s] | The surge breaks and a shield drops |
| 110–145 s [18] | **The garden:** three pulsars almost stationary in a triangle (periods 3/3/2 s), Pulse Drones, interceptors. The player threads the overlap of three gap patterns. |
| ~118 s | **Pod (Pip Tanaka)** inside the garden. Rings do not hurt pods. |
| 145–150 s [18 → 36] | Magnet drop |
| 150–178 s [36] | A finale mix: Warden Rays ×2, gunboats, `quick` pulsars |
| 182 s | Warning. Boss at 186 s. |

**Boss: Magnetar** (a forge station built around a captive magnetar, about 96×96, radially symmetric).
- **Parts:** 4 pylons on a ring (radius 34, rotating at 0.5 rad/s; 50 HP each) and the magnetar core (180 HP, shielded until three pylons fall).
- It sits at y≈96 and doesn't strafe. Instead the **scroll speed** keeps changing during the fight: 30 → 50 → 30, in 12 s cycles, which drags the arena and the rocks.
- **Phase 1:** the core pulses a `magnetar` ring every 3.0 s with 4 × 45° gaps, which turn 30° per pulse. Each pylon fires an aimed shot every 2 s (staggered).
- **Phase 2 (3 pylons down):** the ring period drops to 2.0 s with 3 × 50° gaps, which turn 60° per pulse. The core adds a 4-arm spiral between rings (one 4-way ring every 0.2 s, turning 13°).
- **Phase 3 (core < 25%):** "MELTDOWN". Two rings per period, 0.5 s apart (the pulsar's `double` echo), the echo's gaps turned half a gap spacing, so the player has to move between them.
- **Defeat:** Halcyon schematic, 110 salvage.

## Level 5: "The Armada"

The Syndicate fleet at anchor around a gas giant. It's UN Squadron's capital-ship stage: frigates as mid-bosses, fighter screens, then a **dreadnought hull scrolling under the player** with a dozen destructible sections, ending at the bridge. Rock theme `basalt` (hull debris), light. About 150 s of approach, then the hull.

**New enemies**

| Enemy | HP | Smart? | Movement | Attack | Salvage |
|---|---|---|---|---|---|
| **Escort Fighter** | 3 | Smart | A swoop then a strafe, in wings of 3 | A 2-shot aimed pair every 1.6 s | 2 |
| **Frigate** (mid-boss) | 2 turrets × 30 + hull 60 | — | Crosses slowly (25 px/s) from one side at y≈70–110. A multi-part rig on the boss framework, but *not* `isBoss` for the HUD bar. | Turrets: 3-bursts. Hull: an 8-shot ring every 2.5 s once both turrets are gone. | 25 + a guaranteed capsule |
| **Minelayer** | 8 | Dumb | Crosses horizontally at y≈40 | Drops an Ion Mine (from L2) every 1.5 s | 4 |

**Timeline**

| Time | Beat |
|---|---|
| 0–8 s [24] | The fleet on the horizon (background setpiece). Sparse debris. |
| 5 s | Supply run: a forced Lance capsule (Lance pierces fighter lines) |
| 10–40 s | Escort Fighter wings, gnat screens. The first Frigate at 30 s. |
| 40–70 s | Minelayers sowing lanes, interceptors. A carrier at 55 s. |
| 70–75 s | Breather and a shield |
| 75–110 s | **Frigate pair** crossing in opposite directions, with fighter wings |
| ~95 s | **Pod (Commodore Vale)** ejected from a burning frigate wreck: it spawns where the second frigate dies, or at 105 s if it survives |
| 110–145 s | Everything at once: wings, mines, gunboats, swoopers. A magnet at 120 s. |
| 145 s | A toast reads "DREADNOUGHT BELOW". The music crossfades to `armada_boss` and the hull begins. |

**Boss: Dreadnought *Leviathan*** (UN Squadron style, full playfield width, about **240×720**).
- **The hull scrolls.** At 145 s the dreadnought's bow enters from the top. The hull is a long multi-part rig whose anchor moves down at **20 px/s** (`scrollSpeed` drops to 20 so the background matches). The player flies over it; the hull deck is *not* solid. Sections arrive in order:
  1. **Bow (0–8 s):** 2 flak turrets (25 HP) firing aimed 3-bursts.
  2. **Forward battery (8–18 s):** 4 deck turrets (30 HP) in two rows firing fans, plus 2 armor plates.
  3. **Missile bays (18–26 s):** 2 bays (40 HP). Each launches 2 homing missiles (turn rate 1.6 rad/s, 70 px/s, 4 s ttl, shootable with 1 HP) every 4 s.
  4. **Shield generators (26–32 s):** 2 generators (50 HP). While either lives, the bridge is armored.
  5. **Bridge (32 s+):** when the bridge reaches y≈110 the hull **stops scrolling** (the rig anchor stops and scroll goes to 0) and the fight locks in. Bridge: 370 HP (bridge 250 + escape core 120), plus 2 bridge guns (40 HP).
- Turrets that scroll off the bottom are simply gone. Destroying them is optional and pays salvage (10 each). Only the bridge must die. If both generators scroll past alive, they keep the bridge armored until a 25 s timeout, when they **overload** (explode by themselves) so the fight can't soft-lock.
- **Bridge phase 1:** guns fire aimed 5-way fans every 2 s. The bridge fires a 20-shot ring every 2 s, turning 7° each time.
- **Bridge phase 2 (< 50%):** the guns are wrecked or not, either way the bridge **launches its escape core**. The core (120 HP, shown on the same boss bar) detaches and strafes the top of the screen like the Rock Hauler, firing a dense 4-arm spiral. The hull wreck burns below, and rocks of debris fly off it.
- **Defeat:** an extra-long (3 s) chain across the whole hull, the Paragon schematic and 150 salvage. On the first clear the results screen shows **CAMPAIGN COMPLETE**.

## Presentation per sector

| Sector | Background theme | Level song | Boss song | Palette notes |
|---|---|---|---|---|
| 1 | `kessler` (exists) | `level1` (exists) | `boss` | warm grays and rust |
| 2 | `ion` (exists) | `ion`: mysterious minor, 128 BPM, square-wave arps over a triangle bass | `boss` | teal and cyan rocks, cyan tractor beams |
| 3 | `horizon` (exists) | `horizon`: slow and heavy, 100 BPM, detuned bass and sparse noise hits | `boss` | violet and black, gold accretion rings |
| 4 | `pulsar` (exists) | `pulsar`: 120 BPM driving arpeggio, a kick on every pulse (every 6 beats) | `boss` | pink and gold, white rings |
| 5 | `armada` (**new**): gas-giant setpiece and distant fleet silhouettes | `armada`: a military march, 132 BPM | `armada_boss` (**new**): faster and minor-key, the final-boss theme | cold steel blues, Syndicate rust on the hull |

`LevelDef` gains `bossMusic` (default `boss`) and `rockTheme`. All music stays procedural in `src/audio/songs/`.
