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
export function ocorrenciasAvi(ano: number, mes: number, diaSemanaMeio: number): OcorrenciaAvi[] {
  const totalDias = new Date(ano, mes + 1, 0).getDate()
  const meio = diaSemanaMeio === 4 ? 4 : 3
  const lista: OcorrenciaAvi[] = []

  for (let dia = 1; dia <= totalDias; dia += 1) {
    const data = new Date(ano, mes, dia)
    const diaSemana = data.getDay()
    const secao = diaSemana === 0 ? 'fds' : diaSemana === meio ? 'meio' : null
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
    aptidoes: {},
    escalas: {},
  }
  if (!bruto || typeof bruto !== 'object') return base
  const dados = bruto as Partial<DadosAvi>

  const aptidoes: Record<string, AptidaoId[]> = {}
  if (dados.aptidoes && typeof dados.aptidoes === 'object') {
    for (const [id, lista] of Object.entries(dados.aptidoes)) {
      if (!Array.isArray(lista)) continue
      const validas = lista.filter((a): a is AptidaoId =>
        FUNCOES_AVI.some((f) => f.id === a),
      )
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

  return {
    versao: 1,
    diaSemanaMeio: dados.diaSemanaMeio === 4 ? 4 : 3,
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

  function escolher(funcao: AptidaoId, chave: string): string | null {
    const candidatos = aptosPorFuncao.get(funcao) ?? []
    if (!candidatos.length) return null
    const ordenados = [...candidatos].sort((a, b) => {
      const placarA = [total.get(a) ?? 0, ultimoTs.get(a) ?? 0, hash(`${semente}|${chave}|${a}`)]
      const placarB = [total.get(b) ?? 0, ultimoTs.get(b) ?? 0, hash(`${semente}|${chave}|${b}`)]
      for (let i = 0; i < placarA.length; i += 1) {
        if (placarA[i] !== placarB[i]) return placarA[i] - placarB[i]
      }
      return 0
    })
    return ordenados[0]
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
        const sugestao = escolher(funcao, chave)
        if (sugestao) {
          auto[chave] = sugestao
          if (sugestao !== manual) contar(sugestao, oc.iso)
        }
        continue
      }

      const escolhido = escolher(funcao, chave)
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
  const ocorrencias = ocorrenciasAvi(ano, mes, dados.diaSemanaMeio)
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
