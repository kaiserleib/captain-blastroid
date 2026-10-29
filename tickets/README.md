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
                                                                             │
──── Campaign (post-MVP, docs/design.md → "Campaign: Levels 2–5") ───────────┤
Wave 5  T21 level framework   T22 sector select   T23 hazards                │  (parallel; see WAVE5-NOTES)
        T24 ships/pilots/upgrades   T25 music+backgrounds   T26 drone fix    │
                                                                             │
Wave 6  T27 L2 Ion Shoals   T28 L3 Event Horizon   T29 L4 Pulsar Nursery     │  (parallel; see WAVE6-NOTES)
        T30 L5 The Armada                                                    │
                                                                             │
Wave 7  T31 campaign integration + bots + balance                            │
                                                                             │
──── Act II (docs/design.md → "Campaign: Act II, Sectors 6–10") ──────────────┤
Wave 8  T32 act II framework   T33 hazards II   T34 terrain                  │  (parallel; see WAVE8-NOTES,
        T35 weapons   T36 roster   T37 music+backgrounds                     │   after a contracts-first commit)
                                                                             │
Wave 9  T38 L6 Corona Drift   T39 L7 The Warrens   T40 L8 Wormhole Junction  │  (parallel; see WAVE9-NOTES,
        T41 L9 Chrono Rift   T42 L10 The Foundry                             │   written after wave 8 merges)
                                                                             │
Wave 10 T43 act II integration + bots + balance                              │
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
| [T19](T19-mobile-pwa-capacitor.md) | PWA, device perf, Capacitor wrapper | T18 | done |
| [T20](T20-test-bots-e2e.md) | Headless bot playthrough + Playwright smoke | T18 | done |
| [T21](T21-level-framework.md) | Level framework: registries, new timeline actions, scroll changes, sector stubs | T00–T20 | done |
| [T22](T22-sector-select-flow.md) | Sector select, campaign flow, per-sector records, e2e scene hook | T00–T20 | done |
| [T23](T23-hazards.md) | Hazards: tractor beams, black-hole variants, pulsar gaps | T00–T20 | done |
| [T24](T24-roster-ships-pilots.md) | 4 ships, 3 pilots, 2 upgrades, scalable select screens | T00–T20 | done |
| [T25](T25-music-backgrounds.md) | Sector music and backgrounds | T00–T20 | done |
| [T26](T26-drone-boss-stall.md) | Orbit Drones: fix the boss stall | T00–T20 | done |
| [T27](T27-ionShoals.md) | Level 2: Ion Shoals + The Shepherd | wave 5 | done |
| [T28](T28-eventHorizon.md) | Level 3: Event Horizon + Perihelion | wave 5 | done |
| [T29](T29-pulsarNursery.md) | Level 4: Pulsar Nursery + Magnetar | wave 5 | done |
| [T30](T30-armada.md) | Level 5: The Armada + Dreadnought Leviathan | wave 5 | done |
| [T31](T31-campaign-balance.md) | Campaign integration, bots, balance | T21–T30 | done |
| [T32](T32-act2-framework.md) | Act II framework: ten sectors, act paging, escape phase, HUD | T31 + contracts | done |
| [T33](T33-hazards-act2.md) | Hazards II: solar flares and shade, portals, time bubbles | T31 + contracts | done |
| [T34](T34-terrain.md) | Terrain: tile walls, gates, crush, turret sockets | T31 + contracts | done |
| [T35](T35-weapons-act2.md) | Weapons: Arc Coil, Ricochet, Flak, unlock pool, field tests | T31 + contracts | done |
| [T36](T36-roster-act2.md) | Act II roster: 5 ships, 5 pilots, passives, ship history | T31 + contracts | done |
| [T37](T37-music-backgrounds-act2.md) | Act II music and backgrounds | T31 | done |
| [T38](T38-corona.md) | Level 6: Corona Drift + Heliostat | wave 8 | done |
| [T39](T39-warrens.md) | Level 7: The Warrens + Wyrm | wave 8 | done |
| [T40](T40-junction.md) | Level 8: Wormhole Junction + Janus | wave 8 | done |
| [T41](T41-chrono.md) | Level 9: Chrono Rift + Echo | wave 8 | done |
| [T42](T42-foundry.md) | Level 10: The Foundry + The Architect + escape | wave 8 | done |
| [T43](T43-act2-balance.md) | Act II integration, bots, balance | T32–T42 | done |
| [T44](T44-gauntlet.md) | The Gauntlet: eight-boss endgame stage | T43 | done |

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
