import type { ReactNode } from 'react'
import type { VarianteBotao } from '../lib/dominio'
import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronDown, Minus, MoreVertical, Plus } from 'lucide-react'

const VARIA: Record<VarianteBotao, string> = {
  primario: 'bg-teal text-white hover:bg-teal-deep border border-teal hover:border-teal-deep',
  vinho: 'bg-crimson text-white hover:bg-[#7d2021] border border-crimson hover:border-[#7d2021]',
  sucesso:
    'bg-success text-white hover:bg-success/90 border border-success hover:border-success/90',
  secundario: 'bg-paper text-ink border border-line hover:border-teal hover:text-teal',
  fantasma: 'border border-transparent text-muted hover:text-ink hover:bg-line-soft',
  perigo:
    'bg-crimson/10 text-crimson border border-crimson/20 hover:bg-crimson/20 hover:border-crimson/30',
}

type BotaoProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBotao
}

export function Botao({ variante = 'secundario', className = '', children, ...props }: BotaoProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${VARIA[variante]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

type RotuloProps = React.LabelHTMLAttributes<HTMLLabelElement>

export function Rotulo({ htmlFor, children }: RotuloProps) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-[13px] font-semibold text-ink">
      {children}
    </label>
  )
}

const BASE_CAMPO =
  'w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-base text-ink placeholder:text-muted focus:border-teal'

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
            className="fixed inset-0 z-20 cursor-default"
          />
          <div
            role="menu"
            aria-label={rotulo}
            className="absolute right-0 top-full z-30 mt-1 w-40 divide-y divide-line-soft overflow-hidden rounded-xl border border-line bg-card py-0.5 shadow-xl"
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

type StepperProps = {
  valor: number
  aoMudar: (valor: number) => void
  min?: number
  max?: number
  sufixo?: string
  rotulo: string
}

/** Seletor numérico −/＋ (Limite mensal da referência). */
export function Stepper({ valor, aoMudar, min = 0, max = 30, sufixo = 'x', rotulo }: StepperProps) {
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-xl bg-canvas p-1">
      <button
        type="button"
        aria-label={`Diminuir ${rotulo}`}
        onClick={() => aoMudar(Math.max(min, valor - 1))}
        className="flex size-8 items-center justify-center rounded-lg bg-paper text-ink shadow-sm transition-transform active:scale-95"
      >
        <Minus className="size-4" />
      </button>
      <span className="w-10 text-center text-sm font-bold text-teal">
        {valor === 0 && min === 0 ? (
          <span title="Sem limite">∞</span>
        ) : (
          <>
            {valor}
            <span className="text-[11px] font-normal text-muted">{sufixo}</span>
          </>
        )}
      </span>
      <button
        type="button"
        aria-label={`Aumentar ${rotulo}`}
        onClick={() => aoMudar(Math.min(max, valor + 1))}
        className="flex size-8 items-center justify-center rounded-lg bg-paper text-ink shadow-sm transition-transform active:scale-95"
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}

type VazioProps = {
  icone?: LucideIcon
  titulo: string
  acao?: ReactNode
}

export function Vazio({ icone: Icone, titulo, acao }: VazioProps) {
  return (
    <div className="flex flex-col items-center gap-3 border border-dashed border-line bg-paper px-6 py-12 text-center">
      {Icone ? <Icone className="size-7 text-muted" aria-hidden="true" /> : null}
      <p className="max-w-md text-sm text-muted">{titulo}</p>
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
  largura?: string
}

export function Modal({ aberto, aoFechar, titulo, descricao, children, largura = 'max-w-2xl' }: ModalProps) {
  const painel = useRef<HTMLDivElement>(null)
  const anterior = useRef<HTMLElement | null>(null)
  // Callback em ref: o efeito do modal só depende de `aberto`, senão ele reexecuta
  // a cada tecla digitada e devolve o foco ao gatilho (derruba o teclado no celular).
  const aoFecharRef = useRef(aoFechar)

  useEffect(() => {
    aoFecharRef.current = aoFechar
  })

  useEffect(() => {
    if (!aberto) return undefined

    anterior.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const alvo = painel.current?.querySelector<HTMLElement>('button, [href], input, select, textarea')
    alvo?.focus()

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') aoFecharRef.current()
      if (evento.key !== 'Tab' || !painel.current) return

      const focaveis = painel.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focaveis.length) return

      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault()
        primeiro.focus()
      }
    }

    document.addEventListener('keydown', aoTeclar)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = overflow
      anterior.current?.focus?.()
    }
  }, [aberto])

  if (!aberto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar()
      }}
    >
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        className={`max-h-[92svh] w-full overflow-y-auto rounded-t-3xl border border-line bg-canvas shadow-2xl sm:rounded-3xl ${largura}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line bg-paper px-5 py-4">
          <div>
            <h2 id="modal-titulo" className="font-display text-lg text-ink">
              {titulo}
            </h2>
            {descricao ? <p className="mt-0.5 text-sm text-muted">{descricao}</p> : null}
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="rounded p-1.5 text-muted transition-colors hover:bg-line-soft hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path
                d="M18 6 6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

