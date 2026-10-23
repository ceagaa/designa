/** Tipos de domínio do app — fonte única de verdade para as entidades. */

export type FrequenciaId = 'semanal' | 'quinzenal' | 'mensal' | 'bimestral'

/** Ids de dirigente ("dir-…") ou de campo ("campo-…"). */
export type Identificador = string

export interface Dirigente {
  id: Identificador
  nome: string
  telefone: string
  ativo: boolean
  frequencia: FrequenciaId | string
  dias: number[]
  horarios: string[]
  /** Habilita a pessoa para sair como ajudante. */
  ajudante?: boolean
  /** Dias em que pode ser ajudante (quando `ajudante`). */
  diasAjudante?: number[]
}

export interface Campo {
  id: Identificador
  diaSemana: number
  horario: string
  local: string
  /** Dirigente que sai sempre neste dia (designação fixa). */
  fixo: Identificador | null
  /** Ajudante que sai sempre neste dia (designação fixa; null = sem ajudante). */
  ajudanteFixo?: Identificador | null
}

export interface ConfigEscala {
  titulo: string
  congregacao: string
  designacao_fixa: boolean
  frequencia_padrao: FrequenciaId | string
  /** Regra: nunca designar a mesma pessoa em dias seguidos. */
  evitar_consecutivos: boolean
  /** Regra: equilibrar quem sai em sábado/domingo. */
  equilibrar_fds: boolean
  /** Teto de designações por dirigente no mês (0 = sem limite; aplicação suave). */
  limite_mensal: number
  /** Troca o horário regular de todos os dias feriados pelo horário abaixo. */
  ajustar_feriados: boolean
  /** Horário que vale nos feriados quando `ajustar_feriados` está ligado. */
  horario_feriado: string
  /** Dia do mês (1–31) em que a escala do mês seguinte é gerada automaticamente. */
  disparo_dia: number
  /** Horário (HH:MM, fuso de São Paulo) da geração automática. */
  disparo_hora: string
}

/** `MapaDesignacoes` cobre os registros de `escalas` (também guarda `_config`). */
export type MapaDesignacoes = Record<string, unknown>

export interface Escalas {
  _config: ConfigEscala
  [chave: string]: MapaDesignacoes | ConfigEscala
}

export interface Estado {
  dirigentes: Dirigente[]
  config_campos: Campo[]
  escalas: Escalas
}

/** Registro mensal: automático, manuais e carimbo da última geração. */
export interface RegistroMes {
  auto?: Record<string, Identificador>
  manuais?: Record<string, Identificador>
  /** Dirigentes-ajudante sugeridos pelo rodízio. */
  autoAjudante?: Record<string, Identificador>
  /** Ajuste manual de ajudante (não afeta a próxima geração automática). */
  manuaisAjudante?: Record<string, Identificador>
  geradoEm?: string
}

/** Ocorrência (data x campo) de um mês. */
export interface Ocorrencia {
  key: string
  data: Date
  iso: string
  dia: number
  diaSemana: number
  campo: Campo
  /** Feriado nacional neste dia. */
  feriado?: boolean
  /** Último domingo do mês. */
  ultimoDomingo?: boolean
}

/** Candidato do rodízio (ficha + disponibilidade). */
export interface Candidato extends Dirigente {
  disponivel: boolean
}

/**
 * Payload codificado no link compartilhado. Linhas:
 * [iso, horário, local, nome] e, quando o dia é fixo (designação fixa +
 * "Quem dirige"), um 5º elemento '1' mantém o agrupamento igual ao PDF.
 */
export interface PayloadCompartilhado {
  t: string
  c: string
  a: number
  m: number
  r: Array<[string, string, string, string, string?]>
}

/** Origem de onde o estado veio ao carregar. */
export type OrigemEstado = 'nuvem' | 'local' | 'padrao'

/** Onde o estado foi persistido na última gravação. */
export type DestinoEstado = 'nuvem' | 'local'

/** Abas inferiores do app. */
export type AbaNav = 'designacao' | 'dirigentes' | 'locais' | 'config'

/** Telas internas do app (montagem é filha da aba Designação). */
export type Tela = 'resumo' | 'montagem' | AbaNav

/** Variantes visuais do Botão da UI. */
export type VarianteBotao = 'primario' | 'vinho' | 'secundario' | 'fantasma' | 'perigo'
