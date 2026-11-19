import type { Estado, SetorId, Usuario } from '../lib/dominio'
import type { LucideIcon } from 'lucide-react'
import { BookOpen, ChevronRight, MapPin, Radio } from 'lucide-react'
import { ROTULO_SETOR } from '../lib/dominio'
import { nomeMes } from '../lib/datas'
import { Kicker } from './ui'

interface CardSetor {
  setor: SetorId
  icone: LucideIcon
}

const CARDS: Record<SetorId, CardSetor> = {
  CAMPO: { setor: 'CAMPO', icone: MapPin },
  AUDIO_VIDEO: { setor: 'AUDIO_VIDEO', icone: Radio },
  TPL: { setor: 'TPL', icone: BookOpen },
}

/**
 * Home de Designações: cards grandes dos 3 setores.
 * Ajudante vê apenas o card do seu setor.
 */
export default function TelaDesignacoes({
  usuario,
  ano,
  mes,
  aoAbrir,
}: {
  usuario: Usuario
  estado: Estado
  ano: number
  mes: number
  aoAbrir: (tela: 'campo' | 'avi' | 'tpl') => void
}) {
  const setores: SetorId[] =
    usuario.papel === 'ADMIN'
      ? ['CAMPO', 'AUDIO_VIDEO', 'TPL']
      : usuario.setor
        ? [usuario.setor]
        : []

  function abrir(setor: SetorId) {
    aoAbrir(setor === 'CAMPO' ? 'campo' : setor === 'AUDIO_VIDEO' ? 'avi' : 'tpl')
  }

  return (
    <div className="space-y-4">
      <div>
        <Kicker className="text-teal">Setores</Kicker>
        <p className="mt-1 text-sm text-muted">
          Escolha um setor para ver a escala de{' '}
          <span className="font-semibold text-ink">
            {nomeMes(mes)} de {ano}
          </span>
          .
        </p>
      </div>

      <ul className="space-y-3">
        {setores.map((setor) => {
          const { icone: Icone } = CARDS[setor]
          return (
            <li key={setor}>
              <button
                type="button"
                onClick={() => abrir(setor)}
                className="flex w-full items-center gap-4 rounded-2xl bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-teal"
              >
                <span className="flex shrink-0 items-center justify-center text-ink" aria-hidden="true">
                  <Icone className="size-7" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-bold leading-snug text-ink">
                    {ROTULO_SETOR[setor]}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-faint" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
