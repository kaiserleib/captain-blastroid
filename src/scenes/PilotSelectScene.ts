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
import {
  corners,
  drawArrowButton,
  drawPageDots,
  outline,
  pageCount,
  pageOf,
  PER_PAGE,
  sectorLabel,
  sectorName,
} from './rosterStrip';

const BIG = 2;
const CARD_H = PORTRAIT_H * BIG + 10;
const THUMB_W = PORTRAIT_W + 4;
const THUMB_H = PORTRAIT_H + 4;
const THUMB_GAP = 8;
const NAV_H = 20;
// Header 18 + card + strip + page row + done 22, with gaps.
const TOTAL = 22 + CARD_H + 6 + THUMB_H + 4 + NAV_H + 8 + 22;

/** Focused pilot large on a card, the roster below as a paged strip of 4 portraits. */
export class PilotSelectScene extends MenuScene {
  private top = 0;
  private cardY = 0;
  private navY = 0;
  private page = 0;
  /** The pilot the card shows: the last one focused on the strip. */
  private shown = 'blastroid';
  private flashT = 0;
  private entering = true;

  override enter(): void {
    this.entering = true;
    this.shown = getSave().selectedPilot;
    this.page = pageOf(PILOT_ORDER.indexOf(this.shown));
    this.relayout();
  }

  protected layout(w: number, h: number): void {
    this.top = Math.max(2, Math.floor((h - TOTAL) / 2));
    this.cardY = this.top + 22;
    const stripY = this.cardY + CARD_H + 6;
    const stripW = PER_PAGE * THUMB_W + (PER_PAGE - 1) * THUMB_GAP;
    const sx = Math.floor((w - stripW) / 2);
    const items: MenuItem[] = [];
    const first = this.page * PER_PAGE;
    for (let i = 0; i < PER_PAGE; i++) {
      const id = PILOT_ORDER[first + i];
      if (id) items.push(this.button(id, sx + i * (THUMB_W + THUMB_GAP), stripY, THUMB_W, THUMB_H));
    }
    this.navY = stripY + THUMB_H + 4;
    items.push(this.button('prev', sx, this.navY, 36, NAV_H));
    items.push(this.button('next', sx + stripW - 36, this.navY, 36, NAV_H));
    items.push(this.button('done', 50, this.navY + NAV_H + 8, w - 100, 22));
    this.menu.setItems(items, this.entering ? this.shown : undefined);
    this.entering = false;
  }

  protected override tick(dt: number): void {
    this.flashT = Math.max(0, this.flashT - dt);
    const f = this.menu.focused?.id;
    if (f && f in PILOTS) this.shown = f;
  }

  protected override nav(dx: number, dy: number): void {
    const f = this.menu.focused?.id ?? '';
    // Left/right on the strip walk the whole roster, turning pages at the edges.
    if (dx !== 0 && dy === 0 && f in PILOTS) {
      const i = PILOT_ORDER.indexOf(f) + dx;
      const id = PILOT_ORDER[i];
      if (!id) return;
      this.showPilot(id);
      sfx('ui_move');
      return;
    }
    super.nav(dx, dy);
  }

  private showPilot(id: string): void {
    this.shown = id;
    const page = pageOf(PILOT_ORDER.indexOf(id));
    if (page !== this.page) {
      this.page = page;
      this.layout(this.width, this.height);
    }
    this.menu.focusId(id);
  }

  private turn(dir: -1 | 1): void {
    const pages = pageCount(PILOT_ORDER.length);
    const page = this.page + dir;
    if (page < 0 || page >= pages) {
      sfx('ui_back');
      return;
    }
    sfx('ui_move');
    this.page = page;
    const focus = this.menu.focused?.id;
    this.shown = PILOT_ORDER[page * PER_PAGE] as string;
    this.layout(this.width, this.height);
    // Keep the arrow focused so repeated taps/presses keep paging.
    if (focus) this.menu.focusId(focus);
  }

  protected activate(it: MenuItem): void {
    if (it.id === 'done') {
      this.back();
      return;
    }
    if (it.id === 'prev' || it.id === 'next') {
      this.turn(it.id === 'prev' ? -1 : 1);
      return;
    }
    const save = getSave();
    this.shown = it.id;
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
    drawHeader(
      r,
      'SELECT PILOT',
      this.top,
      `${PILOT_ORDER.indexOf(this.shown) + 1}/${PILOT_ORDER.length}`,
    );
    this.drawCard(r, this.shown);

    const pages = pageCount(PILOT_ORDER.length);
    for (const it of this.menu.items) {
      const focused = this.focused(it.id);
      const pressed = this.pressed(it.id);
      if (it.id === 'done') {
        drawButton(r, it, 'DONE', { focused, pressed, t: this.t });
        continue;
      }
      if (it.id === 'prev' || it.id === 'next') {
        const dir = it.id === 'prev' ? -1 : 1;
        const enabled = dir < 0 ? this.page > 0 : this.page < pages - 1;
        drawArrowButton(r, it, dir, { focused, pressed, enabled });
        continue;
      }
      const locked = !save.pilotsRescued.includes(it.id);
      const p = pressed ? 1 : 0;
      drawWindow(r, it.x, it.y + p, it.w, it.h);
      drawPortrait(r, it.id, it.x + 2, it.y + 2 + p, 1, locked);
      if (save.selectedPilot === it.id) {
        const c = this.flashT > 0 ? '#f8f8f8' : GOLD;
        outline(r, it.x - 1, it.y - 1 + p, it.w + 2, it.h + 2, c);
        outline(r, it.x - 2, it.y - 2 + p, it.w + 4, it.h + 4, '#100818');
      }
      if (focused) corners(r, it.x - 3, it.y - 3 + p, it.w + 6, it.h + 6, '#f8f8f8', this.t);
    }
    drawPageDots(r, r.width / 2, this.navY + NAV_H / 2, this.page, pages);
  }

  private drawCard(r: Renderer, id: string): void {
    const save = getSave();
    const pilot = PILOTS[id];
    const y = this.cardY;
    const w = r.width;
    drawWindow(r, 6, y, w - 12, CARD_H);
    if (!pilot) return;
    const locked = !save.pilotsRescued.includes(id);
    drawPortrait(r, id, 11, y + 5, BIG, locked);
    const tx = 11 + PORTRAIT_W * BIG + 8;
    const tw = w - 12 - tx;
    if (locked) {
      r.text('???', tx, y + 8, { color: DIM });
      r.text('RESCUE:', tx, y + 24, { color: LOCK_RED });
      const rescue = pilot.unlock.kind === 'rescue' ? pilot.unlock.levelId : null;
      r.text(rescue ? `${sectorLabel(rescue)} POD` : '???', tx, y + 36, { color: LOCK_RED });
      const name = rescue ? sectorName(rescue) : '???';
      const lines = name === '???' ? [] : wrapText(name, tw);
      for (let i = 0; i < lines.length && i < 2; i++)
        r.text(lines[i] as string, tx, y + 48 + i * 10, { color: DIM });
      const hint = wrapText('Escort the escape pod to safety.', tw);
      for (let i = 0; i < hint.length && i < 4; i++)
        r.text(hint[i] as string, tx, y + 72 + i * 10, { color: DIM });
      return;
    }
    let ty = y + 8;
    for (const line of wrapText(pilot.name.toUpperCase(), tw)) {
      r.text(line, tx, ty, { color: GOLD });
      ty += 10;
    }
    if (save.selectedPilot === id) {
      r.text('SELECTED', tx, ty, { color: OK_GREEN });
    }
    ty += 14;
    for (const line of wrapText(pilot.passiveText, tw)) {
      r.text(line, tx, ty, { color: '#78d8f8' });
      ty += 10;
    }
    ty += 4;
    const bottom = y + CARD_H - 12;
    for (const line of wrapText(pilot.bio, tw)) {
      if (ty > bottom) break;
      r.text(line, tx, ty, { color: DIM });
      ty += 10;
    }
  }
}
