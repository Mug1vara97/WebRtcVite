import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@sapphi-red/web-noise-suppressor']
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.worklet.js')) {
            return '[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        input: {
          main: './index.html',
          'voice-worker': './public/voice-worker.js'
        }
      }
    }
  },
  server: {
    host: true,
    port: 3000
  }
})
