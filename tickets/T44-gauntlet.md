# T44 — The Gauntlet: a multi-boss endgame stage
Status: done
Wave: — (post-campaign) · Depends on: T43 · Blocks: —

## Goal
Give a fully built hangar a place to fill all six slots at L5 and fight with it: an eleventh stage of escalating rounds, each ending in a campaign boss, chained in one run.

## Owns
`src/content/levels/gauntlet/`, `src/game/levels/gauntlet/`, `tests/sim/gauntlet.sector.test.ts`, plus the small framework additions listed under "Contract changes".

## Acceptance criteria
- [x] Sector 11 THE GAUNTLET on its own Sector Select page, unlocked by the first Foundry clear. Foundry still shows CAMPAIGN COMPLETE, and the Gauntlet shows GAUNTLET COMPLETE.
- [x] Eight rounds: waves, then a boss; the timeline resumes after each boss, and only the last wins the run.
- [x] The Wyrm round brings in Warrens terrain (mouth, tunnel, den). The den stops the scroll for the fight, and the next round restarts the scroll and fades the walls.
- [x] Each round escalates enemy HP, shot speed and boss toughness, and plays its boss's home music.
- [x] Typical bots fill the six-slot L5 arsenal with rounds to spare (sim test asserts ≥ 2 min before the finale).
- [x] build / test / test:sim / lint pass.

## Contract changes (additive)
- `GameEvents.songRequested: { id }`. Audio plays the song.
- `LevelDef.hostLevels?`: other sectors whose level systems and layers also run (`stageSystems` / `stageLayers` in the director registry).
- Timeline `boss` event: `continue?` and `salvage?`.
- `ActDef.extra?`, `campaignFinale()`, `actFinishedBy()`, `bossHomeLevel()` in content/levels.
- `setBossToughness(w, mul)` in game/boss.
- `attachAudio({ bossSongs })`: per-boss songs.

## Notes
- **Boss queue fix:** a `bossRequested` that arrives while the last boss is still in its death throes now waits instead of being dropped (it was dropped silently before, which would have hung a chained fight).
- **The `@clear` terrain drops unspawned rows**, so the wall fade is queued at the next round's start, not with the den.
- `?t=` now skips past `continue` bosses, so `?level=11&t=170` lands in the Wyrm round.
- `?save=all` now unlocks all eight weapons.

## For a human
- Hand-playtest the whole run (about 11 minutes). Is it too long on a phone? Does full power feel good by round 5?
- Do the round toasts ("ROUND 3 OF 8" / "FINAL ROUND") need a boss name?
