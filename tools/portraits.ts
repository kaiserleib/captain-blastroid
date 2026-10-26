import { randomSeedString } from '../src/engine/rng';
import {
  generatePortrait,
  NAMED_PORTRAITS,
  PORTRAIT_H,
  PORTRAIT_W,
  portraitCanvas,
  type PortraitOverrides,
} from '../src/portraits';

const MAIN_SCALE = 6;
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const main = $<HTMLCanvasElement>('main');
const seedInput = $<HTMLInputElement>('seed');
const status = $<HTMLDivElement>('status');
const traitsEl = $<HTMLPreElement>('traits');
main.style.width = `${PORTRAIT_W * MAIN_SCALE}px`;
main.style.height = `${PORTRAIT_H * MAIN_SCALE}px`;
const mainCtx = main.getContext('2d');

let current = { seed: randomSeedString(), overrides: {} as PortraitOverrides, label: '' };

function render(): void {
  seedInput.value = current.seed;
  if (!mainCtx) return;
  const t = generatePortrait(mainCtx, current.seed, current.overrides);
  traitsEl.textContent =
    (current.label ? `${current.label}\n` : '') +
    Object.entries(t)
      .map(([k, v]) => `${k.padEnd(13)} ${Array.isArray(v) ? v.join(', ') || '-' : String(v)}`)
      .join('\n');
}

function show(seed: string, overrides: PortraitOverrides = {}, label = ''): void {
  current = { seed, overrides, label };
  render();
}

function flash(msg: string): void {
  status.textContent = msg;
  setTimeout(() => (status.textContent = ''), 1500);
}

function card(seed: string, overrides: PortraitOverrides, label: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'card';
  const frame = document.createElement('div');
  frame.className = 'frame';
  const c = document.createElement('canvas');
  c.width = PORTRAIT_W;
  c.height = PORTRAIT_H;
  c.style.width = `${PORTRAIT_W * 2}px`;
  c.style.height = `${PORTRAIT_H * 2}px`;
  c.getContext('2d')?.drawImage(portraitCanvas(seed, overrides), 0, 0);
  frame.appendChild(c);
  const name = document.createElement('span');
  name.textContent = label;
  el.append(frame, name);
  el.addEventListener('click', () => show(seed, overrides, label === seed ? '' : label));
  return el;
}

function fillGrid(): void {
  const grid = $('grid');
  grid.replaceChildren();
  for (let i = 0; i < 20; i++) {
    const s = randomSeedString();
    grid.appendChild(card(s, {}, s));
  }
}

const roster = $('roster');
for (const [id, spec] of Object.entries(NAMED_PORTRAITS)) {
  roster.appendChild(card(spec.seed, spec.overrides, id));
}
fillGrid();

const load = (): void => {
  const v = seedInput.value.trim().toUpperCase();
  if (v) show(v);
};
$('load').addEventListener('click', load);
seedInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') load();
});
$('regen').addEventListener('click', () => show(randomSeedString()));
$('reroll').addEventListener('click', fillGrid);
$('copy').addEventListener('click', () => {
  void navigator.clipboard.writeText(current.seed).then(() => flash('Copied!'));
});
$('download').addEventListener('click', () => {
  const scale = 8;
  const out = document.createElement('canvas');
  out.width = PORTRAIT_W * scale;
  out.height = PORTRAIT_H * scale;
  const ctx = out.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(main, 0, 0, out.width, out.height);
  const a = document.createElement('a');
  a.download = `pilot-${current.label || current.seed}.png`;
  a.href = out.toDataURL();
  a.click();
});

render();
