# Wave 6 briefing (T27–T30): one sector per ticket

Wave 5 is merged and live on main. Every sector already exists as a ~45 s **stub** that ends in the Rock Hauler, and your job is to replace your sector's stub with the real thing. **Read first:**
- `docs/design.md` → "Campaign: Levels 2–5", your sector's section especially
- `tickets/T21-level-framework.md` → Notes → **"API for sector tickets"**: registries, minimal sector folder, import rules
- `tickets/T23-hazards.md` → Notes → **"API"**: tow/fling, black-hole variants, field-only, collapse, pulsar variants/patterns/gaps
- T24 Notes (ship and pilot ids) and T25 Notes (song ids, `PULSAR_SONG_PERIOD`)

The user is away. Make sensible calls, record them in your ticket's Notes, and don't stop to ask.

## Working rules
- Run `npm ci`.
- **Merge main into your worktree branch first, if it's behind.** Wave-5 agents found their worktrees created from an old commit. Check that `git log --oneline -1 main` is in your history, and fast-forward or merge if it isn't.
- Stay inside your ticket's **Owns**: `src/content/levels/<id>/**`, `src/game/levels/<id>/**`, and new `tests/sim/<id>.*.test.ts` files.
  - Don't edit `content/levels/index.ts`, `game/levels/index.ts` or any shared module.
  - If a shared change is truly needed, describe it under "Shared changes needed" with a minimal patch and work around it locally.
- **Browser:**
  - Use your own Chrome tab, and never touch other tabs.
  - Dev server on port **51NN** (T27 → 5127, T28 → 5128, T29 → 5129, T30 → 5130).
  - Every URL gets **`?mute`**.
  - `?level=N` jumps to your sector (first launch only). `?god`, `?t=SECONDS`, `?debug`, `?sandbox` and `?save=all` all work.
  - Stop the server and close the tab when done.
- **e2e:** `npm run e2e` starts Vite on port 5120 unless you set `E2E_PORT`. Use `E2E_PORT=51NN+50` (e.g. T27 uses 5177) so parallel worktrees don't collide.
- **Done means:**
  - `npm run build && npm run test && npm run lint && npm run test:sim && npm run e2e` pass.
  - The balance table is in your Notes.
  - Acceptance boxes are ticked, `Status: done`, and the work is committed on your branch with a message ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Final message: short. List what changed, balance numbers, shared changes needed, follow-ups and your branch name.

## Ids, prefixes and keys
| Ticket | Level id | Id prefix (enemies, boss parts, sprites, scripts) | Boss id | Sandbox keys |
|---|---|---|---|---|
| T27 | `ionShoals` | `ion_` / scripts `ionShoals.*` | `ion_shepherd` | `Q` `E` `Y` (enemies), `Shift+Q` (boss) |
| T28 | `eventHorizon` | `hz_` / `eventHorizon.*` | `hz_perihelion` | `U` `I` `O`, `Shift+U` |
| T29 | `pulsarNursery` | `pn_` / `pulsarNursery.*` | `pn_magnetar` | `H` `J` `L`, `Shift+H` |
| T30 | `armada` | `ar_` / `armada.*` | `ar_leviathan` | `Z` `C` `M` (+ `Shift+Z` frigate), `Shift+C` (boss) |

Taken keys you must not reuse: WASD/arrows/P/Esc (input), digits 0–9, F1–F6, `G`, `K` (Rock Hauler), `R`, `B`, `N`, `A`, `X`, `T`, `V`.

## Cross-ticket decisions
- **Ion Mine (L2) and L5 Minelayers:** T30 must not import T27's folder. T30 registers its own `ar_mine` def and behavior, with the same numbers as the design's Ion Mine.
- **Pods:**
  - Pilots are already wired: `ionShoals` → zzkar, `eventHorizon` → sable, `pulsarNursery` → pip, `armada` → vale.
  - Use the timeline's `escapePod` (with `hp` where the design says so), or `spawnEscapePod(w, pilot, x, hp)` from a script when the pod spawns at a dynamic spot (T30's frigate wreck). For the pilot id, use `nextRescuablePilot(getSave(), levelId)` (`meta`), as the director does.
  - The salvage cache that replaces a pod has no HP. That's fine.
- **Music phase-lock (T29):**
  - GameScene calls `playSong(level.music)` in `enter`, so level time 0 ≈ song time 0 (plus about 50 ms of audio scheduling).
  - Pulsar pulse k fires at pulse-clock k·period. To land a 3.0 s pulsar on the music accent, spawn it with `phase = directorTime(w) mod 3` (or write the matching `phase` into the timeline event). Hitstop and pause can drift this a little, which is acceptable.
- **Pulsar echo rings** (`double`): the echo's gaps are turned by **half the gap spacing** (π / gaps), so they sit *between* the first ring's gaps. The design wants the player to move between the two rings. This was fixed on main after T23; ignore T23's "half a gap width" note.
- **Boss music:** `bossMusic` defaults to `boss`. Only L5 uses `armada_boss`, which is already set in its stub.
- **Balance:** use `LEVEL=<id> RUNS=50 npm run balance` and `SKILLS=novice,typical,expert`.
  - The current bot doesn't know about pulsar rings or black-hole curving. T31 teaches it.
  - If your level's numbers are poor *only* because the bot is blind to a hazard, say so in Notes with evidence (for example, hits by source), and tune for what a human would face rather than for the blind bot.
  - The god-bot playthrough must still clear every seed.
- **Art bar:** match the Rock Hauler and the L1 roster. 15-bit palette and outlines, hit flash via the sprite cache, enemy bullets only in the standard enemy-bullet sprites, and everything visible in `tools/gallery.html`. The user cares about the SNES look.
