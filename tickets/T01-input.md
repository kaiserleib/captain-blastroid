# T01 — Input: keyboard, mouse-follow, floating virtual stick
Status: done (phone/trackpad checks pending; ship motion needs T08)
Wave: 1 · Depends on: T00 · Blocks: T08, T17

## Goal
A single `InputManager` that turns keyboard, mouse/trackpad and touch into one `MoveIntent` per tick, plus UI pointer events for menus. Mobile feel is the priority. The floating stick should feel like Vampire Survivors.

## Owns
`src/input/**` (keyboard.ts, pointer.ts, stick.ts, input.ts, index.ts, tests). The one-line registration that writes `world.input` at the start of `GameScene` update.

## Read first
`docs/design.md` → Controls. `docs/tech-stack.md` → Mobile-port requirements.

## Requirements
1. **Pointer Events only** on the display canvas. Use `setPointerCapture` for touch. Ignore secondary touches while the stick is active, but track them for UI taps.
2. **Modes,** chosen automatically from the most recent input:
   - `keys`: arrows/WASD give a unit vector (diagonals normalized). `targetX/Y = null`.
   - `mouse`: `pointerType === 'mouse'` and the pointer is over the canvas. `targetX/Y` are logical playfield coords (via `display.screenToLogical` minus `playfieldOffsetY`). The player system steers toward the target. With a mouse, movement doesn't need a held button. Clicks are reserved for UI.
   - `touch`: floating stick. Touch-down spawns the base at the touch point. Offset/radius (radius 40 CSS px, converted to logical) is clamped to length 1, with a 6 CSS px deadzone. When the finger exceeds the radius, the base is dragged along so the knob stays on the rim. Release sets the intent to zero and hides the stick.
3. Keyboard: `Esc`/`P` = pause edge-triggered event. Also handle `Enter`/`Space` = confirm and arrows = UI navigation for menus.
4. Expose `input.stick` state (`active, baseX, baseY, knobX, knobY` in logical coords) and a `drawStick(r)` that draws a translucent ring (r≈20 logical) and knob, SNES-styled in 1 px pixel rings (not `arc` anti-aliasing). Draw it from a DrawLayer at z 95.
5. `onBlur`/`visibilitychange` clears all held keys and stick state, so there are no stuck keys.
6. The pure math (stick vector, deadzone, base drag, key vector) lives in testable functions.
7. Settings hook: `stickRadiusScale` and `stickOpacity` are read from settings (T05 provides them; default 1.0 / 0.5 until then).

## Acceptance criteria
- [ ] On a phone, thumb anywhere moves the ship smoothly in proportion to deflection. Dragging past the rim tows the base. Lifting stops.
- [ ] On desktop, mouse movement makes the ship chase the cursor. Pressing a key switches to key mode until the mouse moves again.
- [ ] Trackpad works the same as mouse.
- [ ] No page scroll, zoom or text selection while playing on iOS Safari and Android Chrome.
- [x] Unit tests for the stick math, key normalization and mode switching.

## Out of scope
Player movement physics (T08) and menu widgets (T17). Only the events here.

## Contract changes
None to the core contracts. New public surface in `src/input/index.ts`:
- `input` singleton (`InputManager`): `mode`, `stick` (`StickState`: `active, pointerId, baseX/Y, knobX/Y, x, y`), `system` (name `input`, first in GameScene order), `stickLayer` (z 95), `onPointer` (every pointer as a `ScenePointer` in logical buffer coords; the object is reused), `onUi` (`UiEvent`: `pause` | `confirm` | `nav {dx, dy}`; nav repeats while held, WASD doesn't navigate), `releaseStick()`, `clear()`, `endTick()`, `writeIntent(out)`.
- `attachInput(display)` binds the DOM once (called in main.ts).
- `getInputSettings()` / `setInputSettingsProvider(fn)` / `DEFAULT_INPUT_SETTINGS` (`stickOpacity 0.5`, `stickRadiusScale 1.0`). T05/T17 swap the provider.

## Notes
- Stick and mouse target are in **playfield** coords (logical buffer y minus `playfieldOffsetY`), so the renderer and the player system use them directly. The mouse target is clamped to the 240x400 playfield.
- MoveIntent semantics: `keys` → unit-length `x/y`, no target. `mouse` → `x = y = 0` and `targetX/Y` set (both null and zero intent once the mouse leaves the canvas). `touch` → `x/y` with length 0..1, no target. T08 steers toward the target when it's non-null.
- Deflection rescales out the deadzone: `(len - dz) / (radius - dz)`, so it ramps from 0 at the deadzone edge to 1 at the rim. Radius = 40 CSS px x `stickRadiusScale`, converted with `dpr * logicalW / destW`; deadzone 6 CSS px.
- Esc/P sets a pending pause that the input system turns into `pauseRequested` on the next GameScene tick. main.ts calls `input.endTick()` after each sim step so a press made while a menu is on top is dropped instead of re-pausing the game on resume.
- A zero-distance `pointermove` doesn't switch back to mouse mode (browsers fire these on layout changes), so keys keep control until the mouse really moves.
- `gesturestart` is prevented for older iOS Safari pinch-zoom; `pointerdown` from touch is `preventDefault`ed. Keys with Ctrl/Cmd/Alt pass through to the browser.
- GameScene's placeholder ship now draws when no layer is named `player` (it used to need zero layers, and the stick layer would have hidden it).
- `?debug` adds an `IN <mode> x y T target` line, an `ST` base/knob line while the stick is held, and a crosshair at the mouse target.
- Verified in desktop Chrome with `?debug`: real mouse hover gives a mouse-mode target that matches the cursor; a key press switches to keys and gives normalized diagonals (W+Left → -0.71, -0.71); synthetic touch PointerEvents spawn, deflect and tow the stick (pixel rings drawn), and release hides it; window blur clears held keys.
- Unverified: phones (thumb feel, no scroll/zoom/selection on iOS Safari and Android Chrome), a physical trackpad (it reports `pointerType: 'mouse'`, so it takes the same path), and the ship actually chasing the cursor (needs T08).

## Follow-ups
- T08: read `world.input`; when `targetX` isn't null, fly toward it at max speed and ease in over the last ~8 px; otherwise use `x/y` x speed.
- T17: route `input.onUi` to menus (Esc can double as back) and listen for `pauseRequested`. When a UI widget (e.g. the pause button) claims a touch in GameScene, call `input.releaseStick()` so that tap doesn't also move the ship. Point `setInputSettingsProvider` at T05's settings.
