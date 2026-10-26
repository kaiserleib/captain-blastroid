import type { Renderer } from '../gfx/renderer';
import { drawWindow } from '../gfx/ui';
import { getSettings, updateSettings, type Settings } from '../meta';
import { platform } from '../platform';
import {
  cycleShake,
  dim,
  drawButton,
  SLIDERS,
  snapSetting,
  type SliderDef,
  drawSliderRow,
  GOLD,
  OK_GREEN,
  MenuScene,
  openSaveExport,
  openSaveImport,
  sfx,
  sliderRect,
  type MenuItem,
} from '../ui';
import { flow } from './flow';

/** Every change is written immediately (`updateSettings`); main.ts applies volumes on save change. */
export class SettingsOverlay extends MenuScene {
  private boxY = 0;
  private closing = false;
  private dragging = false;
  private transfer = false;
  /** The DOM export/import panel is up; the canvas menu waits. */
  private panelOpen = false;
  private note = '';

  constructor() {
    super();
    this.drawsBackdrop = false;
  }

  override enter(data?: unknown): void {
    this.transfer = !!(data as { transfer?: boolean } | undefined)?.transfer;
  }

  override onUi(e: Parameters<MenuScene['onUi']>[0]): void {
    if (!this.panelOpen) super.onUi(e);
  }

  protected layout(w: number, h: number): void {
    const rows = SLIDERS.length + 2 + (this.transfer ? 1 : 0);
    const boxH = 24 + rows * 26 + 32;
    this.boxY = Math.max(2, Math.floor((h - boxH) / 2));
    let y = this.boxY + 22;
    const items: MenuItem[] = [];
    const add = (id: string, kind: 'slider' | 'adjustable'): void => {
      const it = this.button(id, 14, y, w - 28, 22);
      if (kind === 'slider') it.slider = true;
      else it.adjustable = true;
      items.push(it);
      y += 26;
    };
    add('music', 'slider');
    add('sfx', 'slider');
    add('haptics', 'adjustable');
    add('shake', 'adjustable');
    add('stickOpacity', 'slider');
    add('stickRadiusScale', 'slider');
    if (this.transfer) {
      const bw = Math.floor((w - 28 - 6) / 2);
      items.push(this.button('export', 14, y, bw, 22));
      items.push(this.button('import', w - 14 - bw, y, bw, 22));
      y += 26;
    }
    items.push(this.button('done', 50, y + 6, w - 100, 22));
    this.menu.setItems(items);
  }

  private set(patch: Partial<Settings>): void {
    updateSettings(patch);
  }

  private setSlider(def: SliderDef, v: number): void {
    const next = snapSetting(def, v);
    if (next === getSettings()[def.key]) return;
    this.set({ [def.key]: next });
    // SFX gets an audible preview at the new level; music is already audible.
    sfx('ui_move');
  }

  protected override adjust(it: MenuItem, dx: number): void {
    const def = SLIDERS.find((d) => d.key === it.id);
    if (def) {
      this.setSlider(def, getSettings()[def.key] + dx * def.step);
      return;
    }
    this.toggle(it.id, dx);
  }

  protected override drag(it: MenuItem, x: number, first: boolean): void {
    const def = SLIDERS.find((d) => d.key === it.id);
    if (!def) return;
    const s = sliderRect(it);
    const k = (x - s.x) / s.w;
    if (first) {
      // A press on the bar grabs it; left of it (the label) steps down, right of it steps up.
      this.dragging = k >= -0.1 && k <= 1.1;
      if (!this.dragging) {
        this.setSlider(def, getSettings()[def.key] + (k < 0 ? -def.step : def.step));
        return;
      }
    }
    if (this.dragging)
      this.setSlider(def, def.min + Math.min(1, Math.max(0, k)) * (def.max - def.min));
  }

  private toggle(id: string, dx: number): void {
    const s = getSettings();
    if (id === 'haptics') {
      const on = !s.haptics;
      this.set({ haptics: on });
      if (on) platform.haptics.impact('light');
      sfx('ui_confirm');
    } else if (id === 'shake') {
      this.set({ screenShake: cycleShake(s.screenShake, dx) });
      sfx('ui_confirm');
    }
  }

  protected activate(it: MenuItem): void {
    if (it.id === 'done') {
      this.back();
      return;
    }
    if (it.id === 'export' || it.id === 'import') {
      sfx('ui_confirm');
      this.panelOpen = true;
      this.note = '';
      const done = (imported = false): void => {
        this.panelOpen = false;
        if (imported) this.note = 'SAVE IMPORTED';
      };
      if (it.id === 'export') openSaveExport(done);
      else openSaveImport(done);
      return;
    }
    if (it.id === 'haptics' || it.id === 'shake') this.toggle(it.id, 1);
  }

  protected override back(): void {
    if (this.closing) return;
    this.closing = true;
    sfx('ui_back');
    this.later(() => flow.closeOverlay());
  }

  protected draw(r: Renderer): void {
    dim(r, 0.6);
    const s = getSettings();
    const w = r.width;
    const last = this.menu.items[this.menu.items.length - 1];
    const boxH = last ? last.y + last.h + 8 - this.boxY : 200;
    drawWindow(r, 6, this.boxY, w - 12, boxH);
    r.text(this.note || 'SETTINGS', w / 2, this.boxY + 8, {
      align: 'center',
      color: this.note ? OK_GREEN : GOLD,
    });
    for (const it of this.menu.items) {
      const o = { focused: this.focused(it.id), pressed: this.pressed(it.id), t: this.t };
      const def = SLIDERS.find((d) => d.key === it.id);
      if (def) {
        const v = s[def.key];
        drawSliderRow(
          r,
          it,
          def.label,
          (v - def.min) / (def.max - def.min),
          `${Math.round(v * 100)}%`,
          o,
        );
      } else if (it.id === 'haptics') {
        drawButton(r, it, 'HAPTICS', { ...o, value: s.haptics ? 'ON' : 'OFF' });
      } else if (it.id === 'shake') {
        drawButton(r, it, 'SCREEN SHAKE', { ...o, value: s.screenShake.toUpperCase() });
      } else if (it.id === 'export') {
        drawButton(r, it, 'EXPORT SAVE', o);
      } else if (it.id === 'import') {
        drawButton(r, it, 'IMPORT SAVE', o);
      } else {
        drawButton(r, it, 'DONE', o);
      }
    }
  }
}
