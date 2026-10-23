import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// API: por padrão o dev fala direto com o Worker publicado — o banco real (D1),
// sem depender de uma janela `wrangler dev` secundária que pode expirar.
// Para desenvolver o Worker localmente: `npm run dev:api` + `VITE_API_LOCAL=1 npm run dev`.
const apiAlvo =
  process.env.VITE_API_LOCAL === '1'
    ? 'http://127.0.0.1:8787'
    : 'https://dirigentes.sswebtechcontato.workers.dev'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: apiAlvo,
        changeOrigin: true,
      },
    },
  },
})
