import { defineConfig, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig((): UserConfig => {
  // Dev ports come from the shell: SITE_PORT (strict when set; unset leaves Vite's 5173) and
  // VIEWER_PORT (default 5174), which apps/playground reads too. Same helper there; apps never import each other.
  const port = (name: string, fallback?: number): number | undefined => {
    const raw = process.env[name]
    if (raw === undefined || raw === '') return fallback
    const n = Number(raw)
    if (!/^\d+$/.test(raw) || n < 1 || n > 65535) throw new Error(`${name} must be a port number (1-65535), got "${raw}"`)
    return n
  }
  const site = port('SITE_PORT')
  return {
    base: '/',
    plugins: [react()],
    // In dev the viewer runs on its own server (apps/playground); /app goes there.
    server: {
      host: true,
      allowedHosts: true,
      ...(site === undefined ? {} : { port: site, strictPort: true }),
      proxy: { '/app': { target: `http://localhost:${port('VIEWER_PORT', 5174)}`, ws: true } },
    },
    // Preview would inherit that proxy; it must serve the built viewer from dist/app/ instead.
    preview: { proxy: {} },
    build: { rollupOptions: { input: { site: 'index.html' } } },
  }
})
