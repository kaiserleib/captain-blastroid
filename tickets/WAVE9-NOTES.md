# Wave 9 briefing (T38–T42): one sector per ticket

Wave 8 (T32–T37) is merged on main. Every Act II sector exists as a ~45 s **stub** that ends in the Rock Hauler, and your job is to replace your sector's stub with the real thing. **Read first:**
- `docs/design.md` → "Campaign: Act II", your sector's section especially. T35 changed Ricochet and Flak damage; the design already shows the new numbers.
- The **Notes** of the wave-8 tickets you depend on. Their API sections are the source of truth:
  - `tickets/T33-hazards-act2.md` → Notes → **API**: flares, shade, slabs, portals, bubbles.
  - `tickets/T34-terrain.md` → Notes → **API**: chunks, tiles, `carveTiles`, `raycastSolid`, turret spawners, the validator.
  - T32 Notes: the escape, `ACTS`, `assistAfter`, the stubs.
  - T35 Notes: weapons, the capsule pool, field tests.
  - T36 Notes: pilot ids, `playerPastPos`.
  - T37 Notes: song ids, `beatSeconds`.
- `tickets/T21-level-framework.md` → Notes → "API for sector tickets" (registries, sector folder layout). It's unchanged.
- T27–T30 are the quality reference.

The user is away. Make sensible calls, record them in Notes, and don't stop to ask.

## Working rules
- Run `npm ci`. **Merge main into your branch first** if `git log --oneline -1 main` isn't in your history.
- **Owns:** `src/content/levels/<id>/**`, `src/game/levels/<id>/**`, and new `tests/sim/<id>.*.test.ts` files.
  - Don't edit shared modules or the level indexes.
  - If a shared change is truly needed, describe it under "Shared changes needed" with a minimal patch and work around it locally.
- **Browser:**
  - Your own Chrome tab only.
  - Dev server on port **51NN** (T38 → 5138 … T42 → 5142).
  - **`?mute`** on every URL.
  - `?level=N&save=act1` jumps to your sector. `?god`, `?t=`, `?debug` and `?sandbox` all work.
  - Stop the server and close the tab when done.
- **e2e:** `E2E_PORT=51NN+50` (T38 → 5188).
- **Done means:**
  - `npm run build && npm run test && npm run lint && npm run test:sim && npm run e2e` pass.
  - The balance table (with `SAVE=act1`) is in Notes.
  - Boxes are ticked and `Status: done` is set.
  - The work is committed with a message ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Act I must not move.** These hashes must stay identical. Run them in a throwaway `tests/sim/*.test.ts` with `SIM=1 npx vitest run <file> --silent=false` and delete the file after:
  ```ts
  runSim('hash-god', godBot(), 300).hash                         // 17a78586
  runSim('hash-dodger', dodgerBot(), 200).hash                   // 66a3e907
  runSim('hash-' + id, dodgerBot(), 120, { levelId: id }).hash   // kessler 432d4c06, ionShoals 1c9e54f6,
                                                                 // eventHorizon f3426d8c, pulsarNursery 0b41ee42, armada 8b2a6879
  ```
- **Final message:** short. List what changed, balance numbers, shared changes needed, follow-ups and your branch name.

## Ids and keys
| Ticket | Level id | Prefix | Boss id | Sandbox keys (match on `KeyboardEvent.code`) |
|---|---|---|---|---|
| T38 | `corona` | `co_` | `co_heliostat` | Alt+`Q` `E` `Y`, Alt+Shift+`Q` (boss) |
| T39 | `warrens` | `wr_` | `wr_wyrm` | Alt+`U` `I` `O`, Alt+Shift+`U` |
| T40 | `junction` | `wj_` | `wj_janus` | Alt+`H` `J` `L`, Alt+Shift+`H` |
| T41 | `chrono` | `cr_` | `cr_echo` | Alt+`Z` `C` `M`, Alt+Shift+`Z` |
| T42 | `foundry` | `fd_` | `fd_architect` | Alt+`R` `G` `K`, Alt+Shift+`R` |

Keys used in wave 8: `F`, `Shift+F`, `[`, `Shift+[`, `]`, `Shift+]` (T33); `\`, `Shift+\` (T34); F6–F9 (T35); `X` also clears the Act II hazards.

## What's already wired on main (beyond the ticket APIs)
- **Time bubbles** scale enemy updates (movement and fire timers, via the `dt` passed to behaviors), pickup and pod movement, bullets and rocks. Enemy bullets also multiply in `w.enemyBulletTimeScale` (Dr. Halász's bullet time).
  - **Bosses are not scaled.** The boss system has its own update. T41: if the Echo should feel its PARADOX bubble, scale `dt` by `timeScaleAt(w, x, y)` inside your own controller.
- **Shade slabs are solid.** They join T34's composite solid query, so Ricochet bounces off them and `isSolidAt` sees them.
- **Hit causes:** the harness's `hitCause` reports `crush`, `flare`, `portal` and `bubble-shot`. Use them in your balance notes.
- **Escape music:** `escapeStarted` plays `escape`.
- **Stall breaker:** bosses set their own threshold with `assistAfter` on their registration (T42: the Architect uses 150).
- **Field tests:** each stub already has the design's `fieldTestWeapon`. Add the field-test `forceCapsule` to your supply-run formation, and keep `guaranteeWeapon` naming the same weapon.

## Per-sector pointers from wave 8
- **T38 (corona):**
  - Sunskimmers: `setFlareImmune('co_sunskimmer')`, and speed up while `isFlareBurning`.
  - Shades: `nearestShadeSpot`.
  - Lens Drones: key off `flarePhase`.
  - Heliostat: `registerShadeCaster` for its hull.
  - The flare fizzle count is in `hazardLog(w)`; report it in the balance notes.
- **T39 (warrens):**
  - Register `T` sockets with `registerTurretSpawner('warrens', fn)`.
  - Borers and the Wyrm carve with `carveTiles`.
  - Chunks must pass the validator (`registerChunks` plus the test).
  - Tune `THEMES.warrens.nebula.start` (in `src/backgrounds`, a shared file: suggest the value, don't edit it) so the strata wall meets the cave mouth at 15 s.
  - The terrain feel pass hasn't been done by a human, so note anything that felt off.
- **T40 (junction):**
  - Blinkers: `portalOptIn(w, id)`.
  - Gate Pylons: `setPortalEnd` every tick, `collapsePortalPair` on death.
  - Janus: owns its pairs and calls `swapPortals`.
- **T41 (chrono):**
  - `playerPastPos(w, secondsAgo, scratch)` with a preallocated scratch object; the history covers 10 s.
  - The Echo reads `w.player.weapons` for its patterns. All eight weapon ids are valid.
- **T42 (foundry):**
  - Phase-lock welding-line pulsars with `beatSeconds('foundry')` (0.441 s).
  - `escape.script` queues `escape`-tagged chunks (≥ 7-tile corridors) and debris, and ends with `@clear`.
  - Spawning Act I enemies by id is fine. Don't use Act II sector enemies.
