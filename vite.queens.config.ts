import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const emitRootIndex = (): Plugin => ({
  name: 'queens-root-index',
  closeBundle() {
    copyFileSync(
      resolve(__dirname, 'dist-queens/queens.html'),
      resolve(__dirname, 'dist-queens/index.html'),
    );
  },
});

export default defineConfig({
  plugins: [emitRootIndex()],
  publicDir: false,
  server: {
    host: '127.0.0.1',
    port: 4174,
  },
  preview: {
    host: '127.0.0.1',
    port: 4175,
  },
  build: {
    outDir: 'dist-queens',
    emptyOutDir: true,
    sourcemap: true,
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      input: {
        queens: resolve(__dirname, 'queens.html'),
      },
    },
  },
});
