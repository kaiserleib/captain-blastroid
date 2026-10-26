import type { Platform } from './platform';
import { WebHaptics } from './web/haptics';
import { WebLifecycle, WebOrientation } from './web/lifecycle';
import { WebStorage } from './web/storage';

export type {
  HapticKind,
  Haptics,
  Lifecycle,
  Orientation,
  Platform,
  StorageAdapter,
} from './platform';
export { MemoryStorage, WebStorage, type KeyValueBacking } from './web/storage';
export { WebHaptics } from './web/haptics';
export { WebLifecycle, WebOrientation } from './web/lifecycle';

/** Nothing here touches the DOM until a method is called, so importing this is safe in Node. */
export function createWebPlatform(): Platform {
  return {
    kind: 'web',
    storage: new WebStorage(),
    haptics: new WebHaptics(),
    lifecycle: new WebLifecycle(),
    orientation: new WebOrientation(),
  };
}

/** The active platform. T19 swaps in Capacitor services via `setPlatform` when native. */
export let platform: Platform = createWebPlatform();

export function setPlatform(p: Platform): void {
  platform = p;
}
