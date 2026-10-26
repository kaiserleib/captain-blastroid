import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: true },
  build: {
    target: 'es2022',
    // Multi-page so the dev gallery ships alongside the game.
    rollupOptions: {
      input: {
        main: 'index.html',
        gallery: 'tools/gallery.html',
      input: {
        main: 'index.html',
        gallery: 'tools/gallery.html',
        backgrounds: 'tools/backgrounds.html',
        audio: 'tools/audio.html',
        portraits: 'tools/portraits.html',
      },
      },
    },
  },
});
