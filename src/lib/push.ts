import { cabecalhosPin } from './api'

/** Preparação de notificações push (PWA): permissão, inscrição e envio ao servidor. */

export type ResultadoAtivacao = 'ativo' | 'aguardando_servidor' | 'bloqueado' | 'incompativel' | 'erro'

export interface EstadoNotificacoes {
  suporta: boolean
  permissao: NotificationPermission
  inscrito: boolean
}

export function suportaNotificacoes(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

export async function estadoNotificacoes(): Promise<EstadoNotificacoes> {
  if (!suportaNotificacoes()) return { suporta: false, permissao: 'default', inscrito: false }
  let inscrito = false
  try {
    const registro = await navigator.serviceWorker.getRegistration()
    inscrito = Boolean(await registro?.pushManager.getSubscription())
  } catch {
    inscrito = false
  }
  return { suporta: true, permissao: Notification.permission, inscrito }
}

/** Chave pública VAPID em base64url → bytes para applicationServerKey. */
function chaveEmBytes(chave: string): Uint8Array<ArrayBuffer> {
  const base64 = chave.replace(/-/g, '+').replace(/_/g, '/')
  const preenchido = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binario = atob(preenchido)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i)
  return bytes
}

async function chaveVapidPublica(): Promise<string | null> {
  try {
    const resposta = await fetch('/api/push/vapid-publica', {
      cache: 'no-store',
      headers: cabecalhosPin(),
    })
    if (!resposta.ok) return null
    const dados = (await resposta.json()) as { chave?: unknown }
    return typeof dados.chave === 'string' && dados.chave ? dados.chave : null
  } catch {
    return null
  }
}

async function enviarInscricao(subscricao: PushSubscription): Promise<boolean> {
  const dados = subscricao.toJSON()
  try {
    const resposta = await fetch('/api/push/inscricao', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...cabecalhosPin() },
      body: JSON.stringify({
        endpoint: dados.endpoint,
        p256dh: dados.keys?.p256dh ?? '',
        auth: dados.keys?.auth ?? '',
      }),
    })
    return resposta.ok
  } catch {
    return false
  }
}

async function registroPush(): Promise<ServiceWorkerRegistration> {
  const existente = await navigator.serviceWorker.getRegistration()
  if (existente) return existente
  return navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

async function subscribeComChave(
  registro: ServiceWorkerRegistration,
): Promise<PushSubscription | null> {
  const chave = await chaveVapidPublica()
  if (!chave) return null
  return registro.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: chaveEmBytes(chave),
  })
}

export async function ativarNotificacoes(): Promise<ResultadoAtivacao> {
  if (!suportaNotificacoes()) return 'incompativel'
  try {
    const permissao = await Notification.requestPermission()
    if (permissao === 'denied') return 'bloqueado'
    if (permissao !== 'granted') return 'erro'
    const registro = await registroPush()
    const existente = await registro.pushManager.getSubscription()
    const subscricao = existente ?? (await subscribeComChave(registro))
    if (!subscricao) return 'aguardando_servidor'
    return (await enviarInscricao(subscricao)) ? 'ativo' : 'erro'
  } catch {
    return 'erro'
  }
}

export interface ResultadoTestePush {
  configurado?: boolean
  enviadas?: number
  removidas?: number
  falhas?: number
  erro?: string
}

/** Pede ao servidor que envie uma notificação de teste para todos os aparelhos inscritos. */
export async function enviarTestePush(): Promise<ResultadoTestePush> {
  try {
    const resposta = await fetch('/api/push/testar', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...cabecalhosPin() },
    })
    const dados = (await resposta.json()) as ResultadoTestePush
    if (!resposta.ok) return { erro: dados.erro ?? 'falha' }
    return dados
  } catch {
    return { erro: 'rede' }
  }
}
