import { LEVEL_ORDER, PILOTS, SHIPS } from '../content';
import { measure } from '../gfx/font';
import type { Renderer } from '../gfx/renderer';
import { drawWindow } from '../gfx/ui';
import { getSave, HIGH_SCORE_LIMIT, levelHighScores } from '../meta';
import {
  DIM,
  drawButton,
  drawHeader,
  GOLD,
  MenuScene,
  sectorLabel,
  sfx,
  type MenuItem,
} from '../ui';
import { flow } from './flow';

const PAGER_H = 20;

/** One high-score table per sector (paged left/right), then lifetime stats. */
export class RecordsScene extends MenuScene {
  private top = 0;
  private page = 0;

  override enter(): void {
    this.page = Math.max(0, LEVEL_ORDER.indexOf(getSave().selectedLevel));
  }

  protected layout(w: number, h: number): void {
    this.top = Math.max(2, Math.floor((h - 292) / 2));
    const py = this.top + 22;
    this.menu.setItems(
      [
        this.button('prev', 6, py, 26, PAGER_H),
        this.button('next', w - 32, py, 26, PAGER_H),
        this.button('done', 50, this.top + 268, w - 100, 22),
      ],
      'done',
    );
  }

  protected activate(it: MenuItem): void {
    if (it.id === 'prev') this.turn(-1);
    else if (it.id === 'next') this.turn(1);
    else this.back();
  }

  /** Left/right always page; up/down move focus as usual. */
  protected override nav(dx: number, dy: number): void {
    if (dx !== 0 && dy === 0) this.turn(dx);
    else super.nav(dx, dy);
  }

  private turn(d: number): void {
    const n = LEVEL_ORDER.length;
    if (n < 2) return;
    this.page = (this.page + d + n) % n;
    sfx('ui_move');
  }

  protected override back(): void {
    sfx('ui_back');
    this.later(() => flow.hangar('records'));
  }

  protected draw(r: Renderer): void {
    const save = getSave();
    const w = r.width;
    const levelId = LEVEL_ORDER[this.page] as string;
    drawHeader(r, 'RECORDS', this.top, `${this.page + 1}/${LEVEL_ORDER.length}`);

    // Pager: the sector name between two arrow buttons.
    const many = LEVEL_ORDER.length > 1;
    for (const it of this.menu.items) {
      if (it.id === 'done') continue;
      drawButton(r, it, it.id === 'prev' ? '<' : '>', {
        focused: this.focused(it.id),
        pressed: this.pressed(it.id),
        t: this.t,
        disabled: !many,
      });
    }
    const name = sectorLabel(levelId);
    const fits = measure(name) <= w - 76;
    r.text(name, w / 2, this.top + 22 + 6 + (fits ? 0 : 1), {
      align: 'center',
      color: GOLD,
      font: fits ? 'ui' : 'small',
    });

    let y = this.top + 22 + PAGER_H + 2;
    const scores = levelHighScores(save, levelId);
    drawWindow(r, 6, y, w - 12, 18 + HIGH_SCORE_LIMIT * 11 + 6);
    r.text('#', 14, y + 6, { color: DIM });
    r.text('SCORE', 90, y + 6, { align: 'right', color: DIM });
    r.text('PILOT', 100, y + 6, { color: DIM });
    r.text('SHIP', w - 14, y + 6, { align: 'right', color: DIM });
    y += 19;
    for (let i = 0; i < HIGH_SCORE_LIMIT; i++) {
      const hs = scores[i];
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

    const done = this.menu.items.find((it) => it.id === 'done');
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
