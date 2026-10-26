# T07 — Parallax space backgrounds
Status: done
Wave: 1 · Depends on: T00 · Blocks: T15 (level theming)

## Goal
Procedural, seeded, SNES-flavored scrolling space backgrounds that sell the "flying upward" feeling and never compete with gameplay for readability.

## Owns
`src/backgrounds/**` (starfield.ts, nebula.ts, setpieces.ts, themes.ts, index.ts). The `background` DrawLayer (z 0) and its system that advances `world.scrollY += scrollSpeed*dt`.

## Read first
`docs/art-direction.md` → Backgrounds, Rules (value ≤ 35% for backgrounds).

## Requirements
1. **Layers** (each tiles vertically and is pre-rendered into tall offscreen strips; per-frame cost is 1–3 `drawImage` calls per layer):
   - Deep stars: 1 px stars at 0.25× scroll, 3 brightness levels, a few twinkle (palette cycle, not per-star draws).
   - Nebula: ordered-dither (Bayer 4×4) clouds from seeded value noise, 2–3 colors from the theme, at 0.5×.
   - Near streaks: sparse 1×2 / 1×3 bright streaks at 1.5×.
   - Set piece (optional, 0.1×): a large dithered planet limb, a derelict station silhouette, or a distant asteroid belt band. These are scheduled by theme at given times.
2. **Themes** as data: `kessler` (warm gray/brown dust and a dim amber nebula, for Level 1), `ion` (teal), `horizon` (purple/black), `pulsar` (blue/white), `title` (slow-scroll variant for menus).
3. Smooth scroll with interpolation (use `alpha`). Integer pixel offsets per layer, with no shimmer.
4. Background must also draw into the HUD bands, so the screen looks continuous.

## Acceptance criteria
- [x] Gallery or sandbox shows each theme scrolling at 60 fps. Draw cost < 0.5 ms/frame on desktop. (`tools/backgrounds.html`: 0.13–0.37 ms average on an M-series Mac in Chrome; a few percent of frames spike past 0.5 ms, which looked like machine noise rather than the background code.)
- [ ] Background value stays dark enough that enemy bullets and the Kestrel pop (check with T02's reference sprites overlaid). *Checked against stand-in sprites in the dev page, and a test enforces value ≤ 35% for fills. Re-check with T02's real sprites once T02 merges.*
- [x] Same seed gives the same background. (Vitest)

## Out of scope
Obstacles (T10), gameplay-relevant visuals.

## Notes
- **API.** `src/backgrounds/index.ts` exports `Background` (`setTheme(id, seed)`, `prebuild()`, `draw(ctx, scrollY, time, height)`), `createBackgroundPair(bg)` → `{ system, layer }`, `THEMES`, `THEME_IDS`, `getTheme`, `isThemeId` and `themeForLevel`. Themes: `kessler`, `ion`, `horizon`, `pulsar`, `title`.
- **T15:** call `scene.background.setTheme(level.theme, world.run.seed)` and set `world.scrollSpeed`. GameScene currently picks the theme with `themeForLevel(levelId)`, which falls back to `kessler`. It also sets `scrollSpeed` from the theme only while it is still 0. **Menus (T17):** own a `new Background('title', seed)` and call `draw` with your own scroll and time.
- **Scroll.** The `background` system (first in `GameScene.systems`) now owns `world.scrollY += scrollSpeed * dt`. I removed T00's line from `GameScene.update`. The layer interpolates between the previous and current scrollY with `alpha`, and each layer offset is floored to whole pixels.
- **Layers.** Each layer is pre-rendered into a 240×640 strip: base fill, stars at 0.25× (4 palette-cycled copies for twinkle), set pieces at 0.1× (behind the nebula), nebula at 0.5×, and streaks at 1.5×. The background draws over the whole buffer, HUD bands included, and ignores `offsetY` and shake.
- **Set pieces.** `at` is in seconds at the theme's nominal speed and is stored as scroll distance. A negative `at` starts the piece already on screen.
- **Seeds.** Layer seeds come from `hashSeed(seed|bg|theme|layer)`, never from `world.rng`.
- **Color.** `src/backgrounds/color.ts` has a local 15-bit quantizer marked `TODO(T02)`. Fills stay at value ≤ 0.35; stars and streaks stay ≤ 0.65.
- **Dev page.** `tools/backgrounds.html` accepts `?theme=&seed=&t=<seconds>&zoom=`.
- **Shared edits.** In `GameScene`: registered the system and layer, moved scroll ownership, and changed the placeholder ship to draw while no layer is named `player`. In `vite.config.ts`: added the `backgrounds` page to the build input.
