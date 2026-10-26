# Wave 5 briefing (T21–T26): campaign infrastructure

The MVP (T00–T20) is merged and live. Wave 5 builds everything that sectors 2–5 share. Wave 6 (T27–T30) then adds one sector per ticket, in parallel, and wave 7 (T31) integrates and balances. **Read `docs/design.md` → "Campaign: Levels 2–5" first.** It holds every number.

The user is away. Make sensible calls, record them in your ticket's Notes, and don't stop to ask.

## Working rules (unchanged from WAVE2/3)
- Run `npm ci`, not `npm install`.
- Stay inside your ticket's **Owns**. If you need a change elsewhere, describe it in Notes under "Shared changes needed" instead of making it.
- **Browser:**
  - Open your *own* Chrome tab and never touch other tabs.
  - Run your dev server on port **51NN**, where NN is your ticket number (T21 → 5121, …, T26 → 5126).
  - Use **`?mute`** on every URL. Music has blasted through the user's speakers before.
  - Stop your dev server and close your tab when done.
- **Done means:**
  - `npm run build && npm run test && npm run lint` pass. Also `npm run test:sim` if you touched sim, game or content.
  - Acceptance boxes you verified are ticked, and `Status:` is set.
  - Notes, Contract changes and Follow-ups are filled in.
  - Work is committed on your worktree branch with a message ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Final message:** keep it short. List what changed, contract changes, shared changes needed, and follow-ups. The main session reads your ticket file for the details.

## Already on main (contracts-first commit)
- **Save v2** (`src/meta/schema.ts`): `save.levels[levelId] = { clears, best }`, `save.selectedLevel`, `HighScore.level`. `bankRun` updates `levels`. Use these, and don't add parallel fields.
- **`LevelDef` additions** (`src/content/levels/types.ts`): `rockTheme`, `bossMusic?`, `enemyHpMul?`, `enemyShotSpeedMul?`, `guaranteeWeapon?`.
- **New timeline events:** `{ anomaly: AnomalyEvent }`, `{ scroll: { to, over } }`, `{ script, args? }`, and `escapePod.hp?`. The director only logs them until T21 implements them.
- **`AnomalyPlacement`** (`game/obstacles/anomalies/blackhole.ts`) gains `variant?: string` and `phase?: number`. T21 passes them through and T23 implements them.
- `.github/workflows/pages.yml` is already off Node 20, and save export/import is done (Part A of this round).

## Cross-ticket decisions
- **Level ids:** `kessler`, `ionShoals`, `eventHorizon`, `pulsarNursery`, `armada`. `LEVEL_ORDER` is in that order.
- **Sector folders** (wave 6 fills them; T21 creates the stubs):
  - `src/content/levels/<id>/index.ts` exports `LEVEL` (the `LevelDef`) and `ROSTER` (an enemy def table).
  - `src/game/levels/<id>/index.ts` does the registrations.
  - `src/game/levels/index.ts` imports all of them, and GameScene and the harness import `game/levels`.
- **Id prefixes avoid collisions between parallel sector tickets:** enemy, boss-part and sprite ids for a sector start with its short prefix: `ion_`, `hz_`, `pn_`, `ar_` (e.g. `ion_tug`, `hz_lancer_dash`). Level 1 keeps its unprefixed ids.
- **Music ids:** T25 adds `ion`, `horizon`, `pulsar`, `armada` and `armada_boss`. T21 sets the stubs' `music` and `bossMusic` to these real ids now, and makes sure `playSong` of an unknown id warns once and doesn't throw, so the stubs work before T25 merges.
- **Schematics:** the stubs' `schematicOnClear` use the design's lists (`['warden', 'dart', 'bulwark']`, `['corsair']`, `['halcyon']`, `['paragon']`). T21 makes `pickSchematic` skip ids missing from `SHIPS`, because T24 adds them in parallel. When a sector has no schematic left, the boss drops +50% `bossSalvage` (also T21, in `onBossDefeated`).
- **Pilot rescue levels:** T24 sets `sable` → `eventHorizon`, `pip` → `pulsarNursery`, `vale` → `armada`. `zzkar` is already `ionShoals`. Each stub has one `escapePod` event.
- **`src/meta/progression.ts`** is touched by T21 (`pickSchematic` lives in the director, not here, so ideally not at all), by T22 (`bankRun`, unlock helpers) and by T24 (`computePlayerStats`, upgrades). Keep edits inside your own functions. The merge resolves the rest.
- **`tests/sim/**`** belongs to T21. T26 adds only `tests/sim/drones.test.ts` and uses `createSimWorld(seed, opts)` with options that exist today. T21 keeps those working (`levelId` is optional and defaults to `kessler`).
- **`e2e/**`** belongs to T22.
- **`GameScene.ts`** is edited only by T21.
- **Sandbox keys:** T23 uses `T` (tow), `Shift+B` and `Shift+N` (cycle variants). T25 uses `V` and `Shift+V`. T26 needs none. Wave 6 gets keys in WAVE6-NOTES.
