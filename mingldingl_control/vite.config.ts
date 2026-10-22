import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  // The keepers' panel (/), the Guild House web page (/guild/), which bundles none of the panel, and
  // the plain pages the stores link to (/privacy/, /terms/, /delete/, /safety/).
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        guild: 'guild/index.html',
        privacy: 'privacy/index.html',
        terms: 'terms/index.html',
        delete: 'delete/index.html',
        safety: 'safety/index.html',
      },
    },
  },
});
