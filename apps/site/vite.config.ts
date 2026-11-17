import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BASE = '/merman/' // custom domain: change to '/'

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? BASE : '/',
  plugins: [react()],
  // In dev the viewer runs on its own server (apps/playground); /app goes there.
  server: { host: true, allowedHosts: true, proxy: { '/app': { target: `http://localhost:${process.env.PLAYGROUND_PORT ?? 5174}`, ws: true } } },
  build: { rollupOptions: { input: { site: 'index.html' } } },
}))
