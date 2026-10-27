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
4. Each level is its own run. Ten sectors in two acts unlock in order (see "Campaign" below). After a victory, NEXT SECTOR launches the next one with a fresh loadout.

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

- **Five sectors in a fixed order** (`LEVEL_ORDER`): `kessler` → `ionShoals` → `eventHorizon` → `pulsarNursery` → `armada`. Act II adds five more (see "Campaign: Act II").
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

**Boss stall breaker (silent):** a boss fight that runs past 90 s (the Leviathan: 90 s after its 41 s hull pass) ramps the player's damage against boss parts linearly to ×5 over the next 60 s (`BOSS_ASSIST`). Median fights take 35–65 s, so typical play never sees it. A player who reaches a boss with only a Blaster L2 can still win, in about 2½–3 minutes, if they survive that long. There's no UI for it.

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

---

# Campaign: Act II, Sectors 6–10 *(tickets T32–T43)*

The Leviathan's escape core got away through a wormhole. Act II follows its trail to the **Foundry**, the Syndicate shipyard that built the fleet. Everything in "Campaign structure" still applies: each sector is its own 3–4 minute run from a fresh loadout, and only meta carries between them. Act II adds five sectors. Each one is built around one new mechanic, and the finale remixes all of them.

## Act II structure

- **`LEVEL_ORDER`** grows to ten: … `armada` → `corona` → `warrens` → `junction` → `chrono` → `foundry`. Unlocks work as before (sector N+1 unlocks on any clear of N), so Act II opens on the first Armada clear.
- **Sector Select** pages by act. There are two pages of five cards ("ACT I" / "ACT II"), with left/right to switch, using the existing five-card layout. It opens on the page that holds `selectedLevel`. While Act II is locked, its page shows the five cards dimmed, reading "CLEAR SECTOR 5".
- **Results:** the first Armada clear now shows **ACT I COMPLETE**, and NEXT SECTOR goes to Corona Drift. The first Foundry clear shows **CAMPAIGN COMPLETE**.
- **Weapon unlocks (new meta).** Act II adds three weapons. A locked weapon never drops, with one exception: its home sector's supply run is a **field test** that gives it to you anyway. The first clear of the home sector unlocks it permanently, and from then on it is in the drop pool for every sector. The results screen shows "NEW WEAPON: ARC COIL". The save gains `weaponsUnlocked` (the five Act I weapons by default).
- **Slots are capped at 6.** The Nova has 6, and Wren's passive can add one to any ship, up to that cap. The HUD weapon strip has room for six.
- **The escape (Foundry only).** Killing the final boss doesn't end the run. A timed escape follows, and the run is won when it ends (see Level 10). `LevelDef` gains `escape?`.

## Act II difficulty curve

Balance is measured with an **`act1` save** (new debug preset `?save=act1`): Kestrel, Captain Blastroid, every Act I hangar upgrade bought, the Act I ships built and the Act I pilots rescued, but no Act II weapons unlocked. A player reaching sector 6 has banked about 2,500 salvage, so testing Act II from a fresh save would be wrong. The bots still fly the Kestrel with Captain Blastroid, so results stay comparable.

| | L6 Corona Drift | L7 The Warrens | L8 Wormhole Junction | L9 Chrono Rift | L10 The Foundry |
|---|---|---|---|---|---|
| Scroll px/s | 30 | 26 (tunnels 22–34) | 32 | 30 | 30 → 60 → 30; escape 30 → 90 |
| Length to boss | 178 s | 180 s | 179 s | 179 s | 200 s, then the boss, then a 40 s escape |
| Roster HP mul (`enemyHpMul`) | 1.40 | 1.45 | 1.50 | 1.55 | 1.60 |
| Enemy shot speed mul | 1.22 | 1.25 | 1.28 | 1.30 | 1.35 |
| Peak enemy shots, waves / boss | 55 / 70 | 50 / 65 | 55 / 70 | 60 / 75 | 60 / 80 |
| First forced capsule | ~8 s **Arc Coil** (field test) | ~6 s **Ricochet** (field test) | ~8 s **Flak** (field test) | ~8 s Spread | ~6 s Lance |
| `guaranteeWeapon` fallback | Arc Coil by 25 s | Ricochet by 25 s | Flak by 25 s | Spread by 25 s | Lance by 25 s |
| Boss salvage | 240 | 260 | 280 | 300 | 400 |
| Typical clear salvage (target) | 560–750 | 600–800 | 640–850 | 680–900 | 900–1200 |
| Typical-bot clear rate (target, `act1` save) | ~75% | ~72% | ~70% | ~68% | ~65% |
| Novice-bot clear rate (target) | ≥ 15% | ≥ 14% | ≥ 12% | ≥ 10% | ≥ 8% |

- The `guaranteeWeapon` fallback grants the field-test weapon even while it's locked.
- New enemies are authored at their sector's numbers and ignore `enemyHpMul`, as in Act I.
- **Silent assists** (see the difficulty philosophy: silent assists are fine, and under-equipped players may still lose):
  - A flare that has no reachable shade fizzles.
  - A gate that reaches the ship's row crumbles.
  - Janus's portal wall flickers when the player hasn't landed a hit in a long time.
  - The ship can't lose its last shield during the escape.
  - The boss stall breaker applies to every Act II boss. The Architect has three forms, so its threshold is 150 s instead of 90 s.

## Act II rewards

| Sector | Pod pilot | Boss schematic | First-clear unlock | Pod fallback salvage |
|---|---|---|---|---|
| 6 Corona Drift | **Ines Solano** | **Shrike** | Arc Coil | 90 |
| 7 The Warrens | **Rook Mbeki** | **Ferret** | Ricochet | 100 |
| 8 Wormhole Junction | **Nyx Calder** | **Wraith** | Flak | 110 |
| 9 Chrono Rift | **Dr. Imre Halász** | **Revenant** | none | 120 |
| 10 The Foundry | **Wren Ashgrove** | **Nova** | none (CAMPAIGN COMPLETE) | 150 |

### New weapons

| Weapon | Capsule | L1 | Leveling | Role |
|---|---|---|---|---|
| **Arc Coil** | A | Every 1.2 s, an arc hits the nearest enemy within 90 px for 2 dmg and chains to 1 more enemy within 50 px of the last one | L2 +1 chain, L3 every 0.9 s, L4 range 120 and +1 chain, L5 3 dmg | Auto-targeting crowd control. It ignores geometry: no line of sight is needed, and gravity, portals and walls don't affect it. |
| **Ricochet** | R | A disc every 1.1 s, 2 dmg, 200 px/s, alternating ±20° off vertical. It bounces off the side edges, terrain and indestructible objects, up to 2 bounces, and pierces 1. | L2 +1 bounce, L3 twin discs, L4 3 dmg, L5 three discs and 4 bounces | Angles, walls, hitting things from the side |
| **Flak** | F | A shell every 1.4 s at 140 px/s. It bursts after 0.6 s or on contact into 6 fragments (1 dmg, 0.25 s ttl, 160 px/s). The burst **erases enemy bullets** within 12 px. A contact burst deals the shell's damage (2; 3 from L4) to the body it hit, and the fragments skip that body. | L2 8 fragments, L3 every 1.1 s, L4 2-dmg fragments and an 18 px erase radius, L5 two shells | Area denial, a little bullet erasing |

- Arcs are drawn as a jagged 1 px white-and-cyan polyline that re-jitters every 2 frames.
- Discs are 4 px, spinning, in 2 frames.
- Flak shells are 3 px with a 1-frame white burst ring.
- All three draw from per-weapon scratch buffers, with no allocation per shot.
- T35 raised Ricochet's damage to 2 and gave Flak its contact damage: at the original numbers, Ricochet L1 did 0.45 single-target DPS against the Blaster's 2.5, and a point-blank Flak burst hit with every fragment.
- Weapon-capsule weighting and the Weapon Upgrade core don't change. The pool is simply limited to `weaponsUnlocked` plus the current sector's field-test weapon.

### New ships

| Ship | Shield | Speed | Slots | Starting weapons | Build cost |
|---|---|---|---|---|---|
| **Shrike** | 3 | 140 | 4 | Blaster L1 + Arc Coil L1 | 900 |
| **Ferret** | 3 | 125 | 4 | Blaster L1 + Ricochet L1 | 1000 |
| **Wraith** | 2 | 145 | 5 | Blaster L2 + Flak L1 | 1100 |
| **Revenant** | 4 | 115 | 5 | Blaster L1 + Seeker L1 + Orbit Drones L1 | 1300 |
| **Nova** | 4 | 130 | 6 | Blaster L2 | 2000 |

Ship starting weapons work even while that weapon is locked. Each ship has its own silhouette:
- **Shrike:** sharp forward-swept wings, white and sun-gold, with an arc-coil fin.
- **Ferret:** stubby armored drill nose, ochre and gunmetal.
- **Wraith:** a thin dark-green blade with portal-orange engine glows.
- **Revenant:** bulky violet and silver, with a ring-shaped drone housing.
- **Nova:** the Captain's new flagship, white and red with a gold crest. It should read as the hero ship.

### New pilots

| Pilot | Passive | Portrait notes |
|---|---|---|
| **Ines Solano** | **Solar cells:** after 25 s without being hit, regain 1 shield (up to max) | Sun-browned skin, short silver-blonde hair, gold mirrored visor pushed up, sail-courier patches |
| **Rook Mbeki** | +50% damage to asteroids and gates, and asteroids drop +1 salvage | Dark skin, broad face, mining helmet with headlamp, dust smudges |
| **Nyx Calder** | +25% chance on uncommon and rare drops (shield cells, upgrade cores, magnets, repulsors) | Pale skin, black bob with one teal streak, high collar, smuggler's earpiece |
| **Dr. Imre Halász** | **Bullet time:** after a hit, enemy bullets move at 0.5× for 2 s | Older, wild white hair, round glasses, lab-coat collar over a flight suit |
| **Wren Ashgrove** | +1 weapon slot (max 6), −1 max shield | Syndicate defector: rust-orange jumpsuit with the insignia torn off, buzz cut, a burn scar on the jaw |

## Act II shared mechanics

### Solar flares and shade (L6, L10)
- **Flare cycle.** A timeline `flare { warn, burn }` event, or a repeating `flares { every, warn, burn }` system. It has three parts:
  - **Warn:** default 1.2 s, and 2.0 s for the first two flares of the campaign. The top edge whitens, the screen takes an amber tint, and heat-shimmer pixels rise.
  - **Burn:** default 1.2 s. The playfield is blown out except for the shadows.
  - **Cool-down:** 0.4 s fade.
- **Shade.** The sun is straight overhead, so every **caster** throws a vertical shadow strip:
  - The strip is as wide as the caster minus 2 px, and runs from the caster's bottom edge for 160 px.
  - Casters are medium and large asteroids, **shade slabs** (a new indestructible obstacle: 40×10, drifts with the scroll and absorbs shots), and anything a sector marks as a caster (boss hulls).
  - Shadows are drawn as a dark dithered strip during warn and burn only.
- **Damage:**
  - During burn, the ship takes **1 hit per flare** unless its whole hitbox is inside a strip.
  - Every non-boss enemy in the light takes 3 damage once per flare, so a flare thins out gnat swarms.
  - Escape pods in the light lose 1 HP.
  - Pickups and rocks are unaffected.
- **Your guns wear down your cover.** Auto-fire keeps hitting the rocks you're hiding behind. That tension is the point of the sector. Shade slabs are the cover that lasts.
- **Fairness:** if at warn start no strip is within 100 px horizontally of the ship and reachable at its speed before the burn starts, the flare **fizzles** silently. The warning plays, but nothing burns.

### Terrain (L7, L10 escape)
- **Tile terrain.** The tiles are 8 px, 30 columns across the 240 px playfield. Terrain is authored as **string-grid chunks** in content, in the same spirit as sprites:

  | Char | Tile |
  |---|---|
  | `#` | rock (indestructible) |
  | `%` | crumbly rock (3 HP) |
  | `=` | gate (6 HP, hazard-striped) |
  | `T` | turret socket (spawns the sector's wall turret) |
  | `.` | empty |

- A timeline `terrain { chunk, ... }` event appends chunk rows above the screen. The terrain scrolls with `world.scrollSpeed`.
- **Player collision:**
  - Walls **push** the ship out along the shortest axis. Touching a wall does no damage.
  - If a wall pushes the ship into the bottom edge (**crush**), it costs 1 shield. The ship is then moved to the nearest open column at its row and gets the normal post-hit invulnerability.
- **Other collisions:**
  - Player and enemy bullets stop on solid tiles. Ricochet discs bounce off them.
  - Rocks break on walls.
  - Dumb enemies that touch a wall explode.
  - Smart enemies steer around walls using a tile query in their avoidance.
- **Authoring rules:**
  - Corridors are never narrower than 6 tiles (48 px).
  - No chunk forces a sideways move faster than 60% of the slowest ship's speed.
  - A gate always has ≥ 3 s of scroll between appearing on screen and reaching the ship's row.
- **Fairness:** a gate tile that reaches y = 300 crumbles by itself.
- **Draw:** each tile gets a per-theme 8×8 sprite set (edge, inner, corner, crumbly and gate variants) chosen by a 4-neighbour mask at bake time. Terrain draws above the background and below everything else.

### Portals (L8, L10)
- **Portal pairs.** Two rings (r 14) in the same color, with pairs colored cyan, orange and lime. Both ends are entrances. A body whose center *crosses into* one ring comes out of the other with its velocity unchanged, placed r + 2 px out along its heading.
- **What teleports:**
  - Player shots, enemy shots, rocks, pickups and escape pods. They get a per-body cooldown of 0.35 s, so nothing ping-pongs.
  - The **ship**, with a 1.0 s cooldown.
  - Generic enemies don't, apart from those whose behavior opts in (the Blinker).
- **Safety:** an end whose partner sits off-screen or inside a hazard is **closed to the ship**. It's drawn dim, and the ship passes over it.
- **Moving and swapping:**
  - Each end can be fixed, drift with the scroll, or be carried by an owner (Gate Pylon, boss).
  - `swapPortals(a, b)` re-pairs two pairs. It has a 0.8 s color-flicker telegraph.
- **Draw:** a 2 px ring with a rotating dithered swirl inside, and a short white flash on each exit.

### Time bubbles (L9, L10)
- **Bubbles.** Circles of r 36 / 52 / 70.
  - `slow` (×0.35): a blue ring with tick marks.
  - `fast` (×1.8): an amber ring with streaks.
  - `flip`: alternates slow and fast every 3 s, with a 0.6 s flicker before each switch.
- **Effect:** inside a bubble, a body's movement **and timers** run at that rate. This covers bullets (both sides), rocks, pickups, and enemies' movement and fire clocks.
  - The **ship is never scaled.** Its movement must stay crisp, but its shots slow down like everything else.
  - Bullets inside a slow bubble leave 2 ghost pixels behind them so the slowdown reads.
- **Implementation note:** one time-scale lookup per body per tick through a hook (like `isAsteroidHeld`). The same hook carries Dr. Halász's bullet time, a global 0.5× scale on enemy bullets.

### The ship's own history (L9 boss)
The player module keeps a ring buffer of the ship's position for the last 10 s, at the fixed step, preallocated. `playerPastPos(w, secondsAgo, out)` reads from it, and the Echo boss uses it.

## Level 6: "Corona Drift"

A blinding white-gold star fills the top of the screen. Syndicate sail-ships skim its corona. The sector is about **cover**: you hide in the shadows of rocks your own guns keep chipping away. Rock theme `basalt`, weighted to larges. About 178 s to the boss.

**New enemies**

| Enemy | HP | Smart? | Movement | Attack | Salvage |
|---|---|---|---|---|---|
| **Sunskimmer** | 3 | Dumb | Fast diagonal pass (120 px/s) in pairs. Immune to flares, and speeds up ×1.5 during a burn. | One aimed shot halfway across | 2 |
| **Shade** | 6 | Smart | Descends and tucks into the nearest shadow strip, so it competes with you for cover. Leaves after 12 s. | An aimed pair every 1.8 s | 4 |
| **Lens Drone** | 9 | Smart | Holds near the top | During each burn it focuses the light: a 0.6 s telegraph line at the ship, then a 0.4 s beam (a dense line of bullets, like the L4 Warden Ray) | 6 |

**Timeline**

| Time | Beat |
|---|---|
| 0–10 s | Sparse basalt and a drifting shade slab. A toast reads "SOLAR FLARES — HIDE IN THE SHADOWS". |
| 8 s | Supply run: a gnat V with a forced **Arc Coil** capsule (field test) |
| 12 s | **Practice flare:** a 2.0 s warn, then a burn that does no damage. The shadows are outlined white. |
| 14–40 s | Sunskimmer pairs and gnat lines. Flares every 14 s, each preceded by a large-rock band. |
| 32 s | Carrier |
| 40–70 s | Shades lurking in rock shadows, interceptors. The first Lens Drone at 55 s. |
| 70–75 s | Breather and a shield |
| 75–110 s | **Corona storm:** flares every 10 s, a lane of shade slabs, gunboats, two Lens Drones |
| ~95 s | **Pod (Ines Solano)**, 2 HP, drifting beside a shade slab. Flares and Shades can both take its HP. |
| 110–145 s | A mixed finale-lite: sunskimmers, swoopers, flares every 9 s, larges weighted. A magnet at 120 s. |
| 145–172 s | **Coronal mass ejection:** a 3 s burn every 12 s and big rocks only. Gnat swarms burn up in the light. |
| 174 s | Warning. Boss at 178 s. |

**Boss: Heliostat** (a mirror-array sun collector, about 120×56).
- **Parts:**
  - 4 mirrors on articulated arms, 60 HP each.
  - A focus core, 280 HP, armored until 3 mirrors fall.
  - The hull is a shade **caster**.
- **Phase 1:**
  - The boss strafes slowly. Two mirrors at a time reflect sunlight into **beams**: lines of bullets from the mirror at a 25° slant, sweeping ±30° over 3 s. Each beam has a 0.6 s telegraph line first.
  - The pairs alternate every 6 s.
  - A flare comes every 11 s. Before each flare, the boss drops a **shade slab** at a random x in the lower half.
- **Phase 2 (3 mirrors down):** "SOLAR FURNACE".
  - The core fires a 6-arm spiral (one 6-way ring every 0.2 s for 1.6 s, then a 2 s pause, turning 11°).
  - Flares come every 7 s, and the last mirror bends one beam through the burn.
  - The boss still drops two slabs before each flare, so cover always exists.
- **Defeat:** the mirrors shatter into glinting particles. Shrike schematic, 240 salvage.

## Level 7: "The Warrens"

The escape core's trail leads into a hollowed-out asteroid, honeycombed with Syndicate mining tunnels. This is the first sector with **terrain**: walls, corridors, gates and turrets in the rock. Rock theme `basalt`, sparse (rocks only out in the open). About 180 s to the boss.

**New enemies**

| Enemy | HP | Smart? | Movement | Attack | Salvage |
|---|---|---|---|---|---|
| **Wall Turret** | 4 | — | Fixed in a `T` socket, scrolls with the terrain | An aimed 3-burst every 2.2 s, starting no earlier than 0.6 s after it comes on screen | 3 |
| **Borer** | 6 | Dumb | Warns with a 0.6 s dust plume on a wall, bursts out, crosses the corridor at 90 px/s and digs into the far wall, **carving** a 2-tile hole along its path | Contact; drops a 4-shot ring as it enters the far wall | 4 |
| **Cave Bat** | 1 | Dumb | Flocks of 8–12 with loose boids flocking. They follow the ship at 70 px/s and lose interest after 6 s. | Contact | 1 |

**Timeline (scroll speed in brackets)**

| Time | Beat |
|---|---|
| 0–14 s [30] | Open space in front of the asteroid's face, plus a few rocks |
| 6 s | Supply run: a gnat column with a forced **Ricochet** capsule (field test) |
| 15 s [30 → 26] | **The cave mouth** closes in. A toast reads "THE WARRENS". |
| 15–40 s [26] | A wide tunnel (14+ tiles) with wall turrets. The first cave-bat flock at 30 s. |
| 32 s | A chamber (24 tiles wide) with the carrier |
| 40–70 s | The tunnel narrows. The first gates, with a toast: "SHOOT THE GATES". Borers. |
| 70–75 s | Chamber breather and a shield |
| 75–110 s | **The fork:** a wall splits the tunnel. The left branch is tight with turrets. The right branch has two gates and an upgrade core behind them. They rejoin at 105 s. |
| ~98 s | **Pod (Rook Mbeki)** in an alcove on the left wall behind a gate. Shoot the gate and the pod drifts out. |
| 110–145 s [26 → 34] | **The crush:** S-bend corridors, faster scroll, bats and borers. A magnet at 120 s. |
| 145–172 s [34 → 26] | **Collapse:** crumbly walls and rock falls from the ceiling, with gunboats holding in chambers |
| 176 s | Warning. The tunnel opens into the Wyrm's den, and the scroll stops at 180 s. |

**Boss: Wyrm** (a Syndicate tunnel-boring worm, a head of about 32×32 plus 8 segments of about 16×16).
- **Arena:**
  - A cavern 26 tiles wide with 2 pillars.
  - The scroll is 0 for the whole fight. The terrain is fixed.
- **Parts:**
  - The head, 260 HP, armored except while **surfacing**: for 1.4 s after it emerges, its mouth opens.
  - 8 segments, 30 HP each. Destroying a segment shortens the worm and drops a small rock.
- **Phase 1:**
  - The Wyrm burrows into a wall. A dust trail in the rock shows where it will come out, 0.8 s ahead.
  - It emerges from another wall or pillar and crosses the cavern in a smooth arc (110 px/s), then dives back in.
  - Each living segment fires one sideways shot as it passes the middle of the cavern.
- **Phase 2 (< 50%):** "FRENZY". It moves at 150 px/s, makes two crossings per burrow, the mouth spits a 7-way fan while surfacing, and its path **carves** the pillars.
- **Defeat:** the head bursts, then the segments pop in sequence along its body. Ferret schematic, 260 salvage.

## Level 8: "Wormhole Junction"

A transit hub of Syndicate ring-gates in a green-black void. Things that go in one ring come out the other: your shots, theirs, rocks, pods and you. The trick to learn is **shooting through portals** at targets you can't hit directly. Rock theme `ion`, light. About 179 s to the boss.

**New enemies**

| Enemy | HP | Smart? | Movement | Attack | Salvage |
|---|---|---|---|---|---|
| **Blinker** | 4 | Smart | Dives into a portal and comes out of its partner, holding there 1.2 s before it dives again. With no portals on screen, it swoops like a Swooper. | An aimed 3-shot burst each time it comes out (after a 0.5 s flash) | 3 |
| **Gate Pylon** | 10 | Dumb | Slow drift (18 px/s) carrying one end of a portal pair, so that exit moves | None. Killing it collapses its pair. | 5 |
| **Aegis** | 10 | Smart | Holds near the top. A **front shield** absorbs every shot from below. | A 5-way fan every 2.0 s | 6 |

The Aegis is the portal teacher. It can be hit from above or the sides: through a portal exit placed above it, or with Ricochet, Seekers, Arc Coil or drones.

**Timeline**

| Time | Beat |
|---|---|
| 0–10 s | One fixed pair: one end low-left, the other high-right. Rocks drift through it. A toast reads "PORTALS: WHAT GOES IN COMES OUT". |
| 8 s | Supply run: a forced **Flak** capsule (field test) |
| 14–40 s | Swoopers and gnats. At 25 s, the first Aegis, with a portal end below it at the ship's level and its partner just above the Aegis. A toast reads "SHOOT THROUGH THE RING". |
| 32 s | Carrier |
| 40–70 s | Blinkers. Two pairs on screen. Aegis pairs with portal exits above them. |
| 70–75 s | Breather and a shield |
| 75–110 s | Gate Pylons carrying moving exits, rocks fed through the rings, interceptors |
| ~100 s | **Pod (Nyx Calder)** comes out of a portal mid-screen and keeps getting teleported by the rings it drifts through |
| 110–145 s | **Junction rush:** three pairs, a `swapPortals` every 10 s, mixed waves. A magnet at 120 s. |
| 145–172 s | **Feedback loop:** a pair stacked vertically (one end above the other), so rock streams and gnat swarms fall through it in loops |
| 175 s | Warning. Boss at 179 s. |

**Boss: Janus** (a two-faced gate station, about 128×64).
- **Arena:**
  - The station sits at the top behind an indestructible **portal wall**, a shimmering barrier that absorbs every shot from below.
  - Two portal pairs connect the ship's half of the screen to two exits **above the station**, aimed at its back.
- **Parts:**
  - Two faces, Dawn (left) and Dusk (right), 200 HP each.
  - 2 ring generators, 60 HP each. Each one holds an exit in place.
  - The generators sit in front of the wall's edges and can be shot directly.
- **Phase 1:**
  - The entry rings are fixed left and right at y≈260.
  - The faces can only be hit through the rings.
  - The boss fires aimed 3-bursts every 1.6 s and a 16-shot ring every 2.5 s. Those shots go through the rings too.
  - Destroying a generator makes its exit drift.
- **Phase 2 (one face down):**
  - The entry rings **drift** and the pairs **swap** every 6 s, with a 0.8 s flicker first.
  - The remaining face fires a 4-arm spiral.
  - Blinkers spawn from the exits every 8 s.
- **Fairness:** a toast at fight start reads "SHOOT THROUGH THE RINGS". If 40 s pass without a face hit, the portal wall **flickers off** for 3 s every 10 s (silent).
- **Defeat:** both faces crack, the wall collapses, and the rings implode. Wraith schematic, 280 salvage.

## Level 9: "Chrono Rift"

The jump drops you into a wound in time: desaturated violet space where bullets crawl in some places and race in others. The sector is about **timing space**: slow bubbles hold walls of shots back, and fast bubbles fire them at you. Rock theme `kessler`, light. About 179 s to the boss.

**New enemies**

| Enemy | HP | Smart? | Movement | Attack | Salvage |
|---|---|---|---|---|---|
| **Stutterer** | 3 | Dumb | Moves in 0.4 s bursts and freezes for 0.6 s, in columns | A 4-shot cross ring on every second freeze | 2 |
| **Rewinder** | 8 | Smart | Interceptor-like. It records its last 2 s. The first time it drops below 50% HP, it rewinds after 1.0 s to its position and HP from 2 s earlier, with clock hands spinning backward as the 1.0 s warning. Kill it inside the window to deny it. | An aimed pair every 1.8 s | 5 |
| **Bubble Mine** | 5 | Dumb | Drifts with the scroll | Pops into a 6 s **slow** bubble (r 52) when shot or after 6 s. The bubble can help you or hurt you. | 2 |

**Timeline**

| Time | Beat |
|---|---|
| 0–10 s | A slow bubble drifts down the center and rocks crawl through it. A toast reads "SLOW FIELD: SHOTS CRAWL". |
| 8 s | Supply run: a forced Spread capsule |
| 14–40 s | Stutterer columns. A fast bubble at 28 s, with a toast: "FAST FIELD". |
| 32 s | Carrier |
| 40–70 s | Rewinders (toast: "FINISH THEM FAST") and lines of bubble mines |
| 70–75 s | Breather and a shield |
| 75–110 s | Gunboats behind slow bubbles: their fans pile up inside and spill out together. Interceptors. |
| ~100 s | **Pod (Dr. Imre Halász):** a ghostly **echo pod** appears at 100 s and drifts on the path the real pod will take. It can't be collected. The real pod follows the same path 6 s later. |
| 110–145 s | Mixed waves and bubble-mine fields. A magnet at 120 s. |
| 145–172 s | **Time storm:** `flip` bubbles and stutterer swarms |
| 175 s | Warning. Boss at 179 s. |

**Boss: Echo** (a dark mirror of the player's own ship, drawn at 2×, about 48×48, palette-swapped to violet, black and white).
- **Movement:** it flies the ship's path **from 8 s ago** (`playerPastPos`). x is copied directly. y is mapped into the top band: `y = clamp(60 + (pastY − 240) × 0.5, 40, 140)`. If there's no history yet (in the sandbox), it strafes.
- **It fires your loadout.** The Echo mirrors up to 3 of the ship's weapons (the highest-level ones, ties to the oldest), translated into enemy patterns with fixed caps:

  | Your weapon | Echo pattern |
  |---|---|
  | Blaster | An aimed shot every 0.9 s; a twin from L3 |
  | Spread | A 3-way ±14° fan every 1.6 s; 5-way from L4 |
  | Pulse Lance | A 0.6 s telegraph line, then a 200 px/s bolt, every 2.4 s |
  | Seeker | A shootable homing missile (1 HP) every 3 s; 2 from L3 |
  | Orbit Drones | 1–3 orbiting blockers that absorb player shots |
  | Arc Coil | A zap that can't miss if the ship is within 60 px (with a 0.5 s crackle telegraph) |
  | Ricochet | A disc that bounces off the side edges, every 2.2 s |
  | Flak | A shell that bursts into 6 slow shards, every 2.6 s |

  More weapons make the Echo hit harder, but they also give you more damage. That's fair under the difficulty philosophy.
- **Parts:** the core, 520 HP. Any blocker drones have 20 HP each and respawn after 8 s.
- **Phase 1 (100–60%):** one Echo, 8 s behind.
- **Phase 2 (60–25%):** a second **Ghost Echo** splits off, 4 s behind. It has 160 HP as its own part, is translucent, and fires only its first weapon.
- **Phase 3 (< 25%):** "PARADOX". A `flip` bubble covers the Echo, and slow bubbles spawn on the ship's past positions.
- **Defeat:** the Echo freezes, rewinds 1 s, and shatters. Revenant schematic, 300 salvage.

## Level 10: "The Foundry"

The Syndicate shipyard, built into a broken Dyson ring around a dying red sun. The escape core docked here. The finale is a **remix**: each stretch brings back one earlier mechanic in Foundry dress, and the last boss uses all of them. Rock theme `basalt` (hull scrap). About 200 s to the boss, then the fight, then a 40 s escape.

**New enemies**

| Enemy | HP | Smart? | Movement | Attack | Salvage |
|---|---|---|---|---|---|
| **Riveter** | 2 | Dumb | Conveyor lines of 8–14 crossing horizontally at a fixed y (60 px/s) | Contact | 1 |
| **Crane** | 12 | Smart | Holds near the top. Tows a large hull-scrap rock with `towRock`, then flings it, like a Tug. | One aimed shot when it has no rock | 6 |
| **Sentinel** | 16 | Smart | Holds and turns slowly to face the ship (0.8 rad/s). A front shield covers a 120° arc. | A 3-way fan every 1.8 s | 8 |

The Sentinel is the Aegis, grown up: you get around it by flanking, through portals, or with Ricochet, Seeker or Arc Coil. The Foundry may also spawn Act I enemies by id. It does **not** use Act II sector enemies, because those are built in parallel.

**Timeline (scroll speed in brackets)**

| Time | Beat |
|---|---|
| 0–40 s [30] | **The yard:** gantry silhouettes. Cranes towing hull scrap, riveter conveyors, Escort Fighters (Act I, by id). |
| 6 s | Supply run: a forced Lance capsule |
| 30 s | Carrier |
| 40–75 s [30] | **Containment:** a captive `massive` black hole drifting inside a ring of shade slabs, with Orbiters and Lancers (Act I, by id), and Sentinels |
| 75–80 s | Breather and a shield |
| 80–115 s [30 → 60] | **The welding line:** `turning` pulsars on the beat during a scroll surge, Streakers (Act I, by id) and riveters |
| 115–150 s [60 → 30] | **The furnace:** flares with shade slabs, a portal conveyor (two pairs feeding riveter lines across the screen), and Sentinels behind portals |
| ~130 s | **Pod (Wren Ashgrove)**, carried by the portal conveyor |
| 150–190 s [30] | **Assembly:** terrain corridors (Foundry tiles) with time bubbles parked in the bends, gates and Cranes in chambers. A magnet at 160 s. |
| 194 s | Warning. Boss at 200 s, in an open chamber. |

**Boss: The Architect** (the Syndicate's master builder, fused with the Leviathan's escape core). It has three forms on one boss bar. Each form honors earlier bosses.
- **Form 1, "Scaffold"** (Shepherd and Rock Hauler):
  - 2 crane arms (90 HP each) and a core (220 HP, armored until both arms fall).
  - Each arm tows a hull-scrap rock into orbit as a shield and throws it every 5 s.
  - The core fires aimed 5-way fans.
- **Form 2, "Singularity Engine"** (Perihelion and Magnetar):
  - The scaffold falls away. The core ignites a captive `massive` black hole below itself.
  - 4 pylons (60 HP each) and a core (300 HP, shielded until 3 pylons fall).
  - It pulses `magnetar` rings with gaps every 2.5 s, and the hole bends both your shots and its own.
- **Form 3, "Paradox Core"** (Heliostat, Janus and Echo):
  - The hole collapses. The bare core (260 HP) fights with everything left:
    - Flares every 8 s, with the boss dropping shade slabs.
    - A portal pair that swaps every 6 s.
    - A `flip` bubble around the core.
    - A 6-arm spiral.
- **Stall breaker:** the Architect's threshold is **150 s** from the fight start (three forms), not 90 s.
- **The escape.** Killing the core starts it:
  - A toast reads "CORE BREACH — ESCAPE!" and a 40 s countdown appears on the HUD. The music switches to `escape`.
  - The scroll ramps from 30 to 90 px/s over 6 s.
  - Terrain corridors close in (Foundry tiles, every corridor ≥ 7 tiles at this speed), with debris rocks falling and no enemies.
  - Hits still cost shields, but **the last shield can't be lost** (silent).
  - An **escape bonus** of 100 salvage minus 20 per hit (minimum 0) is paid when the countdown ends.
  - The run is won when the countdown reaches 0: white-out, then results.
- **Rewards:** Nova schematic, 400 boss salvage, and **CAMPAIGN COMPLETE** on the first clear.

## Act II presentation

| Sector | Background theme | Level song | Boss song | Palette notes |
|---|---|---|---|---|
| 6 | `corona`: a white-hot limb across the top edge, amber dust bands, heat shimmer | `corona`: bright Lydian lead, 140 BPM | `boss2` | white, gold, amber; shadows in deep umber |
| 7 | `warrens`: dark rock strata behind the terrain, with faint mining lights | `warrens`: 110 BPM, percussive noise, a low square ostinato | `boss2` | ochre, umber, gunmetal; gates hazard yellow and black |
| 8 | `junction`: a green-black void with distant ring-gates and lens flares | `junction`: 126 BPM, syncopated, call and response between pulse channels | `boss2` | black-green, with portal cyan, orange and lime |
| 9 | `rift`: desaturated violet, stars with afterimage trails, faint clock-face arcs | `rift`: 96 BPM, reversed-envelope arps, tempo dips | `boss2` | violet, grey, white; bubbles blue (slow) and amber (fast) |
| 10 | `foundry`: Dyson-ring girders, a red sun, molten seams | `foundry`: an industrial march, 136 BPM | `foundry_boss`: the final theme, quoting `armada_boss`; then `escape` at 160 BPM | rust, molten orange, black steel |

`boss2` is the shared Act II boss theme: faster than `boss`, in a minor key.
