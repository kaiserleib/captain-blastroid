# T34 — Terrain: tile walls, gates, crush, turret sockets
Status: done
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
- [x] A 60 s corridor test in the sandbox feels fair with the mouse and the floating stick: no snagging on corners and no unfair crushes (described in Notes — scripted check only; a human pass is still owed).
- [x] Bots clear a corridor-only test level with fewer than 1 crush per run on average.
- [x] Perf: full-width terrain plus a busy screen stays at 60 fps (the T31 perf method).
- [x] Act I is unchanged: the event-log hashes are identical.
- [x] build / test / lint / test:sim pass.

## Contract changes
All additive, no-op by default.
- `src/sim/hooks.ts`: `registerCollisionPass(fn: (w, dt) => void)` / `getCollisionPasses()` (`CollisionPass` type), cleared by `clearHooks`.
- `src/sim/collision.ts`: `collide()` runs the registered passes after `tickChain`, before the spatial-hash rebuild. Terrain runs here, so neither GameScene's system list nor the harness's `GAME_SYSTEMS` changed.
- Importing `game/terrain` registers `registerSolidQuery` (a composite: terrain plus `addSolidSource` extras) and `registerTimelineAction('terrain', …)`.

## Notes
**Shared edits outside Owns (small, flagged for the merge):**
- `src/scenes/GameScene.ts`: imports `terrainLayer` from `game/terrain` and adds it to `layers` (z 5). The import also registers the hooks and the sandbox keys.
- `src/game/enemies/avoidance.ts`: the tile-ahead term (requirement 2). Each existing probe tip also checks `isSolidAt`, and a solid tip steers like a rock of r 4 there. It's a no-op without terrain.
- `tests/sim/harness.ts`: `hitCause` returns `'crush'` when `lastCrushTick(w) === w.tick`. This is a 2-line edit (hitCause lives in harness.ts, not bots.ts).

**Calls I made:**
- **Hold semantics.** When the queue runs dry, the last row repeats (gates opened, sockets filled with rock) until `clearTerrain`. A late timeline event then can't open a gap and drop walls from nowhere. `clearTerrain(w, { fadeRows })` tapers the walls back to the edges (default 6 rows). The timeline chunk id `@clear` does the same. `{ now: true }` wipes everything.
- **Ship terrain box** is 12×12 (`TERRAIN.shipHalfW/H` 6), bigger than the 4 px hitbox so the sprite doesn't sink into rock. Push-out tries the four directions, each followed through stacked tiles, and takes the shortest that lands inside the playfield. The cap is 8 px per tick. Ties go sideways first, so the ship slides along walls. Testing the whole box, not tile by tile, avoids internal-edge snags. **Crush** means no valid push (down is invalid past the bottom clamp, y 392). It costs 1 shield through `damagePlayer` (invulnerability respected), then moves the ship to the nearest x at its row, searched in 4 px steps, where the box fits with 2 rows of headroom. If there's none it tries up to 8 rows higher.
- **Shots:** they stop on `#`, `%` and `=`. **Sockets don't stop shots**: the turret on a socket must be hittable, and its own shots spawn inside the socket. `isSolidAt` and `raycastSolid` do count sockets as solid. Shots use point tests, which are tunnel-safe at 8 px tiles and ≤ 400 px/s.
- **Rook:** tile damage is `amount × player.stats.rockDmgMul` (T36). It applies to `%` and `=`. Breaking a tile scores 10 for crumbly and 25 for a gate, player shots only. Crumbled gates and carves score nothing.
- **Enemies:** dumb enemies die (`'asteroid'` source, no credit) when their center, or a point r/2 ahead along their velocity, is in rock (sockets excluded). Smart enemies are pushed clear (≤ 16 px) and steered by the avoidance term. Bosses, `ignoreTerrain(defId)` defs and anything above y 0 are exempt. Rocks: destructible rocks take their HP and indestructible ones are released, on screen only. Tractor-held rocks are exempt.
- **Gate crumble:** a gate tile whose row's bottom edge reaches y 300 breaks itself (dust, sfx, no score).
- **Draw:** rows are baked into a ring atlas (240×8 per slot) when they enter or change (`rev` counter). The mask is computed at bake time, so a broken tile re-bakes its neighbours. A frame costs ≤ 2 `drawImage` calls. Dust puffs come from a 48-entry ring in the sim state.
- **Validator** (`validateRows/Chunk/Sequence`):
  - Rows must be 30 chars of `#%=T.`.
  - Every row needs a run ≥ 6 tiles (≥ 7 `escape`), with `.` and `=` open and `%` and `T` wall.
  - **Lateral rule:** a ship-path DP with the 12 px box, moving ≤ `floor(0.6 × 95 × 8 / scroll)` px per row (95 px/s is the slowest ship). It must reach the top from some spot in every corridor ≥ the minimum width. Narrower alcoves are exempt.
  - **Gate lead:** `300 / scroll ≥ 3 s`.
  - Scroll is the chunk's `scroll`, or else 34 (90 for `escape`).
- **Feel (acceptance 1):** I couldn't fly it with real hands while the user is away, so this was checked by script and by watching it run.
  - In `?sandbox` in Chrome, `\` queued the corridor and it scrolled cleanly. The gate took a hole from auto-fire, and an idle centred ship got exactly 1 crush, from the fork pillar, and was relocated.
  - The test corridor shifts at most 1 tile per row, against a limit of 13 px per row at 34 px/s.
  - Unit tests cover sliding along a two-row wall face with no snag.
  - **A human mouse and floating-stick pass is still owed.**
- **Bots:** this is `terrainCost` in bots.ts. It penalizes paths through rock and the spot at 0–1.5 s of scroll look-ahead, with a distance-to-open-column gradient, and penalizes sitting at y > 340 under rock. On the corridor-only test (`tests/sim/terrain.corridor.test.ts`), crushes per run were 0 for typical at 30 and 34 px/s and for novice at 30. With the term disabled they were 3–4.
- **Perf** (the T31 method: Chrome, `?sandbox&debug`, port 5134, M-series, 120 Hz): full corridor plus about 326 enemy shots and 80 enemies gave 120 fps and TPS 60, with UPD 0.08 / max 0.20 ms and a worst frame of 10.4 ms over 10 s.
- **Act I hashes** are identical before and after merging main (T36): god 17a78586, dodger 66a3e907, kessler 432d4c06, ionShoals 1c9e54f6, eventHorizon f3426d8c, pulsarNursery 0b41ee42, armada 8b2a6879.

### API (`src/game/terrain` index; content in `src/content/terrain.ts`)
- `queueChunk(w, chunkId, { theme: 'warrens' | 'foundry' })` queues rows above the screen; they scroll with `w.scrollSpeed`. Timeline: `{ t, terrain: { chunk, theme } }`, or `chunk: '@clear'` to taper off.
- `clearTerrain(w, { fadeRows?, now? })`, `terrainQueued(w)` (rows pending), `terrainActive(w)`.
- `isSolidAt` / `raycastSolid` from `sim/hooks`. These are the composite. `RayHit` has x, y, nx, ny and t, and the normals are axis-aligned face normals. `addSolidSource({ isSolidAt, raycastSolid })` lets T33's slabs join, with the nearest ray hit winning.
- `tileAt(w, x, y)` returns a `Tile` code (`Empty/Rock/Crumbly/Gate/Socket`).
- `damageTile(w, x, y, amount, byPlayer = true)` returns true when the tile breaks.
- `carveTiles(w, x, y, r)` removes every tile, rock included, whose center is within r, and returns the count.
- `nearestOpenX(w, x, y, hw?)` gives the nearest x in the row where a box of half-width hw fits, or NaN.
- `registerTurretSpawner(theme, (w, x, y) => …)` is called for each `T` as its row spawns, 2 rows above the screen at the tile center. The turret must scroll itself (`y += w.scrollSpeed·dt`). Use `tileAt` to notice a carved socket.
- `ignoreTerrain(defId)` lets an enemy pass through walls (burrowers).
- `lastCrushTick(w)`, `crushCount(w)`, `terrainLayer` (z 5), `TERRAIN_SPRITE_IDS`, `tileSpriteId(theme, kind)`.
- `validateChunk(def, opts?)`, `validateRows(rows, { scroll?, escape? })` and `validateSequence(ids, opts?)` return `ChunkProblem[]` (empty means OK).
- Content: `registerChunks(defs)`, `getChunk`, `chunkIds`, `TERRAIN` and `TERRAIN_RULES`, `TEST_CHUNKS`, `TEST_CORRIDOR` and `TEST_GATE_CHUNK`.

### Chunk-authoring format (for T39 / T42)
```ts
import { registerChunks, type ChunkDef } from '../../terrain';
export const CHUNKS: ChunkDef[] = [
  {
    id: 'wr_gate_corridor', // global: use the sector prefix
    scroll: 34, // fastest scroll it runs at (validator)
    // tags: ['escape'],     // corridors ≥ 7, default scroll 90
    rows: [
      // top first, as on screen; the LAST row enters first
      '########..............########',
      '########==============########', // gate, 6 HP; crumbles at y 300
      '#######T..............%%######', // T socket (turret spawner), % crumbly 3 HP
      '########..............########',
    ],
  },
];
registerChunks(CHUNKS);
```
- Rows are exactly 30 chars of `#` rock, `%` crumbly, `=` gate, `T` socket and `.` empty, with 8 px tiles.
- Line up each chunk's first and last rows with its neighbours: the test chunks join on a 14-wide corridor with 8-tile walls.
- The last row holds until the next chunk arrives, so queue the next chunk within `rows × 8 / scroll` s.
- Add a sector unit test: `validateSequence([...ids in timeline order], { scroll })` should return `[]`.

## Follow-ups
- Human feel pass on the sandbox corridor (mouse and floating stick), especially the 12 px terrain box and crush relocation.
- Check tile contrast against T37's `warrens` and `foundry` backgrounds once they exist.
- T35 Ricochet should bounce on `raycastSolid` normals.
- Tile breaks use `asteroid_break`, and gate hits are silent. Dedicated `tile_hit` and `gate_break` sfx could come with T37.
