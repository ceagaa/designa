import type { Estado, RegistroMes } from './dominio'
import { pertenceAoSetor } from './dominio'
import { chaveMes, lerChaveMes, ocorrenciasDoMes } from './datas'
import { registroDe } from './estadoInicial'
import { gerarEscala } from './rodizio'

/** Chave do mês seguinte ao informado. */
export function proximoMes(ano: number, mes: number): { ano: number; mes: number; chave: string } {
  const nMes = mes === 11 ? 0 : mes + 1
  const nAno = mes === 11 ? ano + 1 : ano
  return { ano: nAno, mes: nMes, chave: chaveMes(nAno, nMes) }
}

export interface OpcoesGeracao {
  /** Sobrescreve mesmo quando o mês já foi gerado (montagem manual). */
  forcar?: boolean
}

/**
 * Gera a escala do mês da chave analisando frequência, disponibilidade,
 * folga mínima e capacidade de cada dirigente (rodízio, não sorteio).
 * Preserva os ajustes manuais existentes. Idempotente sem `forcar`.
 * Retorna o mesmo estado quando nada foi gerado.
 */
export function gerarEscalaDoMes(estado: Estado, chave: string, { forcar = false }: OpcoesGeracao = {}): Estado {
  const registro = registroDe(estado.escalas, chave)
  if ((registro.geradoEm || registro.limpa) && !forcar) return estado

  const { ano, mes } = lerChaveMes(chave)
  const removidas = registro.removidas ?? {}
  const ocorrencias = ocorrenciasDoMes(
    ano,
    mes,
    estado.config_campos,
    estado.escalas._config,
  ).filter((ocorrencia) => !removidas[ocorrencia.key])
  const manuais = registro.manuais ?? {}
  const manuaisAjudante = registro.manuaisAjudante ?? {}

  const { auto, autoAjudante } = gerarEscala({
    // Só voluntários do Campo entram no rodízio; AVI e TPL têm escalas próprias.
    dirigentes: estado.dirigentes.filter((d) => pertenceAoSetor(d, 'CAMPO')),
    ocorrencias,
    manuais,
    manuaisAjudante,
    semente: chave,
    fixa: estado.escalas._config.designacao_fixa === true,
    regras: {
      evitarConsecutivos: estado.escalas._config.evitar_consecutivos,
      equilibrarFds: estado.escalas._config.equilibrar_fds,
      limiteMensal: estado.escalas._config.limite_mensal,
    },
  })

  const novoRegistro: RegistroMes = {
    auto,
    manuais,
    removidas,
    autoAjudante,
    manuaisAjudante,
    geradoEm: new Date().toISOString(),
    limpa: false,
  }

  return { ...estado, escalas: { ...estado.escalas, [chave]: novoRegistro } as Estado['escalas'] }
}
