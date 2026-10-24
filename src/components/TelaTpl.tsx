import type { DadosTpl, ParticipanteTpl, PeriodoTpl, PontoTpl } from '../lib/dominio'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  FileDown,
  ListPlus,
  LogOut,
  MapPin,
  Pencil,
  RefreshCcw,
  Share2,
  Sparkles,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { MINIMO_DUPLA } from '../lib/dominio'
import { ORDEM_DIAS, infoDia } from '../lib/constants'
import { chaveMes, nomeMes } from '../lib/datas'
import {
  TITULO_TPL,
  efetivasTpl,
  gerarTplDoMes,
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

function novoId(prefixo: string): string {
  return `${prefixo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

type FormPonto = { tipo: 'ponto'; id?: string; nome: string }
type FormPeriodo = { tipo: 'periodo'; id?: string; pontoId: string; diaSemana: number; inicio: string; fim: string }
type FormParticipante = { tipo: 'participante'; id?: string; nome: string; telefone: string; ativo: boolean }
type Formulario = FormPonto | FormPeriodo | FormParticipante | null

type Excluindo = { tipo: 'ponto' | 'periodo' | 'participante'; id: string; nome: string } | null

function periodoForm(dados: DadosTpl): FormPeriodo {
  return {
    tipo: 'periodo',
    pontoId: dados.pontos[0]?.id ?? '',
    diaSemana: 3,
    inicio: '08:00',
    fim: '10:00',
  }
}

/** Tela do setor TPL: estrutura (pontos/períodos/participantes) e escala de duplas. */
export default function TelaTpl({
  slug,
  aoAvisar,
  aoSair,
}: {
  slug: string
  aoAvisar: (texto: string) => void
  aoSair?: () => void
}) {
  const [dadosBrutos, setDadosBrutos] = useState<unknown>(null)
  const [congregacao, setCongregacao] = useState('')
  const [carregado, setCarregado] = useState(false)
  const [falhaCarga, setFalhaCarga] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const [ano, setAno] = useState(() => new Date().getFullYear())
  const [mes, setMes] = useState(() => new Date().getMonth())
  const [vista, setVista] = useState<'escala' | 'estrutura'>('escala')
  const [form, setForm] = useState<Formulario>(null)
  const [erroForm, setErroForm] = useState('')
  const [excluindo, setExcluindo] = useState<Excluindo>(null)
  const [confirmando, setConfirmando] = useState<'gerar' | 'limparAjustes' | 'limparEscala' | null>(null)
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

  const registro = registroTplDe(dados, chave)
  const efetivas = useMemo(() => efetivasTpl(registro), [registro])
  const ocorrencias = useMemo(
    () => ocorrenciasTpl(ano, mes, dados.periodos),
    [ano, mes, dados.periodos],
  )
  const gerado = Boolean(registro.geradoEm)

  const completas = useMemo(
    () => ocorrencias.filter((oc) => (efetivas[oc.key]?.ids.length ?? 0) >= MINIMO_DUPLA).length,
    [ocorrencias, efetivas],
  )
  const pronta = gerado && ocorrencias.length > 0 && completas === ocorrencias.length
  const temManuais = Object.keys(registro.manuais ?? {}).length > 0
  const linhas = useMemo(() => linhasTplPara(dados, ano, mes), [dados, ano, mes])

  async function persistir(novos: DadosTpl): Promise<boolean> {
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

  function mudarMes(delta: number) {
    const base = new Date(ano, mes + delta, 1)
    setAno(base.getFullYear())
    setMes(base.getMonth())
  }

  function executarGeracao() {
    const geradoNovo = gerarTplDoMes(dados, chave, { forcar: true })
    void persistir(geradoNovo).then(() => {
      aoAvisar(
        ocorrencias.length
          ? `Escala TPL de ${nomeMes(mes)} de ${ano} gerada.`
          : 'Nenhum período cadastrado para este mês.',
      )
    })
    setConfirmando(null)
  }

  function pedirGeracao() {
    if (!dados.periodos.length) {
      aoAvisar('Cadastre os períodos (ponto, dia e turno) na aba Estrutura.')
      return
    }
    if (gerado) setConfirmando('gerar')
    else executarGeracao()
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

  function alterarDupla(slot: string, posicao: 0 | 1, idIrmao: string) {
    const atuais = efetivas[slot]?.ids ?? []
    const novo = [atuais[0] ?? '', atuais[1] ?? '']
    novo[posicao] = idIrmao
    const manuais = { ...(registro.manuais ?? {}) }
    const igualAuto = JSON.stringify(novo) === JSON.stringify((registro.auto ?? {})[slot] ?? [])
    if (igualAuto) delete manuais[slot]
    else manuais[slot] = novo
    void persistir({
      ...dados,
      escalas: { ...dados.escalas, [chave]: { ...registro, manuais } },
    })
  }

  async function aoPdf() {
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

  function salvarFormulario() {
    if (!form) return

    if (form.tipo === 'ponto') {
      const nome = form.nome.trim()
      if (!nome) {
        setErroForm('Informe o nome do ponto de apoio.')
        return
      }
      const pontos: PontoTpl[] = form.id
        ? dados.pontos.map((p) => (p.id === form.id ? { ...p, nome } : p))
        : [...dados.pontos, { id: novoId('ponto'), nome }]
      void persistir({ ...dados, pontos })
    } else if (form.tipo === 'periodo') {
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
        diaSemana: form.diaSemana,
        inicio: form.inicio,
        fim: form.fim,
      }
      const periodos = form.id
        ? dados.periodos.map((p) => (p.id === form.id ? periodo : p))
        : [...dados.periodos, periodo]
      void persistir({ ...dados, periodos })
    } else {
      const nome = form.nome.trim()
      if (!nome) {
        setErroForm('Informe o nome do participante.')
        return
      }
      const participante: ParticipanteTpl = {
        id: form.id ?? novoId('pesso'),
        nome,
        telefone: form.telefone.trim(),
        ativo: form.ativo,
      }
      const participantes = form.id
        ? dados.participantes.map((p) => (p.id === form.id ? participante : p))
        : [...dados.participantes, participante]
      void persistir({ ...dados, participantes })
    }

    setForm(null)
    setErroForm('')
  }

  function excluirConfirmado() {
    if (!excluindo) return
    if (excluindo.tipo === 'ponto') {
      void persistir({
        ...dados,
        pontos: dados.pontos.filter((p) => p.id !== excluindo.id),
        periodos: dados.periodos.filter((p) => p.pontoId !== excluindo.id),
      })
    } else if (excluindo.tipo === 'periodo') {
      void persistir({ ...dados, periodos: dados.periodos.filter((p) => p.id !== excluindo.id) })
    } else {
      void persistir({
        ...dados,
        participantes: dados.participantes.filter((p) => p.id !== excluindo.id),
      })
    }
    setExcluindo(null)
    aoAvisar('Item excluído.')
  }

  if (!carregado) {
    return (
      <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
        <RefreshCcw className="size-4 animate-spin text-teal" aria-hidden="true" />
        Carregando setor…
      </p>
    )
  }

  const status = !gerado ? 'não gerada' : pronta ? 'pronta' : 'pendente'
  const semEstrutura = !dados.pontos.length || !dados.periodos.length
  const semParticipantes = !dados.participantes.filter((p) => p.ativo).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Botao variante="fantasma" aria-label="Mês anterior" className="px-2" onClick={() => mudarMes(-1)}>
          <ChevronLeft className="size-5" aria-hidden="true" />
        </Botao>
        <h2 className="text-lg font-bold text-ink">
          {nomeMes(mes)} de {ano}
        </h2>
        <Botao variante="fantasma" aria-label="Próximo mês" className="px-2" onClick={() => mudarMes(1)}>
          <ChevronRight className="size-5" aria-hidden="true" />
        </Botao>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            status === 'pronta'
              ? 'bg-success-bg text-success'
              : status === 'pendente'
                ? 'bg-crimson-bg text-crimson'
                : 'bg-line text-ink-soft'
          }`}
        >
          {status === 'não gerada'
            ? 'Escala não gerada'
            : status === 'pronta'
              ? `Completa · ${completas} duplas`
              : `Pendente · ${completas}/${ocorrencias.length} duplas`}
        </span>

        <div role="tablist" aria-label="Visualização do TPL" className="flex rounded-xl bg-canvas p-1">
          {(['escala', 'estrutura'] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={vista === id}
              onClick={() => setVista(id)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                vista === id ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              {id === 'escala' ? 'Escala' : 'Estrutura'}
            </button>
          ))}
        </div>
      </div>

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

      {vista === 'escala' ? (
        <>
          {semEstrutura || semParticipantes ? (
            <p className="rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] text-ink">
              {semEstrutura
                ? 'Cadastre pontos de apoio e períodos (dia + turno) na aba Estrutura antes de gerar.'
                : 'Cadastre pelo menos 2 participantes ativos na aba Estrutura.'}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Botao variante="primario" onClick={pedirGeracao}>
              <Sparkles className="size-4" aria-hidden="true" />
              {gerado ? 'Gerar novamente' : 'Gerar escala'}
            </Botao>
            {temManuais ? (
              <Botao variante="secundario" onClick={() => setConfirmando('limparAjustes')}>
                <RefreshCcw className="size-4" aria-hidden="true" />
                Limpar ajustes
              </Botao>
            ) : null}
            {gerado ? (
              <Botao variante="fantasma" className="text-crimson" onClick={() => setConfirmando('limparEscala')}>
                <Trash2 className="size-4" aria-hidden="true" />
                Limpar escala
              </Botao>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Botao variante="secundario" onClick={aoPdf} disabled={!gerado}>
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

          {slug ? (
            <p className="rounded-xl bg-teal-tint px-3 py-2 text-[13px] text-teal-deep">
              Link público: <span className="font-semibold break-all">/tpl/{slug}</span>
            </p>
          ) : null}

          {!ocorrencias.length ? (
            <Vazio
              icone={Sparkles}
              titulo={
                semEstrutura
                  ? 'Sem períodos cadastrados. Monte a estrutura do TPL para gerar a escala.'
                  : `Nenhum período em ${nomeMes(mes)} de ${ano}.`
              }
              acao={
                semEstrutura ? (
                  <Botao variante="primario" onClick={() => setVista('estrutura')}>
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
                    <article key={iso} className="overflow-hidden rounded-2xl bg-card shadow-sm">
                      <h3 className="bg-wine px-4 py-2 text-sm font-bold text-white">
                        {infoDia(diaSemana).nome} · {dia}/{String(mes + 1).padStart(2, '0')}
                      </h3>
                      <div className="divide-y divide-line">
                        {doDia.map((oc) => {
                          const ponto = dados.pontos.find((p) => p.id === oc.periodo.pontoId)
                          const efetiva = efetivas[oc.key]
                          const ids = efetiva?.ids ?? []
                          const incompleta = ids.length < MINIMO_DUPLA
                          return (
                            <div key={oc.key} className="px-4 py-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-ink">
                                  {ponto?.nome ?? 'Ponto'}{' '}
                                  <span className="font-normal text-muted">· {turnoTexto(oc.periodo)}</span>
                                </p>
                                {incompleta && gerado ? (
                                  <span className="rounded-full bg-crimson-bg px-2.5 py-0.5 text-[11px] font-bold text-crimson">
                                    dupla incompleta
                                  </span>
                                ) : efetiva?.manual ? (
                                  <span className="rounded-full bg-teal-tint px-2.5 py-0.5 text-[11px] font-bold text-teal">
                                    manual
                                  </span>
                                ) : null}
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
                                        {posicao === 0 ? '1º participante' : '2º participante'}
                                      </label>
                                      <Select
                                        id={`tpl-${oc.key}-${posicao}`}
                                        className="mt-0.5"
                                        value={idAtual}
                                        onChange={(e) =>
                                          alterarDupla(oc.key, posicao as 0 | 1, e.target.value)
                                        }
                                      >
                                        <option value="">— Vazio —</option>
                                        {dados.participantes
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
        <div className="space-y-6">
          {/* Pontos de apoio */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Kicker className="text-teal">Estrutura</Kicker>
                <h3 className="mt-0.5 flex items-center gap-1.5 text-base font-semibold text-ink">
                  <MapPin className="size-4 text-teal" aria-hidden="true" />
                  Pontos de apoio
                </h3>
              </div>
              <Botao
                variante="primario"
                onClick={() => {
                  setErroForm('')
                  setForm({ tipo: 'ponto', nome: '' })
                }}
              >
                <ListPlus className="size-4" aria-hidden="true" />
                Novo
              </Botao>
            </div>
            {dados.pontos.length ? (
              <ul className="space-y-2">
                {dados.pontos.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-2xl bg-card px-4 py-3 shadow-sm"
                  >
                    <span className="min-w-0 truncate text-sm font-semibold text-ink">{p.nome}</span>
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
                        onClick={() => setExcluindo({ tipo: 'ponto', id: p.id, nome: p.nome })}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio icone={MapPin} titulo="Nenhum ponto de apoio. Cadastre locais como Praça Central ou Estação." />
            )}
          </section>

          {/* Períodos e dias */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Kicker className="text-teal">Estrutura</Kicker>
                <h3 className="mt-0.5 flex items-center gap-1.5 text-base font-semibold text-ink">
                  <RefreshCcw className="size-4 text-teal" aria-hidden="true" />
                  Períodos e dias
                </h3>
              </div>
              <Botao
                variante="primario"
                onClick={() => {
                  setErroForm('')
                  setForm(periodoForm(dados))
                }}
                disabled={!dados.pontos.length}
              >
                <ListPlus className="size-4" aria-hidden="true" />
                Novo
              </Botao>
            </div>
            {!dados.pontos.length ? (
              <p className="rounded-xl bg-teal-tint px-3 py-2 text-[13px] text-teal-deep">
                Cadastre um ponto de apoio antes de criar períodos.
              </p>
            ) : dados.periodos.length ? (
              <ul className="space-y-2">
                {[...dados.periodos]
                  .sort(
                    (a, b) =>
                      a.diaSemana - b.diaSemana ||
                      a.inicio.localeCompare(b.inicio),
                  )
                  .map((p) => {
                    const ponto = dados.pontos.find((x) => x.id === p.pontoId)
                    return (
                      <li
                        key={p.id}
                        className="flex items-center justify-between gap-2 rounded-2xl bg-card px-4 py-3 shadow-sm"
                      >
                        <span className="min-w-0 text-sm text-ink">
                          <span className="font-semibold">{infoDia(p.diaSemana).nome}</span>{' '}
                          <span className="text-muted">
                            {p.inicio}–{p.fim} · {ponto?.nome ?? 'Ponto removido'}
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
            ) : (
              <Vazio
                icone={RefreshCcw}
                titulo="Nenhum período. Defina dias da semana e turnos (ex.: Manhã 08:00–10:00) em cada ponto."
              />
            )}
          </section>

          {/* Participantes */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Kicker className="text-teal">Estrutura</Kicker>
                <h3 className="mt-0.5 flex items-center gap-1.5 text-base font-semibold text-ink">
                  <UserPlus className="size-4 text-teal" aria-hidden="true" />
                  Participantes
                </h3>
              </div>
              <Botao
                variante="primario"
                onClick={() => {
                  setErroForm('')
                  setForm({ tipo: 'participante', nome: '', telefone: '', ativo: true })
                }}
              >
                <ListPlus className="size-4" aria-hidden="true" />
                Novo
              </Botao>
            </div>
            <p className="rounded-xl bg-teal-tint px-3 py-2 text-[13px] text-teal-deep">
              Regra da dupla: no mínimo {MINIMO_DUPLA} participantes por ponto/horário na escala.
            </p>
            {dados.participantes.length ? (
              <ul className="space-y-2">
                {[...dados.participantes]
                  .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome))
                  .map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-2xl bg-card px-4 py-3 shadow-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{p.nome}</span>
                        {p.telefone ? (
                          <span className="block truncate text-[13px] text-muted">{p.telefone}</span>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {!p.ativo ? (
                          <span className="rounded-full bg-line px-2.5 py-0.5 text-[11px] font-bold text-ink-soft">
                            Inativo
                          </span>
                        ) : null}
                        <button
                          type="button"
                          aria-label={`Editar ${p.nome}`}
                          className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-teal"
                          onClick={() => {
                            setErroForm('')
                            setForm({
                              tipo: 'participante',
                              id: p.id,
                              nome: p.nome,
                              telefone: p.telefone ?? '',
                              ativo: p.ativo,
                            })
                          }}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Excluir ${p.nome}`}
                          className="rounded-lg p-2 text-muted hover:bg-crimson-bg hover:text-crimson"
                          onClick={() =>
                            setExcluindo({ tipo: 'participante', id: p.id, nome: p.nome })
                          }
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </span>
                    </li>
                  ))}
              </ul>
            ) : (
              <Vazio icone={UserPlus} titulo="Nenhum participante autorizado para o TPL ainda." />
            )}
          </section>
        </div>
      )}

      {aoSair ? (
        <Botao variante="secundario" className="w-full" onClick={aoSair}>
          <LogOut className="size-4" aria-hidden="true" />
          Sair da conta
        </Botao>
      ) : null}

      {gerado ? (
        <div className="fixed left-[-10000px] top-0 w-[760px] overflow-hidden" aria-hidden="true">
          <TplCard ref={cardRef} congregacao={congregacao} mes={mes} linhas={linhas} />
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
              : form.tipo === 'periodo'
                ? form.id
                  ? 'Editar período'
                  : 'Novo período'
                : form.id
                  ? 'Editar participante'
                  : 'Novo participante'
        }
        descricao="A estrutura alimenta a escala pública do TPL."
        largura="max-w-md"
      >
        {form ? (
          <div className="space-y-4 px-5 py-4">
            {form.tipo === 'ponto' ? (
              <div>
                <Rotulo htmlFor="tpl-ponto-nome">Nome do ponto</Rotulo>
                <Input
                  id="tpl-ponto-nome"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex.: Praça Central"
                  autoFocus
                />
              </div>
            ) : form.tipo === 'periodo' ? (
              <>
                <div>
                  <Rotulo htmlFor="tpl-periodo-ponto">Ponto de apoio</Rotulo>
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
                <fieldset>
                  <legend className="mb-1.5 text-[13px] font-semibold text-ink">Dia da semana</legend>
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
            ) : (
              <>
                <div>
                  <Rotulo htmlFor="tpl-pessoa-nome">Nome do participante</Rotulo>
                  <Input
                    id="tpl-pessoa-nome"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Ex.: Maria Souza"
                    autoComplete="name"
                    autoFocus
                  />
                </div>
                <div>
                  <Rotulo htmlFor="tpl-pessoa-tel">Telefone (opcional)</Rotulo>
                  <Input
                    id="tpl-pessoa-tel"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    inputMode="tel"
                  />
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-canvas px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                    className="size-4 accent-teal"
                  />
                  <span className="text-sm font-semibold text-ink">Participante ativo</span>
                </label>
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

      {/* Confirmações da escala */}
      <Modal
        aberto={confirmando !== null}
        aoFechar={() => setConfirmando(null)}
        titulo={
          confirmando === 'gerar'
            ? 'Gerar novamente?'
            : confirmando === 'limparAjustes'
              ? 'Limpar ajustes manuais?'
              : 'Limpar escala do mês?'
        }
        descricao={
          confirmando === 'gerar'
            ? `A escala de ${nomeMes(mes)} de ${ano} será refeita. Os ajustes manuais são preservados.`
            : confirmando === 'limparAjustes'
              ? 'Todas as duplas voltam ao rodízio automático.'
              : `A escala de ${nomeMes(mes)} de ${ano} será apagada. Esta ação não pode ser desfeita.`
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
              else if (confirmando === 'limparAjustes') limparAjustes()
              else if (confirmando === 'limparEscala') limparEscala()
            }}
          >
            {confirmando === 'gerar' ? 'Gerar' : 'Confirmar'}
          </Botao>
        </div>
      </Modal>
    </div>
  )
}
