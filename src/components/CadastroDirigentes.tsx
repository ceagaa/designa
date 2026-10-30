import type {
  AptidaoId,
  Campo,
  Dirigente,
  FrequenciaId,
  RegrasDepartamento,
  RegrasPorDepartamento,
  ReuniaoAvi,
  SetorId,
} from '../lib/dominio'
import { useMemo, useState } from 'react'
import {
  BookOpen,
  Check,
  ChevronLeft,
  CircleAlert,
  MapPin,
  Trash,
  UserPlus,
  Volume2,
} from 'lucide-react'
import {
  FUNCOES_AVI,
  REGRAS_PADRAO,
  departamentosDe,
  regrasDoDepartamento,
} from '../lib/dominio'
import {
  FREQUENCIAS,
  HORARIOS_PADRAO,
  ORDEM_DIAS,
  frequenciaValida,
  infoDia,
} from '../lib/constants'
import { Botao, Chip, Input, Modal, Rotulo, Vazio } from './ui'
import { BarraFixa } from './CabecalhoDesignacao'

type FormDirigente = Partial<Dirigente> & {
  nome: string
  ativo: boolean
  frequencia: FrequenciaId | string
  dias: number[]
  horarios: string[]
  departamentos: SetorId[]
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
    Icone: BookOpen,
  },
]

const ROTULO_DEPARTAMENTO: Record<SetorId, string> = {
  CAMPO: 'Campo',
  AUDIO_VIDEO: 'AVI',
  TPL: 'TPL',
}

const ORDEM_DEPARTAMENTO: Record<SetorId, number> = {
  CAMPO: 0,
  AUDIO_VIDEO: 1,
  TPL: 2,
}

/** Ordena e remove repetições para manter a exibição previsível. */
function ordenarDepartamentos(lista: SetorId[]): SetorId[] {
  return [...new Set(lista)].sort(
    (a, b) => ORDEM_DEPARTAMENTO[a] - ORDEM_DEPARTAMENTO[b],
  )
}

const FREQUENCIAS_MENSAL: ReadonlyArray<{ valor: 1 | 2 | 3; rotulo: string }> = [
  { valor: 1, rotulo: '1x no mês' },
  { valor: 2, rotulo: 'Até 2x' },
  { valor: 3, rotulo: 'Até 3x' },
]

const REUNIOES_AVI: ReadonlyArray<{ valor: ReuniaoAvi; rotulo: string }> = [
  { valor: 'semana', rotulo: 'Semana' },
  { valor: 'fds', rotulo: 'Final de semana' },
  { valor: 'ambos', rotulo: 'Os dois' },
]

function novoId(): string {
  return `dir-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Departamentos da ficha. Fichas antigas (sem `departamentos`) caem no AVI
 * quando já tinham aptidão; as demais continuam no Campo.
 */
function departamentosDaFicha(
  d: Dirigente,
  aptidoes: Record<string, AptidaoId[]> | null,
): SetorId[] {
  const lista = departamentosDe(d)
  if (lista.length) return ordenarDepartamentos(lista)
  if (aptidoes?.[d.id]?.length) return ['AUDIO_VIDEO']
  return ['CAMPO']
}

function formularioVazio(frequenciaPadrao?: string): FormDirigente {
  const frequenciaCampo = frequenciaValida(frequenciaPadrao)
  return {
    nome: '',
    ativo: true,
    frequencia: frequenciaCampo,
    limiteMensal: 1,
    regrasDepartamento: {
      CAMPO: { frequencia: frequenciaCampo, limiteMensal: 1 },
      AUDIO_VIDEO: { ...REGRAS_PADRAO.AUDIO_VIDEO },
    },
    dias: [],
    horarios: [],
    diasAjudante: [],
    departamentos: [],
    reunioes: 'ambos',
  }
}

/**
 * Regras iniciais da ficha: preserva o que já estava salvo e, ao adicionar um
 * departamento novo, começa com o padrão dele (Campo segue a frequência padrão
 * das configurações; AVI começa mensal, até 3x).
 */
function regrasDaFicha(
  d: Dirigente,
  departamentos: SetorId[],
  frequenciaPadrao: string,
): RegrasPorDepartamento {
  const salvas = d.regrasDepartamento ?? {}
  return {
    CAMPO:
      salvas.CAMPO || departamentos.includes('CAMPO')
        ? regrasDoDepartamento(d, 'CAMPO')
        : { frequencia: frequenciaValida(frequenciaPadrao), limiteMensal: 1 },
    AUDIO_VIDEO:
      salvas.AUDIO_VIDEO || departamentos.includes('AUDIO_VIDEO')
        ? regrasDoDepartamento(d, 'AUDIO_VIDEO')
        : { ...REGRAS_PADRAO.AUDIO_VIDEO },
  }
}

/** Frequência e teto mensal do rodízio, próprios do departamento. */
function RegrasDesignacao({
  setor,
  regras,
  aoAlterar,
}: {
  setor: 'CAMPO' | 'AUDIO_VIDEO'
  regras: RegrasDepartamento
  aoAlterar: (patch: Partial<RegrasDepartamento>) => void
}) {
  return (
    <div
      data-regras={setor}
      className="space-y-4 border-t border-line-soft pt-4"
    >
      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-ink">
          Frequência de designação
        </p>
        <div className="flex flex-wrap gap-1.5">
          {FREQUENCIAS.map((f) => (
            <Chip
              key={f.id}
              ativo={regras.frequencia === f.id}
              onClick={() => aoAlterar({ frequencia: f.id })}
            >
              {f.label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-ink">
          Frequência mensal
        </p>
        <div className="flex flex-wrap gap-1.5">
          {FREQUENCIAS_MENSAL.map((op) => (
            <Chip
              key={op.valor}
              ativo={regras.limiteMensal === op.valor}
              onClick={() => aoAlterar({ limiteMensal: op.valor })}
            >
              {op.rotulo}
            </Chip>
          ))}
        </div>
        <p className="mt-1.5 text-[13px] text-muted">
          Limite de designações no mês neste departamento.
        </p>
      </div>
    </div>
  )
}

/** Cabeçalho de um card de departamento na ficha do voluntário. */
function CabecalhoDepartamento({
  id,
  descricao,
}: {
  id: SetorId
  descricao: string
}) {
  const dep = DEPARTAMENTOS.find((d) => d.id === id)
  if (!dep) return null
  const Icone = dep.Icone
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-tint text-teal"
        aria-hidden="true"
      >
        <Icone className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">{dep.rotulo}</p>
        <p className="text-[12px] text-muted">{descricao}</p>
      </div>
    </div>
  )
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

/**
 * Tela de Voluntários: a lista mostra só nome, departamentos e disponibilidade.
 * Tocar num nome (ou em "Novo voluntário") abre a página de edição, com a
 * ficha completa e os ajustes em chips — igual aos campos do AVI.
 */
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
  /** Cadastro novo começa perguntando os departamentos; edição vai direto à ficha. */
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

  const temCampo = dirigentes.some((d) =>
    departamentosDaFicha(d, aptidoes).includes('CAMPO'),
  )
  /** Departamentos marcados na etapa inicial (ou os atuais, ao editar). */
  const departamentosAtuais = DEPARTAMENTOS.filter((dep) =>
    form?.departamentos.includes(dep.id),
  )
  const IconeDepartamento = departamentosAtuais[0]?.Icone ?? MapPin
  const regrasCampo = form?.regrasDepartamento?.CAMPO ?? REGRAS_PADRAO.CAMPO
  const regrasAvi = form?.regrasDepartamento?.AUDIO_VIDEO ?? REGRAS_PADRAO.AUDIO_VIDEO

  function abrir(novo: Dirigente | null = null) {
    setErro('')
    if (!novo) {
      setForm(formularioVazio(frequenciaPadrao))
      setAptidoesForm([])
      setEtapa('departamento')
      return
    }
    const departamentos = departamentosDaFicha(novo, aptidoes)
    setForm({
      ...novo,
      departamentos,
      regrasDepartamento: regrasDaFicha(novo, departamentos, frequenciaPadrao),
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

  /** Altera frequência/limite de um departamento sem tocar no outro. */
  function alterarRegras(
    setor: 'CAMPO' | 'AUDIO_VIDEO',
    patch: Partial<RegrasDepartamento>,
  ) {
    setForm((f) => {
      if (!f) return f
      const atual = f.regrasDepartamento?.[setor] ?? REGRAS_PADRAO[setor]
      return {
        ...f,
        regrasDepartamento: {
          ...f.regrasDepartamento,
          [setor]: { ...atual, ...patch },
        },
      }
    })
  }

  /** Marca/desmarca um departamento na etapa de escolha (mínimo 1). */
  function alternarDepartamento(id: SetorId) {
    setForm((f) => {
      if (!f) return f
      const departamentos = f.departamentos.includes(id)
        ? f.departamentos.filter((s) => s !== id)
        : ordenarDepartamentos([...f.departamentos, id])
      return { ...f, departamentos }
    })
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
    if (!form.departamentos.length) {
      setErro('Escolha pelo menos um departamento.')
      setEtapa('departamento')
      return
    }

    const id = form.id ?? novoId()
    const departamentos = ordenarDepartamentos(form.departamentos)
    const incluiCampo = departamentos.includes('CAMPO')
    const incluiAvi = departamentos.includes('AUDIO_VIDEO')
    const regraCampo = form.regrasDepartamento?.CAMPO ?? {
      frequencia: frequenciaValida(form.frequencia),
      limiteMensal:
        form.limiteMensal === 2 || form.limiteMensal === 3 ? form.limiteMensal : 1,
    }
    const regraAvi = form.regrasDepartamento?.AUDIO_VIDEO ?? {
      ...REGRAS_PADRAO.AUDIO_VIDEO,
    }
    const regrasDepartamento: RegrasPorDepartamento = {
      ...(incluiCampo ? { CAMPO: regraCampo } : {}),
      ...(incluiAvi ? { AUDIO_VIDEO: regraAvi } : {}),
    }
    const principal = incluiCampo ? regraCampo : incluiAvi ? regraAvi : null
    const registro: Dirigente = {
      ...form,
      id,
      nome: form.nome.trim(),
      telefone: (form.telefone ?? '').trim(),
      ativo: form.ativo !== false,
      departamentos,
      // Compatibilidade: fichas antigas leem só o departamento principal.
      departamento: departamentos[0],
      reunioes: incluiAvi ? (form.reunioes ?? 'ambos') : undefined,
      frequencia: principal?.frequencia ?? frequenciaValida(form.frequencia),
      limiteMensal: principal?.limiteMensal ?? 1,
      regrasDepartamento:
        Object.keys(regrasDepartamento).length > 0 ? regrasDepartamento : undefined,
      dias: incluiCampo ? [...form.dias].sort((a, b) => a - b) : [],
      horarios: incluiCampo ? [...form.horarios] : [],
      ajudante: incluiCampo ? form.ajudante === true : false,
      diasAjudante:
        incluiCampo && form.ajudante === true
          ? [...(form.diasAjudante ?? [])].sort((a, b) => a - b)
          : undefined,
    }

    const existe = dirigentes.some((d) => d.id === registro.id)
    aoAlterar(
      existe
        ? dirigentes.map((d) => (d.id === registro.id ? registro : d))
        : [...dirigentes, registro],
    )
    aoDefinirAptidoes?.(registro.id, incluiAvi ? aptidoesForm : [])
    fechar()
  }

  function remover(id: string) {
    aoAlterar(dirigentes.filter((d) => d.id !== id))
    fechar()
  }

  /* ------------------------------ Página de edição ------------------------------ */

  const modalExclusao = (
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
  )

  if (form) {
    const novo = !form.id
    const incluiCampo = form.departamentos.includes('CAMPO')
    const incluiAvi = form.departamentos.includes('AUDIO_VIDEO')
    const avisoRodizio =
      incluiCampo && (!form.dias.length || !form.horarios.length)

    return (
      <div data-testid="ficha-voluntario" className="space-y-5 pb-4">
        <header className="flex items-center gap-2">
          <button
            type="button"
            aria-label={novo ? 'Voltar para a lista' : 'Voltar para voluntários'}
            onClick={fechar}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-canvas hover:text-ink"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-ink">
              {novo ? 'Novo voluntário' : form.nome || 'Voluntário'}
            </h1>
            <p className="text-[13px] text-muted">
              {novo ? 'Escolha os departamentos e preencha a ficha' : 'Ficha e disponibilidade'}
            </p>
          </div>
        </header>

        {etapa === 'departamento' ? (
          <section className="space-y-2">
            <p className="text-sm text-muted">
              Escolha um ou mais departamentos. As opções da ficha aparecem em seguida.
            </p>
            {DEPARTAMENTOS.map((dep) => {
              const ativo = form.departamentos.includes(dep.id)
              return (
                <button
                  key={dep.id}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => alternarDepartamento(dep.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all active:scale-[0.99] ${
                    ativo
                      ? 'border-teal bg-teal-tint'
                      : 'border-line bg-canvas hover:border-teal'
                  }`}
                >
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                      ativo ? 'bg-white text-teal' : 'bg-teal-tint text-teal'
                    }`}
                    aria-hidden="true"
                  >
                    <dep.Icone className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink">{dep.rotulo}</span>
                    <span className="block text-[13px] leading-snug text-muted">
                      {dep.descricao}
                    </span>
                  </span>
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      ativo ? 'border-teal bg-teal text-white' : 'border-line'
                    }`}
                    aria-hidden="true"
                  >
                    {ativo ? <Check className="size-3.5" strokeWidth={3} /> : null}
                  </span>
                </button>
              )
            })}
            <Botao
              variante="primario"
              className="w-full py-3.5 text-base shadow-sm"
              disabled={!form.departamentos.length}
              onClick={() => setEtapa('ficha')}
            >
              Continuar
            </Botao>
            {!form.departamentos.length ? (
              <p className="text-center text-[13px] text-muted">
                Marque pelo menos um departamento para continuar.
              </p>
            ) : null}
          </section>
        ) : (
          <div className="space-y-5">
            {/* Os departamentos foram escolhidos na etapa anterior: aqui só confirmamos. */}
            <div className="flex items-center gap-3 rounded-xl bg-teal-tint px-3 py-2.5">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-teal"
                aria-hidden="true"
              >
                <IconeDepartamento className="size-5" />
              </span>
              <p className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-teal-deep/70">
                  {departamentosAtuais.length > 1 ? 'Departamentos' : 'Departamento'}
                </span>
                <span className="block text-sm font-bold text-teal-deep">
                  {departamentosAtuais.map((dep) => dep.rotulo).join(' · ')}
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

            <section className="space-y-4 rounded-2xl bg-card p-4 shadow-sm">
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
                  autoFocus={novo}
                />
              </div>
            </section>

            {incluiCampo ? (
              <section
                data-departamento="CAMPO"
                className="space-y-4 rounded-2xl bg-card p-4 shadow-sm"
              >
                <CabecalhoDepartamento id="CAMPO" descricao="Dias e horários" />

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

                <RegrasDesignacao
                  setor="CAMPO"
                  regras={regrasCampo}
                  aoAlterar={(patch) => alterarRegras('CAMPO', patch)}
                />

                <div className="border-t border-line-soft pt-4">
                  <p className="mb-1.5 text-[13px] font-semibold text-ink">Ajudante</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Chip
                      ativo={form.ajudante === true}
                      onClick={() => alternar('ajudante', form.ajudante !== true)}
                    >
                      Marcar como ajudante
                    </Chip>
                  </div>
                  {form.ajudante === true ? (
                    <fieldset className="mt-3">
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
                        Sem nenhum dia marcado, ajuda em qualquer dia. A frequência e o
                        limite mensal acima também valem para as vezes como ajudante.
                      </p>
                    </fieldset>
                  ) : null}
                </div>
              </section>
            ) : null}

            {incluiAvi ? (
              <section
                data-departamento="AUDIO_VIDEO"
                className="space-y-4 rounded-2xl bg-card p-4 shadow-sm"
              >
                <CabecalhoDepartamento id="AUDIO_VIDEO" descricao="Funções e reuniões" />

                <div>
                  <p className="mb-1.5 text-[13px] font-semibold text-ink">
                    Designações AVI
                  </p>
                  {aoDefinirAptidoes ? (
                    <>
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
                    </>
                  ) : (
                    <p className="rounded-xl bg-teal-tint px-3 py-2 text-[13px] text-teal-deep">
                      As designações AVI são definidas pelo administrador.
                    </p>
                  )}
                </div>

                <div>
                  <p className="mb-1.5 text-[13px] font-semibold text-ink">Reuniões</p>
                  <div className="flex flex-wrap gap-1.5">
                    {REUNIOES_AVI.map((op) => (
                      <Chip
                        key={op.valor}
                        ativo={(form.reunioes ?? 'ambos') === op.valor}
                        onClick={() => alternar('reunioes', op.valor)}
                      >
                        {op.rotulo}
                      </Chip>
                    ))}
                  </div>
                </div>

                <RegrasDesignacao
                  setor="AUDIO_VIDEO"
                  regras={regrasAvi}
                  aoAlterar={(patch) => alterarRegras('AUDIO_VIDEO', patch)}
                />
              </section>
            ) : null}

            {incluiCampo || incluiAvi ? (
              <>
                <section className="space-y-4 rounded-2xl bg-card p-4 shadow-sm">
                  <div>
                    <p className="mb-1.5 text-[13px] font-semibold text-ink">Disponibilidade</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Chip
                        ativo={form.ativo !== false}
                        onClick={() => alternar('ativo', true)}
                      >
                        Disponível
                      </Chip>
                      <Chip
                        ativo={form.ativo === false}
                        onClick={() => alternar('ativo', false)}
                      >
                        Inativo
                      </Chip>
                    </div>
                    <p className="mt-1.5 text-[13px] text-muted">
                      Inativo continua na lista, mas fica fora do rodízio.
                    </p>
                  </div>
                </section>
              </>
            ) : null}

            {!novo && (incluiCampo || incluiAvi) ? (
              <p className="rounded-xl bg-canvas px-3 py-2 text-[13px] text-muted">
                <span className="font-semibold text-ink">
                  {contagem[form.id ?? ''] ?? 0} designaç
                  {(contagem[form.id ?? ''] ?? 0) === 1 ? 'ão' : 'ões'}
                </span>{' '}
                em {mes + 1}/{String(ano).slice(2)}
              </p>
            ) : null}

            {erro ? (
              <p role="alert" className="text-sm font-semibold text-crimson">
                {erro}
              </p>
            ) : null}

            {avisoRodizio ? (
              <p className="rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] text-ink">
                Sem dias ou horários marcados este voluntário fica fora do rodízio automático.
              </p>
            ) : null}

            <div className="space-y-4">
              <Botao
                variante="primario"
                className="w-full py-3.5 text-base shadow-sm"
                onClick={salvar}
              >
                Salvar voluntário
              </Botao>

              {/* Ação destrutiva no fim da ficha, separada do salvar. */}
              {form.id ? (
                <div className="border-t border-line pt-4">
                  <Botao
                    variante="perigo"
                    className="w-full"
                    onClick={() => {
                      const alvo = dirigentes.find((d) => d.id === form.id)
                      if (alvo) setExcluindo(alvo)
                    }}
                  >
                    <Trash className="size-4" aria-hidden="true" />
                    Excluir voluntário
                  </Botao>
                </div>
              ) : null}
            </div>
          </div>
        )}
        {modalExclusao}
      </div>
    )
  }

  /* -------------------------------- Lista -------------------------------- */

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
              const deptos = departamentosDaFicha(d, aptidoes).map(
                (dep) => ROTULO_DEPARTAMENTO[dep],
              )
              const inativo = d.ativo === false

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
                  className={`flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-sm transition-all hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${
                    inativo ? 'opacity-85 hover:opacity-100' : ''
                  }`}
                >
                  <span
                    className={`flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-sm ${
                      inativo ? 'bg-line text-muted' : 'bg-teal-tint text-teal-deep'
                    }`}
                    aria-hidden="true"
                  >
                    {iniciais(d.nome)}
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={`truncate text-sm font-semibold ${
                        inativo ? 'text-ink-soft' : 'text-ink'
                      }`}
                    >
                      {d.nome}
                    </span>
                    <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 text-[13px]">
                      <span className="truncate font-medium text-teal">
                        {deptos.join(' · ')}
                      </span>
                    </span>
                  </span>

                  <span
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                      inativo
                        ? 'bg-line text-ink-soft'
                        : 'bg-success-bg text-success'
                    }`}
                    aria-label={inativo ? 'Indisponível' : 'Disponível'}
                  >
                    <span
                      className={`size-1.5 rounded-full ${inativo ? 'bg-muted' : 'bg-success'}`}
                      aria-hidden="true"
                    />
                    {inativo ? 'Inativo' : 'Disponível'}
                  </span>
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

      {modalExclusao}

      {!campos.length && temCampo ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] text-ink">
          <p className="flex min-w-0 flex-1 items-start gap-2">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-crimson" aria-hidden="true" />
            Configure os dias de campo na tela Locais para que o rodízio comece a distribuir.
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
