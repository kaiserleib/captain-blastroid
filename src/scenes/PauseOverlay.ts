import { resumeAudio, suspendAudio } from '../audio';
import type { Renderer } from '../gfx/renderer';
import { drawWindow } from '../gfx/ui';
import { DIM, dim, drawButton, GOLD, MenuScene, sfx, type MenuItem } from '../ui';
import { flow } from './flow';
import type { GameScene } from './GameScene';

const LABELS: Readonly<Record<string, string>> = {
  resume: 'RESUME',
  settings: 'SETTINGS',
  abandon: 'ABANDON RUN',
  yes: 'YES, ABANDON',
  no: 'KEEP FLYING',
};

/** Over a frozen GameScene: resume, settings, or abandon (which still banks the salvage). */
export class PauseOverlay extends MenuScene {
  private game: GameScene | null = null;
  private confirming = false;
  private boxY = 0;
  private closing = false;
  private returnFocus = 'resume';

  constructor() {
    super();
    this.drawsBackdrop = false;
  }

  override enter(data?: unknown): void {
    this.game = (data as GameScene | undefined) ?? null;
    // Freezes the audio clock, so music resumes exactly where it stopped.
    suspendAudio();
  }

  protected layout(w: number, h: number): void {
    this.boxY = Math.floor(h / 2 - 66);
    const ids = this.confirming ? ['yes', 'no'] : ['resume', 'settings', 'abandon'];
    const keep = this.menu.focused?.id;
    const y0 = this.boxY + (this.confirming ? 52 : 30);
    this.menu.setItems(
      ids.map((id, i) => this.button(id, 44, y0 + i * 30, w - 88, 24)),
      keep && ids.includes(keep) ? keep : this.confirming ? 'no' : this.returnFocus,
    );
  }

  protected activate(it: MenuItem): void {
    if (this.closing) return;
    sfx('ui_confirm');
    switch (it.id) {
      case 'resume':
        this.resume();
        break;
      case 'settings':
        this.later(() => flow.settings());
        break;
      case 'abandon':
        this.confirming = true;
        this.relayout();
        break;
      case 'yes':
        this.abandon();
        break;
      case 'no':
        this.confirming = false;
        this.relayout();
        this.returnFocus = 'abandon';
        break;
    }
  }

  protected override back(): void {
    if (this.confirming) {
      sfx('ui_back');
      this.confirming = false;
      this.returnFocus = 'abandon';
      this.relayout();
      return;
    }
    this.resume();
  }

  private resume(): void {
    if (this.closing) return;
    this.closing = true;
    this.later(() => {
      resumeAudio();
      flow.closeOverlay();
    });
  }

  private abandon(): void {
    const game = this.game;
    if (!game || this.closing) return;
    this.closing = true;
    this.later(() => {
      resumeAudio();
      flow.results({ run: game.world.run, time: game.world.time, victory: false, abandoned: true });
    });
  }

  protected draw(r: Renderer): void {
    dim(r, 0.55);
    const w = r.width;
    const y = this.boxY;
    if (this.confirming) {
      drawWindow(r, 30, y, w - 60, 120);
      r.text('ABANDON RUN?', w / 2, y + 10, { align: 'center', color: GOLD });
      r.text('Salvage collected so far', w / 2, y + 24, { align: 'center', color: DIM });
      r.text('is still banked.', w / 2, y + 34, { align: 'center', color: DIM });
    } else {
      drawWindow(r, 30, y, w - 60, 130);
      r.text('PAUSED', w / 2, y + 10, { align: 'center', color: GOLD });
    }
    for (const it of this.menu.items) {
      drawButton(r, it, LABELS[it.id] ?? it.id, {
        focused: this.focused(it.id),
        pressed: this.pressed(it.id),
        t: this.t,
      });
    }
  }
}
