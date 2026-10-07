import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs let the standalone demo build be served from any sub-path.
  base: process.env.VITE_STANDALONE_DEMO ? "./" : "/",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
})
