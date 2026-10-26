# T14 — In-game HUD
Status: done
Wave: 2 · Depends on: T02 · Blocks: T17, T18

## Goal
A compact SNES-style HUD that uses the HUD bands on tall phones and overlays the edges otherwise. It must stay readable at 1× on a phone and stay out of the thumb's way.

## Owns
`src/game/hud/**` (hud.ts, widgets.ts, icons.ts, index.ts, tests), HUD DrawLayer (z 100) registration, and the in-game pause button hit area.

## Read first
`docs/art-direction.md` → UI, Typography. `docs/tech-stack.md` → Display & resolution (HUD bands). `PlayerState`/`RunState` contracts.

## Requirements
1. **Top band / overlay:** shield as hex pips (filled/empty, a blink when one is lost, a glint when one is gained) top-left. Score (8×8 font) top-center, with the chain multiplier `×3` under it when ≥ 2. Salvage counter with a scrap icon top-right. Pause button (2-bar icon, 44 CSS px tap target) at the top-right corner inside the safe-area inset.
2. **Bottom band / overlay:** weapon slots (up to 5) as 12×12 icons with 5 level pips each. Empty slots shown as dim frames. Magnet and repulsor active timers as icons with shrinking bars.
3. **Boss bar:** when `bossSpawned`, show the boss name and an HP bar at the top of the playfield (sum of part HP), with a flash on damage.
4. **Warning banner:** a `WARNING` stripe that flashes for 2 s before the boss (triggered by the `bossWarning` event from T15).
5. **Layout:** if the HUD band is ≥ 20 px, draw there with a solid SNES-blue strip. Otherwise overlay with a 1 px shadow and keep the overlay ≤ 14 px tall at the top and ≤ 16 px at the bottom. Respect safe-area insets (converted to logical px) on notched phones.
6. HUD reads state only and never mutates the world. The pause button emits a `pauseRequested` UI event that GameScene handles.

## Acceptance criteria
- [x] Renders correctly at 240×400 (desktop), 240×520 (tall phone) and 240×440, verified by screenshots in the sandbox at each forced size (`?h=520`).
- [x] All values update live in the sandbox (grant weapons, take hits, collect salvage).
- [x] Unit tests for the layout math (band vs overlay, safe areas).

## Contract changes
- `src/engine/display.ts` (additive): `Layout.insets` (CSS px safe-area insets the layout was computed with); `computeLayout(..., forceLogicalH?)` 5th param; `Display` constructor takes an optional `forceLogicalH`.
- `src/debug/flags.ts` (additive): `flags.h` — dev-only `?h=440|520` pins the logical height for HUD screenshots.
- No changes to `sim/types.ts`, `sim/world.ts`, `engine/events.ts` or `gfx/renderer.ts`. The HUD emits the existing `pauseRequested` event.

## Notes
- API (`src/game/hud/index.ts`): `Hud` (`layer` z 100 named `hud`, `attach(world)`, `onPointer(e)` → true if consumed), `setHudViewport(layout)` (called from `main.ts` on every display resize), `computeHudLayout`, `createHudDemoSystem`/`hudDemoEnabled`.
- Shared edits: `GameScene` registers `hud.layer`, calls `hud.attach(w)` in `enter`, and gains `onPointer` forwarding to the HUD; it appends the demo system only under `?sandbox&hud`. `main.ts` passes `flags.h` to `Display` and forwards layouts to `setHudViewport`.
- Bands ≥ 20 px (after the safe area) get a solid SNES-blue fill with a white/gray edge; the HUD row hugs the playfield edge. Otherwise the top row overlays ≤ 14 px and the bottom ≤ 16 px. In band mode the chain `×N` sits under the score; in overlay mode beside it.
- Safe areas: `computeLayout` already letterboxes the buffer inside the safe area, so the logical insets are normally 0; `safeInsetsLogical` handles any overlap if that ever changes.
- Pause: the hit box is max(44 CSS px, icon) centred on the icon and clamped into the buffer; a `down` inside it calls `input.releaseStick()` and emits `pauseRequested`. GameScene doesn't act on `pauseRequested` yet (pause menu is T17); the `?sandbox&hud` demo logs it to the console.
- Weapon icons: draws `icon_<weaponId>` (12×12, centre anchor assumed) when `hasSprite` says it exists; otherwise a letter (B/S/L/M/D) in a 12×12 frame. Level pips (1–5) are a column right of each icon. Empty slots up to `maxWeaponSlots` (≤ 5) are dim frames.
- Boss bar: after `bossSpawned`, sums `hp`/`maxHp` of active `isBoss` enemies (the max is the peak, so destroyed parts don't shrink the bar); flashes white on damage; hides when no parts remain (1 s grace if the event precedes the spawn) or on `bossDefeated`. The name is derived from the defId (`scrap_baron` → `SCRAP BARON`) until boss content supplies one.
- Magnet/repulsor bars shrink from the peak timer value observed, so no duration import is needed.
- Demo: `?sandbox&hud` (optionally `&h=440|520`) loops a 26 s script: weapons granted and leveled, hits and shield regain, salvage/score/chain, magnet/repulsor timers, `bossWarning`, a 3-part boss taking damage. The gallery has a HUD section showing the same script at 400/440/520.

