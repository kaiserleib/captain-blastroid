# Art Direction — Captain Blastroid

The target look is an **SNES-era shmup** (UN Squadron, Axelay, Super R-Type, Space Megaforce) at a 240×400 logical resolution. Everything is drawn in code, with no image files. The code-drawn approach and seeded PRNG come from `../siege-and-shuffle` (see `git show HEAD:index.html` in that repo for the portrait generator).

## Rules
1. **15-bit color.** Every palette color must be representable in SNES BGR555. Each channel is a multiple of 8 (0–248). `gfx/palette.ts` provides a `snes(r,g,b)` helper that quantizes, and a test asserts every palette entry is quantized.
2. **Ramps, not colors.** Each material is a 3–5 step ramp (dark → base → light → highlight), shaded with a consistent **light source from the top-left**.
3. **Selective outlines.** Sprites have a 1 px dark outline (not pure black; use the darkest step of the sprite's own ramp, or `#100818`) so they read against busy space backgrounds.
4. **No anti-aliasing, no sub-pixel drawing.** Draw at integer coordinates only. Rotation is pre-baked at 16 angles into the sprite cache.
5. **Hit flash.** Every damageable sprite gets an auto-generated all-white silhouette variant, shown for 2 frames on hit.
6. **Dithering** is used in backgrounds (nebulae, planet terminators), sparingly on sprites, and never on bullets.
7. **Readability hierarchy** (most to least contrasting): enemy bullets > player ship > enemies > pickups > player bullets > asteroids > background. Backgrounds stay dark and desaturated (value ≤ 35%).

## Sprite sizes
| Thing | Size (px) | Notes |
|---|---|---|
| Player ships | 24×24 | 2–3 frame engine-flame animation, plus bank-left/right frames when moving horizontally |
| Small enemies (Gnat, Swooper) | 16×16 | 2-frame animation |
| Medium enemies (Gunboat, Interceptor, Carrier) | 24×24 – 32×24 | |
| Boss (Rock Hauler) | ~96×64 | Composed of separate part sprites (turrets, core, drills) so parts can be destroyed and flashed independently |
| Asteroids | small 12, medium 20, large 32 | 3 variants per size, pre-baked at 16 rotations |
| Player bullets | 4×8 (blaster), 6×6 (spread), 4×14 (lance), 6×10 (seeker) | Cool palette: cyan, yellow, white |
| Enemy bullets | 6×6 round, 8×8 large | **Magenta/pink ring with a white core.** Nothing else in the game uses this combination. |
| Pickups | 12×12 capsules | A letter glyph on the capsule, with a 2-frame shimmer |
| Explosions | 16, 32, 48 | 6–8 frame procedural bursts |

## Palette families (suggested starting values; tune in `palette.ts`)
- **Player (Kestrel):** white-gray hull with a cobalt blue accent and an orange engine flame.
- **Enemy faction ("the Scrap Syndicate"):** rust red, olive and gunmetal, with a sickly green cockpit glow.
- **Asteroids:** warm grays and browns (L1). Later levels use icy blues and dark basalt.
- **UI:** SNES menu blue (`#2040a0`-ish window gradient) with a white 1 px inner border and a gray outer border, like the classic Final Fantasy / UN Squadron windows.
- **Enemy bullets:** `#f858b8` ring, `#f8f8f8` core.

## Backgrounds
Three parallax layers, all procedural and seeded:
1. **Deep stars:** sparse 1 px stars at 0.25× scroll, with slow twinkle.
2. **Nebula band:** dithered, low-value clouds at 0.5× scroll, using a different hue per level.
3. **Near debris / stars:** brighter 1–2 px streaks at 1.5× scroll.

Optional: a large planet or station slice drifting past at 0.1×. This approximates SNES Mode-7-style depth through scale-free parallax.

## Typography
An **8×8 bitmap font**, defined as glyph grids in code (uppercase, digits, punctuation, and arrow glyphs), plus a **5×7 small font** for the HUD. Text gets a 1 px drop shadow by default. No web fonts render inside the canvas. DOM overlays (if any) use a pixel web font for consistency, such as "Press Start 2P" via Google Fonts.

## UI
- Window frames use the SNES blue gradient, a white inner and gray outer border, and 2 px rounded corners drawn pixel-exact.
- The menu cursor is a blinking hand or arrow. Menus also accept direct taps on mobile.
- HUD elements: shield segments as hex pips (top-left), score (top-center), salvage (top-right), weapon slots as small icons with level pips (bottom band), and powerup timers as shrinking bars under the icons.

## Pilot portraits
These follow the layered, seeded generator approach from `siege-and-shuffle`, re-themed for sci-fi.

- Canvas **48×56** logical pixels per portrait, shown at 2–3× in the pilot select screen. That's slightly smaller than siege's 64×80, so 4 portraits fit side by side at 240 px.
- **Layers, bottom to top:** background (cockpit bulkhead, starfield porthole, hangar wall), flight suit / uniform (collar, insignia patch, shoulder armor), neck, head shape, eyes, nose, mouth, facial hair, hair, headgear (none, headset, open helmet with visor up, helmet with visor down, bandana, cyber-crest), accessories (scar, eyepatch, cybernetic eye with glow pixel, face tattoo lines, comm mic).
- **Traits:** age, sex, skin (human tones plus rare alien tones such as green, blue-gray and lavender, with alien variants like antennae or no-nose ridges), hair color including neon dyes, uniform color (squadron colors), headgear, and accessory.
- Named pilots use a **fixed seed plus trait overrides** (e.g. Zz'kar forces alien skin and antennae, Old Grieg forces old age, white beard and eyepatch).
- The palette uses the same 15-bit quantization rule as the rest of the game. Portraits sit inside the SNES-blue UI frame.
