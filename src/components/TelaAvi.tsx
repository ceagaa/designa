import type { AptidaoId, DadosAvi, IrmaoProjecao } from '../lib/dominio'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  FileDown,
  ImageDown,
  PencilLine,
  RefreshCcw,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { FUNCOES_AVI } from '../lib/dominio'
import {
  CITACAO,
  CONGREGACAO_PADRAO,
  DIAS_SEMANA,
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
import { baixarImagem, baixarPdf, capturarNo, compartilhar } from '../lib/export'
import AviCard from './AviCard'
import { Botao, Chip, Modal, Select, Toggle, Vazio } from './ui'
import type { AcaoMenu, StatusDesignacao } from './CabecalhoDesignacao'
import { BarraAcoesDesignacao, CabecalhoDesignacao } from './CabecalhoDesignacao'
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
    banda: 'bg-petrol text-white',
    texto: 'text-petrol',
    linha: 'border-petrol/30',
  },
  {
    id: 'meio',
    rotulo: 'Meio de semana',
    banda: 'bg-wine text-white',
    texto: 'text-wine',
    linha: 'border-wine/30',
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

const TITULO_CARTAO = TITULO_AVI
const DIAS_DISPARO = Array.from({ length: 31 }, (_, i) => i + 1)
const HORARIOS_DISPARO = Array.from(
  { length: 48 },
  (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`,
)

/** Tela do setor AVI: escala mensal por designação, cadastro unificado e exportação. */
export default function TelaAvi({
  aoAvisar,
  aoIrParaPessoas,
  modoConfiguracao = false,
  slug,
}: {
  aoAvisar: (texto: string) => void
  /** Abre a tela Voluntários (designações AVI) — administrador. */
  aoIrParaPessoas?: () => void
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
  const [confirmando, setConfirmando] = useState<
    'gerar' | 'adiantar' | 'limparAjustes' | 'limparEscala' | null
  >(null)
  const [ocupado, setOcupado] = useState(false)
  /** Abre a tabela do mês (ajuste dia a dia) — igual ao "Ajustar escala" do Campo. */
  const [ajustando, setAjustando] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

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
        if (sessaoExpirada) aoAvisar('Sessão expirada. Entre novamente.')
      })
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega por tentativa
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
  /** A reunião seguinte ganha um card próprio logo abaixo do destaque. */
  const seguinte = posteriores[0] ?? null
  const futuras = posteriores.slice(1)
  const lista = futuras.slice(0, 8)
  const restam = futuras.length - lista.length

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

  const proximo = mes === 11 ? { ano: ano + 1, mes: 0 } : { ano, mes: mes + 1 }
  const proximoChave = chaveMes(proximo.ano, proximo.mes)
  const proximoPronto = Boolean(registroAviDe(dados, proximoChave).geradoEm)
  const proximoNome = nomeMes(proximo.mes)

  // Enquanto o setor carrega, a tela já abre: chip neutro e conteúdo por extensão.
  const status: StatusDesignacao = !carregado
    ? { rotulo: '…', estilo: 'bg-canvas text-muted', ponto: 'bg-muted' }
    : !ocorrencias.length
      ? { rotulo: 'Mês sem reuniões', estilo: 'bg-canvas text-muted', ponto: 'bg-muted' }
      : pronta
        ? { rotulo: 'Designação pronta', estilo: 'bg-success-bg text-success', ponto: 'bg-success' }
        : gerado
          ? {
              rotulo: `Gerada · ${preenchidos}/${totalSlots} designações`,
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
      icone: <CalendarDays className="size-4" />,
      cor: 'bg-success-bg text-success',
      titulo: proximoPronto
        ? `Ver escala de ${proximoNome}`
        : `Adiantar escala de ${proximoNome}`,
      texto: proximoPronto
        ? 'Próxima escala já gerada — confira.'
        : 'Gera a escala do mês seguinte com antecedência',
      desabilitado: !proximoPronto && (!ocorrencias.length || !irmoes.length),
      onClick: () => {
        if (proximoPronto) mudarPara(proximo.ano, proximo.mes)
        else setConfirmando('adiantar')
      },
    },
    {
      icone: <Trash2 className="size-4" />,
      cor: 'bg-wine-soft text-wine',
      titulo: 'Limpar designação',
      texto: 'Apaga automáticas e ajustes do mês',
      desabilitado: !gerado && !temManuais,
      onClick: () => setConfirmando('limparEscala'),
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
        aoAvisar('Sessão expirada. Entre novamente.')
      } else {
        aoAvisar('Não foi possível salvar na nuvem. Tente de novo.')
      }
      return false
    }
  }

  /**
   * Estado mais recente do setor, direto da nuvem. Evita a corrida em que a
   * tela gera a escala com aptidões recém-salvas (voluntário criado em outra
   * tela) que ainda não estavam em memória — a geração sairia vazia.
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

  function adiantarProximoMes() {
    if (ocupado) return
    setOcupado(true)
    setConfirmando(null)
    void dadosAtualizados().then((estado) => {
      const geradoNovo = gerarAviDoMes(estado.dados, estado.irmoes, proximoChave, {
        forcar: true,
      })
      return persistir(geradoNovo).then(() => {
        setOcupado(false)
        aoAvisar(`Escala AVI de ${proximoNome} de ${proximo.ano} gerada.`)
      })
    })
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

  function limparAjustes() {
    void persistir({
      ...dados,
      escalas: { ...dados.escalas, [chave]: { ...registro, manuais: {} } },
    }).then(() => aoAvisar('Ajustes manuais removidos.'))
    setConfirmando(null)
  }

  function limparEscala() {
    const escalas = { ...dados.escalas }
    delete escalas[chave]
    void persistir({ ...dados, escalas }).then(() =>
      aoAvisar(`Escala de ${nomeMes(mes)} de ${ano} limpa.`),
    )
    setConfirmando(null)
  }

  function alternarDiaReuniao(dia: number) {
    const selecionados = new Set(dados.diasReuniao)
    if (selecionados.has(dia)) {
      if (selecionados.size === 1) {
        aoAvisar('Selecione pelo menos um dia de reunião.')
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
      aoAvisar('Não foi possível identificar o link público deste setor.')
      return
    }
    const url = `${window.location.origin}/escala/${encodeURIComponent(slug)}/AVI?mes=${encodeURIComponent(chave)}`
    const resultado = await compartilharPagina(
      url,
      TITULO_AVI,
      `Escala de ${TITULO_AVI} — ${nomeMes(mes)} de ${ano}`,
    )
    if (resultado === 'copiado') aoAvisar('Link público do AVI copiado.')
    else if (resultado === 'falhou') aoAvisar('Não foi possível compartilhar o link.')
  }

  function textoCompartilhado(): string {
    const linhas = [`*${TITULO_CARTAO}*`, `${congregacao} — ${nomeMes(mes)} de ${ano}`, '']
    for (const secao of SECOES) {
      for (const oc of ocorrencias) {
        if (oc.secao !== secao.id) continue
        linhas.push(`*${infoDia(oc.diaSemana).nome} ${oc.dia}*`)
        const partes = FUNCOES_AVI.map((f) => {
          const id = efetivas[slotAvi(oc.iso, f.id)]
          return `${f.rotulo}: ${id ? (porId.get(id)?.nome ?? '') : '—'}`
        })
        linhas.push(`> ${partes.join(' · ')}`)
      }
    }
    linhas.push('', `_${CITACAO}_`)
    return linhas.join('\n')
  }

  async function aoCompartilhar() {
    try {
      const canvas = await capturarNo(cardRef.current)
      const resultado = await compartilhar({
        canvas,
        chave,
        texto: textoCompartilhado(),
        prefixo: 'avi',
        titulo: `AVI de ${nomeMes(mes)} de ${ano}`,
      })
      if (resultado === 'copiado') aoAvisar('Texto da escala copiado.')
    } catch {
      aoAvisar('Não foi possível compartilhar agora.')
    }
  }

  async function aoPdf() {
    try {
      await baixarPdf(cardRef.current, chave, 'avi')
    } catch {
      aoAvisar('Não foi possível gerar o PDF.')
    }
  }

  async function aoPng() {
    try {
      await baixarImagem(cardRef.current, chave, 'avi')
    } catch {
      aoAvisar('Não foi possível gerar a imagem.')
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
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => setAjustando(false)}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-teal shadow-sm transition-all hover:bg-teal-tint active:scale-95"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-ink">Ajustar escala</h2>
            <p className="truncate text-[13px] text-muted">
              {nomeMes(mes)} de {ano}
            </p>
          </div>
          {aoIrParaPessoas ? (
            <Botao
              variante="fantasma"
              className="shrink-0 px-2.5 py-1.5 text-[13px]"
              onClick={aoIrParaPessoas}
            >
              Designações AVI
            </Botao>
          ) : (
            <span className="max-w-[55%] text-right text-[13px] text-muted">
              As designações ficam em Voluntários.
            </span>
          )}
        </header>
      ) : (
        <CabecalhoDesignacao
          ano={ano}
          mes={mes}
          aoMudarData={mudarPara}
          status={status}
          acoes={acoesMenu}
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

          <div className="flex flex-wrap gap-2">
            <Botao
              variante="primario"
              onClick={pedirGeracao}
              disabled={ocupado || !ocorrencias.length}
            >
              <Sparkles className="size-4" aria-hidden="true" />
              {gerado ? 'Gerar novamente' : 'Gerar escala'}
            </Botao>
            {temManuais ? (
              <Botao variante="secundario" onClick={() => setConfirmando('limparAjustes')}>
                <RefreshCcw className="size-4" aria-hidden="true" />
                Limpar ajustes
              </Botao>
            ) : null}
          </div>

          {gerado ? (
            <div className="flex flex-wrap gap-2">
              <Botao variante="secundario" onClick={aoPdf}>
                <FileDown className="size-4" aria-hidden="true" />
                Baixar PDF
              </Botao>
              <Botao variante="secundario" onClick={aoPng}>
                <ImageDown className="size-4" aria-hidden="true" />
                Baixar PNG
              </Botao>
              <Botao variante="secundario" onClick={aoCompartilhar}>
                <Share2 className="size-4" aria-hidden="true" />
                Compartilhar
              </Botao>
            </div>
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
                                <option value="">— Sem designação —</option>
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

          {seguinte ? <LinhaAvi item={itemAvi(seguinte)} /> : null}

          {lista.length ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2 px-1">
                <h2 className="text-lg font-semibold text-ink">Designações futuras</h2>
                <p className="shrink-0 text-sm text-muted">
                  {preenchidos}/{totalSlots} designações
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {lista.map((oc) => (
                  <LinhaAvi key={oc.iso} item={itemAvi(oc)} />
                ))}
              </div>
              {restam > 0 ? (
                <p className="px-1 text-[13px] text-muted">
                  + {restam} reunião{restam === 1 ? '' : 'ões'} neste mês
                </p>
              ) : null}
            </section>
          ) : null}

          {/* Ação principal: ajustar os dias do mês na tabela completa. */}
          <div>
            <Botao
              variante="primario"
              className="w-full py-3.5 text-base shadow-sm"
              onClick={() => setAjustando(true)}
            >
              <PencilLine className="size-5" aria-hidden="true" />
              Ajustar escala
            </Botao>
            <p className="mt-2 text-center text-[13px] text-muted">
              Abre a tabela do mês: troque o voluntário de cada função dia a dia.
            </p>
          </div>

          <BarraAcoesDesignacao
            primaria={{
              rotulo: 'Gerar',
              icone: <Sparkles className="size-4" aria-hidden="true" />,
              desabilitado: !ocorrencias.length,
              titulo: !ocorrencias.length ? 'Sem reuniões AVI neste mês' : undefined,
              onClick: pedirGeracao,
            }}
            pdf={{
              onClick: aoPdf,
              desabilitado: !gerado,
              titulo: gerado ? undefined : 'Gere a designação primeiro',
            }}
            link={{
              onClick: copiarLinkPublico,
              desabilitado: !gerado || !preenchidos,
              titulo: !gerado
                ? 'Gere a designação primeiro'
                : preenchidos
                  ? undefined
                  : 'Designe pelo menos uma função para compartilhar',
            }}
          />
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

      <Modal
        aberto={confirmando !== null}
        aoFechar={() => setConfirmando(null)}
        titulo={
          confirmando === 'gerar'
            ? 'Gerar novamente?'
            : confirmando === 'adiantar'
              ? `Adiantar escala de ${proximoNome}?`
              : confirmando === 'limparAjustes'
                ? 'Limpar ajustes manuais?'
                : 'Limpar escala do mês?'
        }
        descricao={
          confirmando === 'gerar'
            ? `A escala de ${nomeMes(mes)} de ${ano} será refeita. Os ajustes manuais são preservados.`
            : confirmando === 'adiantar'
              ? `A escala de ${proximoNome} de ${proximo.ano} será gerada agora pelo rodízio.`
              : confirmando === 'limparAjustes'
                ? 'Todas as linhas voltam ao rodízio automático.'
                : 'A escala deste mês será apagada. Esta ação não pode ser desfeita.'
        }
        largura="max-w-sm"
      >
        <div className="flex gap-2 px-5 py-4">
          <Botao className="flex-1" onClick={() => setConfirmando(null)}>
            Cancelar
          </Botao>
          <Botao
            variante={confirmando === 'limparEscala' ? 'vinho' : 'primario'}
            className="flex-1"
            onClick={() => {
              if (confirmando === 'gerar') executarGeracao()
              else if (confirmando === 'adiantar') adiantarProximoMes()
              else if (confirmando === 'limparAjustes') limparAjustes()
              else if (confirmando === 'limparEscala') limparEscala()
            }}
          >
            {confirmando === 'gerar'
              ? 'Gerar'
              : confirmando === 'adiantar'
                ? 'Adiantar'
                : 'Confirmar'}
          </Botao>
        </div>
      </Modal>
    </div>
  )
}
