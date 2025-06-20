import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'noise-suppressor': ['@sapphi-red/web-noise-suppressor']
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['@sapphi-red/web-noise-suppressor']
  },
  server: {
    host: true,
    port: 3000
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  worker: {
    format: 'es'
  }
})
