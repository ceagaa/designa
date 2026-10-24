import type { AptidaoId, Campo, Dirigente, FrequenciaId, ParticipanteTpl } from '../lib/dominio'
import { useMemo, useState } from 'react'
import { CalendarDays, Check, CircleAlert, Trash, UserPlus } from 'lucide-react'
import { FUNCOES_AVI } from '../lib/dominio'
import { FREQUENCIAS, HORARIOS_PADRAO, MESES, ORDEM_DIAS, infoDia } from '../lib/constants'
import { Botao, Chip, Input, Modal, Rotulo, Select, Vazio } from './ui'

type FormDirigente = Partial<Dirigente> & {
  nome: string
  telefone: string
  ativo: boolean
  frequencia: FrequenciaId | string
  dias: number[]
  horarios: string[]
}

function novoId(): string {
  return `dir-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function formularioVazio(frequenciaPadrao?: string): FormDirigente {
  return {
    nome: '',
    telefone: '',
    ativo: true,
    frequencia: frequenciaPadrao ?? 'quinzenal',
    dias: [],
    horarios: [],
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
  /** Designações AVI por irmão (cadastro unificado). Oculto quando null. */
  aptidoes?: Record<string, AptidaoId[]> | null
  aoAlternarAptidao?: (idIrmao: string, aptidao: AptidaoId) => void
  /** Participantes do TPL (chave = id da ficha). Oculto quando null. */
  participantesTpl?: ParticipanteTpl[] | null
  aoAlternarTpl?: (dirigente: Dirigente) => void
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
  aoAlternarAptidao,
  participantesTpl = null,
  aoAlternarTpl,
  aoConfigurar,
}: CadastroDirigentesProps) {
  const [form, setForm] = useState<FormDirigente | null>(null)
  const [erro, setErro] = useState('')
  const [excluindo, setExcluindo] = useState<Dirigente | null>(null)

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

  function abrir(novo: Dirigente | null = null) {
    setErro('')
    setForm(
      novo
        ? {
            ...novo,
            dias: [...(novo.dias ?? [])],
            horarios: [...(novo.horarios ?? [])],
            diasAjudante: [...(novo.diasAjudante ?? [])],
          }
        : formularioVazio(frequenciaPadrao),
    )
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

  function salvar() {
    if (!form?.nome.trim()) {
      setErro('Informe o nome do dirigente.')
      return
    }

    const registro: Dirigente = {
      ...form,
      nome: form.nome.trim(),
      telefone: form.telefone.trim(),
      id: form.id ?? novoId(),
      dias: [...form.dias].sort((a, b) => a - b),
      horarios: form.horarios,
      ajudante: form.ajudante === true,
      diasAjudante:
        form.ajudante === true ? [...(form.diasAjudante ?? [])].sort((a, b) => a - b) : undefined,
    }

    const existe = dirigentes.some((d) => d.id === registro.id)
    aoAlterar(
      existe
        ? dirigentes.map((d) => (d.id === registro.id ? registro : d))
        : [...dirigentes, registro],
    )
    fechar()
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
            <h2 className="text-lg font-semibold text-ink">Quadro de pessoas</h2>
            <p className="text-sm text-muted">{dirigentes.length} cadastrados</p>
          </div>

            <div className="flex flex-col gap-2">
              {dirigentes.map((d) => {
                  const inativo = d.ativo === false
                  const n = contagem[d.id] ?? 0
                  const diasTexto = (d.dias ?? []).map((idx) => infoDia(idx).curto).join(' · ')
                  const nota = inativo
                    ? 'Fora da escala'
                    : (d.horarios ?? []).length
                      ? (d.horarios ?? []).join(' · ')
                      : 'Sem horário'

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
                                {rotuloFrequencia(d.frequencia)}
                              </span>
                              {!inativo && diasTexto ? (
                                <>
                                  <span className="size-1 shrink-0 rounded-full bg-muted" aria-hidden="true" />
                                  <span className="truncate text-muted">{diasTexto}</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                              inativo ? 'bg-line text-ink-soft' : 'bg-success-bg text-success'
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${inativo ? 'bg-muted' : 'bg-success'}`}
                              aria-hidden="true"
                            />
                            {inativo ? 'Inativo' : 'Disponível'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-canvas/70 px-3 py-2 text-[13px]">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <CalendarDays
                            className={`size-[18px] shrink-0 ${inativo ? 'text-muted' : 'text-teal'}`}
                            aria-hidden="true"
                          />
                          <span className="truncate">
                            <span className="font-semibold text-ink">
                              {n} designação{n === 1 ? '' : 's'}
                            </span>{' '}
                            <span className="text-muted">em {resumoMes}</span>
                          </span>
                        </span>
                        <span
                          className={`shrink-0 text-right ${
                            !inativo && !(d.horarios ?? []).length
                              ? 'font-medium text-crimson'
                              : 'text-muted'
                          }`}
                        >
                          {nota}
                        </span>
                      </div>

                      {aptidoes !== null || participantesTpl !== null ? (
                        <div
                          className="mt-3 border-t border-line-soft pt-3"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          {participantesTpl !== null && aoAlternarTpl ? (
                            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-canvas/70 px-3 py-2">
                              <span className="text-[13px] font-semibold text-ink">
                                Participa do TPL
                              </span>
                              <input
                                type="checkbox"
                                checked={participantesTpl.some((p) => p.id === d.id && p.ativo)}
                                onChange={() => aoAlternarTpl(d)}
                                className="size-4 shrink-0 accent-teal"
                                aria-label={`Participa do TPL: ${d.nome}`}
                              />
                            </label>
                          ) : null}

                          {aptidoes !== null && aoAlternarAptidao ? (
                            <div className={participantesTpl !== null ? 'mt-2.5' : ''}>
                              <p className="mb-1.5 text-[12px] font-semibold text-muted">
                                  Designações AVI
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {FUNCOES_AVI.map((f) => (
                                  <Chip
                                    key={f.id}
                                    ativo={(aptidoes[d.id] ?? []).includes(f.id)}
                                    onClick={() => aoAlternarAptidao(d.id, f.id)}
                                  >
                                    {f.rotulo}
                                  </Chip>
                                ))}
                              </div>
                            </div>
                          ) : null}
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
          titulo="Nenhuma pessoa cadastrada. Comece pela ficha: nome, frequência e dias em que a pessoa pode sair ao campo."
          acao={
            <Botao variante="primario" onClick={() => abrir()}>
              <UserPlus className="size-4" aria-hidden="true" />
              Cadastrar primeira pessoa
            </Botao>
          }
        />
      )}

      <Modal
        aberto={form !== null}
        aoFechar={fechar}
        titulo={form?.id ? 'Editar pessoa' : 'Nova pessoa'}
        descricao="Ficha alimenta o rodízio do Campo e os setores."
        largura="max-w-lg"
      >
        {form ? (
          <div className="space-y-4 px-5 py-4">
            <div>
              <Rotulo htmlFor="dir-nome">Nome da pessoa</Rotulo>
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

            <div>
              <Rotulo htmlFor="dir-tel">Telefone (opcional)</Rotulo>
              <Input
                id="dir-tel"
                type="tel"
                inputMode="tel"
                value={form.telefone}
                onChange={(e) => alternar('telefone', e.target.value)}
                placeholder="Ex.: (11) 99999-0000"
                autoComplete="tel"
                enterKeyHint="next"
              />
            </div>

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
              <span className="text-sm font-semibold text-ink">Marcar como ajudante</span>
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

            {erro ? (
              <p role="alert" className="text-sm font-semibold text-crimson">
                {erro}
              </p>
            ) : null}

            {!form.dias.length || !form.horarios.length ? (
              <p className="rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] text-ink">
                Sem dias ou horários marcados este dirigente fica fora do rodízio automático.
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
                Salvar dirigente
              </Botao>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        aberto={excluindo !== null}
        aoFechar={() => setExcluindo(null)}
        titulo="Excluir ficha"
        descricao={
          excluindo
            ? `${excluindo.nome} sai da equipe e não aparece mais na escala.`
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

      {campos.length ? null : (
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
      )}

      <button
        type="button"
        onClick={() => abrir()}
        aria-label="Novo dirigente"
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-teal pl-4 pr-5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(13,92,104,0.35)] transition-all hover:bg-teal-deep active:scale-95"
      >
        <UserPlus className="size-5" aria-hidden="true" />
        Nova pessoa
      </button>
    </div>
  )
}
