import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  // MapLibre loads its worker relative to its own file; pre-bundling moves
  // the file into .vite/deps and the worker can no longer be found
  optimizeDeps: {
    exclude: ['maplibre-gl']
  },
  server: {
    port: 5173,
    proxy: {
      // Forwards /api requests to the Express server during development
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})
