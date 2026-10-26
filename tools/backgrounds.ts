import { Background, THEME_IDS, getTheme, isThemeId, type ThemeId } from '../src/backgrounds';
import { PLAYFIELD_H } from '../src/engine/display';
import { STEP } from '../src/engine/loop';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
};

const themeSel = $<HTMLSelectElement>('theme');
const seedIn = $<HTMLInputElement>('seed');
const heightSel = $<HTMLSelectElement>('height');
const speedIn = $<HTMLInputElement>('speed');
const speedV = $<HTMLSpanElement>('speedv');
const overlayIn = $<HTMLInputElement>('overlay');
const bandsIn = $<HTMLInputElement>('bands');
const readout = $<HTMLDivElement>('readout');
const view = $<HTMLCanvasElement>('view');
const ctx = view.getContext('2d');
if (!ctx) throw new Error('2d context unavailable');

for (const id of THEME_IDS) themeSel.add(new Option(id, id));
const params = new URLSearchParams(location.search);
const initial = params.get('theme') ?? 'kessler';
themeSel.value = isThemeId(initial) ? initial : 'kessler';
seedIn.value = params.get('seed') ?? seedIn.value;

const bg = new Background();
let scrollY = 0;
let prevScrollY = 0;
let time = 0;
let buildMs = 0;

function rebuild(): void {
  bg.setTheme(themeSel.value as ThemeId, seedIn.value);
  const t0 = performance.now();
  bg.prebuild();
  buildMs = performance.now() - t0;
  scrollY = prevScrollY = 0;
  time = 0;
  samples.length = 0;
  maxMs = 0;
  framesSinceBuild = 0;
  slowFrames = 0;
}

const zoom = Number(params.get('zoom') ?? 2) || 2;

function resize(): void {
  const h = Number(heightSel.value);
  view.width = 240;
  view.height = h;
  view.style.width = `${240 * zoom}px`;
  view.style.height = `${h * zoom}px`;
}

themeSel.onchange = rebuild;
seedIn.onchange = rebuild;
heightSel.onchange = resize;
speedIn.oninput = () => (speedV.textContent = speedIn.value);
function skip(seconds: number): void {
  const d = seconds * getTheme(bg.themeId).scrollSpeed;
  scrollY += d;
  prevScrollY += d;
  time += seconds;
}
$<HTMLButtonElement>('jump').onclick = () => skip(30);

// Stand-ins for T02's reference sprites: they set the contrast bar the background must stay under.
const KESTREL = [
  '.....d.....',
  '....dwd....',
  '...dwwwd...',
  '...dwbwd...',
  '..dwwbwwd..',
  '.dwwwwwwwd.',
  'dwwgwwwgwwd',
  'dwg.dwd.gwd',
  'dd..dod..dd',
  '.....o.....',
];
const KESTREL_COLORS: Record<string, string> = {
  d: '#585870',
  w: '#d8d8e8',
  g: '#9898b0',
  b: '#2850c8',
  o: '#f88820',
};

function drawGrid(rows: string[], colors: Record<string, string>, x: number, y: number): void {
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j] as string;
    for (let i = 0; i < row.length; i++) {
      const c = colors[row[i] as string];
      if (!c) continue;
      ctx!.fillStyle = c;
      ctx!.fillRect(x + i, y + j, 1, 1);
    }
  }
}

function enemyBullet(x: number, y: number): void {
  const c = ctx!;
  c.fillStyle = '#f858b8';
  c.fillRect(x + 1, y, 4, 6);
  c.fillRect(x, y + 1, 6, 4);
  c.fillStyle = '#f8f8f8';
  c.fillRect(x + 2, y + 2, 2, 2);
}

function drawReference(offY: number): void {
  const c = ctx!;
  const t = time;
  drawGrid(KESTREL, KESTREL_COLORS, 115, offY + 330);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + t * 0.4;
    enemyBullet(
      Math.round(120 + Math.cos(a) * (40 + i * 6)),
      Math.round(offY + 160 + Math.sin(a) * 50),
    );
  }
  c.fillStyle = '#58f8f8';
  for (let i = 0; i < 4; i++) {
    const y = offY + ((300 - ((t * 240 + i * 70) % 300)) | 0);
    c.fillRect(117, y, 2, 6);
    c.fillRect(123, y, 2, 6);
  }
}

const samples: number[] = [];
let maxMs = 0;
let framesSinceBuild = 0;
let slowFrames = 0;
let lastFrame = 0;
let acc = 0;
let fpsT = 0;
let fpsFrames = 0;
let fps = 0;

function frame(now: number): void {
  const dtMs = lastFrame ? Math.min(100, now - lastFrame) : 16.67;
  lastFrame = now;
  acc += dtMs / 1000;
  const speed = getTheme(bg.themeId).scrollSpeed * Number(speedIn.value);
  while (acc >= STEP) {
    prevScrollY = scrollY;
    scrollY += speed * STEP;
    time += STEP;
    acc -= STEP;
  }
  const alpha = acc / STEP;

  const t0 = performance.now();
  bg.draw(ctx!, prevScrollY + (scrollY - prevScrollY) * alpha, time, view.height);
  const ms = performance.now() - t0;
  samples.push(ms);
  if (samples.length > 120) samples.shift();
  // Skip the first frames after a rebuild: they include the one-time GPU upload of the strips.
  if (++framesSinceBuild > 10) {
    if (ms > maxMs) maxMs = ms;
    if (ms > 0.5) slowFrames++;
  }

  const offY = Math.floor((view.height - PLAYFIELD_H) / 2);
  if (overlayIn.checked) drawReference(offY);
  if (bandsIn.checked && offY > 0) {
    ctx!.fillStyle = 'rgba(248,248,248,0.25)';
    for (let x = 0; x < 240; x += 4) {
      ctx!.fillRect(x, offY - 1, 2, 1);
      ctx!.fillRect(x, offY + PLAYFIELD_H, 2, 1);
    }
  }

  fpsFrames++;
  fpsT += dtMs;
  if (fpsT >= 500) {
    fps = (fpsFrames * 1000) / fpsT;
    fpsFrames = 0;
    fpsT = 0;
    const avg = samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length);
    readout.textContent = [
      `theme    ${bg.themeId}`,
      `seed     ${bg.seed}`,
      `fps      ${fps.toFixed(1)}`,
      `draw avg ${avg.toFixed(3)} ms`,
      `draw max ${maxMs.toFixed(3)} ms`,
      `>0.5 ms  ${slowFrames} / ${framesSinceBuild} frames`,
      `build    ${buildMs.toFixed(1)} ms`,
      `time     ${time.toFixed(1)} s`,
      `scrollY  ${scrollY.toFixed(0)} px`,
    ].join('\n');
  }
  requestAnimationFrame(frame);
}

resize();
rebuild();
// ?t=90 starts 90 s into the level, e.g. to inspect a set piece.
skip(Number(params.get('t') ?? 0) || 0);
requestAnimationFrame(frame);
