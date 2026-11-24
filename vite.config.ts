import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relativ bas så att samma bygge fungerar på GitHub Pages under /konfigurator/.
  base: './',
  plugins: [react()],
  build: {
    // three.js och React Three Fiber är ensamma cirka 1,2 MB (cirka 350 kB komprimerat) och går
    // inte att dela upp vidare. PDF-biblioteken laddas först när någon laddar ner en ritning.
    chunkSizeWarningLimit: 1400,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
