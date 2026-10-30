import type { Campo, ConfigEscala, Ocorrencia } from './dominio'
import { MESES } from './constants'
import { ehFeriado, ehUltimoDomingo } from './feriados'

export function chaveMes(ano: number, mes: number): string {
  return `${ano}-${mes + 1}`
}

/**
 * Mês (`AAAA-M`) pedido na URL pública (`?mes=`). Devolve null quando ausente
 * ou inválido. Usado para o link compartilhado abrir exatamente o mês visível.
 */
export function mesDaUrl(): string | null {
  const valor = new URLSearchParams(window.location.search).get('mes')
  const casamento = valor?.match(/^(\d{4})-(\d{1,2})$/)
  if (!casamento) return null
  const ano = Number(casamento[1])
  const mes = Number(casamento[2])
  if (mes < 1 || mes > 12) return null
  return chaveMes(ano, mes - 1)
}

/** Data de hoje no formato ISO (YYYY-MM-DD). */
export function isoDeHoje(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Data ISO no formato curto "dd/mm". */
export function ddMm(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

export function lerChaveMes(chave: string): { ano: number; mes: number } {
  const [ano, mes] = String(chave).split('-').map(Number)
  return { ano, mes: (mes || 1) - 1 }
}

export function nomeMes(mes: number): string {
  return MESES[mes] ?? ''
}

/**
 * Gera as designações possíveis (data x campo) de um mês, em ordem cronológica.
 * Domingos entram apenas no último do mês ou quando é feriado.
 * Com `config.ajustar_feriados`, os feriados passam a usar `config.horario_feriado`.
 */
export function ocorrenciasDoMes(
  ano: number,
  mes: number,
  campos: Campo[],
  config?: Pick<ConfigEscala, 'ajustar_feriados' | 'horario_feriado'> | null,
): Ocorrencia[] {
  const totalDias = new Date(ano, mes + 1, 0).getDate()
  const lista: Ocorrencia[] = []
  const horarioFeriado = config?.ajustar_feriados ? (config.horario_feriado ?? '') : ''

  for (let dia = 1; dia <= totalDias; dia += 1) {
    const data = new Date(ano, mes, dia)
    const diaSemana = data.getDay()
    const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    const feriado = ehFeriado(iso)
    const ultimoDomingo = diaSemana === 0 && ehUltimoDomingo(iso)

    if (diaSemana === 0 && !feriado && !ultimoDomingo) continue

    const doCampo = campos.filter((c) => Number(c.diaSemana) === diaSemana)
    const horario = feriado && horarioFeriado ? horarioFeriado : null

    for (const campo of doCampo) {
      lista.push({
        key: `${iso}_${campo.id}`,
        data,
        iso,
        dia,
        diaSemana,
        campo: horario ? { ...campo, horario } : campo,
        feriado,
        ultimoDomingo,
      })
    }
  }

  return lista.sort((a, b) => {
    if (a.data.getTime() - b.data.getTime() !== 0) return a.data.getTime() - b.data.getTime()
    return String(a.campo.horario).localeCompare(String(b.campo.horario))
  })
}
