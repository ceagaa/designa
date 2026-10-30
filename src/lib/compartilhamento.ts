import type { ConfigEscala, Dirigente, Ocorrencia, PayloadCompartilhado } from './dominio'
import { lerChaveMes } from './datas'

/**
 * Abre o compartilhamento nativo do aparelho (navigator.share) apontando para
 * a página pública informada. Sem suporte, copia o link como alternativa.
 */
export type ResultadoCompartilhamento = 'compartilhado' | 'copiado' | 'cancelado' | 'falhou'

export async function compartilharPagina(
  url: string,
  titulo: string,
  texto: string,
): Promise<ResultadoCompartilhamento> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: titulo, text: texto, url })
      return 'compartilhado'
    } catch (falha) {
      // Pessoal que cancelou a folha de compartilhamento não é erro.
      if (falha instanceof DOMException && falha.name === 'AbortError') return 'cancelado'
      // Navegador sem folha nativa: cai para o clipboard.
    }
  }
  try {
    if (!navigator.clipboard) return 'falhou'
    await navigator.clipboard.writeText(url)
    return 'copiado'
  } catch {
    return 'falhou'
  }
}

/** Codifica um objeto JSON em texto seguro para URL (base64url, sem padding). */
export function codificar(valor: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(valor))
  let binario = ''
  for (let i = 0; i < bytes.length; i += 1) binario += String.fromCharCode(bytes[i])
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Desfaz o codificar. Retorna null quando o conteúdo é inválido. */
export function decodificar(texto: string): PayloadCompartilhado | null {
  try {
    const base64 = String(texto).replace(/-/g, '+').replace(/_/g, '/')
    const preenchido = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const binario = atob(preenchido)
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0))
    const dados: unknown = JSON.parse(new TextDecoder().decode(bytes))

    if (!dados || typeof dados !== 'object') return null
    const bruto = dados as Partial<PayloadCompartilhado>
    if (!Array.isArray(bruto.r) || typeof bruto.t !== 'string' || typeof bruto.c !== 'string') return null

    return {
      t: bruto.t,
      c: bruto.c,
      a: Number(bruto.a) || 0,
      m: Number(bruto.m) || 0,
      r: bruto.r.map((linha): [string, string, string, string, string?, string?] => {
        const [iso = '', horario = '', local = '', nome = '', fixo = '', ajudante = ''] = Array.isArray(linha)
          ? linha
          : []
        return [String(iso), String(horario), String(local), String(nome), String(fixo), String(ajudante)]
      }),
    }
  } catch {
    return null
  }
}

export interface EntradaPayload {
  config: ConfigEscala
  chave: string
  ocorrencias: Ocorrencia[]
  designacoes: Record<string, string>
  /** Ajudantes por dia (opcional: só o Campo usa). */
  designacoesAjudante?: Record<string, string>
  dirigentes: Dirigente[]
}

/**
 * Monta o payload mínimo da designação pronta: cabeçalho + linhas
 * [iso, horário, local, nome, fixo?, ajudante?] — cabe em um link de
 * WhatsApp. Dias fixos (designação fixa + "Quem dirige") ganham o marcador
 * '1' no 5º campo; o ajudante, quando há, vem no 6º.
 */
export function montarPayload({
  config,
  chave,
  ocorrencias,
  designacoes,
  designacoesAjudante = {},
  dirigentes,
}: EntradaPayload): PayloadCompartilhado {
  const { ano, mes } = lerChaveMes(chave)
  const porId = new Map(dirigentes.map((d) => [d.id, d]))

  const linhas = ocorrencias
    .filter((oc) => designacoes[oc.key])
    .map((oc): [string, string, string, string, string?, string?] => {
      const base: [string, string, string, string] = [
        oc.iso,
        String(oc.campo.horario),
        String(oc.campo.local),
        porId.get(designacoes[oc.key])?.nome ?? '',
      ]
      const nomeAjudante = porId.get(designacoesAjudante[oc.key])?.nome ?? ''
      const marcador = config.designacao_fixa && oc.campo.fixo ? '1' : ''
      if (marcador || nomeAjudante) return [base[0], base[1], base[2], base[3], marcador, nomeAjudante]
      return base
    })

  return {
    t: config.titulo,
    c: config.congregacao,
    a: ano,
    m: mes,
    r: linhas,
  }
}

export function linkDe(payload: PayloadCompartilhado): string {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#/ver/${codificar(payload)}`
}

export function lerHashVer(): string | null {
  const hash = window.location.hash || ''
  const inicio = '#/ver/'
  if (!hash.startsWith(inicio)) return null
  return hash.slice(inicio.length) || null
}
