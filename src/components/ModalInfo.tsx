import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronRight, Info, Monitor, Moon, Palette, ShieldCheck, Sun, Tag } from 'lucide-react'
import type { Tema } from '../lib/tema'
import { definirTema } from '../lib/tema'
import { Modal } from './ui'

/**
 * Sheet "Sobre o app": lista de opções (Para que serve, Política, Aparência,
 * Versão), cada uma abrindo a própria página dentro do sheet, com voltar no
 * cabeçalho. UI/UX do módulo modal-sobre (folha inferior PicPay: linhas de 68px
 * com ícone de 24px, seta e divisor de 1px, chips de tema e card de versão),
 * montado sobre o `Modal` compartilhado e com os textos do designa.
 */

const VERSAO = '1.0.0'

const FINALIDADE = {
  destaque:
    'O designa existe pra você montar a escala da congregação sem planilha e sem correria.',
  paragrafos: [
    'Aqui você monta a programação de cada semana, vê de relance quem ministra e quem ajuda, e cuida da lista de voluntários e dos locais de visita, tudo no celular ou no computador.',
    'Cada setor cuida do que é dele. Quem é ajudante do Campo ajusta só as designações e os voluntários do Campo, sem mexer no restante.',
    'E quem não tem conta também acompanha. As páginas de escala, AVI e TPL abrem direto pelo link, sem precisar entrar.',
  ],
}

const POLITICA = {
  introducao: 'A gente guarda o mínimo possível pra escala funcionar:',
  pontos: [
    {
      titulo: 'O que ficamos guardando',
      texto: 'Nome e telefone de quem colabora, o setor de cada um, e o e-mail de quem tem conta.',
    },
    {
      titulo: 'Publicidade e revenda',
      texto: 'Nada de anúncio, nada de revenda, nada de compartilhar seus dados com terceiros. Suas informações ficam numa base protegida e o acesso é por conta, cada pessoa vê só o que lhe cabe.',
    },
    {
      titulo: 'Quer mudar ou apagar algo?',
      texto: 'Se um dia quiser sair, é só pedir. A gente apaga o cadastro e tudo que é dele. Simples assim.',
    },
  ],
}

const APARENCIA =
  'Escolha como o app aparece no seu aparelho. Por padrão, ele acompanha o tema que o celular já está usando.'

const VERSAO_NOTA =
  'O designa é atualizado automaticamente. Você sempre abre a versão mais recente, sem precisar baixar nada. Escala de dirigentes, do jeito simples.'

type Pagina = 'lista' | 'finalidade' | 'politica' | 'aparencia' | 'versao'

type ItemLista = {
  id: Exclude<Pagina, 'lista'>
  rotulo: string
  Icone: LucideIcon
}

const ITENS: ItemLista[] = [
  { id: 'finalidade', rotulo: 'Para que serve', Icone: Info },
  { id: 'politica', rotulo: 'Política de privacidade', Icone: ShieldCheck },
  { id: 'aparencia', rotulo: 'Aparência', Icone: Palette },
  { id: 'versao', rotulo: 'Versão', Icone: Tag },
]

const TEMAS: { id: Tema; rotulo: string; Icone: LucideIcon }[] = [
  { id: 'auto', rotulo: 'Automático', Icone: Monitor },
  { id: 'claro', rotulo: 'Claro', Icone: Sun },
  { id: 'escuro', rotulo: 'Escuro', Icone: Moon },
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
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      aoVoltar={pagina === 'lista' ? undefined : () => setPagina('lista')}
      titulo={titulo}
      largura="max-w-md"
    >
      <div className="px-5 pb-8 pt-2">
        {pagina === 'lista' ? (
          <ul className="divide-y divide-line">
            {ITENS.map(({ id, rotulo, Icone }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setPagina(id)}
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

        {pagina === 'finalidade' ? (
          <div className="flex flex-col gap-4 text-[15px] leading-[1.625] text-ink-soft">
            <p className="font-bold text-ink">{FINALIDADE.destaque}</p>
            {FINALIDADE.paragrafos.map((paragrafo) => (
              <p key={paragrafo}>{paragrafo}</p>
            ))}
          </div>
        ) : null}

        {pagina === 'politica' ? (
          <div>
            <p className="mb-4 text-[15px] leading-[1.625] text-ink-soft">{POLITICA.introducao}</p>
            <ul className="flex flex-col gap-4">
              {POLITICA.pontos.map((ponto) => (
                <li key={ponto.titulo} className="flex gap-3">
                  <span className="mt-2 size-2 shrink-0 rounded-full bg-teal" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[15px] font-extrabold leading-snug text-ink">{ponto.titulo}</p>
                    <p className="mt-0.5 text-[14px] leading-[1.625] text-ink-soft">{ponto.texto}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {pagina === 'aparencia' ? (
          <div>
            <p className="mb-4 text-[15px] leading-[1.625] text-ink-soft">{APARENCIA}</p>
            <div role="radiogroup" aria-label="Tema do aplicativo" className="grid grid-cols-3 gap-3">
              {TEMAS.map(({ id, rotulo, Icone }) => {
                const ativo = tema === id
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    onClick={() => escolherTema(id)}
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
          </div>
        ) : null}

        {pagina === 'versao' ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-line-soft px-4 py-3.5">
              <span className="text-sm font-bold text-ink">Versão do app</span>
              <span className="text-sm font-semibold text-muted">designa {VERSAO}</span>
            </div>
            <p className="text-[14px] leading-[1.625] text-ink-soft">{VERSAO_NOTA}</p>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
