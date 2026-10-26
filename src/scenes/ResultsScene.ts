import { stopMusic } from '../audio';
import { randomSeedString } from '../engine/rng';
import { drawText } from '../gfx/font';
import type { Renderer } from '../gfx/renderer';
import { drawWindow } from '../gfx/ui';
import '../game/hud';
import '../game/player';
import { getSave, isLevelUnlocked, saveNow, selectLevel, setSave } from '../meta';
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
  sectorLabel,
  sfx,
  WHITE_TEXT,
  type DiscoveryLine,
  type MenuItem,
} from '../ui';
import { flow, type ResultsData } from './flow';

const COUNT_DELAY = 0.6;
const COUNT_TIME = 1.4;
const LINE_H = 30;
const BUTTON_H = 26;
const LABELS: Readonly<Record<string, string>> = {
  next: 'NEXT SECTOR',
  retry: 'RETRY',
  hangar: 'HANGAR',
};

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
  private levelId = '';
  private shipId = '';
  private pilotId = '';
  private nextLevel: string | null = null;
  private campaignComplete = false;

  override enter(data?: unknown): void {
    const d = data as ResultsData;
    this.victory = d.victory;
    this.abandoned = d.abandoned;
    this.score = d.run.score;
    this.kills = d.run.kills;
    this.time = d.time;
    this.levelId = d.run.levelId;
    this.shipId = d.run.shipId;
    this.pilotId = d.run.pilotId;
    const banked = bankFinishedRun(getSave(), d.run, d.victory, d.abandoned);
    setSave(banked.save);
    void saveNow();
    this.earned = banked.salvageEarned;
    this.lines = discoveryLines(banked.discoveries);
    this.campaignComplete = d.victory && banked.campaignComplete;
    this.nextLevel =
      d.victory && banked.nextLevel && isLevelUnlocked(banked.save, banked.nextLevel)
        ? banked.nextLevel
        : null;
    // On a clear, T04 is already playing the `clear` jingle.
    if (!d.victory) stopMusic(1.5);
  }

  private get counting(): boolean {
    return !this.skip && this.shown < this.earned;
  }

  private get titleH(): number {
    return 30 + 12 + (this.campaignComplete ? 12 : 0);
  }

  protected layout(w: number, h: number): void {
    const listH = Math.max(1, this.lines.length) * LINE_H + 22;
    const ids = this.victory
      ? this.nextLevel
        ? ['next', 'hangar']
        : ['hangar']
      : ['retry', 'hangar'];
    const buttonsH = ids.length * (BUTTON_H + 6) - 6;
    const total = this.titleH + 84 + 8 + listH + 8 + buttonsH;
    this.top = Math.max(4, Math.floor((h - total) / 2));
    let y = this.top + total - buttonsH;
    const items: MenuItem[] = [];
    for (const id of ids) {
      items.push(this.button(id, 40, y, w - 80, BUTTON_H));
      y += BUTTON_H + 6;
    }
    this.menu.setItems(items, ids[0]);
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

  protected activate(it: MenuItem): void {
    if (this.counting) {
      this.skip = true;
      return;
    }
    sfx('ui_confirm');
    if (it.id === 'hangar') {
      this.later(() => flow.hangar());
      return;
    }
    const levelId = it.id === 'next' && this.nextLevel ? this.nextLevel : this.levelId;
    // The hangar follows the campaign: after flying on, LAUNCH stays on this sector.
    if (isLevelUnlocked(getSave(), levelId)) {
      setSave(selectLevel(getSave(), levelId));
      void saveNow();
    }
    this.later(() =>
      flow.launch({
        shipId: this.shipId,
        pilotId: this.pilotId,
        levelId,
        seed: randomSeedString(),
      }),
    );
  }

  protected override back(): void {
    if (this.counting) {
      this.skip = true;
      return;
    }
    sfx('ui_back');
    this.later(() => flow.hangar());
  }

  protected draw(r: Renderer): void {
    const w = r.width;
    let y = this.top;
    const title = this.abandoned ? 'RUN ABANDONED' : this.victory ? 'SECTOR CLEAR' : 'SHIP LOST';
    const color = this.victory ? GOLD : this.abandoned ? '#a0a8c0' : LOCK_RED;
    drawText(r.ctx, title, w / 2, y, { align: 'center', color, scale: 2, shadowColor: '#100818' });
    r.text(sectorLabel(this.levelId), w / 2, y + 22, { align: 'center', color: WHITE_TEXT });
    if (this.campaignComplete) {
      // Blinks gold/white so the end of the campaign reads as an event.
      const c = Math.floor(this.t * 3) % 2 === 0 ? GOLD : WHITE_TEXT;
      r.text('CAMPAIGN COMPLETE', w / 2, y + 34, { align: 'center', color: c });
    }
    y += this.titleH;

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

    for (let i = 0; i < this.menu.items.length; i++) {
      const it = this.menu.items[i] as MenuItem;
      // While salvage counts up, any button just skips the count.
      const label = this.counting && i === 0 ? 'SKIP' : (LABELS[it.id] ?? it.id);
      drawButton(r, it, label, {
        focused: this.focused(it.id),
        pressed: this.pressed(it.id),
        t: this.t,
        color: it.id === 'next' && !this.counting ? GOLD : undefined,
        disabled: this.counting && i > 0,
      });
    }
  }
}
