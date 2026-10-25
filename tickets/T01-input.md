# T01 — Input: keyboard, mouse-follow, floating virtual stick
Status: todo
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
- [ ] Unit tests for the stick math, key normalization and mode switching.

## Out of scope
Player movement physics (T08) and menu widgets (T17). Only the events here.
