import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
// Two entries: the site at / and the viewer at /app/. Pages serves under /merman/, dev under /.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/merman/' : '/',
  plugins: [react()],
  server: { host: true, allowedHosts: true },
  build: { rollupOptions: { input: { site: resolve(__dirname, 'index.html'), app: resolve(__dirname, 'app/index.html') } } },
}))
