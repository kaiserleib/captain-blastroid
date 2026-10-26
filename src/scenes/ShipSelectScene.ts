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

// Bar maxima: the best value any MVP ship has.
const MAX_SHIELD = 5;
const MAX_SPEED = 150;
const MAX_SLOTS = 5;

/** Carousel of ships with stats; build ships from owned schematics. */
export class ShipSelectScene extends MenuScene {
  private index = 0;
  private top = 0;
  private flashT = 0;

  override enter(): void {
    this.index = Math.max(0, SHIP_ORDER.indexOf(getSave().selectedShip));
  }

  private get ship(): ShipDef {
    return SHIPS[SHIP_ORDER[this.index] as string] as ShipDef;
  }

  protected layout(w: number, h: number): void {
    // Header 18 + card 218 + action 26 + done 22 + gaps ≈ 300.
    this.top = Math.max(2, Math.floor((h - 304) / 2));
    const cy = this.top + 22;
    this.menu.setItems(
      [
        this.button('prev', 10, cy + 30, 30, 40),
        this.button('next', w - 40, cy + 30, 30, 40),
        this.button('action', 40, cy + 226, w - 80, 24),
        this.button('done', 50, cy + 256, w - 100, 22),
      ],
      this.menu.focused?.id ?? 'action',
    );
  }

  protected override tick(dt: number): void {
    this.flashT = Math.max(0, this.flashT - dt);
  }

  protected override nav(dx: number, dy: number): void {
    // Left/right always turn the carousel; up/down move between the buttons.
    if (dx !== 0 && dy === 0) {
      this.cycle(dx);
      return;
    }
    super.nav(dx, dy);
  }

  private cycle(dx: number): void {
    const n = SHIP_ORDER.length;
    this.index = (this.index + dx + n) % n;
    sfx('ui_move');
  }

  protected activate(it: MenuItem): void {
    if (it.id === 'prev' || it.id === 'next') {
      this.cycle(it.id === 'prev' ? -1 : 1);
      return;
    }
    if (it.id === 'done') {
      this.back();
      return;
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
    drawWindow(r, 6, cy, w - 12, 218);
    // Display bay behind the ship.
    r.rect(46, cy + 8, w - 92, 84, '#081030');
    for (let gy = cy + 16; gy < cy + 92; gy += 12) r.rect(48, gy, w - 96, 1, '#102050');
    const known = status !== 'unknown';
    const bob = Math.round(Math.sin(this.t * 2) * 2);
    drawSpriteScaled(
      r,
      ship.id,
      w / 2,
      cy + 46 + bob,
      2,
      Math.floor(this.t * 12) % 3,
      known && status === 'built' ? undefined : status === 'unknown' ? '#283468' : '#4880d8',
    );
    if (this.flashT > 0) {
      r.ctx.globalAlpha = Math.min(1, this.flashT * 3);
      r.rect(46, cy + 8, w - 92, 84, '#f8f8f8');
      r.ctx.globalAlpha = 1;
    }
    if (status === 'schematic' || status === 'buildable') {
      r.text('SCHEMATIC', w / 2, cy + 80, { align: 'center', color: '#78d8f8' });
    }

    for (const id of ['prev', 'next']) {
      const it = this.menu.items.find((i) => i.id === id);
      if (!it) continue;
      const f = this.focused(id);
      const p = this.pressed(id) ? 1 : 0;
      drawWindow(r, it.x, it.y + p, it.w, it.h);
      r.text(id === 'prev' ? '←' : '→', it.x + it.w / 2, it.y + 16 + p, {
        align: 'center',
        color: f ? GOLD : '#f8f8f8',
      });
    }

    r.text(known ? ship.name.toUpperCase() : '? ? ?', w / 2, cy + 98, {
      align: 'center',
      color: GOLD,
    });
    r.text(`${this.index + 1}/${SHIP_ORDER.length}`, w - 14, cy + 98, {
      align: 'right',
      color: DIM,
    });
    r.text(statusLine(status, ship, save.selectedShip === ship.id), w / 2, cy + 110, {
      align: 'center',
      color: statusColor(status),
    });

    const sx = 16;
    let y = cy + 126;
    this.stat(r, 'SHIELD', sx, y, ship.shield, MAX_SHIELD, String(ship.shield), known);
    y += 14;
    this.stat(r, 'SPEED', sx, y, ship.speed, MAX_SPEED, String(ship.speed), known);
    y += 14;
    this.stat(r, 'SLOTS', sx, y, ship.weaponSlots, MAX_SLOTS, String(ship.weaponSlots), known);
    y += 18;
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
        }
        wy += 14;
      }
    }

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
  if (s === 'unknown') return 'SCHEMATIC NOT FOUND';
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
