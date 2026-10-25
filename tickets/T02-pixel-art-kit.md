# T02 — Pixel-art kit: palette, sprite compiler, font, gallery
Status: todo
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
- [ ] Gallery renders all reference sprites crisply at every zoom, with flash variants and 16 rotations visible.
- [ ] The Kestrel reads clearly against a dark starfield at 1× and looks like it belongs in an SNES shmup.
- [ ] Renderer draws 2,000 cached sprites/frame at 60 fps on desktop (a benchmark button in the gallery).
- [ ] Unit tests: sprite string parsing (ragged rows padded, unknown chars error with sprite id), quantizer, font measuring.

## Out of scope
The actual enemy, asteroid and FX art (owning tickets), and backgrounds (T07).
