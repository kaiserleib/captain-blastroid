import { el, gallerySections, type GalleryContext } from './galleryRegistry';

// Side-effect imports: every sprite file and every gallery section registers itself.
import.meta.glob('../src/**/*.sprites.ts', { eager: true });
import.meta.glob('./sections/*.ts', { eager: true });

export { registerGallerySection } from './galleryRegistry';

const ZOOMS = [1, 2, 4] as const;
const ZOOM_KEY = 'blastroid.gallery.zoom';

function loadZoom(): number {
  try {
    const z = Number(localStorage.getItem(ZOOM_KEY));
    return (ZOOMS as readonly number[]).includes(z) ? z : 2;
  } catch {
    return 2;
  }
}

const root = document.getElementById('gallery');
if (!root) throw new Error('#gallery missing');
const toolbar = document.getElementById('toolbar');
if (!toolbar) throw new Error('#toolbar missing');

let zoom = loadZoom();
let teardown: (() => void)[] = [];

function render(): void {
  for (const fn of teardown) fn();
  teardown = [];
  root!.replaceChildren();

  const anims: ((dt: number, t: number) => void)[] = [];
  const g: GalleryContext = { zoom, animate: (fn) => void anims.push(fn) };
  const nav = el('nav');
  for (const s of gallerySections()) {
    const id = `sec-${s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const body = el('div', { class: 'section-body' });
    const sec = el('section', {}, el('h2', { text: s.name }), body);
    sec.id = id;
    root!.append(sec);
    const a = el('a', { text: s.name });
    a.href = `#${id}`;
    nav.append(a);
    try {
      const cleanup = s.render(body, g);
      if (cleanup) teardown.push(cleanup);
    } catch (err) {
      body.append(el('pre', { class: 'error', text: String((err as Error).stack ?? err) }));
    }
  }
  root!.prepend(nav);

  if (anims.length > 0) {
    let raf = 0;
    let last = performance.now();
    const start = last;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      for (const fn of anims) fn(dt, (now - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    teardown.push(() => cancelAnimationFrame(raf));
  }
}

for (const z of ZOOMS) {
  const b = el('button', { text: `${z}×` });
  b.dataset.zoom = String(z);
  b.addEventListener('click', () => {
    zoom = z;
    try {
      localStorage.setItem(ZOOM_KEY, String(z));
    } catch {
      // Storage can be unavailable (private mode); zoom just won't persist.
    }
    syncButtons();
    render();
  });
  toolbar.append(b);
}

function syncButtons(): void {
  for (const b of toolbar!.querySelectorAll<HTMLButtonElement>('button[data-zoom]')) {
    b.classList.toggle('active', Number(b.dataset.zoom) === zoom);
  }
}

syncButtons();
render();
