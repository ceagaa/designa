/* Service worker do Designa: shell offline + notificações push.
   Em desenvolvimento (localhost) não intercepta nada — o Vite serve os módulos. */
const CACHE = 'designa-v1'
const SHELL = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/img/LOGOTIPO.png',
  '/img/favicon.png',
]

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

/** Remove do cache os assets com hash que a página atual já não referencia. */
async function podarAssets(html) {
  const atuais = new Set()
  for (const trecho of html.matchAll(/assets\/[\w.-]+/g)) atuais.add(`/${trecho[0]}`)
  const cache = await caches.open(CACHE)
  for (const requisicao of await cache.keys()) {
    const caminho = new URL(requisicao.url).pathname
    if (caminho.startsWith('/assets/') && !atuais.has(caminho)) await cache.delete(requisicao)
  }
}

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    (async () => {
      const chaves = await caches.keys()
      await Promise.all(
        chaves
          .filter((c) => c !== CACHE && (c.startsWith('dirigentes-') || c.startsWith('designa-')))
          .map((c) => caches.delete(c)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (evento) => {
  const requisicao = evento.request
  if (requisicao.method !== 'GET') return
  const url = new URL(requisicao.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') return

  if (requisicao.mode === 'navigate') {
    evento.respondWith(
      (async () => {
        try {
          const res = await fetch(requisicao)
          const html = await res.clone().text()
          const cache = await caches.open(CACHE)
          await cache.put('/', res.clone())
          if (html) {
            try {
              await podarAssets(html)
            } catch {
              /* melhor esforço: segue com a resposta */
            }
          }
          return res
        } catch {
          return (await caches.match('/')) ?? Response.error()
        }
      })(),
    )
    return
  }

  // Assets com hash do Vite: cache-first (o nome garante imutabilidade).
  evento.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const cacheado = await cache.match(requisicao)
      if (cacheado) return cacheado
      const res = await fetch(requisicao)
      if (res.ok) await cache.put(requisicao, res.clone())
      return res
    })(),
  )
})

/* ---------- Notificações push ---------- */

self.addEventListener('push', (evento) => {
  let dados = {}
  if (evento.data) {
    try {
      dados = evento.data.json()
    } catch {
      dados = { corpo: evento.data.text() }
    }
  }
  const titulo = typeof dados.titulo === 'string' && dados.titulo ? dados.titulo : 'Designa'
  const corpo = typeof dados.corpo === 'string' ? dados.corpo : ''
  const url = typeof dados.url === 'string' && dados.url ? dados.url : '/'
  const tag = typeof dados.tag === 'string' && dados.tag ? dados.tag : 'designa'
  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: corpo,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag,
      renotify: false,
      data: { url },
    }),
  )
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const url =
    (evento.notification.data && typeof evento.notification.data.url === 'string'
      ? evento.notification.data.url
      : '/') || '/'
  evento.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const janela of janelas) {
        if ('focus' in janela) {
          await janela.focus()
          if ('navigate' in janela) {
            try {
              await janela.navigate(url)
            } catch {
              /* já está no app: foco basta */
            }
          }
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
