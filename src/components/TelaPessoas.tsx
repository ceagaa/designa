import type {
  AptidaoId,
  Campo,
  Dirigente,
  DadosAvi,
  DadosTpl,
  ParticipanteTpl,
  Usuario,
} from '../lib/dominio'
import { useEffect, useState } from 'react'
import { aptidoesDe, normalizarDadosAvi } from '../lib/avi'
import { normalizarDadosTpl } from '../lib/tpl'
import { carregarSetorExtenso, salvarDadosSetor } from '../lib/authApi'
import { Kicker } from './ui'
import CadastroDirigentes from './CadastroDirigentes'

interface TelaPessoasProps {
  usuario: Usuario
  dirigentes: Dirigente[]
  campos: Campo[]
  frequenciaPadrao: string
  ano: number
  mes: number
  efetivas: Record<string, string>
  aoAlterar: (lista: Dirigente[]) => void
  aoConfigurar: () => void
  aoAvisar: (texto: string) => void
}

function usadosNaEscalaTpl(dados: DadosTpl, id: string): boolean {
  for (const reg of Object.values(dados.escalas ?? {})) {
    if (!reg) continue
    const valores = [...Object.values(reg.auto ?? {}), ...Object.values(reg.manuais ?? {})]
    for (const lista of valores) {
      if (Array.isArray(lista) && lista.includes(id)) return true
    }
  }
  return false
}

export default function TelaPessoas({
  usuario,
  dirigentes,
  campos,
  frequenciaPadrao,
  ano,
  mes,
  efetivas,
  aoAlterar,
  aoConfigurar,
  aoAvisar,
}: TelaPessoasProps) {
  const ehAdmin = usuario.papel === 'ADMIN'
  const [avi, setAvi] = useState<DadosAvi | null>(null)
  const [tpl, setTpl] = useState<DadosTpl | null>(null)
  const [carregando, setCarregando] = useState(ehAdmin)
  const [carregado, setCarregado] = useState(!ehAdmin)

  useEffect(() => {
    if (!ehAdmin || carregado) return
    let vivo = true
    Promise.allSettled([carregarSetorExtenso('AUDIO_VIDEO'), carregarSetorExtenso('TPL')]).then(
      ([resultadoAvi, resultadoTpl]) => {
        if (!vivo) return
        if (resultadoAvi.status === 'fulfilled') {
          setAvi(normalizarDadosAvi(resultadoAvi.value.dados))
        } else {
          aoAvisar('Não foi possível carregar as designações do AVI agora.')
        }
        if (resultadoTpl.status === 'fulfilled') {
          setTpl(normalizarDadosTpl(resultadoTpl.value.dados))
        } else {
          aoAvisar('Não foi possível carregar os participantes do TPL agora.')
        }
        setCarregado(true)
        setCarregando(false)
      },
    )
    return () => {
      vivo = false
    }
  }, [ehAdmin, carregado, aoAvisar])

  async function persistirAvi(novo: DadosAvi, anterior: DadosAvi) {
    try {
      await salvarDadosSetor('AUDIO_VIDEO', novo as unknown as Record<string, unknown>)
      setAvi(novo)
    } catch {
      setAvi(anterior)
      aoAvisar('Não foi possível salvar a designação agora.')
    }
  }

  async function persistirTpl(novo: DadosTpl, anterior: DadosTpl) {
    try {
      await salvarDadosSetor('TPL', novo as unknown as Record<string, unknown>)
      setTpl(novo)
    } catch {
      setTpl(anterior)
      aoAvisar('Não foi possível salvar o participante do TPL agora.')
    }
  }

  async function alternarAptidao(idIrmao: string, aptidao: AptidaoId) {
    if (!avi) return
    const atual = aptidoesDe(avi, idIrmao)
    const nova = atual.includes(aptidao)
      ? atual.filter((a) => a !== aptidao)
      : [...atual, aptidao]
    const novo: DadosAvi = { ...avi, aptidoes: { ...avi.aptidoes, [idIrmao]: nova } }
    await persistirAvi(novo, avi)
  }

  async function alternarTpl(d: Dirigente) {
    if (!tpl) return
    const existente = tpl.participantes.find((p) => p.id === d.id)
    let novos: ParticipanteTpl[]
    if (!existente) {
      novos = [...tpl.participantes, { id: d.id, nome: d.nome, telefone: d.telefone, ativo: true }]
    } else if (existente.ativo) {
      if (usadosNaEscalaTpl(tpl, d.id)) {
        novos = tpl.participantes.map((p) => (p.id === d.id ? { ...p, ativo: false } : p))
        aoAvisar(`${d.nome} já está na escala do TPL: ficará inativo em vez de sair da lista.`)
      } else {
        novos = tpl.participantes.filter((p) => p.id !== d.id)
      }
    } else {
      novos = tpl.participantes.map((p) => (p.id === d.id ? { ...p, ativo: true } : p))
    }
    await persistirTpl({ ...tpl, participantes: novos }, tpl)
  }

  async function alternarParticipanteSolo(id: string) {
    if (!tpl) return
    const novos = tpl.participantes.map((p) => (p.id === id ? { ...p, ativo: !p.ativo } : p))
    await persistirTpl({ ...tpl, participantes: novos }, tpl)
  }

  function aoAlterarPessoas(lista: Dirigente[]) {
    const removidos = dirigentes.filter((d) => !lista.some((x) => x.id === d.id))
    aoAlterar(lista)
    if (!removidos.length) return

    if (avi) {
      const alvos = removidos.filter((d) => (avi.aptidoes[d.id] ?? []).length)
      if (alvos.length) {
        const aptidoes = { ...avi.aptidoes }
        for (const d of alvos) delete aptidoes[d.id]
        const novo = { ...avi, aptidoes }
        setAvi(novo)
        salvarDadosSetor('AUDIO_VIDEO', novo as unknown as Record<string, unknown>).catch(() => {
          setAvi(avi)
          aoAvisar('A pessoa saiu, mas as designações do AVI não puderam ser atualizadas.')
        })
      }
    }

    if (tpl) {
      const tocar = removidos.filter((d) => tpl.participantes.some((p) => p.id === d.id))
      if (tocar.length) {
        const participantes = tpl.participantes.flatMap((p) => {
          const alvo = tocar.find((d) => d.id === p.id)
          if (!alvo) return [p]
          return usadosNaEscalaTpl(tpl, p.id) ? [{ ...p, ativo: false }] : []
        })
        const novo = { ...tpl, participantes }
        setTpl(novo)
        salvarDadosSetor('TPL', novo as unknown as Record<string, unknown>).catch(() => {
          setTpl(tpl)
          aoAvisar('A pessoa saiu, mas a lista do TPL não pôde ser atualizada.')
        })
      }
    }
  }

  const participantesSemFicha = (tpl?.participantes ?? []).filter(
    (p) => !dirigentes.some((d) => d.id === p.id),
  )

  return (
    <div className="space-y-6">
      <CadastroDirigentes
        dirigentes={dirigentes}
        campos={campos}
        frequenciaPadrao={frequenciaPadrao}
        ano={ano}
        mes={mes}
        efetivas={efetivas}
        aoAlterar={aoAlterarPessoas}
        aptidoes={avi ? Object.fromEntries(dirigentes.map((d) => [d.id, aptidoesDe(avi, d.id)])) : null}
        aoAlternarAptidao={ehAdmin ? alternarAptidao : undefined}
        participantesTpl={tpl ? tpl.participantes : null}
        aoAlternarTpl={ehAdmin ? alternarTpl : undefined}
        aoConfigurar={aoConfigurar}
      />

      {carregando ? (
        <p className="rounded-xl bg-canvas px-3 py-2 text-center text-[13px] text-muted">
          Carregando os setores (AVI e TPL)…
        </p>
      ) : null}

      {participantesSemFicha.length ? (
        <section className="space-y-3 rounded-2xl bg-card p-4 shadow-sm">
          <div>
            <Kicker>Testemunho Público Local</Kicker>
            <h2 className="mt-1 text-lg font-semibold text-ink">
              Participantes sem ficha do Campo
            </h2>
            <p className="mt-1 text-[13px] text-muted">
              Somente aqui e no TPL — não entram na escala do Campo nem do AVI. Para editar nome e
              telefone, abra a tela TPL.
            </p>
          </div>
          <ul className="space-y-2">
            {participantesSemFicha.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-canvas/70 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{p.nome}</p>
                  {p.telefone ? (
                    <p className="truncate text-[13px] text-muted">{p.telefone}</p>
                  ) : null}
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink-soft">Ativo</span>
                  <input
                    id={`tpl-solo-${p.id}`}
                    type="checkbox"
                    checked={p.ativo !== false}
                    onChange={() => alternarParticipanteSolo(p.id)}
                    className="size-4 accent-teal"
                  />
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
