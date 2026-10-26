# T25 — Sector music and backgrounds
Status: todo
Wave: 5 · Depends on: T00–T20 · Blocks: T31

## Goal
Each sector sounds and looks like its own place: four new level songs, a final-boss song, an `armada` background theme, and speed lines for fast scroll.

## Owns
`src/audio/songs/**` (plus registering the new songs in its `index.ts`), `src/backgrounds/**`.

## Read first
`docs/design.md` → "Presentation per sector" and "Scroll-speed changes"; `tickets/WAVE5-NOTES.md`; `src/audio/song.ts`, `src/audio/songs/*.ts` (the format and the existing four songs); `src/backgrounds/*`.

## Requirements
1. **Songs**, all in the existing step-sequencer format: `ion`, `horizon`, `pulsar`, `armada`, `armada_boss`, with the moods and tempos from the design.
   - `pulsar` is exactly **120 BPM**, and a kick or accent lands every 6 beats (3.0 s). Document the bar/beat alignment in a comment so T29 can phase-lock pulsars: the pulse lands at song time t = 3.0·k s from the song start.
   - Each song loops cleanly and is at least 32 bars before it loops. They're mixed to the same perceived loudness as `level1` (check the peak and RMS of an offline render if the audio module supports it; otherwise by ear is impossible here, so match note velocities and voice counts to `level1`).
   - `armada_boss` must feel like a finale: faster, minor, a heavier bass line.
2. **Backgrounds:**
   - Add theme `armada`: cold steel-blue nebula at ≤ 35% value, plus a **setpiece**: a banded gas giant slice drifting at 0.1×, with distant capital-ship silhouettes (dark, 1–2 px detail, a few blinking running lights) at 0.2×. Seeded and procedural, like the others.
   - Polish `ion`, `horizon` and `pulsar` only if they don't yet read as their sectors (ion: teal/cyan; horizon: violet-black with a faint distant accretion disk setpiece; pulsar: pink/gold nursery clouds). Keep `kessler` and `title` unchanged.
   - `themeForLevel` maps the five level ids.
3. **Scroll follows the world:** make sure the background's scroll uses `world.scrollSpeed` every tick (it may currently use the theme's speed), so T21's scroll ramps move the parallax. If it already does, note that.
4. **Speed lines:** above 50 px/s of `world.scrollSpeed`, draw 1 px vertical streaks (length ∝ speed, 6–14 px, sparse, very low alpha in the theme's highlight color) at 1.5×. Fade them in across 40–60 px/s. No allocations per frame.
5. Show every theme in the gallery or sandbox. Under `?sandbox`, add a key to cycle themes (`V`) and one to step the scroll speed through 30/70/18 (`Shift+V`) if none exists.

## Acceptance criteria
- [ ] All five songs play from the sandbox or a dev hook, loop without a gap, and aren't louder than `level1` (by velocity/voice comparison; note what you checked). Test with audio **muted**: verify structure in code and tests, and leave the listening to the user.
- [ ] Each of the five sector backgrounds reads as its sector (screenshots described in Notes). Values are within the art-direction caps (the existing tests pass).
- [ ] Speed lines appear only above 50 px/s.
- [ ] build / test / lint pass.

## Contract changes
(fill in)
