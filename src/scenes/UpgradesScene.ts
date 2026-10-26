import { UPGRADES, UPGRADE_ORDER } from '../content';
import { measure } from '../gfx/font';
import type { Renderer } from '../gfx/renderer';
import { drawWindow } from '../gfx/ui';
import '../game/hud';
import {
  buyUpgrade,
  canBuyUpgrade,
  getSave,
  missingRequirement,
  nextUpgradeCost,
  setSave,
  upgradeLevel,
} from '../meta';
import {
  DIM,
  drawButton,
  drawHeader,
  drawSalvage,
  GOLD,
  LOCK_RED,
  MenuScene,
  OK_GREEN,
  sfx,
  type MenuItem,
} from '../ui';
import { flow } from './flow';

const ROW_H = 40;

/** Permanent hangar upgrades bought with salvage. */
export class UpgradesScene extends MenuScene {
  private top = 0;
  private flashId = '';
  private flashT = 0;
  private denyT = 0;

  protected layout(w: number, h: number): void {
    const total = 22 + UPGRADE_ORDER.length * (ROW_H + 4) + 30;
    this.top = Math.max(2, Math.floor((h - total) / 2));
    let y = this.top + 22;
    const items: MenuItem[] = [];
    for (const id of UPGRADE_ORDER) {
      items.push(this.button(id, 6, y, w - 12, ROW_H));
      y += ROW_H + 4;
    }
    items.push(this.button('done', 50, y + 4, w - 100, 22));
    this.menu.setItems(items);
  }

  protected override tick(dt: number): void {
    this.flashT = Math.max(0, this.flashT - dt);
    this.denyT = Math.max(0, this.denyT - dt);
  }

  protected activate(it: MenuItem): void {
    if (it.id === 'done') {
      this.back();
      return;
    }
    const save = getSave();
    if (!canBuyUpgrade(save, it.id)) {
      sfx('ui_back');
      this.flashId = it.id;
      this.denyT = 0.3;
      return;
    }
    setSave(buyUpgrade(save, it.id));
    sfx('weapon_up');
    this.flashId = it.id;
    this.flashT = 0.35;
  }

  protected override back(): void {
    sfx('ui_back');
    this.later(() => flow.hangar('upgrades'));
  }

  protected draw(r: Renderer): void {
    const save = getSave();
    const w = r.width;
    drawHeader(r, 'UPGRADES', this.top);
    drawSalvage(r, save.salvage, w - 14, this.top + 5);

    for (const it of this.menu.items) {
      const focused = this.focused(it.id);
      if (it.id === 'done') {
        drawButton(r, it, 'DONE', { focused, pressed: this.pressed(it.id), t: this.t });
        continue;
      }
      const def = UPGRADES[it.id];
      if (!def) continue;
      const p = this.pressed(it.id) ? 1 : 0;
      const shake =
        this.flashId === it.id && this.denyT > 0 ? (Math.floor(this.denyT * 40) % 2) * 2 - 1 : 0;
      const x = it.x + shake;
      const y = it.y + p;
      drawWindow(r, x, y, it.w, it.h);
      if (focused) {
        r.ctx.globalAlpha = 0.18;
        r.rect(x + 2, y + 2, it.w - 4, it.h - 4, '#f8f8f8');
        r.ctx.globalAlpha = 1;
        r.sprite('ui_cursor', x + 8, y + 10);
      }
      if (this.flashId === it.id && this.flashT > 0) {
        r.ctx.globalAlpha = Math.min(1, this.flashT * 3);
        r.rect(x + 2, y + 2, it.w - 4, it.h - 4, '#f8f8f8');
        r.ctx.globalAlpha = 1;
      }
      const lvl = upgradeLevel(save, it.id);
      const cost = nextUpgradeCost(save, it.id);
      r.text(def.name, x + 14, y + 6, { color: focused ? GOLD : '#f8f8f8' });
      const req = missingRequirement(save, it.id);
      if (req) {
        const name = UPGRADES[req]?.name ?? req;
        r.text(`REQUIRES ${name.toUpperCase()}`, x + 14, y + 18, { color: LOCK_RED });
      } else {
        r.text(def.description, x + 14, y + 18, { color: DIM });
      }
      // Level pips.
      for (let i = 0; i < def.maxLevel; i++) {
        const px = x + 14 + i * 9;
        r.rect(px, y + 30, 7, 5, '#100818');
        r.rect(px + 1, y + 31, 5, 3, i < lvl ? GOLD : '#283050');
      }
      if (cost === null) {
        r.text('MAX', x + it.w - 10, y + 27, { align: 'right', color: OK_GREEN });
      } else {
        const afford = save.salvage >= cost;
        const s = String(cost);
        const color = req ? DIM : afford ? GOLD : LOCK_RED;
        r.text(s, x + it.w - 10, y + 27, { align: 'right', color });
        r.sprite('hud_scrap', x + it.w - 20 - measure(s), y + 26);
      }
    }
  }
}
