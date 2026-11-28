import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/** Webbläsarna som paketets syntax ska fungera i. Safari 15 är den äldsta som har WebGL 2. */
const BUILD_TARGETS = ['chrome111', 'edge111', 'firefox114', 'safari15', 'ios15'];

export default defineConfig({
  // Relativ bas så att samma bygge fungerar på GitHub Pages under /konfigurator/.
  base: './',
  plugins: [react()],
  build: {
    // Vites standardmål är Safari 16.4. Ägarens iPad har Safari 15.6 och kunde inte tolka
    // paketet (t.ex. statiska block i klasser), så syntaxen skrivs om för Safari 15.
    target: BUILD_TARGETS,
    // three.js och React Three Fiber är ensamma cirka 1,2 MB (cirka 350 kB komprimerat) och går
    // inte att dela upp vidare. PDF-biblioteken laddas först när någon laddar ner en ritning.
    chunkSizeWarningLimit: 1400,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
