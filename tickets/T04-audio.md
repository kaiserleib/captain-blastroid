# T04 — Audio: procedural SFX + chiptune sequencer
Status: todo
Wave: 1 · Depends on: T00 · Blocks: T18 (polish)

## Goal
All sound is synthesized with Web Audio. There are no files. That covers punchy, SNES/arcade-flavored SFX and a small step sequencer for level and boss music. iOS-safe unlock.

## Owns
`src/audio/**` (audio.ts mixer/unlock, sfx.ts synth + presets, music.ts sequencer, songs/*.ts, index.ts), tests for pure parts. The registration that subscribes the audio module to `world.events` `sfx`.

## Requirements
1. **audio.ts:** lazily create the `AudioContext`. `unlock()` is called from the first pointerdown/keydown (resume plus a silent buffer for iOS). Master, SFX and music gain buses with a short compressor on master. `setMuted`, `setVolume(bus, v)`. Suspend on pause/visibility hidden, and resume on resume.
2. **sfx.ts:** an sfxr-style parameterized voice (wave: square/saw/triangle/noise; ADSR; pitch slide; vibrato; duty; low-pass; repeat). `play(id, {pan?})`, where pan derives from the event's `x` (−1..1 across 240 px). **Voice limiting:** max 3 concurrent instances per id, plus a per-id 30 ms rate limit, so rapid fire doesn't clip.
3. **Presets** (ids are the contract other tickets emit): `shot_blaster`, `shot_spread`, `shot_lance`, `shot_seeker`, `drone_hit`, `enemy_hit`, `enemy_die_s`, `enemy_die_m`, `asteroid_break`, `player_hit`, `player_die`, `shield_up`, `pickup`, `weapon_up`, `magnet_on`, `repulsor_on`, `pod_rescue`, `boss_warning`, `boss_die`, `ui_move`, `ui_confirm`, `ui_back`. Player shots are quiet and low in the mix. Hits and explosions are the stars.
4. **music.ts:** a 4-channel step sequencer (2 pulse, triangle bass, noise drums) with tempo, patterns, song order and loop point, scheduled ahead with a lookahead timer (no setInterval drift). `playSong(id)`, `stop()`, `fadeTo(id, seconds)`.
5. **Songs:** `title` (heroic, mid-tempo), `level1` (driving, about a 45 s loop), `boss` (tense, faster) and `clear` (short fanfare). Write them as data (note strings like `'C4 . E4 . G4 ...'`).
6. Dev page: add an "Audio" section to the gallery with buttons for every SFX and song (T02 owns the gallery shell. Add yours via `tools/gallery.ts` registration.)

## Acceptance criteria
- [ ] Audio starts after the first tap on iOS Safari, with no console errors before the unlock.
- [ ] Holding max-level weapons for 30 s doesn't clip or build up voices (check active voice count in `?debug`).
- [ ] Music loops seamlessly, and tab switching doesn't desync it.
- [ ] Unit tests: note parser, voice limiter.

## Out of scope
Settings UI (T17 calls `setVolume`/`setMuted`).
