import type { DestinoEstado, Estado, OrigemEstado } from './dominio'
import { CHAVE_LOCAL, estadoInicial, normalizarEstado } from './estadoInicial'

const CHAVE_PIN = 'dirigentes:pin'

/**
 * Teto de tempo de uma chamada de rede. Sem isso, uma API que aceita a conexão
 * e nunca responde (Worker reiniciando, proxy parado) deixa o `fetch` pendurado
 * para sempre e a tela de abertura nunca sai.
 */
const TEMPO_REDE_MS = 8000

/**
 * `fetch` com teto de tempo: ao estourar, a promessa rejeita e o chamador cai
 * no seu fallback (cache local, sessão conhecida etc.) em vez de travar a UI.
 */
export function buscar(
  caminho: string,
  init: RequestInit = {},
  tempoMs = TEMPO_REDE_MS,
): Promise<Response> {
  const controlador = new AbortController()
  const relogio = setTimeout(() => controlador.abort(), tempoMs)
  return fetch(caminho, { ...init, signal: controlador.signal }).finally(() => {
    clearTimeout(relogio)
  })
}

export function cabecalhosPin(): Record<string, string> {
  try {
    const pin = localStorage.getItem(CHAVE_PIN)
    return pin ? { 'x-app-pin': pin } : {}
  } catch {
    return {}
  }
}

export interface ResultadoCarga {
  estado: Estado
  origem: OrigemEstado
}

/** Sessão expirada/não autenticada (401): a interface deve abrir o login. */
export class Erro401 extends Error {
  constructor() {
    super('sessao_expirada')
    this.name = 'Erro401'
  }
}

/**
 * Carrega o estado mais recente: API primeiro, cache local como reserva.
 * Retorna { estado, origem } para a interface sinalizar de onde veio o dado.
 * Lança Erro401 quando a sessão não é válida (não há o que ressalvar offline).
 */
export async function carregarEstado(): Promise<ResultadoCarga> {
  try {
    const resposta = await buscar('/api/estado', { cache: 'no-store', headers: cabecalhosPin() })
    if (resposta.status === 401) throw new Erro401()
    if (resposta.status === 403) throw new Erro401()
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`)
    const dados = (await resposta.json()) as { estado?: unknown }
    const estado = normalizarEstado(dados.estado)
    guardarLocal(estado)
    return { estado, origem: 'nuvem' }
  } catch (erro) {
    if (erro instanceof Erro401) throw erro
    console.warn('API indisponível, usando cache local.', erro)
  }

  try {
    const bruto = localStorage.getItem(CHAVE_LOCAL)
    if (bruto) return { estado: normalizarEstado(JSON.parse(bruto)), origem: 'local' }
  } catch (erro) {
    console.warn('Cache local ilegível.', erro)
  }

  return { estado: estadoInicial(), origem: 'padrao' }
}

function guardarLocal(estado: Estado): void {
  try {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(estado))
  } catch (erro) {
    console.warn('Não foi possível gravar o cache local.', erro)
  }
}

/**
 * Persiste o estado. Sempre grava localmente e envia para a API
 * (Worker + D1). Lança quando a API falha (o local já está salvo).
 */
/**
 * Limite do corpo para usar `keepalive`. O Fetch spec limita a 64KB por
 * requisição keepalive; acima disso o fetch falharia por completo.
 * Ficamos abaixo com folga.
 */
const LIMITE_KEEPALIVE = 60 * 1024

export async function salvarEstado(estado: Estado): Promise<DestinoEstado> {
  guardarLocal(estado)

  const corpo = JSON.stringify({ estado })
  const resposta = await buscar('/api/estado', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...cabecalhosPin() },
    body: corpo,
    // `keepalive` deixa a gravação terminar mesmo se o app for fechado ou
    // recarregado (F5) enquanto o PUT está em voo — sem ele, uma "Limpar
    // designação" seguida de F5 se perde e a escala antiga volta do servidor.
    // Só quando o corpo cabe no limite do spec (estados enormes caem no normal).
    keepalive: corpo.length < LIMITE_KEEPALIVE,
  })
  if (resposta.status === 401 || resposta.status === 403) throw new Erro401()
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`)
  return 'nuvem'
}

export type ResultadoGeracao =
  | { ok: true; estado: Estado }
  | { ok: false; motivo: 'existe' | 'falha' }

/**
 * Pede ao Worker para gerar a escala do mês da chave (rodízio por fichas).
 * `existe` quando o mês já foi gerado (não sobrescreve ajustes manuais).
 */
export async function gerarEscalaRemota(chave: string): Promise<ResultadoGeracao> {
  try {
    const resposta = await buscar('/api/escala/gerar', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...cabecalhosPin() },
      body: JSON.stringify({ chave }),
    })
    if (resposta.status === 409) return { ok: false, motivo: 'existe' }
    if (!resposta.ok) return { ok: false, motivo: 'falha' }
    const dados = (await resposta.json()) as { estado?: unknown }
    return { ok: true, estado: normalizarEstado(dados.estado) }
  } catch {
    return { ok: false, motivo: 'falha' }
  }
}
