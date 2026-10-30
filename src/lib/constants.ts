import type { FrequenciaId } from './dominio'

export interface InfoDia {
  idx: number
  curto: string
  nome: string
  fimDeSemana: boolean
}

export const DIAS_SEMANA: readonly InfoDia[] = [
  { idx: 0, curto: 'Dom', nome: 'Domingo', fimDeSemana: true },
  { idx: 1, curto: 'Seg', nome: 'Segunda-Feira', fimDeSemana: false },
  { idx: 2, curto: 'Ter', nome: 'Terça-Feira', fimDeSemana: false },
  { idx: 3, curto: 'Qua', nome: 'Quarta-Feira', fimDeSemana: false },
  { idx: 4, curto: 'Qui', nome: 'Quinta-Feira', fimDeSemana: false },
  { idx: 5, curto: 'Sex', nome: 'Sexta-Feira', fimDeSemana: false },
  { idx: 6, curto: 'Sáb', nome: 'Sábado', fimDeSemana: true },
]

/** Nome curto como na planilha base: "Quarta - 05/03", sem o "-Feira". */
export const NOMES_DIAS_CURTOS: readonly string[] = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
]

export function nomeDiaCurto(idx: number): string {
  return NOMES_DIAS_CURTOS[idx] ?? 'Dia'
}

/** Ordem de exibição dos chips de disponibilidade (semana de trabalho primeiro). */
export const ORDEM_DIAS: readonly number[] = [1, 2, 3, 4, 5, 6, 0]

export interface Frequencia {
  id: FrequenciaId
  label: string
  intervaloSemanas: number
}

export const FREQUENCIAS: readonly Frequencia[] = [
  { id: 'semanal', label: 'Semanal', intervaloSemanas: 1 },
  { id: 'quinzenal', label: 'A cada 2 semanas', intervaloSemanas: 2 },
  { id: 'mensal', label: 'Mensal', intervaloSemanas: 4 },
  { id: 'bimestral', label: 'A cada 2 meses', intervaloSemanas: 8 },
]

export const MESES: readonly string[] = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export const HORARIOS_PADRAO: readonly string[] = ['08:00', '08:30', '09:00', '16:00', '18:30']

export const CORES = {
  petroleo: '#045A6C',
  vinho: '#7E0024',
  conteudoFimDeSemana: '#F9FBFD',
  conteudoSemana: '#FFF3F3',
  linha: '#D9E2E5',
  texto: '#10262B',
} as const

/**
 * Cores exatas da aba "Programação" da planilha base,
 * extraídas com o próprio Excel (rgb resolvido, sem ambiguidade de tema).
 */
export const CORES_PLANILHA = {
  fundo: '#FFFFFF',
  texto: '#404040',
  linha: '#BFBFBF',
  titulo: '#800000',
  mes: '#7E0024',
  cabecalho: '#7E0024',
  zebra: '#DDEBF7',
  secaoSemana: '#4A90A2',
  secaoSabado: '#BE8900',
  secaoFeriado: '#800000',
  barra: '#4D4D4D',
  sublinha: '#000000',
} as const

/** Iniciais de mês como o Excel formata "d-mmm" em português (ex.: 04/abr). */
export const MESES_ABBR = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const

export const TITULO_PADRAO = 'Programação para serviço de campo'
export const CONGREGACAO_PADRAO = 'Sua Congregação'
export const CITACAO = 'Mas que todas as coisas ocorram com decência e ordem - 1 Cor 14:40'

export function infoDia(idx: number): InfoDia {
  return DIAS_SEMANA[idx] ?? DIAS_SEMANA[0]
}

export function frequenciaDe(id: string | undefined): Frequencia {
  return FREQUENCIAS.find((f) => f.id === id) ?? FREQUENCIAS[0]
}

export function frequenciaValida(
  id: string | undefined,
  padrao: FrequenciaId = 'quinzenal',
): FrequenciaId {
  return FREQUENCIAS.some((f) => f.id === id) ? (id as FrequenciaId) : padrao
}
