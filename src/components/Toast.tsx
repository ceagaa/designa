import { useEffect, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CheckCircle2, Trash, TriangleAlert, X } from 'lucide-react'

export type TipoToast = 'sucesso' | 'remocao' | 'erro'

/** Aviso atual: texto + tipo (seção 9 do manual). */
export type Aviso = { texto: string; tipo: TipoToast } | null

const ESTILOS: Record<TipoToast, { caixa: string; Icone: LucideIcon }> = {
  sucesso: { caixa: 'bg-toast text-toast-texto', Icone: CheckCircle2 },
  remocao: { caixa: 'bg-secondary-600 text-white', Icone: Trash },
  erro: { caixa: 'bg-perigo text-white', Icone: TriangleAlert },
}

/**
 * Toast flutuante (seção 9): some sozinho após 4000ms, pode ser fechado pelo X,
 * cada aviso reinicia a animação/contagem e o sucesso é anunciado em região
 * aria-live="polite" (erro em role="alert").
 */
export default function Toast({ aviso, aoFechar }: { aviso: Aviso; aoFechar: () => void }) {
  const aoFecharRef = useRef(aoFechar)

  useEffect(() => {
    aoFecharRef.current = aoFechar
  })

  useEffect(() => {
    if (!aviso) return undefined
    const timer = setTimeout(() => aoFecharRef.current(), 4000)
    return () => clearTimeout(timer)
    // `aviso` é um objeto novo a cada aviso: um novo reinicia a contagem.
  }, [aviso])

  if (!aviso) return null

  const { caixa, Icone } = ESTILOS[aviso.tipo]

  return (
    <div
      className="pointer-events-none fixed inset-x-4 bottom-24 z-40 mx-auto max-w-sm"
      aria-live="polite"
    >
      <div
        key={`${aviso.tipo}:${aviso.texto}`}
        role={aviso.tipo === 'erro' ? 'alert' : 'status'}
        className={`toast pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3.5 shadow-toast ${caixa}`}
      >
        <Icone className="size-5 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm font-bold">{aviso.texto}</p>
        <button
          type="button"
          aria-label="Fechar aviso"
          onClick={() => aoFecharRef.current()}
          className="grid size-7 shrink-0 place-items-center rounded-full transition-colors hover:bg-white/15"
        >
          <X className="size-4" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
