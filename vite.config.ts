/// <reference types="vitest" />
// Dev server + single-file web build (dist/web/index.html, everything inlined so it can be published as one artifact).
// Mini-game builds do not go through Vite: tools/build-minigame.mjs bundles src/main.ts with esbuild (same aliases as here).
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const stamp = () => { const d = new Date(), z = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`; };   // local time
const PXUI = path.resolve(ROOT, '../pxui/src');   // shared UI runtime (sibling folder), bundled from source

export default defineConfig(({ command }) => ({
  resolve: {
    alias: [{ find: /^pxui\//, replacement: PXUI + '/' }],
    dedupe: ['three'],
  },
  define: {
    __DEV__: JSON.stringify(command === 'serve'),
    __BUILD__: JSON.stringify(stamp()),
  },
  // _ref/ holds old prototypes with their own html entries: keep the dep scanner and watcher out of it
  optimizeDeps: { entries: ['index.html'] },
  server: {
    host: '127.0.0.1', port: 5173, strictPort: false, fs: { allow: [ROOT, PXUI] },
    watch: { ignored: ['**/_ref/**', '**/docs/**', '**/out/**', '**/dist/**'] },
  },
  plugins: command === 'build' ? [viteSingleFile()] : [],
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
    target: 'es2020',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 8000,
    reportCompressedSize: false,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: true,
  },
}));
