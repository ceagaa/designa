import type { DadosTpl, PeriodoTpl, RegistroTpl } from './dominio'
import { MINIMO_DUPLA } from './dominio'
import { chaveMes } from './datas'

/** Título do cartão TPL. */
export const TITULO_TPL = 'Testemunho Público Local'

/** Slot de um período em uma data (chave única dentro do mês). */
export function slotTpl(iso: string, periodoId: string): string {
  return `${iso}_${periodoId}`
}

/** Turno pronto do TPL: o administrador escolhe Manhã, Tarde ou Noite. */
export interface TurnoTpl {
  id: 'manha' | 'tarde' | 'noite'
  rotulo: string
  inicio: string
  fim: string
}

export const TURNOS_TPL: TurnoTpl[] = [
  { id: 'manha', rotulo: 'Manhã', inicio: '08:00', fim: '11:00' },
  { id: 'tarde', rotulo: 'Tarde', inicio: '13:00', fim: '17:00' },
  { id: 'noite', rotulo: 'Noite', inicio: '18:00', fim: '21:00' },
]

/** Turno pronto correspondente ao período (null quando é horário específico). */
export function turnoProntoDe(periodo: Pick<PeriodoTpl, 'inicio' | 'fim'>): TurnoTpl | null {
  return TURNOS_TPL.find((t) => t.inicio === periodo.inicio && t.fim === periodo.fim) ?? null
}

/** Turno legível: nome quando usa um turno pronto (ex.: "Manhã"), senão o horário. */
export function turnoTexto(periodo: PeriodoTpl): string {
  const pronto = turnoProntoDe(periodo)
  return pronto ? pronto.rotulo : `${periodo.inicio} – ${periodo.fim}`
}

/** Rótulo do dia (ex.: "Domingo"). */
export const DIAS_TPL = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const

export function diaTexto(diaSemana: number): string {
  return DIAS_TPL[diaSemana] ?? 'Dia'
}

/** Ocorrências do mês: cada data em que um período cai (dia da semana bate). */
export interface OcorrenciaTpl {
  key: string
  iso: string
  dia: number
  diaSemana: number
  periodo: PeriodoTpl
}

export function ocorrenciasTpl(ano: number, mes: number, periodos: PeriodoTpl[]): OcorrenciaTpl[] {
  const totalDias = new Date(ano, mes + 1, 0).getDate()
  const ativos = periodos.filter((p) => p && p.pontoId && Number.isInteger(Number(p.diaSemana)))
  const lista: OcorrenciaTpl[] = []

  for (let dia = 1; dia <= totalDias; dia += 1) {
    const data = new Date(ano, mes, dia)
    const diaSemana = data.getDay()
    const doDia = ativos.filter((p) => Number(p.diaSemana) === diaSemana)
    if (!doDia.length) continue
    const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    for (const periodo of doDia) {
      lista.push({ key: slotTpl(iso, periodo.id), iso, dia, diaSemana, periodo })
    }
  }

  return lista.sort(
    (a, b) =>
      a.iso.localeCompare(b.iso) ||
      a.periodo.inicio.localeCompare(b.periodo.inicio) ||
      a.periodo.id.localeCompare(b.periodo.id),
  )
}

function normalizarRegistro(bruto: unknown): RegistroTpl {
  if (!bruto || typeof bruto !== 'object') return { auto: {}, manuais: {} }
  const reg = bruto as RegistroTpl
  const mapa = (valor: unknown): Record<string, string[]> => {
    if (!valor || typeof valor !== 'object') return {}
    const saida: Record<string, string[]> = {}
    for (const [chave, lista] of Object.entries(valor as Record<string, unknown>)) {
      if (Array.isArray(lista)) saida[chave] = lista.filter((x) => typeof x === 'string')
    }
    return saida
  }
  return { auto: mapa(reg.auto), manuais: mapa(reg.manuais), geradoEm: reg.geradoEm }
}

export function normalizarDadosTpl(bruto: unknown): DadosTpl {
  const base: DadosTpl = {
    versao: 1,
    pontos: [],
    locais: [],
    periodos: [],
    participantes: [],
    escalas: {},
  }
  if (!bruto || typeof bruto !== 'object') return base
  const dados = bruto as Partial<DadosTpl>

  const pontos = Array.isArray(dados.pontos)
    ? dados.pontos
        .filter((p) => p && typeof p.id === 'string' && typeof p.nome === 'string')
        .map((p) => ({ id: p.id, nome: p.nome }))
    : []

  const pontosIds = new Set(pontos.map((p) => p.id))
  const locais = Array.isArray(dados.locais)
    ? dados.locais
        .filter((local) => local && typeof local.id === 'string' && typeof local.nome === 'string')
        .map((local) => ({ id: local.id, nome: local.nome }))
    : []
  const locaisIds = new Set(locais.map((local) => local.id))
  const periodos = Array.isArray(dados.periodos)
    ? dados.periodos
        .filter(
          (p) =>
            p &&
            typeof p.id === 'string' &&
            pontosIds.has(p.pontoId) &&
            Number.isInteger(Number(p.diaSemana)) &&
            typeof p.inicio === 'string' &&
            typeof p.fim === 'string',
        )
        .map((p) => ({
          id: p.id,
          pontoId: p.pontoId,
          localId:
            typeof p.localId === 'string' && locaisIds.has(p.localId) ? p.localId : '',
          diaSemana: Number(p.diaSemana),
          inicio: p.inicio,
          fim: p.fim,
        }))
    : []

  const participantes = Array.isArray(dados.participantes)
    ? dados.participantes
        .filter((p) => p && typeof p.id === 'string' && typeof p.nome === 'string')
        .map((p) => ({
          id: p.id,
          nome: p.nome,
          telefone: typeof p.telefone === 'string' ? p.telefone : '',
          ativo: p.ativo !== false,
        }))
    : []

  const escalas: Record<string, RegistroTpl> = {}
  if (dados.escalas && typeof dados.escalas === 'object') {
    for (const [chave, reg] of Object.entries(dados.escalas)) {
      escalas[chave] = normalizarRegistro(reg)
    }
  }

  return { versao: 1, pontos, locais, periodos, participantes, escalas }
}

export function registroTplDe(dados: DadosTpl, chave: string): RegistroTpl {
  return normalizarRegistro(dados.escalas[chave])
}

/**
 * Meses que fazem sentido mostrar na escala pública do TPL: o mês atual, o
 * seguinte e qualquer mês que já tenha designações salvas.
 */
export function mesesTpl(dados: DadosTpl): string[] {
  const agora = new Date()
  const atual = chaveMes(agora.getFullYear(), agora.getMonth())
  const proximo = chaveMes(
    agora.getMonth() === 11 ? agora.getFullYear() + 1 : agora.getFullYear(),
    agora.getMonth() === 11 ? 0 : agora.getMonth() + 1,
  )
  const comDesignacoes = Object.entries(dados.escalas)
    .filter(([, registro]) => {
      const reg = normalizarRegistro(registro)
      return Boolean(reg.geradoEm) ||
        Object.keys(reg.auto ?? {}).length > 0 ||
        Object.keys(reg.manuais ?? {}).length > 0
    })
    .map(([chave]) => chave)
  return [...new Set([atual, proximo, ...comDesignacoes])].sort()
}

export interface DuplaEfetiva {
  ids: string[]
  /** Veio do ajuste manual (vence a sugestão automática). */
  manual: boolean
}

/** Duplas efetivas do mês (automáticas + manuais vencem). */
export function efetivasTpl(registro: RegistroTpl): Record<string, DuplaEfetiva> {
  const saida: Record<string, DuplaEfetiva> = {}
  for (const [chave, ids] of Object.entries(registro.auto ?? {})) {
    saida[chave] = { ids, manual: false }
  }
  for (const [chave, ids] of Object.entries(registro.manuais ?? {})) {
    saida[chave] = { ids, manual: true }
  }
  return saida
}

/** Remove telefone e qualquer dado que não deva ir à rota pública do TPL. */
export function sanitizarParaPublico(dados: DadosTpl): DadosTpl {
  return {
    ...dados,
    participantes: dados.participantes.map((p) => ({ id: p.id, nome: p.nome, ativo: p.ativo })),
  }
}

/** Linha pronta do cartão TPL (data, ponto, turno e dupla por nome). */
export interface LinhaTpl {
  iso: string
  dia: number
  diaSemana: number
  ponto: string
  local: string
  turno: string
  dupla: string[]
  incompleta: boolean
}

export interface FiltroTpl {
  iso?: string
  pontoId?: string
}

/**
 * Linhas do mês (ou do recorte do filtro) para o cartão de impressão.
 * Devolve [] quando não há duplas atribuídas no mês.
 */
export function linhasTplPara(
  dados: DadosTpl,
  ano: number,
  mes: number,
  filtro?: FiltroTpl,
): LinhaTpl[] {
  const chave = chaveMes(ano, mes)
  const registro = registroTplDe(dados, chave)
  const efetivas = efetivasTpl(registro)
  const porPonto = new Map(dados.pontos.map((p) => [p.id, p.nome]))
  const porLocal = new Map(dados.locais.map((local) => [local.id, local.nome]))
  const porParticipante = new Map(dados.participantes.map((p) => [p.id, p.nome]))

  const linhas: LinhaTpl[] = []
  for (const oc of ocorrenciasTpl(ano, mes, dados.periodos)) {
    if (filtro?.iso && oc.iso !== filtro.iso) continue
    if (filtro?.pontoId && oc.periodo.pontoId !== filtro.pontoId) continue
    const efetiva = efetivas[oc.key]
    const ids = efetiva?.ids ?? []
    const dupla = ids.map((id) => porParticipante.get(id) ?? '').filter(Boolean)
    linhas.push({
      iso: oc.iso,
      dia: oc.dia,
      diaSemana: oc.diaSemana,
      ponto: porPonto.get(oc.periodo.pontoId) ?? 'Ponto',
      local: porLocal.get(oc.periodo.localId ?? '') ?? '',
      turno: turnoTexto(oc.periodo),
      dupla,
      incompleta: ids.length < MINIMO_DUPLA || dupla.length !== ids.length,
    })
  }
  return linhas
}
