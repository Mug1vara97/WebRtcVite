import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@sapphi-red/web-noise-suppressor']
  },
  build: {
    target: 'esnext'
  }
})
