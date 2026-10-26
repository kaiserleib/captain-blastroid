# Mobile: PWA, devices, Capacitor

The same `dist/` runs in three places: a browser tab, an installed PWA, and the Capacitor shell for iOS and Android. Platform services (storage, haptics, lifecycle, orientation) sit behind `src/platform/platform.ts`.

- **Web/PWA:** `createWebPlatform()` uses localStorage, `navigator.vibrate`, `visibilitychange`/`pagehide`, and the Screen Orientation API.
- **Native:** `createCapacitorPlatform()` in `src/platform/capacitor/` uses Preferences, Haptics, `App.pause`/`resume`, ScreenOrientation and SystemBars.
- **Selection:** `main.ts` awaits `selectPlatform()` (`src/platform/select.ts`) before anything subscribes to the platform. It checks `window.Capacitor?.isNativePlatform()`, which the native shell injects before any page script runs, and only then `import()`s the Capacitor code. The web entry chunk never contains Capacitor; it lives in a ~15 kB lazy chunk set (`capacitor-*.js`, `dist-*.js`, `web-*.js`) that is not precached.

## Testing on a phone over the LAN (fastest loop)

```sh
npm run dev            # vite --host: prints a http://192.168.x.y:5173 "Network" URL
```

1. Open the Network URL on the phone (same Wi-Fi). All dev flags work: `?mute`, `?debug` (FPS/tick/render overlay), `?god`, `?t=150` (start at the storm), `?sandbox`.
2. Debugging:
   - **iOS:** Settings → Safari → Advanced → Web Inspector, then on the Mac use Safari → Develop → *your iPhone*.
   - **Android:** enable USB debugging and open `chrome://inspect` on the desktop. This also gives you DevTools' Performance panel *on the real device*.
3. The dev server has no service worker (on purpose: HMR). To test the PWA, use a production build:

```sh
npm run build && npm run preview   # vite preview --host, port 4173
```

**Gotcha:** service workers and "Add to Home Screen" need a secure context. `localhost` counts; `http://192.168.x.y` does **not**. For a real install test on a phone, use one of:
- an HTTPS tunnel (`npx cloudflared tunnel --url http://localhost:4173` or `npx localtunnel --port 4173`), or
- any static host (`dist/` is fully relative, `base: './'`, so it works from a sub-path such as GitHub Pages).
- **Android only:** USB port-forwarding in `chrome://inspect` → Port forwarding `4173 → localhost:4173`, then open `http://localhost:4173` on the phone.

## PWA

- **Manifest:** `public/manifest.webmanifest`. Display is `fullscreen` (falling back to `standalone`), orientation `portrait`, and the background and theme colors are black.
- **iOS meta** in `index.html`:
  - `apple-mobile-web-app-capable` and `apple-mobile-web-app-status-bar-style=black-translucent`
  - `apple-touch-icon` (180 px, opaque)
  - `viewport-fit=cover` with zoom disabled
  - The game sits inside `env(safe-area-inset-*)` (`engine/display.ts` measures them with a probe element and letterboxes inside them).
- **Icons are rendered from the Kestrel sprite in code** (`tools/pwa/icons.ts`, the PNG encoder in `tools/pwa/png.ts`). No image files are committed for the web.
  - Web set: 192 and 512 "any", 512 maskable (ship inside the 80% safe zone), the 180 apple-touch-icon and a 32 px favicon.
  - The dev server serves them from memory, and the build emits them.
- **Service worker:** hand-written, about 50 lines (`tools/pwa/sw.js`). I picked it over vite-plugin-pwa/Workbox: one cache-first worker didn't justify the dependency. The build plugin (`tools/pwa/plugin.ts`) prepends the precache list.
  - **Precache list:** the `main` entry chunk, its static imports and CSS, `index.html`, the manifest and the icons, about 300 kB in total. The dev tool pages and the lazy Capacitor chunks are left out.
  - **Versioning:** the cache name is a hash of the file list plus the worker source. A new deploy installs a new worker, which calls `skipWaiting` and `clients.claim`, then deletes the old caches. The *next* launch runs the new version.
  - **Navigations** with any query string (`?seed=…`) are served from the cached `index.html`.
  - Lookups use `ignoreVary`. Module scripts are CORS requests carrying an `Origin` header, so a server that sends `Vary: Origin` (vite preview does) would otherwise never match and the game would boot to a black screen offline.
  - Registration is skipped in dev and inside the native shell (`registerServiceWorker()` in `select.ts`).

### Save durability on the web
The browser build keeps the save in `localStorage` (`captain-blastroid.save`, JSON, versioned by `SAVE_VERSION` with migrations in `src/meta/schema.ts`). It survives reloads, new tabs and new deploys. Things that can still lose it:
- **Safari / iOS (ITP):** script-writable storage, `localStorage` included, is deleted after **7 days of Safari use without a visit** to the site. **Home-screen installs are exempt:** a web app added to the Home Screen has its own storage that the 7-day cap doesn't touch. Tell iPhone players to install it.
- **Eviction under storage pressure** (all browsers). At boot the web build calls `navigator.storage.persist()` (`src/platform/web/persist.ts`, guarded, failures ignored). Chrome grants it silently to engaged or installed sites, Firefox may ask, and Safari mostly ignores it.
- **Clearing site data / private windows.** Private windows fall back to an in-memory save for the session.

The escape hatch is **Settings → Export / Import save** (Hangar only, not the pause menu). Export shows a `CB1.<base64url JSON>.<FNV-1a checksum>` code and copies it to the clipboard. Import validates the checksum, runs the code through the normal schema migration, shows a before/after summary, and keeps a copy of the replaced save under `captain-blastroid.save.beforeImport`. Settings (volume, stick, haptics) are per-device and are not part of the code. There are no accounts and no servers.

### Install
- **iOS Safari:** Share → Add to Home Screen. It launches without browser chrome. The status bar is translucent over the HUD band, which sits inside the safe area.
- **Android Chrome:** ⋮ → Install app (or the install prompt). It launches fullscreen in portrait.

## Capacitor (iOS + Android)

`capacitor.config.ts`:
- `appId: com.captainblastroid.game` is a **placeholder**; pick the real bundle id before any store submission.
- `webDir: dist`
- SystemBars `hidden: true`, `insetsHandling: 'css'`
- iOS `contentInset: 'never'`

The native projects (`ios/`, `android/`) are committed. Both are portrait-only:
- **iOS:** `UISupportedInterfaceOrientations`, plus `UIRequiresFullScreen` and `UIStatusBarHidden` in `Info.plist`.
- **Android:** `android:screenOrientation="portrait"`.

iOS uses Swift Package Manager (Capacitor 8 default; no CocoaPods needed).

### Everyday workflow
```sh
npm run build && npx cap sync          # copy dist/ + plugin config into both projects
npx cap run ios                         # pick a simulator/device
npx cap run android                     # pick an emulator/device
npx cap open ios | android              # open Xcode / Android Studio
```

The app icons and splash screens in the native projects are also generated from the Kestrel. After `npx cap add` (or to refresh them), run:
```sh
CAP_ASSETS=1 npm run build              # re-renders every launcher icon + splash PNG in place
```
It rewrites the PNGs `cap add` created at their existing sizes:
- iOS: the 1024 AppIcon and the splash imageset.
- Android: mipmap `ic_launcher`, `_round` and `_foreground` (adaptive, on `#081830`), plus `drawable*/splash.png`.

The output is deterministic, so re-running it doesn't churn git.

### Native platform behaviour (`src/platform/capacitor/`)
| Service | Implementation |
|---|---|
| Storage | `@capacitor/preferences` (UserDefaults / SharedPreferences), because iOS can evict WKWebView localStorage. On first native launch, every `captain-blastroid.*` localStorage key is copied in once. Values already in Preferences win, localStorage is left intact, and the marker key `captain-blastroid.migratedFromLocalStorage` records that it ran. |
| Haptics | `@capacitor/haptics` `impact({style: LIGHT/MEDIUM/HEAVY})`, rejections swallowed. Callers still check `settings.haptics`. |
| Lifecycle | `App` `pause`/`resume`. `pause` opens the pause menu in a run (`main.ts` → `GameScene.pauseNow`), pauses the loop, and flushes the save (`saveNow` via `initSave`'s lifecycle binding). `resume` resumes the loop without catch-up, and the pause menu stays up. |
| Orientation | `@capacitor/screen-orientation` `lock({orientation:'portrait'})`, with the native manifests as the real guarantee. |
| System bars | `SystemBars` (core in Capacitor 8) hidden at launch by config and again on every resume. `@capacitor/status-bar` is not needed. |
| Android back | `App` `backButton` is mapped to a synthetic Esc: it pauses in a run and goes back in menus, instead of closing the app. |

### Toolchain status on the dev Mac (checked 2026-10-25)
| | Present | Result |
|---|---|---|
| Xcode | 27.1, iOS 27 simulators | **Builds and runs.** The command was `xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17' -derivedDataPath ios/DerivedData build`. It installed and launched on the iPhone 17 simulator with fullscreen portrait title art, the status bar hidden, and no letterbox under the Dynamic Island. |
| Android SDK | **missing** (no `ANDROID_HOME`, no platform-tools; Homebrew `sdkmanager` exists but no SDK is installed) | `npx cap add android` worked; it doesn't need the SDK. Building needs the steps below. |
| JDK | 17 (Homebrew) | Capacitor 8 / AGP 8.13 need **JDK 21**. |

**Verified on the iOS simulator** (Capacitor console via `xcrun simctl launch --console-pty`):
- Boot calls `Preferences get` for the migration marker, then `SystemBars hide`, the `App` listeners and `ScreenOrientation lock`. The UserDefaults plist gets `CapacitorStorage.captain-blastroid.migratedFromLocalStorage`.
- Backgrounding the app (launching Settings) fired `App.pause`, which ran `Preferences set` for the save.
- After `terminate` and relaunch, `Preferences get` returned the saved JSON, so the save persists across app kills.

**Not verified:**
- Haptics: the simulator has no Taptic engine.
- The in-run pause menu on backgrounding: it needs a touch to start a run, and simctl can't tap. It is the same hook the web build uses, and that was verified in Chrome.

### To build Android (user's machine)
1. Install Android Studio (bundles JDK 21 and the SDK manager), or a JDK 21 plus `sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" "emulator" "system-images;android-36;google_apis;arm64-v8a"`.
2. `export ANDROID_HOME=~/Library/Android/sdk` (or put `sdk.dir=…` in `android/local.properties`, which is gitignored). If Gradle picks the wrong JDK, set `JAVA_HOME` to the JDK 21.
3. Create an emulator (Device Manager → Pixel 7, API 36), then run `npm run build && npx cap sync android && npx cap run android`.
4. Check that:
   - the icon is the Kestrel;
   - the app launches portrait, fullscreen and with no system bars;
   - a run auto-pauses when you switch apps;
   - the save survives "swipe away" from recents;
   - back pauses the game.

## Device QA checklist (needs real phones)
Desktop-emulated results are marked ✓. Everything else still needs a real device.

- ✓ No scroll/zoom/selection: `touch-action:none` on the canvas; `overscroll-behavior:none` and `user-select:none` on the body; `user-scalable=no, maximum-scale=1`. Synthetic touch input caused no scroll.
- ✓ No 300 ms delay: Pointer Events only, a `width=device-width` viewport and `touch-action:none`.
- ✓ **Stick near the edges:** the stick base is clamped at least 16 CSS px from the left and right edges (`STICK_EDGE_INSET_CSS`, `input/stick.ts`).
  - A touch at the very edge still steers outward: in Chrome, a touch at x = 0 put the base at 8.4 logical px, and a further move left gave full −1 deflection.
  - It also moves the stick away from the Android edge-swipe back zone. The OS still owns touches that *start* in its gesture area, so a player who rests a thumb on the bezel can trigger Back. Inside the app, Back now only pauses.
  - Follow-up if testers hit it: `View.setSystemGestureExclusionRects` in `MainActivity` (at most 200 dp per edge).
- ✓ Auto-pause: `pagehide`/`visibilitychange` opened the pause menu in a run (Chrome), and the Capacitor `App.pause` path was checked on the iOS simulator as above.
- ☐ Notch / Dynamic Island / home indicator: the iOS simulator title screen fits inside the safe area. Gameplay with the stick near the home indicator is not checked on a device.
- ☐ Audio unlock on first tap (iOS silent switch: Web Audio follows the ringer on iOS 17+ unless `navigator.audioSession.type = 'playback'`; a possible follow-up).
- ☐ 10-minute battery/thermal session (note thermal throttling in `?debug` FPS after 10 min).
- ☐ PWA install and offline launch on iOS Safari and Android Chrome. Offline was verified in desktop Chrome: with the server stopped, a reload with a new query string booted to the title.

## Performance

Measured in desktop Chrome on the dev Mac (Apple Silicon) at 120 Hz, using the `?debug` overlay's per-second update and render averages and maxima. "Render" is the CPU time to issue all Canvas2D calls plus the final upscale `drawImage`. GPU compositing is not included.

| Scenario | Entities | Update avg / max | Render avg / max | FPS |
|---|---|---|---|---|
| Asteroid storm (`?t=150&god`, 150–176 s) | ~20 player shots, 3–7 enemies, 24–39 asteroids, pickups | 0.09 / 1.4 ms | 0.70 / 2.4 ms | 119–120 |
| Rock Hauler boss (180 s+) | boss rig, 6–9 enemy shots | 0.08 / 0.6 ms | 0.82 / 2.8 ms | 119–120 |
| Synthetic budget stress (`?sandbox`, injected) | **300 enemy bullets, 40 gnats**, repeated big explosions | 0.10 / 0.7 ms | 1.06 / 2.1 ms | 119–120 |

**No CPU throttling was available.** The browser tooling used here has no DevTools CPU throttle.

**Extrapolation:** a 2021 mid-range Android (Snapdragon 7xx-class) is typically 4–6× slower single-threaded than the dev Mac. At 6×, the storm and boss average about 5–6 ms per frame (update + render) against the 16.7 ms budget, and the 300-bullet stress about 7 ms. Single-frame spikes (max 2.8 ms ×6 ≈ 17 ms) could drop the odd frame.

**Conclusion:** Canvas2D is not the bottleneck, so the PixiJS renderer was **not** prototyped.

**On device:** load `?debug&t=150&god` over the LAN and watch the overlay. For a real profile, use `chrome://inspect` → Performance on the device. If frame time exceeds 16 ms, apply these in order:
1. Cap the explosion/particle budget with a "reduced effects" setting. Explosions are the largest render spikes.
2. Batch the HUD band redraw: it is static between changes and could be cached to an offscreen canvas.
3. Only then try a PixiJS `Renderer` behind `gfx/renderer.ts`.

## Known issues / follow-ups
- Android not built here (no SDK / JDK 21); see the steps above.
- Bundle id `com.captainblastroid.game` is a placeholder. No signing or store work was done (out of scope).
- **iOS PWA:**
  - Safari has no Screen Orientation lock, so landscape shows the letterboxed game. The manifest `orientation` is honoured by Android only.
  - No `navigator.vibrate` on iOS web, so haptics there need the native app.
- **Android Back on the title screen does nothing** (Esc has no title action). Consider `App.exitApp()` when Back is pressed on Title.
- **`@types/node`** used by `tools/pwa/*.ts` and `vite.config.ts` is currently a transitive dev dependency (via `@capacitor/cli`). Add it explicitly if that ever changes.
- **The native `public/` folders** (`ios/App/App/public`, `android/app/src/main/assets/public`) are gitignored build output. Always `npx cap sync` after `npm run build`.
