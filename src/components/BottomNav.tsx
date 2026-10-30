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

/** Barra inferior fixa em vidro fosco (apenas 3 itens), com safe-area. */
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_20px_rgba(17,38,43,0.06)] backdrop-blur-xl"
    >
      <ul className="mx-auto flex h-16 w-full max-w-[640px] items-center justify-around px-2">
        {itens.map((id) => {
          const { rotulo, Icone } = ITENS[id]
          const ativa = aba === id
          return (
            <li key={id} className="min-w-0 flex-1">
              <button
                type="button"
                aria-current={ativa ? 'page' : undefined}
                onClick={() => aoMudar(id)}
                className={`flex h-14 w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 transition-colors ${
                  ativa ? 'font-bold text-teal' : 'text-faint hover:text-ink-soft'
                }`}
              >
                <Icone className="size-[22px]" aria-hidden="true" />
                <span className="w-full truncate text-center text-[11px] font-semibold leading-tight">
                  {rotulo}
                </span>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${ativa ? 'bg-teal' : 'bg-transparent'}`}
                  aria-hidden="true"
                />
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
