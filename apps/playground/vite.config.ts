import { defineConfig, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The viewer lives at /app/ in every mode: built and previewed (bonkei.dev/app/), and in dev
// (the site's dev server proxies /app here). In dev it listens on VIEWER_PORT (default 5174, strict);
// the site finds it through the same variable, so `SITE_PORT=… VIEWER_PORT=… pnpm dev` starts a matched pair.
export default defineConfig((): UserConfig => {
  const port = (name: string, fallback: number): number => {
    const raw = process.env[name]
    if (raw === undefined || raw === '') return fallback
    const n = Number(raw)
    if (!/^\d+$/.test(raw) || n < 1 || n > 65535) throw new Error(`${name} must be a port number (1-65535), got "${raw}"`)
    return n
  }
  return {
    base: '/app/',
    plugins: [react()],
    server: { host: true, allowedHosts: true, port: port('VIEWER_PORT', 5174), strictPort: true },
  }
})
