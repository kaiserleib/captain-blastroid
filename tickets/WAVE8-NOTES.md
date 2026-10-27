# Wave 8 briefing (T32–T37): Act II infrastructure

Act I (T21–T31) is merged and live. Wave 8 builds everything the five Act II sectors share. Wave 9 (T38–T42) then adds one sector per ticket in parallel, and wave 10 (T43) integrates and balances. **Read `docs/design.md` → "Campaign: Act II" first.** It holds every number.

The user is away. Make sensible calls, record them in your ticket's Notes, and don't stop to ask.

## Working rules (unchanged from WAVE5/6)
- Run `npm ci`. **Merge main into your worktree branch first** if `git log --oneline -1 main` isn't in your history.
- Stay inside your ticket's **Owns**. If you need a change elsewhere, describe it under "Shared changes needed" in Notes with a minimal patch.
- **Browser:**
  - Use your own Chrome tab, and never touch other tabs.
  - Dev server on port **51NN** (T32 → 5132, …, T37 → 5137).
  - **`?mute`** on every URL.
  - Stop the server and close the tab when done.
- **e2e:** `E2E_PORT=51NN+50` (T32 → 5182).
- **Done means:**
  - `npm run build && npm run test && npm run lint` pass, plus `test:sim` if you touched sim, game or content, plus `e2e` for T32.
  - Boxes ticked, `Status:` set, and Notes, Contract changes and Follow-ups filled in.
  - Committed on your branch with a message ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Act I must not move:** the baseline hashes below must stay identical with default saves. Every hook added this wave has a no-op default.
- **Final message:** keep it short. List what changed, contract changes, shared changes needed, follow-ups and your branch name.

## Contracts-first commit (landed on main)
- **Save v3** (`src/meta/schema.ts`): `weaponsUnlocked: WeaponId[]`, defaulting to the five Act I weapons, with a migration from v2.
- **`WeaponId`** gains `'arc' | 'ricochet' | 'flak'`. `WEAPONS` gets placeholder defs (T35 replaces them) so exhaustive maps compile.
- **`RunResult.unlockedWeapon?: WeaponId`.**
- **`LevelDef` additions:** `fieldTestWeapon?: WeaponId`, `escape?: { dur, scrollTo, over, script?, bonus, bonusPerHit }`.
- **Timeline events:** `{ flare: { warn?, burn?, practice? } }`, `{ flares: { every, warn?, burn?, until } }`, `{ shadeSlab: { x, vx? } }`, `{ terrain: { chunk, theme } }`, `{ portal: { a: [x, y], b: [x, y], color, drift? } }`, `{ bubble: { kind, x, y?, r, ttl?, vx?, vy? } }`.
  - The director routes them through **`registerTimelineAction(kind, fn)`**. An unregistered kind warns once and is skipped.
  - T32 implements the registry. T33 and T34 register their kinds.
- **`src/sim/hooks.ts` (additive, no-op defaults, reset by `clearHooks`):**
  - `registerSolidQuery({ isSolidAt, raycastSolid })`: the defaults are false and no hit. T34 registers terrain, T35's Ricochet reads it, and T33's slabs can join through a composed query (T34 owns the composition. Expose `addSolidSource(fn)` if both need it).
  - `registerTimeScale(fn)`: the default is 1. T33 registers bubbles.
- **`World`:** `enemyBulletTimeScale = 1` (T36 writes it for bullet time; T33's integrator multiplies it in).
- **`?save=act1`** is implemented in `src/ui/debugSaves.ts` with explicit Act I lists. Its `selectedLevel` falls back to kessler until T32 adds `corona` to `LEVEL_ORDER`.

As landed:
- `REGISTERED_ACTION_KINDS` and the payload types (`FlareEvent`, `FlaresEvent`, `ShadeSlabEvent`, `TerrainEvent`, `PortalEvent`, `BubbleEvent`, `EscapeDef`) are in `content/levels/types.ts`.
- `registerTimelineAction` / `getTimelineAction`, `registerSolidQuery` / `isSolidAt` / `raycastSolid` (`RayHit`, `SolidQuery`) and `registerTimeScale` / `timeScaleAt` are in `sim/hooks.ts`.
- **The registry already works.** `fireEvent` routes the six kinds to the handler with the event's payload object, or logs `<kind> (unregistered)` and warns once. So T32 doesn't need to build it. T32 only adds new kinds if it needs them.
- Placeholder weapons: `WEAPONS.arc/ricochet/flak` fire nothing (`noFire` in `weaponSystem.ts`) and aren't in `WEAPON_ORDER`, so no Act I list, drop or sandbox key sees them. `DEFAULT_UNLOCKED_WEAPONS` = `WEAPON_ORDER`.

## Act I baseline hashes
At `main` after the contracts commit. Every wave-8 ticket must reproduce these with default saves. Paste this into a throwaway `tests/sim/*.test.ts` and run it with `SIM=1 npx vitest run <file> --silent=false`:
```ts
runSim('hash-god', godBot(), 300).hash                         // 17a78586
runSim('hash-dodger', dodgerBot(), 200).hash                   // 66a3e907
runSim('hash-' + id, dodgerBot(), 120, { levelId: id }).hash   // kessler 432d4c06, ionShoals 1c9e54f6,
                                                               // eventHorizon f3426d8c, pulsarNursery 0b41ee42, armada 8b2a6879
```

## Cross-ticket decisions
- **Level ids and prefixes** (ids for enemies, boss parts, sprites and scripts):

  | Sector | Level id | Prefix | Boss id |
  |---|---|---|---|
  | 6 | `corona` | `co_` | `co_heliostat` |
  | 7 | `warrens` | `wr_` | `wr_wyrm` |
  | 8 | `junction` | `wj_` | `wj_janus` |
  | 9 | `chrono` | `cr_` | `cr_echo` |
  | 10 | `foundry` | `fd_` | `fd_architect` |

- **Music ids** (T37): levels `corona`, `warrens`, `junction`, `rift` (the chrono sector's song) and `foundry`; bosses `boss2` and `foundry_boss`; and `escape`. T32's stubs use these ids now. Unknown ids already warn once without throwing.
- **Pilot rescue levels** (T36): ines → corona, rook → warrens, nyx → junction, halasz → chrono, wren → foundry. The pilot ids are `ines`, `rook`, `nyx`, `halasz` and `wren`.
- **Schematics** (T32's stubs): corona `['shrike']`, warrens `['ferret']`, junction `['wraith']`, chrono `['revenant']`, foundry `['nova']`. T36 adds those ships in parallel. `pickSchematic` already skips missing ids.
- **Field-test weapons** (T32's stubs): corona `arc`, warrens `ricochet`, junction `flak`.
- **`tests/sim/bots.ts`:** T33 and T34 both append cost terms. Keep your terms in clearly separate functions, and expect a merge where both sides are kept.
- **Player module:** T36 owns `game/player/**`. T32's only edit there is the ≤ 5-line last-shield guard in damage.
- **HUD:** only T32 edits `game/hud/**` (the six-slot strip and the escape countdown).
- **Scenes:** T32 owns SectorSelect, Results and flow. T36 owns ShipSelect, PilotSelect and rosterStrip.
- **Sandbox keys, wave 8:** T33 `F`, `Shift+F`, `[`, `Shift+[`, `]`, `Shift+]`. T34 `\`, `Shift+\`. T35 extends the weapon-grant table, or else `;` `'` `/`. Every letter is now taken.
- **Sandbox keys, wave 9 (pre-assigned):** Act II sectors use **Alt+** the key their Act I counterpart used. Match on `KeyboardEvent.code`, because on macOS Alt changes `e.key`.

  | Sector | Enemy keys | Boss key |
  |---|---|---|
  | corona | Alt+`Q` `E` `Y` | Alt+Shift+`Q` |
  | warrens | Alt+`U` `I` `O` | Alt+Shift+`U` |
  | junction | Alt+`H` `J` `L` | Alt+Shift+`H` |
  | chrono | Alt+`Z` `C` `M` | Alt+Shift+`Z` |
  | foundry | Alt+`R` `G` `K` | Alt+Shift+`R` |

## After wave 8 merges
The main session writes `WAVE9-NOTES.md`: the merged APIs (copied from each ticket's Notes), anything that changed from this plan, and the sector agents' working rules. Wave 9 tickets read it instead of this file.
