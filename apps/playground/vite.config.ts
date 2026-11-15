import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BASE = '/merman/app/' // custom domain: change to '/app/'

// The viewer lives at /app/: under the Pages base when built or previewed, at /app/ in dev
// (the site's dev server proxies /app here).
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? BASE : '/app/',
  plugins: [react()],
  server: { host: true, allowedHosts: true, port: 5174, strictPort: true },
}))
