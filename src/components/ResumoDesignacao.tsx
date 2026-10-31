import type { Campo, Dirigente, Ocorrencia } from '../lib/dominio'
import { useState } from 'react'
import { CalendarDays, CalendarPlus, PencilLine, Sparkles, Trash2 } from 'lucide-react'
import { MESES, nomeDiaCurto } from '../lib/constants'
import { ddMm, isoDeHoje } from '../lib/datas'
import { rotuloEspecial } from '../lib/feriados'
import { Botao, Modal } from './ui'
import type { AcaoMenu, StatusDesignacao } from './CabecalhoDesignacao'
import { BarraAcoesDesignacao, CabecalhoDesignacao } from './CabecalhoDesignacao'
import { AvisoTerritorios, CardHeroCampo, LinhaCampo } from './CardsDesignacao'

/** Data de hoje resolvida uma vez (evita chamada instável de Date no render). */
const HOJE_ISO = isoDeHoje()
const [HOJE_ANO, HOJE_MES] = HOJE_ISO.split('-').map(Number)

/** Hora atual (HH:MM) resolvida uma vez: escolhe a saída certa em dias com várias saídas. */
const AGORA_HHMM = new Date().toTimeString().slice(0, 5)

interface ResumoDesignacaoProps {
  ano: number
  mes: number
  aoMudarData: (ano: number, mes: number) => void
  ocorrencias: Ocorrencia[]
  efetivas: Record<string, string>
  efetivasAjudante: Record<string, string>
  dirigentes: Dirigente[]
  campos: Campo[]
  pronta: boolean
  gerado: boolean
  proximoNome: string
  proximoPronto: boolean
  aoAdiantar: () => void
  aoVerProximo: () => void
  aoMontar: () => void
  aoGerar: () => void
  aoLimparDesignacao: () => void
  aoBaixarPdf: () => void
  pdfOcupado: boolean
  aoCompartilharLink: () => void
  aoConfigurar: () => void
  aoCadastrar: () => void
}

export default function ResumoDesignacao({
  ano,
  mes,
  aoMudarData,
  ocorrencias,
  efetivas,
  efetivasAjudante,
  dirigentes,
  campos,
  pronta,
  gerado,
  proximoNome,
  proximoPronto,
  aoAdiantar,
  aoVerProximo,
  aoMontar,
  aoGerar,
  aoLimparDesignacao,
  aoBaixarPdf,
  pdfOcupado,
  aoCompartilharLink,
  aoConfigurar,
  aoCadastrar,
}: ResumoDesignacaoProps) {
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

  const status: StatusDesignacao = semCampos
    ? { rotulo: 'Sem dias de campo', estilo: 'bg-canvas text-muted', ponto: 'bg-muted' }
    : !ocorrencias.length
      ? { rotulo: 'Mês sem saídas', estilo: 'bg-canvas text-muted', ponto: 'bg-muted' }
      : pronta
        ? { rotulo: 'Designação pronta', estilo: 'bg-success-bg text-success', ponto: 'bg-success' }
        : gerado
          ? {
              rotulo: `Gerada · ${pendentes} sem designação`,
              estilo: 'bg-crimson-bg text-crimson',
              ponto: 'bg-crimson',
            }
        : {
            rotulo: 'Pendente de montar',
            estilo: 'bg-crimson-bg text-crimson',
            ponto: 'bg-crimson animate-pulse',
          }

  const nomeDestaque = destaque ? porId.get(efetivas[destaque.key])?.nome : undefined
  const ajudanteDestaque = destaque
    ? porId.get(efetivasAjudante[destaque.key])?.nome ?? null
    : null

  const rotuloDestaque = deHoje || ehMesAtual ? 'Próxima designação' : 'Primeira saída'

  const acoesMenu: AcaoMenu[] = [
    {
      icone: <Sparkles className="size-4" />,
      cor: 'bg-teal text-white',
      titulo: 'Gerar escala',
      texto: semCampos ? 'Cadastre dias de campo primeiro' : 'Monta o mês pelo rodízio',
      desabilitado: semCampos,
      onClick: () => setGerarAberto(true),
    },
    {
      icone: <CalendarPlus className="size-4" />,
      cor: 'bg-success-bg text-success',
      titulo: proximoPronto
        ? `Ver escala de ${proximoNome}`
        : `Adiantar escala de ${proximoNome}`,
      texto: proximoPronto
        ? 'Próxima escala já gerada — confira.'
        : 'Gera a escala do mês seguinte com antecedência',
      desabilitado: !proximoPronto && (semCampos || semDirigentes),
      onClick: () => (proximoPronto ? aoVerProximo() : setAdiantarAberto(true)),
    },
    {
      icone: <Trash2 className="size-4" />,
      cor: 'bg-wine-soft text-wine',
      titulo: 'Limpar designação',
      texto: 'Apaga automáticas e ajustes do mês',
      desabilitado: !designados && !gerado,
      onClick: () => setLimparAberto(true),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Seletor único de mês + chip de status + menu ⋮ */}
      <CabecalhoDesignacao
        ano={ano}
        mes={mes}
        aoMudarData={aoMudarData}
        status={status}
        acoes={acoesMenu}
      />

      {destaque ? (
        <CardHeroCampo
          rotulo={rotuloDestaque}
          especial={rotuloEspecial(destaque)}
          dia={`${nomeDiaCurto(destaque.diaSemana)}, ${ddMm(destaque.iso)}`}
          nome={nomeDestaque ?? null}
          ajudante={ajudanteDestaque}
          local={destaque.campo.local}
          horario={destaque.campo.horario}
          ehHoje={Boolean(deHoje)}
          rodape={<AvisoTerritorios />}
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
            {lista.map((oc) => (
              <LinhaCampo
                key={oc.key}
                item={{
                  key: oc.key,
                  iso: oc.iso,
                  diaSemana: oc.diaSemana,
                  horario: oc.campo.horario,
                  local: oc.campo.local,
                  nome: porId.get(efetivas[oc.key])?.nome ?? null,
                  ajudante: porId.get(efetivasAjudante[oc.key])?.nome ?? null,
                  especial: rotuloEspecial(oc),
                }}
              />
            ))}
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
          Ajustar escala
        </Botao>
        <p className="mt-2 text-center text-[13px] text-muted">
          Abre a tabela do mês: troque o voluntário e o ajudante dia a dia.
        </p>
      </div>

      {/* Barra fixa acima da Bottom Nav: gerar, PDF e link. */}
      <BarraAcoesDesignacao
        primaria={{
          rotulo: 'Gerar',
          icone: <Sparkles className="size-4" aria-hidden="true" />,
          desabilitado: semCampos,
          titulo: semCampos ? 'Cadastre dias de campo primeiro' : undefined,
          onClick: () => setGerarAberto(true),
        }}
        pdf={{
          onClick: aoBaixarPdf,
          desabilitado: !gerado,
          ocupado: pdfOcupado,
          titulo: gerado ? undefined : 'Gere a designação primeiro',
        }}
        link={{
          onClick: aoCompartilharLink,
          desabilitado: !gerado || !ocorrencias.some((oc) => efetivas[oc.key]),
          titulo: !gerado
            ? 'Gere a designação primeiro'
            : ocorrencias.some((oc) => efetivas[oc.key])
              ? undefined
              : 'Designe pelo menos um voluntário para compartilhar',
        }}
      />

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
                Cadastrar voluntários
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
