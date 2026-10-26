import type { Renderer } from '../gfx/renderer';

/** A pointer event already mapped to logical buffer coordinates. */
export interface ScenePointer {
  type: 'down' | 'move' | 'up' | 'cancel';
  id: number;
  pointerType: string;
  x: number;
  y: number;
}

export interface Scene {
  enter(data?: unknown): void;
  exit(): void;
  update(dt: number): void;
  render(r: Renderer, alpha: number): void;
  onPointer?(e: ScenePointer): void;
}

/**
 * Scene stack. Only the top scene updates and receives pointers; every scene
 * renders bottom-up so overlays (pause, settings) draw over a frozen scene.
 */
export class SceneManager {
  private readonly stack: Scene[] = [];

  get top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  get depth(): number {
    return this.stack.length;
  }

  replace(scene: Scene, data?: unknown): void {
    while (this.stack.length > 0) this.stack.pop()?.exit();
    this.stack.push(scene);
    scene.enter(data);
  }

  push(scene: Scene, data?: unknown): void {
    this.stack.push(scene);
    scene.enter(data);
  }

  pop(): void {
    this.stack.pop()?.exit();
  }

  update(dt: number): void {
    this.top?.update(dt);
  }

  render(r: Renderer, alpha: number): void {
    for (let i = 0; i < this.stack.length; i++) this.stack[i]?.render(r, alpha);
  }

  pointer(e: ScenePointer): void {
    this.top?.onPointer?.(e);
  }
}
