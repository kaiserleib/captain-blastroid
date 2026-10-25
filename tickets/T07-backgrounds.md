# T07 — Parallax space backgrounds
Status: todo
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
- [ ] Gallery or sandbox shows each theme scrolling at 60 fps. Draw cost < 0.5 ms/frame on desktop.
- [ ] Background value stays dark enough that enemy bullets and the Kestrel pop (check with T02's reference sprites overlaid).
- [ ] Same seed gives the same background.

## Out of scope
Obstacles (T10), gameplay-relevant visuals.
