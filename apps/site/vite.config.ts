import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BASE = '/merman/' // custom domain: change to '/'

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? BASE : '/',
  plugins: [react()],
  optimizeDeps: { exclude: ['libavoid-js'] }, // dev: keep libavoid.wasm beside the module that loads it
  // In dev the viewer runs on its own server (apps/playground); /app goes there.
  server: { host: true, allowedHosts: true, proxy: { '/app': { target: 'http://localhost:5174', ws: true } } },
  build: { rollupOptions: { input: { site: 'index.html' } } },
}))
