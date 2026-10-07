import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs, so the build works under a GitHub Pages sub-path.
  base: './',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
});
