import type { ReactNode } from 'react'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, FileDown, MoreVertical, Share2 } from 'lucide-react'
import { MESES } from '../lib/constants'
import { Botao } from './ui'

/**
 * Cabeçalho padrão da tela de designação (Campo, AVI e TPL):
 * filtro `< mês/ano >`, chip de status e menu ⋮ com as ações do mês.
 */
export interface StatusDesignacao {
  rotulo: string
  estilo: string
  ponto: string
}

/** Item do menu ⋮ (ações da escala do mês). */
export interface AcaoMenu {
  icone: ReactNode
  cor: string
  titulo: string
  texto: string
  onClick: () => void
  desabilitado?: boolean
}

function ItemMenu({
  acao,
  aoFecharMenu,
}: {
  acao: AcaoMenu
  aoFecharMenu: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={acao.desabilitado}
      onClick={() => {
        aoFecharMenu()
        acao.onClick()
      }}
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${acao.cor}`}
        aria-hidden="true"
      >
        {acao.icone}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{acao.titulo}</span>
        <span className="block text-[12px] leading-snug text-muted">{acao.texto}</span>
      </span>
    </button>
  )
}

export function CabecalhoDesignacao({
  ano,
  mes,
  aoMudarData,
  status,
  acoes,
  rotuloMenu = 'Ações da designação',
}: {
  ano: number
  mes: number
  aoMudarData: (ano: number, mes: number) => void
  status: StatusDesignacao
  acoes: AcaoMenu[]
  rotuloMenu?: string
}) {
  const [menuAberto, setMenuAberto] = useState(false)

  return (
    <header className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-1 rounded-xl bg-card p-1 shadow-sm">
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => (mes === 0 ? aoMudarData(ano - 1, 11) : aoMudarData(ano, mes - 1))}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-teal transition-all hover:bg-teal-tint active:scale-95"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <p className="min-w-0 flex-1 truncate px-1 text-center text-[15px] font-bold tracking-tight text-ink">
          {MESES[mes]} <span className="font-semibold text-muted">{ano}</span>
        </p>
        <button
          type="button"
          aria-label="Próximo mês"
          onClick={() => (mes === 11 ? aoMudarData(ano + 1, 0) : aoMudarData(ano, mes + 1))}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-teal transition-all hover:bg-teal-tint active:scale-95"
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="relative flex shrink-0 items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${status.estilo}`}
          role="status"
        >
          <span className={`size-1.5 rounded-full ${status.ponto}`} aria-hidden="true" />
          {status.rotulo}
        </span>
        <button
          type="button"
          aria-label={rotuloMenu}
          aria-haspopup="menu"
          aria-expanded={menuAberto}
          onClick={() => setMenuAberto((aberto) => !aberto)}
          className="flex size-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-canvas hover:text-ink"
        >
          <MoreVertical className="size-5" aria-hidden="true" />
        </button>

        {menuAberto ? (
          <>
            <button
              type="button"
              aria-label="Fechar menu"
              tabIndex={-1}
              onClick={() => setMenuAberto(false)}
              className="fixed inset-0 z-20 cursor-default"
            />
            <div
              role="menu"
              aria-label={rotuloMenu}
              className="absolute right-0 top-full z-30 mt-1.5 w-[17rem] divide-y divide-line-soft overflow-hidden rounded-xl border border-line bg-card py-0.5 shadow-xl"
            >
              {acoes.map((acao, i) => (
                <ItemMenu key={i} acao={acao} aoFecharMenu={() => setMenuAberto(false)} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </header>
  )
}

/**
 * Envelope da barra fixa acima da Bottom Nav (mobile-first: safe-area + blur).
 * Usado pelas ações das telas de designação e pelo botão de novo voluntário.
 */
export function BarraFixa({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] z-30 border-t border-line bg-surface/95 px-4 py-2.5 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[640px] gap-2">{children}</div>
    </div>
  )
}

/**
 * Rodapé fixo padrão: ação principal + PDF + link, sempre acima da Bottom Nav.
 * Todas as telas de designação usam a mesma barra.
 */
export function BarraAcoesDesignacao({
  primaria,
  pdf,
  link,
}: {
  primaria?: {
    rotulo: string
    icone: ReactNode
    onClick: () => void
    desabilitado?: boolean
    titulo?: string
    rotuloOcupado?: string
    ocupado?: boolean
  }
  pdf: {
    onClick: () => void
    desabilitado?: boolean
    titulo?: string
    ocupado?: boolean
  }
  link: {
    onClick: () => void
    desabilitado?: boolean
    titulo?: string
  }
}) {
  return (
    <BarraFixa>
      {primaria ? (
        <Botao
          variante="primario"
          className="min-w-0 flex-1"
          disabled={primaria.desabilitado}
          title={primaria.titulo}
          onClick={primaria.onClick}
        >
          <span className="shrink-0" aria-hidden="true">
            {primaria.icone}
          </span>
          <span className="truncate">
            {primaria.ocupado && primaria.rotuloOcupado ? primaria.rotuloOcupado : primaria.rotulo}
          </span>
        </Botao>
      ) : null}

      <Botao
        className="min-w-0 flex-1"
        disabled={pdf.desabilitado || pdf.ocupado}
        title={pdf.titulo}
        onClick={pdf.onClick}
      >
        <FileDown className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{pdf.ocupado ? 'Gerando…' : 'PDF'}</span>
      </Botao>

      <Botao
        className="min-w-0 flex-1"
        disabled={link.desabilitado}
        title={link.titulo}
        onClick={link.onClick}
      >
        <Share2 className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate">Link</span>
      </Botao>
    </BarraFixa>
  )
}
