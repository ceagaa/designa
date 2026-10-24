import type { Campo, Dirigente, Ocorrencia } from '../lib/dominio'
import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Clock,
  Eye,
  Map as Mapa,
  MapPin,
  MoreVertical,
  PencilLine,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { MESES, nomeDiaCurto } from '../lib/constants'
import { isoDeHoje } from '../lib/datas'
import { rotuloEspecial } from '../lib/feriados'
import { Botao, Kicker, Modal } from './ui'

function ddMm(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

/** Data de hoje resolvida uma vez (evita chamada instável de Date no render). */
const HOJE_ISO = isoDeHoje()
const [HOJE_ANO, HOJE_MES] = HOJE_ISO.split('-').map(Number)

/** Hora atual (HH:MM) resolvida uma vez: escolhe a saída certa em dias com várias saídas. */
const AGORA_HHMM = new Date().toTimeString().slice(0, 5)

interface Status {
  rotulo: string
  estilo: string
  ponto: string
}

/** Card de destaque em gradiente: quem dirige (hoje/próxima saída). */
function CardHero({
  rotulo,
  especial,
  dia,
  nome,
  local,
  horario,
  ehHoje,
}: {
  rotulo: string
  especial: string | null
  dia: string
  nome: string | null
  local: string
  horario: string
  ehHoje: boolean
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
        <p className="mt-1 text-sm text-white/80">
          {nome
            ? ehHoje
              ? 'Designação confirmada para a reunião de campo de hoje.'
              : 'Designação confirmada para esta reunião de campo.'
            : 'Nenhum dirigente escalado para esta reunião de campo.'}
        </p>
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
      <div className="relative z-10 mt-2 flex items-center gap-2 rounded-xl border border-dashed border-white/45 bg-white/10 px-3 py-2.5 backdrop-blur-sm">
        <Mapa className="size-4 shrink-0" aria-hidden="true" />
        <span className="text-sm font-semibold">Territórios</span>
        <span className="ml-auto rounded-full bg-white/25 px-2.5 py-0.5 text-[11px] font-bold tracking-wide">
          Em breve
        </span>
      </div>
      <p className="relative z-10 mt-1.5 text-xs text-white/70">
        O mapa do território (PDF, imagem ou link) abre aqui, abaixo do local e horário.
      </p>
    </section>
  )
}

/** Item do menu ⋮ (ações da escala). */
function ItemMenu({
  icone,
  cor,
  titulo,
  texto,
  onClick,
  desabilitado,
  aoFecharMenu,
}: {
  icone: ReactNode
  cor: string
  titulo: string
  texto: string
  onClick: () => void
  desabilitado?: boolean
  aoFecharMenu: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={desabilitado}
      onClick={() => {
        aoFecharMenu()
        onClick()
      }}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${cor}`} aria-hidden="true">
        {icone}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{titulo}</span>
        <span className="block text-[12px] leading-snug text-muted">{texto}</span>
      </span>
    </button>
  )
}

interface ResumoDesignacaoProps {
  ano: number
  mes: number
  aoMudarData: (ano: number, mes: number) => void
  ocorrencias: Ocorrencia[]
  efetivas: Record<string, string>
  dirigentes: Dirigente[]
  campos: Campo[]
  pronta: boolean
  proximoNome: string
  proximoPronto: boolean
  aoAdiantar: () => void
  aoVerProximo: () => void
  aoMontar: () => void
  aoGerar: () => void
  aoLimparDesignacao: () => void
  aoVer: () => void
  aoCopiarLink: () => void
  aoConfigurar: () => void
  aoCadastrar: () => void
}

export default function ResumoDesignacao({
  ano,
  mes,
  aoMudarData,
  ocorrencias,
  efetivas,
  dirigentes,
  campos,
  pronta,
  proximoNome,
  proximoPronto,
  aoAdiantar,
  aoVerProximo,
  aoMontar,
  aoGerar,
  aoLimparDesignacao,
  aoVer,
  aoCopiarLink,
  aoConfigurar,
  aoCadastrar,
}: ResumoDesignacaoProps) {
  const [menuAberto, setMenuAberto] = useState(false)
  const [gerarAberto, setGerarAberto] = useState(false)
  const [adiantarAberto, setAdiantarAberto] = useState(false)
  const [limparAberto, setLimparAberto] = useState(false)

  const ehMesAtual = ano === HOJE_ANO && mes === HOJE_MES - 1

  const proximas = ehMesAtual ? ocorrencias.filter((o) => o.iso >= HOJE_ISO) : ocorrencias
  const deHojeTodas = proximas.filter((o) => o.iso === HOJE_ISO)
  const deHoje = deHojeTodas.length
    ? (deHojeTodas.find((o) => String(o.campo.horario) >= AGORA_HHMM) ??
      deHojeTodas[deHojeTodas.length - 1])
    : null
  const destaque = deHoje ?? proximas[0] ?? null
  // A lista começa DEPOIS do que o card mostra: mesmo dia por horário (inclui
  // saídas gêmeas no mesmo horário), ou os dias seguintes — nunca repete o card.
  const posteriores = destaque
    ? proximas.filter((o) => {
        if (o.iso !== destaque.iso) return o.iso > destaque.iso
        const horario = String(o.campo.horario)
        const horarioCard = String(destaque.campo.horario)
        if (horario !== horarioCard) return horario > horarioCard
        return o.key !== destaque.key
      })
    : []
  const lista = posteriores.slice(0, 8)
  const restam = posteriores.length - lista.length

  const porId = new Map(dirigentes.map((d) => [d.id, d]))
  const designados = ocorrencias.filter((o) => efetivas[o.key]).length
  const pendentes = ocorrencias.length - designados
  const semCampos = !campos.length
  const semDirigentes = !dirigentes.length

  const status: Status = semCampos
    ? { rotulo: 'Sem dias de campo', estilo: 'bg-canvas text-muted', ponto: 'bg-muted' }
    : !ocorrencias.length
      ? { rotulo: 'Mês sem saídas', estilo: 'bg-canvas text-muted', ponto: 'bg-muted' }
      : pronta
        ? { rotulo: 'Designação pronta', estilo: 'bg-success-bg text-success', ponto: 'bg-success' }
        : {
            rotulo: 'Pendente de montar',
            estilo: 'bg-crimson-bg text-crimson',
            ponto: 'bg-crimson animate-pulse',
          }

  const nomeDestaque = destaque ? porId.get(efetivas[destaque.key])?.nome : undefined

  const rotuloDestaque = deHoje
    ? 'Quem dirige hoje'
    : ehMesAtual
      ? 'Próxima saída'
      : 'Primeira saída'

  return (
    <div className="space-y-6">
      {/* Seletor único de mês + chip de status + menu ⋮ */}
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
            aria-label="Ações da designação"
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
                aria-label="Ações da designação"
                className="absolute right-0 top-full z-30 mt-1.5 w-[17rem] divide-y divide-line-soft overflow-hidden rounded-xl border border-line bg-card py-0.5 shadow-xl"
              >
                <ItemMenu
                  icone={<Sparkles className="size-4" />}
                  cor="bg-teal text-white"
                  titulo="Gerar escala"
                  texto={semCampos ? 'Cadastre dias de campo primeiro' : 'Monta o mês pelo rodízio'}
                  desabilitado={semCampos}
                  onClick={() => setGerarAberto(true)}
                  aoFecharMenu={() => setMenuAberto(false)}
                />
                <ItemMenu
                  icone={<CalendarPlus className="size-4" />}
                  cor="bg-success-bg text-success"
                  titulo={proximoPronto ? `Ver escala de ${proximoNome}` : `Adiantar escala de ${proximoNome}`}
                  texto={
                    proximoPronto
                      ? 'Próxima escala já gerada — confira.'
                      : 'Gera a escala do mês seguinte com antecedência'
                  }
                  desabilitado={!proximoPronto && (semCampos || semDirigentes)}
                  onClick={() => (proximoPronto ? aoVerProximo() : setAdiantarAberto(true))}
                  aoFecharMenu={() => setMenuAberto(false)}
                />
                <ItemMenu
                  icone={<Trash2 className="size-4" />}
                  cor="bg-wine-soft text-wine"
                  titulo="Limpar designação"
                  texto="Apaga automáticas e ajustes do mês"
                  desabilitado={!designados}
                  onClick={() => setLimparAberto(true)}
                  aoFecharMenu={() => setMenuAberto(false)}
                />
              </div>
            </>
          ) : null}
        </div>
      </header>

      {destaque ? (
        <CardHero
          rotulo={rotuloDestaque}
          especial={rotuloEspecial(destaque)}
          dia={`${nomeDiaCurto(destaque.diaSemana)}, ${ddMm(destaque.iso)}`}
          nome={nomeDestaque ?? null}
          local={destaque.campo.local}
          horario={destaque.campo.horario}
          ehHoje={Boolean(deHoje)}
        />
      ) : (
        <section className="rounded-2xl border border-dashed border-line bg-card px-6 py-9 text-center">
          <CalendarDays className="mx-auto size-7 text-muted" aria-hidden="true" />
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
            {semCampos
              ? 'Cadastre os dias de campo (dia, horário e ponto de encontro) para ver a programação daqui.'
              : 'Este mês não tem saídas de campo configuradas.'}
          </p>
          {semCampos ? (
            <Botao className="mt-4" onClick={aoConfigurar}>
              Configurar dias de campo
            </Botao>
          ) : null}
        </section>
      )}

      {posteriores.length ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="text-lg font-semibold text-ink">Próximos dias</h2>
              {pendentes > 0 ? (
                <span className="shrink-0 rounded-full bg-line px-2 py-0.5 text-[11px] font-bold text-ink-soft">
                  {pendentes} pendência{pendentes === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
            <p className="shrink-0 text-sm text-muted">
              {designados}/{ocorrencias.length} designados
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {lista.map((oc) => {
              const nome = porId.get(efetivas[oc.key])?.nome
              const especial = rotuloEspecial(oc)
              const ehHoje = oc.iso === HOJE_ISO
              return (
                <article
                  key={oc.key}
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
                          <span
                            className="size-1.5 animate-pulse rounded-full bg-crimson"
                            aria-hidden="true"
                          />
                          HOJE
                        </span>
                      ) : null}
                      <span className="font-semibold text-ink">
                        {nomeDiaCurto(oc.diaSemana)}, {ddMm(oc.iso)}
                      </span>
                      {especial ? (
                        <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-bold text-ink-soft">
                          {especial}
                        </span>
                      ) : null}
                      <span className="ml-auto flex min-w-0 items-center gap-1 text-muted">
                        <span className="shrink-0">{oc.campo.horario} -</span>
                        <span className="truncate">{oc.campo.local}</span>
                      </span>
                    </span>
                    <span className="mt-1 block text-sm font-bold">
                      {nome ? (
                        <span className="text-teal">{nome}</span>
                      ) : (
                        <span className="text-crimson">Sem designação</span>
                      )}
                    </span>
                  </span>
                </article>
              )
            })}
          </div>
          {restam > 0 ? (
            <p className="px-1 text-[13px] text-muted">
              + {restam} saída{restam === 1 ? '' : 's'} neste mês
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Ação principal: ajustar os dias do mês na tabela completa. */}
      <div>
        <Botao
          variante="primario"
          className="w-full py-3.5 text-base shadow-sm"
          onClick={aoMontar}
        >
          <PencilLine className="size-5" aria-hidden="true" />
          Ajustar dias
        </Botao>
        <p className="mt-2 text-center text-[13px] text-muted">
          Abre a tabela do mês: troque dirigente e ajudante dia a dia.
        </p>
      </div>

      {/* Barra fixa acima da Bottom Nav: prévia/PDF e link. */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] z-30 border-t border-line bg-surface/95 px-4 py-2.5 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[640px] gap-2">
          <Botao
            variante="primario"
            className="min-w-0 flex-1"
            disabled={!pronta}
            onClick={aoVer}
            title={pronta ? undefined : 'Gere a designação primeiro'}
          >
            <Eye className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Ver e Baixar PDF</span>
          </Botao>
          <Botao
            className="min-w-0 flex-1"
            disabled={!pronta}
            onClick={aoCopiarLink}
            title={pronta ? undefined : 'Gere a designação primeiro'}
          >
            <ClipboardCopy className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Copiar link</span>
          </Botao>
        </div>
      </div>

      {/* Confirmar geração */}
      <Modal
        aberto={gerarAberto}
        aoFechar={() => setGerarAberto(false)}
        titulo={`Gerar escala de ${MESES[mes]} de ${ano}?`}
        descricao="O rodízio distribui os dias de campo conforme a configuração. Os ajustes manuais marcados na tabela são mantidos."
        largura="max-w-sm"
      >
        <div className="space-y-3 px-5 py-4">
          {semCampos ? (
            <p className="rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] text-ink">
              Cadastre os dias de campo primeiro (aba Locais).
            </p>
          ) : null}
          <div className="flex gap-2">
            <Botao className="flex-1" onClick={() => setGerarAberto(false)}>
              Cancelar
            </Botao>
            {semDirigentes ? (
              <Botao
                variante="primario"
                className="flex-1"
                onClick={() => {
                  setGerarAberto(false)
                  aoCadastrar()
                }}
              >
                Cadastrar dirigentes
              </Botao>
            ) : (
              <Botao
                variante="primario"
                className="flex-1"
                disabled={semCampos}
                onClick={() => {
                  setGerarAberto(false)
                  aoGerar()
                }}
              >
                <Sparkles className="size-4" aria-hidden="true" />
                Gerar
              </Botao>
            )}
          </div>
        </div>
      </Modal>

      {/* Confirmar adiantamento */}
      <Modal
        aberto={adiantarAberto}
        aoFechar={() => setAdiantarAberto(false)}
        titulo={`Adiantar escala de ${proximoNome}?`}
        descricao={`Gera a escala do mês seguinte agora, além de ${MESES[mes]} de ${ano}.`}
        largura="max-w-sm"
      >
        <div className="flex gap-2 px-5 py-4">
          <Botao className="flex-1" onClick={() => setAdiantarAberto(false)}>
            Cancelar
          </Botao>
          <Botao
            variante="sucesso"
            className="flex-1"
            onClick={() => {
              setAdiantarAberto(false)
              aoAdiantar()
            }}
          >
            <CalendarPlus className="size-4" aria-hidden="true" />
            Adiantar
          </Botao>
        </div>
      </Modal>

      {/* Confirmar limpeza */}
      <Modal
        aberto={limparAberto}
        aoFechar={() => setLimparAberto(false)}
        titulo="Limpar designação?"
        descricao={`Apaga todas as designações de ${MESES[mes]} de ${ano} (automáticas e ajustes manuais). Você pode gerar de novo quando quiser.`}
        largura="max-w-sm"
      >
        <div className="flex gap-2 px-5 py-4">
          <Botao className="flex-1" onClick={() => setLimparAberto(false)}>
            Cancelar
          </Botao>
          <Botao
            className="flex-1 border-wine bg-wine! text-white hover:bg-wine-dark! hover:border-wine-dark"
            onClick={() => {
              setLimparAberto(false)
              aoLimparDesignacao()
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Limpar
          </Botao>
        </div>
      </Modal>
    </div>
  )
}
