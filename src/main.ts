import { installAudio, setMuted } from './audio';
import { DebugOverlay } from './debug/overlay';
import { flags } from './debug/flags';
import { Display } from './engine/display';
import { Loop } from './engine/loop';
import { SceneManager } from './engine/scene';
import { CanvasRenderer } from './gfx/canvasRenderer';
import { setHitstopSink } from './gfx/fx';
import { attachInput, input, setInputSettingsProvider } from './input';
import { getSettings, onSaveChange } from './meta';
import { platform } from './platform';
import { BootScene } from './scenes/BootScene';
import { initFlow } from './scenes/flow';
import { GameScene } from './scenes/GameScene';
import { setHudViewport } from './game/hud';
import { applyAudioSettings, bindWasdNav, isUiScene, setMinHitSize } from './ui';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('#game canvas missing');

const display = new Display(canvas, flags.h);
const renderer = new CanvasRenderer(display.ctx);
display.onResize((l) => {
  renderer.offsetY = l.playfieldOffsetY;
  setHudViewport(l);
  // Menu tap targets stay at least 44 CSS px on every display.
  setMinHitSize((44 * l.dpr * l.logicalW) / l.destW);
});

const scenes = new SceneManager();
attachInput(display);
input.onPointer = (e) => scenes.pointer(e);
initFlow(scenes);
// Menu keys go to whichever scene is on top; GameScene takes pause via `pauseRequested`.
input.onUi = (e) => {
  const top = scenes.top;
  if (isUiScene(top)) top.onUi(e);
};
bindWasdNav((dx, dy) => {
  const top = scenes.top;
  if (isUiScene(top)) top.onUi({ kind: 'nav', dx, dy });
});
setInputSettingsProvider(() => getSettings());
// Fires on load and on every change, so saved volumes reach the mixer before any sound.
onSaveChange((save) => applyAudioSettings(save.settings));
const overlay = flags.debug ? new DebugOverlay() : null;

const loop = new Loop({
  update(dt) {
    if (!overlay) {
      scenes.update(dt);
      input.endTick();
      return;
    }
    const t0 = performance.now();
    scenes.update(dt);
    overlay.recordTick(performance.now() - t0);
    input.endTick();
  },
  render(alpha) {
    if (!overlay) {
      scenes.render(renderer, alpha);
      display.present();
      return;
    }
    const t0 = performance.now();
    scenes.render(renderer, alpha);
    const top = scenes.top;
    overlay.draw(renderer, top instanceof GameScene ? top.world : null);
    display.present();
    const t1 = performance.now();
    overlay.recordRender(t1 - t0);
    overlay.recordFrame(t1);
  },
});

setHitstopSink((s) => loop.hitstop(s));

/** A run in progress gets the pause menu when the app is backgrounded. */
function pauseRun(): void {
  const top = scenes.top;
  if (top instanceof GameScene) top.pauseNow();
}
// Page hidden / pagehide on the web; Capacitor's App.pause once T19 swaps the platform in.
platform.lifecycle.onPause(pauseRun);

// Pause whenever the page is hidden; resume() discards the elapsed time.
function syncLifecycle(): void {
  if (document.visibilityState === 'hidden') {
    loop.pause();
  } else if (loop.paused) {
    overlay?.reset();
    loop.resume();
  }
}
document.addEventListener('visibilitychange', syncLifecycle);
window.addEventListener('pagehide', () => loop.pause());
window.addEventListener('pageshow', syncLifecycle);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
// Unlocks audio on the first gesture and suspends it with the page lifecycle.
installAudio();
if (flags.mute) setMuted(true);

scenes.replace(new BootScene());
loop.start();
