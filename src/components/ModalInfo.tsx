import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, Check, ChevronRight, Info, Monitor, Moon, Palette, ShieldCheck, Sparkles, Sun } from 'lucide-react'
import type { Tema } from '../lib/tema'
import { definirTema } from '../lib/tema'
import { Modal } from './ui'

/**
 * Sheet "Sobre o app" das páginas públicas: lista de opções (Para que serve,
 * Política, Aparência, Versão) — tocar numa opção abre a página dela dentro
 * do próprio sheet, com botão de voltar.
 */

const VERSAO = '1.0.0'

const FINALIDADE = `O designa existe pra você montar a escala da congregação sem planilha e sem correria.

Aqui você monta a programação de cada semana, vê de relance quem ministra e quem ajuda, e cuida da lista de voluntários e dos locais de visita — tudo no celular ou no computador.

Cada setor cuida do que é dele: quem é ajudante do Campo ajusta só as designações e os voluntários do Campo, sem mexer no restante.

E quem não tem conta também acompanha: as páginas de escala, AVI e TPL abrem direto pelo link, sem precisar entrar.`

const POLITICA = `A gente guarda o mínimo possível pra escala funcionar: nome e telefone de quem colabora, o setor de cada um, e o e-mail de quem tem conta.

Nada de anúncio, nada de revenda, nada de compartilhar seus dados com terceiros. Suas informações ficam numa base protegida e o acesso é por conta — cada pessoa vê só o que lhe cabe.

Se um dia quiser sair, é só pedir: a gente apaga o cadastro e tudo que é dele. Simples assim.`

type Pagina = 'lista' | 'finalidade' | 'politica' | 'aparencia' | 'versao'

type ItemLista = {
  id: Exclude<Pagina, 'lista'>
  rotulo: string
  resumo: string
  Icone: LucideIcon
}

const ITENS: ItemLista[] = [
  {
    id: 'finalidade',
    rotulo: 'Para que serve',
    resumo: 'O que é o designa',
    Icone: Sparkles,
  },
  {
    id: 'politica',
    rotulo: 'Política de privacidade',
    resumo: 'Como seus dados são usados',
    Icone: ShieldCheck,
  },
  {
    id: 'aparencia',
    rotulo: 'Aparência',
    resumo: 'Tema claro, escuro ou automático',
    Icone: Palette,
  },
  {
    id: 'versao',
    rotulo: 'Versão',
    resumo: `designa ${VERSAO}`,
    Icone: Info,
  },
]

const TEMAS: { id: Tema; rotulo: string; resumo: string; Icone: LucideIcon }[] = [
  { id: 'claro', rotulo: 'Claro', resumo: 'Fundo claro o tempo todo', Icone: Sun },
  { id: 'escuro', rotulo: 'Escuro', resumo: 'Fundo escuro o tempo todo', Icone: Moon },
  { id: 'auto', rotulo: 'Automático', resumo: 'Segue o aparelho', Icone: Monitor },
]

export default function ModalInfo({
  aberto,
  aoFechar,
  tema,
  aoMudarTema,
}: {
  aberto: boolean
  aoFechar: () => void
  tema: Tema
  aoMudarTema: (t: Tema) => void
}) {
  const [pagina, setPagina] = useState<Pagina>('lista')

  /** Toda saída do sheet passa por aqui: reabre sempre na lista. */
  function fechar() {
    setPagina('lista')
    aoFechar()
  }

  const item = ITENS.find((i) => i.id === pagina)
  const titulo = pagina === 'lista' ? 'Sobre o app' : (item?.rotulo ?? 'Sobre o app')

  function escolherTema(t: Tema) {
    aoMudarTema(t)
    definirTema(t)
  }

  return (
    <Modal aberto={aberto} aoFechar={fechar} titulo={titulo} largura="max-w-md">
      {pagina !== 'lista' ? (
        <button
          type="button"
          onClick={() => setPagina('lista')}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-teal transition-colors hover:text-teal-deep"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </button>
      ) : null}

      {pagina === 'lista' ? (
        <ul className="divide-y divide-line-soft overflow-hidden rounded-2xl border border-line bg-paper">
          {ITENS.map(({ id, rotulo, resumo, Icone }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => setPagina(id)}
                className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-line-soft/60"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-tint text-teal">
                  <Icone className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-ink">{rotulo}</span>
                  <span className="block truncate text-[13px] text-muted">{resumo}</span>
                </span>
                <ChevronRight className="size-4.5 shrink-0 text-faint" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {pagina === 'finalidade' ? (
        <div className="whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{FINALIDADE}</div>
      ) : null}

      {pagina === 'politica' ? (
        <div className="whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{POLITICA}</div>
      ) : null}

      {pagina === 'aparencia' ? (
        <ul className="divide-y divide-line-soft overflow-hidden rounded-2xl border border-line bg-paper">
          {TEMAS.map(({ id, rotulo, resumo, Icone }) => {
            const ativo = tema === id
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => escolherTema(id)}
                  className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-line-soft/60"
                >
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${ativo ? 'bg-teal text-white' : 'bg-teal-tint text-teal'}`}
                  >
                    <Icone className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-ink">{rotulo}</span>
                    <span className="block truncate text-[13px] text-muted">{resumo}</span>
                  </span>
                  {ativo ? <Check className="size-4.5 shrink-0 text-teal" aria-hidden="true" /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}

      {pagina === 'versao' ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-paper px-6 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-teal font-display text-2xl font-bold text-white">
            d
          </span>
          <p className="text-[15px] font-semibold text-ink">designa {VERSAO}</p>
          <p className="text-[13px] text-muted">Escala de dirigentes, do jeito simples.</p>
        </div>
      ) : null}
    </Modal>
  )
}
