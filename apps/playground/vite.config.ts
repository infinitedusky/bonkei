import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The viewer lives at /app/ in every mode: built and previewed (bonkei.dev/app/), and in dev
// (the site's dev server proxies /app here).
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  server: { host: true, allowedHosts: true, port: Number(process.env.PLAYGROUND_PORT ?? 5174), strictPort: true },
})
