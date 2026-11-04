import type { AbaNav } from '../lib/dominio'
import type { LucideIcon } from 'lucide-react'
import { CalendarDays, Settings, Users } from 'lucide-react'

interface ItemNav {
  id: AbaNav
  rotulo: string
  Icone: LucideIcon
}

const ITENS: Record<AbaNav, ItemNav> = {
  designacoes: { id: 'designacoes', rotulo: 'Designações', Icone: CalendarDays },
  pessoas: { id: 'pessoas', rotulo: 'Voluntários', Icone: Users },
  ajustes: { id: 'ajustes', rotulo: 'Ajustes', Icone: Settings },
}

/**
 * Barra inferior fixa (4.4 do manual): fundo superfície, sombra para cima
 * (shadow-nav), z-30 e itens com ícone 20px dentro de círculo de 36px.
 * O item ativo ganha círculo primary-600 com ícone branco (stroke 2.3).
 */
export default function BottomNav({
  itens,
  aba,
  aoMudar,
}: {
  itens: AbaNav[]
  aba: AbaNav
  aoMudar: (aba: AbaNav) => void
}) {
  if (!itens.length) return null

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 bg-superficie pb-[max(env(safe-area-inset-bottom,0px),8px)] shadow-nav"
    >
      <ul className="mx-auto grid w-full max-w-md grid-cols-3 gap-1 px-2 pt-1">
        {itens.map((id) => {
          const { rotulo, Icone } = ITENS[id]
          const ativa = aba === id
          return (
            <li key={id} className="min-w-0">
              <button
                type="button"
                aria-current={ativa ? 'page' : undefined}
                onClick={() => aoMudar(id)}
                className="flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-1.5 transition-colors hover:bg-neutro-100"
              >
                <span
                  className={`grid size-9 place-items-center rounded-full transition-colors ${
                    ativa ? 'bg-primary-600 text-white' : 'text-neutro-800'
                  }`}
                >
                  <Icone
                    className="size-5"
                    strokeWidth={ativa ? 2.3 : 1.8}
                    aria-hidden="true"
                  />
                </span>
                <span className="w-full truncate text-center text-[11px] font-bold leading-none text-neutro-800">
                  {rotulo}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
