import type { Renderer } from '../gfx/renderer';
import type { World } from '../sim/world';

/** `?debug` readout: frames/s, sim ticks/s (should read 60 on any refresh rate), update cost, entity counts. */
export class DebugOverlay {
  private windowStart = -1;
  private frames = 0;
  private ticks = 0;
  private updateMs = 0;
  private fps = 0;
  private tps = 0;
  private avgUpdateMs = 0;
  private maxUpdateMs = 0;
  private windowMaxMs = 0;

  recordTick(ms: number): void {
    this.ticks++;
    this.updateMs += ms;
    if (ms > this.windowMaxMs) this.windowMaxMs = ms;
  }

  recordFrame(nowMs: number): void {
    if (this.windowStart < 0) this.windowStart = nowMs;
    this.frames++;
    const elapsed = nowMs - this.windowStart;
    if (elapsed < 1000) return;
    this.fps = (this.frames * 1000) / elapsed;
    this.tps = (this.ticks * 1000) / elapsed;
    this.avgUpdateMs = this.ticks > 0 ? this.updateMs / this.ticks : 0;
    this.maxUpdateMs = this.windowMaxMs;
    this.windowStart = nowMs;
    this.frames = this.ticks = this.updateMs = this.windowMaxMs = 0;
  }

  /** Resets the window so time spent paused doesn't drag the averages down. */
  reset(): void {
    this.windowStart = -1;
    this.frames = this.ticks = this.updateMs = this.windowMaxMs = 0;
  }

  draw(r: Renderer, world: World | null): void {
    const offsetY = r.offsetY;
    r.offsetY = 0;
    const sx = r.shakeX;
    const sy = r.shakeY;
    r.shakeX = r.shakeY = 0;

    r.text(`FPS ${this.fps.toFixed(0)}  TPS ${this.tps.toFixed(0)}`, 2, 2, { color: '#78f878' });
    r.text(`UPD ${this.avgUpdateMs.toFixed(2)}ms MAX ${this.maxUpdateMs.toFixed(2)}`, 2, 11, {
      color: '#78f878',
    });
    if (world) {
      r.text(
        `PS${world.playerShots.count} ES${world.enemyShots.count} EN${world.enemies.count} ` +
          `AS${world.asteroids.count} AN${world.anomalies.count} PU${world.pickups.count}`,
        2,
        20,
        { color: '#78f878' },
      );
    }

    r.offsetY = offsetY;
    r.shakeX = sx;
    r.shakeY = sy;
  }
}
