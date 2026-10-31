/**
 * Tema do app: claro, escuro ou "automático" (segue o sistema/navegador).
 *
 * A escolha fica guardada neste aparelho. No modo automático o app escuta o
 * `prefers-color-scheme` do sistema e muda junto quando o usuário inverte o
 * tema do celular/navegador.
 */
export type Tema = 'claro' | 'escuro' | 'auto'

const CHAVE = 'dirigentes:tema'

const consultaSistema =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

/** Tema preferido salvo (padrão: automático). */
export function temaSalvo(): Tema {
  try {
    const valor = localStorage.getItem(CHAVE)
    return valor === 'claro' || valor === 'escuro' ? valor : 'auto'
  } catch {
    return 'auto'
  }
}

/** Tema que está de fato valendo agora (resolve o modo automático). */
export function temaEfetivo(preferido: Tema = temaSalvo()): 'claro' | 'escuro' {
  if (preferido !== 'auto') return preferido
  return consultaSistema?.matches ? 'escuro' : 'claro'
}

function aplicarNoDocumento(efetivo: 'claro' | 'escuro'): void {
  if (typeof document === 'undefined') return
  const raiz = document.documentElement
  raiz.classList.toggle('dark', efetivo === 'escuro')
  raiz.style.colorScheme = efetivo
}

let escutaAtiva = false

/**
 * Aplica o tema salvo e mantém o documento em sincronia: no modo automático
 * passa a reagir ao tema do sistema. Chame uma vez na entrada do app.
 */
export function iniciarTema(): Tema {
  const preferido = temaSalvo()
  aplicarNoDocumento(temaEfetivo(preferido))

  if (!escutaAtiva && consultaSistema) {
    escutaAtiva = true
    consultaSistema.addEventListener('change', () => {
      if (temaSalvo() === 'auto') aplicarNoDocumento(temaEfetivo('auto'))
    })
  }
  return preferido
}

/** Troca o tema do app (e o persiste neste aparelho). */
export function definirTema(preferido: Tema): void {
  try {
    if (preferido === 'auto') localStorage.removeItem(CHAVE)
    else localStorage.setItem(CHAVE, preferido)
  } catch {
    /* armazenamento indisponível */
  }
  aplicarNoDocumento(temaEfetivo(preferido))
}
