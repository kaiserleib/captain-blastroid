# T37 — Act II music and backgrounds
Status: todo
Wave: 8 · Depends on: T31 · Blocks: T38–T42 (soft: the stubs warn on missing ids)

## Goal
Five backgrounds and eight songs for Act II, all procedural.

## Owns
`src/gfx/backgrounds/**` (new themes), `src/audio/songs/**` (new songs), and their registrations, plus `tools/sections/` (the backgrounds section, if it isn't already generic).

## Read first
`docs/design.md` → **"Act II presentation"** and Level 10, `docs/art-direction.md`, and T25's Notes (how themes and songs are built and registered).

## Requirements
1. **Backgrounds:**
   - `corona`, `warrens`, `junction`, `rift` and `foundry`, with parallax layers that follow `world.scrollSpeed` as the existing themes do.
   - `corona` puts the star's limb at the top edge, and it must not wash out the enemy-bullet palette.
   - `warrens` has to work both behind terrain and in the open-space opening.
   - `foundry` needs a dramatic speed-up look for the escape (speed lines already exist above 50 px/s).
2. **Songs:**
   - Level songs `corona`, `warrens`, `junction`, `rift` and `foundry` at the design's tempos and characters.
   - Boss songs `boss2` (the shared Act II boss theme) and `foundry_boss` (the final theme, quoting `armada_boss`).
   - `escape` at 160 BPM.
   - All loop cleanly. Note each song's BPM in content, in case a sector wants to phase-lock (the Foundry's welding-line pulsars).
3. **Readability:** enemy bullets, pickups and the ship stay readable on every theme. Screenshot each theme with a bullet fan in Notes.

## Acceptance criteria
- [ ] Every theme appears in the gallery, and every song plays from the gallery or a debug jukebox (`?mute` everywhere except a deliberate listen).
- [ ] Perf: no theme costs more than the most expensive Act I theme (measured).
- [ ] build / test / lint pass.

## Contract changes
