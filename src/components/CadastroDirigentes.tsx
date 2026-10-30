import type {
  AptidaoId,
  Campo,
  Dirigente,
  FrequenciaId,
  ReuniaoAvi,
  SetorId,
} from '../lib/dominio'
import { useMemo, useState } from 'react'
import {
  CalendarDays,
  Check,
  CircleAlert,
  MapPin,
  Megaphone,
  Trash,
  UserPlus,
  Volume2,
} from 'lucide-react'
import { FUNCOES_AVI } from '../lib/dominio'
import { FREQUENCIAS, HORARIOS_PADRAO, MESES, ORDEM_DIAS, infoDia } from '../lib/constants'
import { Botao, Chip, Input, Modal, Rotulo, Select, Vazio } from './ui'
import { BarraFixa } from './CabecalhoDesignacao'

type FormDirigente = Partial<Dirigente> & {
  nome: string
  telefone: string
  ativo: boolean
  frequencia: FrequenciaId | string
  dias: number[]
  horarios: string[]
  departamento: SetorId
  reunioes: ReuniaoAvi
}

const DEPARTAMENTOS: ReadonlyArray<{
  id: SetorId
  rotulo: string
  descricao: string
  Icone: typeof MapPin
}> = [
  {
    id: 'CAMPO',
    rotulo: 'Campo',
    descricao: 'Dirige no serviço de campo, com ou sem ajudante.',
    Icone: MapPin,
  },
  {
    id: 'AUDIO_VIDEO',
    rotulo: 'AVI',
    descricao: 'Áudio, Vídeo & Indicadores nas reuniões.',
    Icone: Volume2,
  },
  {
    id: 'TPL',
    rotulo: 'TPL',
    descricao: 'Testemunho Público Local com o carrinho.',
    Icone: Megaphone,
  },
]

const ROTULO_DEPARTAMENTO: Record<SetorId, string> = {
  CAMPO: 'Campo',
  AUDIO_VIDEO: 'AVI',
  TPL: 'TPL',
}

const ROTULO_REUNIAO: Record<ReuniaoAvi, string> = {
  semana: 'Semana',
  fds: 'Final de semana',
  ambos: 'Os dois',
}

function novoId(): string {
  return `dir-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function departamentoDe(
  d: Dirigente,
  aptidoes: Record<string, AptidaoId[]> | null,
): SetorId {
  if (d.departamento) return d.departamento
  // Fichas antigas com aptidão eram do AVI; as demais continuam no Campo.
  if (aptidoes?.[d.id]?.length) return 'AUDIO_VIDEO'
  return 'CAMPO'
}

function formularioVazio(frequenciaPadrao?: string): FormDirigente {
  return {
    nome: '',
    telefone: '',
    ativo: true,
    frequencia: frequenciaPadrao ?? 'quinzenal',
    limiteMensal: 1,
    dias: [],
    horarios: [],
    diasAjudante: [],
    departamento: 'CAMPO',
    reunioes: 'ambos',
  }
}

function iniciais(nome: string): string {
  return (
    nome
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0] ?? '')
      .join('')
      .toUpperCase() || '?'
  )
}

function rotuloFrequencia(id: string): string {
  return FREQUENCIAS.find((f) => f.id === id)?.label ?? 'Semanal'
}

interface CadastroDirigentesProps {
  dirigentes: Dirigente[]
  campos: Campo[]
  frequenciaPadrao: string
  ano: number
  mes: number
  /** Designações efetivas do mês corrente (iso → id). */
  efetivas: Record<string, string>
  aoAlterar: (lista: Dirigente[]) => void
  /** Designações AVI por voluntário. Oculto quando null. */
  aptidoes?: Record<string, AptidaoId[]> | null
  /** Salva as designações AVI de um voluntário. */
  aoDefinirAptidoes?: (idIrmao: string, aptidoes: AptidaoId[]) => void
  /** Abre a tela Locais quando faltam dias de campo. */
  aoConfigurar?: () => void
}

export default function CadastroDirigentes({
  dirigentes,
  campos,
  frequenciaPadrao,
  ano,
  mes,
  efetivas,
  aoAlterar,
  aptidoes = null,
  aoDefinirAptidoes,
  aoConfigurar,
}: CadastroDirigentesProps) {
  const [form, setForm] = useState<FormDirigente | null>(null)
  /** Cadastro novo começa perguntando o departamento; edição vai direto à ficha. */
  const [etapa, setEtapa] = useState<'departamento' | 'ficha'>('ficha')
  const [erro, setErro] = useState('')
  const [excluindo, setExcluindo] = useState<Dirigente | null>(null)
  const [aptidoesForm, setAptidoesForm] = useState<AptidaoId[]>([])

  const horarios = useMemo(() => {
    const conjunto = new Set([...HORARIOS_PADRAO])
    for (const c of campos) if (c.horario) conjunto.add(c.horario)
    for (const d of dirigentes) for (const h of d.horarios ?? []) conjunto.add(h)
    return [...conjunto].sort()
  }, [campos, dirigentes])

  const contagem = useMemo(() => {
    const mapa: Record<string, number> = {}
    for (const id of Object.values(efetivas)) {
      if (id) mapa[id] = (mapa[id] ?? 0) + 1
    }
    return mapa
  }, [efetivas])

  const resumoMes = `${MESES[mes].slice(0, 3)}/${String(ano).slice(2)}`
  const temCampo = dirigentes.some((d) => departamentoDe(d, aptidoes) === 'CAMPO')
  /** Departamento escolhido na etapa inicial (ou o atual, ao editar). */
  const DepartamentoAtual =
    DEPARTAMENTOS.find((dep) => dep.id === form?.departamento) ?? DEPARTAMENTOS[0]

  function abrir(novo: Dirigente | null = null) {
    setErro('')
    if (!novo) {
      setForm(formularioVazio(frequenciaPadrao))
      setAptidoesForm([])
      setEtapa('departamento')
      return
    }
    setForm({
      ...novo,
      departamento: departamentoDe(novo, aptidoes),
      reunioes: novo.reunioes ?? 'ambos',
      dias: [...(novo.dias ?? [])],
      horarios: [...(novo.horarios ?? [])],
      diasAjudante: [...(novo.diasAjudante ?? [])],
    })
    setAptidoesForm(aptidoes?.[novo.id] ?? [])
    setEtapa('ficha')
  }

  function fechar() {
    setForm(null)
    setErro('')
  }

  function alternar<K extends keyof FormDirigente>(campo: K, valor: FormDirigente[K]) {
    setForm((f) => (f ? { ...f, [campo]: valor } : f))
  }

  function alternarNaLista(campo: 'dias' | 'horarios' | 'diasAjudante', valor: number | string) {
    setForm((f) => {
      if (!f) return f
      const lista = new Set<number | string>(f[campo])
      if (lista.has(valor)) lista.delete(valor)
      else lista.add(valor)
      return {
        ...f,
        [campo]: [...lista].sort((a, b) => String(a).localeCompare(String(b))),
      }
    })
  }

  function alternarAptidaoForm(aptidao: AptidaoId) {
    setAptidoesForm((atual) =>
      atual.includes(aptidao)
        ? atual.filter((a) => a !== aptidao)
        : [...atual, aptidao],
    )
  }

  function salvar() {
    if (!form?.nome.trim()) {
      setErro('Informe o nome do voluntário.')
      return
    }

    const id = form.id ?? novoId()
    const departamento = form.departamento
    const registro: Dirigente = {
      ...form,
      id,
      nome: form.nome.trim(),
      telefone: form.telefone.trim(),
      ativo: form.ativo !== false,
      departamento,
      reunioes: departamento === 'AUDIO_VIDEO' ? (form.reunioes ?? 'ambos') : undefined,
      limiteMensal:
        form.limiteMensal === 2 || form.limiteMensal === 3 ? form.limiteMensal : 1,
      dias: departamento === 'CAMPO' ? [...form.dias].sort((a, b) => a - b) : [],
      horarios: departamento === 'CAMPO' ? [...form.horarios] : [],
      ajudante: departamento === 'CAMPO' ? form.ajudante === true : false,
      diasAjudante:
        departamento === 'CAMPO' && form.ajudante === true
          ? [...(form.diasAjudante ?? [])].sort((a, b) => a - b)
          : undefined,
    }

    const existe = dirigentes.some((d) => d.id === registro.id)
    aoAlterar(
      existe
        ? dirigentes.map((d) => (d.id === registro.id ? registro : d))
        : [...dirigentes, registro],
    )
    aoDefinirAptidoes?.(
      registro.id,
      departamento === 'AUDIO_VIDEO' ? aptidoesForm : [],
    )
    fechar()
  }

  function alternarAtivo(d: Dirigente) {
    aoAlterar(
      dirigentes.map((x) =>
        x.id === d.id ? { ...x, ativo: x.ativo === false } : x,
      ),
    )
  }

  function alternarAptidaoCartao(d: Dirigente, aptidao: AptidaoId) {
    if (!aoDefinirAptidoes) return
    const atuais = aptidoes?.[d.id] ?? []
    const nova = atuais.includes(aptidao)
      ? atuais.filter((a) => a !== aptidao)
      : [...atuais, aptidao]
    aoDefinirAptidoes(d.id, nova)
  }

  function remover(id: string) {
    aoAlterar(dirigentes.filter((d) => d.id !== id))
    fechar()
  }

  function pedirExclusao() {
    if (!form?.id) return
    const alvo = dirigentes.find((d) => d.id === form.id)
    setForm(null)
    setErro('')
    if (alvo) setExcluindo(alvo)
  }

  return (
    <div className="space-y-6">
      {dirigentes.length ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <h2 className="text-lg font-semibold text-ink">Quadro de voluntários</h2>
            <p className="text-sm text-muted">
              {dirigentes.length} voluntário{dirigentes.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {dirigentes.map((d) => {
              const depto = departamentoDe(d, aptidoes)
              const inativo = d.ativo === false
              const n = contagem[d.id] ?? 0
              const diasTexto = (d.dias ?? []).map((idx) => infoDia(idx).curto).join(' · ')
              const nota =
                depto === 'CAMPO'
                  ? (d.horarios ?? []).length
                    ? (d.horarios ?? []).join(' · ')
                    : 'Sem horário'
                  : depto === 'AUDIO_VIDEO'
                    ? `Reuniões: ${ROTULO_REUNIAO[d.reunioes ?? 'ambos']}`
                    : 'Escala manual'

              return (
                <article
                  key={d.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Editar ${d.nome}`}
                  onClick={() => abrir(d)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      abrir(d)
                    }
                  }}
                  className={`cursor-pointer rounded-2xl bg-card p-4 text-left shadow-sm transition-all hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
                    inativo ? 'opacity-85 hover:opacity-100' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-sm ${
                          inativo ? 'bg-line text-muted' : 'bg-teal-tint text-teal-deep'
                        }`}
                        aria-hidden="true"
                      >
                        {iniciais(d.nome)}
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <h3
                          className={`truncate text-sm font-semibold ${
                            inativo ? 'text-ink-soft' : 'text-ink'
                          }`}
                        >
                          {d.nome}
                        </h3>
                        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px]">
                          <span
                            className={`shrink-0 font-medium ${
                              inativo ? 'text-muted' : 'text-teal'
                            }`}
                          >
                            {ROTULO_DEPARTAMENTO[depto]}
                          </span>
                          {depto === 'CAMPO' && !inativo && diasTexto ? (
                            <>
                              <span
                                className="size-1 shrink-0 rounded-full bg-muted"
                                aria-hidden="true"
                              />
                              <span className="truncate text-muted">{diasTexto}</span>
                            </>
                          ) : null}
                          {depto === 'CAMPO' && !diasTexto ? (
                            <span className="truncate text-muted">
                              {rotuloFrequencia(d.frequencia)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        aria-pressed={inativo}
                        aria-label={
                          inativo
                            ? `Marcar ${d.nome} como disponível`
                            : `Marcar ${d.nome} como inativo`
                        }
                        onClick={(e) => {
                          e.stopPropagation()
                          alternarAtivo(d)
                        }}
                        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition-colors ${
                          inativo
                            ? 'bg-line text-ink-soft hover:bg-line-soft'
                            : 'bg-success-bg text-success hover:bg-success/15'
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            inativo ? 'bg-muted' : 'bg-success'
                          }`}
                          aria-hidden="true"
                        />
                        {inativo ? 'Inativo' : 'Disponível'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-canvas/70 px-3 py-2 text-[13px]">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <CalendarDays
                        className={`size-[18px] shrink-0 ${
                          inativo ? 'text-muted' : 'text-teal'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="truncate">
                        {depto === 'CAMPO' ? (
                          <>
                            <span className="font-semibold text-ink">
                              {n} designaç{n === 1 ? 'ão' : 'ões'}
                            </span>{' '}
                            <span className="text-muted">em {resumoMes}</span>
                          </>
                        ) : depto === 'AUDIO_VIDEO' ? (
                          <span className="font-semibold text-ink">
                            Áudio, Vídeo & Indicadores
                          </span>
                        ) : (
                          <span className="font-semibold text-ink">
                            Testemunho Público Local
                          </span>
                        )}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-right ${
                        depto === 'CAMPO' && !inativo && !(d.horarios ?? []).length
                          ? 'font-medium text-crimson'
                          : 'text-muted'
                      }`}
                    >
                      {nota}
                    </span>
                  </div>

                  {depto === 'AUDIO_VIDEO' &&
                  aptidoes !== null &&
                  aoDefinirAptidoes ? (
                    <div
                      className="mt-3 border-t border-line-soft pt-3"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <p className="mb-1.5 text-[12px] font-semibold text-muted">
                        Designações AVI
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {FUNCOES_AVI.map((f) => (
                          <Chip
                            key={f.id}
                            ativo={(aptidoes[d.id] ?? []).includes(f.id)}
                            onClick={() => alternarAptidaoCartao(d, f.id)}
                          >
                            {f.rotulo}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        </section>
      ) : (
        <Vazio
          icone={UserPlus}
          titulo="Nenhum voluntário cadastrado. Comece pela ficha: nome e departamento."
          acao={
            <Botao variante="primario" onClick={() => abrir()}>
              <UserPlus className="size-4" aria-hidden="true" />
              Cadastrar primeiro voluntário
            </Botao>
          }
        />
      )}

      <Modal
        aberto={form !== null}
        aoFechar={fechar}
        titulo={form?.id ? 'Editar voluntário' : 'Novo voluntário'}
        descricao="Cada voluntário serve em um departamento."
        largura="max-w-lg"
      >
        {form ? (
          etapa === 'departamento' ? (
            <div className="space-y-2 px-5 py-4">
              <p className="text-sm text-muted">
                Escolha o departamento primeiro. As opções da ficha aparecem em seguida.
              </p>
              {DEPARTAMENTOS.map((dep) => (
                <button
                  key={dep.id}
                  type="button"
                  onClick={() => {
                    alternar('departamento', dep.id)
                    setEtapa('ficha')
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-line bg-canvas px-4 py-3.5 text-left transition-all hover:border-teal hover:bg-teal-tint active:scale-[0.99]"
                >
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-tint text-teal"
                    aria-hidden="true"
                  >
                    <dep.Icone className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-ink">{dep.rotulo}</span>
                    <span className="block text-[13px] leading-snug text-muted">
                      {dep.descricao}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
          <div className="space-y-4 px-5 py-4">
            {/* O departamento foi escolhido na etapa anterior: aqui só confirmamos. */}
            <div className="flex items-center gap-3 rounded-xl bg-teal-tint px-3 py-2.5">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-teal"
                aria-hidden="true"
              >
                <DepartamentoAtual.Icone className="size-5" />
              </span>
              <p className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-teal-deep/70">
                  Departamento
                </span>
                <span className="block truncate text-sm font-bold text-teal-deep">
                  {DepartamentoAtual.rotulo}
                </span>
              </p>
              <Botao
                variante="fantasma"
                className="shrink-0 text-teal-deep"
                onClick={() => setEtapa('departamento')}
              >
                Trocar
              </Botao>
            </div>

            <div>
              <Rotulo htmlFor="dir-nome">Nome</Rotulo>
              <Input
                id="dir-nome"
                value={form.nome}
                onChange={(e) => alternar('nome', e.target.value)}
                placeholder="Ex.: Carlos Andrade"
                autoComplete="name"
                autoCapitalize="words"
                spellCheck={false}
                enterKeyHint="next"
                autoFocus
              />
            </div>

            {form.departamento === 'CAMPO' ? (
              <>
                <div>
                  <Rotulo htmlFor="dir-freq">Frequência de designação</Rotulo>
                  <Select
                    id="dir-freq"
                    value={form.frequencia}
                    onChange={(e) => alternar('frequencia', e.target.value)}
                  >
                    {FREQUENCIAS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Rotulo htmlFor="dir-limite-mensal">Frequência mensal</Rotulo>
                  <Select
                    id="dir-limite-mensal"
                    value={form.limiteMensal ?? 1}
                    onChange={(e) =>
                      alternar('limiteMensal', Number(e.target.value) as 1 | 2 | 3)
                    }
                  >
                    <option value={1}>1x no mês</option>
                    <option value={2}>Até 2x no mês</option>
                    <option value={3}>Até 3x no mês</option>
                  </Select>
                  <p className="mt-1.5 text-[13px] text-muted">
                    Aplica-se ao rodízio. Dias com voluntário fixo não contam neste limite.
                  </p>
                </div>

                <fieldset>
                  <legend className="mb-1.5 text-[13px] font-semibold text-ink">
                    Dias disponíveis
                  </legend>
                  <div className="flex flex-wrap gap-1.5">
                    {ORDEM_DIAS.map((idx) => (
                      <Chip
                        key={idx}
                        ativo={form.dias.includes(idx)}
                        onClick={() => alternarNaLista('dias', idx)}
                      >
                        {infoDia(idx).curto}
                      </Chip>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="mb-1.5 text-[13px] font-semibold text-ink">
                    Horários disponíveis
                  </legend>
                  <div className="flex flex-wrap gap-1.5">
                    {horarios.map((h) => (
                      <Chip
                        key={h}
                        ativo={form.horarios.includes(h)}
                        onClick={() => alternarNaLista('horarios', h)}
                      >
                        {h}
                      </Chip>
                    ))}
                  </div>
                </fieldset>

                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-canvas px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={form.ajudante === true}
                    onChange={(e) => alternar('ajudante', e.target.checked)}
                    className="size-4 accent-teal"
                  />
                  <span className="text-sm font-semibold text-ink">
                    Marcar como ajudante
                  </span>
                </label>

                {form.ajudante === true ? (
                  <fieldset>
                    <legend className="mb-1.5 text-[13px] font-semibold text-ink">
                      Dias como ajudante
                    </legend>
                    <div className="flex flex-wrap gap-1.5">
                      {ORDEM_DIAS.map((idx) => (
                        <Chip
                          key={idx}
                          ativo={(form.diasAjudante ?? []).includes(idx)}
                          onClick={() => alternarNaLista('diasAjudante', idx)}
                        >
                          {infoDia(idx).curto}
                        </Chip>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[13px] text-muted">
                      Sem nenhum dia marcado, ajuda em qualquer dia.
                    </p>
                  </fieldset>
                ) : null}

                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-canvas px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={form.ativo === false}
                    onChange={(e) => alternar('ativo', !e.target.checked)}
                    className="size-4 accent-teal"
                  />
                  <span className="text-sm font-semibold text-ink">
                    Marcar pessoa como inativa
                  </span>
                </label>
              </>
            ) : form.departamento === 'AUDIO_VIDEO' ? (
              <>
                <div>
                  <Rotulo htmlFor="dir-freq">Frequência de designação</Rotulo>
                  <Select
                    id="dir-freq"
                    value={form.frequencia}
                    onChange={(e) => alternar('frequencia', e.target.value)}
                  >
                    {FREQUENCIAS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Rotulo htmlFor="dir-limite-mensal">Frequência mensal</Rotulo>
                  <Select
                    id="dir-limite-mensal"
                    value={form.limiteMensal ?? 1}
                    onChange={(e) =>
                      alternar('limiteMensal', Number(e.target.value) as 1 | 2 | 3)
                    }
                  >
                    <option value={1}>1x no mês</option>
                    <option value={2}>Até 2x no mês</option>
                    <option value={3}>Até 3x no mês</option>
                  </Select>
                </div>

                <div>
                  <Rotulo htmlFor="dir-reunioes">Reuniões</Rotulo>
                  <Select
                    id="dir-reunioes"
                    value={form.reunioes ?? 'ambos'}
                    onChange={(e) =>
                      alternar('reunioes', e.target.value as ReuniaoAvi)
                    }
                  >
                    <option value="semana">Semana</option>
                    <option value="fds">Final de semana</option>
                    <option value="ambos">Os dois</option>
                  </Select>
                </div>

                {aoDefinirAptidoes ? (
                  <fieldset>
                    <legend className="mb-1.5 text-[13px] font-semibold text-ink">
                      Designações AVI
                    </legend>
                    <div className="flex flex-wrap gap-1.5">
                      {FUNCOES_AVI.map((f) => (
                        <Chip
                          key={f.id}
                          ativo={aptidoesForm.includes(f.id)}
                          onClick={() => alternarAptidaoForm(f.id)}
                        >
                          {f.rotulo}
                        </Chip>
                      ))}
                    </div>
                    <p className="mt-1.5 text-[13px] text-muted">
                      Marque as funções em que o voluntário pode servir.
                    </p>
                  </fieldset>
                ) : (
                  <p className="rounded-xl bg-teal-tint px-3 py-2 text-[13px] text-teal-deep">
                    As designações AVI são definidas pelo administrador.
                  </p>
                )}
              </>
            ) : (
              <p className="rounded-xl bg-teal-tint px-3 py-2 text-[13px] text-teal-deep">
                No TPL a ficha usa só o nome. As duplas são montadas manualmente na
                escala do TPL.
              </p>
            )}

            {erro ? (
              <p role="alert" className="text-sm font-semibold text-crimson">
                {erro}
              </p>
            ) : null}

            {form.departamento === 'CAMPO' &&
            (!form.dias.length || !form.horarios.length) ? (
              <p className="rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] text-ink">
                Sem dias ou horários marcados este voluntário fica fora do rodízio
                automático.
              </p>
            ) : null}

            <div className="flex items-center gap-2">
              {form.id ? (
                <Botao variante="perigo" onClick={pedirExclusao}>
                  <Trash className="size-4" aria-hidden="true" />
                  Excluir
                </Botao>
              ) : null}
              <Botao variante="primario" className="flex-1" onClick={salvar}>
                <Check className="size-4" aria-hidden="true" />
                Salvar voluntário
              </Botao>
            </div>
          </div>
          )
        ) : null}
      </Modal>

      <Modal
        aberto={excluindo !== null}
        aoFechar={() => setExcluindo(null)}
        titulo="Excluir voluntário"
        descricao={
          excluindo
            ? `${excluindo.nome} sai da equipe e não aparece mais nas escalas.`
            : undefined
        }
        largura="max-w-sm"
      >
        <div className="flex gap-2 px-5 py-4">
          <Botao className="flex-1" onClick={() => setExcluindo(null)}>
            Cancelar
          </Botao>
          <Botao
            variante="vinho"
            className="flex-1"
            onClick={() => {
              if (excluindo) remover(excluindo.id)
              setExcluindo(null)
            }}
          >
            <Trash className="size-4" aria-hidden="true" />
            Excluir
          </Botao>
        </div>
      </Modal>

      {!campos.length && temCampo ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] text-ink">
          <p className="flex min-w-0 flex-1 items-start gap-2">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-crimson" aria-hidden="true" />
            Configure os dias de campo na tela Locais para que o rodízio comece a
            distribuir.
          </p>
          {aoConfigurar ? (
            <Botao variante="fantasma" className="shrink-0 text-crimson" onClick={aoConfigurar}>
              Abrir Locais
            </Botao>
          ) : null}
        </div>
      ) : null}

      {/* Barra fixa acima da Bottom Nav: novo voluntário em largura total. */}
      <BarraFixa>
        <Botao
          variante="primario"
          aria-label="Novo voluntário"
          className="w-full py-3.5 text-base shadow-sm"
          onClick={() => abrir()}
        >
          <UserPlus className="size-5" aria-hidden="true" />
          Novo voluntário
        </Botao>
      </BarraFixa>
    </div>
  )
}
