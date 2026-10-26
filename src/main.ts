import { DebugOverlay } from './debug/overlay';
import { flags } from './debug/flags';
import { Display } from './engine/display';
import { Loop } from './engine/loop';
import { SceneManager } from './engine/scene';
import { CanvasRenderer } from './gfx/renderer';
import { attachInput, input } from './input';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('#game canvas missing');

const display = new Display(canvas);
const renderer = new CanvasRenderer(display.ctx);
display.onResize((l) => {
  renderer.offsetY = l.playfieldOffsetY;
});

const scenes = new SceneManager();
attachInput(display);
input.onPointer = (e) => scenes.pointer(e);
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
    scenes.render(renderer, alpha);
    if (overlay) {
      overlay.recordFrame(performance.now());
      const top = scenes.top;
      overlay.draw(renderer, top instanceof GameScene ? top.world : null);
    }
    display.present();
  },
});

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

scenes.replace(new BootScene(scenes));
loop.start();
