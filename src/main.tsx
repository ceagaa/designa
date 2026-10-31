import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { iniciarTema } from './lib/tema'

// Tema antes da primeira pintura: claro ou escuro conforme o sistema/salvo.
iniciarTema()

const alvo = document.getElementById('root')
if (!alvo) throw new Error('Elemento #root não encontrado.')

createRoot(alvo).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA: registra o service worker apenas em produção (no Vite dev ele interromperia o HMR).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((erro) => {
      console.warn('Falha ao registrar o service worker.', erro)
    })
  })
}
