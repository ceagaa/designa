import type { ReactNode } from 'react'
import type { VarianteBotao } from '../lib/dominio'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, ChevronDown, MoreVertical, TriangleAlert, X } from 'lucide-react'

const VARIA: Record<VarianteBotao, string> = {
  primario: 'bg-teal text-white hover:bg-primario-hover border border-teal hover:border-primario-hover',
  vinho: 'bg-perigo text-white hover:bg-perigo-hover border border-perigo hover:border-perigo-hover',
  sucesso:
    'bg-success text-white hover:bg-success/90 border border-success hover:border-success/90',
  secundario: 'bg-paper text-ink border border-line hover:border-teal hover:text-teal',
  fantasma: 'border border-transparent text-muted hover:text-ink hover:bg-line-soft',
  perigo:
    'bg-perigo-fundo text-perigo-texto border border-perigo/20 hover:border-perigo/30',
  claro: 'bg-neutro-100 text-primary-700 hover:bg-neutro-200',
}

type BotaoProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBotao
  /** React 19: `ref` entra como prop comum e chega ao <button>. */
  ref?: React.Ref<HTMLButtonElement>
}

export function Botao({ variante = 'secundario', className = '', children, ...props }: BotaoProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition-[background-color,color,border-color,transform] duration-150 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 ${VARIA[variante]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

type RotuloProps = React.LabelHTMLAttributes<HTMLLabelElement>

export function Rotulo({ htmlFor, children }: RotuloProps) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold text-neutro-800">
      {children}
    </label>
  )
}

const BASE_CAMPO = 'campo'

export function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${BASE_CAMPO} ${className}`} {...props} />
}

export function Select({ className = '', children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block">
      <select className={`${BASE_CAMPO} appearance-none pr-8 ${className}`} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
    </span>
  )
}

type ChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  ativo: boolean
}

export function Chip({ ativo, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
        ativo
          ? 'border-teal bg-teal text-white'
          : 'border-line bg-paper text-muted hover:border-teal hover:text-teal'
      }`}
      {...props}
    >
      {children}
    </button>
  )
}

/** Item do menu ⋮ de uma linha de configuração (editar, excluir…). */
export interface ItemMenuKebab {
  rotulo: string
  icone: ReactNode
  perigo?: boolean
  onClick: () => void
}

/**
 * Menu ⋮ discreto para cada item cadastrado: abre as opções da linha
 * (editar/excluir) sem poluir a lista com botões sempre visíveis.
 */
export function MenuKebab({ rotulo, itens }: { rotulo: string; itens: ItemMenuKebab[] }) {
  const [aberto, setAberto] = useState(false)

  return (
    <span className="relative shrink-0">
      <button
        type="button"
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((atual) => !atual)}
        className="rounded-lg p-2 text-muted transition-colors hover:bg-canvas hover:text-ink"
      >
        <MoreVertical className="size-4" aria-hidden="true" />
      </button>

      {aberto ? (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            tabIndex={-1}
            onClick={() => setAberto(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            aria-label={rotulo}
            className="absolute right-0 top-full z-50 mt-1 w-40 divide-y divide-line-soft overflow-hidden rounded-xl border border-line bg-card py-0.5 shadow-xl"
          >
            {itens.map((item, i) => (
              <button
                key={i}
                type="button"
                role="menuitem"
                onClick={() => {
                  setAberto(false)
                  item.onClick()
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-canvas ${
                  item.perigo ? 'text-crimson' : 'text-ink'
                }`}
              >
                <span className="shrink-0" aria-hidden="true">
                  {item.icone}
                </span>
                <span className="min-w-0 truncate">{item.rotulo}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </span>
  )
}

/** Sobrelinha curta em caixa alta (label-uppercase da referência). */
export function Kicker({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={`text-[11px] font-bold uppercase tracking-[0.08em] ${className}`}
    >
      {children}
    </span>
  )
}

type ToggleProps = {
  checked: boolean
  aoMudar: (valor: boolean) => void
  rotulo?: string
  className?: string
  disabled?: boolean
}

/** Interruptor acessível (role=switch) no formato da referência: 44×24. */
export function Toggle({ checked, aoMudar, rotulo, className = '', disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={rotulo}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={() => !disabled && aoMudar(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        disabled
          ? 'cursor-not-allowed bg-line'
          : `cursor-pointer ${checked ? 'bg-teal' : 'bg-line'}`
      } ${className}`}
    >
      <span
        className={`absolute top-0.5 block size-5 rounded-full bg-paper shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

type VazioProps = {
  icone?: LucideIcon
  titulo: string
  acao?: ReactNode
}

export function Vazio({ icone: Icone, titulo, acao }: VazioProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-neutro-100 px-4 py-8 text-center">
      {Icone ? <Icone className="size-8 text-neutro-500" aria-hidden="true" /> : null}
      <p className="max-w-md text-sm font-semibold text-neutro-600">{titulo}</p>
      {acao}
    </div>
  )
}

type ModalProps = {
  aberto: boolean
  aoFechar: () => void
  titulo: string
  descricao?: string
  children: ReactNode
  /** Mostra o botão de voltar no cabeçalho (folhas com páginas internas). */
  aoVoltar?: () => void
  /**
   * Onde o foco vai após a animação de abertura: 'conteudo' (padrão) entra no
   * primeiro campo do conteúdo; 'ultimo' entra no último elemento, usado em
   * confirmações para começar no Cancelar (evita exclusão acidental com Enter).
   */
  focoAoAbrir?: 'conteudo' | 'ultimo'
  /**
   * Confirmação (8.3): a descrição vira um cartão de aviso no conteúdo
   * (fundo neutro-100, raio 16px, ícone TriangleAlert) em vez de subtítulo.
   */
  cartaoAviso?: boolean
  /** Chamado ~320ms após abrir (0ms com movimento reduzido). */
  aoPronto?: () => void
}

const DURACAO_ENTRADA = 300
const DURACAO_SAIDA = 250
const DURACAO_PRONTO = 320
const LIMIAR_ARRASTO = 90

const SELETOR_FOCO =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function movimentoReduzido(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

interface PopConfirmProps {
  aberto: boolean
  aoFechar: () => void
  titulo: string
  descricao: string
  /** Rótulo do botão destrutivo (padrão: "Excluir"). */
  confirmarRotulo?: string
  aoConfirmar: () => void
  /** Bloqueia o botão de confirmar durante uma operação assíncrona. */
  ocupado?: boolean
}

/**
 * Confirmação destrutiva em "popup" centralizado (diferente da folha inferior
 * de cadastro): aparece no centro da tela, com ícone de alerta, mensagem e os
 * botões empilhados (destrutivo primeiro, Cancelar embaixo).
 */
export function PopConfirm({
  aberto,
  aoFechar,
  titulo,
  descricao,
  confirmarRotulo = 'Excluir',
  aoConfirmar,
  ocupado = false,
}: PopConfirmProps) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const cancelar = useRef<HTMLButtonElement>(null)
  const anterior = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const raiz = dialogo.current
    if (!raiz || !aberto) return undefined
    anterior.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!raiz.open) raiz.showModal()
    const raf = requestAnimationFrame(() => cancelar.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [aberto])

  // Ao desmontar (aberto → false), devolve o foco ao gatilho.
  useEffect(
    () => () => {
      anterior.current?.focus?.({ preventScroll: true })
    },
    [],
  )

  if (!aberto) return null

  return createPortal(
    <dialog
      ref={dialogo}
      aria-modal="true"
      aria-labelledby="popconfirm-titulo"
      onCancel={(evento) => {
        evento.preventDefault()
        aoFechar()
      }}
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar()
      }}
      className="popconfirm"
    >
      <div className="flex flex-col items-center gap-3 px-6 pb-6 pt-7 text-center">
        <span
          className="grid size-12 place-items-center rounded-full bg-perigo-fundo text-perigo"
          aria-hidden="true"
        >
          <TriangleAlert className="size-6" strokeWidth={2} />
        </span>
        <h2 id="popconfirm-titulo" className="text-lg font-extrabold leading-snug text-ink">
          {titulo}
        </h2>
        <p className="text-sm leading-relaxed text-muted">{descricao}</p>
        <div className="mt-1 w-full space-y-3">
          <Botao
            variante="vinho"
            className="w-full min-h-14 text-base"
            disabled={ocupado}
            onClick={aoConfirmar}
          >
            {ocupado ? 'Aguarde…' : confirmarRotulo}
          </Botao>
          <Botao
            ref={cancelar}
            variante="claro"
            className="w-full min-h-14 text-base"
            disabled={ocupado}
            onClick={aoFechar}
          >
            Cancelar
          </Botao>
        </div>
      </div>
    </dialog>,
    document.body,
  )
}

export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  aoVoltar,
  focoAoAbrir = 'conteudo',
  cartaoAviso = false,
  aoPronto,
}: ModalProps) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const conteudo = useRef<HTMLDivElement>(null)
  const anterior = useRef<HTMLElement | null>(null)
  const arrasto = useRef<number | null>(null)
  const fechando = useRef(false)
  const timers = useRef<number[]>([])
  const aoProntoRef = useRef(aoPronto)

  const [montado, setMontado] = useState(false)
  const [pronto, setPronto] = useState(false)
  const [saindo, setSaindo] = useState(false)
  const [desloca, setDesloca] = useState<number | null>(null)

  useEffect(() => {
    aoProntoRef.current = aoPronto
  })

  /** Encerra a folha: fecha o <dialog>, devolve o foco ao gatilho e desmonta. */
  const encerrar = useCallback(() => {
    timers.current.forEach((timer) => clearTimeout(timer))
    timers.current = []
    const raiz = dialogo.current
    fechando.current = false
    setPronto(false)
    setSaindo(false)
    setDesloca(null)
    setMontado(false)
    if (raiz?.open) raiz.close()
    anterior.current?.focus?.({ preventScroll: true })
    anterior.current = null
  }, [])

  /** Foco depois da animação: primeiro campo do conteúdo (ou o último, em confirmações). */
  const focar = useCallback(() => {
    const raiz = dialogo.current
    if (!raiz) return
    const alvos = (no: ParentNode) => Array.from(no.querySelectorAll<HTMLElement>(SELETOR_FOCO))
    const todos = alvos(raiz)
    if (!todos.length) return
    if (focoAoAbrir === 'ultimo') {
      todos[todos.length - 1]?.focus()
      return
    }
    const noConteudo = conteudo.current ? alvos(conteudo.current) : []
    ;(noConteudo[0] ?? todos[0])?.focus()
  }, [focoAoAbrir])

  // Monta a folha quando abre (o <dialog> precisa existir antes do showModal).
  // Estado derivado em render: `aberto` liga, `encerrar` desliga após a saída.
  if (aberto && !montado) setMontado(true)

  // Abertura: showModal(), slide-up de 300ms e foco após a animação.
  useEffect(() => {
    if (!aberto || !montado) return undefined
    const raiz = dialogo.current
    if (!raiz) return undefined

    anterior.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    fechando.current = false
    if (!raiz.open) raiz.showModal()

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    // Dois frames: a folha nasce fora da tela antes de subir.
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setPronto(true))
    })

    timers.current.push(
      window.setTimeout(
        () => {
          aoProntoRef.current?.()
          focar()
        },
        movimentoReduzido() ? 0 : DURACAO_PRONTO,
      ),
    )

    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      timers.current.forEach((timer) => clearTimeout(timer))
      timers.current = []
      document.body.style.overflow = overflow
    }
  }, [aberto, montado, focar])

  // Fechamento: quando `aberto` vira false, desce a folha e só então fecha.
  useEffect(() => {
    if (aberto || !dialogo.current?.open || fechando.current) return
    fechando.current = true
    setDesloca(null)
    setSaindo(true)
    timers.current.push(window.setTimeout(encerrar, movimentoReduzido() ? 0 : DURACAO_SAIDA))
  }, [aberto, encerrar])

  // Desmontagem: fecha o <dialog> se o componente sair da tela ainda aberto.
  useEffect(
    () => () => {
      timers.current.forEach((timer) => clearTimeout(timer))
      if (dialogo.current?.open) dialogo.current.close()
    },
    [],
  )

  // Arrasto pela alça (7.3): segue o ponteiro e fecha a partir de 90px.
  const pressionarAlca = (evento: React.PointerEvent<HTMLDivElement>) => {
    if (evento.pointerType === 'mouse' && evento.button !== 0) return
    arrasto.current = evento.clientY
    evento.currentTarget.setPointerCapture(evento.pointerId)
    setDesloca(0)
  }

  const moverAlca = (evento: React.PointerEvent<HTMLDivElement>) => {
    if (arrasto.current === null) return
    setDesloca(Math.max(0, evento.clientY - arrasto.current))
  }

  const soltarAlca = (evento: React.PointerEvent<HTMLDivElement>) => {
    const inicio = arrasto.current
    arrasto.current = null
    if (inicio === null) return
    const deslocamento = Math.max(0, evento.clientY - inicio)
    setDesloca(null)
    if (deslocamento >= LIMIAR_ARRASTO) aoFechar()
  }

  const cancelarAlca = () => {
    arrasto.current = null
    setDesloca(null)
  }

  if (!montado) return null

  const estilo: React.CSSProperties =
    desloca !== null
      ? { transform: `translateY(${desloca}px)`, transition: 'none' }
      : {
          transform: pronto && !saindo ? 'translateY(0)' : 'translateY(100%)',
          transition: `transform ${saindo ? DURACAO_SAIDA : DURACAO_ENTRADA}ms cubic-bezier(0.32, 0.72, 0, 1)`,
        }

  // Portal para o body: a folha pode nascer dentro de headers com backdrop-blur
  // (que criam containing block e prendem o `fixed` na caixa do elemento).
  return createPortal(
    <dialog
      ref={dialogo}
      className="folha"
      style={estilo}
      // Papel explícito: o <dialog> já é role=dialog por implicação, mas o
      // atributo garante seletores `[role=dialog]` (testes e leitores de tela).
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-titulo"
      aria-describedby={descricao ? 'modal-descricao' : undefined}
      onCancel={(evento) => {
        // Esc não fecha "seco": passa pela animação de descida.
        evento.preventDefault()
        aoFechar()
      }}
      onClick={(evento) => {
        // Clique no backdrop (o alvo é o próprio <dialog>).
        if (evento.target === evento.currentTarget) aoFechar()
      }}
    >
      <div className="flex min-h-full flex-col">
        <div className="sticky top-0 z-10 rounded-t-[24px] bg-superficie">
          <div
            onPointerDown={pressionarAlca}
            onPointerMove={moverAlca}
            onPointerUp={soltarAlca}
            onPointerCancel={cancelarAlca}
            className="flex cursor-grab touch-none items-center justify-center pb-1 pt-2.5 select-none active:cursor-grabbing"
          >
            <span className="h-1.5 w-10 rounded-full bg-neutro-300" aria-hidden="true" />
          </div>
          <div className="grid min-h-11 grid-cols-[44px_1fr_44px] items-start gap-2 px-5 pb-4 pt-1">
            <div>
              {aoVoltar ? (
                <button
                  type="button"
                  onClick={aoVoltar}
                  aria-label="Voltar"
                  className="-ml-2.5 grid size-11 place-items-center rounded-full text-ink transition-colors hover:bg-neutro-100"
                >
                  <ArrowLeft className="size-5" strokeWidth={2} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <div className="min-w-0 pt-2 text-center">
              <h2 id="modal-titulo" className="text-lg font-extrabold leading-snug text-ink">
                {titulo}
              </h2>
              {descricao && !cartaoAviso ? (
                <p id="modal-descricao" className="mt-1 text-sm text-muted">
                  {descricao}
                </p>
              ) : null}
            </div>
            <div className="justify-self-end">
              <button
                type="button"
                onClick={aoFechar}
                aria-label="Fechar"
                className="-mr-2.5 grid size-11 place-items-center rounded-full bg-neutro-100 text-ink transition-colors hover:bg-neutro-200"
              >
                <X className="size-5" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
        {descricao && cartaoAviso ? (
          <div
            id="modal-descricao"
            className="mx-5 mb-1 mt-1 flex gap-3 rounded-2xl bg-neutro-100 p-4"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-superficie text-perigo">
              <TriangleAlert className="size-5" strokeWidth={2} aria-hidden="true" />
            </span>
            <p className="min-w-0 whitespace-pre-line text-sm text-ink">{descricao}</p>
          </div>
        ) : null}
        <div ref={conteudo} className="min-w-0 flex-1">
          {children}
        </div>
      </div>
    </dialog>,
    document.body,
  )
}

