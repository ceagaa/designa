import type {
  Campo,
  Dirigente,
  Estado,
  Escalas,
  RegrasPorDepartamento,
  RegistroMes,
} from './dominio'
import { CONGREGACAO_PADRAO, TITULO_PADRAO, frequenciaValida } from './constants'
import { REGRAS_PADRAO, SETORES } from './dominio'

export const CHAVE_LOCAL = 'dirigentes:estado:v1'

/**
 * Estado padrão: vazio, com apenas a configuração inicial. A produção nunca
 * mostra dados de demonstração, o cadastro novo nasce limpo.
 */
export function estadoInicial(): Estado {
  return {
    dirigentes: [],
    config_campos: [],
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

/** Estado de uma congregação nova: sem demonstração, com o nome dela no cabeçalho. */
export function estadoVazio(congregacao: string): Estado {
  const base = estadoInicial()
  return {
    dirigentes: [],
    config_campos: [],
    escalas: {
      ...base.escalas,
      _config: { ...base.escalas._config, congregacao },
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
    removidas: registro.removidas ?? {},
    autoAjudante: registro.autoAjudante ?? {},
    manuaisAjudante: registro.manuaisAjudante ?? {},
    geradoEm: registro.geradoEm,
    limpa: registro.limpa === true,
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

  const normalizarRegras = (bruto: unknown): RegrasPorDepartamento | undefined => {
    if (!bruto || typeof bruto !== 'object') return undefined
    const dados = bruto as Record<string, unknown>
    const saida: RegrasPorDepartamento = {}
    for (const setor of ['CAMPO', 'AUDIO_VIDEO'] as const) {
      const valor = dados[setor]
      if (!valor || typeof valor !== 'object') continue
      const regra = valor as { frequencia?: unknown; limiteMensal?: unknown }
      const padrao = REGRAS_PADRAO[setor]
      saida[setor] = {
        frequencia: frequenciaValida(
          typeof regra.frequencia === 'string' ? regra.frequencia : undefined,
          padrao.frequencia,
        ),
        limiteMensal:
          regra.limiteMensal === 1 ||
          regra.limiteMensal === 2 ||
          regra.limiteMensal === 3
            ? regra.limiteMensal
            : padrao.limiteMensal,
      }
    }
    return Object.keys(saida).length ? saida : undefined
  }

  const normalizarDirigentes = (lista: Dirigente[]): Dirigente[] =>
    lista.map((d) => ({
      ...d,
      limiteMensal:
        d.limiteMensal === 2 || d.limiteMensal === 3 ? d.limiteMensal : 1,
      regrasDepartamento: normalizarRegras(d.regrasDepartamento),
      // Fichas novas podem ter vários departamentos; fichas antigas seguem com um.
      departamentos: Array.isArray(d.departamentos)
        ? [...new Set(d.departamentos.filter((s) => SETORES.includes(s)))]
        : undefined,
      // Registros antigos ficam sem departamento e são tratados como Campo.
      departamento:
        d.departamento === 'CAMPO' ||
        d.departamento === 'AUDIO_VIDEO' ||
        d.departamento === 'TPL'
          ? d.departamento
          : undefined,
      reunioes:
        d.reunioes === 'semana' || d.reunioes === 'fds' ? d.reunioes : 'ambos',
    }))

  return {
    dirigentes: Array.isArray(dados.dirigentes)
      ? normalizarDirigentes(dados.dirigentes)
      : base.dirigentes,
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
