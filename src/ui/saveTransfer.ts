// Save export / import panel. The canvas can't take pasted text or drive the clipboard, so
// this one screen is DOM, styled like the SNES windows and the 8px-monospace UI font.
import { UI } from '../gfx/palette';
import {
  SaveFormatError,
  decodeSaveCode,
  encodeSaveCode,
  getSave,
  getSaveStore,
  getSettings,
  type SaveData,
} from '../meta';
import { LOCK_RED, OK_GREEN } from './draw';
import { sfx } from './menuScene';

const STYLE = `
.cb-xfer{position:fixed;inset:0;z-index:10;display:flex;align-items:center;justify-content:center;
  background:rgba(0,0,0,.6);font:13px/1.45 monospace;color:${UI.text};
  padding:env(safe-area-inset-top) 12px env(safe-area-inset-bottom)}
.cb-xfer .win{width:min(360px,100%);box-sizing:border-box;padding:12px;border-radius:4px;
  background:linear-gradient(${UI.windowTop},${UI.windowBottom});
  border:2px solid ${UI.border};box-shadow:0 0 0 2px ${UI.borderOuter}}
.cb-xfer h2{margin:0 0 6px;font:inherit;text-align:center;color:${UI.textGold}}
.cb-xfer p{margin:0 0 8px;text-shadow:1px 1px 0 #000}
.cb-xfer textarea{width:100%;box-sizing:border-box;height:7.5em;resize:none;font:12px/1.3 monospace;
  background:${UI.barBack};color:${UI.text};border:1px solid ${UI.borderOuter};padding:4px;
  word-break:break-all;user-select:text;-webkit-user-select:text}
.cb-xfer .row{display:flex;gap:8px;margin-top:8px}
.cb-xfer button{flex:1;min-height:44px;font:inherit;color:${UI.text};cursor:pointer;
  background:linear-gradient(${UI.windowTop},${UI.windowBottom});border:1px solid ${UI.border};
  border-radius:3px;text-shadow:1px 1px 0 #000}
.cb-xfer button:focus-visible{outline:2px solid ${UI.textGold}}
.cb-xfer .msg{min-height:1.45em;margin:6px 0 0}
`;

let open: { close(): void } | null = null;

export function isSaveTransferOpen(): boolean {
  return open !== null;
}

function summary(s: SaveData): string {
  const cleared = Object.values(s.levels).filter((l) => l.clears > 0).length;
  return `${s.salvage} salvage, ${s.pilotsRescued.length} pilots, ${s.shipsBuilt.length} ships, ${cleared} sectors cleared`;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text = '',
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (text) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

/** Opens the panel; `onClose` runs once it is gone (imported = the save was replaced). */
function panel(
  build: (win: HTMLElement, close: (imported?: boolean) => void) => void,
  onClose: (imported: boolean) => void,
): void {
  open?.close();
  if (!document.getElementById('cb-xfer-style')) {
    const st = el('style');
    st.id = 'cb-xfer-style';
    st.textContent = STYLE;
    document.head.appendChild(st);
  }
  const root = el('div');
  root.className = 'cb-xfer';
  const win = el('div', '', root);
  win.className = 'win';
  win.setAttribute('role', 'dialog');
  // Capture on window runs before the game's key handlers: keys belong to the panel.
  const keys = (e: KeyboardEvent): void => {
    e.stopImmediatePropagation();
    if (e.type === 'keydown' && e.code === 'Escape') close();
  };
  const close = (imported = false): void => {
    if (open !== handle) return;
    open = null;
    window.removeEventListener('keydown', keys, true);
    window.removeEventListener('keyup', keys, true);
    root.remove();
    sfx('ui_back');
    onClose(imported);
  };
  const handle = { close: () => close() };
  open = handle;
  window.addEventListener('keydown', keys, true);
  window.addEventListener('keyup', keys, true);
  root.addEventListener('pointerdown', (e) => {
    if (e.target === root) close();
  });
  build(win, close);
  document.body.appendChild(root);
}

async function copyText(text: string, area: HTMLTextAreaElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    area.focus();
    area.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
}

export function openSaveExport(onClose: () => void = () => {}): void {
  const code = encodeSaveCode(getSave());
  panel((win, close) => {
    el('h2', 'EXPORT SAVE', win);
    el('p', 'Keep this code somewhere safe, or paste it into Import on another device.', win);
    const area = el('textarea', '', win);
    area.readOnly = true;
    area.value = code;
    const msg = el('p', '', win);
    msg.className = 'msg';
    const row = el('div', '', win);
    row.className = 'row';
    const copy = el('button', 'COPY', row);
    el('button', 'DONE', row).onclick = () => close();
    copy.onclick = () => {
      void copyText(code, area).then((ok) => {
        msg.style.color = ok ? OK_GREEN : LOCK_RED;
        msg.textContent = ok
          ? 'Copied to clipboard.'
          : 'Copy blocked: select the text and copy it.';
        sfx(ok ? 'ui_confirm' : 'ui_back');
      });
    };
    setTimeout(() => copy.focus(), 0);
  }, onClose);
}

export function openSaveImport(onClose: (imported: boolean) => void = () => {}): void {
  panel((win, close) => {
    el('h2', 'IMPORT SAVE', win);
    const info = el('p', 'Paste a save code. Your current progress is replaced.', win);
    const area = el('textarea', '', win);
    area.placeholder = 'CB1.…';
    area.spellcheck = false;
    area.autocapitalize = 'off';
    const msg = el('p', '', win);
    msg.className = 'msg';
    const row = el('div', '', win);
    row.className = 'row';
    const go = el('button', 'IMPORT', row);
    const cancel = el('button', 'CANCEL', row);
    cancel.onclick = () => close();
    let pending: SaveData | null = null;
    const fail = (text: string): void => {
      msg.style.color = LOCK_RED;
      msg.textContent = text;
      sfx('ui_back');
    };
    area.oninput = () => {
      pending = null;
      go.textContent = 'IMPORT';
      msg.textContent = '';
    };
    go.onclick = () => {
      if (pending) {
        const next = pending;
        go.disabled = true;
        void getSaveStore()
          .replaceWithImport(next)
          .then(
            () => {
              sfx('ui_confirm');
              close(true);
            },
            (e: unknown) => {
              go.disabled = false;
              fail(`Import failed: ${(e as Error).message}`);
            },
          );
        return;
      }
      try {
        pending = decodeSaveCode(area.value, getSettings());
      } catch (e) {
        if (!(e instanceof SaveFormatError)) throw e;
        fail(`${e.message}.`);
        return;
      }
      info.textContent = `Now: ${summary(getSave())}.`;
      msg.style.color = UI.textGold;
      msg.textContent = `Code: ${summary(pending)}. Replace?`;
      go.textContent = 'REPLACE';
      sfx('ui_confirm');
    };
    setTimeout(() => area.focus(), 0);
  }, onClose);
}
