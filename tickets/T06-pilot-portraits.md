# T06 — Sci-fi pilot portrait generator
Status: done (needs a human side-by-side style check against siege-and-shuffle)
Wave: 1 · Depends on: T00 · Blocks: T17

## Goal
A seeded, layered pixel-portrait generator in the style of `../siege-and-shuffle`'s CK1-style portraits, re-themed for a sci-fi pilot roster. The four named pilots get fixed seeds and trait overrides that make them instantly recognizable.

## Owns
`src/portraits/**` (generator.ts, traits.ts, layers/*.ts, palette.ts, index.ts), `tools/portraits.html` + `tools/portraits.ts` (a standalone viewer like siege's index.html: regenerate, seed input, copy, PNG download at 8×, plus a "roster" row showing the 4 named pilots), pilot portrait fields in `src/content/pilots.ts` (append only; T05 owns the rest).

## Read first
- `docs/art-direction.md` → Pilot portraits, Rules
- The reference implementation: `git -C ../siege-and-shuffle show HEAD:index.html`. Study the layer order, `drawRectHead` chin taper, eye/nose/mouth variants, trait rolls via seeded `pick`, and highlight/shadow conventions. **Match its pixel density and charm, not its medieval content.**

## Requirements
1. `generatePortrait(ctx, seed, overrides?)` draws into a 48×56 canvas. `portraitCanvas(seed, overrides)` returns a cached canvas.
2. **Layers:** background (cockpit bulkhead with blinking-light pixels, porthole starfield, hangar wall with hazard stripes) → uniform (flight suit with collar, chest insignia patch in squadron color, optional shoulder pad/armor, life-support tubes) → neck → head (≥ 4 shapes) → eyes (≥ 5 variants) → nose (≥ 4) → mouth (≥ 4 expressions: neutral, grin, grim, smirk) → facial hair (≥ 4) → hair (≥ 6 incl. buzz, mohawk, long tied, undercut, bald) → headgear (none, headset with mic, helmet visor up, helmet visor down (face mostly hidden, reflection glint), bandana, cyber crest) → accessories (scar, eyepatch, cybernetic eye w/ glow pixel, face tattoo, cheek plaster).
3. **Traits:** age (young/middle/old: wrinkles, graying), sex (affects hair/facial-hair pools), skin (5 human tones plus 3 rare (8%) alien tones: green, blue-gray, lavender, with alien extras like antennae, brow ridges, no nose, unusual eye colors), hair (natural plus neon dye: cyan, magenta, lime), uniform color (squadron palette), and `visorDown` disabling face-detail layers.
4. All colors are 15-bit quantized (reuse `gfx/palette.snes` if T02 has merged; otherwise a local copy marked for consolidation).
5. Named pilot specs in `content/pilots.ts`:
   - **Captain Blastroid:** square jaw, confident grin, swept hair, open helmet visor up, cobalt uniform. The game's mascot, and the strongest silhouette.
   - **Juno Sparks:** young, neon-cyan undercut, headset, freckles, orange uniform.
   - **Old Grieg:** old, white beard, eyepatch, scar, olive uniform, grim.
   - **Zz'kar:** alien lavender skin, antennae, no nose, large eyes, purple uniform.
6. Deterministic: same seed + overrides always gives identical pixels (test via `getImageData` hash in a jsdom/canvas test, or by recording draw calls through a mock ctx).

## Acceptance criteria
- [x] Viewer page regenerates varied, appealing pilots. 20 random seeds show clear variety.
- [x] The four named pilots are distinct and recognizable side by side at 2×.
- [ ] Visually in the same family as siege-and-shuffle's portraits (same chunkiness and shading approach).
- [x] Determinism test passes. No `Math.random` inside the generator (the viewer may use it for new seeds).

## Out of scope
Pilot select screen layout (T17).

## Notes
- Named pilot specs live in `src/portraits/named.ts` (`NAMED_PORTRAITS`, keyed `blastroid`, `juno`, `grieg`, `zzkar`) instead of `content/pilots.ts`, because T05 was writing that file concurrently. T05/T18 should link each pilot to `NAMED_PORTRAITS[id]`.
- `src/portraits/palette.ts` has a local `snes()` quantizer (`TODO(T02)`), to be swapped for `gfx/palette.snes`.
- Layers paint into a small software framebuffer (`pixels.ts`), so the generator can run a selective-outline pass and be tested without a canvas. `generatePortrait` then blits it to the ctx as one `fillRect` per horizontal color run.
- Each trait rolls from its own `rng.fork(label)`, so overriding one trait never changes the others. The seed is pre-scrambled with one mulberry round because similar seeds otherwise produced correlated traits.
- Lighting is flipped from siege (which lights from the right) to top-left, per art-direction rule 2.
- The style-family box is left unticked: the portraits use siege's `drawRectHead` approach at similar feature density and look right in the viewer, but no one has compared them side by side yet.
- Contract changes: none. `vite.config.ts` gains the `portraits` build input.
