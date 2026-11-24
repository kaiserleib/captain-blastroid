import { isFreePack, PACKS, type PackDef, type PackId } from '../content';
import type { Renderer } from '../gfx/renderer';
import { drawWindow } from '../gfx/ui';
import '../game/player';
import { buyPack, canGetPacks, milestone, ownsPack, packPrice, restorePacks } from '../meta';
import {
  DIM,
  drawButton,
  drawHeader,
  drawSpriteScaled,
  GOLD,
  LOCK_RED,
  MenuScene,
  OK_GREEN,
  sfx,
  WHITE_TEXT,
  wrapText,
  type MenuItem,
} from '../ui';

export interface ExpansionData {
  pack: PackId;
  /** Where BACK goes: the screen that sent the player here. */
  back: () => void;
}

const CARD_H = 150;
const BUTTON_H = 24;

/**
 * The store page for a content pack: what's in it, then GET for a free pack, or the
 * store's price with buy and restore for a paid one.
 */
export class ExpansionScene extends MenuScene {
  private pack: PackDef = PACKS.act2;
  private leave: () => void = () => {};
  private top = 0;
  private price: string | null = null;
  /** Waiting on the store: input is ignored so a second tap can't start a second purchase. */
  private busy = false;
  private note = '';
  private noteColor = DIM;
  private alive = false;

  override enter(data?: unknown): void {
    const d = data as ExpansionData;
    this.pack = PACKS[d.pack];
    this.leave = d.back;
    this.alive = true;
    if (this.available && !this.owned) milestone(`offer_seen_${this.pack.id}`);
    if (this.available && !this.free && !this.owned) {
      void packPrice(this.pack.id).then((p) => {
        this.price = p;
      });
    }
  }

  override exit(): void {
    this.alive = false;
  }

  private get owned(): boolean {
    return ownsPack(this.pack.id);
  }

  private get free(): boolean {
    return isFreePack(this.pack.id);
  }

  /** Can be bought or claimed on this build (never on the web). */
  private get available(): boolean {
    return canGetPacks();
  }

  private get buttons(): string[] {
    if (!this.available || this.owned) return ['back'];
    // A free pack is claimed on the device: there is no store purchase to restore.
    return this.free ? ['buy', 'back'] : ['buy', 'restore', 'back'];
  }

  protected layout(w: number, h: number): void {
    const ids = this.buttons;
    const total = 22 + CARD_H + 8 + ids.length * (BUTTON_H + 4) - 4;
    this.top = Math.max(4, Math.floor((h - total) / 2));
    let y = this.top + 22 + CARD_H + 8;
    const items: MenuItem[] = [];
    for (const id of ids) {
      items.push(this.button(id, 30, y, w - 60, BUTTON_H));
      y += BUTTON_H + 4;
    }
    this.menu.setItems(items, ids[0]);
  }

  override onUi(e: Parameters<MenuScene['onUi']>[0]): void {
    if (!this.busy) super.onUi(e);
  }

  override onPointer(e: Parameters<MenuScene['onPointer']>[0]): void {
    if (!this.busy) super.onPointer(e);
  }

  protected activate(it: MenuItem): void {
    if (it.id === 'back') {
      this.back();
      return;
    }
    sfx('ui_confirm');
    this.busy = true;
    if (!(it.id === 'buy' && this.free)) this.say('CONTACTING STORE...', DIM);
    const work = it.id === 'buy' ? this.buy() : this.restore();
    void work.finally(() => {
      this.busy = false;
      if (this.alive) this.relayout();
    });
  }

  private async buy(): Promise<void> {
    const outcome = await buyPack(this.pack.id);
    if (outcome === 'purchased') this.unlocked();
    else if (outcome === 'pending') this.say('WAITING FOR APPROVAL', GOLD);
    else if (outcome === 'cancelled') this.say('', DIM);
    else this.say('PURCHASE FAILED. TRY AGAIN.', LOCK_RED);
  }

  private async restore(): Promise<void> {
    const outcome = await restorePacks();
    if (this.owned) this.unlocked();
    else if (outcome === 'failed') this.say('COULD NOT REACH THE STORE', LOCK_RED);
    else this.say('NOTHING TO RESTORE', DIM);
  }

  private unlocked(): void {
    this.say('UNLOCKED. GOOD HUNTING!', OK_GREEN);
    if (this.alive) sfx('weapon_up');
  }

  private say(text: string, color: string): void {
    this.note = text;
    this.noteColor = color;
  }

  protected override back(): void {
    sfx('ui_back');
    this.later(this.leave);
  }

  protected draw(r: Renderer): void {
    const w = r.width;
    const pack = this.pack;
    drawHeader(r, 'EXPANSION', this.top);
    const y = this.top + 22;
    drawWindow(r, 6, y, w - 12, CARD_H);
    r.text(pack.name, w / 2, y + 10, { align: 'center', color: GOLD });

    // The pack's ships on parade.
    const n = pack.ships.length;
    const step = Math.min(40, Math.floor((w - 40) / Math.max(1, n)));
    const x0 = w / 2 - ((n - 1) * step) / 2;
    r.rect(12, y + 26, w - 24, 40, '#081030');
    for (let i = 0; i < n; i++) {
      const bob = Math.round(Math.sin(this.t * 2 + i) * 2);
      drawSpriteScaled(
        r,
        pack.ships[i] as string,
        x0 + i * step,
        y + 46 + bob,
        1,
        Math.floor(this.t * 12) % 3,
      );
    }

    let ty = y + 76;
    for (const line of pack.blurb) {
      r.text(line, w / 2, ty, { align: 'center', color: WHITE_TEXT });
      ty += 11;
    }

    ty = y + CARD_H - 22;
    if (this.owned) {
      r.text(this.note || 'OWNED', w / 2, ty + 5, { align: 'center', color: OK_GREEN });
    } else if (!this.available) {
      const lines = wrapText('AVAILABLE IN THE IOS AND ANDROID APP', w - 40);
      for (let i = 0; i < lines.length && i < 2; i++)
        r.text(lines[i] as string, w / 2, ty + i * 10, { align: 'center', color: DIM });
    } else if (this.note) {
      r.text(this.note, w / 2, ty + 5, { align: 'center', color: this.noteColor });
    }

    for (const it of this.menu.items) {
      const opts = {
        focused: this.focused(it.id),
        pressed: this.pressed(it.id),
        t: this.t,
        disabled: this.busy,
      };
      if (it.id === 'buy') {
        const label = this.free ? 'GET  FREE' : this.price ? `BUY  ${this.price}` : 'BUY';
        drawButton(r, it, label, { ...opts, color: this.busy ? undefined : GOLD });
      } else if (it.id === 'restore') {
        drawButton(r, it, 'RESTORE PURCHASE', opts);
      } else {
        drawButton(r, it, 'BACK', { ...opts, disabled: false });
      }
    }
  }
}
