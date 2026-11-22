import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronRight, Monitor, Moon, Palette, ScrollText, ShieldCheck, Sun, Tag } from 'lucide-react'
import type { Tema } from '../lib/tema'
import { definirTema } from '../lib/tema'
import { Modal } from './ui'

/**
 * Sheet "Sobre o app": lista de opções (Política, Termos, Aparência, Versão).
 * As duas primeiras navegam para as páginas públicas `/privacidade` e
 * `/termos`, que são as URLs exigidas pelo consent screen do Google; as
 * outras abrem a própria subpágina dentro do sheet, com voltar no cabeçalho.
 * UI/UX do módulo modal-sobre (folha inferior PicPay: linhas de 68px com
 * ícone de 24px, seta e divisor de 1px, chips de tema e card de versão),
 * montado sobre o `Modal` compartilhado e com os textos do designa.
 */

const VERSAO = '2.1.8'

type Pagina = 'lista' | 'aparencia' | 'versao'

/** Itens da lista que só existem como página pública fora do sheet. */
type ItemLegal = 'privacidade' | 'termos'

type ItemLista = {
  id: ItemLegal | Exclude<Pagina, 'lista'>
  rotulo: string
  Icone: LucideIcon
}

const ITENS: ItemLista[] = [
  { id: 'privacidade', rotulo: 'Política de Privacidade', Icone: ShieldCheck },
  { id: 'termos', rotulo: 'Termos de Serviço', Icone: ScrollText },
  { id: 'aparencia', rotulo: 'Aparência', Icone: Palette },
  { id: 'versao', rotulo: 'Versão', Icone: Tag },
]

/** Páginas legais saem do sheet e abrem a rota pública correspondente. */
function abrirItem(id: ItemLista['id'], setPagina: (p: Pagina) => void) {
  if (id === 'privacidade') {
    window.location.assign('/privacidade')
    return
  }
  if (id === 'termos') {
    window.location.assign('/termos')
    return
  }
  setPagina(id)
}

const TEMAS: { id: Tema; rotulo: string; Icone: LucideIcon }[] = [
  { id: 'auto', rotulo: 'Automático', Icone: Monitor },
  { id: 'claro', rotulo: 'Claro', Icone: Sun },
  { id: 'escuro', rotulo: 'Escuro', Icone: Moon },
]

/**
 * Escolha de tema (3 chips). Usada na subpágina "Aparência" do sheet público
 * e no modal de Aparência da tela de Ajustes.
 */
export function EscolherTema({
  tema,
  aoMudarTema,
}: {
  tema: Tema
  aoMudarTema: (t: Tema) => void
}) {
  function escolher(t: Tema) {
    aoMudarTema(t)
    definirTema(t)
  }

  return (
    <div role="radiogroup" aria-label="Tema do aplicativo" className="grid grid-cols-3 gap-3">
      {TEMAS.map(({ id, rotulo, Icone }) => {
        const ativo = tema === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => escolher(id)}
            className={`flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-1 py-2 text-xs font-bold transition-colors ${
              ativo
                ? 'border-teal bg-teal text-white'
                : 'border-transparent bg-line-soft text-ink-soft hover:bg-line'
            }`}
          >
            <Icone className="size-5" strokeWidth={2} aria-hidden="true" />
            {rotulo}
          </button>
        )
      })}
    </div>
  )
}

export default function ModalInfo({
  aberto,
  aoFechar,
  tema,
  aoMudarTema,
  semAparencia = false,
}: {
  aberto: boolean
  aoFechar: () => void
  tema: Tema
  aoMudarTema: (t: Tema) => void
  /** Na versão logada a Aparência mora na lista de Ajustes, não aqui. */
  semAparencia?: boolean
}) {
  const [pagina, setPagina] = useState<Pagina>('lista')

  /** Toda saída do sheet passa por aqui: reabre sempre na lista. */
  function fechar() {
    setPagina('lista')
    aoFechar()
  }

  const itens = semAparencia ? ITENS.filter((i) => i.id !== 'aparencia') : ITENS
  const item = itens.find((i) => i.id === pagina)
  const titulo = pagina === 'lista' ? 'Sobre o app' : (item?.rotulo ?? 'Sobre o app')

  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      aoVoltar={pagina === 'lista' ? undefined : () => setPagina('lista')}
      titulo={titulo}

    >
      <div className="px-5 pb-8 pt-2">
        {pagina === 'lista' ? (
          <ul className="divide-y divide-line">
            {itens.map(({ id, rotulo, Icone }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => abrirItem(id, setPagina)}
                  className="flex min-h-[68px] w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition-colors hover:bg-line-soft"
                >
                  <Icone className="size-6 shrink-0 text-teal" strokeWidth={1.8} aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-[17px] font-bold leading-snug text-ink">
                    {rotulo}
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-faint" strokeWidth={2} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {pagina === 'aparencia' ? (
          <EscolherTema tema={tema} aoMudarTema={aoMudarTema} />
        ) : null}

        {pagina === 'versao' ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-line-soft px-4 py-3.5">
              <span className="text-sm font-bold text-ink">Versão do app</span>
              <span className="text-sm font-semibold text-muted">designa {VERSAO}</span>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
