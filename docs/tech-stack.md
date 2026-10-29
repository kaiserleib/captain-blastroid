# Tech Stack & Architecture — Captain Blastroid

## Decision summary

| Concern | Choice |
|---|---|
| Language | **TypeScript** (strict) |
| Build / dev server | **Vite** (latest stable), Node 22+ |
| Rendering | **Canvas 2D** at a fixed low logical resolution, nearest-neighbor upscaled. No game framework. Renderer sits behind an interface so it can be swapped for WebGL (e.g. PixiJS) later if profiling calls for it. |
| Art | **Procedural pixel art in code** (string-grid sprite definitions → cached offscreen canvases), same approach as `../siege-and-shuffle`. No image files. |
| Audio | **Web Audio API**: procedural sfxr-style SFX and a small chiptune step sequencer. No audio files in the MVP. |
| Simulation | Fixed 60 Hz timestep, seeded PRNG (mulberry32), pooled typed entities, spatial hash. Deterministic, and it can run headless in Vitest. |
| Tests | **Vitest** (unit and headless simulation), **Playwright** (one browser smoke test) |
| Mobile, phase 1 | **PWA**. Test on real phones with `vite --host` over the LAN, or "Add to Home Screen". |
| Mobile, phase 2 | **Capacitor 8**, wrapping the same `dist/` into iOS and Android apps. Plugins used: Haptics, Preferences, App (lifecycle), Screen Orientation, SystemBars/StatusBar. |

## Why not a framework (Phaser 4, PixiJS, Kaplay, Excalibur)?

Phaser is the strongest full framework in this group. Phaser 4 went stable in April 2026 ([v4.0.0 "Caladan"](https://phaser.io/download/stable)) and was at [v4.2.1 by July 2026](https://gamedev.net/news/4825-phaser-v421-released/). Phaser has a reputation for good Safari/WebKit behavior, which matters because every iOS browser and the Capacitor WebView run on WebKit ([comparison](https://phaser.io/news/2026/04/phaser-vs-kaplay-vs-excalibur-2d-web-game-framework)). It is a reasonable choice, and it is the fallback if the custom loop runs into trouble. We still don't use it, for these reasons:

1. **Our art pipeline is procedural.** Most of Phaser's value is loading assets, texture atlases, animation from sprite sheets, and tweening loaded art. We generate everything in code, the way the sibling project does, so we would pay for an asset pipeline we never use.
2. **The simulation must be deterministic and run headless.** Subagents verify their work through Vitest simulations ("a bot plays level 1 for 4 minutes and the boss spawns"). A plain TS sim with a fixed timestep makes that trivial. A framework scene graph makes it awkward.
3. **Parallel subagents work better on plain modules.** Phaser 4 is new and broke v3 APIs (pipelines became render nodes, FX changed). Agents writing code from memory would likely mix in v3 calls. Small TS modules behind written contracts (below) avoid that failure mode.
4. **The game's needs are small.** We need circle collisions, pooled sprites, a few hundred bullets, and particles. A 240×400 Canvas 2D buffer drawing cached sprites at integer coordinates handles thousands of `drawImage` calls per frame on mid-range phones.
5. **Porting is the same either way.** Capacitor wraps any web build, framework or not, and the mobile concerns (input, safe areas, lifecycle, audio unlock, storage) need our own handling in both cases.

**Escape hatch:** all drawing goes through the `Renderer` interface. If T19 profiling on a low-end Android device shows Canvas 2D is the bottleneck, we write a PixiJS-backed `Renderer` and leave the game code untouched.

## Mobile-port requirements (built in from day one, not retrofitted)

- **Input:** Pointer Events only (no separate mouse and touch code paths). `touch-action: none` on the canvas. No hover-dependent UI. Tap targets ≥ 44 CSS px.
- **Viewport:** `viewport-fit=cover`, honor `env(safe-area-inset-*)`, disable pinch-zoom, double-tap zoom and pull-to-refresh (`overscroll-behavior: none`). Portrait only.
- **Lifecycle:** auto-pause on `visibilitychange` / `pagehide` (and on Capacitor `App.pause` later). Never simulate a catch-up burst after resume.
- **Audio:** create or resume the `AudioContext` inside the first user gesture (iOS requirement). Respect a mute setting.
- **Frame rate:** fixed 60 Hz sim, decoupled from display refresh (60/90/120 Hz ProMotion). Render with interpolation alpha. Cap catch-up at 5 steps.
- **Performance budget:** no allocations in per-frame hot paths (pools, reused scratch vectors). Target 60 fps on a 2021 mid-range Android phone with 300 bullets, 40 enemies and 60 particles on screen.
- **Persistence:** everything goes through a `StorageAdapter`. Web uses `localStorage`; Capacitor uses `@capacitor/preferences`, because iOS can evict WebView localStorage.
- **Platform services** (`src/platform/`): haptics, storage, lifecycle and orientation sit behind small interfaces with web implementations now and Capacitor implementations in T19.

## Display & resolution

- **Playfield:** fixed **240 × 400 logical pixels** (3:5). All gameplay happens in this space, so every device sees the same field. That keeps spawns and difficulty fair.
- **HUD bands:** the logical canvas is 240 wide and **400 + extra** tall. The extra height (from tall phone aspect ratios) becomes HUD bands above and below the playfield, so HUD is drawn outside the action and away from the thumb when the screen allows. When there is no extra room (desktop, short screens), the HUD overlays the playfield edges. Logical height is clamped to 400..520.
- **Scaling:** render the whole frame to an offscreen canvas at logical resolution, then `drawImage` it to the display canvas at device resolution with `imageSmoothingEnabled = false`. Use an integer scale if it fills ≥ 85% of the available width; otherwise use a fractional nearest-neighbor scale. Letterbox with the background color.
- **Coordinates:** screen space. Origin at the playfield's top-left, +y down. "Scrolling" is visual: backgrounds scroll, and world objects get a downward component in their velocity.

## Project layout

```
index.html                 # game entry (mobile meta tags)
tools/gallery.html         # dev page: every sprite, palette, font glyph, portrait
src/
  main.ts                  # boot: display, loop, scene manager, platform
  engine/
    loop.ts                # fixed-timestep loop with interpolation
    display.ts             # canvas sizing, DPR, scaling, safe areas
    scene.ts               # SceneManager (replace / push / pop overlays)
    rng.ts                 # mulberry32, hashSeed, randomSeedString (ported from siege-and-shuffle)
    math.ts                # scalar helpers, angle utils, no Vec2 allocations
    pool.ts                # Pool<T> fixed-capacity object pool
    events.ts              # typed EventBus<Events>
  input/                   # T01
  gfx/                     # T02 (renderer impl, sprites, palette, font) + T13 (fx/)
  audio/                   # T04
  sim/                     # T03 world, collision, spatial hash, forces, damage
  game/
    player/                # T08
    weapons/               # T09
    obstacles/             # T10
    enemies/               # T11
    pickups/               # T12
    director/              # T15
    boss/                  # T16
    hud/                   # T14
  content/                 # data: ships, pilots, weapons, enemies, levels, drop tables
  meta/                    # T05 save, progression, unlocks
  portraits/               # T06
  backgrounds/             # T07
  platform/                # T05 (web impls), T19 (capacitor impls)
  scenes/                  # Boot, Title, PilotSelect, Hangar, Game, Results, Pause
tests/                     # vitest specs that cross module boundaries; unit tests sit next to source as *.test.ts
e2e/                       # playwright smoke
```

## Core contracts (T00 creates these files verbatim-ish; everyone else codes against them)

Parallel tickets depend on these shapes. Changing a contract is a cross-ticket change: note it in your ticket's "Contract changes" section and keep it additive.

### `src/sim/types.ts`

```ts
export type EntityId = number;

export const Layer = {
  Player: 1, PlayerShot: 2, Enemy: 4, EnemyShot: 8,
  Asteroid: 16, Anomaly: 32, Pickup: 64,
} as const;

/** Every pooled entity. `active=false` means the slot is free. */
export interface Body {
  active: boolean;
  id: EntityId;
  x: number; y: number;        // center, logical px
  prevX: number; prevY: number; // for render interpolation; set at the start of each tick
  vx: number; vy: number;      // px / second
  r: number;                   // collision radius
}

export interface Damageable { hp: number; maxHp: number; flashT: number; }

export interface Bullet extends Body {
  owner: 'player' | 'enemy';
  damage: number;
  pierce: number;              // remaining extra hits; 0 = dies on first hit
  ttl: number;                 // seconds
  sprite: string;              // sprite id
  rot: number;                 // radians, render only
  weaponId: string | null;     // which player weapon spawned it
  homing: number;              // turn rate rad/s, 0 = none
  targetId: EntityId;          // -1 = none
  hitIds: EntityId[];          // enemies already hit (pierce); cleared on spawn
}

export interface Enemy extends Body, Damageable {
  defId: string;               // key into content/enemies.ts
  t: number;                   // seconds alive
  state: number;               // behavior state machine slot
  ax: number; ay: number;      // behavior-owned scratch (anchor/target)
  fireT: number;               // seconds until next shot
  avoidsAsteroids: boolean;
  formationId: number;         // -1 = none
  isBoss: boolean;
  contactDamage: number;
}

export interface Asteroid extends Body, Damageable {
  size: 'small' | 'medium' | 'large';
  rot: number; spin: number;
  variant: number;             // sprite variant
}

export interface Anomaly extends Body {
  kind: 'blackhole' | 'pulsar';
  t: number;
  strength: number; radius: number; // effect field
}

export type PickupKind =
  | 'weapon' | 'upgrade' | 'shield' | 'magnet' | 'repulsor'
  | 'salvage' | 'schematic' | 'escapePod';

export interface Pickup extends Body {
  kind: PickupKind;
  payload: string;             // weaponId / shipId / pilotId / '' ; salvage uses `amount`
  amount: number;
  ttl: number;
  magnetized: boolean;
}

export interface WeaponInstance { id: string; level: number; cooldown: number; state: number; }

export interface PlayerState extends Body {
  alive: boolean;
  shield: number; maxShield: number;
  invulnT: number;
  speed: number;               // px/s
  weapons: WeaponInstance[];
  maxWeaponSlots: number;
  magnetT: number; repulsorT: number;
  pickupRadius: number;
  stats: PlayerStats;          // multipliers from ship + pilot + meta upgrades
}

export interface PlayerStats {
  damageMul: number; fireRateMul: number; speedMul: number;
  pickupRadiusMul: number; powerupDurationMul: number;
  extraShield: number; salvageMul: number;
}
```

### `src/sim/world.ts`

```ts
export interface World {
  readonly width: 240; readonly height: 400;
  tick: number; time: number;   // time in seconds since level start
  rng: Rng;                     // ONLY randomness source in the sim
  scrollSpeed: number;          // px/s, visual scroll + downward drift reference
  scrollY: number;
  player: PlayerState;
  input: MoveIntent;            // written by input each tick before systems run
  playerShots: Pool<Bullet>; enemyShots: Pool<Bullet>;
  enemies: Pool<Enemy>; asteroids: Pool<Asteroid>;
  anomalies: Pool<Anomaly>; pickups: Pool<Pickup>;
  events: EventBus<GameEvents>;
  run: RunState;                // score, salvage, kills, pickups found, unlock candidates
  nextId(): EntityId;
}

export interface RunState {
  shipId: string; pilotId: string; levelId: string; seed: string;
  score: number; chain: number; chainT: number;  // chain multiplier 1..8, decays after 1.5 s without a kill
  salvage: number; kills: number; asteroidsDestroyed: number;
  formations: Map<number, { alive: number; total: number; broken: boolean }>;
  schematics: string[]; pilotsRescued: string[];
  pickupsCollected: Record<PickupKind, number>;
  bossDefeated: boolean;
}

export interface System { name: string; update(w: World, dt: number): void; }
export interface DrawLayer { name: string; z: number; draw(w: World, r: Renderer, alpha: number): void; }
```

**System order** (fixed, in `scenes/GameScene.ts`): input → player → weapons → enemies → boss → bullets → obstacles → pickups → collision → cleanup → director → fx.

**Draw z order:** background 0, anomalies 10, pickups 20, asteroids 30, enemies 40, enemy shots 50, player shots 55, player 60, fx 70, HUD 100.

### `src/engine/events.ts`: `GameEvents`

```ts
export interface GameEvents {
  enemyHit:        { enemy: Enemy; damage: number };
  enemyKilled:     { enemy: Enemy; byPlayer: boolean };   // byPlayer=false if asteroid killed it
  asteroidHit:     { asteroid: Asteroid };
  asteroidDestroyed:{ asteroid: Asteroid; byPlayer: boolean };
  playerHit:       { shieldLeft: number };
  playerDied:      {};
  pickupCollected: { pickup: Pickup };
  weaponAdded:     { weaponId: string };
  weaponLeveled:   { weaponId: string; level: number };
  formationCleared:{ formationId: number; x: number; y: number };
  bossRequested:   { defId: string };   // director → boss module
  bossSpawned:     { defId: string };
  bossDefeated:    { defId: string; x: number; y: number };
  levelComplete:   {};
  songRequested:   { id: string };   // T44: a level script asks for a song (gauntlet rounds)
  sfx:             { id: string; x?: number };
  shake:           { mag: number; dur: number };
  hitstop:         { dur: number };
  haptic:          { kind: 'light' | 'medium' | 'heavy' };
  toast:           { text: string };
  bossWarning:     {};
  pauseRequested:  {};
  runOver:         { victory: boolean };
}
```

### Extension hooks (`src/sim/hooks.ts`, created by T00 as empty registries, filled by T03 and features)

```ts
registerShotBlocker(fn: (w: World, shot: Bullet) => boolean)       // T09 drones, T12 escape pod
registerAnomalyContact(kind: Anomaly['kind'], fn: (w, a, player) => void) // T10
registerBossDamage(fn: (w: World, part: Enemy, amount: number) => boolean) // T16; true = handled
```

Events decouple the parallel tickets. Collision (T03) emits `enemyKilled`. Pickups (T12) listen and roll drops, FX (T13) listen and spawn explosions, audio listens to `sfx`, and the director (T15) listens for `formationCleared`. Nobody imports another ticket's internals.

**Event dispatch is synchronous.** Listeners must not remove pool entries in a way that breaks iteration. Use `pool.release()`, which defers compaction to `cleanup`.

### `src/gfx/renderer.ts`

```ts
export interface Renderer {
  readonly ctx: CanvasRenderingContext2D;      // logical-res offscreen buffer
  sprite(id: string, x: number, y: number, opts?: { rot?: number; flash?: boolean; alpha?: number; frame?: number; flipX?: boolean }): void;
  rect(x: number, y: number, w: number, h: number, color: string): void;
  text(str: string, x: number, y: number, opts?: { color?: string; align?: 'left'|'center'|'right'; shadow?: boolean }): void;
  circle(x: number, y: number, r: number, color: string, fill?: boolean): void;
  offsetY: number;                              // playfield origin inside logical canvas (HUD band)
  shakeX: number; shakeY: number;
}
```

Sprite positions are centers and are rounded to integers at draw time. Rotated sprites are pre-baked at 16 angles by the sprite cache rather than drawn with `ctx.rotate`, which keeps the pixel art crisp.

### Content as data

All tunables live in `src/content/*.ts` as typed `const` records, never inside system code. Balance passes (T18) should only touch `content/`.

## Commands

```
npm run dev        # vite --host (reachable from phones on LAN)
npm run build      # tsc --noEmit && vite build
npm run test       # vitest run
npm run lint       # eslint + prettier --check
npm run e2e        # playwright smoke
```

URL debug flags (dev only): `?debug` (FPS, hitboxes, entity counts), `?god` (invulnerable), `?seed=XXXX`, `?level=1&t=120` (skip to time), `?sandbox` (number keys spawn things).

## Sources

- [Phaser v4 stable release](https://phaser.io/download/stable)
- [Phaser v4.2.1 release (GameDev.net)](https://gamedev.net/news/4825-phaser-v421-released/)
- [Phaser vs Kaplay vs Excalibur (phaser.io)](https://phaser.io/news/2026/04/phaser-vs-kaplay-vs-excalibur-2d-web-game-framework)
- [Announcing Capacitor 8 (Ionic)](https://ionic.io/blog/announcing-capacitor-8)
- [Updating to Capacitor 8](https://capacitorjs.com/docs/updating/8-0)
