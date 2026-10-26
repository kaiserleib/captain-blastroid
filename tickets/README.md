# Tickets

Each ticket is a self-contained brief for one subagent. Tickets inside a wave can run **in parallel**. A wave starts when the waves it depends on are merged.

## Dependency waves

```
Wave 0  T00 scaffold + contracts ─────────────────────────────────────────────┐
                                                                             │
Wave 1  T01 input   T02 pixel-art kit   T03 sim core   T04 audio             │  (parallel)
        T05 save/meta/platform   T06 pilot portraits   T07 backgrounds       │
                                                                             │
Wave 2  T08 player   T09 weapons   T10 asteroids/obstacles   T11 enemies     │  (parallel)
        T12 pickups/powerups   T13 fx/juice   T14 HUD                        │
                                                                             │
Wave 3  T15 director + Level 1   T16 boss   T17 menus + meta flow            │  (parallel)
                                                                             │
Wave 4  T18 integration + balance   T19 mobile/PWA/Capacitor   T20 test bots │  (T18 first, then T19 ∥ T20)
```

| ID | Title | Depends on | Status |
|---|---|---|---|
| [T00](T00-scaffold-and-contracts.md) | Scaffold, loop, display, contracts | — | done |
| [T01](T01-input.md) | Input: keyboard, mouse-follow, floating stick | T00 | done |
| [T02](T02-pixel-art-kit.md) | Pixel-art kit: palette, sprites, font, gallery | T00 | done |
| [T03](T03-sim-core.md) | Sim core: pools, spatial hash, collision rules, forces, damage | T00 | done |
| [T04](T04-audio.md) | Audio: procedural SFX + chiptune sequencer | T00 | done |
| [T05](T05-save-meta-platform.md) | Save data, meta progression model, platform adapters | T00 | done |
| [T06](T06-pilot-portraits.md) | Sci-fi pilot portrait generator | T00 | done |
| [T07](T07-backgrounds.md) | Parallax space backgrounds | T00 | done |
| [T08](T08-player-ship.md) | Player ship: movement, shields, death, ship sprites | T01 T02 T03 | done |
| [T09](T09-weapons.md) | Weapons: 5 auto-fire weapons with levels | T02 T03 | done |
| [T10](T10-asteroids-obstacles.md) | Asteroids + indestructible anomaly framework | T02 T03 | done |
| [T11](T11-enemies.md) | Enemies: behaviors, smart avoidance, fire patterns | T02 T03 | done |
| [T12](T12-pickups-powerups.md) | Pickups, drops, magnet, repulsor | T02 T03 | done |
| [T13](T13-fx-juice.md) | Explosions, particles, shake, hitstop, haptics | T02 T03 | done |
| [T14](T14-hud.md) | In-game HUD | T02 | done |
| [T15](T15-director-level1.md) | Wave director + Level 1 script | T10 T11 T12 | done |
| [T16](T16-boss-rock-hauler.md) | Boss: Rock Hauler | T09 T10 T11 | done |
| [T17](T17-menus-meta-flow.md) | Title, hangar, pilot/ship select, results, pause, settings | T05 T06 T14 | done |
| [T18](T18-integration-balance.md) | End-to-end integration + balance pass | all of waves 1–3 | done |
| [T19](T19-mobile-pwa-capacitor.md) | PWA, device perf, Capacitor wrapper | T18 | todo |
| [T20](T20-test-bots-e2e.md) | Headless bot playthrough + Playwright smoke | T18 | todo |

Wave 2 tickets can start as soon as their listed dependencies merge, without waiting for the whole of Wave 1.

## Running a ticket with a subagent

Suggested prompt:

> You are implementing ticket `tickets/TNN-*.md` in /Users/kaiser/git/captain-blastroid. Read `CLAUDE.md`, the docs it lists, and the ticket. Stay inside the ticket's **Owns** paths, apart from the one-line registrations it allows. Code against the contracts in `docs/tech-stack.md`. When done, run build/test/lint, tick the acceptance checklist in the ticket, set `Status: done`, and summarize any contract changes or follow-ups.

Use `isolation: "worktree"` for parallel waves. This needs the directory to be a git repo with an initial commit. Merge each worktree after it finishes. Expected conflicts are limited to the system/draw registration lists in `src/scenes/GameScene.ts` and the content index. Both are append-only, so resolve them by keeping both sides.

## Ticket template

```
# TNN — Title
Status: todo | in-progress | done
Wave: N · Depends on: … · Blocks: …

## Goal
## Owns          (paths this ticket creates/edits; anything else is read-only except listed registrations)
## Read first
## Requirements
## Acceptance criteria   (checkboxes)
## Out of scope
## Contract changes      (fill in if any)
```
