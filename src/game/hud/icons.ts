import { UI } from '../../gfx/palette';
import type { Renderer } from '../../gfx/renderer';
import { hasSprite } from '../../gfx/sprite';

export const SLOT = 12;

/** Fallback letters until T09's `icon_<weaponId>` sprites exist. */
const LETTERS: Readonly<Record<string, string>> = {
  blaster: 'B',
  spread: 'S',
  lance: 'L',
  seeker: 'M',
  orbitDrones: 'D',
};

interface IconInfo {
  sprite: string;
  letter: string;
}

const LETTER_TEXT = { align: 'center', color: UI.textGold } as const;

// Cached per weapon id so drawing doesn't build strings every frame.
const info = new Map<string, IconInfo>();

function iconInfo(weaponId: string): IconInfo {
  let i = info.get(weaponId);
  if (!i) {
    i = {
      sprite: `icon_${weaponId}`,
      letter: LETTERS[weaponId] ?? (weaponId.charAt(0).toUpperCase() || '?'),
    };
    info.set(weaponId, i);
  }
  return i;
}

export function weaponLetter(weaponId: string): string {
  return iconInfo(weaponId).letter;
}

/**
 * 12×12 weapon icon with its top-left at (x, y), in renderer coordinates.
 * Uses T09's `icon_<id>` sprite (assumed 12×12, centre anchor) when defined.
 */
export function drawWeaponIcon(r: Renderer, weaponId: string, x: number, y: number): void {
  const i = iconInfo(weaponId);
  if (hasSprite(i.sprite)) {
    r.sprite(i.sprite, x + SLOT / 2, y + SLOT / 2);
    return;
  }
  r.sprite('hud_slot', x, y);
  r.text(i.letter, x + SLOT / 2, y + 3, LETTER_TEXT);
}

export function drawEmptySlot(r: Renderer, x: number, y: number): void {
  r.sprite('hud_slot_empty', x, y);
}
