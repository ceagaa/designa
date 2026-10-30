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
  /** Máximo de designações não fixas por mês (padrão 1). */
  limiteMensal?: 1 | 2 | 3
  dias: number[]
  horarios: string[]
  /** Habilita a pessoa para sair como ajudante. */
  ajudante?: boolean
  /** Dias em que pode ser ajudante (quando `ajudante`). */
  diasAjudante?: number[]
  /**
   * Departamentos do voluntário (um ou mais). Fichas novas gravam aqui;
   * `departamento` continua valendo para registros antigos.
   */
  departamentos?: SetorId[]
  /** Departamento principal — compatibilidade com fichas antigas. */
  departamento?: SetorId
  /** Reuniões em que o voluntário do AVI pode atuar. */
  reunioes?: ReuniaoAvi
}

/** Turnos de reunião do AVI. */
export type ReuniaoAvi = 'semana' | 'fds' | 'ambos'

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
  /** Ocorrências removidas da programação daquele mês. */
  removidas?: Record<string, boolean>
  /** Dirigentes-ajudante sugeridos pelo rodízio. */
  autoAjudante?: Record<string, Identificador>
  /** Ajuste manual de ajudante (não afeta a próxima geração automática). */
  manuaisAjudante?: Record<string, Identificador>
  geradoEm?: string
  /** Impede que a geração automática recrie uma escala limpa pelo usuário. */
  limpa?: boolean
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
 * [iso, horário, local, nome, fixo?, ajudante?] e, quando o dia é fixo
 * (designação fixa + "Quem dirige"), um 5º elemento '1' mantém o
 * agrupamento igual ao PDF. Links antigos sem o 6º campo continuam válidos.
 */
export interface PayloadCompartilhado {
  t: string
  c: string
  a: number
  m: number
  r: Array<[string, string, string, string, string?, string?]>
}

/** Origem de onde o estado veio ao carregar. */
export type OrigemEstado = 'nuvem' | 'local' | 'padrao'

/** Onde o estado foi persistido na última gravação. */
export type DestinoEstado = 'nuvem' | 'local'

/** Abas inferiores do app (apenas 3 itens). */
export type AbaNav = 'designacoes' | 'pessoas' | 'ajustes'

/**
 * Telas internas do app. `designacoes` é a home com os cards dos setores;
 * `campo`/`avi`/`tpl` são as telas de setor; `montagem` e `locais` são filhas.
 */
export type Tela =
  | 'designacoes'
  | 'campo'
  | 'montagem'
  | 'avi'
  | 'tpl'
  | 'pessoas'
  | 'ajustes'
  | 'ajustesCampo'
  | 'ajustesAvi'
  | 'ajustesTpl'
  | 'locais'

/** Setores gerenciáveis por convite (Fase 1). */
export type SetorId = 'CAMPO' | 'AUDIO_VIDEO' | 'TPL'

export const SETORES: readonly SetorId[] = ['CAMPO', 'AUDIO_VIDEO', 'TPL']

export const ROTULO_SETOR: Record<SetorId, string> = {
  CAMPO: 'Saídas de Campo',
  AUDIO_VIDEO: 'Áudio, Vídeo & Indicadores',
  TPL: 'Testemunho Público Local',
}

/**
 * Departamentos explícitos de um voluntário, sem duplicatas. Fichas antigas
 * (só `departamento`) devolvem uma lista de um item; sem nenhum, lista vazia.
 */
export function departamentosDe(d: {
  departamento?: SetorId
  departamentos?: SetorId[]
}): SetorId[] {
  const lista = (d.departamentos ?? []).filter((s) => SETORES.includes(s))
  if (lista.length) return [...new Set(lista)]
  return d.departamento ? [d.departamento] : []
}

/**
 * O voluntário atua neste setor? Fichas antigas sem departamento continuam
 * valendo como Campo (comportamento legado).
 */
export function pertenceAoSetor(
  d: { departamento?: SetorId; departamentos?: SetorId[] },
  setor: SetorId,
): boolean {
  const deps = departamentosDe(d)
  if (deps.length) return deps.includes(setor)
  return setor === 'CAMPO'
}

/** Usuário autenticado (sessão) com a congregação dele. */
export interface Usuario {
  id: string
  email: string
  nome: string
  papel: 'ADMIN' | 'AJUDANTE'
  setor: SetorId | null
  congregacao: { nome: string; numero: string; slug: string }
}

/** Variantes visuais do Botão da UI. */
export type VarianteBotao = 'primario' | 'vinho' | 'sucesso' | 'secundario' | 'fantasma' | 'perigo'

/** Aptidões AVI (checkbox do cadastro de voluntários). */
export type AptidaoId =
  | 'som'
  | 'video'
  | 'palco'
  | 'microfone'
  | 'indicador_interno'
  | 'indicador_externo'

/** Colunas da aba AVI da planilha original (cabeçalho + rótulo do checkbox). */
export interface FuncaoAvi {
  id: AptidaoId
  /** Texto do checkbox de aptidão. */
  rotulo: string
  /** Cabeçalho da coluna na tabela da planilha. */
  coluna: string
  /** Subtexto do cabeçalho (ex.: "mesa de som"). */
  subtitulo?: string
}

export const FUNCOES_AVI: readonly FuncaoAvi[] = [
  { id: 'som', rotulo: 'Operador de Áudio', coluna: 'Operador áudio', subtitulo: 'mesa de som' },
  { id: 'video', rotulo: 'Operador de Vídeo', coluna: 'Operador vídeo', subtitulo: 'notebook' },
  { id: 'palco', rotulo: 'Palco', coluna: 'Palco' },
  { id: 'microfone', rotulo: 'Microfone Volante', coluna: 'Microfone volante' },
  { id: 'indicador_interno', rotulo: 'Indicador interno', coluna: 'Indicador interno' },
  { id: 'indicador_externo', rotulo: 'Indicador externo', coluna: 'Indicador externo' },
]

/** Registro mensal AVI — slot = `${iso}_${funcao}` (uma designação por função/reunião). */
export interface RegistroAvi {
  auto?: Record<string, Identificador>
  manuais?: Record<string, Identificador>
  geradoEm?: string
}

/** Dados persistidos do setor AUDIO_VIDEO (/api/setor/AUDIO_VIDEO). */
export interface DadosAvi {
  versao: number
  /** Dia da reunião de meio de semana: 3 = quarta, 4 = quinta. */
  diaSemanaMeio: number
  /** Dias de reunião AVI por semana (0 = domingo, 6 = sábado). */
  diasReuniao: number[]
  geracaoAutomatica: { ativa: boolean; dia: number; hora: string }
  /** Aptidões marcadas por irmão (cadastro unificado, chave = id da ficha). */
  aptidoes: Record<string, AptidaoId[]>
  /** Escalas por chave de mês ("2026-11"). */
  escalas: Record<string, RegistroAvi>
}

/** Ocorrência AVI: uma reunião (data) do mês. */
export interface OcorrenciaAvi {
  key: string
  iso: string
  dia: number
  diaSemana: number
  /** Seção da tabela: fim de semana (domingo) ou meio de semana. */
  secao: 'fds' | 'meio'
}

/** Projeção mínima de irmão devolvida pela API dos setores AVI e TPL. */
export interface IrmaoProjecao {
  id: Identificador
  nome: string
  ativo: boolean
  departamento?: SetorId
  reunioes?: ReuniaoAvi
  frequencia?: string
  limiteMensal?: 1 | 2 | 3
}

/** Ponto de apoio / local do carrinho (setor TPL). */
export interface PontoTpl {
  id: Identificador
  nome: string
}

/** Local de trabalho atendido com o carrinho. */
export interface LocalTpl {
  id: Identificador
  nome: string
}

/** Período (dia da semana + turno) de um ponto — ex.: Manhã 08:00–10:00. */
export interface PeriodoTpl {
  id: Identificador
  pontoId: Identificador
  localId?: Identificador
  diaSemana: number
  inicio: string
  fim: string
}

  /** Participante autorizado para o TPL. */
export interface ParticipanteTpl {
  id: Identificador
  nome: string
  telefone?: string
  ativo: boolean
}

/** Registro mensal TPL — slot = `${iso}_${periodoId}` → dupla (ids). */
export interface RegistroTpl {
  auto?: Record<string, Identificador[]>
  manuais?: Record<string, Identificador[]>
  geradoEm?: string
}

/** Dados persistidos do setor TPL (/api/setor/TPL). */
export interface DadosTpl {
  versao: number
  pontos: PontoTpl[]
  locais: LocalTpl[]
  periodos: PeriodoTpl[]
  participantes: ParticipanteTpl[]
  escalas: Record<string, RegistroTpl>
}

/** Regra do módulo: no mínimo 2 participantes por ponto/horário. */
export const MINIMO_DUPLA = 2
