import { useEffect, useRef, useState } from 'react'
import { Bell, CalendarCheck2, CalendarClock, CircleAlert, CloudOff, Users } from 'lucide-react'

export interface Notificacao {
  id: string
  titulo: string
  detalhe?: string
  tom: 'neutro' | 'sucesso' | 'alerta'
  aoClicar?: () => void
}

const ICONE: Record<Notificacao['tom'], typeof Bell> = {
  neutro: CalendarClock,
  sucesso: CalendarCheck2,
  alerta: CircleAlert,
}

const TOM: Record<Notificacao['tom'], { caixa: string; texto: string }> = {
  neutro: { caixa: 'bg-canvas text-ink-soft', texto: 'text-muted' },
  sucesso: { caixa: 'bg-success-bg text-success', texto: 'text-success' },
  alerta: { caixa: 'bg-crimson-bg text-crimson', texto: 'text-crimson' },
}

interface SinoProps {
  notificacoes: Notificacao[]
}

/**
 * Sino de notificações do header: lista o que precisa de atenção
 * (pendências, escala do próximo mês, sincronização) com badge de novas.
 */
export default function SinoNotificacoes({ notificacoes }: SinoProps) {
  const [aberto, setAberto] = useState(false)
  const [vistas, setVistas] = useState<Set<string>>(() => new Set())
  const raiz = useRef<HTMLDivElement>(null)

  const novas = notificacoes.filter((n) => !vistas.has(n.id)).length

  useEffect(() => {
    if (!aberto) return undefined
    function aoClicarFora(evento: MouseEvent) {
      if (!raiz.current?.contains(evento.target as Node)) setAberto(false)
    }
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', aoClicarFora)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('mousedown', aoClicarFora)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [aberto])

  function alternar() {
    const proximo = !aberto
    setAberto(proximo)
    if (proximo) setVistas(new Set(notificacoes.map((n) => n.id)))
  }

  return (
    <div ref={raiz} className="relative shrink-0">
      <button
        type="button"
        aria-label={
          novas
            ? `Notificações, ${novas} nova${novas === 1 ? '' : 's'}`
            : 'Notificações'
        }
        aria-expanded={aberto}
        aria-haspopup="true"
        onClick={alternar}
        className="relative flex size-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 active:bg-white/25"
      >
        <Bell className="size-[22px]" strokeWidth={1.8} aria-hidden="true" />
        {novas > 0 ? (
          <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-perigo text-[10px] font-bold text-white">
            {novas > 9 ? '9+' : novas}
          </span>
        ) : null}
      </button>

      {aberto ? (
        <div
          role="menu"
          aria-label="Notificações"
          className="absolute right-0 top-[calc(100%+6px)] z-20 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-card shadow-popover"
        >
          <p className="border-b border-line-soft px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
            Notificações
          </p>
          {notificacoes.length ? (
            <ul className="max-h-80 overflow-y-auto">
              {notificacoes.map((n) => {
                const Icone = ICONE[n.tom]
                return (
                  <li key={n.id} className="border-b border-line-soft last:border-0">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAberto(false)
                        n.aoClicar?.()
                      }}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas"
                    >
                      <span
                        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${TOM[n.tom].caixa}`}
                      >
                        <Icone className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">
                          {n.titulo}
                        </span>
                        {n.detalhe ? (
                          <span className={`block text-[13px] ${TOM[n.tom].texto}`}>
                            {n.detalhe}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="flex items-center gap-2 px-4 py-4 text-sm text-muted">
              <Users className="size-4" aria-hidden="true" />
              Tudo em dia por aqui.
            </p>
          )}
          {notificacoes.some((n) => n.tom === 'alerta') ? (
            <p className="flex items-center gap-1.5 bg-canvas px-4 py-2 text-[12px] text-muted">
              <CloudOff className="size-3.5" aria-hidden="true" />
              Dados salvos no D1 e neste aparelho.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
