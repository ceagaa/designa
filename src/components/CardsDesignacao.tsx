import type { ReactNode } from 'react'
import { CalendarDays, Clock, MapPin } from 'lucide-react'
import { ddMm, isoDeHoje } from '../lib/datas'
import { nomeDiaCurto } from '../lib/constants'
import { Kicker } from './ui'

/**
 * Cards de designação compartilhados entre a tela do administrador e a página
 * pública: mesmo visual, cores e fontes nos dois lados. O que muda é apenas o
 * que cada tela exibe ao redor (botões de admin, filtros etc.).
 */

/** Data de hoje resolvida uma vez (evita Date instável no render). */
const HOJE_ISO = isoDeHoje()

/** Bloco rotulado dentro de um card de destaque (Data, Designação, Voluntários…). */
function Bloco({
  rotulo,
  valor,
  destaque,
  className = '',
}: {
  rotulo: string
  valor: ReactNode
  destaque?: boolean
  className?: string
}) {
  return (
    <div className={`rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-white/60">{rotulo}</p>
      <p
        className={`mt-0.5 truncate ${destaque ? 'text-[15px] font-bold' : 'text-sm font-semibold'}`}
      >
        {valor}
      </p>
    </div>
  )
}

/* ------------------------------- CAMPO ------------------------------- */

/** Card de destaque do Campo: quem dirige a próxima (ou a atual) saída. */
export function CardHeroCampo({
  rotulo,
  especial,
  dia,
  nome,
  ajudante,
  local,
  horario,
  ehHoje,
  rodape,
}: {
  rotulo: string
  especial?: string | null
  dia: string
  nome?: string | null
  ajudante?: string | null
  local: string
  horario: string
  ehHoje: boolean
  /** Bloco extra do administrador (ex.: Territórios). */
  rodape?: ReactNode
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal to-teal-deep p-6 text-white shadow-xl ${
        ehHoje ? 'escala-hoje-branco' : ''
      }`}
    >
      <div
        className="pointer-events-none absolute -bottom-10 -right-8 size-44 rounded-full bg-white/10 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative z-10 flex items-center justify-between gap-3">
        <Kicker className="text-white/80">{rotulo}</Kicker>
        <span className="flex shrink-0 items-center gap-2">
          {especial ? (
            <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-bold tracking-wide text-white">
              {especial}
            </span>
          ) : null}
          {ehHoje ? (
            <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-bold tracking-wide text-teal-deep">
              <span className="size-1.5 animate-pulse rounded-full bg-crimson" aria-hidden="true" />
              HOJE
            </span>
          ) : null}
          <span className="rounded-full bg-white/15 px-3 py-0.5 text-xs font-bold tracking-wide text-white">
            {dia}
          </span>
        </span>
      </div>
      <div className="relative z-10 mt-3">
        <p className="text-[34px] font-extrabold leading-tight sm:text-4xl">
          {nome ?? 'Sem designação'}
        </p>
        {ajudante ? (
          <p className="mt-0.5 text-sm text-white/75">
            <span className="font-semibold text-white/60">Ajudante:</span> {ajudante}
          </p>
        ) : null}
      </div>
      <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
        <span className="flex min-w-0 items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate text-sm">{local}</span>
        </span>
        <span className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm">
          <Clock className="size-4 shrink-0" aria-hidden="true" />
          <span className="text-sm">{horario}</span>
        </span>
      </div>
      {rodape}
    </section>
  )
}

export interface ItemListaCampo {
  key: string
  iso: string
  diaSemana: number
  horario: string
  local: string
  nome?: string | null
  ajudante?: string | null
  especial?: string | null
  /** Selo à direita da linha de nomes (ex.: PRÓXIMA na página pública). */
  selo?: string | null
  /** Anel de destaque (próxima designação na página pública). */
  destaque?: boolean
}

/** Linha de "Próximos dias" do Campo (idêntica no admin e na página pública). */
export function LinhaCampo({ item }: { item: ItemListaCampo }) {
  const ehHoje = item.iso === HOJE_ISO
  return (
    <article
      className={`flex w-full items-start gap-3 rounded-xl bg-card p-4 shadow-sm ${
        ehHoje ? 'escala-hoje' : item.destaque && !ehHoje ? 'ring-2 ring-teal/35' : ''
      }`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-tint text-teal">
        <CalendarDays className="size-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {ehHoje ? (
            <span className="flex items-center gap-1 rounded-full bg-teal px-2 py-0.5 text-[11px] font-bold text-white">
              <span className="size-1.5 animate-pulse rounded-full bg-crimson" aria-hidden="true" />
              HOJE
            </span>
          ) : null}
          <span className="font-semibold text-ink">
            {nomeDiaCurto(item.diaSemana)}, {ddMm(item.iso)}
          </span>
          {item.especial ? (
            <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-bold text-ink-soft">
              {item.especial}
            </span>
          ) : null}
          <span className="ml-auto flex min-w-0 items-center gap-1 text-muted">
            <span className="shrink-0">{item.horario} -</span>
            <span className="truncate">{item.local}</span>
          </span>
        </span>
        <span className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
          {item.nome ? (
            <span className="text-[15px] font-bold text-teal">{item.nome}</span>
          ) : (
            <span className="text-[15px] font-bold text-crimson">Sem designação</span>
          )}
          {item.ajudante && item.nome ? (
            <span className="text-[13px] font-medium text-faint">/ {item.ajudante}</span>
          ) : null}
          {item.selo ? (
            <span className="ml-auto shrink-0 rounded-full bg-teal-tint px-2.5 py-0.5 text-[11px] font-bold text-teal">
              {item.selo}
            </span>
          ) : null}
        </span>
      </span>
    </article>
  )
}

/* -------------------------------- AVI -------------------------------- */

/** Card de destaque do AVI: a próxima reunião e quem serve em cada função. */
export function CardHeroAvi({
  rotulo,
  dia,
  ehHoje,
  linhas,
  designadas,
  total,
}: {
  rotulo: string
  dia: string
  ehHoje: boolean
  linhas: Array<{ id: string; rotulo: string; nome: string | null }>
  designadas: number
  total: number
}) {
  const faltam = total - designadas
  return (
    <section
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal to-teal-deep p-6 text-white shadow-xl ${
        ehHoje ? 'escala-hoje-branco' : ''
      }`}
    >
      <div
        className="pointer-events-none absolute -bottom-10 -right-8 size-44 rounded-full bg-white/10 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative z-10 flex items-center justify-between gap-3">
        <Kicker className="text-white/80">{rotulo}</Kicker>
        <span className="flex shrink-0 items-center gap-2">
          {ehHoje ? (
            <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-bold tracking-wide text-teal-deep">
              <span className="size-1.5 animate-pulse rounded-full bg-crimson" aria-hidden="true" />
              HOJE
            </span>
          ) : null}
          <span className="rounded-full bg-white/15 px-3 py-0.5 text-xs font-bold tracking-wide text-white">
            {designadas}/{total}
          </span>
        </span>
      </div>
      <div className="relative z-10 mt-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-white/60">Data</p>
        <p className="text-[34px] font-extrabold leading-tight sm:text-4xl">{dia}</p>
        <p className="mt-1 text-sm text-white/75">
          {faltam
            ? `${faltam} funç${faltam === 1 ? 'ão' : 'ões'} ainda sem designação.`
            : 'Todas as funções estão designadas para esta reunião.'}
        </p>
      </div>
      <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
        {linhas.map((linha) => (
          <div
            key={linha.id}
            className="rounded-xl bg-white/10 px-3 py-2.5 backdrop-blur-sm"
          >
            <p className="truncate text-[13px] font-semibold text-white/75">
              {linha.rotulo}
            </p>
            <p
              className={`mt-0.5 truncate text-base font-bold ${
                linha.nome ? '' : 'text-white/60'
              }`}
            >
              {linha.nome ?? '—'}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

export interface ItemListaAvi {
  key: string
  iso: string
  diaSemana: number
  resumo: string
  designadas: number
  total: number
  /** Funções da reunião, na ordem da planilha, para a lista hierárquica. */
  funcoes?: Array<{ id: string; rotulo: string; nome: string | null }>
}

/** Linha de "Designações futuras" do AVI (idêntica no admin e na página pública). */
export function LinhaAvi({ item }: { item: ItemListaAvi }) {
  const ehHoje = item.iso === HOJE_ISO
  const completo = item.designadas === item.total
  return (
    <article
      className={`flex w-full items-start gap-3 rounded-xl bg-card p-4 shadow-sm ${
        ehHoje ? 'escala-hoje' : ''
      }`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-tint text-teal">
        <CalendarDays className="size-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {ehHoje ? (
            <span className="flex items-center gap-1 rounded-full bg-teal px-2 py-0.5 text-[11px] font-bold text-white">
              <span className="size-1.5 animate-pulse rounded-full bg-crimson" aria-hidden="true" />
              HOJE
            </span>
          ) : null}
          <span className="font-semibold text-ink">
            {nomeDiaCurto(item.diaSemana)}, {ddMm(item.iso)}
          </span>
          <span
            className={`ml-auto shrink-0 text-[12px] font-bold ${
              completo ? 'text-success' : 'text-crimson'
            }`}
          >
            {item.designadas}/{item.total}
          </span>
        </span>

        {item.funcoes?.length ? (
          <span className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2">
            {item.funcoes.map((funcao) => (
              <span key={funcao.id} className="flex min-w-0 flex-col">
                <span className="truncate text-[10px] font-bold uppercase tracking-wide text-muted">
                  {funcao.rotulo}
                </span>
                <span
                  className={`truncate text-[13px] font-semibold leading-snug ${
                    funcao.nome ? 'text-ink' : 'text-faint'
                  }`}
                >
                  {funcao.nome ?? '—'}
                </span>
              </span>
            ))}
          </span>
        ) : (
          <span
            className={`mt-1 block break-words text-[13px] leading-snug ${
              item.resumo ? 'text-muted' : 'text-crimson'
            }`}
          >
            {item.resumo || 'Sem designação'}
          </span>
        )}
      </span>
    </article>
  )
}

/* -------------------------------- TPL -------------------------------- */

/** Card de destaque do TPL: a próxima saída, o ponto e quem forma a dupla. */
export function CardHeroTpl({
  rotulo,
  dia,
  ehHoje,
  ponto,
  turno,
  local,
  nomes,
  designadas,
  total,
}: {
  rotulo: string
  dia: string
  ehHoje: boolean
  ponto: string
  turno: string
  local: string | null
  nomes: Array<string | null>
  designadas: number
  total: number
}) {
  const dupla = nomes.filter((n): n is string => Boolean(n))
  return (
    <section
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal to-teal-deep p-6 text-white shadow-xl ${
        ehHoje ? 'escala-hoje-branco' : ''
      }`}
    >
      <div
        className="pointer-events-none absolute -bottom-10 -right-8 size-44 rounded-full bg-white/10 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative z-10 flex items-center justify-between gap-3">
        <Kicker className="text-white/80">{rotulo}</Kicker>
        <span className="flex shrink-0 items-center gap-2">
          {ehHoje ? (
            <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-bold tracking-wide text-teal-deep">
              <span className="size-1.5 animate-pulse rounded-full bg-crimson" aria-hidden="true" />
              HOJE
            </span>
          ) : null}
          <span className="rounded-full bg-white/15 px-3 py-0.5 text-xs font-bold tracking-wide text-white">
            {designadas}/{total}
          </span>
        </span>
      </div>
      <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
        <Bloco rotulo="Data" valor={dia} destaque />
        <Bloco rotulo="Retirada" valor={ponto} destaque />
        <Bloco
          rotulo="Trabalho"
          valor={`${turno}${local ? ` · ${local}` : ''}`}
          className="col-span-2"
        />
        <Bloco
          rotulo="Voluntários"
          valor={dupla.length ? dupla.join(' & ') : 'Sem designação'}
          className="col-span-2"
        />
      </div>
    </section>
  )
}

export interface ItemListaTpl {
  key: string
  iso: string
  diaSemana: number
  detalhe: string
  nomes: Array<string | null>
  designadas: number
  total: number
}

/** Linha de "Próximos dias" do TPL (idêntica no admin e na página pública). */
export function LinhaTpl({ item }: { item: ItemListaTpl }) {
  const ehHoje = item.iso === HOJE_ISO
  const incompleta = item.designadas < item.total
  const dupla = item.nomes.filter((n): n is string => Boolean(n))
  return (
    <article
      className={`flex w-full items-start gap-3 rounded-xl bg-card p-4 shadow-sm ${
        ehHoje ? 'escala-hoje' : ''
      }`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-tint text-teal">
        <CalendarDays className="size-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {ehHoje ? (
            <span className="flex items-center gap-1 rounded-full bg-teal px-2 py-0.5 text-[11px] font-bold text-white">
              <span className="size-1.5 animate-pulse rounded-full bg-crimson" aria-hidden="true" />
              HOJE
            </span>
          ) : null}
          <span className="font-semibold text-ink">
            {nomeDiaCurto(item.diaSemana)}, {ddMm(item.iso)}
          </span>
          <span
            className={`ml-auto shrink-0 text-[12px] font-bold ${
              incompleta ? 'text-crimson' : 'text-success'
            }`}
          >
            {item.designadas}/{item.total}
          </span>
        </span>
        <span className="mt-1 block text-[13px] leading-snug text-muted">{item.detalhe}</span>
        <span
          className={`mt-0.5 block break-words text-[15px] leading-snug ${
            dupla.length ? 'font-bold text-teal' : 'font-bold text-crimson'
          }`}
        >
          {dupla.length ? dupla.join(' / ') : 'Sem designação'}
        </span>
      </span>
    </article>
  )
}
