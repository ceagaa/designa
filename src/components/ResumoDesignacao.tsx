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
  Eraser,
  Eye,
  MapPin,
  PencilLine,
  Sparkles,
  Table2,
} from 'lucide-react'
import { MESES, infoDia, nomeDiaCurto } from '../lib/constants'
import { isoDeHoje } from '../lib/datas'
import { rotuloEspecial } from '../lib/feriados'
import { candidatosAjudantePara, candidatosPara } from '../lib/rodizio'
import { Botao, Kicker, Modal, Rotulo, Select } from './ui'

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

/** Card de ação: ícone, título, texto curto e botão (grade 2×2 da Designação). */
function CardAcao({
  icone,
  cor,
  titulo,
  texto,
  children,
}: {
  icone: ReactNode
  cor: string
  titulo: string
  texto: string
  children: ReactNode
}) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm">
      <span
        className={`flex size-9 items-center justify-center rounded-xl ${cor}`}
        aria-hidden="true"
      >
        {icone}
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-bold leading-snug text-ink">{titulo}</h3>
        <p className="mt-1 text-[12px] leading-snug text-muted">{texto}</p>
      </div>
      <div className="mt-auto">{children}</div>
    </article>
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
  aoAlterarDesignacao: (chave: string, idDirigente: string) => void
  aoAlterarAjudante: (chave: string, idDirigente: string) => void
  aoLimparDesignacao: () => void
  efetivasAjudante: Record<string, string>
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
  aoAlterarDesignacao,
  aoAlterarAjudante,
  aoLimparDesignacao,
  efetivasAjudante,
  aoVer,
  aoCopiarLink,
  aoConfigurar,
  aoCadastrar,
}: ResumoDesignacaoProps) {
  const [manualAberto, setManualAberto] = useState(false)
  const [diaManual, setDiaManual] = useState<Ocorrencia | null>(null)
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

  const anos = Array.from({ length: 9 }, (_, i) => ano - 4 + i)
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
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-[26px] font-bold tracking-tight text-ink">
              {MESES[mes]}
            </span>
            <span className="text-lg font-semibold text-muted">{ano}</span>
          </h1>
          <span
            className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${status.estilo}`}
            role="status"
          >
            <span className={`size-2 rounded-full ${status.ponto}`} aria-hidden="true" />
            {status.rotulo}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-card p-1 shadow-sm">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => (mes === 0 ? aoMudarData(ano - 1, 11) : aoMudarData(ano, mes - 1))}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-canvas text-teal transition-all hover:bg-teal-tint active:scale-95"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <Select
              aria-label="Mês"
              className="w-[8.5rem] border-transparent bg-canvas py-2 text-center font-semibold"
              value={mes}
              onChange={(e) => aoMudarData(ano, Number(e.target.value))}
            >
              {MESES.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Ano"
              className="w-20 border-transparent bg-canvas py-2 text-center font-semibold"
              value={ano}
              onChange={(e) => aoMudarData(Number(e.target.value), mes)}
            >
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </div>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => (mes === 11 ? aoMudarData(ano + 1, 0) : aoMudarData(ano, mes + 1))}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-canvas text-teal transition-all hover:bg-teal-tint active:scale-95"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {destaque ? (
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal to-teal-deep p-6 text-white shadow-xl">
          <div
            className="pointer-events-none absolute -bottom-10 -right-8 size-44 rounded-full bg-white/10 blur-2xl"
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-center justify-between gap-3">
            <Kicker className="text-white/80">{rotuloDestaque}</Kicker>
            <span className="flex shrink-0 items-center gap-2">
              {rotuloEspecial(destaque) ? (
                <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-bold tracking-wide text-white">
                  {rotuloEspecial(destaque)}
                </span>
              ) : null}
              <span className="rounded-full bg-white/15 px-3 py-0.5 text-xs font-bold tracking-wide text-white">
                {nomeDiaCurto(destaque.diaSemana)}, {ddMm(destaque.iso)}
              </span>
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <p className="text-[34px] font-extrabold leading-tight sm:text-4xl">
              {nomeDestaque ?? 'Sem designação'}
            </p>
            <p className="mt-1 text-sm text-white/80">
              {nomeDestaque
                ? 'Designação confirmada para a reunião de campo de hoje.'
                : 'Nenhum dirigente escalado para a reunião de campo de hoje.'}
            </p>
          </div>
          <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
            <span className="flex min-w-0 items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate text-sm">{destaque.campo.local}</span>
            </span>
            <span className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm">
              <Clock className="size-4 shrink-0" aria-hidden="true" />
              <span className="text-sm">{destaque.campo.horario}</span>
            </span>
          </div>
        </section>
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
              return (
                <article
                  key={oc.key}
                  className="flex w-full items-start gap-3 rounded-xl bg-card p-4 shadow-sm"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-tint text-teal">
                    <CalendarDays className="size-5" aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
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

      <section aria-label="Ações da designação" className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <CardAcao
            icone={<Sparkles className="size-5" />}
            cor="bg-teal text-white shadow-sm"
            titulo="Distribuição inteligente"
            texto="O rodízio monta a escala do mês seguindo a configuração."
          >
            {semDirigentes ? (
              <Botao variante="primario" className="w-full" onClick={aoCadastrar}>
                Cadastrar dirigentes
              </Botao>
            ) : (
              <Botao
                variante="primario"
                className="w-full"
                disabled={semCampos}
                onClick={aoGerar}
                title={semCampos ? 'Cadastre dias de campo primeiro' : undefined}
              >
                Gerar escala
              </Botao>
            )}
          </CardAcao>

          <CardAcao
            icone={<PencilLine className="size-5" />}
            cor="bg-crimson-bg text-crimson"
            titulo="Distribuição manual"
            texto="Ajuste um dia de cada vez: dirigente e ajudante."
          >
            <Botao
              className="w-full"
              disabled={semCampos || semDirigentes}
              onClick={() => setManualAberto(true)}
              title={
                semCampos
                  ? 'Cadastre dias de campo primeiro'
                  : semDirigentes
                    ? 'Cadastre um dirigente primeiro'
                    : undefined
              }
            >
              Ajustar dias
            </Botao>
          </CardAcao>

          <CardAcao
            icone={<Table2 className="size-5" />}
            cor="bg-paper text-ink"
            titulo="Ver tabela completa"
            texto="Confira e edite o mês inteiro em uma tabela."
          >
            <Botao className="w-full" onClick={aoMontar}>
              Abrir tabela
            </Botao>
          </CardAcao>

          <CardAcao
            icone={<CalendarPlus className="size-5" />}
            cor="bg-success-bg text-success"
            titulo={`Adiantar escala de ${proximoNome}`}
            texto={
              proximoPronto
                ? 'Pronta — confira a escala do próximo mês.'
                : 'Gere com antecedência a escala do próximo mês.'
            }
          >
            {proximoPronto ? (
              <Botao
                className="w-full"
                disabled={semCampos || semDirigentes}
                onClick={aoVerProximo}
                title={
                  semCampos
                    ? 'Cadastre dias de campo primeiro'
                    : semDirigentes
                      ? 'Cadastre um dirigente primeiro'
                      : undefined
                }
              >
                Ver escala
              </Botao>
            ) : (
              <Botao
                className="w-full"
                disabled={semCampos || semDirigentes}
                onClick={aoAdiantar}
                title={
                  semCampos
                    ? 'Cadastre dias de campo primeiro'
                    : semDirigentes
                      ? 'Cadastre um dirigente primeiro'
                      : undefined
                }
              >
                Adiantar agora
              </Botao>
            )}
          </CardAcao>
        </div>

        {pronta || designados > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex flex-wrap gap-2">
              {pronta ? (
                <Botao variante="vinho" onClick={aoVer}>
                  <Eye className="size-4" aria-hidden="true" />
                  Ver e baixar
                </Botao>
              ) : null}
              {pronta ? (
                <Botao onClick={aoCopiarLink}>
                  <ClipboardCopy className="size-4" aria-hidden="true" />
                  Copiar link
                </Botao>
              ) : null}
            </div>
            {designados > 0 ? (
              <button
                type="button"
                onClick={() => setLimparAberto(true)}
                className="flex items-center gap-1 text-[13px] font-semibold text-crimson transition-colors hover:text-crimson/80"
              >
                <Eraser className="size-4" aria-hidden="true" />
                Limpar designação
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

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
            variante="vinho"
            className="flex-1"
            onClick={() => {
              setLimparAberto(false)
              aoLimparDesignacao()
            }}
          >
            <Eraser className="size-4" aria-hidden="true" />
            Limpar
          </Botao>
        </div>
      </Modal>

      <Modal
        aberto={manualAberto}
        aoFechar={() => {
          setManualAberto(false)
          setDiaManual(null)
        }}
        titulo={
          diaManual
            ? `${infoDia(diaManual.diaSemana).nome}, ${ddMm(diaManual.iso)}`
            : 'Distribuição manual'
        }
        descricao={
          diaManual
            ? `${MESES[mes]} de ${ano} · escolha o dirigente deste dia`
            : 'Escolha o mês e ajuste um dia de cada vez.'
        }
        largura="max-w-lg"
      >
        {manualAberto && !diaManual ? (
          <div className="space-y-4 px-5 py-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Rotulo htmlFor="man-mes">Mês</Rotulo>
                <Select
                  id="man-mes"
                  value={mes}
                  onChange={(e) => aoMudarData(ano, Number(e.target.value))}
                >
                  {MESES.map((m, i) => (
                    <option key={m} value={i}>
                      {m}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Rotulo htmlFor="man-ano">Ano</Rotulo>
                <Select
                  id="man-ano"
                  value={ano}
                  onChange={(e) => aoMudarData(Number(e.target.value), mes)}
                >
                  {anos.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <p className="rounded-xl bg-teal-tint px-3 py-2 text-[13px] font-semibold text-teal-deep">
              {ocorrencias.length} dia{ocorrencias.length === 1 ? '' : 's'} de campo · {designados}{' '}
              designado{designados === 1 ? '' : 's'}
            </p>

            {ocorrencias.length ? (
              <div className="flex max-h-[45svh] flex-col gap-1.5 overflow-y-auto">
                {ocorrencias.map((oc) => {
                  const nome = porId.get(efetivas[oc.key])?.nome
                  return (
                    <button
                      key={oc.key}
                      type="button"
                      onClick={() => setDiaManual(oc)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-paper p-3 text-left transition-colors hover:border-teal active:bg-teal-tint/40"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="text-sm font-semibold text-ink">
                          {nomeDiaCurto(oc.diaSemana)}, {ddMm(oc.iso)}
                        </span>
                        <span className="mt-0.5 truncate text-[13px] text-muted">
                          {oc.campo.horario} - {oc.campo.local}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {nome ? (
                          <span className="max-w-32 truncate text-sm font-bold text-teal">
                            {nome}
                          </span>
                        ) : (
                          <span className="whitespace-nowrap rounded-full bg-crimson-bg px-2.5 py-1 text-xs font-bold text-crimson">
                            Sem designação
                          </span>
                        )}
                        <ChevronRight className="size-4 text-muted" aria-hidden="true" />
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] text-ink">
                Nenhum dia de campo em {MESES[mes]} de {ano}. Cadastre os dias na aba Locais.
              </p>
            )}

            <Botao variante="primario" className="w-full" onClick={() => setManualAberto(false)}>
              Concluir
            </Botao>
          </div>
        ) : null}

        {manualAberto && diaManual ? (
          <div className="space-y-4 px-5 py-4">
            <div className="rounded-xl bg-canvas p-3.5">
              <p className="text-sm font-semibold text-ink">
                {infoDia(diaManual.diaSemana).nome} · {MESES[mes]} de {ano}
              </p>
              <p className="mt-0.5 text-[13px] text-muted">
                {ddMm(diaManual.iso)} · {diaManual.campo.horario} · {diaManual.campo.local}
              </p>
            </div>

            <div>
              <Rotulo htmlFor="man-dir">Dirigente</Rotulo>
              <Select
                id="man-dir"
                value={efetivas[diaManual.key] ?? ''}
                onChange={(e) => aoAlterarDesignacao(diaManual.key, e.target.value)}
              >
                <option value="">— Sem designação —</option>
                {candidatosPara(diaManual, dirigentes).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                    {c.disponivel ? '' : ' (indisponível)'}
                  </option>
                ))}
              </Select>
              <p className="mt-1.5 text-[13px] text-muted">
                A escolha vira ajuste manual e não muda na próxima geração.
              </p>
            </div>

            <div>
              <Rotulo htmlFor="man-aju">Ajudante</Rotulo>
              <Select
                id="man-aju"
                value={efetivasAjudante[diaManual.key] ?? ''}
                onChange={(e) => aoAlterarAjudante(diaManual.key, e.target.value)}
              >
                <option value="">— Sem ajudante —</option>
                {candidatosAjudantePara(diaManual, dirigentes).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                    {c.disponivel ? '' : ' (indisponível)'}
                  </option>
                ))}
              </Select>
              <p className="mt-1.5 text-[13px] text-muted">
                Lista quem está habilitado como ajudante neste dia — o ajuste manual não afeta o
                rodízio automático.
              </p>
            </div>

            <div className="flex gap-2">
              <Botao className="flex-1" onClick={() => setDiaManual(null)}>
                Voltar à lista
              </Botao>
              <Botao variante="primario" className="flex-1" onClick={() => setDiaManual(null)}>
                Concluir
              </Botao>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
