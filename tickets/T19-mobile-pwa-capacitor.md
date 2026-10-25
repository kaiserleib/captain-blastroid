# T19 — Mobile: PWA, device performance, Capacitor wrapper
Status: todo
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
- [ ] PWA installs on iOS and Android and launches fullscreen portrait, working offline.
- [ ] Capacitor debug builds run on an iOS simulator and an Android emulator (and ideally a device) with haptics, persistence across app kills, and auto-pause on backgrounding.
- [ ] 60 fps (or documented numbers + mitigation plan) on the mid-range Android device.

## Out of scope
Store listings, signing for release, monetization.
