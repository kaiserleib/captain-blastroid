import type { Enemy } from '../../sim/types';
import { activeBoss, bossDisplayName as registeredBossName } from '../boss';
import type { World } from '../../sim/world';

export const MAX_PIPS = 12;
export const PIP_LOST_T = 0.6;
export const PIP_GAIN_T = 0.36;
export const BOSS_FLASH_T = 0.08;
/** Minimum seconds between boss-bar glints, so steady fire doesn't hold the bar white. */
export const BOSS_FLASH_GAP = 0.3;
export const WARNING_T = 2;
/** If `bossSpawned` fires before the parts exist, wait this long before hiding the bar. */
const BOSS_GRACE_T = 1;

/**
 * Everything the HUD animates, derived from world state each frame. It only
 * reads the world; the event handlers write HUD-local fields.
 */
export class HudState {
  /** Shield pips last frame, and per-pip effect timers. */
  shownShield = -1;
  readonly pipLostT = new Float32Array(MAX_PIPS);
  readonly pipGainT = new Float32Array(MAX_PIPS);

  bossActive = false;
  bossName = '';
  bossHp = 0;
  bossMaxHp = 0;
  bossFlashT = 0;
  private bossFlashCd = 0;
  private bossSeen = false;
  private bossT = 0;

  warningT = 0;

  /** Peak magnet/repulsor timers, so bars shrink from full whatever the duration. */
  magnetMax = 0;
  repulsorMax = 0;
  private lastMagnet = 0;
  private lastRepulsor = 0;

  /** Animation clock (sim seconds, so it freezes with the game). */
  t = 0;
  private lastTime = -1;

  reset(): void {
    this.shownShield = -1;
    this.pipLostT.fill(0);
    this.pipGainT.fill(0);
    this.bossActive = false;
    this.bossName = '';
    this.bossHp = this.bossMaxHp = this.bossFlashT = this.bossFlashCd = 0;
    this.bossSeen = false;
    this.bossT = 0;
    this.warningT = 0;
    this.magnetMax = this.repulsorMax = this.lastMagnet = this.lastRepulsor = 0;
    this.t = 0;
    this.lastTime = -1;
  }

  onBossSpawned(defId: string): void {
    this.bossActive = true;
    this.bossName = bossDisplayName(defId);
    this.bossSeen = false;
    this.bossT = 0;
    this.bossHp = this.bossMaxHp = 0;
  }

  onBossDefeated(): void {
    this.bossActive = false;
  }

  onBossWarning(): void {
    this.warningT = WARNING_T;
  }

  /** Advances by the sim time elapsed since the last call. */
  update(w: World): void {
    let dt = this.lastTime < 0 ? 0 : w.time - this.lastTime;
    if (dt < 0) dt = 0;
    if (dt > 0.1) dt = 0.1;
    this.lastTime = w.time;
    this.t += dt;
    this.updateShield(w.player.shield, w.player.maxShield, dt);
    this.updateBoss(w, dt);
    if (this.warningT > 0) this.warningT = Math.max(0, this.warningT - dt);

    const m = w.player.magnetT;
    if (m > this.lastMagnet + 1e-3 || m > this.magnetMax) this.magnetMax = m;
    this.lastMagnet = m;
    const r = w.player.repulsorT;
    if (r > this.lastRepulsor + 1e-3 || r > this.repulsorMax) this.repulsorMax = r;
    this.lastRepulsor = r;
  }

  updateShield(shield: number, maxShield: number, dt: number): void {
    const n = Math.min(MAX_PIPS, Math.max(0, Math.floor(maxShield)));
    const s = Math.min(n, Math.max(0, Math.floor(shield)));
    for (let i = 0; i < MAX_PIPS; i++) {
      const lost = this.pipLostT[i] as number;
      const gain = this.pipGainT[i] as number;
      if (lost > 0) this.pipLostT[i] = Math.max(0, lost - dt);
      if (gain > 0) this.pipGainT[i] = Math.max(0, gain - dt);
    }
    // The first frame just adopts the value, so a fresh run doesn't glint every pip.
    if (this.shownShield >= 0) {
      for (let i = s; i < this.shownShield && i < MAX_PIPS; i++) {
        this.pipLostT[i] = PIP_LOST_T;
        this.pipGainT[i] = 0;
      }
      for (let i = this.shownShield; i < s; i++) {
        this.pipGainT[i] = PIP_GAIN_T;
        this.pipLostT[i] = 0;
      }
    }
    this.shownShield = s;
  }

  private updateBoss(w: World, dt: number): void {
    if (this.bossFlashT > 0) this.bossFlashT = Math.max(0, this.bossFlashT - dt);
    if (this.bossFlashCd > 0) this.bossFlashCd = Math.max(0, this.bossFlashCd - dt);
    if (!this.bossActive) return;
    this.bossT += dt;
    let hp = 0;
    let max = 0;
    let parts = 0;
    const items = w.enemies.items;
    const boss = activeBoss(w);
    for (let i = 0; i < w.enemies.count; i++) {
      const e = items[i] as Enemy;
      if (!e.active || !e.isBoss) continue;
      if (boss?.inHpBar !== undefined && !boss.inHpBar(e)) continue;
      parts++;
      hp += Math.max(0, e.hp);
      max += e.maxHp;
    }
    if (parts === 0) {
      if (this.bossSeen || this.bossT > BOSS_GRACE_T) this.bossActive = false;
      this.bossHp = 0;
      return;
    }
    if (this.bossSeen && hp < this.bossHp && this.bossFlashCd <= 0) {
      this.bossFlashT = BOSS_FLASH_T;
      this.bossFlashCd = BOSS_FLASH_GAP;
    }
    this.bossSeen = true;
    this.bossHp = hp;
    // Destroyed parts leave the pool, so keep the peak as the bar's full length.
    if (max > this.bossMaxHp) this.bossMaxHp = max;
  }
}

/** The boss registration's `displayName`, else `scrap_baron` → `SCRAP BARON` (T21). */
export const bossDisplayName = registeredBossName;
