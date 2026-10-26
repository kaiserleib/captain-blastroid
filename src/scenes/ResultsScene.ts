import { stopMusic } from '../audio';
import { drawText } from '../gfx/font';
import type { Renderer } from '../gfx/renderer';
import { drawWindow } from '../gfx/ui';
import '../game/hud';
import '../game/player';
import { getSave, saveNow, setSave } from '../meta';
import {
  bankFinishedRun,
  DIM,
  discoveryLines,
  drawButton,
  drawPortrait,
  drawSalvage,
  drawSpriteScaled,
  formatTime,
  GOLD,
  LOCK_RED,
  MenuScene,
  OK_GREEN,
  sfx,
  type DiscoveryLine,
  type MenuItem,
} from '../ui';
import { flow, type ResultsData } from './flow';

const COUNT_DELAY = 0.6;
const COUNT_TIME = 1.4;
const LINE_H = 30;

/** End of a run: banks it exactly once, then counts up the salvage. */
export class ResultsScene extends MenuScene {
  private victory = false;
  private abandoned = false;
  private score = 0;
  private kills = 0;
  private time = 0;
  private earned = 0;
  private lines: DiscoveryLine[] = [];
  private top = 0;
  private shown = 0;
  private skip = false;
  private lastTick = 0;

  override enter(data?: unknown): void {
    const d = data as ResultsData;
    this.victory = d.victory;
    this.abandoned = d.abandoned;
    this.score = d.run.score;
    this.kills = d.run.kills;
    this.time = d.time;
    const banked = bankFinishedRun(getSave(), d.run, d.victory);
    setSave(banked.save);
    void saveNow();
    this.earned = banked.salvageEarned;
    this.lines = discoveryLines(banked.discoveries);
    // On a clear, T04 is already playing the `clear` jingle.
    if (!d.victory) stopMusic(1.5);
  }

  private get counting(): boolean {
    return !this.skip && this.shown < this.earned;
  }

  protected layout(w: number, h: number): void {
    const listH = Math.max(1, this.lines.length) * LINE_H + 22;
    const total = 30 + 84 + 8 + listH + 8 + 26;
    this.top = Math.max(4, Math.floor((h - total) / 2));
    this.menu.setItems([this.button('continue', 40, this.top + total - 26, w - 80, 26)]);
  }

  protected override tick(): void {
    const k = Math.max(0, Math.min(1, (this.t - COUNT_DELAY) / COUNT_TIME));
    const next = this.skip ? this.earned : Math.floor(this.earned * (1 - (1 - k) * (1 - k)));
    if (next !== this.shown && this.t - this.lastTick > 0.05) {
      this.lastTick = this.t;
      sfx('pickup');
    }
    this.shown = next;
  }

  protected activate(_it: MenuItem): void {
    if (this.counting) {
      this.skip = true;
      return;
    }
    sfx('ui_confirm');
    this.later(() => flow.hangar());
  }

  protected override back(): void {
    this.activate(this.menu.items[0] as MenuItem);
  }

  protected draw(r: Renderer): void {
    const w = r.width;
    let y = this.top;
    const title = this.abandoned ? 'RUN ABANDONED' : this.victory ? 'SECTOR CLEAR' : 'SHIP LOST';
    const color = this.victory ? GOLD : this.abandoned ? '#a0a8c0' : LOCK_RED;
    drawText(r.ctx, title, w / 2, y, { align: 'center', color, scale: 2, shadowColor: '#100818' });
    y += 30;

    drawWindow(r, 6, y, w - 12, 84);
    const rows: [string, string][] = [
      ['SCORE', String(this.score)],
      ['KILLS', String(this.kills)],
      ['TIME', formatTime(this.time)],
    ];
    let ry = y + 8;
    for (const [label, v] of rows) {
      r.text(label, 16, ry, { color: DIM });
      r.text(v, w - 16, ry, { align: 'right' });
      ry += 13;
    }
    r.rect(14, ry, w - 28, 1, '#6070a0');
    ry += 6;
    r.text('SALVAGE', 16, ry, { color: DIM });
    r.text(`+${this.shown}`, w - 16, ry, { align: 'right', color: GOLD });
    ry += 13;
    r.text('IN THE BANK', 16, ry, { color: DIM });
    const bank = getSave().salvage - (this.earned - this.shown);
    drawSalvage(r, bank, w - 16, ry);
    y += 92;

    const listH = Math.max(1, this.lines.length) * LINE_H + 22;
    drawWindow(r, 6, y, w - 12, listH);
    r.text('DISCOVERIES', 16, y + 6, { color: GOLD });
    let ly = y + 20;
    if (this.lines.length === 0) {
      r.text('Nothing new this time.', 16, ly + 8, { color: DIM });
    }
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i] as DiscoveryLine;
      // Discoveries pop in one by one once the count-up is done.
      const at = COUNT_DELAY + COUNT_TIME + 0.3 * i;
      if (!this.skip && this.t < at) break;
      const fresh = this.t - at < 0.25 && !this.skip;
      if (line.kind === 'pilot' && line.ref) {
        drawWindow(r, 14, ly, 26, 28);
        r.ctx.save();
        r.ctx.beginPath();
        r.ctx.rect(16, ly + 2, 22, 24);
        r.ctx.clip();
        drawPortrait(r, line.ref, 3, ly - 12, 1);
        r.ctx.restore();
      } else if (line.kind === 'schematic' && line.ref) {
        drawSpriteScaled(r, line.ref, 27, ly + 12, 1, 0, '#4880d8');
      } else {
        drawWindow(r, 14, ly, 26, 28);
        r.text(`#${line.value.split(' ')[1]}`, 27, ly + 10, { align: 'center', color: GOLD });
      }
      r.text(line.label, 48, ly + 4, {
        color: fresh ? '#f8f8f8' : line.kind === 'highScore' ? GOLD : OK_GREEN,
      });
      r.text(line.value, 48, ly + 16, {});
      ly += LINE_H;
    }

    const it = this.menu.items[0];
    if (it) {
      drawButton(r, it, this.counting ? 'SKIP' : 'CONTINUE', {
        focused: this.focused(it.id),
        pressed: this.pressed(it.id),
        t: this.t,
      });
    }
  }
}
