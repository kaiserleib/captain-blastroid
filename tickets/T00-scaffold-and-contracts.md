# T00 — Scaffold, loop, display, contracts
Status: todo
Wave: 0 · Depends on: — · Blocks: everything

## Goal
Create a running Vite + TS project with a fixed-timestep loop, pixel-perfect scaled display, scene manager, and the **core contract files** every other ticket codes against. When this ticket is done, `npm run dev` shows a black playfield with a placeholder ship-shaped rectangle you can't control yet, an FPS readout under `?debug`, and a `GameScene` with empty, ordered system and draw lists.

## Owns
`package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.eslintrc*`/`eslint.config.*`, `.prettierrc`, `.gitignore`, `index.html`, `tools/gallery.html` (empty shell), `src/main.ts`, `src/engine/**`, `src/sim/types.ts`, `src/sim/world.ts` (types + `createWorld()` factory), `src/sim/hooks.ts`, `src/gfx/renderer.ts` (interface + minimal Canvas impl: `rect`, `circle`, placeholder `sprite`/`text`), `src/scenes/scene.ts`, `src/scenes/GameScene.ts`, `src/debug/flags.ts`, `src/content/index.ts` (empty registry).

## Read first
`docs/tech-stack.md` (all of it, especially "Core contracts" and "Display & resolution").

## Requirements
1. **Tooling:** Vite (latest stable), TypeScript strict (`noUncheckedIndexedAccess` on), Vitest, ESLint (typescript-eslint, with no-restricted-globals rule banning `Math.random` in `src/sim`, `src/game` and `src/content`), and Prettier. Scripts `dev` (with `--host`), `build`, `test`, `lint` and `e2e` (placeholder). Node ≥ 22 in `engines`.
2. **index.html:** `viewport-fit=cover`, `user-scalable=no`, `theme-color`, `apple-mobile-web-app-capable`. Full-screen canvas, `touch-action:none`, `overscroll-behavior:none`, no text selection, no context menu on long-press. Body background `#000`.
3. **engine/loop.ts:** fixed 60 Hz `update(dt=1/60)` with an accumulator, max 5 steps per frame, and `render(alpha)`. Exposes `pause()/resume()`, and resume never processes the backlog. A `hitstop(seconds)` hook freezes updates but keeps rendering.
4. **engine/display.ts:** logical width 240, logical height = clamp(400..520) from the window aspect, `playfieldOffsetY` = HUD top band height (split extra height between top and bottom bands, top ≥ 0). Offscreen logical canvas, then scaled to the device-pixel canvas with smoothing off, using the integer-scale-if-≥85%-else-fractional rule. Handles `resize`, `orientationchange` and DPR changes, and reads safe-area insets via CSS env() probe. Exposes `screenToLogical(clientX, clientY)`.
5. **engine/rng.ts:** port `mulberry32`, `hashSeed`, `randomSeedString` from `../siege-and-shuffle` (`git -C ../siege-and-shuffle show HEAD:index.html`). Add `rng.range(a,b)`, `rng.int(a,b)`, `rng.pick(arr)`, `rng.chance(p)`, and `rng.fork(label)` for deterministic sub-streams.
6. **engine/pool.ts:** `Pool<T>` with fixed capacity, a `create()` factory, `spawn(): T | null` (returns a recycled object, with the caller resetting fields), `release(obj)` (deferred), `compact()` (called by cleanup), an `each(fn)` allocation-free iteration (or expose `items` + `count`), and a `droppedSpawns` counter incremented when `spawn()` hits capacity (warn once in `?debug`). Unit tests cover spawn/release/compact and the capacity limit.
7. **engine/events.ts:** typed `EventBus<E>` with `on`, `off`, `emit`, and `clear`. Copy `GameEvents` from tech-stack.md into `src/engine/events.ts` (or `src/sim/events.ts`, exported from both).
8. **Contracts:** create `src/sim/types.ts`, `src/sim/world.ts`, `src/sim/hooks.ts` (empty registries) and `src/gfx/renderer.ts` exactly as in tech-stack.md (fill in obvious missing types such as `MoveIntent = { x: number; y: number; targetX: number|null; targetY: number|null }`, `RunState`, and `Rng`). `createWorld(seed, opts)` builds pools with capacities (playerShots 400, enemyShots 600, enemies 80, asteroids 120, anomalies 8, pickups 120).
9. **Scene manager:** `Scene { enter(); exit(); update(dt); render(r, alpha); onPointer?(...) }` with `replace`, `push` (overlay), and `pop`. Scenes created now: `GameScene` (empty `systems: System[]` and `layers: DrawLayer[]` arrays with comments marking the documented order) and `BootScene` (goes straight to `GameScene`).
10. **Debug flags:** parse `?debug ?god ?seed= ?level= ?t= ?sandbox` into a frozen `flags` object. `?debug` draws FPS, tick time (ms) and entity counts.

## Acceptance criteria
- [ ] `npm run dev` serves on LAN, and the page fills the screen on desktop and phone with crisp, non-blurry pixels.
- [ ] Resizing the window or rotating keeps a correct aspect, letterboxing, and HUD bands.
- [ ] Loop runs at 60 sim ticks/s on 60 Hz and 120 Hz displays (verified by a tick counter in the debug overlay).
- [ ] Switching tabs pauses, and returning does not fast-forward.
- [ ] Unit tests: rng determinism (same seed gives the same sequence), pool, event bus, display scale math (pure function).
- [ ] `Math.random` lint rule fires in `src/sim` and passes elsewhere.
- [ ] Contract files exist and compile. `createWorld` is covered by a smoke test.

## Out of scope
Input, sprites, gameplay.
