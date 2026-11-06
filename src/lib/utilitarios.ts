/**
 * Peças pequenas usadas em várias telas. Manter tudo aqui evita que a mesma
 * regra seja reimplementada (e eventualmente divergida) em cada componente.
 */

/** Iniciais do avatar: até 2 letras maiúsculas, "?" quando não há nome. */
export function iniciais(nome: string): string {
  return (
    nome
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0] ?? '')
      .join('')
      .toUpperCase() || '?'
  )
}

/** Id curto e único para registros novos (prefixo livre: "dir", "campo", ...). */
export function novoId(prefixo: string): string {
  return `${prefixo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Hash djb2: transforma um texto em número estável, usado como desempate
 * determinístico no rodízio. O mesmo texto sempre cai no mesmo número.
 */
export function hash(texto: string): number {
  let h = 5381
  for (let i = 0; i < texto.length; i += 1) {
    h = ((h << 5) + h + texto.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}
