import type { AptidaoId, DadosAvi, IrmaoProjecao } from '../lib/dominio'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  Eye,
  FileDown,
  PencilLine,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { FUNCOES_AVI } from '../lib/dominio'
import {
  CONGREGACAO_PADRAO,
  DIAS_DISPARO,
  DIAS_SEMANA,
  HORARIOS_DISPARO,
  infoDia,
  nomeDiaCurto,
} from '../lib/constants'
import { chaveMes, isoDeHoje, nomeMes } from '../lib/datas'
import {
  TITULO_AVI,
  aptidoesDe,
  designacoesDe,
  efetivasAvi,
  gerarAviDoMes,
  normalizarDadosAvi,
  ocorrenciasAvi,
  registroAviDe,
  slotAvi,
} from '../lib/avi'
import { carregarSetorExtenso, ErroAuth, salvarDadosSetor } from '../lib/authApi'
import type { TipoToast } from './Toast'
import { baixarPdf } from '../lib/export'
import AviCard from './AviCard'
import { Botao, Chip, Modal, PopConfirm, Select, Toggle, Vazio } from './ui'
import type { AcaoMenu, StatusDesignacao } from './CabecalhoDesignacao'
import { CabecalhoDesignacao } from './CabecalhoDesignacao'
import { CardHeroAvi, LinhaAvi } from './CardsDesignacao'
import { compartilharPagina } from '../lib/compartilhamento'

/** Data de hoje resolvida uma vez (oxlint: sem Date instável no render). */
const HOJE_ISO = isoDeHoje()
const [HOJE_ANO, HOJE_MES] = HOJE_ISO.split('-').map(Number)

interface Secao {
  id: 'fds' | 'meio'
  rotulo: string
  banda: string
  texto: string
  linha: string
}

const SECOES: readonly Secao[] = [
  {
    id: 'fds',
    rotulo: 'Fim de semana',
    banda: 'bg-primary-600 text-white',
    texto: 'text-primary-700',
    linha: 'border-primary-700/30',
  },
  {
    id: 'meio',
    rotulo: 'Meio de semana',
    banda: 'bg-perigo text-white',
    texto: 'text-perigo-texto',
    linha: 'border-perigo/30',
  },
]

function atendeReuniao(
  irmao: { reunioes?: 'semana' | 'fds' | 'ambos' },
  secao: 'fds' | 'meio',
): boolean {
  const reunioes = irmao.reunioes ?? 'ambos'
  if (reunioes === 'ambos') return true
  return secao === 'meio' ? reunioes === 'semana' : reunioes === 'fds'
}

/** Tela do setor AVI: escala mensal por designação, cadastro unificado e exportação. */
export default function TelaAvi({
  aoAvisar,
  aoIrParaPessoas,
  aoRegistrarVoltar,
  modoConfiguracao = false,
  slug,
}: {
  aoAvisar: (texto: string, tipo?: TipoToast) => void
  /** Abre a tela Voluntários (designações AVI), administrador. */
  aoIrParaPessoas?: () => void
  /** Diz ao header global como "voltar" dentro da tela (fecha o editor de escala). */
  aoRegistrarVoltar?: (aoVoltar: (() => void) | null) => void
  modoConfiguracao?: boolean
  slug?: string
}) {
  const [dadosBrutos, setDadosBrutos] = useState<unknown>(null)
  const [irmoes, setIrmoes] = useState<IrmaoProjecao[]>([])
  const [congregacao, setCongregacao] = useState(CONGREGACAO_PADRAO)
  const [carregado, setCarregado] = useState(false)
  const [falhaCarga, setFalhaCarga] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const [ano, setAno] = useState(() => new Date().getFullYear())
  const [mes, setMes] = useState(() => new Date().getMonth())
  const [confirmando, setConfirmando] = useState<'gerar' | 'limparEscala' | null>(null)
  const [ocupado, setOcupado] = useState(false)
  /** Abre a tabela do mês (ajuste dia a dia), igual ao "Ajustar escala" do Campo. */
  const [ajustando, setAjustando] = useState(false)
  /** Abre a lista completa do mês ("Ver escala completa"). */
  const [verCompletaAberto, setVerCompletaAberto] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  /** O botão voltar do header global fecha o editor antes de sair da tela. */
  useEffect(() => {
    aoRegistrarVoltar?.(ajustando ? () => setAjustando(false) : null)
    return () => aoRegistrarVoltar?.(null)
  }, [ajustando, aoRegistrarVoltar])

  const dados: DadosAvi = useMemo(() => normalizarDadosAvi(dadosBrutos), [dadosBrutos])
  const chave = chaveMes(ano, mes)

  useEffect(() => {
    let vivo = true
    setCarregado(false)
    setFalhaCarga(false)
    carregarSetorExtenso('AUDIO_VIDEO')
      .then((resposta) => {
        if (!vivo) return
        setDadosBrutos(resposta.dados)
        setIrmoes(resposta.dirigentes ?? [])
        setCongregacao(resposta.config?.congregacao ?? CONGREGACAO_PADRAO)
        setCarregado(true)
      })
      .catch((falha: unknown) => {
        if (!vivo) return
        setDadosBrutos(null)
        setCarregado(true)
        const sessaoExpirada =
          falha instanceof ErroAuth && (falha.status === 401 || falha.status === 403)
        setFalhaCarga(!sessaoExpirada)
        if (sessaoExpirada) aoAvisar('Sessão expirada. Entre novamente.', 'erro')
      })
    return () => {
      vivo = false
    }
    // Recarrega por tentativa.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [tentativa])

  const registro = registroAviDe(dados, chave)
  const efetivas = useMemo(() => efetivasAvi(registro), [registro])
  const ocorrencias = useMemo(
    () => ocorrenciasAvi(ano, mes, dados.diasReuniao),
    [ano, mes, dados.diasReuniao],
  )
  const gerado = Boolean(registro.geradoEm)

  const totalSlots = ocorrencias.length * FUNCOES_AVI.length
  const preenchidos = useMemo(() => {
    let n = 0
    for (const oc of ocorrencias) {
      for (const f of FUNCOES_AVI) if (efetivas[slotAvi(oc.iso, f.id)]) n += 1
    }
    return n
  }, [ocorrencias, efetivas])
  const pronta = gerado && totalSlots > 0 && preenchidos === totalSlots
  const temManuais = Object.keys(registro.manuais ?? {}).length > 0

  const aptosPorFuncao = useMemo(() => {
    const mapa = Object.fromEntries(
      FUNCOES_AVI.map((f) => [f.id, [] as string[]]),
    ) as Record<AptidaoId, string[]>
    for (const irmao of irmoes) {
      for (const aptidao of aptidoesDe(dados, irmao.id)) mapa[aptidao].push(irmao.id)
    }
    return mapa
  }, [dados, irmoes])

  const funcoesSemApto = FUNCOES_AVI.filter(
    (f) => ocorrencias.length > 0 && aptosPorFuncao[f.id].length === 0,
  )
  const porId = useMemo(() => new Map(irmoes.map((i) => [i.id, i])), [irmoes])

  const ehMesAtual = ano === HOJE_ANO && mes === HOJE_MES - 1
  const proximas = ehMesAtual ? ocorrencias.filter((o) => o.iso >= HOJE_ISO) : ocorrencias
  const destaque = proximas[0] ?? null
  const ehHoje = Boolean(destaque && destaque.iso === HOJE_ISO)
  /** Próximas reuniões depois do card de destaque (sem repetir o que já aparece). */
  const posteriores = destaque ? proximas.filter((o) => o.iso > destaque.iso) : []
  const lista = posteriores.slice(0, 8)
  const compartilhavel = gerado && preenchidos > 0

  function itemAvi(oc: { iso: string; diaSemana: number }) {
    const linhas = designacoesDe(oc.iso, efetivas, porId)
    return {
      key: oc.iso,
      iso: oc.iso,
      diaSemana: oc.diaSemana,
      resumo: linhas
        .filter((l) => l.nome)
        .map((l) => `${l.rotulo}: ${l.nome}`)
        .join(' · '),
      funcoes: linhas,
      designadas: linhas.filter((l) => l.nome).length,
      total: FUNCOES_AVI.length,
    }
  }

  const linhasDestaque = destaque ? designacoesDe(destaque.iso, efetivas, porId) : []
  const designadasDestaque = linhasDestaque.filter((l) => l.nome).length
  const rotuloDestaque = ehMesAtual ? 'Próxima reunião' : 'Primeira reunião'
  const diaDestaque = destaque
    ? `${nomeDiaCurto(destaque.diaSemana)}, ${destaque.iso.slice(8, 10)}/${destaque.iso.slice(5, 7)}`
    : ''

  // Enquanto o setor carrega, a tela já abre: chip neutro e conteúdo por extensão.
  const status: StatusDesignacao = !carregado
    ? { rotulo: '…', estilo: 'bg-canvas text-muted', ponto: 'bg-muted' }
    : !ocorrencias.length
      ? { rotulo: 'Mês sem reuniões', estilo: 'bg-canvas text-muted', ponto: 'bg-muted' }
      : pronta
        ? { rotulo: 'Designação pronta', estilo: 'bg-success-bg text-success', ponto: 'bg-success' }
        : gerado
          ? {
              rotulo: `Gerada · ${totalSlots - preenchidos} sem designação`,
              estilo: 'bg-crimson-bg text-crimson',
              ponto: 'bg-crimson',
            }
          : {
              rotulo: 'Pendente de gerar',
              estilo: 'bg-crimson-bg text-crimson',
              ponto: 'bg-crimson animate-pulse',
            }

  const acoesMenu: AcaoMenu[] = [
    {
      icone: <Eye className="size-4" />,
      cor: 'bg-teal-tint text-teal',
      titulo: 'Ver escala completa',
      texto: ocorrencias.length ? 'Lista todas as reuniões do mês' : 'Sem reuniões neste mês',
      desabilitado: !ocorrencias.length,
      onClick: () => setVerCompletaAberto(true),
    },
    {
      icone: <Sparkles className="size-4" />,
      cor: 'bg-teal text-white',
      titulo: 'Gerar escala',
      texto: !ocorrencias.length
        ? 'Sem reuniões neste mês'
        : 'Monta o mês pelo rodízio, mantendo ajustes',
      desabilitado: !ocorrencias.length,
      onClick: pedirGeracao,
    },
    {
      icone: <PencilLine className="size-4" />,
      cor: 'bg-canvas text-ink-soft',
      titulo: 'Ajustar escala',
      texto: 'Abre a tabela do mês para trocar dia a dia',
      onClick: () => setAjustando(true),
    },
    {
      icone: <Trash2 className="size-4" />,
      cor: 'bg-perigo-fundo text-perigo-texto',
      titulo: 'Limpar designação',
      texto: 'Apaga automáticas e ajustes do mês',
      desabilitado: !gerado && !temManuais,
      onClick: () => setConfirmando('limparEscala'),
    },
    {
      icone: <FileDown className="size-4" />,
      cor: 'bg-canvas text-ink-soft',
      titulo: 'Baixar PDF',
      texto: gerado ? 'Salva a escala do mês em PDF' : 'Gere a designação primeiro',
      desabilitado: !gerado,
      onClick: aoPdf,
    },
    {
      icone: <Share2 className="size-4" />,
      cor: 'bg-teal-tint text-teal',
      titulo: 'Compartilhar link',
      texto: compartilhavel
        ? 'Abre o link público da escala do mês'
        : 'Gere e designe ao menos uma função para compartilhar',
      desabilitado: !compartilhavel,
      onClick: copiarLinkPublico,
    },
  ]

  async function persistir(novos: DadosAvi): Promise<boolean> {
    // Nunca grave com o setor ainda carregando: `dados` estaria incompleto e o
    // PUT apagaria o que já existe no servidor.
    if (!carregado) return false
    setDadosBrutos(novos)
    try {
      await salvarDadosSetor('AUDIO_VIDEO', novos as unknown as Record<string, unknown>)
      return true
    } catch (falha) {
      if (falha instanceof ErroAuth && (falha.status === 401 || falha.status === 403)) {
        aoAvisar('Sessão expirada. Entre novamente.', 'erro')
      } else {
        aoAvisar('Não foi possível salvar na nuvem. Tente de novo.', 'erro')
      }
      return false
    }
  }

  /**
   * Estado mais recente do setor, direto da nuvem. Evita a corrida em que a
   * tela gera a escala com aptidões recém-salvas (voluntário criado em outra
   * tela) que ainda não estavam em memória, a geração sairia vazia.
   */
  async function dadosAtualizados(): Promise<{ dados: DadosAvi; irmoes: typeof irmoes }> {
    try {
      const resposta = await carregarSetorExtenso('AUDIO_VIDEO')
      setDadosBrutos(resposta.dados)
      setIrmoes(resposta.dirigentes ?? [])
      return {
        dados: normalizarDadosAvi(resposta.dados),
        irmoes: resposta.dirigentes ?? [],
      }
    } catch {
      // Sem rede/sessão: gera com o que já está em memória.
      return { dados, irmoes }
    }
  }

  function executarGeracao() {
    if (!carregado || ocupado) return
    setOcupado(true)
    setConfirmando(null)
    void dadosAtualizados().then((estado) => {
      const geradoNovo = gerarAviDoMes(estado.dados, estado.irmoes, chave, {
        forcar: true,
      })
      return persistir(geradoNovo).then(() => {
        setOcupado(false)
        aoAvisar(
          ocorrencias.length
            ? `Escala AVI de ${nomeMes(mes)} de ${ano} gerada.`
            : 'Nenhuma reunião AVI neste mês.',
        )
      })
    })
  }

  function pedirGeracao() {
    if (gerado) setConfirmando('gerar')
    else executarGeracao()
  }

  function alterarSlot(slot: string, idIrmao: string) {
    const manuais = { ...(registro.manuais ?? {}) }
    if (idIrmao === (registro.auto ?? {})[slot]) delete manuais[slot]
    else manuais[slot] = idIrmao
    void persistir({
      ...dados,
      escalas: { ...dados.escalas, [chave]: { ...registro, manuais } },
    })
  }

  function limparEscala() {
    const escalas = { ...dados.escalas }
    delete escalas[chave]
    void persistir({ ...dados, escalas }).then(() =>
      aoAvisar(`Escala de ${nomeMes(mes)} de ${ano} limpa.`, 'remocao'),
    )
    setConfirmando(null)
  }

  function alternarDiaReuniao(dia: number) {
    const selecionados = new Set(dados.diasReuniao)
    if (selecionados.has(dia)) {
      if (selecionados.size === 1) {
        aoAvisar('Selecione pelo menos um dia de reunião.', 'erro')
        return
      }
      selecionados.delete(dia)
    } else {
      selecionados.add(dia)
    }
    const diasReuniao = [...selecionados].sort((a, b) => a - b)
    const diaSemanaMeio = diasReuniao.find((d) => d >= 1 && d <= 5) ?? dados.diaSemanaMeio
    void persistir({ ...dados, diasReuniao, diaSemanaMeio }).then(() => {
      aoAvisar(
        gerado
          ? 'Dias de reunião atualizados. Gere a escala novamente para aplicar.'
          : 'Dias de reunião atualizados.',
      )
    })
  }

  function alterarGeracaoAutomatica(patch: Partial<DadosAvi['geracaoAutomatica']>) {
    void persistir({
      ...dados,
      geracaoAutomatica: { ...dados.geracaoAutomatica, ...patch },
    })
  }

  async function copiarLinkPublico() {
    if (!slug) {
      aoAvisar('Não foi possível identificar o link público deste setor.', 'erro')
      return
    }
    const url = `${window.location.origin}/escala/${encodeURIComponent(slug)}/AVI?mes=${encodeURIComponent(chave)}`
    const resultado = await compartilharPagina(
      url,
      TITULO_AVI,
      `Escala de ${TITULO_AVI}, ${nomeMes(mes)} de ${ano}`,
    )
    if (resultado === 'copiado') aoAvisar('Link público do AVI copiado.')
    else if (resultado === 'falhou') aoAvisar('Não foi possível compartilhar o link.', 'erro')
  }

  async function aoPdf() {
    try {
      await baixarPdf(cardRef.current, chave, 'avi')
    } catch {
      aoAvisar('Não foi possível gerar o PDF.')
    }
  }

  function mudarPara(novoAno: number, novoMes: number) {
    setAno(novoAno)
    setMes(novoMes)
    setAjustando(false)
  }

  if (modoConfiguracao) {
    return (
      <div className="space-y-5">
        <section className="rounded-2xl bg-card p-4 shadow-sm">
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Dias de reunião</legend>
            <p className="mt-1 text-[13px] text-muted">
              Selecione os dias da semana e do fim de semana em que há reunião.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {DIAS_SEMANA.map((dia) => (
                <Chip
                  key={dia.idx}
                  ativo={dados.diasReuniao.includes(dia.idx)}
                  onClick={() => alternarDiaReuniao(dia.idx)}
                >
                  {dia.curto}
                </Chip>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-ink">Geração automática</h2>
          <div className="divide-y divide-line-soft overflow-hidden rounded-xl bg-card shadow-sm">
            <div className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-semibold text-ink">Gerar escala do mês seguinte</p>
                <p className="mt-0.5 text-[13px] text-muted">
                  O agendamento segue o horário de São Paulo.
                </p>
              </div>
              <Toggle
                rotulo="Gerar escala AVI automaticamente"
                checked={dados.geracaoAutomatica.ativa}
                aoMudar={(ativa) => alterarGeracaoAutomatica({ ativa })}
              />
            </div>
            {dados.geracaoAutomatica.ativa ? (
              <>
                <div className="flex items-center justify-between gap-4 p-4">
                  <label htmlFor="avi-dia-disparo" className="text-sm font-semibold text-ink">
                    Dia do mês
                  </label>
                  <Select
                    id="avi-dia-disparo"
                    className="w-24"
                    value={dados.geracaoAutomatica.dia}
                    onChange={(e) =>
                      alterarGeracaoAutomatica({ dia: Number(e.target.value) })
                    }
                  >
                    {DIAS_DISPARO.map((dia) => (
                      <option key={dia} value={dia}>
                        {dia}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex items-center justify-between gap-4 p-4">
                  <label htmlFor="avi-hora-disparo" className="text-sm font-semibold text-ink">
                    Horário
                  </label>
                  <Select
                    id="avi-hora-disparo"
                    className="w-28"
                    value={dados.geracaoAutomatica.hora}
                    onChange={(e) => alterarGeracaoAutomatica({ hora: e.target.value })}
                  >
                    {HORARIOS_DISPARO.map((hora) => (
                      <option key={hora} value={hora}>
                        {hora}
                      </option>
                    ))}
                  </Select>
                </div>
              </>
            ) : null}
          </div>
        </section>

        {aoIrParaPessoas ? (
          <Botao variante="fantasma" className="w-full" onClick={aoIrParaPessoas}>
            Configurar designações em Voluntários
          </Botao>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {ajustando ? (
        <header className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-ink">
              {nomeMes(mes)} de {ano}
            </h2>
          </div>
        </header>
      ) : (
        <CabecalhoDesignacao
          ano={ano}
          mes={mes}
          aoMudarData={mudarPara}
          status={status}
          acoes={acoesMenu}
          ocultarStatus
        />
      )}

      {falhaCarga ? (
        <p className="flex items-center justify-between gap-2 rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] text-ink">
          Não foi possível carregar os dados do setor.
          <button
            type="button"
            className="font-bold text-crimson underline"
            onClick={() => setTentativa((t) => t + 1)}
          >
            Tentar de novo
          </button>
        </p>
      ) : null}

      {ajustando ? (
        <>

          {carregado && funcoesSemApto.length ? (
            <p className="rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] text-ink">
              Nenhum irmão apto para: {funcoesSemApto.map((f) => f.rotulo).join(', ')}. Marque as
              designações em Voluntários.
            </p>
          ) : null}

          {!ocorrencias.length ? (
            <Vazio
              icone={Sparkles}
              titulo={`Nenhuma reunião AVI em ${nomeMes(mes)} de ${ano}.`}
            />
          ) : (
            SECOES.map((secao) => {
              const reunioes = ocorrencias.filter((oc) => oc.secao === secao.id)
              if (!reunioes.length) return null
              return (
                <section key={secao.id} className="space-y-2">
                  <div className={`rounded-xl px-3 py-2 text-sm font-bold uppercase tracking-wide ${secao.banda}`}>
                    {secao.rotulo}
                  </div>
                  {reunioes.map((oc) => (
                    <article
                      key={oc.iso}
                      className={`rounded-2xl border bg-card p-4 shadow-sm ${secao.linha}`}
                    >
                      <h3 className={`text-sm font-bold ${secao.texto}`}>
                        {infoDia(oc.diaSemana).nome} · {oc.dia}/{String(mes + 1).padStart(2, '0')}
                      </h3>
                      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {FUNCOES_AVI.map((f) => {
                          const slot = slotAvi(oc.iso, f.id)
                          const idAtual = efetivas[slot] ?? ''
                          const aptos = new Set(aptosPorFuncao[f.id])
                          const opcoes = [...irmoes]
                            .filter((i) => i.ativo || i.id === idAtual)
                            .filter((i) => i.id === idAtual || atendeReuniao(i, oc.secao))
                            .sort((a, b) => Number(aptos.has(b.id)) - Number(aptos.has(a.id)) || a.nome.localeCompare(b.nome))
                          return (
                            <div key={f.id}>
                              <label
                                htmlFor={`avi-${slot}`}
                                className="block text-[12px] font-semibold text-muted"
                              >
                                {f.rotulo}
                              </label>
                              <Select
                                id={`avi-${slot}`}
                                className="mt-0.5"
                                value={idAtual}
                                onChange={(e) => alterarSlot(slot, e.target.value)}
                              >
                                <option value="">Sem designação</option>
                                {opcoes.map((i) => (
                                  <option key={i.id} value={i.id}>
                                    {i.nome}
                                    {aptos.has(i.id) ? '' : i.ativo ? ' (não apto)' : ' (inativo)'}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          )
                        })}
                      </div>
                    </article>
                  ))}
                </section>
              )
            })
          )}
        </>
      ) : (
        <>
          {!carregado ? (
            <section
              className="h-[15rem] animate-pulse rounded-2xl bg-card"
              aria-hidden="true"
            />
          ) : destaque ? (
            <CardHeroAvi
              rotulo={rotuloDestaque}
              dia={diaDestaque}
              ehHoje={ehHoje}
              linhas={linhasDestaque}
              designadas={designadasDestaque}
              total={FUNCOES_AVI.length}
            />
          ) : (
            <section className="rounded-2xl border border-dashed border-line bg-card px-6 py-9 text-center">
              <CalendarDays className="mx-auto size-7 text-muted" aria-hidden="true" />
              <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
                {!ocorrencias.length
                  ? 'Este mês não tem reuniões AVI. Ajuste os dias de reunião nas configurações do setor.'
                  : 'Não há mais reuniões AVI a partir de hoje neste mês.'}
              </p>
            </section>
          )}

          {lista.length ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="text-lg font-semibold text-ink">Designações futuras</h2>
                  <span className="shrink-0 rounded-full bg-line px-2 py-0.5 text-[11px] font-bold text-ink-soft">
                    {preenchidos}/{totalSlots} designações
                  </span>
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
                  <LinhaAvi key={oc.iso} item={itemAvi(oc)} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      {gerado ? (
        <div className="fixed left-[-10000px] top-0 w-[760px] overflow-hidden" aria-hidden="true">
          <AviCard
            ref={cardRef}
            congregacao={congregacao}
            ano={ano}
            mes={mes}
            dados={dados}
            irmoes={irmoes}
          />
        </div>
      ) : null}

      {/* Ver escala completa: todas as reuniões do mês, sem o card de destaque. */}
      <Modal
        aberto={verCompletaAberto}
        aoFechar={() => setVerCompletaAberto(false)}
        titulo="Escala completa"
        descricao={`Todas as reuniões de ${nomeMes(mes)} de ${ano}.`}
      >
        <div className="space-y-2 px-5 pb-8 pt-2">
          {ocorrencias.length ? (
            ocorrencias.map((oc) => <LinhaAvi key={oc.iso} item={itemAvi(oc)} />)
          ) : (
            <p className="rounded-xl bg-card px-4 py-5 text-center text-sm text-muted">
              Nenhuma reunião AVI neste mês.
            </p>
          )}
        </div>
      </Modal>

      <Modal
        aberto={confirmando === 'gerar'}
        aoFechar={() => setConfirmando(null)}
        cartaoAviso
        focoAoAbrir="ultimo"
        titulo="Gerar novamente?"
        descricao={`A escala de ${nomeMes(mes)} de ${ano} será refeita. Os ajustes manuais são preservados.`}
      >
        <div className="space-y-3 px-5 pb-6 pt-1">
          <Botao
            variante="primario"
            className="w-full min-h-14 text-base"
            onClick={() => executarGeracao()}
          >
            Gerar
          </Botao>
          <Botao
            variante="claro"
            className="w-full min-h-14 text-base"
            onClick={() => setConfirmando(null)}
          >
            Cancelar
          </Botao>
        </div>
      </Modal>

      <PopConfirm
        aberto={confirmando === 'limparEscala'}
        aoFechar={() => setConfirmando(null)}
        titulo="Limpar escala do mês?"
        descricao="A escala deste mês será apagada. Esta ação não pode ser desfeita."
        confirmarRotulo="Limpar"
        aoConfirmar={limparEscala}
      />
    </div>
  )
}
