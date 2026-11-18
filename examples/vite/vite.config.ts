import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Nothing Bonkei-specific here on purpose: a host needs no config for the wasm or the lazy layout chunk.
export default defineConfig({
  plugins: [react()],
})
