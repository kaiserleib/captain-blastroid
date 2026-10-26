import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { runnerImport, type Plugin, type Rollup } from 'vite';
import type { IconStyle } from './icons.ts';
import { encodePng, pngSize } from './png.ts';

type IconsModule = typeof import('./icons.ts');

// The renderer imports game sources (extensionless TS), so it goes through Vite's module
// runner instead of being imported by the config, which Node's native loader can't handle.
let iconsModule: Promise<IconsModule> | null = null;
function loadIcons(root: string): Promise<IconsModule> {
  iconsModule ??= runnerImport<IconsModule>(join(root, 'tools/pwa/icons.ts'), {
    configFile: false,
    root,
    logLevel: 'warn',
  }).then((r) => r.module);
  return iconsModule;
}

/** PWA icons, by published path. Referenced from index.html and manifest.webmanifest. */
export const WEB_ICONS: Record<string, { size: number; style: IconStyle }> = {
  'icons/icon-192.png': { size: 192, style: 'square' },
  'icons/icon-512.png': { size: 512, style: 'square' },
  'icons/maskable-512.png': { size: 512, style: 'maskable' },
  'icons/apple-touch-icon.png': { size: 180, style: 'square' },
  'icons/favicon-32.png': { size: 32, style: 'square' },
};

const STATIC_PRECACHE = ['./', 'index.html', 'manifest.webmanifest', ...Object.keys(WEB_ICONS)];

async function webIcon(root: string, path: string): Promise<Buffer | null> {
  const def = WEB_ICONS[path];
  if (!def) return null;
  const { renderIcon } = await loadIcons(root);
  return encodePng(renderIcon(def.size, def.size, def.style));
}

/** The main entry chunk plus everything it imports statically (not the lazy Capacitor chunk). */
type OutputChunk = Rollup.OutputChunk;

function entryFiles(bundle: Rollup.OutputBundle, entryName: string): string[] {
  const chunks = new Map<string, OutputChunk>();
  for (const item of Object.values(bundle)) {
    if (item.type === 'chunk') chunks.set(item.fileName, item);
  }
  const entry = [...chunks.values()].find((c) => c.isEntry && c.name === entryName);
  if (!entry) throw new Error(`pwa: entry chunk "${entryName}" not found`);
  const out = new Set<string>();
  const visit = (c: OutputChunk): void => {
    if (out.has(c.fileName)) return;
    out.add(c.fileName);
    const meta = (c as { viteMetadata?: { importedCss?: Set<string> } }).viteMetadata;
    for (const css of meta?.importedCss ?? []) out.add(css);
    for (const dep of c.imports) {
      const d = chunks.get(dep);
      if (d) visit(d);
    }
  };
  visit(entry);
  return [...out].sort();
}

/**
 * Hand-rolled PWA support (smaller than vite-plugin-pwa/Workbox for one cache-first
 * worker): serves and emits the generated icons, and emits `sw.js` with a precache
 * list of the hashed entry assets. `CAP_ASSETS=1` also regenerates the native
 * icons/splashes in ios/ and android/ from the same renderer.
 */
export function pwa(opts: { entry: string; root: string }): Plugin {
  return {
    name: 'blastroid-pwa',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0]?.replace(/^\//, '') ?? '';
        if (!(path in WEB_ICONS)) return next();
        webIcon(opts.root, path).then((png) => {
          res.setHeader('Content-Type', 'image/png');
          res.end(png);
        }, next);
      });
    },
    async generateBundle(_options, bundle) {
      for (const fileName of Object.keys(WEB_ICONS)) {
        const source = (await webIcon(opts.root, fileName)) as Buffer;
        this.emitFile({ type: 'asset', fileName, source });
      }
      const files = [...STATIC_PRECACHE, ...entryFiles(bundle, opts.entry)];
      const template = readFileSync(join(opts.root, 'tools/pwa/sw.js'), 'utf8');
      // Hashed file names change with content, so names + worker source identify a deploy.
      const version = createHash('sha256')
        .update(files.join('\n'))
        .update(template)
        .digest('hex')
        .slice(0, 12);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `self.__PRECACHE = ${JSON.stringify({ version, files })};\n${template}`,
      });
    },
    async closeBundle() {
      if (process.env.CAP_ASSETS === '1') await writeNativeAssets(opts.root);
    },
  };
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function nativeStyle(rel: string): IconStyle | null {
  const p = rel.split(sep).join('/');
  if (p.includes('AppIcon.appiconset/')) return 'square';
  if (p.includes('Splash.imageset/') || /\/drawable[^/]*\/splash\.png$/.test(p)) return 'splash';
  if (p.endsWith('/ic_launcher_round.png')) return 'round';
  if (p.endsWith('/ic_launcher_foreground.png')) return 'foreground';
  if (p.endsWith('/ic_launcher.png')) return 'square';
  return null;
}

/** Re-renders every launcher icon and splash PNG that `npx cap add` created, keeping its size. */
export async function writeNativeAssets(root: string): Promise<void> {
  const { ICON_BG, renderIcon } = await loadIcons(root);
  const files = [
    ...walk(join(root, 'ios/App/App/Assets.xcassets')),
    ...walk(join(root, 'android/app/src/main/res')),
  ];
  let n = 0;
  for (const file of files) {
    if (!file.endsWith('.png')) continue;
    const style = nativeStyle(relative(root, file));
    const size = style && pngSize(readFileSync(file));
    if (!style || !size) continue;
    writeFileSync(file, encodePng(renderIcon(size.w, size.h, style)));
    n++;
  }
  const bg = join(root, 'android/app/src/main/res/values/ic_launcher_background.xml');
  if (existsSync(bg)) {
    writeFileSync(
      bg,
      `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${ICON_BG.toUpperCase()}</color>\n</resources>\n`,
    );
  }
  console.log(`pwa: regenerated ${n} native icon/splash PNGs`);
}
