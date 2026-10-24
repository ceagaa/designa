import { ChevronLeft, LogOut } from 'lucide-react'
import SinoNotificacoes from './SinoNotificacoes'
import type { Notificacao } from './SinoNotificacoes'

interface AppHeaderProps {
  titulo: string
  notificacoes: Notificacao[]
  /** Presente na tela de montagem (volta para o resumo). */
  aoVoltar?: () => void
  /** Encerra a sessão da conta. */
  aoSair?: () => void
}

/** Header de topo: nome da página, sino de notificações e sair da conta. */
export default function AppHeader({ titulo, notificacoes, aoVoltar, aoSair }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-surface/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[640px] items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-1">
          {aoVoltar ? (
            <button
              type="button"
              aria-label="Voltar"
              onClick={aoVoltar}
              className="-ml-2 flex size-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-teal-tint hover:text-teal"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
          ) : null}
          <h1 className="truncate text-base font-semibold tracking-tight text-ink">{titulo}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <SinoNotificacoes notificacoes={notificacoes} />
          {aoSair ? (
            <button
              type="button"
              aria-label="Sair da conta"
              onClick={aoSair}
              className="flex size-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-crimson-bg hover:text-crimson"
            >
              <LogOut className="size-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
