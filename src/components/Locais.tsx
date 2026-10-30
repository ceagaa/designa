import type { Campo, Dirigente } from '../lib/dominio'
import { useState } from 'react'
import { Check, MapPin, Plus, Trash } from 'lucide-react'
import { DIAS_SEMANA, HORARIOS_PADRAO, infoDia } from '../lib/constants'
import { Botao, Input, Kicker, Modal, Rotulo, Select, Vazio } from './ui'

type FormCampo = Partial<Campo> & {
  diaSemana: number
  horario: string
  local: string
  fixo: string | null
  ajudanteFixo: string | null
}

function novoId(): string {
  return `campo-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

function vazio(): FormCampo {
  return { diaSemana: 3, horario: '19:30', local: '', fixo: null, ajudanteFixo: null }
}

interface LocaisProps {
  campos: Campo[]
  dirigentes: Dirigente[]
  aoAlterarCampos: (lista: Campo[]) => void
}

/** Página "Locais": cadastro de dias, horários e pontos de encontro. */
export default function Locais({ campos, dirigentes, aoAlterarCampos }: LocaisProps) {
  const [form, setForm] = useState<FormCampo | null>(null)
  const [erro, setErro] = useState('')
  const [excluindo, setExcluindo] = useState<Campo | null>(null)

  const horarios = [...new Set([...HORARIOS_PADRAO, ...campos.map((c) => c.horario)])].sort()
  const ativos = dirigentes.filter((d) => d.ativo !== false && d.nome)

  function abrir(novo: FormCampo) {
    setErro('')
    setForm(novo)
  }

  function fechar() {
    setForm(null)
    setErro('')
  }

  function salvar() {
    if (!form?.local.trim()) {
      setErro('Informe o ponto de encontro.')
      return
    }

    const registro: Campo = {
      ...form,
      local: form.local.trim(),
      diaSemana: Number(form.diaSemana),
      fixo: form.fixo || null,
      ajudanteFixo: form.ajudanteFixo || null,
      id: form.id ?? novoId(),
    }

    const existe = campos.some((c) => c.id === registro.id)
    aoAlterarCampos(
      existe ? campos.map((c) => (c.id === registro.id ? registro : c)) : [...campos, registro],
    )
    fechar()
  }

  function remover(id: string) {
    aoAlterarCampos(campos.filter((x) => x.id !== id))
    fechar()
  }

  function pedirExclusao() {
    if (!form?.id) return
    const alvo = campos.find((c) => c.id === form.id)
    setForm(null)
    setErro('')
    if (alvo) setExcluindo(alvo)
  }

  function abrirCampo(c: Campo) {
    abrir({
      ...c,
      diaSemana: Number(c.diaSemana),
      fixo: c.fixo ?? null,
      ajudanteFixo: c.ajudanteFixo ?? null,
    })
  }

  const ordenados = [...campos].sort((a, b) => {
    if (a.diaSemana !== b.diaSemana) return a.diaSemana - b.diaSemana
    return String(a.horario).localeCompare(String(b.horario))
  })

  return (
    <div className="space-y-6">
      <section className="space-y-3 pt-1">
        <div className="flex items-end justify-between gap-3 px-1">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold tracking-tight text-ink">Locais e horários</h1>
            <p className="mt-0.5 text-sm text-muted">
              {campos.length
                ? `${campos.length} ${campos.length === 1 ? 'dia ativo' : 'dias ativos'} na programação`
                : 'Cadastre os dias em que a equipe sai ao campo'}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {ordenados.map((c) => {
            const fixo = ativos.find((d) => d.id === c.fixo)
            const ajuda = ativos.find((d) => d.id === c.ajudanteFixo)
            return (
              <article
                key={c.id}
                role="button"
                tabIndex={0}
                aria-label={`Editar ${c.local}, ${infoDia(c.diaSemana).nome}`}
                onClick={() => abrirCampo(c)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    abrirCampo(c)
                  }
                }}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-card p-4 text-left shadow-sm transition-all hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-tint text-teal">
                    <MapPin className="size-5" aria-hidden="true" />
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-ink">{c.local}</span>
                    <span className="mt-0.5 text-[13px] text-ink-soft">
                      {infoDia(c.diaSemana).nome} ({c.horario})
                    </span>
                    {fixo ? (
                      <span className="mt-0.5 text-[13px] font-semibold text-teal">
                        Fixo: {fixo.nome}
                      </span>
                    ) : null}
                    {ajuda ? (
                      <span className="mt-0.5 text-[13px] font-semibold text-teal">
                        Ajuda: {ajuda.nome}
                      </span>
                    ) : null}
                  </div>
                </div>
              </article>
            )
          })}

          <button
            type="button"
            onClick={() => abrir(vazio())}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-tint px-4 py-3.5 text-sm font-semibold text-teal shadow-sm transition-colors active:bg-canvas"
          >
            <Plus className="size-5" aria-hidden="true" />
            Adicionar ponto de encontro
          </button>
        </div>

        {!ordenados.length ? (
          <Vazio
            icone={MapPin}
            titulo="Nenhum dia de campo configurado. Cadastre ao menos um dia da semana com horário e ponto de encontro."
            acao={
              <Botao variante="primario" onClick={() => abrir(vazio())}>
                <Plus className="size-4" aria-hidden="true" />
                Cadastrar dia de campo
              </Botao>
            }
          />
        ) : null}

        <Kicker className="block px-1 pt-2 text-muted">Como funciona</Kicker>
        <p className="px-1 text-[13px] text-muted">
          Cada linha daqui vira uma data na escala do mês. Com a designação fixa ligada em
          Configurações, o voluntário de “Quem dirige” sai em todas as datas deste dia e o de
          “Quem ajuda” acompanha como ajudante — deixando em branco, o dia sai sem ajudante. Sem
          a designação fixa, voluntário e ajudante continuam em rodízio.
        </p>
      </section>

      <Modal
        aberto={form !== null}
        aoFechar={fechar}
        titulo={form?.id ? 'Editar dia de campo' : 'Novo dia de campo'}
        descricao="Define uma linha da programação."
        largura="max-w-lg"
      >
        {form ? (
          <div className="space-y-4 px-5 py-4">
            <div>
              <Rotulo htmlFor="campo-dia">Dia da semana</Rotulo>
              <Select
                id="campo-dia"
                value={form.diaSemana}
                onChange={(e) => setForm({ ...form, diaSemana: Number(e.target.value) })}
              >
                {DIAS_SEMANA.map((d) => (
                  <option key={d.idx} value={d.idx}>
                    {d.nome}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Rotulo htmlFor="campo-hora">Horário</Rotulo>
              <Input
                id="campo-hora"
                type="time"
                value={form.horario}
                onChange={(e) => setForm({ ...form, horario: e.target.value })}
                list="horarios-campo"
                enterKeyHint="next"
              />
              <datalist id="horarios-campo">
                {horarios.map((h) => (
                  <option key={h} value={h} />
                ))}
              </datalist>
            </div>

            <div>
              <Rotulo htmlFor="campo-local">Ponto de encontro</Rotulo>
              <Input
                id="campo-local"
                value={form.local}
                onChange={(e) => setForm({ ...form, local: e.target.value })}
                placeholder="Ex.: Terminal Rodoviário"
                autoCapitalize="words"
                enterKeyHint="done"
              />
            </div>

            <div>
              <Rotulo htmlFor="campo-fixo">Quem dirige</Rotulo>
              <Select
                id="campo-fixo"
                value={form.fixo ?? ''}
                onChange={(e) => setForm({ ...form, fixo: e.target.value || null })}
              >
                <option value="">Rodízio automático</option>
                {ativos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </Select>
              <p className="mt-1.5 text-[13px] text-muted">
                Com a designação fixa ligada, este voluntário sai em todas as datas deste dia.
              </p>
            </div>

            <div>
              <Rotulo htmlFor="campo-ajudante">Quem ajuda</Rotulo>
              <Select
                id="campo-ajudante"
                value={form.ajudanteFixo ?? ''}
                onChange={(e) => setForm({ ...form, ajudanteFixo: e.target.value || null })}
              >
                <option value="">Sem ajudante</option>
                {ativos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nome}
                  </option>
                ))}
              </Select>
              <p className="mt-1.5 text-[13px] text-muted">
                Com a designação fixa ligada, este voluntário ajuda em todas as datas deste dia;
                em branco, o dia sai sem ajudante.
              </p>
            </div>

            {erro ? (
              <p role="alert" className="text-sm font-semibold text-crimson">
                {erro}
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
                Salvar dia de campo
              </Botao>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        aberto={excluindo !== null}
        aoFechar={() => setExcluindo(null)}
        titulo="Excluir dia de campo"
        descricao={
          excluindo
            ? `${excluindo.local} sai da programação e não aparece mais na escala.`
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
    </div>
  )
}
