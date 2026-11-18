import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',
  plugins: [react()],
  // In dev the viewer runs on its own server (apps/playground); /app goes there.
  server: { host: true, allowedHosts: true, proxy: { '/app': { target: `http://localhost:${process.env.PLAYGROUND_PORT ?? 5174}`, ws: true } } },
  // Preview would inherit that proxy; it must serve the built viewer from dist/app/ instead.
  preview: { proxy: {} },
  build: { rollupOptions: { input: { site: 'index.html' } } },
})
