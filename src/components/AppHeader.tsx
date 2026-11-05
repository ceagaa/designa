import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, LogOut, UserRound } from 'lucide-react'
import SinoNotificacoes from './SinoNotificacoes'
import type { Notificacao } from './SinoNotificacoes'

interface AppHeaderProps {
  titulo: string
  notificacoes: Notificacao[]
  /** Nome do usuário logado (para as iniciais do avatar). */
  nomeUsuario?: string
  /** Presente na tela de montagem (volta para o resumo). */
  aoVoltar?: () => void
  /** Abre a área de perfil. */
  aoAbrirPerfil?: () => void
  /** Encerra a sessão da conta. */
  aoSair?: () => void
}

function iniciais(nome: string): string {
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

/**
 * Header de topo: fundo primary-500, texto branco, título da página à
 * esquerda (depois do voltar, quando há) e, à direita, o sino de notificações
 * seguido do avatar — todos alinhados na mesma linha. O avatar abre um menu
 * com "Meu perfil" e "Sair".
 */
export default function AppHeader({
  titulo,
  notificacoes,
  nomeUsuario = '',
  aoVoltar,
  aoAbrirPerfil,
  aoSair,
}: AppHeaderProps) {
  const [menuAberto, setMenuAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuAberto) return undefined
    function aoClicarFora(evento: MouseEvent) {
      if (!raiz.current?.contains(evento.target as Node)) setMenuAberto(false)
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setMenuAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('mousedown', aoClicarFora)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [menuAberto])

  return (
    <header className="sticky top-0 z-30 bg-primary-500 text-white">
      <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-5 pb-8 pt-6">
        {/* Esquerda: voltar (quando há) + título da página. */}
        <div className="flex min-w-0 items-center gap-1">
          {aoVoltar ? (
            <button
              type="button"
              aria-label="Voltar"
              onClick={aoVoltar}
              className="-ml-2.5 flex size-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 active:bg-white/25"
            >
              <ChevronLeft className="size-6" strokeWidth={2} aria-hidden="true" />
            </button>
          ) : null}
          <h1 className="min-w-0 truncate text-lg font-extrabold tracking-tight text-white">
            {titulo}
          </h1>
        </div>

        {/* Direita: sino de notificações + avatar com o menu da conta. */}
        <div className="flex shrink-0 items-center gap-0.5">
          <SinoNotificacoes notificacoes={notificacoes} />

          <div ref={raiz} className="relative shrink-0">
            <button
              type="button"
              aria-label="Abrir menu da conta"
              aria-haspopup="menu"
              aria-expanded={menuAberto}
              onClick={() => setMenuAberto((atual) => !atual)}
              className="flex size-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 active:bg-white/25"
            >
              <span
                className="flex size-8 items-center justify-center rounded-full bg-white text-xs font-extrabold text-primary-700"
                aria-hidden="true"
              >
                {iniciais(nomeUsuario)}
              </span>
            </button>

            {menuAberto ? (
              <div
                role="menu"
                aria-label="Conta"
                className="absolute right-0 top-[calc(100%+6px)] z-40 w-48 divide-y divide-line-soft overflow-hidden rounded-2xl border border-line bg-card shadow-popover"
              >
                {aoAbrirPerfil ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuAberto(false)
                      aoAbrirPerfil()
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold text-ink transition-colors hover:bg-canvas"
                  >
                    <UserRound className="size-4 shrink-0 text-muted" aria-hidden="true" />
                    Meu perfil
                  </button>
                ) : null}
                {aoSair ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuAberto(false)
                      aoSair()
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-semibold text-crimson transition-colors hover:bg-crimson-bg"
                  >
                    <LogOut className="size-4 shrink-0" aria-hidden="true" />
                    Sair
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}
