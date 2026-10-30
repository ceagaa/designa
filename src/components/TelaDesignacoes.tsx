import type { Estado, SetorId, Usuario } from '../lib/dominio'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ChevronRight, MapPin, Radio, ShoppingCart } from 'lucide-react'
import { FUNCOES_AVI, MINIMO_DUPLA, ROTULO_SETOR } from '../lib/dominio'
import { chaveMes, nomeMes, ocorrenciasDoMes } from '../lib/datas'
import { registroDe } from '../lib/estadoInicial'
import { efetivasAvi, normalizarDadosAvi, ocorrenciasAvi, registroAviDe, slotAvi } from '../lib/avi'
import { efetivasTpl, normalizarDadosTpl, ocorrenciasTpl, registroTplDe } from '../lib/tpl'
import { ErroAuth, carregarSetorExtenso } from '../lib/authApi'
import { Kicker } from './ui'

type StatusSetor = 'carregando' | 'pronta' | 'pendente' | 'erro'

interface ResumoSetor {
  status: StatusSetor
  nota: string
}

interface CardSetor {
  setor: SetorId
  icone: LucideIcon
  cor: string
}

const CARDS: Record<SetorId, CardSetor> = {
  CAMPO: { setor: 'CAMPO', icone: MapPin, cor: 'bg-teal text-white' },
  AUDIO_VIDEO: { setor: 'AUDIO_VIDEO', icone: Radio, cor: 'bg-petrol text-white' },
  TPL: { setor: 'TPL', icone: ShoppingCart, cor: 'bg-wine text-white' },
}

const ROTULO_STATUS: Record<StatusSetor, string> = {
  carregando: 'Carregando…',
  pronta: 'Escala pronta',
  pendente: 'Pendente',
  erro: 'Sem conexão',
}

function classeStatus(status: StatusSetor): string {
  if (status === 'pronta') return 'bg-success-bg text-success'
  if (status === 'erro') return 'bg-crimson-bg text-crimson'
  if (status === 'carregando') return 'bg-line text-ink-soft'
  return 'bg-[#FFF7E6] text-[#8A6100]'
}

/** Resumo do mês do setor AVI (designações preenchidas das 5 funções). */
function resumoAvi(ano: number, mes: number, bruto: unknown): ResumoSetor {
  const dados = normalizarDadosAvi(bruto)
  const chave = chaveMes(ano, mes)
  const registro = registroAviDe(dados, chave)
  if (!registro.geradoEm) return { status: 'pendente', nota: 'Escala não gerada' }
  const ocorrencias = ocorrenciasAvi(ano, mes, dados.diasReuniao)
  const efetivas = efetivasAvi(registro)
  const total = ocorrencias.length * FUNCOES_AVI.length
  const preenchidos = ocorrencias.reduce(
    (soma, oc) =>
      soma + FUNCOES_AVI.filter((f) => efetivas[slotAvi(oc.iso, f.id)]).length,
    0,
  )
  const nota = `${preenchidos} de ${total} designações`
  return { status: total > 0 && preenchidos === total ? 'pronta' : 'pendente', nota }
}

/** Resumo do mês do setor TPL (duplas completas com no mínimo 2). */
function resumoTpl(ano: number, mes: number, bruto: unknown): ResumoSetor {
  const dados = normalizarDadosTpl(bruto)
  const ocorrencias = ocorrenciasTpl(ano, mes, dados.periodos)
  if (!ocorrencias.length) return { status: 'pendente', nota: 'Sem períodos neste mês' }
  const registro = registroTplDe(dados, chaveMes(ano, mes))
  const efetivas = efetivasTpl(registro)
  const completas = ocorrencias.filter(
    (oc) => (efetivas[oc.key]?.ids.length ?? 0) >= MINIMO_DUPLA,
  ).length
  return {
    status: completas === ocorrencias.length ? 'pronta' : 'pendente',
    nota: `${completas} de ${ocorrencias.length} duplas`,
  }
}

/**
 * Home de Designações: cards grandes dos 3 setores com resumo do mês e status.
 * Ajudante vê apenas o card do seu setor.
 */
export default function TelaDesignacoes({
  usuario,
  estado,
  ano,
  mes,
  aoAbrir,
}: {
  usuario: Usuario
  estado: Estado
  ano: number
  mes: number
  aoAbrir: (tela: 'campo' | 'avi' | 'tpl') => void
}) {
  const setores: SetorId[] =
    usuario.papel === 'ADMIN'
      ? ['CAMPO', 'AUDIO_VIDEO', 'TPL']
      : usuario.setor
        ? [usuario.setor]
        : []
  const chave = chaveMes(ano, mes)
  const [resumos, setResumos] = useState<Record<string, ResumoSetor>>({})

  // Resumo do Campo: calculado no cliente com o estado já carregado.
  const registroCampo = registroDe(estado.escalas, chave)
  const ocorrenciasCampo = ocorrenciasDoMes(
    ano,
    mes,
    estado.config_campos,
    estado.escalas._config,
  ).filter((ocorrencia) => !registroCampo.removidas?.[ocorrencia.key])
  const efetivasCampo = {
    ...(registroCampo.auto ?? {}),
    ...(registroCampo.manuais ?? {}),
  }
  const designadosCampo = ocorrenciasCampo.filter((o) => efetivasCampo[o.key]).length
  const resumoCampo: ResumoSetor = !ocorrenciasCampo.length
    ? { status: 'pendente', nota: 'Sem saídas neste mês' }
    : designadosCampo === ocorrenciasCampo.length
      ? {
          status: 'pronta',
          nota: `${designadosCampo} de ${ocorrenciasCampo.length} dias designados`,
        }
      : {
          status: 'pendente',
          nota: `${designadosCampo} de ${ocorrenciasCampo.length} dias designados`,
        }

  // AVI/TPL: resumo vem da API do setor (projeção mínima do módulo).
  useEffect(() => {
    let vivo = true
    const alvos = setores.filter((s) => s !== 'CAMPO')
    if (!alvos.length) return undefined
    for (const setor of alvos) {
      carregarSetorExtenso(setor)
        .then((resposta) => {
          if (!vivo) return
          const calculado =
            setor === 'AUDIO_VIDEO' ? resumoAvi(ano, mes, resposta.dados) : resumoTpl(ano, mes, resposta.dados)
          setResumos((atual) => ({ ...atual, [setor]: calculado }))
        })
        .catch((falha: unknown) => {
          if (!vivo) return
          const expirada = falha instanceof ErroAuth && (falha.status === 401 || falha.status === 403)
          setResumos((atual) => ({
            ...atual,
            [setor]: { status: 'erro', nota: expirada ? 'Sem permissão' : 'Tente de novo' },
          }))
        })
    }
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega ao mudar mês/usuário
  }, [chave, usuario.id])

  function resumoDe(setor: SetorId): ResumoSetor {
    if (setor === 'CAMPO') return resumoCampo
    return resumos[setor] ?? { status: 'carregando', nota: 'Carregando…' }
  }

  function abrir(setor: SetorId) {
    aoAbrir(setor === 'CAMPO' ? 'campo' : setor === 'AUDIO_VIDEO' ? 'avi' : 'tpl')
  }

  return (
    <div className="space-y-4">
      <div>
        <Kicker className="text-teal">Setores</Kicker>
        <p className="mt-1 text-sm text-muted">
          Escolha um setor para ver a escala de{' '}
          <span className="font-semibold text-ink">
            {nomeMes(mes)} de {ano}
          </span>
          .
        </p>
      </div>

      <ul className="space-y-3">
        {setores.map((setor) => {
          const { icone: Icone, cor } = CARDS[setor]
          const resumo = resumoDe(setor)
          return (
            <li key={setor}>
              <button
                type="button"
                onClick={() => abrir(setor)}
                className="flex w-full items-center gap-4 rounded-2xl bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-teal"
              >
                <span
                  className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${cor}`}
                  aria-hidden="true"
                >
                  <Icone className="size-7" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-bold leading-snug text-ink">
                    {ROTULO_SETOR[setor]}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-bold ${classeStatus(resumo.status)}`}
                    >
                      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                      {ROTULO_STATUS[resumo.status]}
                    </span>
                    <span className="text-[13px] text-muted">{resumo.nota}</span>
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-faint" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
