import type {
  DadosTpl,
  LocalTpl,
  ParticipanteTpl,
  PeriodoTpl,
  PontoTpl,
} from '../lib/dominio'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  Copy,
  FileDown,
  ListPlus,
  LogOut,
  MapPin,
  Pencil,
  PencilLine,
  RefreshCcw,
  Share2,
  Trash2,
} from 'lucide-react'
import { MINIMO_DUPLA } from '../lib/dominio'
import { ORDEM_DIAS, infoDia } from '../lib/constants'
import { chaveMes, isoDeHoje, nomeMes } from '../lib/datas'
import {
  TITULO_TPL,
  efetivasTpl,
  linhasTplPara,
  normalizarDadosTpl,
  ocorrenciasTpl,
  registroTplDe,
  turnoTexto,
} from '../lib/tpl'
import { ErroAuth, carregarSetorExtenso, salvarDadosSetor } from '../lib/authApi'
import { baixarPdf } from '../lib/export'
import TplCard from './TplCard'
import { Botao, Chip, Input, Kicker, Modal, Rotulo, Select, Vazio } from './ui'
import type { AcaoMenu, StatusDesignacao } from './CabecalhoDesignacao'
import { BarraAcoesDesignacao, CabecalhoDesignacao } from './CabecalhoDesignacao'

/** Data de hoje resolvida uma vez (oxlint: sem Date instável no render). */
const HOJE_ISO = isoDeHoje()
const [HOJE_ANO, HOJE_MES] = HOJE_ISO.split('-').map(Number)

function novoId(prefixo: string): string {
  return `${prefixo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

type FormPonto = { tipo: 'ponto'; id?: string; nome: string }
type FormLocal = { tipo: 'local'; id?: string; nome: string }
type FormPeriodo = {
  tipo: 'periodo'
  id?: string
  pontoId: string
  localId: string
  diaSemana: number
  inicio: string
  fim: string
}
type Formulario = FormPonto | FormLocal | FormPeriodo | null

type Excluindo = { tipo: 'ponto' | 'local' | 'periodo'; id: string; nome: string } | null

interface VoluntarioTpl {
  id: string
  nome: string
  ativo: boolean
}

function periodoForm(dados: DadosTpl): FormPeriodo {
  return {
    tipo: 'periodo',
    pontoId: dados.pontos[0]?.id ?? '',
    localId: dados.locais[0]?.id ?? '',
    diaSemana: 3,
    inicio: '08:00',
    fim: '10:00',
  }
}

function CartaoSecao({
  titulo,
  descricao,
  icone: Icone,
  quantidade,
  aoNovo,
  vazio,
  desabilitado,
  children,
}: {
  titulo: string
  descricao: string
  icone: LucideIcon
  quantidade: number
  aoNovo: () => void
  vazio: { texto: string; rotulo: string; desabilitado?: boolean }
  /** Trava os botões de criar enquanto o setor ainda carrega. */
  desabilitado?: boolean
  children?: ReactNode
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-base font-semibold text-ink">
            <Icone className="size-4 text-teal" aria-hidden="true" />
            {titulo}
          </h3>
          <p className="mt-0.5 text-[13px] text-muted">{descricao}</p>
        </div>
        {quantidade ? (
          <Botao
            variante="secundario"
            className="shrink-0"
            onClick={aoNovo}
            disabled={desabilitado}
          >
            <ListPlus className="size-4" aria-hidden="true" />
            Novo
          </Botao>
        ) : null}
      </div>
      <div className="rounded-2xl bg-card p-4 shadow-sm">
        {quantidade ? (
          children
        ) : (
          <div className="flex flex-col items-center gap-3 py-5 text-center">
            <Icone className="size-7 text-muted" aria-hidden="true" />
            <p className="max-w-sm text-sm text-muted">{vazio.texto}</p>
            <Botao
              variante="primario"
              onClick={aoNovo}
              disabled={vazio.desabilitado || desabilitado}
            >
              <ListPlus className="size-4" aria-hidden="true" />
              {vazio.rotulo}
            </Botao>
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * Card de destaque do TPL: a próxima saída e quem forma a dupla.
 * Mesmo visual do hero do Campo/AVI (gradiente teal + pílulas).
 */
function CardHeroTpl({
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
      <p className="relative z-10 mt-3 text-[34px] font-extrabold leading-tight sm:text-4xl">
        {dia}
      </p>
      <p className="relative z-10 mt-1 text-sm text-white/80">
        {ponto} · {turno}
        {local ? ` · ${local}` : ''}
      </p>
      <p className="relative z-10 mt-1 text-sm text-white/80">
        {faltam
          ? `Falta${faltam === 1 ? '' : 'm'} ${faltam} pessoa${faltam === 1 ? '' : 'as'} na dupla.`
          : 'Dupla completa para esta saída.'}
      </p>
      <div className="relative z-10 mt-4 grid grid-cols-1 gap-2">
        {nomes.map((nome, i) => (
          <span
            key={i}
            className="flex min-w-0 items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm"
          >
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-white/60">
              {i === 0 ? '1º participante' : '2º participante'}
            </span>
            <span
              className={`truncate text-sm ${nome ? 'font-semibold' : 'font-medium text-white/60'}`}
            >
              {nome ?? '—'}
            </span>
          </span>
        ))}
      </div>
    </section>
  )
}

/**
 * Tela do setor TPL. A escala é manual: o administrador monta as duplas
 * escolhendo os voluntários do TPL. A configuração fica separada, apenas com
 * pontos de apoio, locais de trabalho, períodos e dias.
 */
export default function TelaTpl({
  slug,
  aoAvisar,
  aoSair,
  aoIrParaPessoas,
  aoAbrirConfiguracao,
  modoConfiguracao = false,
}: {
  slug: string
  aoAvisar: (texto: string) => void
  aoSair?: () => void
  aoIrParaPessoas?: () => void
  /** Abre a configuração do TPL (a estrutura mora em Ajustes). */
  aoAbrirConfiguracao?: () => void
  /** Em Ajustes, mostra a estrutura do setor; fora dele, a escala. */
  modoConfiguracao?: boolean
}) {
  const [dadosBrutos, setDadosBrutos] = useState<unknown>(null)
  const [voluntariosTpl, setVoluntariosTpl] = useState<VoluntarioTpl[]>([])
  const [congregacao, setCongregacao] = useState('')
  const [carregado, setCarregado] = useState(false)
  const [falhaCarga, setFalhaCarga] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const [ano, setAno] = useState(() => new Date().getFullYear())
  const [mes, setMes] = useState(() => new Date().getMonth())
  const [form, setForm] = useState<Formulario>(null)
  const [erroForm, setErroForm] = useState('')
  const [excluindo, setExcluindo] = useState<Excluindo>(null)
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false)
  /** Abre a escala do mês (montar as duplas) — igual ao "Ajustar escala" do Campo. */
  const [ajustando, setAjustando] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const dados: DadosTpl = useMemo(() => normalizarDadosTpl(dadosBrutos), [dadosBrutos])
  const chave = chaveMes(ano, mes)

  useEffect(() => {
    let vivo = true
    setCarregado(false)
    setFalhaCarga(false)
    carregarSetorExtenso('TPL')
      .then((resposta) => {
        if (!vivo) return
        setDadosBrutos(resposta.dados)
        setVoluntariosTpl(resposta.dirigentes ?? [])
        setCongregacao(resposta.config?.congregacao ?? '')
        setCarregado(true)
      })
      .catch((falha: unknown) => {
        if (!vivo) return
        setDadosBrutos(null)
        setCarregado(true)
        const expirada = falha instanceof ErroAuth && (falha.status === 401 || falha.status === 403)
        setFalhaCarga(!expirada)
        if (expirada) aoAvisar('Sessão expirada. Entre novamente.')
      })
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega por tentativa
  }, [tentativa])

  // Participantes antigos (cadastro do setor) + voluntários atuais do TPL.
  const participantes = useMemo<ParticipanteTpl[]>(() => {
    const mapa = new Map<string, ParticipanteTpl>()
    for (const p of dados.participantes) mapa.set(p.id, p)
    for (const p of voluntariosTpl) {
      mapa.set(p.id, { id: p.id, nome: p.nome, ativo: p.ativo })
    }
    return [...mapa.values()].sort(
      (a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome),
    )
  }, [dados.participantes, voluntariosTpl])

  const dadosComParticipantes = useMemo(
    () => ({ ...dados, participantes }),
    [dados, participantes],
  )

  const porId = useMemo(() => new Map(participantes.map((p) => [p.id, p])), [participantes])

  const registro = registroTplDe(dados, chave)
  const efetivas = useMemo(() => efetivasTpl(registro), [registro])
  const ocorrencias = useMemo(
    () => ocorrenciasTpl(ano, mes, dados.periodos),
    [ano, mes, dados.periodos],
  )
  const linhas = useMemo(
    () => linhasTplPara(dadosComParticipantes, ano, mes),
    [dadosComParticipantes, ano, mes],
  )
  const temDuplas = linhas.some((linha) => linha.dupla.length > 0)

  const completas = useMemo(
    () =>
      ocorrencias.filter(
        (oc) => (efetivas[oc.key]?.ids.filter(Boolean).length ?? 0) >= MINIMO_DUPLA,
      ).length,
    [ocorrencias, efetivas],
  )
  const temRegistro =
    Object.keys(registro.manuais ?? {}).length > 0 ||
    Object.keys(registro.auto ?? {}).length > 0 ||
    Boolean(registro.geradoEm)
  const semEstrutura = !dados.pontos.length || !dados.periodos.length
  const semParticipantes = !participantes.some((p) => p.ativo)

  async function persistir(novos: DadosTpl): Promise<boolean> {
    // Nunca grave com o setor ainda carregando: `dados` estaria incompleto e o
    // PUT apagaria o que já existe no servidor (pontos, períodos e escalas).
    if (!carregado) return false
    setDadosBrutos(novos)
    try {
      await salvarDadosSetor('TPL', novos as unknown as Record<string, unknown>)
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

  function mudarPara(novoAno: number, novoMes: number) {
    setAno(novoAno)
    setMes(novoMes)
    setAjustando(false)
  }

  async function limparEscala() {
    const escalas = { ...dados.escalas }
    delete escalas[chave]
    const ok = await persistir({ ...dados, escalas })
    setConfirmandoLimpeza(false)
    if (ok) aoAvisar(`Escala de ${nomeMes(mes)} de ${ano} limpa.`)
  }

  function alterarDupla(slot: string, posicao: 0 | 1, idIrmao: string) {
    const atuais = efetivas[slot]?.ids ?? []
    const novo = [atuais[0] ?? '', atuais[1] ?? '']
    const outro = novo[posicao === 0 ? 1 : 0]
    if (idIrmao && outro === idIrmao) {
      aoAvisar('A mesma pessoa não pode ocupar as duas posições da dupla.')
      return
    }
    novo[posicao] = idIrmao

    const manuais = { ...(registro.manuais ?? {}) }
    const auto = (registro.auto ?? {})[slot] ?? []
    // Só remove o ajuste quando ele volta a ser igual à sugestão automática.
    // Dupla esvaziada com sugestão automática vira um manual vazio explícito.
    if (JSON.stringify(novo) === JSON.stringify(auto)) delete manuais[slot]
    else manuais[slot] = novo
    void persistir({
      ...dados,
      escalas: { ...dados.escalas, [chave]: { ...registro, manuais } },
    })
  }

  async function aoPdf() {
    if (!cardRef.current || !temDuplas) {
      aoAvisar('Monte a escala antes de baixar o PDF.')
      return
    }
    try {
      await baixarPdf(cardRef.current, chave, 'tpl')
    } catch {
      aoAvisar('Não foi possível gerar o PDF.')
    }
  }

  async function compartilharLink() {
    const href = `${window.location.origin}/tpl/${encodeURIComponent(slug)}`
    if (!slug) {
      aoAvisar('Slug público indisponível.')
      return
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: TITULO_TPL, url: href, text: `Escala de ${TITULO_TPL}` })
        return
      }
      await navigator.clipboard.writeText(href)
      aoAvisar('Link público copiado.')
    } catch {
      aoAvisar('Não foi possível compartilhar o link.')
    }
  }

  /* ----------------------------- Estrutura (CRUD) ----------------------------- */

  function novoPonto() {
    setErroForm('')
    setForm({ tipo: 'ponto', nome: '' })
  }

  function novoLocal() {
    setErroForm('')
    setForm({ tipo: 'local', nome: '' })
  }

  function novoPeriodo() {
    setErroForm('')
    setForm(periodoForm(dados))
  }

  async function salvarFormulario() {
    if (!form) return
    let novos: DadosTpl | null = null

    if (form.tipo === 'ponto') {
      const nome = form.nome.trim()
      if (!nome) {
        setErroForm('Informe o nome do ponto de apoio.')
        return
      }
      const pontos: PontoTpl[] = form.id
        ? dados.pontos.map((p) => (p.id === form.id ? { ...p, nome } : p))
        : [...dados.pontos, { id: novoId('ponto'), nome }]
      novos = { ...dados, pontos }
    } else if (form.tipo === 'local') {
      const nome = form.nome.trim()
      if (!nome) {
        setErroForm('Informe o local de trabalho.')
        return
      }
      const local: LocalTpl = { id: form.id ?? novoId('local'), nome }
      const locais = form.id
        ? dados.locais.map((l) => (l.id === form.id ? local : l))
        : [...dados.locais, local]
      novos = { ...dados, locais }
    } else {
      if (!form.pontoId) {
        setErroForm('Escolha o ponto de apoio.')
        return
      }
      if (form.inicio >= form.fim) {
        setErroForm('O horário final deve ser depois do inicial.')
        return
      }
      const periodo: PeriodoTpl = {
        id: form.id ?? novoId('periodo'),
        pontoId: form.pontoId,
        localId: form.localId,
        diaSemana: form.diaSemana,
        inicio: form.inicio,
        fim: form.fim,
      }
      const periodos = form.id
        ? dados.periodos.map((p) => (p.id === form.id ? periodo : p))
        : [...dados.periodos, periodo]
      novos = { ...dados, periodos }
    }

    const ok = await persistir(novos)
    if (!ok) return
    setForm(null)
    setErroForm('')
  }

  async function excluirConfirmado() {
    if (!excluindo) return
    let novos: DadosTpl
    if (excluindo.tipo === 'ponto') {
      novos = {
        ...dados,
        pontos: dados.pontos.filter((p) => p.id !== excluindo.id),
        periodos: dados.periodos.filter((p) => p.pontoId !== excluindo.id),
      }
    } else if (excluindo.tipo === 'periodo') {
      novos = {
        ...dados,
        periodos: dados.periodos.filter((p) => p.id !== excluindo.id),
      }
    } else {
      novos = {
        ...dados,
        locais: dados.locais.filter((local) => local.id !== excluindo.id),
        periodos: dados.periodos.map((periodo) =>
          periodo.localId === excluindo.id ? { ...periodo, localId: '' } : periodo,
        ),
      }
    }
    const ok = await persistir(novos)
    if (!ok) return
    setExcluindo(null)
    aoAvisar('Item excluído.')
  }

  // A tela abre na hora: enquanto o setor carrega, chip neutro e um bloco
  // neutro no lugar do destaque (sem avisos falsos de "sem estrutura").
  const status: StatusDesignacao = !carregado
    ? { rotulo: '…', estilo: 'bg-canvas text-muted', ponto: 'bg-muted' }
    : !ocorrencias.length
      ? { rotulo: 'Sem períodos neste mês', estilo: 'bg-canvas text-muted', ponto: 'bg-muted' }
      : completas === ocorrencias.length
        ? { rotulo: 'Designação pronta', estilo: 'bg-success-bg text-success', ponto: 'bg-success' }
        : temRegistro
          ? {
              rotulo: `Pendente · ${completas}/${ocorrencias.length} duplas`,
              estilo: 'bg-crimson-bg text-crimson',
              ponto: 'bg-crimson',
            }
          : {
              rotulo: 'Pendente de montar',
              estilo: 'bg-crimson-bg text-crimson',
              ponto: 'bg-crimson animate-pulse',
            }

  const proximo = mes === 11 ? { ano: ano + 1, mes: 0 } : { ano, mes: mes + 1 }
  const proximoNome = nomeMes(proximo.mes)

  const acoesMenu: AcaoMenu[] = [
    {
      icone: <CalendarDays className="size-4" />,
      cor: 'bg-success-bg text-success',
      titulo: `Ver escala de ${proximoNome}`,
      texto: 'Abre o mês seguinte para montar as duplas',
      onClick: () => mudarPara(proximo.ano, proximo.mes),
    },
    {
      icone: <Trash2 className="size-4" />,
      cor: 'bg-wine-soft text-wine',
      titulo: 'Limpar designação',
      texto: 'Apaga as duplas manuais deste mês',
      desabilitado: !temRegistro,
      onClick: () => setConfirmandoLimpeza(true),
    },
  ]

  const ehMesAtual = ano === HOJE_ANO && mes === HOJE_MES - 1
  const proximas = ehMesAtual ? ocorrencias.filter((o) => o.iso >= HOJE_ISO) : ocorrencias
  const destaque = proximas[0] ?? null
  const ehHoje = Boolean(destaque && destaque.iso === HOJE_ISO)
  /** Próximas saídas depois do card de destaque (sem repetir o que já aparece). */
  const posteriores = destaque ? proximas.filter((o) => o.key !== destaque.key) : proximas
  const lista = posteriores.slice(0, 8)
  const restam = posteriores.length - lista.length

  function nomesDe(ids: Array<string | undefined>): Array<string | null> {
    return ids.map((id) => (id ? (porId.get(id)?.nome ?? null) : null))
  }

  const nomesDestaque = destaque ? nomesDe(efetivas[destaque.key]?.ids ?? []) : []
  const designadasDestaque = nomesDestaque.filter(Boolean).length
  const rotuloDestaque = ehHoje
    ? 'Quem trabalha hoje'
    : ehMesAtual
      ? 'Próxima saída'
      : 'Primeira saída'
  const pontoDestaque = destaque
    ? (dados.pontos.find((p) => p.id === destaque.periodo.pontoId)?.nome ?? 'Ponto')
    : ''
  const turnoDestaque = destaque ? turnoTexto(destaque.periodo) : ''
  const localDestaque = destaque
    ? (dados.locais.find((l) => l.id === destaque.periodo.localId)?.nome ?? null)
    : null
  const diaDestaque = destaque
    ? `${infoDia(destaque.diaSemana).curto}, ${destaque.iso.slice(8, 10)}/${destaque.iso.slice(5, 7)}`
    : ''

  return (
    <div className="space-y-5">
      {!modoConfiguracao ? (
        ajustando ? (
          <>
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
            </header>

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

          {carregado && semEstrutura ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] text-ink">
              <p className="min-w-0 flex-1">
                Cadastre pontos de apoio e períodos na configuração antes de montar a
                escala.
              </p>
              <Botao
                variante="fantasma"
                className="shrink-0 text-crimson"
                onClick={() => aoAbrirConfiguracao?.()}
              >
                Abrir configuração
              </Botao>
            </div>
          ) : carregado && semParticipantes ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] text-ink">
              <p className="min-w-0 flex-1">
                Nenhum voluntário do TPL ativo. Cadastre em Voluntários para montar as
                duplas.
              </p>
              {aoIrParaPessoas ? (
                <Botao
                  variante="fantasma"
                  className="shrink-0 text-crimson"
                  onClick={aoIrParaPessoas}
                >
                  Abrir Voluntários
                </Botao>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Botao variante="secundario" onClick={aoPdf} disabled={!temDuplas}>
              <FileDown className="size-4" aria-hidden="true" />
              Baixar PDF
            </Botao>
            <Botao variante="secundario" onClick={compartilharLink}>
              {typeof navigator.share === 'function' ? (
                <Share2 className="size-4" aria-hidden="true" />
              ) : (
                <Copy className="size-4" aria-hidden="true" />
              )}
              Compartilhar link
            </Botao>
          </div>

          {!ocorrencias.length ? (
            <Vazio
              icone={ListPlus}
              titulo={
                semEstrutura
                  ? 'Sem períodos cadastrados. Monte a estrutura do TPL para começar.'
                  : `Nenhum período em ${nomeMes(mes)} de ${ano}.`
              }
              acao={
                semEstrutura ? (
                  <Botao variante="primario" onClick={() => aoAbrirConfiguracao?.()}>
                    <ListPlus className="size-4" aria-hidden="true" />
                    Montar estrutura
                  </Botao>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {(() => {
                const datas = [...new Set(ocorrencias.map((oc) => oc.iso))]
                return datas.map((iso) => {
                  const doDia = ocorrencias.filter((oc) => oc.iso === iso)
                  const dia = Number(iso.slice(8, 10))
                  const diaSemana = doDia[0]?.diaSemana ?? 0
                  return (
                    <article
                      key={iso}
                      className="overflow-hidden rounded-2xl bg-card shadow-sm"
                    >
                      <h3 className="bg-wine px-4 py-2 text-sm font-bold text-white">
                        {infoDia(diaSemana).nome} · {dia}/
                        {String(mes + 1).padStart(2, '0')}
                      </h3>
                      <div className="divide-y divide-line">
                        {doDia.map((oc) => {
                          const ponto = dados.pontos.find(
                            (p) => p.id === oc.periodo.pontoId,
                          )
                          const local = dados.locais.find(
                            (l) => l.id === oc.periodo.localId,
                          )
                          const efetiva = efetivas[oc.key]
                          const ids = efetiva?.ids ?? []
                          const incompleta = ids.length < MINIMO_DUPLA
                          return (
                            <div key={oc.key} className="px-4 py-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-ink">
                                  {ponto?.nome ?? 'Ponto'}{' '}
                                  <span className="font-normal text-muted">
                                    · {turnoTexto(oc.periodo)}
                                  </span>
                                </p>
                                <span className="flex flex-wrap items-center gap-1.5">
                                  {local ? (
                                    <span className="rounded-full bg-canvas px-2.5 py-0.5 text-[11px] font-bold text-ink-soft">
                                      {local.nome}
                                    </span>
                                  ) : null}
                                  {incompleta ? (
                                    <span className="rounded-full bg-crimson-bg px-2.5 py-0.5 text-[11px] font-bold text-crimson">
                                      dupla incompleta
                                    </span>
                                  ) : efetiva?.manual ? (
                                    <span className="rounded-full bg-teal-tint px-2.5 py-0.5 text-[11px] font-bold text-teal">
                                      manual
                                    </span>
                                  ) : null}
                                </span>
                              </div>
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                {[0, 1].map((posicao) => {
                                  const idAtual = ids[posicao] ?? ''
                                  return (
                                    <div key={posicao}>
                                      <label
                                        htmlFor={`tpl-${oc.key}-${posicao}`}
                                        className="block text-[12px] font-semibold text-muted"
                                      >
                                        {posicao === 0
                                          ? '1º participante'
                                          : '2º participante'}
                                      </label>
                                      <Select
                                        id={`tpl-${oc.key}-${posicao}`}
                                        className="mt-0.5"
                                        value={idAtual}
                                        onChange={(e) =>
                                          alterarDupla(
                                            oc.key,
                                            posicao as 0 | 1,
                                            e.target.value,
                                          )
                                        }
                                      >
                                        <option value="">— Vazio —</option>
                                        {participantes
                                          .filter((p) => p.ativo || p.id === idAtual)
                                          .map((p) => (
                                            <option key={p.id} value={p.id}>
                                              {p.nome}
                                            </option>
                                          ))}
                                      </Select>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </article>
                  )
                })
              })()}
            </div>
          )}
          </>
        ) : (
          <>
            <CabecalhoDesignacao
              ano={ano}
              mes={mes}
              aoMudarData={mudarPara}
              status={status}
              acoes={acoesMenu}
            />

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

            {carregado && semEstrutura ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] text-ink">
                <p className="min-w-0 flex-1">
                  Cadastre pontos de apoio e períodos na configuração antes de montar a
                  escala.
                </p>
                <Botao
                  variante="fantasma"
                  className="shrink-0 text-crimson"
                  onClick={() => aoAbrirConfiguracao?.()}
                >
                  Abrir configuração
                </Botao>
              </div>
            ) : carregado && semParticipantes ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] text-ink">
                <p className="min-w-0 flex-1">
                  Nenhum voluntário do TPL ativo. Cadastre em Voluntários para montar as
                  duplas.
                </p>
                {aoIrParaPessoas ? (
                  <Botao
                    variante="fantasma"
                    className="shrink-0 text-crimson"
                    onClick={aoIrParaPessoas}
                  >
                    Abrir Voluntários
                  </Botao>
                ) : null}
              </div>
            ) : null}

            {!carregado ? (
              <section
                className="h-[15rem] animate-pulse rounded-2xl bg-card"
                aria-hidden="true"
              />
            ) : !ocorrencias.length ? (
              <Vazio
                icone={ListPlus}
                titulo={
                  semEstrutura
                    ? 'Sem períodos cadastrados. Monte a estrutura do TPL para começar.'
                    : `Nenhum período em ${nomeMes(mes)} de ${ano}.`
                }
                acao={
                  semEstrutura ? (
                    <Botao variante="primario" onClick={() => aoAbrirConfiguracao?.()}>
                      <ListPlus className="size-4" aria-hidden="true" />
                      Montar estrutura
                    </Botao>
                  ) : undefined
                }
              />
            ) : destaque ? (
              <CardHeroTpl
                rotulo={rotuloDestaque}
                dia={diaDestaque}
                ehHoje={ehHoje}
                ponto={pontoDestaque}
                turno={turnoDestaque}
                local={localDestaque}
                nomes={nomesDestaque}
                designadas={designadasDestaque}
                total={MINIMO_DUPLA}
              />
            ) : null}

            {lista.length ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2 px-1">
                  <h2 className="text-lg font-semibold text-ink">Próximas designações</h2>
                  <p className="shrink-0 text-sm text-muted">
                    {completas}/{ocorrencias.length} duplas
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {lista.map((oc) => {
                    const ponto = dados.pontos.find((p) => p.id === oc.periodo.pontoId)
                    const local = dados.locais.find((l) => l.id === oc.periodo.localId)
                    const nomes = nomesDe(efetivas[oc.key]?.ids ?? [])
                    const designadas = nomes.filter(Boolean).length
                    const incompleta = designadas < MINIMO_DUPLA
                    const doDia = oc.iso === HOJE_ISO
                    return (
                      <article
                        key={oc.key}
                        className={`flex w-full items-start gap-3 rounded-xl bg-card p-4 shadow-sm ${
                          doDia ? 'escala-hoje' : ''
                        }`}
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-tint text-teal">
                          <CalendarDays className="size-5" aria-hidden="true" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                            {doDia ? (
                              <span className="flex items-center gap-1 rounded-full bg-teal px-2 py-0.5 text-[11px] font-bold text-white">
                                <span
                                  className="size-1.5 animate-pulse rounded-full bg-crimson"
                                  aria-hidden="true"
                                />
                                HOJE
                              </span>
                            ) : null}
                            <span className="font-semibold text-ink">
                              {infoDia(oc.diaSemana).curto}, {oc.iso.slice(8, 10)}/
                              {oc.iso.slice(5, 7)}
                            </span>
                            <span
                              className={`ml-auto shrink-0 text-[12px] font-bold ${
                                incompleta ? 'text-crimson' : 'text-success'
                              }`}
                            >
                              {designadas}/{MINIMO_DUPLA}
                            </span>
                          </span>
                          <span className="mt-1 block text-[13px] leading-snug text-muted">
                            {ponto?.nome ?? 'Ponto'} · {turnoTexto(oc.periodo)}
                            {local ? ` · ${local.nome}` : ''}
                          </span>
                          <span
                            className={`mt-0.5 block break-words text-[13px] leading-snug ${
                              nomes.some(Boolean) ? 'font-medium text-ink' : 'text-crimson'
                            }`}
                          >
                            {nomes.filter(Boolean).join(' & ') || 'Sem designação'}
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

            {/* Ação principal: abrir a escala do mês para montar as duplas. */}
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
                Abre a escala do mês: monte a dupla de cada período.
              </p>
            </div>

            <BarraAcoesDesignacao
              primaria={{
                rotulo: 'Ajustar',
                icone: <PencilLine className="size-4" aria-hidden="true" />,
                onClick: () => setAjustando(true),
              }}
              pdf={{
                onClick: aoPdf,
                desabilitado: !temDuplas,
                titulo: temDuplas ? undefined : 'Monte as duplas antes de baixar o PDF',
              }}
              link={{
                onClick: compartilharLink,
                desabilitado: !slug,
                titulo: slug ? undefined : 'Slug público indisponível',
              }}
            />
          </>
        )
      ) : (
        <div className="space-y-6">
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

          <CartaoSecao
            titulo="Pontos de apoio"
            descricao="Onde a equipe retira o carrinho"
            icone={MapPin}
            quantidade={dados.pontos.length}
            aoNovo={novoPonto}
            desabilitado={!carregado}
            vazio={{
              texto: 'Nenhum ponto de apoio. Cadastre onde a equipe retira o carrinho.',
              rotulo: 'Adicionar ponto de apoio',
            }}
          >
            <ul className="divide-y divide-line-soft">
              {dados.pontos.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="min-w-0 truncate text-sm font-semibold text-ink">
                    {p.nome}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label={`Editar ${p.nome}`}
                      className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-teal"
                      onClick={() => {
                        setErroForm('')
                        setForm({ tipo: 'ponto', id: p.id, nome: p.nome })
                      }}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Excluir ${p.nome}`}
                      className="rounded-lg p-2 text-muted hover:bg-crimson-bg hover:text-crimson"
                      onClick={() =>
                        setExcluindo({ tipo: 'ponto', id: p.id, nome: p.nome })
                      }
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </CartaoSecao>

          <CartaoSecao
            titulo="Locais de trabalho"
            descricao="Onde a equipe trabalha com o carrinho"
            icone={MapPin}
            quantidade={dados.locais.length}
            aoNovo={novoLocal}
            desabilitado={!carregado}
            vazio={{
              texto: 'Nenhum local de trabalho. Cadastre onde a equipe vai trabalhar com o carrinho.',
              rotulo: 'Adicionar local de trabalho',
            }}
          >
            <ul className="divide-y divide-line-soft">
              {dados.locais.map((local) => (
                <li
                  key={local.id}
                  className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="min-w-0 truncate text-sm font-semibold text-ink">
                    {local.nome}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label={`Editar ${local.nome}`}
                      className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-teal"
                      onClick={() => {
                        setErroForm('')
                        setForm({ tipo: 'local', id: local.id, nome: local.nome })
                      }}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Excluir ${local.nome}`}
                      className="rounded-lg p-2 text-muted hover:bg-crimson-bg hover:text-crimson"
                      onClick={() =>
                        setExcluindo({
                          tipo: 'local',
                          id: local.id,
                          nome: local.nome,
                        })
                      }
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </CartaoSecao>

          <CartaoSecao
            titulo="Períodos e dias"
            descricao="Dias da semana e turnos de cada ponto"
            icone={RefreshCcw}
            quantidade={dados.periodos.length}
            aoNovo={novoPeriodo}
            desabilitado={!carregado}
            vazio={{
              texto: dados.pontos.length
                ? 'Nenhum período. Defina dias da semana e turnos (ex.: Quinta 08:00–10:00).'
                : 'Cadastre um ponto de apoio antes de criar períodos.',
              rotulo: 'Adicionar período',
              desabilitado: !dados.pontos.length,
            }}
          >
            <ul className="divide-y divide-line-soft">
              {[...dados.periodos]
                .sort(
                  (a, b) =>
                    a.diaSemana - b.diaSemana || a.inicio.localeCompare(b.inicio),
                )
                .map((p) => {
                  const ponto = dados.pontos.find((x) => x.id === p.pontoId)
                  const local = dados.locais.find((x) => x.id === p.localId)
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                    >
                      <span className="min-w-0 text-sm text-ink">
                        <span className="font-semibold">
                          {infoDia(p.diaSemana).nome}
                        </span>{' '}
                        <span className="text-muted">
                          {p.inicio}–{p.fim} · Retirada:{' '}
                          {ponto?.nome ?? 'Ponto removido'} · Trabalho:{' '}
                          {local?.nome ?? 'Local a definir'}
                        </span>
                      </span>
                      <span className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          aria-label="Editar período"
                          className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-teal"
                          onClick={() => {
                            setErroForm('')
                            setForm({
                              tipo: 'periodo',
                              id: p.id,
                              pontoId: p.pontoId,
                              localId: p.localId ?? '',
                              diaSemana: p.diaSemana,
                              inicio: p.inicio,
                              fim: p.fim,
                            })
                          }}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label="Excluir período"
                          className="rounded-lg p-2 text-muted hover:bg-crimson-bg hover:text-crimson"
                          onClick={() =>
                            setExcluindo({
                              tipo: 'periodo',
                              id: p.id,
                              nome: `${infoDia(p.diaSemana).nome} ${p.inicio}–${p.fim}`,
                            })
                          }
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </span>
                    </li>
                  )
                })}
            </ul>
          </CartaoSecao>
        </div>
      )}

      {aoSair ? (
        <Botao variante="secundario" className="w-full" onClick={aoSair}>
          <LogOut className="size-4" aria-hidden="true" />
          Sair da conta
        </Botao>
      ) : null}

      {linhas.length ? (
        <div
          className="fixed left-[-10000px] top-0 w-[760px] overflow-hidden"
          aria-hidden="true"
        >
          <TplCard
            ref={cardRef}
            congregacao={congregacao}
            mes={mes}
            linhas={linhas}
          />
        </div>
      ) : null}

      {/* Formulários da estrutura */}
      <Modal
        aberto={form !== null}
        aoFechar={() => setForm(null)}
        titulo={
          !form
            ? ''
            : form.tipo === 'ponto'
              ? form.id
                ? 'Editar ponto'
                : 'Novo ponto'
              : form.tipo === 'local'
                ? form.id
                  ? 'Editar local de trabalho'
                  : 'Novo local de trabalho'
                : form.id
                  ? 'Editar período'
                  : 'Novo período'
        }
        descricao="A estrutura alimenta a escala manual do TPL."
        largura="max-w-md"
      >
        {form ? (
          <div className="space-y-4 px-5 py-4">
            {form.tipo === 'ponto' ? (
              <div>
                <Rotulo htmlFor="tpl-ponto-nome">Onde retirar o carrinho</Rotulo>
                <Input
                  id="tpl-ponto-nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex.: Praça Central"
                  autoFocus
                />
              </div>
            ) : form.tipo === 'local' ? (
              <div>
                <Rotulo htmlFor="tpl-local-nome">Local de trabalho</Rotulo>
                <Input
                  id="tpl-local-nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex.: Praça Central"
                  autoFocus
                />
              </div>
            ) : (
              <>
                <div>
                  <Rotulo htmlFor="tpl-periodo-ponto">Onde retirar o carrinho</Rotulo>
                  <Select
                    id="tpl-periodo-ponto"
                    value={form.pontoId}
                    onChange={(e) => setForm({ ...form, pontoId: e.target.value })}
                  >
                    {dados.pontos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Rotulo htmlFor="tpl-periodo-local">Local de trabalho</Rotulo>
                  <Select
                    id="tpl-periodo-local"
                    value={form.localId}
                    onChange={(e) => setForm({ ...form, localId: e.target.value })}
                  >
                    <option value="">— Local a definir —</option>
                    {dados.locais.map((local) => (
                      <option key={local.id} value={local.id}>
                        {local.nome}
                      </option>
                    ))}
                  </Select>
                </div>
                <fieldset>
                  <legend className="mb-1.5 text-[13px] font-semibold text-ink">
                    Dia da semana
                  </legend>
                  <div className="flex flex-wrap gap-1.5">
                    {ORDEM_DIAS.map((idx) => (
                      <Chip
                        key={idx}
                        ativo={form.diaSemana === idx}
                        onClick={() => setForm({ ...form, diaSemana: idx })}
                      >
                        {infoDia(idx).curto}
                      </Chip>
                    ))}
                  </div>
                </fieldset>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Rotulo htmlFor="tpl-periodo-inicio">Início</Rotulo>
                    <Input
                      id="tpl-periodo-inicio"
                      type="time"
                      value={form.inicio}
                      onChange={(e) => setForm({ ...form, inicio: e.target.value })}
                    />
                  </div>
                  <div>
                    <Rotulo htmlFor="tpl-periodo-fim">Fim</Rotulo>
                    <Input
                      id="tpl-periodo-fim"
                      type="time"
                      value={form.fim}
                      onChange={(e) => setForm({ ...form, fim: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            {erroForm ? (
              <p role="alert" className="text-sm font-semibold text-crimson">
                {erroForm}
              </p>
            ) : null}

            <div className="flex items-center gap-2">
              <Botao onClick={() => setForm(null)}>Cancelar</Botao>
              <Botao variante="primario" className="flex-1" onClick={salvarFormulario}>
                Salvar
              </Botao>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Exclusão confirmada */}
      <Modal
        aberto={excluindo !== null}
        aoFechar={() => setExcluindo(null)}
        titulo="Excluir item"
        descricao={
          excluindo
            ? excluindo.tipo === 'ponto'
              ? `${excluindo.nome} e seus períodos serão removidos da estrutura.`
              : `${excluindo.nome} será removido. Esta ação não pode ser desfeita.`
            : undefined
        }
        largura="max-w-sm"
      >
        <div className="flex gap-2 px-5 py-4">
          <Botao className="flex-1" onClick={() => setExcluindo(null)}>
            Cancelar
          </Botao>
          <Botao variante="vinho" className="flex-1" onClick={excluirConfirmado}>
            <Trash2 className="size-4" aria-hidden="true" />
            Excluir
          </Botao>
        </div>
      </Modal>

      {/* Confirmação de limpeza da escala */}
      <Modal
        aberto={confirmandoLimpeza}
        aoFechar={() => setConfirmandoLimpeza(false)}
        titulo="Limpar escala do mês?"
        descricao={`A escala de ${nomeMes(mes)} de ${ano} será apagada. As duplas manuais deste mês serão removidas.`}
        largura="max-w-sm"
      >
        <div className="flex gap-2 px-5 py-4">
          <Botao className="flex-1" onClick={() => setConfirmandoLimpeza(false)}>
            Cancelar
          </Botao>
          <Botao variante="vinho" className="flex-1" onClick={limparEscala}>
            <Trash2 className="size-4" aria-hidden="true" />
            Limpar
          </Botao>
        </div>
      </Modal>
    </div>
  )
}
