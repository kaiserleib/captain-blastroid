# T37 — Act II music and backgrounds
Status: done
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
- [x] Every theme appears in the gallery, and every song plays from the gallery or a debug jukebox (`?mute` everywhere except a deliberate listen).
- [x] Perf: no theme costs more than the most expensive Act I theme (measured).
- [x] build / test / lint pass.

## Contract changes
- None to `src/sim/types.ts`, `src/sim/world.ts`, `src/engine/events.ts` or `src/gfx/renderer.ts`.
- Additive, inside `src/backgrounds/` (not a core contract):
  - `THEME_IDS` gains `corona`, `warrens`, `junction`, `rift` and `foundry`. `themeForLevel('chrono')` → `rift`, and the other Act II level ids map to the same-named theme.
  - `SetPieceKind` gains `limb`, `ring`, `flare`, `clock`, `sun` and `girder`. `SetPieceSpec.anchor?: 'top'` pins a piece to the playfield top.
  - `NebulaSpec` gains `style?: 'strata'`, `stretch?`, `start?` and `lights?`. `StarSpec` gains `ghosts?`. `BackgroundTheme.speedLines?` overrides the speed-line look.
  - `speedLineLength(speed, style?)` takes an optional style.
- New `src/audio/songs/bpm.ts`: `ACT2_SONG_BPM` and `beatSeconds(id)`.

## Notes
**Songs.** All eight are in `src/audio/songs/`, registered in `songs/index.ts` under the WAVE8 ids, and play from `tools/audio.html`, which lists `SONG_IDS`.
- **Tempos.** BPMs live in `songs/bpm.ts` (`ACT2_SONG_BPM`, `beatSeconds`). It's a dependency-free module, so sector content can phase-lock without importing song data. Every song starts on a downbeat, every pattern is a whole number of bars (tested), and every loop is ≥ 32 bars and ends on a bar line.

| id | key / tempo | character | loop |
|---|---|---|---|
| `corona` | D Lydian, 140 | Bright 25% lead leaning on G♯ over a D–E shuttle | 54.9 s |
| `warrens` | E Phrygian, 110 | Clipped low 50% square ostinato on pulse 1, a triangle drone, busy noise percussion, sparse pulse-2 lead and high "lamp" pings, a drill-roll break | 69.8 s |
| `junction` | G Dorian, 126 | 3+3+3+3+2+2 syncopation. Pulse 1 calls for a bar and pulse 2 answers the next, then both lock into harmonized stabs | 61.0 s |
| `rift` | B minor, 96 | Reversed-envelope arps and written-in tempo dips (see below) | 80.0 s |
| `foundry` | C minor, 136 | Industrial march: a machine-press figure on pulse 2, tom clanks, oom-pah bass | 56.5 s |
| `boss2` | A minor, 172 | Shared Act II boss theme, faster than `boss` (168). Octave bass, 12.5% arps, a lead pressing on G♯ | 44.7 s |
| `foundry_boss` | F minor, 180 | Patterns Q and Q2 quote `armada_boss`'s A and B leads note for note (tested). F1 is the `foundry` march motif moved to F minor. High climax | 42.7 s |
| `escape` | D minor, 160 | Four-on-the-floor kick with snare on every off-beat, octave bass, a climbing lead | 48.0 s (> the 40 s countdown, so it never audibly wraps) |

- **Reversed envelopes (rift).** `music.ts` caps attack at 25% of the note, so a plain long attack can't do this. Instead, pulse 2 has `sustain: 2.2` with a 2 s decay: after a short attack, each note keeps swelling toward vol·2.2 and is cut off at its end. Nothing outside `songs/` changed.
  - The loudness test now caps the *peak* envelope, vol × max(1, sustain), at level1's channel vol. Rift's p2 peaks at 0.099 against level1's 0.1.
- **Tempo dips (rift).** A song has one BPM and `song.ts` is outside Owns, so the dips are written in. `DIP1`/`DIP2` halve the note rate (quarter-note arps, held lead) and drop to one kick a bar.
  - A real tempo map would need a `song.ts` change. I judged it not worth it.
- **Loudness (estimated RMS / peak).** level1 0.262/1.57 (reference), corona 0.210/1.32, warrens 0.242/1.33, junction 0.166/1.36, rift 0.199/1.11, foundry 0.201/1.38, boss2 0.245/1.27, foundry_boss 0.249/1.27, escape 0.253/1.27. All of them are under level1 (tested, same rule as T25).
- **Listening.** I played every song once through the jukebox with all buses at 0 and mute on, to check for console errors and that `currentSong` changed. There was no audible listen; the user should judge mood and mix in `tools/audio.html`.

**Backgrounds.** All five are in `src/backgrounds/themes.ts`. New set-piece generators are in `act2pieces.ts`, and the light-cycle helpers moved into `lights.ts`, re-exported from `setpieces.ts`. Act I themes are unchanged: no new rng calls on their paths.
- **`corona`.** A `limb` piece with `anchor: 'top'`: a radius-600 disc whose lower edge sags 44 px into the playfield.
  - The disc is limb-darkened with granulation, and the edge has prominence loops. A ragged amber glow sits below the edge, in 4 heat-shimmer frames (0.15 s each) whose texture rises.
  - The bitmap keeps 60 rows above the playfield, so on tall phones the star fills the HUD band too. Anchored pieces draw *after* the nebula, so dust doesn't blot the star.
  - Other layers: amber dust bands (the nebula with `stretch: 4`), a backlit station and a planet silhouette.
  - **Decision: the limb stays within the art rule's fill value ≤ 35%.** It reads as "hot" through hue (orange-gold), not brightness, so it can't wash out bullets. T33's flare warn overlay supplies the real whitening.
  - If the user wants it brighter, the way to do that is a separate cap just for anchored pieces.
- **`warrens`.**
  - **Opening:** open space with the asteroid looming at the top (a dark `planet` piece).
  - **From `start: 8` s** (nebula-layer scroll, 0.5×), the nebula switches to `style: 'strata'`. That style has wavy, tilted rock bands with occasional fissures, ragged cave gaps where stars show through, and 16 mining lamps that blink in two groups.
  - The gated layer comes in from the top as a wall with a jagged lip, which continues the strip exactly (`nebulaEdge`, aligned to the strip row under the edge). It never covers the open-space opening.
  - Behind terrain, the strata are dark and low-contrast.
- **`junction`.** A black-green void with three segmented, tilted ring gates (cyan haze inside, blinking lights in cyan / orange / lime) and two lens flares (core, a full-width anamorphic streak, ghost discs).
- **`rift`.** Desaturated violet. Stars have afterimages: `StarSpec.ghosts: 3` leaves dim copies 3 px (and 6 px for bright stars) above each mid/bright star. There are three faint clock faces (broken outer arcs, a dotted inner ring, 12 ticks, hands).
- **`foundry`.**
  - A dying red `sun` (limb-darkened, sunspots) at 0.03× parallax that sinks slowly across the whole level and sets during the escape.
  - Six Dyson-ring `girder` trusses at 0.2/0.3× (chords, X-bracing, hanging plates), with molten seams that pulse in two groups. A cooled seam still glows dull rust.
  - **Escape look:** `speedLines` override: 28 lines (vs 18), alpha 0.34, molten orange, length up to 30 px (0.6 px per px/s over 50). At 90 px/s they're 30 px molten streaks, with the girders sweeping past at 27 px/s.
- **Readability.** `tools/sections/backgrounds.ts` (new gallery section "Backgrounds") shows every theme scrolling under a 9-bullet enemy fan, large bullets, a capsule, a shield cell, salvage and the Kestrel.
  - I checked each Act II theme there and in `tools/backgrounds.html` (also with `?t=` and speed ×3 for foundry).
  - **corona:** the fan reads over the limb and glow. The magenta ring and white core sit far above the ≤ 35% gold.
  - **warrens:** the fan and pickups read over the strata and the dark lip.
  - **junction:** the fan reads over the ring haze and flares.
  - **rift:** clocks and ghosts are too faint to compete with the fan.
  - **foundry:** the fan reads over the red sun, and speed lines stay thin and translucent.
  - A test also requires every Act II fill to keep ≥ 2:1 WCAG contrast against the bullet ring. Lamp and speed-line colors stay ≤ 65% value.
- **Perf, measured.** The gallery's "Measure draw cost" button sweeps a 220 s level at each theme's nominal speed (so set pieces are on screen as often as in play), best of 3 × 1200 frames. "fast" is the same sweep with speed lines at 90 px/s. One run on this Mac, ms per frame (cruise / fast):
  - **Act I:** kessler 0.115/0.118, ion 0.110/0.115, horizon **0.125/0.127** (the max), pulsar 0.109/0.114, armada 0.122/0.125, title 0.114/0.116.
  - **Act II:** corona 0.115/0.118, warrens 0.120/0.124, junction 0.113/0.116, rift 0.112/0.117, foundry 0.120/0.126.
  - All Act II themes come in at or under the Act I max.
  - A first, naive sweep at 60 px/s had corona/foundry ~3% over, so I trimmed the limb glow (40 → 30 rows) and foundry's line count (40 → 28). A gated layer that fully covers the screen uses the plain 2-call tile draw, and only the transition uses source-rect draws.
- **Outside Owns (small, needed):** `src/audio/song.test.ts`. Its hard-coded `SONG_IDS` list now includes the eight new ids, as T25 did.

## Shared changes needed
- None required. Level stubs that set `theme: 'corona'`, etc. already resolve via `isThemeId`. A chrono level with `theme: 'rift'` (or the `chrono` level id) gets the rift theme.

## Follow-ups
- T39 (Warrens): tune `THEMES.warrens.nebula.start` (8 s at the theme's nominal 26 px/s, nebula layer at 0.5×) so the strata wall arrives with the cave mouth at 15 s, if the level's scroll profile differs.
- T42 (Foundry): phase-lock welding-line pulsars with `beatSeconds('foundry')` (0.441 s) from `playSong('foundry')`. As T25 noted, the sim needs its own song-start timestamp. The escape should `fadeTo('escape', …)` / `playSong('escape')` on CORE BREACH.
- User: listen to the eight songs in `tools/audio.html` at a low volume, and judge the corona limb's brightness against the ≤ 35% fill rule.
