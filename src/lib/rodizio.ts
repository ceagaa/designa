import type { Dirigente, Ocorrencia } from './dominio'
import { regrasDoDepartamento } from './dominio'
import { frequenciaDe } from './constants'

/**
 * Intervalo mínimo em dias entre duas designações do mesmo dirigente,
 * conforme a frequência configurada.
 */
const GAP_DIAS: Record<string, number> = {
  semanal: 3,
  quinzenal: 12,
  mensal: 25,
  bimestral: 50,
}

/** Regras opcionais do rodízio (Configurações → Regras do Rodízio). */
export interface RegrasRodizio {
  /** Nunca designar a mesma pessoa em dias seguidos. */
  evitarConsecutivos?: boolean
  /** Equilibrar quem sai em sábado/domingo. */
  equilibrarFds?: boolean
  /** Teto de designações por pessoa no mês (0 = sem limite). Suave: relaxa se travar. */
  limiteMensal?: number
}

interface RegrasNormalizadas {
  evitarConsecutivos: boolean
  equilibrarFds: boolean
  limiteMensal: number
}

function normalizarRegras(regras: RegrasRodizio = {}): RegrasNormalizadas {
  const limite = regras.limiteMensal
  return {
    evitarConsecutivos: regras.evitarConsecutivos !== false,
    equilibrarFds: regras.equilibrarFds !== false,
    limiteMensal: typeof limite === 'number' && Number.isFinite(limite) && limite >= 0
      ? Math.floor(limite)
      : 3,
  }
}

function ehFimDeSemana(diaSemana: number): boolean {
  return diaSemana === 0 || diaSemana === 6
}

interface Estatistica {
  id: string
  nome: string
  dias: Set<number>
  horarios: Set<string>
  maximoMensal: number
  gap: number
  capacidade: number
  restantes: number
  total: number
  fds: number
  /** Vezes que saiu como ajudante (revezamento do apoio). */
  ajudou: number
  ultimoTs: number
  ultimoAjudouTs: number
}

interface CandidatoEscolhido {
  c: Estatistica
  placar: number[]
}

function hash(texto: string): number {
  let h = 5381
  for (let i = 0; i < texto.length; i += 1) {
    h = ((h << 5) + h + texto.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function preparar(dirigentes: Dirigente[], ocorrencias: Ocorrencia[]): Estatistica[] {
  return dirigentes
    .filter((d) => d && d.ativo !== false && d.nome)
    .map((d) => {
      const regras = regrasDoDepartamento(d, 'CAMPO')
      const freq = frequenciaDe(regras.frequencia)
      const dias = new Set((d.dias ?? []).map(Number))
      const horarios = new Set(d.horarios ?? [])
      const aptas = ocorrencias.filter((o) => dias.has(o.diaSemana) && horarios.has(o.campo.horario))
      const capacidade = Math.max(1, Math.ceil(aptas.length / freq.intervaloSemanas))

      return {
        id: d.id,
        nome: d.nome,
        dias,
        horarios,
        maximoMensal: regras.limiteMensal,
        gap: GAP_DIAS[freq.id] ?? GAP_DIAS.semanal,
        capacidade,
        restantes: capacidade,
        total: 0,
        fds: 0,
        ajudou: 0,
        ultimoTs: 0,
        ultimoAjudouTs: 0,
      }
    })
}

function diasDesde(ultimoTs: number, dataTs: number): number {
  return ultimoTs ? (dataTs - ultimoTs) / 86400000 : Number.POSITIVE_INFINITY
}

interface ContextoEscolha {
  chave: string
  semente: string
  dataTs: number
  ehFds: boolean
  regras: RegrasNormalizadas
  ignorarCapacidade: boolean
  ignorarGap: boolean
  ignorarConsecutivo: boolean
  ignorarLimite: boolean
}

function escolher(candidatos: Estatistica[], contexto: ContextoEscolha): Estatistica | null {
  const { chave, semente, dataTs, ehFds, regras, ignorarCapacidade, ignorarGap, ignorarConsecutivo, ignorarLimite } =
    contexto

  const validos = candidatos.filter((c) => {
    if (c.total >= c.maximoMensal) return false
    if (!ignorarCapacidade && c.restantes <= 0) return false
    const dias = diasDesde(c.ultimoTs, dataTs)
    if (!ignorarGap && dias < c.gap) return false
    if (!ignorarConsecutivo && regras.evitarConsecutivos && dias < 2) return false
    if (!ignorarLimite && regras.limiteMensal > 0 && c.total >= regras.limiteMensal) return false
    return true
  })

  if (!validos.length) return null

  const ordenados: CandidatoEscolhido[] = validos
    .map((c) => {
      // Sem folga disponível, prefere quem está mais próximo da frequência configurada.
      const aderencia = diasDesde(c.ultimoTs, dataTs) / c.gap
      const criterio = ignorarGap ? -aderencia : 0
      // Em fim de semana, quem já saiu menos nos fins de semana vem primeiro.
      const criterioFds = regras.equilibrarFds && ehFds ? c.fds : 0
      return {
        c,
        placar: [criterio, criterioFds, c.total, c.ultimoTs, hash(`${semente}|${chave}|${c.id}`)],
      }
    })
    .sort((a, b) => {
      for (let i = 0; i < a.placar.length; i += 1) {
        if (a.placar[i] !== b.placar[i]) return a.placar[i] - b.placar[i]
      }
      return 0
    })

  return ordenados[0].c
}

function comprometer(
  estatistica: Estatistica,
  ocorrencia: Ocorrencia,
  contabilizarLimite = true,
): void {
  if (contabilizarLimite) {
    estatistica.total += 1
    estatistica.restantes -= 1
  }
  if (ehFimDeSemana(ocorrencia.diaSemana)) estatistica.fds += 1
  estatistica.ultimoTs = ocorrencia.data.getTime()
}

type ContextoCascata = Omit<
  ContextoEscolha,
  'ignorarCapacidade' | 'ignorarGap' | 'ignorarConsecutivo' | 'ignorarLimite'
>

function cascata(candidatos: Estatistica[], contexto: ContextoCascata): Estatistica | null {
  // Ordem das relaxações: capacidade → folga → limite (sugerido) → descanso (último recurso).
  const fases: Array<
    Pick<
      ContextoEscolha,
      'ignorarCapacidade' | 'ignorarGap' | 'ignorarConsecutivo' | 'ignorarLimite'
    >
  > = [
    { ignorarCapacidade: false, ignorarGap: false, ignorarConsecutivo: false, ignorarLimite: false },
    { ignorarCapacidade: true, ignorarGap: false, ignorarConsecutivo: false, ignorarLimite: false },
    { ignorarCapacidade: false, ignorarGap: true, ignorarConsecutivo: false, ignorarLimite: false },
    { ignorarCapacidade: true, ignorarGap: true, ignorarConsecutivo: false, ignorarLimite: false },
    { ignorarCapacidade: true, ignorarGap: true, ignorarConsecutivo: false, ignorarLimite: true },
    { ignorarCapacidade: true, ignorarGap: true, ignorarConsecutivo: true, ignorarLimite: true },
  ]
  for (const fase of fases) {
    const escolhido = escolher(candidatos, { ...contexto, ...fase })
    if (escolhido) return escolhido
  }
  return null
}

/**
 * Revezamento do apoio: a mesma frequência/limite do Campo vale também para
 * as vezes como ajudante, mas em uma cota separada da direção. Quem ajudou
 * menos e está há mais tempo sem ajudar vem primeiro; nunca a própria designada.
 */
function podeAjudar(s: Estatistica, dataTs: number): boolean {
  if (s.ajudou >= s.maximoMensal) return false
  const dias = s.ultimoAjudouTs
    ? (dataTs - s.ultimoAjudouTs) / 86400000
    : Number.POSITIVE_INFINITY
  return dias >= s.gap
}

function escolherAjudante(
  stats: Estatistica[],
  habilitados: ReadonlySet<string>,
  contexto: { chave: string; semente: string; dirigente: string; dataTs: number },
): Estatistica | null {
  const validos = stats.filter(
    (s) =>
      habilitados.has(s.id) &&
      s.id !== contexto.dirigente &&
      podeAjudar(s, contexto.dataTs),
  )
  if (!validos.length) return null

  const ordenados = validos
    .map((c) => ({
      c,
      placar: [
        c.ajudou,
        c.total,
        c.ultimoAjudouTs,
        c.fds,
        hash(`${contexto.semente}|aj|${contexto.chave}|${c.id}`),
      ],
    }))
    .sort((a, b) => {
      for (let i = 0; i < a.placar.length; i += 1) {
        if (a.placar[i] !== b.placar[i]) return a.placar[i] - b.placar[i]
      }
      return 0
    })

  return ordenados[0].c
}

/**
 * Apoio do dia: usa o ajudante fixo quando configurado e elegível. Se o fixo
 * já atingiu a frequência/limite, o dia fica sem ajudante (a cota é preservada
 * para os dias não fixos). Sem fixo definido, cai no rodízio dos habilitados.
 */
function escolherApoio({
  stats,
  porId,
  habilitados,
  contexto,
  fixo,
}: {
  stats: Estatistica[]
  porId: Map<string, Estatistica>
  habilitados: ReadonlySet<string>
  contexto: { chave: string; semente: string; dirigente: string; dataTs: number }
  fixo: string | null
}): Estatistica | null {
  if (fixo) {
    const fixoStats = porId.get(fixo)
    return fixoStats &&
      fixoStats.id !== contexto.dirigente &&
      podeAjudar(fixoStats, contexto.dataTs)
      ? fixoStats
      : null
  }
  return escolherAjudante(stats, habilitados, contexto)
}

export interface EntradaGerarEscala {
  dirigentes: Dirigente[]
  ocorrencias: Ocorrencia[]
  manuais?: Record<string, string>
  /** Ajustes manuais de ajudante (não são sobrescritos). */
  manuaisAjudante?: Record<string, string>
  semente?: string
  fixa?: boolean
  /** Regras de Configurações → Regras do Rodízio. */
  regras?: RegrasRodizio
}

export interface ResultadoEscala {
  auto: Record<string, string>
  designacoes: Record<string, string>
  autoAjudante: Record<string, string>
}

/**
 * Rodízio inteligente: respeita frequência, disponibilidade de dia/horário,
 * folga mínima entre designações e equilíbrio (menor carga primeiro).
 * Designações marcadas como manuais não são sobrescritas, mas a sugestão
 * automática daquela linha continua calculada para permitir desfazer o ajuste.
 * Com `fixa` ligado, cada dia de campo usa a pessoa fixa cadastrada nele.
 */
export function gerarEscala({
  dirigentes,
  ocorrencias,
  manuais = {},
  manuaisAjudante = {},
  semente = '',
  fixa = false,
  regras,
}: EntradaGerarEscala): ResultadoEscala {
  const regrasNorm = normalizarRegras(regras)
  const stats = preparar(dirigentes, ocorrencias)
  const porId = new Map(stats.map((s) => [s.id, s]))
  const auto: Record<string, string> = {}
  const designacoes: Record<string, string> = { ...manuais }
  const autoAjudante: Record<string, string> = {}

  // Quem tem "Marcar como ajudante" com aquele dia habilitado.
  const ajudantesPorDia = new Map<number, Set<string>>()
  for (const d of dirigentes) {
    if (!d || d.ativo === false || !d.nome || !d.ajudante) continue
    const dias = (d.diasAjudante ?? []).map(Number)
    // Sem dias marcados, a pessoa ajuda em qualquer dia (como diz a ficha).
    for (const dia of dias.length ? dias : [0, 1, 2, 3, 4, 5, 6]) {
      let conjunto = ajudantesPorDia.get(dia)
      if (!conjunto) {
        conjunto = new Set<string>()
        ajudantesPorDia.set(dia, conjunto)
      }
      conjunto.add(d.id)
    }
  }

  const porChave = new Map(ocorrencias.map((o) => [o.key, o]))
  for (const [chave, id] of Object.entries(manuais)) {
    const s = porId.get(id)
    const oc = porChave.get(chave)
    if (!s) continue
    if (fixa && oc?.campo.fixo) continue
    s.total += 1
    s.restantes -= 1
    if (oc && ehFimDeSemana(oc.diaSemana)) s.fds += 1
    if (oc && oc.data.getTime() > s.ultimoTs) s.ultimoTs = oc.data.getTime()
  }
  for (const [chave, id] of Object.entries(manuaisAjudante)) {
    const s = porId.get(id)
    if (!s) continue
    s.ajudou += 1
    const oc = porChave.get(chave)
    if (oc) s.ultimoAjudouTs = Math.max(s.ultimoAjudouTs, oc.data.getTime())
  }

  for (const oc of ocorrencias) {
    const candidatos = stats.filter(
      (s) => s.dias.has(oc.diaSemana) && s.horarios.has(oc.campo.horario),
    )
    const contexto = {
      chave: oc.key,
      semente,
      dataTs: oc.data.getTime(),
      ehFds: ehFimDeSemana(oc.diaSemana),
      regras: regrasNorm,
    }

    if (manuais[oc.key]) {
      // Calcula o que o rodízio teria escolhido (para poder desfazer o ajuste)
      // e considera essa sugestão nas contagens, mantendo o mapa automático coerente.
      const sugestao = cascata(candidatos, contexto)
      if (sugestao) {
        auto[oc.key] = sugestao.id
        if (sugestao.id !== manuais[oc.key]) comprometer(sugestao, oc)
      }
    } else {
      const fixo = fixa ? oc.campo?.fixo ?? null : null
      const estatisticaFixa = fixo ? porId.get(fixo) : null
      if (estatisticaFixa && fixo) {
        auto[oc.key] = fixo
        designacoes[oc.key] = fixo
        comprometer(estatisticaFixa, oc, false)
      } else {
        const escolhido = cascata(candidatos, contexto)
        if (escolhido) {
          auto[oc.key] = escolhido.id
          designacoes[oc.key] = escolhido.id
          comprometer(escolhido, oc)
        }
      }
    }
  }

  // Ajudantes em uma segunda passada: dias com ajudante fixo explícito primeiro,
  // depois os dias não fixos (começando pelos dias com menos ajudantes elegíveis)
  // e, por último, os fixos sem ajudante definido. Assim a cota de 1x é
  // preservada para os dias que dependem do rodízio.
  const prioridadeApoio = (oc: Ocorrencia): number => {
    if (fixa && oc.campo?.ajudanteFixo) return 0
    if (!oc.campo?.fixo) return 1
    return 2
  }
  const ordemApoio = [...ocorrencias].sort((a, b) => {
    const pa = prioridadeApoio(a)
    const pb = prioridadeApoio(b)
    if (pa !== pb) return pa - pb
    if (pa === 1) {
      const ea = ajudantesPorDia.get(a.diaSemana)?.size ?? 0
      const eb = ajudantesPorDia.get(b.diaSemana)?.size ?? 0
      if (ea !== eb) return ea - eb
    }
    return a.data.getTime() - b.data.getTime()
  })

  for (const oc of ordemApoio) {
    if (manuaisAjudante[oc.key] !== undefined) continue
    const designado = designacoes[oc.key]
    if (!designado) continue

    const habilitados = ajudantesPorDia.get(oc.diaSemana) ?? new Set<string>()
    const ajudante = escolherApoio({
      stats,
      porId,
      habilitados,
      contexto: {
        chave: oc.key,
        semente,
        dirigente: designado,
        dataTs: oc.data.getTime(),
      },
      fixo: fixa ? (oc.campo?.ajudanteFixo ?? null) : null,
    })
    if (ajudante) {
      autoAjudante[oc.key] = ajudante.id
      ajudante.ajudou += 1
      ajudante.ultimoAjudouTs = oc.data.getTime()
    }
  }

  return { auto, designacoes, autoAjudante }
}

/** Dirigentes ativos disponíveis para um dia/horário, com os disponíveis primeiro. */
export interface EntradaDesignarDia {
  dirigentes: Dirigente[]
  /** O dia (único) que deve receber designação. */
  ocorrencia: Ocorrencia
  /** Todas as ocorrências ativas do mês: calibram capacidade e folga de cada um. */
  todasOcorrencias: Ocorrencia[]
  /** Designações já existentes no mês (automáticas + manuais), travadas. */
  existentes: Record<string, string>
  /** Ajudantes já existentes no mês, usados no revezamento do apoio. */
  existentesAjudante?: Record<string, string>
  semente?: string
  fixa?: boolean
  regras?: RegrasRodizio
}

export interface ResultadoDia {
  dirigente: string | null
  ajudante: string | null
}

/**
 * Designa UM dia com o rodízio, contando as designações já existentes do mês
 * nas estatísticas (carga, folga e limite) para não repetir quem já saiu.
 * Usado ao restaurar um dia removido: só aquele dia muda, o resto da escala
 * permanece exatamente como está.
 */
export function designarDia({
  dirigentes,
  ocorrencia,
  todasOcorrencias,
  existentes,
  existentesAjudante = {},
  semente = '',
  fixa = false,
  regras,
}: EntradaDesignarDia): ResultadoDia {
  const regrasNorm = normalizarRegras(regras)
  const stats = preparar(dirigentes, todasOcorrencias)
  const porId = new Map(stats.map((s) => [s.id, s]))
  const porChave = new Map(todasOcorrencias.map((o) => [o.key, o]))

  // Situação atual do mês, carregada em ordem de data (mesma calibração do gerador).
  const emOrdem = Object.entries(existentes).sort((a, b) => {
    const oa = porChave.get(a[0])
    const ob = porChave.get(b[0])
    return (oa?.data.getTime() ?? 0) - (ob?.data.getTime() ?? 0)
  })
  for (const [chave, id] of emOrdem) {
    const s = porId.get(id)
    const oc = porChave.get(chave)
    if (!s || !oc || (fixa && oc.campo.fixo)) continue
    s.total += 1
    s.restantes -= 1
    if (ehFimDeSemana(oc.diaSemana)) s.fds += 1
    if (oc.data.getTime() > s.ultimoTs) s.ultimoTs = oc.data.getTime()
  }
  for (const [chave, id] of Object.entries(existentesAjudante)) {
    const s = porId.get(id)
    const oc = porChave.get(chave)
    if (!s || !oc) continue
    s.ajudou += 1
    s.ultimoAjudouTs = Math.max(s.ultimoAjudouTs, oc.data.getTime())
  }

  // Espelha a cascata do gerador: pessoa fixa do dia quando a escala é fixa.
  const fixo = fixa ? ocorrencia.campo?.fixo ?? null : null
  const estatisticaFixa = fixo ? porId.get(fixo) : null
  const contexto = {
    chave: ocorrencia.key,
    semente,
    dataTs: ocorrencia.data.getTime(),
    ehFds: ehFimDeSemana(ocorrencia.diaSemana),
    regras: regrasNorm,
  }

  let designado: string | null = null
  if (estatisticaFixa && fixo) {
    designado = fixo
    comprometer(estatisticaFixa, ocorrencia, false)
  } else {
    const candidatos = stats.filter(
      (s) => s.dias.has(ocorrencia.diaSemana) && s.horarios.has(ocorrencia.campo.horario),
    )
    const escolhido = cascata(candidatos, contexto)
    if (escolhido) {
      designado = escolhido.id
      comprometer(escolhido, ocorrencia)
    }
  }

  // Ajudante: fixo do dia quando elegível; em branco ou sem folga/limite, rodízio.
  let ajudante: string | null = null
  if (designado) {
    const habilitados = new Set<string>()
    for (const d of dirigentes) {
      if (!d || d.ativo === false || !d.nome || !d.ajudante) continue
      const dias = (d.diasAjudante ?? []).map(Number)
      if (!dias.length || dias.includes(ocorrencia.diaSemana)) habilitados.add(d.id)
    }
    ajudante =
      escolherApoio({
        stats,
        porId,
        habilitados,
        contexto: {
          chave: ocorrencia.key,
          semente,
          dirigente: designado,
          dataTs: ocorrencia.data.getTime(),
        },
        fixo: fixa ? (ocorrencia.campo?.ajudanteFixo ?? null) : null,
      })?.id ?? null
  }

  return { dirigente: designado, ajudante }
}

export function candidatosPara(ocorrencia: Ocorrencia, dirigentes: Dirigente[]): Array<Dirigente & { disponivel: boolean }> {
  const ativos = dirigentes.filter((d) => d && d.ativo !== false && d.nome)
  const disponiveis = ativos.filter(
    (d) =>
      (d.dias ?? []).map(Number).includes(ocorrencia.diaSemana) &&
      (d.horarios ?? []).includes(ocorrencia.campo.horario),
  )
  const fora = ativos.filter((d) => !disponiveis.includes(d))

  return [
    ...disponiveis.map((d) => ({ ...d, disponivel: true })),
    ...fora.map((d) => ({ ...d, disponivel: false })),
  ]
}

/** Pessoas habilitadas como ajudante para o dia da ocorrência (disponíveis primeiro). */
export function candidatosAjudantePara(
  ocorrencia: Ocorrencia,
  dirigentes: Dirigente[],
): Array<Dirigente & { disponivel: boolean }> {
  const marcados = dirigentes.filter((d) => d && d.ativo !== false && d.nome && d.ajudante)
  const disponiveis = marcados.filter((d) => {
    const dias = (d.diasAjudante ?? []).map(Number)
    return !dias.length || dias.includes(ocorrencia.diaSemana)
  })
  const fora = marcados.filter((d) => !disponiveis.includes(d))

  return [
    ...disponiveis.map((d) => ({ ...d, disponivel: true })),
    ...fora.map((d) => ({ ...d, disponivel: false })),
  ]
}
