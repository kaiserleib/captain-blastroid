import { Background, isThemeId, PARALLAX, themeForLevel, type ThemeId } from '../backgrounds';
import type { ScenePointer } from '../engine/scene';
import { actIndexOf, ACTS, getLevel, type ActDef } from '../content';
import { drawText, measure } from '../gfx/font';
import type { Renderer } from '../gfx/renderer';
import { drawCursor, drawWindow } from '../gfx/ui';
import { getSave, saveNow, selectLevel, setSave } from '../meta';
import {
  DIM,
  drawButton,
  drawHeader,
  drawSpriteScaled,
  GOLD,
  LOCK_RED,
  MenuScene,
  OK_GREEN,
  sectorInfo,
  sfx,
  WHITE_TEXT,
  type MenuItem,
  type SectorInfo,
} from '../ui';
import { flow } from './flow';

const CARD_H = 56;
const PAGER_H = 20;
/** A horizontal drag this long (logical px), and mostly sideways, turns the page. */
export const SWIPE_MIN = 32;
/** On a tall (520 px) buffer the cards grow to show more of each banner. */
const CARD_H_TALL = 70;
const GAP = 4;
const BANNER_W = 52;
const PREFIX = 'sector:';
const BLUEPRINT = '#78a8f8';
const UNCLEARED_STAR = '#404860';

// One prebuilt background per theme, shared by every visit to this screen.
const banners = new Map<ThemeId, Background>();

function bannerFor(levelId: string): Background {
  const level = getLevel(levelId);
  const theme = isThemeId(level.theme) ? level.theme : themeForLevel(levelId);
  let bg = banners.get(theme);
  if (!bg) {
    bg = new Background(theme, 'SECTOR');
    banners.set(theme, bg);
  }
  return bg;
}

/**
 * Where to look into a theme's background: parked on its first set piece (a planet,
 * station or belt reads far better than empty sky), with only the stars twinkling.
 */
function bannerView(bg: Background, bh: number): { scroll: number; cx: number } {
  const t = bg.theme;
  const piece = t.setPieces[0];
  if (!piece) return { scroll: 0, cx: 120 };
  const ph = piece.kind === 'planet' ? piece.size * 2 : piece.size;
  const pw = piece.kind === 'planet' ? piece.size * 2 : piece.kind === 'belt' ? 240 : piece.size;
  const scroll = piece.at * t.scrollSpeed + (bh / 2 + ph / 2) / PARALLAX.setPiece;
  const cx = Math.min(240 - BANNER_W / 2, Math.max(BANNER_W / 2, piece.x + pw / 2));
  return { scroll, cx };
}

/** -1 / 1 for a left / right swipe of (dx, dy) logical px, else 0. */
export function swipeDir(dx: number, dy: number): number {
  if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < 2 * Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

/**
 * Five stacked sector cards per act, paged left/right (keys, swipe, arrows);
 * confirming an unlocked one makes it the hangar's LAUNCH target.
 */
export class SectorSelectScene extends MenuScene {
  private top = 0;
  private infos: SectorInfo[] = [];
  private page = 0;
  /** The card to focus after a layout (null: the first card). */
  private focusId: string | null = null;
  private swipe = { id: -1, x: 0, y: 0 };

  override enter(): void {
    const save = getSave();
    this.infos = ACTS.flatMap((a) => a.levels).map((id) => sectorInfo(save, id));
    this.page = actIndexOf(save.selectedLevel);
    this.focusId = PREFIX + save.selectedLevel;
  }

  private get act(): ActDef {
    return ACTS[this.page] as ActDef;
  }

  /** The whole act is locked until the sector before its first one is cleared. */
  private get actLocked(): boolean {
    const first = this.infos.find((s) => s.id === this.act.levels[0]);
    return first !== undefined && !first.unlocked;
  }

  protected layout(w: number, h: number): void {
    const n = this.act.levels.length;
    const chrome = 24 + PAGER_H + 4 + 8 + 22;
    const tall = chrome + n * (CARD_H_TALL + GAP) - GAP <= h - 16;
    const cardH = tall ? CARD_H_TALL : CARD_H;
    const total = chrome + n * (cardH + GAP) - GAP;
    this.top = Math.max(4, Math.floor((h - total) / 2));
    const items: MenuItem[] = [
      this.button('prev', 6, this.top + 22, 26, PAGER_H),
      this.button('next', w - 32, this.top + 22, 26, PAGER_H),
    ];
    let y = this.top + 22 + PAGER_H + 4;
    for (const id of this.act.levels) {
      items.push(this.button(PREFIX + id, 6, y, w - 12, cardH));
      y += cardH + GAP;
    }
    items.push(this.button('back', 50, y - GAP + 8, w - 100, 22));
    const want = this.focusId;
    const focus = items.some((it) => it.id === want) ? want : PREFIX + this.act.levels[0];
    this.menu.setItems(items, focus ?? undefined);
  }

  /** Left/right always page; up/down move focus as usual. */
  protected override nav(dx: number, dy: number): void {
    if (dx !== 0 && dy === 0) this.turn(dx);
    else super.nav(dx, dy);
  }

  override onPointer(e: ScenePointer): void {
    const sw = this.swipe;
    if (e.type === 'down' && sw.id < 0) {
      sw.id = e.id;
      sw.x = e.x;
      sw.y = e.y;
    } else if ((e.type === 'up' || e.type === 'cancel') && e.id === sw.id) {
      sw.id = -1;
      const d = e.type === 'up' ? swipeDir(e.x - sw.x, e.y - sw.y) : 0;
      if (d !== 0) {
        // The finger lifted off whatever card it started on: don't press it.
        super.onPointer({ ...e, type: 'cancel' });
        this.turn(d);
        return;
      }
    }
    super.onPointer(e);
  }

  private turn(d: number): void {
    const n = ACTS.length;
    if (n < 2) return;
    this.page = (this.page + d + n) % n;
    const sel = getSave().selectedLevel;
    // Arrows keep focus on the arrow tapped (so it can be tapped again); keys and swipes land on a card.
    const onArrow = this.menu.isFocused('prev') || this.menu.isFocused('next');
    this.focusId = this.act.levels.includes(sel) ? PREFIX + sel : null;
    if (onArrow) this.focusId = d < 0 ? 'prev' : 'next';
    sfx('ui_move');
    this.relayout();
  }

  protected activate(it: MenuItem): void {
    if (it.id === 'back') {
      this.back();
      return;
    }
    if (it.id === 'prev' || it.id === 'next') {
      this.turn(it.id === 'prev' ? -1 : 1);
      return;
    }
    const info = this.infos.find((s) => PREFIX + s.id === it.id);
    if (!info?.unlocked) {
      sfx('ui_back');
      return;
    }
    setSave(selectLevel(getSave(), info.id));
    void saveNow();
    sfx('ui_confirm');
    this.later(() => flow.hangar('launch'));
  }

  protected override back(): void {
    sfx('ui_back');
    this.later(() => flow.hangar('sector'));
  }

  protected draw(r: Renderer): void {
    const selected = getSave().selectedLevel;
    drawHeader(r, 'SECTOR SELECT', this.top, `${this.page + 1}/${ACTS.length}`);
    const locked = this.actLocked;
    r.text(this.act.name, r.width / 2, this.top + 22 + 6, {
      align: 'center',
      color: locked ? DIM : GOLD,
    });
    for (const it of this.menu.items) {
      if (it.id === 'prev' || it.id === 'next') {
        drawButton(r, it, it.id === 'prev' ? '<' : '>', {
          focused: this.focused(it.id),
          pressed: this.pressed(it.id),
          t: this.t,
          disabled: ACTS.length < 2,
        });
        continue;
      }
      if (it.id === 'back') {
        drawButton(r, it, 'BACK', {
          focused: this.focused(it.id),
          pressed: this.pressed(it.id),
          t: this.t,
        });
        continue;
      }
      const info = this.infos.find((s) => PREFIX + s.id === it.id);
      if (info) this.drawCard(r, it, info, info.id === selected, locked);
    }
  }

  private drawCard(
    r: Renderer,
    it: MenuItem,
    s: SectorInfo,
    selected: boolean,
    actLocked: boolean,
  ): void {
    const focused = this.focused(it.id);
    const p = this.pressed(it.id) ? 1 : 0;
    const x = it.x;
    const y = it.y + p;
    drawWindow(r, x, y, it.w, it.h);
    if (focused) {
      r.ctx.globalAlpha = 0.18;
      r.rect(x + 2, y + 2, it.w - 4, it.h - 4, '#f8f8f8');
      r.ctx.globalAlpha = 1;
    }

    // Banner: a window onto the sector's own background, with the number over it.
    const bx = x + 4;
    const by = y + 4;
    const bh = it.h - 8;
    const bg = bannerFor(s.id);
    const ctx = r.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, BANNER_W, bh);
    ctx.clip();
    const view = bannerView(bg, bh);
    ctx.translate(bx + BANNER_W / 2 - view.cx, by);
    bg.draw(ctx, view.scroll, this.t, bh);
    ctx.restore();
    r.rect(bx, by, BANNER_W, 1, '#202838');
    if (!s.unlocked) {
      ctx.globalAlpha = 0.6;
      r.rect(bx, by, BANNER_W, bh, '#000000');
      ctx.globalAlpha = 1;
    }
    drawText(ctx, String(s.number), bx + BANNER_W / 2, by + 6, {
      align: 'center',
      scale: 2,
      color: s.unlocked ? WHITE_TEXT : DIM,
      shadowColor: '#100818',
    });
    if (!s.unlocked) r.sprite('ui_lock', bx + BANNER_W / 2 - 5, by + bh - 16);

    // Text rows sit centred in taller cards.
    const ty = y + Math.floor((it.h - CARD_H) / 2);
    const tx = bx + BANNER_W + 10;
    const right = x + it.w - 8;
    const nameColor = !s.unlocked ? DIM : focused ? GOLD : WHITE_TEXT;
    const fits = measure(s.name) <= right - tx;
    r.text(s.name, tx, ty + 8 + (fits ? 0 : 1), { color: nameColor, font: fits ? 'ui' : 'small' });
    if (focused) drawCursor(r, tx - 2, ty + 12, this.t);

    if (!s.unlocked) {
      // A locked act asks for the sector that opens it, on every card.
      const need = actLocked ? this.firstOfAct() - 1 : s.number - 1;
      r.text(`CLEAR SECTOR ${need}`, tx, ty + 22, { color: LOCK_RED });
      return;
    }

    r.text('BEST', tx, ty + 22, { color: DIM });
    r.text(s.best > 0 ? String(s.best) : '-----', tx + 30, ty + 22, {
      color: s.best > 0 ? WHITE_TEXT : DIM,
    });
    const cleared = s.clears > 0;
    const count = cleared ? `x${s.clears}` : '';
    const cw = measure(count);
    drawSpriteScaled(
      r,
      'ui_star',
      right - cw - 11,
      ty + 21,
      1,
      0,
      cleared ? undefined : UNCLEARED_STAR,
    );
    if (cleared) r.text(count, right, ty + 22, { align: 'right', color: GOLD });

    let tagX = tx;
    if (s.pod) tagX = drawTag(r, 'POD', tagX, ty + 36, OK_GREEN);
    if (s.schematic) drawTag(r, 'SCHEMATIC', tagX, ty + 36, BLUEPRINT);
    if (selected)
      r.text('SELECTED', right, ty + 37, { align: 'right', color: GOLD, font: 'small' });
  }

  /** Campaign number of this page's first sector. */
  private firstOfAct(): number {
    return this.infos.find((s) => s.id === this.act.levels[0])?.number ?? 1;
  }
}

/** A small outlined marker; returns the x for the next one. */
function drawTag(r: Renderer, label: string, x: number, y: number, color: string): number {
  const w = measure(label, 'small') + 6;
  r.rect(x, y, w, 11, color);
  r.rect(x + 1, y + 1, w - 2, 9, '#101838');
  r.text(label, x + 3, y + 3, { color, font: 'small', shadow: false });
  return x + w + 4;
}
