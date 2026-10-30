import type {
  AptidaoId,
  DadosAvi,
  IrmaoProjecao,
  OcorrenciaAvi,
  RegistroAvi,
} from './dominio'
import { FUNCOES_AVI } from './dominio'
import { lerChaveMes } from './datas'

/** Título oficial da aba AVI (planilha de referência). */
export const TITULO_AVI = 'Audio/Vídeo & Indicadores'

/** Slot de uma função em uma reunião (chave única dentro do mês). */
export function slotAvi(iso: string, funcao: AptidaoId): string {
  return `${iso}_${funcao}`
}

/**
 * Reuniões do mês para o AVI: TODOS os domingos (fim de semana) e todas as
 * reuniões do meio de semana (quarta ou quinta, conforme configuração).
 */
export function ocorrenciasAvi(
  ano: number,
  mes: number,
  diasReuniao: number | number[],
): OcorrenciaAvi[] {
  const totalDias = new Date(ano, mes + 1, 0).getDate()
  const dias = new Set(
    (Array.isArray(diasReuniao) ? diasReuniao : [0, diasReuniao])
      .filter((dia) => Number.isInteger(dia) && dia >= 0 && dia <= 6),
  )
  const lista: OcorrenciaAvi[] = []

  for (let dia = 1; dia <= totalDias; dia += 1) {
    const data = new Date(ano, mes, dia)
    const diaSemana = data.getDay()
    const secao = dias.has(diaSemana) ? (diaSemana === 0 || diaSemana === 6 ? 'fds' : 'meio') : null
    if (!secao) continue
    const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    lista.push({ key: iso, iso, dia, diaSemana, secao })
  }

  return lista
}

export function normalizarDadosAvi(bruto: unknown): DadosAvi {
  const base: DadosAvi = {
    versao: 1,
    diaSemanaMeio: 3,
    diasReuniao: [0, 3],
    geracaoAutomatica: { ativa: false, dia: 20, hora: '00:00' },
    aptidoes: {},
    escalas: {},
  }
  if (!bruto || typeof bruto !== 'object') return base
  const dados = bruto as Partial<DadosAvi>

  const aptidoes: Record<string, AptidaoId[]> = {}
  if (dados.aptidoes && typeof dados.aptidoes === 'object') {
    for (const [id, lista] of Object.entries(dados.aptidoes)) {
      if (!Array.isArray(lista)) continue
      // O antigo "indicador" vira os dois indicadores (interno e externo).
      const validas = lista.flatMap((a): AptidaoId[] => {
        const id = a as string
        if (id === 'indicador') return ['indicador_interno', 'indicador_externo']
        return FUNCOES_AVI.some((f) => f.id === id) ? [id as AptidaoId] : []
      })
      aptidoes[id] = [...new Set(validas)]
    }
  }

  const escalas: Record<string, RegistroAvi> = {}
  if (dados.escalas && typeof dados.escalas === 'object') {
    for (const [chave, reg] of Object.entries(dados.escalas)) {
      if (!reg || typeof reg !== 'object') continue
      const registro = reg as RegistroAvi
      escalas[chave] = {
        auto: registro.auto ?? {},
        manuais: registro.manuais ?? {},
        geradoEm: registro.geradoEm,
      }
    }
  }

  const diaSemanaMeio = dados.diaSemanaMeio === 4 ? 4 : 3
  const diasReuniao = Array.isArray(dados.diasReuniao)
    ? [...new Set(
        dados.diasReuniao.filter(
          (dia): dia is number => Number.isInteger(dia) && dia >= 0 && dia <= 6,
        ),
      )]
    : [0, diaSemanaMeio]
  const automacao = dados.geracaoAutomatica
  const geracaoAutomatica = {
    ativa: automacao?.ativa === true,
    dia:
      typeof automacao?.dia === 'number' && Number.isFinite(automacao.dia)
        ? Math.min(31, Math.max(1, Math.floor(automacao.dia)))
        : 20,
    hora:
      typeof automacao?.hora === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(automacao.hora)
        ? automacao.hora
        : '00:00',
  }

  return {
    versao: 1,
    diaSemanaMeio,
    diasReuniao,
    geracaoAutomatica,
    aptidoes,
    escalas: escalas as DadosAvi['escalas'],
  }
}

export function registroAviDe(dados: DadosAvi, chave: string): RegistroAvi {
  const bruto = dados.escalas[chave]
  if (!bruto || typeof bruto !== 'object') return { auto: {}, manuais: {} }
  return {
    auto: bruto.auto ?? {},
    manuais: bruto.manuais ?? {},
    geradoEm: bruto.geradoEm,
  }
}

/** Designações efetivas do mês (automáticas + manuais vencem). */
export function efetivasAvi(registro: RegistroAvi): Record<string, string> {
  return { ...(registro.auto ?? {}), ...(registro.manuais ?? {}) }
}

/** Nomes designados de uma reunião, na ordem das funções da planilha. */
export function designacoesDe(
  iso: string,
  efetivas: Record<string, string>,
  porId: Map<string, { nome: string }>,
) {
  return FUNCOES_AVI.map((f) => {
    const id = efetivas[slotAvi(iso, f.id)]
    return { id: f.id, rotulo: f.coluna, nome: id ? (porId.get(id)?.nome ?? null) : null }
  })
}

/** Lista de aptidões de um irmão (defensiva). */
export function aptidoesDe(dados: DadosAvi, id: string): AptidaoId[] {
  return dados.aptidoes[id] ?? []
}

export interface EntradaGerarAvi {
  irmoes: IrmaoProjecao[]
  aptidoes: Record<string, AptidaoId[]>
  ocorrencias: OcorrenciaAvi[]
  manuais?: Record<string, string>
  semente?: string
}

export interface ResultadoAvi {
  auto: Record<string, string>
  designacoes: Record<string, string>
}

/** Intervalo mínimo (em dias) entre designações, conforme a frequência. */
const DIAS_POR_FREQUENCIA: Record<string, number> = {
  semanal: 7,
  quinzenal: 14,
  mensal: 28,
  bimestral: 56,
}

/** O voluntário aceitou servir naquele tipo de reunião? */
function aceitaSecao(irmao: IrmaoProjecao, secao: 'fds' | 'meio'): boolean {
  const reunioes = irmao.reunioes ?? 'ambos'
  if (reunioes === 'ambos') return true
  return secao === 'meio' ? reunioes === 'semana' : reunioes === 'fds'
}

function hash(texto: string): number {
  let h = 5381
  for (let i = 0; i < texto.length; i += 1) {
    h = ((h << 5) + h + texto.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * Rodízio do AVI — mesma inteligência do Campo aplicada às aptidões:
 * candidatos ativos aptos para a função, menor carga no mês primeiro,
 * desempate por quem espera há mais tempo e semente determinística.
 * Ajustes manuais nunca são sobrescritos (a sugestão automática continua
 * calculada para permitir desfazer o ajuste).
 */
export function gerarEscalaAvi({
  irmoes,
  aptidoes,
  ocorrencias,
  manuais = {},
  semente = '',
}: EntradaGerarAvi): ResultadoAvi {
  const porId = new Map(irmoes.filter((i) => i && i.nome).map((i) => [i.id, i]))
  const aptosPorFuncao = new Map<AptidaoId, string[]>()
  for (const { id } of FUNCOES_AVI) aptosPorFuncao.set(id, [])

  for (const [id, lista] of Object.entries(aptidoes)) {
    if (!porId.get(id)) continue
    for (const funcao of lista) {
      const listaFuncao = aptosPorFuncao.get(funcao)
      if (listaFuncao) listaFuncao.push(id)
    }
  }

  const total = new Map<string, number>()
  const ultimoTs = new Map<string, number>()

  function contar(id: string, iso: string): void {
    total.set(id, (total.get(id) ?? 0) + 1)
    const ts = Date.parse(`${iso}T12:00:00Z`)
    if (ts > (ultimoTs.get(id) ?? 0)) ultimoTs.set(id, ts)
  }

  function escolher(
    funcao: AptidaoId,
    chave: string,
    secao: 'fds' | 'meio',
  ): string | null {
    const candidatos = (aptosPorFuncao.get(funcao) ?? []).filter((id) => {
      const irmao = porId.get(id)
      return Boolean(irmao && aceitaSecao(irmao, secao))
    })
    if (!candidatos.length) return null

    // Limite mensal é uma preferência: se todos estouraram, ainda escolhe alguém.
    const dentroDoLimite = candidatos.filter((id) => {
      const limite = porId.get(id)?.limiteMensal ?? 3
      return (total.get(id) ?? 0) < limite
    })
    const base = dentroDoLimite.length ? dentroDoLimite : candidatos

    // Folga da frequência também é preferência; sem ninguém elegível, relaxa.
    const iso = chave.slice(0, 10)
    const dataAtual = Date.parse(`${iso}T12:00:00Z`)
    const comFolga = base.filter((id) => {
      const ultimo = ultimoTs.get(id)
      if (!ultimo) return true
      const dias = DIAS_POR_FREQUENCIA[porId.get(id)?.frequencia ?? ''] ?? 7
      return dataAtual - ultimo >= dias * 86_400_000
    })
    const elegiveis = comFolga.length ? comFolga : base

    const ordenados = [...elegiveis].sort((a, b) => {
      const placarA = [total.get(a) ?? 0, ultimoTs.get(a) ?? 0, hash(`${semente}|${chave}|${a}`)]
      const placarB = [total.get(b) ?? 0, ultimoTs.get(b) ?? 0, hash(`${semente}|${chave}|${b}`)]
      for (let i = 0; i < placarA.length; i += 1) {
        if (placarA[i] !== placarB[i]) return placarA[i] - placarB[i]
      }
      return 0
    })
    return ordenados[0] ?? null
  }

  const auto: Record<string, string> = {}
  const designacoes: Record<string, string> = { ...manuais }

  // Conta manuais primeiro (carga real do mês antes do automático).
  for (const [chave, id] of Object.entries(manuais)) {
    const iso = chave.slice(0, 10)
    if (porId.get(id)) contar(id, iso)
  }

  for (const oc of ocorrencias) {
    for (const { id: funcao } of FUNCOES_AVI) {
      const chave = slotAvi(oc.iso, funcao)
      const manual = manuais[chave]

      if (manual) {
        const sugestao = escolher(funcao, chave, oc.secao)
        if (sugestao) {
          auto[chave] = sugestao
          if (sugestao !== manual) contar(sugestao, oc.iso)
        }
        continue
      }

      const escolhido = escolher(funcao, chave, oc.secao)
      if (!escolhido) continue
      auto[chave] = escolhido
      designacoes[chave] = escolhido
      contar(escolhido, oc.iso)
    }
  }

  return { auto, designacoes }
}

/**
 * Gera (ou regenera) a escala do mês na chave. Idempotente sem `forcar`;
 * preserva os ajustes manuais informados.
 */
export function gerarAviDoMes(
  dados: DadosAvi,
  irmoes: IrmaoProjecao[],
  chave: string,
  { forcar = false, manuais }: { forcar?: boolean; manuais?: Record<string, string> } = {},
): DadosAvi {
  const registro = registroAviDe(dados, chave)
  if (registro.geradoEm && !forcar) return dados

  const { ano, mes } = lerChaveMes(chave)
  const ocorrencias = ocorrenciasAvi(ano, mes, dados.diasReuniao)
  const mantidos = manuais ?? registro.manuais ?? {}

  const { auto } = gerarEscalaAvi({
    irmoes,
    aptidoes: dados.aptidoes,
    ocorrencias,
    manuais: mantidos,
    semente: chave,
  })

  const novoRegistro: RegistroAvi = {
    auto,
    manuais: mantidos,
    geradoEm: new Date().toISOString(),
  }

  return { ...dados, escalas: { ...dados.escalas, [chave]: novoRegistro } }
}
