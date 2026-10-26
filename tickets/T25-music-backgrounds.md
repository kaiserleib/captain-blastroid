# T25 — Sector music and backgrounds
Status: done
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
- [x] All five songs play from the sandbox or a dev hook, loop without a gap, and aren't louder than `level1` (by velocity/voice comparison; note what you checked). Test with audio **muted**: verify structure in code and tests, and leave the listening to the user.
- [x] Each of the five sector backgrounds reads as its sector (screenshots described in Notes). Values are within the art-direction caps (the existing tests pass).
- [x] Speed lines appear only above 50 px/s.
- [x] build / test / lint pass.

## Contract changes
None to the four contract files. Additive changes inside owned modules:
- `Background.draw(ctx, scrollY, time, height, scrollSpeed = 0)`: new optional 5th arg, which drives the speed lines. `createBackgroundPair` passes `w.scrollSpeed`.
- `ThemeId` gains `'armada'`. `SetPieceKind` gains `'giant' | 'fleet' | 'disk'`. `SetPieceSpec` gains optional `parallax` (default 0.1) and `light` (fleet running-light color, a point color).
- New exports: `SPEED_LINES`, `speedLineAlpha`, `speedLineLength` (backgrounds), and `PULSAR_SONG_PERIOD = 3` (`src/audio/songs/pulsar.ts`).
- `themeForLevel` now maps `ionShoals→ion`, `eventHorizon→horizon`, `pulsarNursery→pulsar`, `armada→armada` (theme ids still map to themselves).

## Notes
- **Songs** (`src/audio/songs/`), all in the step-sequencer format and registered in `songs/index.ts`:
  - `ion`: A minor, 128 BPM. Thin 12.5% lead over add9/maj7 square arps and a triangle bass; the back half lifts to D minor.
  - `horizon`: C phrygian, 100 BPM. Long triangle bass doubled an octave up on pulse 2 with instant vibrato, so the two beat like a detuned bass. Sparse kick/snare/crash hits.
  - `pulsar`: exactly 120 BPM, a driving A-major 6-note arpeggio. **Phase lock:** every pattern (the intro too) is a multiple of 24 steps (6 beats = 3.0 s). `k` appears only on step 0 of each 24-step group, so kicks land at song time t = 3.0·k s from song start, across loops. A test walks two loops to verify this.
  - `armada`: G minor military march, 132 BPM, with dotted horn stabs, oom-pah bass, snare rolls and a B♭-major lift.
  - `armada_boss`: F minor, 176 BPM (faster than `boss` at 168), with an octave bass on most sixteenths and a Neapolitan G♭ climb.
  - Each loop is ≥ 32 bars of 4/4 (128 beats) and ends on whole bars. Loop lengths: ion 60 s, horizon 77 s, pulsar 84 s, armada 58 s, armada_boss 44 s.
- **Loudness, checked muted.** Music only renders through Web Audio, so there's no offline render. I added `songs/loudness.ts`, a pure estimator that mirrors `music.ts`: per-step envelope level × waveform RMS (the pulse-duty RMS and the triangle's), plus drum energy and peaks taken from `music.ts`'s drum recipes. Tests require every new song's per-channel `vol` and `drums` ≤ level1's, and its estimated RMS and peak ≤ level1's.
  - Estimates (RMS / peak): level1 0.262/1.57, ion 0.243/1.49, horizon 0.243/1.49, pulsar 0.229/1.55, armada 0.207/1.55, armada_boss 0.254/1.35.
  - For reference, the existing `boss` measures 0.330, the loudest song we have (not changed here).
  - Horizon's and armada_boss's triangle volumes were lowered (0.5 / 0.42) to get under level1. armada_boss gets its heaviness from note density, not level.
- Songs play from `tools/audio.html`, which lists `SONG_IDS` automatically. Listening is left to the user.
- **Backgrounds:**
  - `armada`: steel-blue base and nebula, all fills ≤ 35% value. Set pieces:
    - a 180 px-radius banded gas giant (`giant` kind: churning latitude bands, a storm oval, a lit limb) at 0.1×, already filling the right side at launch and in view through the whole ~150 s approach;
    - two `fleet` strips at 0.2×: 3–5 nose-up capital-ship wedges with 1–2 px superstructure/notches, a lit top-left edge, dithered Syndicate-rust patches, and 5–9 red running lights in two blink groups. They blink by palette phase (4 pre-rendered frames, no per-frame work).
  - `horizon`: added a faint gold `disk` set piece (a tilted accretion disk with a dark occluding core and a photon ring) at 70 s.
  - `pulsar` was blue, so I recolored it to pink/magenta → gold nursery clouds, pinkish stars, and a rose/gold planet. Coverage is now 0.65.
  - `ion` already read as teal/cyan and is unchanged, as are `kessler` and `title`.
- Screenshots I checked in `tools/backgrounds.html` and the `?sandbox` game:
  - armada: giant slice on the right with bands; dark needle hulls with rust and red lights against it and open space.
  - horizon: a small gold ring around a black core over the violet haze.
  - pulsar: magenta clouds with gold cores.
  - speed lines: faint 1 px streaks at 68 px/s, none at the nominal 34.
- **Scroll already followed the world:** the background system already did `scrollY += w.scrollSpeed * dt` every tick, so T21's ramps move the parallax. I added a test that changes `scrollSpeed` between ticks.
- **Speed lines:** 18 fixed lines per theme/seed (typed arrays, built at prebuild), 1 px wide at 1.5× scroll in the theme's streak-head color, alpha ≤ 0.22. Length is 6 + 0.2·(speed − 50), clamped to 6–14 px, with 0.7–1 per-line jitter. No allocations per frame.
  - **Decision:** the ticket says both "fade across 40–60" and "appear only above 50", so they fade in from 50 (alpha 0) to 60 (full). Nothing appears at or below 50.
- **Sandbox** (`src/backgrounds/sandbox.ts`, installed from `backgrounds/index.ts`, applied inside the background tick):
  - `V` cycles all themes.
  - `Shift+V` steps `world.scrollSpeed` 30 → 70 → 18. The first press sets 30.
  - Both log to the console. Verified in-browser.
- **Outside Owns (small, needed):**
  - `src/audio/song.test.ts`: its hard-coded "ships title, level1, boss and clear" list now includes the new ids.
  - `tools/backgrounds.ts`: passes its scroll speed to `draw`, so the speed slider shows speed lines.

## Follow-ups
- T29: phase-lock pulsars to `PULSAR_SONG_PERIOD` from the moment `playSong('pulsar')` starts (playback begins ~0.05 s after the call, on the audio clock). The sim needs its own song-start timestamp, because music.ts doesn't expose song position.
- Consider bringing `boss` (estimated RMS 0.33, ~26% over level1) down to level1's loudness. That's the likeliest "too loud" offender. Not in this ticket's scope.
- The user should listen to the five songs (`tools/audio.html`) and judge the mood/mix by ear.
