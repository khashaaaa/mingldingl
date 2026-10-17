import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  // Two pages: the keepers' panel (/) and the Guild House web page (/guild/), which bundles none of the panel.
  build: { rollupOptions: { input: { main: 'index.html', guild: 'guild/index.html' } } },
});
