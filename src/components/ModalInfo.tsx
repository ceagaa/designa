import { useState } from 'react'
import { Info, Monitor, Moon, Sun } from 'lucide-react'
import type { Tema } from '../lib/tema'
import { definirTema } from '../lib/tema'
import { Modal } from './ui'

/** Versão exibida no rodapé do modal de info. */
const VERSAO = '1.0.0'

const FINALIDADE =
  'O Designa organiza a escala de designações da congregação: campo, ' +
  'áudio/vídeo & indicadores e transporte de literatura. Ele monta o mês pelo ' +
  'rodízio, deixa ajustar cada dia e publica a escala em um link público para ' +
  'a congregação inteira conferir.'

const PRIVACIDADE =
  'Usamos apenas os dados necessários para montar a escala: nome dos ' +
  'voluntários, disponibilidade e histórico de designações. Não vendemos nem ' +
  'compartilhamos essas informações com terceiros. Cada congregação enxerga ' +
  'somente os próprios dados e o acesso é protegido por e-mail e senha.'

const OPCOES_TEMA: Array<{ valor: Tema; rotulo: string; Icone: typeof Sun }> = [
  { valor: 'claro', rotulo: 'Claro', Icone: Sun },
  { valor: 'escuro', rotulo: 'Escuro', Icone: Moon },
  { valor: 'auto', rotulo: 'Automático', Icone: Monitor },
]

/**
 * Modal de informação das páginas públicas: abre de baixo para cima no celular
 * e traz versão, finalidade, privacidade e o ajuste de tema (claro/escuro/auto).
 */
export default function ModalInfo({
  aberto,
  aoFechar,
  tema,
  aoMudarTema,
}: {
  aberto: boolean
  aoFechar: () => void
  tema: Tema
  aoMudarTema: (novo: Tema) => void
}) {
  const [expandido, setExpandido] = useState<'finalidade' | 'privacidade' | null>('finalidade')

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Sobre o app" largura="max-w-md">
      <div className="space-y-5 px-5 py-4">
        {/* Tema */}
        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted">Aparência</h3>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {OPCOES_TEMA.map(({ valor, rotulo, Icone }) => {
              const ativo = tema === valor
              return (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => {
                    definirTema(valor)
                    aoMudarTema(valor)
                  }}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-[12px] font-semibold transition-colors ${
                    ativo
                      ? 'border-teal bg-teal-tint text-teal'
                      : 'border-line bg-card text-ink-soft hover:border-teal/40'
                  }`}
                >
                  <Icone className="size-4" aria-hidden="true" />
                  {rotulo}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-[12px] text-muted">
            No automático o app segue o tema do seu celular ou navegador.
          </p>
        </section>

        {/* Finalidade e privacidade (acordeão) */}
        <section className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
          {(
            [
              ['finalidade', 'Para que serve'],
              ['privacidade', 'Política de privacidade'],
            ] as const
          ).map(([id, rotulo]) => {
            const aberto = expandido === id
            return (
              <div key={id}>
                <button
                  type="button"
                  aria-expanded={aberto}
                  onClick={() => setExpandido(aberto ? null : id)}
                  className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left text-sm font-semibold text-ink"
                >
                  {rotulo}
                  <span
                    className={`shrink-0 text-muted transition-transform ${aberto ? 'rotate-90' : ''}`}
                    aria-hidden="true"
                  >
                    ›
                  </span>
                </button>
                {aberto ? (
                  <p className="px-3.5 pb-3.5 text-[13px] leading-relaxed text-muted">
                    {id === 'finalidade' ? FINALIDADE : PRIVACIDADE}
                  </p>
                ) : null}
              </div>
            )
          })}
        </section>

        {/* Versão */}
        <p className="flex items-center gap-2 text-[12px] text-muted">
          <Info className="size-4 shrink-0" aria-hidden="true" />
          Designa — versão {VERSAO}
        </p>
      </div>
    </Modal>
  )
}
