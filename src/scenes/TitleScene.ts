import { playSong } from '../audio';
import type { Renderer } from '../gfx/renderer';
import '../game/player';
import { drawSpriteScaled, GAME_VERSION, logoCanvases, MenuScene, sfx, type MenuItem } from '../ui';
import { flow } from './flow';

const SHEEN_PERIOD = 4.5;
const SHEEN_W = 10;

export class TitleScene extends MenuScene {
  private logoY = 0;
  private shipY = 0;
  private promptY = 0;
  private sheen: HTMLCanvasElement | null = null;
  private leaving = false;

  override enter(): void {
    // Before the first gesture this is remembered and starts on unlock.
    playSong('title');
  }

  protected layout(w: number, h: number): void {
    this.logoY = Math.round(h * 0.17);
    this.shipY = Math.round(h * 0.58);
    this.promptY = Math.round(h * 0.76);
    // The whole screen is the start button.
    this.menu.setItems([this.button('start', 0, 0, w, h)]);
  }

  protected activate(_it: MenuItem): void {
    if (this.leaving) return;
    this.leaving = true;
    sfx('ui_confirm');
    this.later(() => flow.hangar());
  }

  protected draw(r: Renderer): void {
    const logo = logoCanvases();
    const ctx = r.ctx;
    const cw = r.width;
    // Logo drops in over the first half second, then settles with a one-pixel bob.
    const drop = Math.max(0, 1 - this.t / 0.5);
    const bob = Math.floor(this.t * 1.5) % 2;
    const capY = this.logoY - Math.round(drop * drop * 60);
    const bigY = capY + logo.captain.height - 2;
    const bigX = Math.round((cw - logo.blastroid.width) / 2);
    ctx.drawImage(logo.captain, Math.round((cw - logo.captain.width) / 2), capY + bob);
    ctx.drawImage(logo.blastroid, bigX, bigY + bob);
    this.drawSheen(r, bigX, bigY + bob);

    r.text('THE KESSLER BELT', cw / 2, bigY + logo.blastroid.height + 8, {
      align: 'center',
      color: '#a0a8c0',
    });

    const shipBob = Math.round(Math.sin(this.t * 1.7) * 3);
    drawSpriteScaled(r, 'kestrel', cw / 2, this.shipY + shipBob, 2, Math.floor(this.t * 12) % 3);

    if (this.leaving || Math.floor(this.t * 2) % 2 === 0) {
      r.text('TAP TO START', cw / 2, this.promptY, { align: 'center', color: '#f8d850' });
    }
    r.text('or press Enter', cw / 2, this.promptY + 14, { align: 'center', color: '#a0a8c0' });
    r.text(`v${GAME_VERSION}`, 4, r.height - 9, { font: 'small', color: '#606878' });
  }

  /** A white band sweeps across the lettering every few seconds. */
  private drawSheen(r: Renderer, x: number, y: number): void {
    const logo = logoCanvases();
    const phase = (this.t % SHEEN_PERIOD) / 0.9;
    if (phase > 1) return;
    const m = logo.blastroidMask;
    if (!this.sheen) {
      this.sheen = document.createElement('canvas');
      this.sheen.width = m.width;
      this.sheen.height = m.height;
    }
    const s = this.sheen.getContext('2d');
    if (!s) return;
    s.globalCompositeOperation = 'source-over';
    s.clearRect(0, 0, m.width, m.height);
    s.fillStyle = '#ffffff';
    const x0 = Math.round(phase * (m.width + m.height + SHEEN_W)) - m.height - SHEEN_W;
    // Stepped diagonal so the band stays pixel-crisp.
    for (let row = 0; row < m.height; row++) s.fillRect(x0 + (m.height - row), row, SHEEN_W, 1);
    // Keep the band only where the lettering face is.
    s.globalCompositeOperation = 'destination-in';
    s.drawImage(m, 0, 0);
    s.globalCompositeOperation = 'source-over';
    r.ctx.globalAlpha = 0.75;
    r.ctx.drawImage(this.sheen, x, y);
    r.ctx.globalAlpha = 1;
  }
}
