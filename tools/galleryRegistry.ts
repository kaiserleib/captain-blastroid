// Gallery section registry. To add a section, drop a file in tools/sections/ that calls
// registerGallerySection(); gallery.ts imports that folder with import.meta.glob, so
// nothing else needs editing. Sprites defined in any src/**/*.sprites.ts file show up
// in the Sprites section automatically.

export interface GalleryContext {
  /** Current zoom (1, 2 or 4). Sections are re-rendered when it changes. */
  readonly zoom: number;
  /** Calls `fn(dtSeconds, tSeconds)` every animation frame until the section is torn down. */
  animate(fn: (dt: number, t: number) => void): void;
}

/** Render into `root`. Return a cleanup function if you hold resources beyond `animate`. */
export type GallerySectionRender = (root: HTMLElement, g: GalleryContext) => void | (() => void);

export interface GallerySection {
  name: string;
  order: number;
  render: GallerySectionRender;
}

const sections: GallerySection[] = [];

/** Lower `order` renders first. Core T02 sections use 0–90; feature tickets default to 100. */
export function registerGallerySection(
  name: string,
  render: GallerySectionRender,
  order = 100,
): void {
  const i = sections.findIndex((s) => s.name === name);
  const s = { name, order, render };
  if (i >= 0) sections[i] = s;
  else sections.push(s);
}

export function gallerySections(): GallerySection[] {
  return [...sections].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// DOM helpers for sections.

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { class?: string; text?: string; title?: string } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (props.class) e.className = props.class;
  if (props.text) e.textContent = props.text;
  if (props.title) e.title = props.title;
  for (const c of children) e.append(c);
  return e;
}

/** A logical-resolution canvas shown at `zoom`× with nearest-neighbor scaling. */
export function pixelCanvas(
  w: number,
  h: number,
  zoom: number,
  bg?: string,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${w * zoom}px`;
  canvas.style.height = `${h * zoom}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.imageSmoothingEnabled = false;
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }
  return { canvas, ctx };
}
