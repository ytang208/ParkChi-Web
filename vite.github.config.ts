import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const releaseId = process.env.GITHUB_SHA?.slice(0, 7) ?? 'local';

export default defineConfig({
  base: '/ParkChi-Web/',
  plugins: [react()],
  build: {
    outDir: 'dist-github',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-${releaseId}.js`,
        chunkFileNames: `assets/[name]-${releaseId}-[hash].js`,
        assetFileNames: `assets/[name]-${releaseId}-[hash][extname]`,
      },
    },
  },
});
