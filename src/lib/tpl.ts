import type { DadosTpl, PeriodoTpl, RegistroTpl } from './dominio'
import { MINIMO_DUPLA } from './dominio'
import { chaveMes, lerChaveMes } from './datas'

/** Título do cartão TPL. */
export const TITULO_TPL = 'Testemunho Público Local'

/** Slot de um período em uma data (chave única dentro do mês). */
export function slotTpl(iso: string, periodoId: string): string {
  return `${iso}_${periodoId}`
}

/** Turno legível (ex.: "08:00 – 10:00"). */
export function turnoTexto(periodo: PeriodoTpl): string {
  return `${periodo.inicio} – ${periodo.fim}`
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

function hash(texto: string): number {
  let h = 5381
  for (let i = 0; i < texto.length; i += 1) {
    h = ((h << 5) + h + texto.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export interface EntradaGerarTpl {
  participantes: Array<{ id: string; nome: string; ativo: boolean }>
  ocorrencias: OcorrenciaTpl[]
  manuais?: Record<string, string[]>
  semente?: string
}

export interface ResultadoTpl {
  auto: Record<string, string[]>
  designacoes: Record<string, string[]>
}

/**
 * Rodízio do TPL — mesma inteligência do Campo: ativos primeiro, menor carga
 * no mês, quem espera há mais tempo e semente determinística. Regras do módulo:
 * dupla com no mínimo 2 participantes e ninguém repetindo na mesma data.
 * Ajustes manuais nunca são sobrescritos.
 */
export function gerarEscalaTpl({
  participantes,
  ocorrencias,
  manuais = {},
  semente = '',
}: EntradaGerarTpl): ResultadoTpl {
  const ativos = participantes.filter((p) => p && p.nome && p.ativo !== false)
  const porId = new Map(ativos.map((p) => [p.id, p]))

  const total = new Map<string, number>()
  const ultimoTs = new Map<string, number>()

  function contar(id: string, iso: string): void {
    total.set(id, (total.get(id) ?? 0) + 1)
    const ts = Date.parse(`${iso}T12:00:00Z`)
    if (ts > (ultimoTs.get(id) ?? 0)) ultimoTs.set(id, ts)
  }

  function ordenarPorCarga(candidatos: string[], chave: string): string[] {
    return [...candidatos].sort((a, b) => {
      const placarA = [total.get(a) ?? 0, ultimoTs.get(a) ?? 0, hash(`${semente}|${chave}|${a}`)]
      const placarB = [total.get(b) ?? 0, ultimoTs.get(b) ?? 0, hash(`${semente}|${chave}|${b}`)]
      for (let i = 0; i < placarA.length; i += 1) {
        if (placarA[i] !== placarB[i]) return placarA[i] - placarB[i]
      }
      return 0
    })
  }

  /** Monta a dupla do slot: 2+ pessoas distintas, sem repetição na data. */
  function montarDupla(chave: string, usadosNaData: Set<string>): string[] {
    const livres = ativos.filter((p) => !usadosNaData.has(p.id)).map((p) => p.id)
    const escolhidos = ordenarPorCarga(livres, chave).slice(0, MINIMO_DUPLA)
    for (const id of escolhidos) usadosNaData.add(id)
    return escolhidos
  }

  const auto: Record<string, string[]> = {}
  const designacoes: Record<string, string[]> = {}

  // Ajustes manuais primeiro: contam carga e bloqueiam a pessoa na data.
  const porData = new Map<string, Set<string>>()
  function bloqueiosDaData(iso: string): Set<string> {
    let conjunto = porData.get(iso)
    if (!conjunto) {
      conjunto = new Set<string>()
      porData.set(iso, conjunto)
    }
    return conjunto
  }

  for (const [chave, ids] of Object.entries(manuais)) {
    const iso = chave.slice(0, 10)
    const validos = ids.filter((id) => porId.has(id))
    designacoes[chave] = validos
    for (const id of validos) {
      contar(id, iso)
      bloqueiosDaData(iso).add(id)
    }
  }

  for (const oc of ocorrencias) {
    const chave = oc.key
    const manual = manuais[chave]

    if (manual) {
      // Sugestão em cópia: não bloqueia nem conta — o manual já foi contado.
      const sugerida = montarDupla(chave, new Set(bloqueiosDaData(oc.iso)))
      if (sugerida.length) auto[chave] = sugerida
      continue
    }

    const dupla = montarDupla(chave, bloqueiosDaData(oc.iso))
    if (dupla.length) {
      auto[chave] = dupla
      designacoes[chave] = dupla
      for (const id of dupla) contar(id, oc.iso)
    }
  }

  return { auto, designacoes }
}

/**
 * Gera (ou regenera) a escala do mês na chave. Idempotente sem `forcar`;
 * preserva os ajustes manuais informados.
 */
export function gerarTplDoMes(
  dados: DadosTpl,
  chave: string,
  { forcar = false, manuais }: { forcar?: boolean; manuais?: Record<string, string[]> } = {},
): DadosTpl {
  const registro = registroTplDe(dados, chave)
  if (registro.geradoEm && !forcar) return dados

  const { ano, mes } = lerChaveMes(chave)
  const ocorrencias = ocorrenciasTpl(ano, mes, dados.periodos)
  const mantidos = manuais ?? registro.manuais ?? {}

  const { auto } = gerarEscalaTpl({
    participantes: dados.participantes,
    ocorrencias,
    manuais: mantidos,
    semente: chave,
  })

  const novoRegistro: RegistroTpl = {
    auto,
    manuais: mantidos,
    geradoEm: new Date().toISOString(),
  }

  return { ...dados, escalas: { ...dados.escalas, [chave]: novoRegistro } }
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
