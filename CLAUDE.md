# Captain Blastroid

A mobile-first vertical shmup (1942 × UN Squadron × Vampire Survivors), developed in the browser and wrapped for iOS and Android with Capacitor.

**Read before working:**
- `docs/design.md`: game design, numbers, content roster
- `docs/tech-stack.md`: stack, architecture, **core contracts** (types, events, renderer, system order)
- `docs/art-direction.md`: SNES-era pixel art rules, palettes, sprite sizes, portrait spec
- `tickets/README.md`: ticket index, dependency waves, workflow

## Conventions
- TypeScript strict. Vite. Vitest. No game framework. Canvas 2D at 240×400 logical px.
- **All art is code.** Sprites are string-grid pixel maps compiled by `src/gfx/sprite.ts`. Don't add image or audio files.
- **All sim randomness goes through `world.rng`.** Never call `Math.random()` inside `src/sim`, `src/game` or `src/content`.
- **No allocations in per-tick hot paths.** Use pools and scratch variables, and don't create closures or arrays per entity per frame.
- **Tunables live in `src/content/`.** Systems read numbers from content definitions.
- **Cross-module communication uses `world.events`.** Don't import another feature folder's internals. Import only from `sim/`, `engine/`, `gfx/`, `content/`, and a folder's `index.ts` exports.
- **Contracts** (`src/sim/types.ts`, `src/sim/world.ts`, `src/engine/events.ts`, `src/gfx/renderer.ts`) change only additively. Note any change in your ticket's "Contract changes" section.
- Pointer Events only for input, and mobile constraints always apply (see tech-stack.md, "Mobile-port requirements").
- Match the existing code style. Keep comments sparse and explain *why*, not what.

## Definition of done (every ticket)
`npm run build`, `npm run test` and `npm run lint` pass. New logic has Vitest coverage where it is pure. Visual work appears in `tools/gallery.html` and/or the `?sandbox` scene. Tick the ticket's acceptance checklist and update its `Status:` line.
