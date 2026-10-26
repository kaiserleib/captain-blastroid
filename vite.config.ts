import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { pwa } from './tools/pwa/plugin.ts';

export default defineConfig({
  // Relative asset URLs work under any path (LAN dev, static hosting, the Capacitor shell).
  base: './',
  server: { host: true },
  plugins: [pwa({ entry: 'main', root: fileURLToPath(new URL('.', import.meta.url)) })],
  build: {
    target: 'es2022',
    // Multi-page so the dev gallery ships alongside the game.
    rollupOptions: {
      input: {
        main: 'index.html',
        gallery: 'tools/gallery.html',
        backgrounds: 'tools/backgrounds.html',
        audio: 'tools/audio.html',
        portraits: 'tools/portraits.html',
      },
    },
  },
});
