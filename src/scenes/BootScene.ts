import { flags } from '../debug/flags';
import type { Scene } from '../engine/scene';
import { initSave, setSave } from '../meta';
import { MemoryStorage, platform } from '../platform';
import { debugSave } from '../ui';
import { flow } from './flow';

/**
 * Loads the save, then hands over to the title screen (or straight into a run with
 * `?sandbox`, which the gameplay tickets' test keys rely on).
 */
export class BootScene implements Scene {
  private ready = false;

  enter(): void {
    void this.boot().finally(() => {
      this.ready = true;
    });
  }

  private async boot(): Promise<void> {
    void platform.orientation.lockPortrait();
    try {
      if (flags.save) {
        // Crafted saves live in memory so they never overwrite the real one.
        await initSave(new MemoryStorage(), platform.lifecycle);
        setSave(debugSave(flags.save));
      } else {
        await initSave(platform.storage, platform.lifecycle);
      }
    } catch (e) {
      console.error('Save failed to load; continuing with defaults', e);
    }
  }

  exit(): void {}

  // Switch on an update rather than inside the promise, so replace() isn't re-entered.
  update(): void {
    if (!this.ready) return;
    if (flags.sandbox) flow.launch({});
    else flow.title();
  }

  render(): void {}
}
