import { fadeTo } from '../audio';
import { PILOTS, SHIPS, UPGRADE_ORDER } from '../content';
import { flags } from '../debug/flags';
import { randomSeedString } from '../engine/rng';
import type { Renderer } from '../gfx/renderer';
import { drawWindow } from '../gfx/ui';
import '../game/hud';
import '../game/player';
import { canBuyUpgrade, getSave } from '../meta';
import {
  DIM,
  drawButton,
  drawHeader,
  drawPortrait,
  drawSalvage,
  drawSpriteScaled,
  GOLD,
  MenuScene,
  sfx,
  wrapText,
  type MenuItem,
} from '../ui';
import { flow } from './flow';

const LABELS: Readonly<Record<string, string>> = {
  launch: 'LAUNCH',
  pilot: 'PILOT',
  ship: 'SHIP',
  upgrades: 'UPGRADES',
  records: 'RECORDS',
  settings: 'SETTINGS',
};

/** The hub: current loadout, salvage, and the way into every other screen. */
export class HangarScene extends MenuScene {
  private top = 0;
  private cardY = 0;
  private focusOnEnter = 'launch';

  override enter(data?: unknown): void {
    if (typeof data === 'string') this.focusOnEnter = data;
    fadeTo('title', 1);
  }

  protected layout(w: number, h: number): void {
    // Content is ~280 px tall; centre it in whatever the buffer offers.
    this.top = Math.max(4, Math.floor((h - 284) / 2));
    this.cardY = this.top + 24;
    const bx = 30;
    const bw = w - 60;
    let y = this.cardY + 84;
    const items: MenuItem[] = [this.button('launch', bx - 6, y, bw + 12, 30)];
    y += 38;
    for (const id of ['pilot', 'ship', 'upgrades', 'records', 'settings']) {
      items.push(this.button(id, bx, y, bw, 22));
      y += 26;
    }
    this.menu.setItems(items, this.focusOnEnter);
  }

  protected activate(it: MenuItem): void {
    if (it.id === 'launch') {
      sfx('ui_confirm');
      const save = getSave();
      this.later(() =>
        flow.launch({
          shipId: save.selectedShip,
          pilotId: save.selectedPilot,
          levelId: 'kessler',
          seed: flags.seed ?? randomSeedString(),
        }),
      );
      return;
    }
    sfx('ui_confirm');
    this.later(() => {
      if (it.id === 'pilot') flow.pilots();
      else if (it.id === 'ship') flow.ships();
      else if (it.id === 'upgrades') flow.upgrades();
      else if (it.id === 'records') flow.records();
      else if (it.id === 'settings') flow.settings();
    });
  }

  protected override back(): void {
    sfx('ui_back');
    this.later(() => flow.title());
  }

  protected draw(r: Renderer): void {
    const save = getSave();
    const w = r.width;
    drawHeader(r, 'HANGAR', this.top);
    drawSalvage(r, save.salvage, w - 14, this.top + 5);

    // Loadout card: pilot portrait, pilot text, ship.
    const y = this.cardY;
    drawWindow(r, 6, y, w - 12, 76);
    drawWindow(r, 10, y + 6, 52, 64);
    drawPortrait(r, save.selectedPilot, 12, y + 10, 1);
    const pilot = PILOTS[save.selectedPilot];
    const ship = SHIPS[save.selectedShip];
    if (pilot) {
      r.text(pilot.name, 68, y + 9, { color: GOLD });
      const lines = wrapText(pilot.passiveText, 104);
      for (let i = 0; i < lines.length && i < 3; i++) {
        r.text(lines[i] as string, 68, y + 21 + i * 10, { color: DIM });
      }
    }
    if (ship) {
      drawSpriteScaled(r, ship.id, w - 38, y + 32, 2, Math.floor(this.t * 12) % 3);
      r.text(ship.name.toUpperCase(), w - 38, y + 60, { align: 'center' });
    }

    const canBuy = UPGRADE_ORDER.some((id) => canBuyUpgrade(save, id));
    for (const it of this.menu.items) {
      const focused = this.focused(it.id);
      const label = LABELS[it.id] ?? it.id;
      if (it.id === 'launch') {
        drawButton(r, it, label, {
          focused,
          pressed: this.pressed(it.id),
          t: this.t,
          color: GOLD,
        });
        continue;
      }
      let value: string | undefined;
      if (it.id === 'pilot' && pilot) value = pilot.name.toUpperCase();
      else if (it.id === 'ship' && ship) value = ship.name.toUpperCase();
      else if (it.id === 'upgrades' && canBuy) value = 'BUY!';
      drawButton(r, it, label, {
        focused,
        pressed: this.pressed(it.id),
        t: this.t,
        value,
        valueColor: it.id === 'upgrades' ? GOLD : DIM,
      });
    }
  }
}
