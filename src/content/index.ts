// Content registry. Tunables live in typed `const` tables (one module per
// domain: ships, pilots, weapons, enemies, levels, drops), each keyed by id.
// Content tickets append their re-export below; keep this list append-only.
//
// export * from './enemies';
export * from './ships';
export * from './pilots';
export * from './upgrades';
export * from './dropTables';
export * from './pickups';
export * from './player';
export * from './obstacles';
export * from './weapons';
export * from './enemies';
export * from './bosses';

/** Looks up a content definition, failing loudly on a typo'd id. */
export function getDef<T>(table: Readonly<Record<string, T>>, id: string, tableName: string): T {
  const def = table[id];
  if (def === undefined) throw new Error(`Unknown ${tableName} id "${id}"`);
  return def;
}
