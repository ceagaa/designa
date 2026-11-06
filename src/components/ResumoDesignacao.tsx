import type { Campo, Dirigente, Ocorrencia } from '../lib/dominio'
import { useState } from 'react'
import {
  CalendarDays,
  Eye,
  FileDown,
  PencilLine,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { MESES, nomeDiaCurto } from '../lib/constants'
import { ddMm, isoDeHoje, passouDaJanela } from '../lib/datas'
import { rotuloEspecial } from '../lib/feriados'
import { Botao, Modal, PopConfirm } from './ui'
import type { AcaoMenu, StatusDesignacao } from './CabecalhoDesignacao'
import { CabecalhoDesignacao } from './CabecalhoDesignacao'
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
  const [limparAberto, setLimparAberto] = useState(false)
  const [verCompletaAberto, setVerCompletaAberto] = useState(false)

  const ehMesAtual = ano === HOJE_ANO && mes === HOJE_MES - 1

  // Relevantes: no mês atual, "hoje" ainda dentro da janela de 3h + dias
  // futuros; designações de hoje já vencidas saem do destaque e da lista para
  // dar lugar à próxima saída. Nos demais meses, todas as ocorrências.
  const relevantes = ehMesAtual
    ? ocorrencias.filter((o) => (o.iso === HOJE_ISO ? !passouDaJanela(o) : o.iso > HOJE_ISO))
    : ocorrencias
  const deHojeTodas = relevantes.filter((o) => o.iso === HOJE_ISO)
  const deHoje = deHojeTodas.length
    ? (deHojeTodas.find((o) => String(o.campo.horario) >= AGORA_HHMM) ??
      deHojeTodas[deHojeTodas.length - 1])
    : null
  const destaque = deHoje ?? relevantes[0] ?? null
  // A lista começa DEPOIS do que o card mostra: mesmo dia por horário (inclui
  // saídas gêmeas no mesmo horário), ou os dias seguintes, nunca repete o card.
  const posteriores = destaque
    ? relevantes.filter((o) => {
        if (o.iso !== destaque.iso) return o.iso > destaque.iso
        const horario = String(o.campo.horario)
        const horarioCard = String(destaque.campo.horario)
        if (horario !== horarioCard) return horario > horarioCard
        return o.key !== destaque.key
      })
    : []
  const lista = posteriores.slice(0, 8)

  const porId = new Map(dirigentes.map((d) => [d.id, d]))
  const designados = ocorrencias.filter((o) => efetivas[o.key]).length
  const pendentes = ocorrencias.length - designados
  const semCampos = !campos.length
  const semDirigentes = !dirigentes.length
  /** Só dá para compartilhar com escala gerada e ao menos um dia designado. */
  const compartilhavel = gerado && designados > 0

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
      icone: <Eye className="size-4" />,
      cor: 'bg-teal-tint text-teal',
      titulo: 'Ver escala completa',
      texto: ocorrencias.length ? 'Lista todos os dias do mês' : 'Sem dias de campo neste mês',
      desabilitado: !ocorrencias.length,
      onClick: () => setVerCompletaAberto(true),
    },
    {
      icone: <Sparkles className="size-4" />,
      cor: 'bg-teal text-white',
      titulo: 'Gerar escala',
      texto: semCampos ? 'Cadastre dias de campo primeiro' : 'Monta o mês pelo rodízio',
      desabilitado: semCampos,
      onClick: () => setGerarAberto(true),
    },
    {
      icone: <PencilLine className="size-4" />,
      cor: 'bg-canvas text-ink-soft',
      titulo: 'Ajustar escala',
      texto: 'Abre a tabela do mês para trocar dia a dia',
      onClick: aoMontar,
    },
    {
      icone: <Trash2 className="size-4" />,
      cor: 'bg-perigo-fundo text-perigo-texto',
      titulo: 'Limpar designação',
      texto: 'Apaga automáticas e ajustes do mês',
      desabilitado: !designados && !gerado,
      onClick: () => setLimparAberto(true),
    },
    {
      icone: <FileDown className="size-4" />,
      cor: 'bg-canvas text-ink-soft',
      titulo: pdfOcupado ? 'Gerando PDF…' : 'Baixar PDF',
      texto: gerado ? 'Salva a escala do mês em PDF' : 'Gere a designação primeiro',
      desabilitado: !gerado || pdfOcupado,
      onClick: aoBaixarPdf,
    },
    {
      icone: <Share2 className="size-4" />,
      cor: 'bg-teal-tint text-teal',
      titulo: 'Compartilhar link',
      texto: compartilhavel
        ? 'Abre o link público da escala do mês'
        : 'Gere e designe pelo menos um dia para compartilhar',
      desabilitado: !compartilhavel,
      onClick: aoCompartilharLink,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Seletor único de mês + menu ⋮ (status agora vive junto da lista). */}
      <CabecalhoDesignacao
        ano={ano}
        mes={mes}
        aoMudarData={aoMudarData}
        status={status}
        acoes={acoesMenu}
        ocultarStatus
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
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${status.estilo}`}
              role="status"
            >
              <span className={`size-1.5 rounded-full ${status.ponto}`} aria-hidden="true" />
              {status.rotulo}
            </span>
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
        </section>
      ) : null}

      {/* Ver escala completa: só a lista, sem o card principal. */}
      <Modal
        aberto={verCompletaAberto}
        aoFechar={() => setVerCompletaAberto(false)}
        titulo="Escala completa"
        descricao={`Todos os dias de ${MESES[mes]} de ${ano}.`}
      >
        <div className="space-y-2 px-5 pb-8 pt-2">
          {ocorrencias.length ? (
            ocorrencias.map((oc) => (
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
            ))
          ) : (
            <p className="rounded-xl bg-card px-4 py-5 text-center text-sm text-muted">
              Nenhum dia de campo neste mês.
            </p>
          )}
        </div>
      </Modal>

      {/* Confirmar geração */}
      <Modal
        aberto={gerarAberto}
        aoFechar={() => setGerarAberto(false)}
        titulo={`Gerar escala de ${MESES[mes]} de ${ano}?`}
        cartaoAviso
        focoAoAbrir="ultimo"
        descricao="O rodízio distribui os dias de campo conforme a configuração. Os ajustes manuais marcados na tabela são mantidos."
      >
        <div className="space-y-3 px-5 pb-6 pt-1">
          {semCampos ? (
            <p className="rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] text-ink">
              Cadastre os dias de campo primeiro (aba Locais).
            </p>
          ) : null}
          {semDirigentes ? (
            <Botao
              variante="primario"
              className="w-full min-h-14 text-base"
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
              className="w-full min-h-14 text-base"
              disabled={semCampos}
              onClick={() => {
                setGerarAberto(false)
                aoGerar()
              }}
            >
              <Sparkles className="size-5" aria-hidden="true" />
              Gerar
            </Botao>
          )}
          <Botao
            variante="claro"
            className="w-full min-h-14 text-base"
            onClick={() => setGerarAberto(false)}
          >
            Cancelar
          </Botao>
        </div>
      </Modal>

      {/* Confirmar limpeza (popup centralizado) */}
      <PopConfirm
        aberto={limparAberto}
        aoFechar={() => setLimparAberto(false)}
        titulo="Limpar designação?"
        descricao={`Apaga todas as designações de ${MESES[mes]} de ${ano} (automáticas e ajustes manuais). Você pode gerar de novo quando quiser.`}
        confirmarRotulo="Limpar"
        aoConfirmar={() => {
          setLimparAberto(false)
          aoLimparDesignacao()
        }}
      />
    </div>
  )
}
