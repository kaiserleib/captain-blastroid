import { SHIPS, SHIP_ORDER, WEAPONS, type ShipDef, type WeaponId } from '../content';
import type { Renderer } from '../gfx/renderer';
import { drawBar, drawWindow } from '../gfx/ui';
import '../game/hud';
import '../game/player';
import '../game/weapons';
import {
  buildShip,
  canBuildShip,
  getSave,
  selectShip,
  setSave,
  shipStatus,
  type ShipStatus,
} from '../meta';
import {
  DIM,
  drawButton,
  drawHeader,
  drawSalvage,
  drawSpriteScaled,
  GOLD,
  LOCK_RED,
  MenuScene,
  OK_GREEN,
  sfx,
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
  schematicSector,
} from './rosterStrip';

// Bar maxima: the best value any ship has.
const MAX_SHIELD = 5;
const MAX_SPEED = 150;
const MAX_SLOTS = 5;

const CARD_H = 184;
const THUMB_W = 52;
const THUMB_H = 34;
const THUMB_GAP = 6;
const NAV_H = 20;
// Header 18 + card + strip + page row + action 24 + done 22, with gaps.
const TOTAL = 22 + CARD_H + 6 + THUMB_H + 4 + NAV_H + 6 + 24 + 4 + 22;

const UNKNOWN_TINT = '#283468';
const SCHEMATIC_TINT = '#4880d8';

/** The shown ship large with its stats, the hangar below as a paged strip; builds from schematics. */
export class ShipSelectScene extends MenuScene {
  private index = 0;
  private page = 0;
  private top = 0;
  private navY = 0;
  private flashT = 0;
  private entering = true;

  override enter(): void {
    this.index = Math.max(0, SHIP_ORDER.indexOf(getSave().selectedShip));
    this.page = pageOf(this.index);
    this.entering = true;
    this.relayout();
  }

  private get ship(): ShipDef {
    return SHIPS[SHIP_ORDER[this.index] as string] as ShipDef;
  }

  protected layout(w: number, h: number): void {
    this.top = Math.max(2, Math.floor((h - TOTAL) / 2));
    const stripY = this.top + 22 + CARD_H + 6;
    const stripW = PER_PAGE * THUMB_W + (PER_PAGE - 1) * THUMB_GAP;
    const sx = Math.floor((w - stripW) / 2);
    const items: MenuItem[] = [];
    const first = this.page * PER_PAGE;
    for (let i = 0; i < PER_PAGE; i++) {
      const id = SHIP_ORDER[first + i];
      if (id) items.push(this.button(id, sx + i * (THUMB_W + THUMB_GAP), stripY, THUMB_W, THUMB_H));
    }
    this.navY = stripY + THUMB_H + 4;
    items.push(this.button('prev', sx, this.navY, 36, NAV_H));
    items.push(this.button('next', sx + stripW - 36, this.navY, 36, NAV_H));
    const ay = this.navY + NAV_H + 6;
    items.push(this.button('action', 40, ay, w - 80, 24));
    items.push(this.button('done', 50, ay + 28, w - 100, 22));
    this.menu.setItems(items, this.entering ? 'action' : undefined);
    this.entering = false;
  }

  protected override tick(dt: number): void {
    this.flashT = Math.max(0, this.flashT - dt);
  }

  protected override nav(dx: number, dy: number): void {
    // Left/right walk the hangar from anywhere but the page arrows; up/down move between rows.
    const f = this.menu.focused?.id;
    if (dx !== 0 && dy === 0 && f !== 'prev' && f !== 'next') {
      this.cycle(dx);
      return;
    }
    super.nav(dx, dy);
  }

  private cycle(dx: number): void {
    const n = SHIP_ORDER.length;
    this.show((this.index + dx + n) % n);
    sfx('ui_move');
  }

  /** Shows ship `i`, turning the strip to its page; a focused thumb follows. */
  private show(i: number): void {
    const onStrip = (this.menu.focused?.id ?? '') in SHIPS;
    this.index = i;
    const page = pageOf(i);
    if (page !== this.page) {
      this.page = page;
      this.layout(this.width, this.height);
    }
    if (onStrip) this.menu.focusId(SHIP_ORDER[i] as string);
  }

  private turn(dir: -1 | 1): void {
    const page = this.page + dir;
    if (page < 0 || page >= pageCount(SHIP_ORDER.length)) {
      sfx('ui_back');
      return;
    }
    sfx('ui_move');
    const focus = this.menu.focused?.id;
    this.page = page;
    this.index = page * PER_PAGE;
    this.layout(this.width, this.height);
    if (focus) this.menu.focusId(focus);
  }

  protected activate(it: MenuItem): void {
    if (it.id === 'prev' || it.id === 'next') {
      this.turn(it.id === 'prev' ? -1 : 1);
      return;
    }
    if (it.id === 'done') {
      this.back();
      return;
    }
    if (it.id in SHIPS) {
      const i = SHIP_ORDER.indexOf(it.id);
      if (i !== this.index) {
        this.index = i;
        sfx('ui_move');
        return;
      }
      // A second tap on the shown ship acts as the action button.
    }
    const save = getSave();
    const ship = this.ship;
    const status = shipStatus(save, ship.id);
    if (status === 'built') {
      if (save.selectedShip === ship.id) {
        sfx('ui_confirm');
        this.later(() => flow.hangar('ship'));
        return;
      }
      setSave(selectShip(save, ship.id));
      sfx('ui_confirm');
      this.flashT = 0.2;
    } else if (status === 'buildable' && canBuildShip(save, ship.id)) {
      // Building a ship also puts it on the launch pad.
      setSave(selectShip(buildShip(save, ship.id), ship.id));
      sfx('weapon_up');
      this.flashT = 0.5;
    } else {
      sfx('ui_back');
    }
  }

  protected override back(): void {
    sfx('ui_back');
    this.later(() => flow.hangar('ship'));
  }

  protected draw(r: Renderer): void {
    const save = getSave();
    const ship = this.ship;
    const status = shipStatus(save, ship.id);
    const w = r.width;
    drawHeader(r, 'SELECT SHIP', this.top);
    drawSalvage(r, save.salvage, w - 14, this.top + 5);

    const cy = this.top + 22;
    drawWindow(r, 6, cy, w - 12, CARD_H);
    // Display bay behind the ship.
    const bayH = 72;
    r.rect(46, cy + 8, w - 92, bayH, '#081030');
    for (let gy = cy + 16; gy < cy + 8 + bayH; gy += 12) r.rect(48, gy, w - 96, 1, '#102050');
    const known = status !== 'unknown';
    const bob = Math.round(Math.sin(this.t * 2) * 2);
    drawSpriteScaled(
      r,
      ship.id,
      w / 2,
      cy + 40 + bob,
      2,
      Math.floor(this.t * 12) % 3,
      status === 'built' ? undefined : status === 'unknown' ? UNKNOWN_TINT : SCHEMATIC_TINT,
    );
    if (this.flashT > 0) {
      r.ctx.globalAlpha = Math.min(1, this.flashT * 3);
      r.rect(46, cy + 8, w - 92, bayH, '#f8f8f8');
      r.ctx.globalAlpha = 1;
    }
    if (status === 'schematic' || status === 'buildable') {
      r.text('SCHEMATIC', w / 2, cy + bayH - 4, { align: 'center', color: '#78d8f8' });
    }

    r.text(known ? ship.name.toUpperCase() : '? ? ?', w / 2, cy + 86, {
      align: 'center',
      color: GOLD,
    });
    r.text(`${this.index + 1}/${SHIP_ORDER.length}`, w - 14, cy + 86, {
      align: 'right',
      color: DIM,
    });
    r.text(statusLine(status, ship, save.selectedShip === ship.id), w / 2, cy + 98, {
      align: 'center',
      color: statusColor(status),
    });

    const sx = 16;
    let y = cy + 114;
    this.stat(r, 'SHIELD', sx, y, ship.shield, MAX_SHIELD, String(ship.shield), known);
    y += 13;
    this.stat(r, 'SPEED', sx, y, ship.speed, MAX_SPEED, String(ship.speed), known);
    y += 13;
    this.stat(r, 'SLOTS', sx, y, ship.weaponSlots, MAX_SLOTS, String(ship.weaponSlots), known);
    y += 16;
    r.text('START', sx, y, { color: DIM });
    if (!known) {
      r.text('???', sx + 58, y, { color: DIM });
    } else {
      let wy = y;
      for (const sw of ship.startingWeapons) {
        const def = WEAPONS[sw.weaponId as WeaponId];
        if (def) {
          r.sprite(def.icon, sx + 64, wy + 3);
          r.text(def.name, sx + 74, wy, {});
          r.text(`L${sw.level}`, w - 16, wy, { align: 'right', color: DIM });
        }
        wy += 14;
      }
    }

    this.drawStrip(r);

    const action = this.menu.items.find((i) => i.id === 'action');
    if (action) {
      const a = actionLabel(status, ship, save.selectedShip === ship.id);
      drawButton(r, action, a.label, {
        focused: this.focused('action'),
        pressed: this.pressed('action'),
        t: this.t,
        disabled: a.disabled,
        color: a.disabled ? undefined : a.color,
      });
    }
    const done = this.menu.items.find((i) => i.id === 'done');
    if (done)
      drawButton(r, done, 'DONE', {
        focused: this.focused('done'),
        pressed: this.pressed('done'),
        t: this.t,
      });
  }

  private drawStrip(r: Renderer): void {
    const save = getSave();
    const pages = pageCount(SHIP_ORDER.length);
    const shown = SHIP_ORDER[this.index];
    for (const it of this.menu.items) {
      const focused = this.focused(it.id);
      const pressed = this.pressed(it.id);
      if (it.id === 'prev' || it.id === 'next') {
        const dir = it.id === 'prev' ? -1 : 1;
        const enabled = dir < 0 ? this.page > 0 : this.page < pages - 1;
        drawArrowButton(r, it, dir, { focused, pressed, enabled });
        continue;
      }
      if (!(it.id in SHIPS)) continue;
      const p = pressed ? 1 : 0;
      const status = shipStatus(save, it.id);
      drawWindow(r, it.x, it.y + p, it.w, it.h);
      drawSpriteScaled(
        r,
        it.id,
        it.x + it.w / 2,
        it.y + it.h / 2 - 1 + p,
        1,
        0,
        status === 'built' ? undefined : status === 'unknown' ? UNKNOWN_TINT : SCHEMATIC_TINT,
      );
      if (save.selectedShip === it.id) {
        outline(r, it.x - 1, it.y - 1 + p, it.w + 2, it.h + 2, GOLD);
        outline(r, it.x - 2, it.y - 2 + p, it.w + 4, it.h + 4, '#100818');
      }
      if (it.id === shown && !focused) {
        r.rect(it.x + 4, it.y + it.h - 4 + p, it.w - 8, 1, '#f8f8f8');
      }
      if (focused) corners(r, it.x - 3, it.y - 3 + p, it.w + 6, it.h + 6, '#f8f8f8', this.t);
    }
    drawPageDots(r, r.width / 2, this.navY + NAV_H / 2, this.page, pages);
  }

  private stat(
    r: Renderer,
    label: string,
    x: number,
    y: number,
    v: number,
    max: number,
    text: string,
    known: boolean,
  ): void {
    r.text(label, x, y, { color: DIM });
    if (!known) {
      r.text('???', x + 58, y, { color: DIM });
      return;
    }
    if (label === 'SLOTS') {
      for (let i = 0; i < max; i++)
        r.sprite(i < v ? 'hud_slot' : 'hud_slot_empty', x + 64 + i * 14, y + 3);
    } else {
      drawBar(r, x + 58, y + 1, 112, 7, v, max);
    }
    r.text(text, r.width - 16, y, { align: 'right' });
  }
}

function statusLine(s: ShipStatus, ship: ShipDef, selected: boolean): string {
  if (s === 'built') return selected ? 'ON THE LAUNCH PAD' : 'IN THE HANGAR';
  if (s === 'unknown') return `SCHEMATIC: ${schematicSector(ship.id)}`;
  const cost = ship.unlock.kind === 'schematic' ? ship.unlock.cost : 0;
  return s === 'buildable' ? `READY TO BUILD: ${cost}` : `NEED ${cost} SALVAGE`;
}

function statusColor(s: ShipStatus): string {
  if (s === 'built') return OK_GREEN;
  if (s === 'buildable') return GOLD;
  return LOCK_RED;
}

function actionLabel(
  s: ShipStatus,
  ship: ShipDef,
  selected: boolean,
): { label: string; disabled: boolean; color?: string } {
  const cost = ship.unlock.kind === 'schematic' ? ship.unlock.cost : 0;
  if (s === 'built')
    return selected
      ? { label: 'SELECTED', disabled: false, color: OK_GREEN }
      : { label: 'SELECT', disabled: false };
  if (s === 'buildable') return { label: `BUILD  ${cost}`, disabled: false, color: GOLD };
  if (s === 'schematic') return { label: `BUILD  ${cost}`, disabled: true };
  return { label: 'LOCKED', disabled: true };
}
