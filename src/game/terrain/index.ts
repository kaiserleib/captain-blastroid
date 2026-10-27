// Tile terrain (T34): string-grid chunks scrolling in a ring buffer, wall
// push-out and crushes, shots stopping on tiles, gates, turret sockets, and
// the solid-geometry query other modules read through `sim/hooks`.
import type { TerrainEvent } from '../../content/levels/types';
import {
  registerCollisionPass,
  registerSolidQuery,
  registerTimelineAction,
  type RayHit,
  type SolidQuery,
} from '../../sim/hooks';
import type { World } from '../../sim/world';
import { slabSolidQuery } from '../obstacles';
import { installTerrainSandbox } from './sandbox';
import { clearTerrain, queueChunk, terrainPass } from './terrain';
import { terrainRaycast, terrainSolidAt } from './tiles';
import './terrain.sprites';

export { crackStage, drawTerrain, terrainLayer, tileFrame, tileMask } from './draw';
export {
  getTerrainState,
  ignoreTerrain,
  registerTurretSpawner,
  rowAtY,
  rowBottom,
  type TerrainState,
  type TurretSpawner,
} from './state';
export {
  clearTerrain,
  crushCount,
  lastCrushTick,
  queueChunk,
  terrainActive,
  terrainPass,
  terrainQueued,
  type ClearOptions,
  type QueueOptions,
} from './terrain';
export { TERRAIN_SPRITE_IDS, tileSpriteId } from './terrain.sprites';
export {
  carveTiles,
  damageTile,
  nearestOpenX,
  terrainRaycast,
  terrainSolidAt,
  tileAt,
  tileDamageMul,
} from './tiles';
export {
  validateChunk,
  validateRows,
  validateSequence,
  type ChunkProblem,
  type ValidateOptions,
} from './validate';

/** Timeline chunk id that ends the terrain (walls taper off over `TERRAIN.fadeRows`). */
export const CLEAR_CHUNK = '@clear';

// Other solid geometry (T33's shade slabs) joins terrain in one query.
const sources: SolidQuery[] = [];
const scratch: RayHit = { x: 0, y: 0, nx: 0, ny: 0, t: 0 };

const composite: SolidQuery = {
  isSolidAt(w, x, y) {
    if (terrainSolidAt(w, x, y)) return true;
    for (let i = 0; i < sources.length; i++) if (sources[i]!.isSolidAt(w, x, y)) return true;
    return false;
  },
  raycastSolid(w, x0, y0, x1, y1, out) {
    let hit = terrainRaycast(w, x0, y0, x1, y1, out);
    for (let i = 0; i < sources.length; i++) {
      if (!sources[i]!.raycastSolid(w, x0, y0, x1, y1, scratch)) continue;
      if (hit && scratch.t >= out.t) continue;
      hit = true;
      out.x = scratch.x;
      out.y = scratch.y;
      out.nx = scratch.nx;
      out.ny = scratch.ny;
      out.t = scratch.t;
    }
    return hit;
  },
};

/** Adds solid geometry to `isSolidAt` / `raycastSolid` beside the terrain (nearest ray hit wins). */
export function addSolidSource(q: SolidQuery): () => void {
  sources.push(q);
  return () => {
    const i = sources.indexOf(q);
    if (i >= 0) sources.splice(i, 1);
  };
}

function onTerrainEvent(w: World, ev: unknown): void {
  const e = ev as TerrainEvent;
  if (e.chunk === CLEAR_CHUNK) clearTerrain(w);
  else queueChunk(w, e.chunk, { theme: e.theme });
}

/** Registers the collision pass, solid query and `terrain` timeline action (idempotent; tests re-run it after `clearHooks`). */
export function registerTerrainHooks(): void {
  registerCollisionPass(terrainPass);
  registerSolidQuery(composite);
  registerTimelineAction('terrain', onTerrainEvent);
}

registerTerrainHooks();
// Shade slabs (T33) are solid too; terrain's composite replaces their own registration.
addSolidSource(slabSolidQuery);
installTerrainSandbox();
