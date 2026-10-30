/**
 * Gera as og:image 1200x630 das rotas públicas (prévia no WhatsApp).
 * Rode com: node scripts/gerar-og.mjs
 */
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIR_SAIDA = join(RAIZ, 'public', 'img')

// Ícones no estilo lucide (traço 24x24, stroke).
const ICONES = {
  MapPin:
    '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  Radio:
    '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>',
  ShoppingCart:
    '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
}

const IMAGENS = [
  {
    arquivo: 'og-campo.png',
    cor: '#0D5C68',
    icone: 'MapPin',
    titulo: 'Designação para o serviço de campo',
  },
  {
    arquivo: 'og-avi.png',
    cor: '#045A6C',
    icone: 'Radio',
    titulo: 'Designação para Áudio, Vídeo e Indicadores',
  },
  {
    arquivo: 'og-tpl.png',
    cor: '#7E0024',
    icone: 'ShoppingCart',
    titulo: 'Designação para TPL',
  },
]

/** HTML 1200x630 de uma imagem: wordmark branco + título grande + ícone de marca d'água. */
function htmlDaImagem({ cor, icone, titulo }) {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <link
      href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&display=swap"
      rel="stylesheet"
    />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        width: 1200px; height: 630px; overflow: hidden; position: relative;
        font-family: 'Plus Jakarta Sans', 'Segoe UI', sans-serif; color: #fff;
        background:
          radial-gradient(1100px 700px at 12% -5%, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0) 62%),
          ${cor};
      }
      .marca { position: absolute; top: 68px; left: 84px; display: flex; align-items: center; gap: 16px; }
      .marca svg { width: 44px; height: 44px; }
      .marca span { font-size: 46px; font-weight: 800; letter-spacing: -1px; }
      h1 {
        position: absolute; left: 84px; top: 210px; width: 780px;
        font-size: 74px; line-height: 1.14; font-weight: 800; letter-spacing: -1.6px;
      }
      .rodape { position: absolute; left: 84px; bottom: 72px; font-size: 30px; font-weight: 600; opacity: 0.85; }
      .icone { position: absolute; right: -56px; bottom: -64px; width: 560px; height: 560px; opacity: 0.12; }
      .icone svg { width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <div class="marca">
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 13l5 5L20 6" />
      </svg>
      <span>Designa</span>
    </div>
    <h1>${titulo}</h1>
    <div class="rodape">Escala publicada</div>
    <div class="icone">
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        ${ICONES[icone]}
      </svg>
    </div>
  </body>
</html>`
}

mkdirSync(DIR_SAIDA, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const pagina = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })

for (const imagem of IMAGENS) {
  await pagina.setContent(htmlDaImagem(imagem), { waitUntil: 'networkidle' })
  // Espera a Plus Jakarta Sans carregar (cai no fallback sans se offline).
  await pagina.evaluate(() => document.fonts.ready)
  const destino = join(DIR_SAIDA, imagem.arquivo)
  await pagina.screenshot({ path: destino, clip: { x: 0, y: 0, width: 1200, height: 630 } })
  console.log(`OK - ${imagem.arquivo}`)
}

await browser.close()
