# T02 — Pixel-art kit: palette, sprite compiler, font, gallery
Status: done
Wave: 1 · Depends on: T00 · Blocks: T08–T14, T17

## Goal
The toolkit every visual ticket uses to author SNES-style sprites as code, plus the dev gallery that shows them. Also replace T00's placeholder `sprite`/`text` renderer methods with real ones.

## Owns
`src/gfx/palette.ts`, `src/gfx/sprite.ts`, `src/gfx/spriteCache.ts`, `src/gfx/font.ts`, `src/gfx/ui.ts` (window frames), `src/gfx/canvasRenderer.ts` (full Renderer impl), `tools/gallery.html` + `tools/gallery.ts`, tests.

## Read first
`docs/art-direction.md` (all). The portrait generator in `../siege-and-shuffle` (`git show HEAD:index.html`) for the code-drawn style.

## Requirements
1. **palette.ts:** a `snes(hex)` quantizer (channels to multiples of 8), named ramps (`PLAYER`, `SYNDICATE`, `ROCK`, `UI`, `EBULLET`, `PBULLET`, `PICKUP`, `FX`, …) and `OUTLINE`. Test that every exported color is 15-bit-quantized.
2. **Sprite definition format** (readable by agents and humans):
   ```ts
   defineSprite('gnat', {
     palette: { o: OUTLINE, d: SYN.dark, b: SYN.base, l: SYN.light, g: GLOW.green },
     frames: [`
       ....oooo....
       ...odbbdo...
       ..odbggbdo..
       ...       `],           // '.' = transparent; one string per frame
     anchor: 'center',          // default
     rotations: 0 | 16,         // pre-bake rotated variants
     mirrorX: false,            // author left half only → mirrored to symmetric sprite
   });
   ```
   Also support **procedural sprites:** `defineProcSprite(id, w, h, (ctx, frame, rng) => void)` for things like asteroids and explosions (seeded and deterministic).
3. **spriteCache.ts:** compile each definition once into offscreen canvases. Produce frames, white-flash silhouettes, 16 rotations (nearest-neighbor rotation by inverse mapping, which keeps pixels crisp; no `ctx.rotate`), and an optional 1 px auto-outline pass. Use lazy compilation with a `warm(ids)` call at scene load.
4. **canvasRenderer.ts:** implements `Renderer` from the contract. `sprite()` rounds to integers, picks the rotation bucket from `rot`, and applies `offsetY` + shake. `text()` uses the bitmap font. Avoid allocations per call.
5. **font.ts:** an 8×8 font (A–Z, 0–9, `.,:;!?-+×/%()'"<>` plus arrows and a hex-pip glyph) and a 5×7 small font, as glyph grids. `measure(str, font)`. Colors are applied via cached tinted glyph atlases.
6. **ui.ts:** `drawWindow(r, x, y, w, h)` (SNES blue vertical gradient, white inner and gray outer 1 px border, pixel-rounded corners), `drawCursor`, `drawBar(value, max)`.
7. **Gallery** (`/tools/gallery.html`): grid of every registered sprite (all frames, flash variant, a rotation strip), the palettes as swatches, font specimens and UI windows, with a 1×/2×/4× zoom toggle. Later tickets register sprites via side-effect imports in `tools/gallery.ts`, so it updates automatically.
8. Seed the registry with a few **reference sprites** that set the quality bar, drawn carefully: the `kestrel` player ship (24×24, 3 engine frames, banking frames), `ebullet_s`, `pbullet_blaster`, and a `capsule` pickup.

## Acceptance criteria
- [x] Gallery renders all reference sprites crisply at every zoom, with flash variants and 16 rotations visible. *(Checked in desktop Chrome at 1×/2×/4×.)*
- [x] The Kestrel reads clearly against a dark starfield at 1× and looks like it belongs in an SNES shmup. *(Gallery "Flight test" section; judged by eye, worth a second opinion from the user.)*
- [x] Renderer draws 2,000 cached sprites/frame at 60 fps on desktop (a benchmark button in the gallery). *(Desktop Chrome: avg 3.4 ms draw per frame, max 5.3 ms, rAF held 120 fps. Not measured on a phone.)*
- [x] Unit tests: sprite string parsing (ragged rows padded, unknown chars error with sprite id), quantizer, font measuring.

## Out of scope
The actual enemy, asteroid and FX art (owning tickets), and backgrounds (T07).

## Contract changes
Additive:
- `gfx/renderer.ts`: `TextOpts.font?: 'ui' | 'small'`. The placeholder `CanvasRenderer` class is replaced by a re-export of the full one from `gfx/canvasRenderer.ts` (same name, same constructor), so `import { CanvasRenderer } from './gfx/renderer'` keeps working. `sprite()` draws at the sprite's anchor (default center), and `text()` draws the bitmap font with `x, y` as the top-left (or top-center/right with `align`).
- `main.ts` imports `CanvasRenderer` from `gfx/canvasRenderer`.

## Notes
- **Sprite API:** `defineSprite(id, { palette, frames, anchor?, rotations?: 0|16, mirrorX?: boolean|'odd', outline?: boolean|color })` and `defineProcSprite(id, w, h, (ctx, frame, rng) => void, { frames?, anchor?, rotations?, outline? })` in `gfx/sprite.ts`. Grids fail at definition time with the sprite id, frame, row and column. Proc sprites get an rng seeded from `"<id>#<frame>"`. Redefining an id replaces it (HMR-safe). `warm(ids?)` in `gfx/spriteCache.ts` pre-bakes frames, flash and rotations; otherwise each is baked on first use. Rotation: `rot` radians, 0 = as authored, clockwise positive, 16 buckets.
- **Gallery wiring:** put sprite definitions in files named `*.sprites.ts` anywhere under `src/`; the gallery globs them, and they appear in the Sprites section. For a custom section, add `tools/sections/<name>.ts` calling `registerGallerySection(name, (root, g) => …, order?)` from `tools/galleryRegistry.ts` (`g.zoom`, `g.animate(fn)`, plus `el`/`pixelCanvas` helpers). No edit to `gallery.ts` needed.
- **Fonts:** per the user's feedback on the T00 debug overlay, the main `ui` font reproduces the canvas `8px monospace` look (sampled from Chrome, hand-tidied): thin strokes, 6 px caps, proportional widths (mostly 4 px, M/W/T/V/X/Y 5 px), digits fixed at 4 px, 8 px cell, 9 px line, lowercase included. This replaces the "8×8 font" of requirement 5. The `small` HUD font is 3×5 glyphs (6 px cell with the `,` descender, 7 px line) rather than 5×7, since a 5×7 font would be bigger than the UI font. Both have arrows `←↑→↓`, cursor `▶`, hex pips `⬢` (filled) / `⬡` (empty), `×`. `drawText(ctx, str, x, y, { font, color, align, shadow, shadowColor, scale })` supports integer `scale` for titles (T17). The gallery shows the old placeholder and the new font side by side.
- **Reference sprites** (`src/gfx/reference.sprites.ts`): `kestrel`, `kestrel_bank_l`, `kestrel_bank_r` (3 engine frames each), `ebullet_s` (2-frame pulse), `pbullet_blaster` (rot16), `capsule` (letter P, 2-frame shimmer). `defineCapsule(id, letterRows)` stamps any 3×5 letter onto the capsule template for T12. `ui_cursor` lives in `gfx/ui.ts`.
- `gfx/ui.ts`: `drawWindow(r, x, y, w, h)`, `drawCursor(r, x, y, tSeconds)` (tip at x,y), `drawBar(r, x, y, w, h, value, max, opts?)`.
- Palettes: `snes(hex)` or `snes(r, g, b)`, `isSnesColor`, `mix`; ramps `PLAYER COBALT CANOPY FLAME SYNDICATE(=SYN) OLIVE GUNMETAL GLOW ROCK ICE BASALT UI EBULLET PBULLET PICKUP FX`, `OUTLINE`. Add new ramps to `RAMPS` so the quantization test covers them.
