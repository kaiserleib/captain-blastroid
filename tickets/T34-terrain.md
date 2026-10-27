# T34 — Terrain: tile walls, gates, crush, turret sockets
Status: todo
Wave: 8 · Depends on: T31 + the wave-8 contracts commit · Blocks: T39, T42

## Goal
Solid scrolling terrain authored as string-grid chunks: the first walls in the game. It has to feel fair and readable on a phone.

## Owns
- `src/game/terrain/**` (new feature folder) and `src/content/terrain.ts` (tile defs, chunk format, the shared test chunks)
- Terrain tile sprites for the `warrens` and `foundry` themes
- `tests/sim/bots.ts`: add the terrain cost term and `hitCause` only (append-only)
- `tools/sections/terrain.ts`
- Small additive `src/sim/**` changes so bullets, rocks and enemies collide with tiles, noted under Contract changes

## Read first
`docs/design.md` → **"Terrain (L7, L10 escape)"**, the Level 7 section, and Level 10's escape. Also `tickets/WAVE8-NOTES.md`, `src/gfx/sprite.ts` (the string-grid idea), `src/sim/collisionRules.ts` and `src/sim/cleanup.ts`.

## Requirements
1. **Data:**
   - 8 px tiles, 30 columns. Chunks are arrays of 30-char strings using `# % = T .`.
   - Terrain lives in a fixed-size ring buffer of rows. Rows enter above the screen and scroll with `world.scrollSpeed`.
   - `queueChunk(w, chunkId, { theme })` and the `terrain` timeline action (registered). `clearTerrain(w, { fadeRows })`.
   - `isSolidAt(w, x, y)` is registered through the contracts commit's hook. Also `tileAt`, `damageTile`, `carveTiles(w, x, y, r)` (Borers and the Wyrm), and `raycastSolid(w, x0, y0, x1, y1, out)`, which returns the hit point and normal for Ricochet.
2. **Collision:**
   - **Ship:** pushed out along the shortest axis, with no damage. A crush (push past the bottom clamp) costs 1 shield and moves the ship to the nearest open column at its row, with normal invulnerability.
   - **Bullets:** player and enemy bullets stop on solid tiles. `%` and `=` tiles take player damage (`%` 3 HP, `=` 6 HP), and Rook's passive multiplies gate damage. Ricochet bounces are T35's: expose `raycastSolid`.
   - **Rocks** break on walls.
   - **Enemies:** dumb enemies die on walls. Smart avoidance gets a tile-ahead term.
   - `T` tiles call `registerTurretSpawner(theme, fn)`, so a sector spawns its own turret when the row enters.
3. **Fairness:**
   - A chunk validator, run as a unit test over every chunk in content: corridors ≥ 6 tiles (≥ 7 for chunks tagged `escape`), lateral shift per row within the speed rule, and gate lead time.
   - A gate tile reaching y = 300 crumbles.
4. **Draw:**
   - Per-theme 8×8 tile sprites (edge, inner, outer corner, inner corner, crumbly, gate, socket) chosen by a 4-neighbour mask, cached per row when it enters.
   - Crumbly tiles crack visibly at 2/3 and 1/3 HP. Gate tiles have hazard stripes.
   - Draw only the visible rows, with no per-tile allocation.
5. **Bots:** a corridor-following cost term (prefer the open column nearest the ship, look ahead about 1.5 s of scroll) plus crush avoidance.
6. **Sandbox and gallery:**
   - `\` queues a test corridor and `Shift+\` queues a gate row.
   - A gallery section shows both tile sets and a scrolling sample chunk with a crush demo.
7. **Tests:** push-out, crush, bullet stop, gate damage and crumble, carve, raycast normals, the validator, and the ring-buffer wrap.

## Acceptance criteria
- [ ] A 60 s corridor test in the sandbox feels fair with the mouse and the floating stick: no snagging on corners and no unfair crushes (described in Notes).
- [ ] Bots clear a corridor-only test level with fewer than 1 crush per run on average.
- [ ] Perf: full-width terrain plus a busy screen stays at 60 fps (the T31 perf method).
- [ ] Act I is unchanged: the event-log hashes are identical.
- [ ] build / test / lint / test:sim pass.

## Contract changes
