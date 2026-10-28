import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Девсервер фронта проксирует /api к FastAPI-бэкенду (uvicorn :8000).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
