import { PILOTS, SHIPS } from '../content';
import type { Renderer } from '../gfx/renderer';
import { drawWindow } from '../gfx/ui';
import { getSave, HIGH_SCORE_LIMIT } from '../meta';
import { DIM, drawButton, drawHeader, GOLD, MenuScene, sfx, type MenuItem } from '../ui';
import { flow } from './flow';

/** High-score table and lifetime stats. */
export class RecordsScene extends MenuScene {
  private top = 0;

  protected layout(w: number, h: number): void {
    this.top = Math.max(2, Math.floor((h - 270) / 2));
    this.menu.setItems([this.button('done', 50, this.top + 246, w - 100, 22)]);
  }

  protected activate(_it: MenuItem): void {
    this.back();
  }

  protected override back(): void {
    sfx('ui_back');
    this.later(() => flow.hangar('records'));
  }

  protected draw(r: Renderer): void {
    const save = getSave();
    const w = r.width;
    drawHeader(r, 'RECORDS', this.top);

    let y = this.top + 22;
    drawWindow(r, 6, y, w - 12, 18 + HIGH_SCORE_LIMIT * 11 + 6);
    r.text('#', 14, y + 6, { color: DIM });
    r.text('SCORE', 90, y + 6, { align: 'right', color: DIM });
    r.text('PILOT', 100, y + 6, { color: DIM });
    r.text('SHIP', w - 14, y + 6, { align: 'right', color: DIM });
    y += 19;
    for (let i = 0; i < HIGH_SCORE_LIMIT; i++) {
      const hs = save.highScores[i];
      const c = i === 0 ? GOLD : '#f8f8f8';
      r.text(String(i + 1), 14, y, { color: hs ? c : DIM });
      if (hs) {
        r.text(String(hs.score), 90, y, { align: 'right', color: c });
        r.text(short(PILOTS[hs.pilot]?.name ?? hs.pilot), 100, y, { color: c });
        r.text((SHIPS[hs.ship]?.name ?? hs.ship).toUpperCase(), w - 14, y, {
          align: 'right',
          color: DIM,
        });
      } else {
        r.text('-----', 90, y, { align: 'right', color: '#404860' });
      }
      y += 11;
    }

    y += 12;
    const st = save.stats;
    const rows: [string, number][] = [
      ['RUNS', st.runs],
      ['KILLS', st.kills],
      ['SHIPS LOST', st.deaths],
      ['BOSSES DOWN', st.bossKills],
      ['SALVAGE EARNED', save.totalSalvageEarned],
    ];
    drawWindow(r, 6, y, w - 12, rows.length * 11 + 12);
    y += 6;
    for (const [label, v] of rows) {
      r.text(label, 14, y, { color: DIM });
      r.text(String(v), w - 14, y, { align: 'right' });
      y += 11;
    }

    const done = this.menu.items[0];
    if (done)
      drawButton(r, done, 'DONE', {
        focused: this.focused('done'),
        pressed: this.pressed('done'),
        t: this.t,
      });
  }
}

/** "Captain Blastroid" → "Blastroid": the table column is narrow. */
function short(name: string): string {
  const parts = name.split(' ');
  return parts.length > 1 && (parts[0] === 'Captain' || parts[0] === 'Old')
    ? (parts[1] as string)
    : (parts[0] as string);
}
