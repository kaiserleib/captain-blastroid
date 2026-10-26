// Save export/import codes: a versioned, checksummed text blob the player can copy between
// devices or keep as a backup. No accounts, no servers.
import { SaveFormatError, migrate, type SaveData, type Settings } from './schema';

/** Bump only if the code layout itself changes; the save inside carries its own version. */
const CODE_PREFIX = 'CB1';

/** FNV-1a 32-bit, as 8 hex digits. Catches typos and truncated pastes, not tampering. */
export function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64: string): string {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/**
 * `CB1.<base64url save JSON>.<checksum>`. Settings stay behind: stick size, haptics and
 * volume belong to the device, not the pilot.
 */
export function encodeSaveCode(save: SaveData): string {
  const payload = toBase64Url(JSON.stringify({ ...save, settings: undefined }));
  return `${CODE_PREFIX}.${payload}.${checksum(payload)}`;
}

/**
 * Validates and migrates a code. Whitespace (line wraps from chat apps) is ignored.
 * The result keeps `settings` from the device. Throws SaveFormatError with a short,
 * player-facing message on any problem.
 */
export function decodeSaveCode(code: string, settings: Settings): SaveData {
  const parts = code.replace(/\s+/g, '').split('.');
  if (parts.length !== 3 || parts[0] !== CODE_PREFIX) {
    throw new SaveFormatError('Not a save code');
  }
  const [, payload = '', sum = ''] = parts;
  if (!/^[A-Za-z0-9_-]+$/.test(payload) || checksum(payload) !== sum.toLowerCase()) {
    throw new SaveFormatError('Code is damaged or incomplete');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(fromBase64Url(payload));
  } catch {
    throw new SaveFormatError('Code is damaged or incomplete');
  }
  const save = migrate(raw);
  return { ...save, settings: { ...settings } };
}
