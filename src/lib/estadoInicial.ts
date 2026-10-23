import type { Campo, Dirigente, Estado, Escalas, RegistroMes } from './dominio'
import { CONGREGACAO_PADRAO, TITULO_PADRAO, frequenciaValida } from './constants'

export const ID_REGISTRO = 'default_config'
export const CHAVE_LOCAL = 'dirigentes:estado:v1'

export function estadoInicial(): Estado {
  return {
    dirigentes: [
      {
        id: 'dir-1',
        nome: 'Carlos Andrade',
        telefone: '(11) 99911-2233',
        ativo: true,
        frequencia: 'semanal',
        dias: [0, 3],
        horarios: ['09:00', '18:30'],
      },
      {
        id: 'dir-2',
        nome: 'Marcos Lima',
        telefone: '(11) 98844-5566',
        ativo: true,
        frequencia: 'quinzenal',
        dias: [0, 4, 6],
        horarios: ['09:00', '18:30'],
        ajudante: true,
        diasAjudante: [3, 4],
      },
      {
        id: 'dir-3',
        nome: 'João Pedro',
        telefone: '',
        ativo: true,
        frequencia: 'quinzenal',
        dias: [3, 4],
        horarios: ['18:30'],
      },
      {
        id: 'dir-4',
        nome: 'Rafael Souza',
        telefone: '(11) 97733-8899',
        ativo: true,
        frequencia: 'mensal',
        dias: [0, 3, 4],
        horarios: ['09:00', '18:30'],
        ajudante: true,
        diasAjudante: [4],
      },
      {
        id: 'dir-5',
        nome: 'Paulo Mendes',
        telefone: '',
        ativo: true,
        frequencia: 'mensal',
        dias: [0, 6],
        horarios: ['09:00'],
        ajudante: true,
        diasAjudante: [0],
      },
      {
        id: 'dir-6',
        nome: 'André Oliveira',
        telefone: '(11) 96622-1100',
        ativo: false,
        frequencia: 'bimestral',
        dias: [3],
        horarios: ['18:30'],
      },
    ],
    config_campos: [
      {
        id: 'campo-1',
        diaSemana: 0,
        horario: '09:00',
        local: 'Esquina da Praça Central',
        fixo: null,
      },
      {
        id: 'campo-2',
        diaSemana: 3,
        horario: '18:30',
        local: 'Terminal Rodoviário',
        fixo: null,
      },
      {
        id: 'campo-3',
        diaSemana: 4,
        horario: '18:30',
        local: 'Feira Livre - Av. Brasil',
        fixo: null,
      },
    ],
    escalas: {
      _config: {
        titulo: TITULO_PADRAO,
        congregacao: CONGREGACAO_PADRAO,
        designacao_fixa: false,
        frequencia_padrao: 'quinzenal',
        evitar_consecutivos: true,
        equilibrar_fds: true,
        limite_mensal: 3,
        ajustar_feriados: false,
        horario_feriado: '08:00',
        disparo_dia: 20,
        disparo_hora: '00:00',
      },
    },
  }
}

/** Lê o registro do mês a partir das escalas, garantindo o formato mínimo. */
export function registroDe(escalas: Escalas, chave: string): RegistroMes {
  const bruto = escalas[chave]
  if (!bruto || typeof bruto !== 'object') return { auto: {}, manuais: {} }
  const registro = bruto as RegistroMes
  return {
    auto: registro.auto ?? {},
    manuais: registro.manuais ?? {},
    autoAjudante: registro.autoAjudante ?? {},
    manuaisAjudante: registro.manuaisAjudante ?? {},
    geradoEm: registro.geradoEm,
  }
}

interface BrutoEstado {
  dirigentes?: Dirigente[]
  config_campos?: Campo[]
  escalas?: Escalas
  [chave: string]: unknown
}

/** Normaliza qualquer estado vindo do banco/local preservando o formato mínimo. */
export function normalizarEstado(bruto: unknown): Estado {
  const base = estadoInicial()
  if (!bruto || typeof bruto !== 'object') return base

  const dados = bruto as BrutoEstado
  const config = dados.escalas?._config ?? ({} as Partial<Escalas['_config']>)

  const limiteBruto = config.limite_mensal
  const limiteMensal =
    typeof limiteBruto === 'number' && Number.isFinite(limiteBruto) && limiteBruto >= 0
      ? Math.floor(limiteBruto)
      : 3

  const horarioFeriado =
    typeof config.horario_feriado === 'string' && /^\d{2}:\d{2}$/.test(config.horario_feriado)
      ? config.horario_feriado
      : '08:00'

  const disparoDiaBruto = config.disparo_dia
  const disparoDia =
    typeof disparoDiaBruto === 'number' && Number.isFinite(disparoDiaBruto)
      ? Math.min(31, Math.max(1, Math.floor(disparoDiaBruto)))
      : 20

  const disparoHora =
    typeof config.disparo_hora === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(config.disparo_hora)
      ? config.disparo_hora
      : '00:00'

  const normalizarCampos = (lista: Campo[]): Campo[] =>
    lista.map((c) => ({
      ...c,
      diaSemana: Number(c.diaSemana),
      fixo: c.fixo || null,
      ajudanteFixo: c.ajudanteFixo || null,
    }))

  return {
    dirigentes: Array.isArray(dados.dirigentes) ? dados.dirigentes : base.dirigentes,
    config_campos: Array.isArray(dados.config_campos)
      ? normalizarCampos(dados.config_campos)
      : base.config_campos,
    escalas: {
      ...(dados.escalas && typeof dados.escalas === 'object' ? dados.escalas : {}),
      _config: {
        titulo: config.titulo || TITULO_PADRAO,
        congregacao: config.congregacao || CONGREGACAO_PADRAO,
        designacao_fixa: config.designacao_fixa === true,
        frequencia_padrao: frequenciaValida(config.frequencia_padrao),
        evitar_consecutivos: config.evitar_consecutivos !== false,
        equilibrar_fds: config.equilibrar_fds !== false,
        limite_mensal: limiteMensal,
        ajustar_feriados: config.ajustar_feriados === true,
        horario_feriado: horarioFeriado,
        disparo_dia: disparoDia,
        disparo_hora: disparoHora,
      },
    },
  }
}
