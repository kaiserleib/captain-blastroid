# T19 — Mobile: PWA, device performance, Capacitor wrapper
Status: done (code + iOS simulator); real-device QA and the Android build need the user's machine
Wave: 4 · Depends on: T18 · Blocks: —

## Goal
Make the browser build feel native on phones now (PWA), and prove the store-app path with a Capacitor 8 project that runs the same `dist/` on iOS and Android.

## Owns
`public/manifest.webmanifest`, app icons (generated *in code* at build time by a script that renders the Kestrel sprite to PNG, so there's still no hand-made art), `src/sw.ts` or `vite-plugin-pwa` config, `src/platform/capacitor/**`, `capacitor.config.ts`, `ios/`, `android/`, `docs/mobile.md`.

## Read first
`docs/tech-stack.md` → Mobile-port requirements, Decision summary. [Capacitor 8 announcement](https://ionic.io/blog/announcing-capacitor-8) and [upgrade guide](https://capacitorjs.com/docs/updating/8-0) (Node 22+, SPM default on iOS, SystemBars plugin on Android).

## Requirements
1. **PWA:** manifest (portrait, fullscreen/standalone, theme color), offline caching of the built assets, an "Add to Home Screen" friendly icon set, `apple-mobile-web-app-status-bar-style` black-translucent with safe-area handling verified.
2. **Device QA** on at least iOS Safari (recent iPhone) and Android Chrome (mid-range). Check: no zoom/scroll/selection, no 300 ms delays, stick precision near screen edges and the notch, edge-swipe back gesture conflicts (Android: consider a small inset where the stick base can't spawn), audio unlock, auto-pause on app switch, battery/thermal over a 10-minute session.
3. **Performance:** profile Level 1's boss and asteroid-storm segments on the Android device. If frame time is > 16 ms, try (in order) sprite batching tweaks, a reduced particle budget (setting), then prototype a PixiJS `Renderer` behind the interface. Record the results in `docs/mobile.md`.
4. **Capacitor:** `npx cap init`, add iOS (SPM) + Android, `webDir: dist`. Implement `src/platform/capacitor/*` with `@capacitor/preferences` (storage), `@capacitor/haptics`, `@capacitor/app` (pause/resume → auto-pause + save), `@capacitor/screen-orientation` (portrait lock), status bar/SystemBars (hidden). The platform selection at boot uses `Capacitor.isNativePlatform()`. Migrate localStorage save data to Preferences on first native launch.
5. `docs/mobile.md`: how to run on a device (LAN dev server, PWA install, `npx cap run ios|android`), known issues, perf numbers.

## Acceptance criteria
- [ ] PWA installs on iOS and Android and launches fullscreen portrait, working offline. *(Manifest, icons, iOS meta and an offline SW are done. Offline launch was verified in desktop Chrome. Installing on real phones is not yet verified.)*
- [ ] Capacitor debug builds run on an iOS simulator and an Android emulator (and ideally a device) with haptics, persistence across app kills, and auto-pause on backgrounding. *(iOS simulator: builds, runs, persists across kills, and App.pause flushes the save. Android: the project exists but there is no SDK/JDK 21 here; see docs/mobile.md. Haptics are untested because the simulator has no Taptic engine.)*
- [x] 60 fps (or documented numbers + mitigation plan) on the mid-range Android device. *(Documented desktop numbers, a 6× extrapolation and a mitigation plan in docs/mobile.md. On-device numbers still to record.)*

## Out of scope
Store listings, signing for release, monetization.

## Contract changes
None. `Platform`/`StorageAdapter` are unchanged; `setPlatform()` is called by `selectPlatform()` before anything subscribes.

## Notes
- **Platform selection.** `main.ts` does `await selectPlatform()` (top-level await) *before* registering `platform.lifecycle.onPause(pauseRun)` and before `BootScene` runs `initSave`, so T17's pause hook and T05's save flush bind to Capacitor's `App.pause` natively. No re-registration is needed. Natively, `main.ts` also pauses the loop on `App.pause` and re-syncs it on `App.resume`. Detection reads the injected `window.Capacitor.isNativePlatform()` instead of importing `@capacitor/core`, so the web entry chunk stays Capacitor-free: main went from 69.3 to 70.3 kB, and the Capacitor code is a lazy ~15 kB chunk set.
- **Capacitor 8.5.3.** Plugins: app, haptics, preferences, screen-orientation. `SystemBars` is part of `@capacitor/core` 8, so `@capacitor/status-bar` is not installed. iOS uses SPM (no CocoaPods). Both native projects are portrait-only in their manifests; iOS also sets `UIRequiresFullScreen` and `UIStatusBarHidden`.
- **Migration.** On the first native launch, every `captain-blastroid.*` localStorage key is copied into Preferences once. Existing Preferences values win and localStorage is left as a backup. The marker key is `captain-blastroid.migratedFromLocalStorage`.
- **Android Back** is mapped to a synthetic Esc keydown/keyup (it pauses in a run and goes back in menus).
- **PWA.** I hand-wrote a service worker (`tools/pwa/sw.js`) and a small Vite plugin (`tools/pwa/plugin.ts`) instead of vite-plugin-pwa.
  - The SW is cache-first over the main entry's static chunk graph plus the icons and manifest, versioned by a hash of the file list and the worker source.
  - It uses `ignoreVary`, because `Vary: Origin` broke module-script cache hits offline. I found that in testing.
  - `base: './'` makes `dist/` path-independent.
  - The Owns line listed `src/sw.ts`. The worker lives in `tools/pwa/sw.js` because it is a build template, not app code.
- **Icons.** `tools/pwa/icons.ts` renders the Kestrel (with the renderer's 1 px outline) on a banded space backdrop with hashed stars, upscaled nearest-neighbor. The plugin loads it through `runnerImport` so `vite.config.ts` stays loadable by Vite's future native config loader. That needed `allowImportingTsExtensions` in tsconfig, for `./tools/pwa/plugin.ts`.
- **Native icons.** `CAP_ASSETS=1 npm run build` regenerates every native launcher icon and splash (30 PNGs) from the same renderer at their existing sizes, and has already been run. This replaces Capacitor's template art.
- **Stick edge inset (input, T01's area).** I clamped the stick base 16 CSS px from the side edges (`STICK_EDGE_INSET_CSS`). Edge touches can still steer outward, and the stick stays out of Android's back-swipe zone. Two tests were added/adjusted in `input.test.ts`.
- **Shared-file edits:**
  - `main.ts`: platform selection and SW registration.
  - `index.html`: manifest, icon and apple-touch-icon links.
  - `vite.config.ts`: `base`, plugin.
  - `tsconfig.json`: `allowImportingTsExtensions`.
  - `eslint.config.js` and `.prettierignore`: ignore `ios/` and `android/`; node globals for `tools/pwa`.
  - `package.json`: 7 Capacitor deps plus `@capacitor/cli` as a dev dependency.
- **Toolchains here:** Xcode 27.1 with simulators (the iOS build succeeded); no Android SDK; JDK 17 only, while Capacitor 8 needs 21. I did not install system software. The Android steps are in `docs/mobile.md`.
- **Perf** (desktop Chrome, `?debug`): storm render 0.70/2.4 ms (avg/max) and update 0.09/1.4 ms; boss 0.82/2.8 and 0.08/0.6; 300 bullets + 40 enemies + explosions 1.06/2.1 and 0.10/0.7. No CPU throttle was available; at an estimated 6× that is about 5–7 ms per frame on a mid-range phone. PixiJS was not prototyped.

## Follow-ups
- User: run the Android build and real-device QA (checklist in `docs/mobile.md`), and record on-device `?debug` numbers.
- Pick the real bundle id before signing.
- Android Back on Title could `App.exitApp()`.
- iOS web audio honours the silent switch. Consider `navigator.audioSession.type = 'playback'`.
- If edge-swipe conflicts show up on Android, add `setSystemGestureExclusionRects` in `MainActivity`.
- `@types/node` is only a transitive dependency (via `@capacitor/cli`). T20/Playwright may add it explicitly.
- `tickets/README.md` index not updated (left for the merge to avoid conflicts with T20).
