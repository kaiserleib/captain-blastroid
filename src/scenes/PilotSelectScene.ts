import { PILOTS, PILOT_ORDER } from '../content';
import type { Renderer } from '../gfx/renderer';
import { drawWindow } from '../gfx/ui';
import { getSave, selectPilot, setSave } from '../meta';
import { PORTRAIT_H, PORTRAIT_W } from '../portraits';
import {
  DIM,
  drawButton,
  drawHeader,
  drawPortrait,
  GOLD,
  LOCK_RED,
  MenuScene,
  OK_GREEN,
  sfx,
  wrapText,
  type MenuItem,
} from '../ui';
import { flow } from './flow';

const SCALE = 2;
const FRAME_W = PORTRAIT_W * SCALE + 8;
const FRAME_H = PORTRAIT_H * SCALE + 8;

/** 2×2 grid of pilot portraits at 2×; locked pilots are silhouettes. */
export class PilotSelectScene extends MenuScene {
  private top = 0;
  private infoY = 0;
  private flashT = 0;

  protected layout(w: number, h: number): void {
    const gap = 8;
    // Header 18 + grid 2×120+8 + info 62 + done 22 + gaps ≈ 372.
    this.top = Math.max(2, Math.floor((h - 376) / 2));
    const gx = Math.floor((w - FRAME_W * 2 - gap) / 2);
    const gy = this.top + 22;
    const items: MenuItem[] = PILOT_ORDER.map((id, i) =>
      this.button(
        id,
        gx + (i % 2) * (FRAME_W + gap),
        gy + Math.floor(i / 2) * (FRAME_H + gap),
        FRAME_W,
        FRAME_H,
      ),
    );
    this.infoY = gy + FRAME_H * 2 + gap + 4;
    items.push(this.button('done', 50, this.infoY + 68, w - 100, 22));
    this.menu.setItems(items, getSave().selectedPilot);
  }

  protected override tick(dt: number): void {
    this.flashT = Math.max(0, this.flashT - dt);
  }

  protected activate(it: MenuItem): void {
    if (it.id === 'done') {
      this.back();
      return;
    }
    const save = getSave();
    if (!save.pilotsRescued.includes(it.id)) {
      sfx('ui_back');
      return;
    }
    sfx('ui_confirm');
    if (save.selectedPilot !== it.id) {
      setSave(selectPilot(save, it.id));
      this.flashT = 0.2;
    }
  }

  protected override back(): void {
    sfx('ui_back');
    this.later(() => flow.hangar('pilot'));
  }

  protected draw(r: Renderer): void {
    const save = getSave();
    drawHeader(r, 'SELECT PILOT', this.top);
    let shown = this.menu.focused?.id ?? save.selectedPilot;
    if (shown === 'done') shown = save.selectedPilot;

    for (const it of this.menu.items) {
      if (it.id === 'done') {
        drawButton(r, it, 'DONE', {
          focused: this.focused(it.id),
          pressed: this.pressed(it.id),
          t: this.t,
        });
        continue;
      }
      const locked = !save.pilotsRescued.includes(it.id);
      const selected = save.selectedPilot === it.id;
      const focused = this.focused(it.id);
      const p = this.pressed(it.id) ? 1 : 0;
      drawWindow(r, it.x, it.y + p, it.w, it.h);
      drawPortrait(r, it.id, it.x + 4, it.y + 4 + p, SCALE, locked);
      if (locked) {
        r.text('LOCKED', it.x + it.w / 2, it.y + it.h - 16 + p, {
          align: 'center',
          color: LOCK_RED,
        });
      }
      if (selected) {
        const c = this.flashT > 0 ? '#f8f8f8' : GOLD;
        outline(r, it.x - 1, it.y - 1 + p, it.w + 2, it.h + 2, c);
        r.rect(it.x + 4, it.y + it.h - 16 + p, 40, 12, '#100818');
        r.text('PILOT', it.x + 7, it.y + it.h - 14 + p, { color: GOLD, font: 'ui' });
      }
      if (focused) {
        // A blinking bracket: corners in white that pulse with the cursor rhythm.
        const on = this.t * 4 - Math.floor(this.t * 4) < 0.8;
        if (on) corners(r, it.x - 3, it.y - 3 + p, it.w + 6, it.h + 6, '#f8f8f8');
      }
    }

    this.drawInfo(r, shown);
  }

  private drawInfo(r: Renderer, id: string): void {
    const save = getSave();
    const pilot = PILOTS[id];
    const y = this.infoY;
    drawWindow(r, 6, y, r.width - 12, 62);
    if (!pilot) return;
    if (!save.pilotsRescued.includes(id)) {
      r.text('???', 14, y + 7, { color: DIM });
      r.text('RESCUE FROM ESCAPE POD', 14, y + 21, { color: LOCK_RED });
      const where = pilot.unlock.kind === 'rescue' && pilot.unlock.levelId === 'kessler';
      r.text(
        where ? 'Seen drifting in the Kessler Belt.' : 'Not seen in this sector.',
        14,
        y + 35,
        {
          color: DIM,
        },
      );
      return;
    }
    r.text(pilot.name, 14, y + 7, { color: GOLD });
    if (save.selectedPilot === id)
      r.text('SELECTED', r.width - 14, y + 7, { align: 'right', color: OK_GREEN });
    r.text(pilot.passiveText, 14, y + 19, { color: '#78d8f8' });
    const lines = wrapText(pilot.bio, r.width - 28);
    for (let i = 0; i < lines.length && i < 3; i++)
      r.text(lines[i] as string, 14, y + 31 + i * 10, { color: DIM });
  }
}

function outline(r: Renderer, x: number, y: number, w: number, h: number, c: string): void {
  r.rect(x, y, w, 1, c);
  r.rect(x, y + h - 1, w, 1, c);
  r.rect(x, y, 1, h, c);
  r.rect(x + w - 1, y, 1, h, c);
}

function corners(r: Renderer, x: number, y: number, w: number, h: number, c: string): void {
  const L = 6;
  r.rect(x, y, L, 2, c);
  r.rect(x, y, 2, L, c);
  r.rect(x + w - L, y, L, 2, c);
  r.rect(x + w - 2, y, 2, L, c);
  r.rect(x, y + h - 2, L, 2, c);
  r.rect(x, y + h - L, 2, L, c);
  r.rect(x + w - L, y + h - 2, L, 2, c);
  r.rect(x + w - 2, y + h - L, 2, L, c);
}
