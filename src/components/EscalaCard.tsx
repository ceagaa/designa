import type { CSSProperties, Ref } from 'react'
import type { ConfigEscala, Dirigente, Ocorrencia } from '../lib/dominio'
import { Fragment, forwardRef } from 'react'
import { CITACAO, CORES_PLANILHA, MESES, MESES_ABBR, infoDia } from '../lib/constants'
import { isoDeHoje } from '../lib/datas'
import { candidatosAjudantePara, candidatosPara } from '../lib/rodizio'
import CabecalhoEscala from './CabecalhoEscala'

/** Data de hoje resolvida uma vez (oxlint: sem Date instável no render). */
const HOJE_ISO = isoDeHoje()

const CORES = CORES_PLANILHA
const borda: CSSProperties = { borderColor: CORES.linha }
const celula: CSSProperties = { backgroundColor: CORES.fundo, color: CORES.texto, ...borda }
const coluna: CSSProperties = { backgroundColor: CORES.fundo, color: CORES.cabecalho, ...borda }

/**
 * Coluna "Dia" no formato de cada seção da planilha base:
 * "04/abr" no sábado, "03/04 (Feriado)" / "26/04 (Domingo)" nos feriados.
 * Os dias fixos da semana são agrupados e usam só o nome (ex.: "Segunda").
 */
function rotuloDiaNaoSemana(oc: Ocorrencia, bloco: string): string {
  const dd = oc.iso.slice(8, 10)
  const mm = oc.iso.slice(5, 7)
  if (bloco === 'FERIADOS E ÚLTIMO DOMINGO') {
    if (oc.feriado) return `${dd}/${mm} (Feriado)`
    if (oc.ultimoDomingo) return `${dd}/${mm} (Domingo)`
    return `${dd}/${mm}`
  }
  return `${dd}/${MESES_ABBR[Number(mm) - 1] ?? mm}`
}

function corSecao(rotulo: string): string {
  if (rotulo === 'SÁBADO') return CORES.secaoSabado
  if (rotulo === 'FERIADOS E ÚLTIMO DOMINGO') return CORES.secaoFeriado
  return CORES.secaoSemana
}

interface Bloco {
  rotulo: string
  itens: Ocorrencia[]
}

/** Uma linha da tabela: no mínimo uma ocorrência (agrupada nos dias fixos). */
interface Linha {
  ocs: Ocorrencia[]
  rotulo: string
}

function agrupar(ocorrencias: Ocorrencia[]): Bloco[] {
  const emSemana = (oc: Ocorrencia) => oc.diaSemana >= 1 && oc.diaSemana <= 5 && !oc.feriado
  const definicoes: Array<{ rotulo: string; teste: (oc: Ocorrencia) => boolean }> = [
    {
      rotulo: 'SEMANA MANHÃ',
      teste: (oc) => emSemana(oc) && String(oc.campo.horario) < '12:00',
    },
    {
      rotulo: 'SEMANA TARDE',
      teste: (oc) =>
        emSemana(oc) &&
        String(oc.campo.horario) >= '12:00' &&
        String(oc.campo.horario) < '18:00',
    },
    { rotulo: 'SEMANA NOITE', teste: (oc) => emSemana(oc) && String(oc.campo.horario) >= '18:00' },
    { rotulo: 'SÁBADO', teste: (oc) => oc.diaSemana === 6 && !oc.feriado },
    {
      rotulo: 'FERIADOS E ÚLTIMO DOMINGO',
      teste: (oc) => Boolean(oc.feriado || oc.ultimoDomingo),
    },
  ]

  return definicoes
    .map((d) => ({ rotulo: d.rotulo, itens: ocorrencias.filter(d.teste) }))
    .filter((b) => b.itens.length > 0)
}

function ddMm(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

/** Valores exibidos por chave: nomes prontos no link, IDs efetivos na edição. */
interface ContextoLinhas {
  dirigenteDe: (chave: string) => string
  ajudanteDe: (chave: string) => string
  /** Dia com "Quem dirige" fixo (designação fixa ligada): candidato a linha única. */
  fixoDoDia: (oc: Ocorrencia) => boolean
}

/**
 * Linhas de um bloco SEMANA: dias FIXOS (designação fixa + "Quem dirige" com
 * dirigente e ajudante idênticos em todas as datas) viram UMA linha só com o
 * nome do dia ("Segunda"). Dias NÃO fixos se REPETEM, uma linha por data com
 * data no rótulo ("Quinta 01/10", "Quinta 08/10"...). Domingo entra apenas no
 * último do mês; sábado e feriados seguem sempre linha a linha.
 */
function linhasDoBloco(bloco: Bloco, ctx: ContextoLinhas): Linha[] {
  const ehSemana = bloco.rotulo.startsWith('SEMANA')
  if (!ehSemana) {
    return bloco.itens.map((oc) => ({ ocs: [oc], rotulo: rotuloDiaNaoSemana(oc, bloco.rotulo) }))
  }

  const clusters = new Map<string, Ocorrencia[]>()
  for (const oc of bloco.itens) {
    const chave = `${oc.diaSemana}|${oc.campo.horario}|${oc.campo.local}`
    const lista = clusters.get(chave)
    if (lista) lista.push(oc)
    else clusters.set(chave, [oc])
  }

  const linhas: Linha[] = []
  for (const ocs of clusters.values()) {
    const base = ocs[0]
    const nome = infoDia(base.diaSemana).nome.replace('-Feira', '')
    const repetem = ocs.every(
      (oc) =>
        ctx.dirigenteDe(oc.key) === ctx.dirigenteDe(base.key) &&
        ctx.ajudanteDe(oc.key) === ctx.ajudanteDe(base.key),
    )
    if (repetem && ocs.length > 1 && ctx.fixoDoDia(base)) {
      linhas.push({ ocs, rotulo: nome })
    } else {
      for (const oc of ocs) linhas.push({ ocs: [oc], rotulo: `${nome} ${ddMm(oc.iso)}` })
    }
  }

  // Ordem da semana (Segunda, Terça, Quarta...) e, dentro do dia, por data.
  return linhas.sort((a, b) => {
    const dia = a.ocs[0].diaSemana - b.ocs[0].diaSemana
    if (dia !== 0) return dia
    const horario = a.ocs[0].campo.horario.localeCompare(b.ocs[0].campo.horario)
    if (horario !== 0) return horario
    return a.ocs[0].iso.localeCompare(b.ocs[0].iso)
  })
}

function distintos(valores: Array<string | undefined | null>): string[] {
  return [...new Set(valores.filter((v): v is string => Boolean(v)))]
}

export interface EscalaCardProps {
  config: ConfigEscala
  ocorrencias: Ocorrencia[]
  dirigentes: Dirigente[]
  designacoes: Record<string, string>
  manuais?: Record<string, string>
  /** Ajudantes efetivos (automáticos + manuais). */
  ajudantes?: Record<string, string>
  manuaisAjudante?: Record<string, string>
  aoAlterarDesignacao?: (chaves: string[], idDirigente: string) => void
  aoAlterarAjudante?: (chaves: string[], idDirigente: string) => void
  somenteLeitura?: boolean
  nomes?: Record<string, string> | null
}

const EscalaCard = forwardRef(function EscalaCard(
  {
    config,
    ocorrencias,
    dirigentes,
    designacoes,
    manuais = {},
    ajudantes = {},
    manuaisAjudante = {},
    aoAlterarDesignacao,
    aoAlterarAjudante,
    somenteLeitura = false,
    nomes = null,
  }: EscalaCardProps,
  ref: Ref<HTMLDivElement>,
) {
  const blocos = agrupar(ocorrencias)
  const primeiroIso = ocorrencias[0]?.iso ?? ''
  const mesRotulo = primeiroIso ? MESES[Number(primeiroIso.slice(5, 7)) - 1] ?? '' : ''

  function nomeDeId(id: string): string | undefined {
    return dirigentes.find((d) => d.id === id)?.nome
  }

  const ctxLinhas: ContextoLinhas = {
    dirigenteDe: (chave) => (nomes ? (nomes[chave] ?? '') : (designacoes[chave] ?? '')),
    ajudanteDe: (chave) => ajudantes[chave] ?? '',
    fixoDoDia: (oc) => config.designacao_fixa === true && Boolean(oc.campo.fixo),
  }

  return (
    <div ref={ref} className="escala-card mx-auto w-[760px] bg-white">
      <CabecalhoEscala
        titulo={config.titulo}
        congregacao={config.congregacao}
        mesRotulo={mesRotulo}
      />

      <table
        className="w-full table-fixed border-collapse text-center text-[19px]"
        style={{ color: CORES.texto }}
      >
        <colgroup>
          <col style={{ width: '26.02%' }} />
          <col style={{ width: '16.79%' }} />
          <col style={{ width: '18.35%' }} />
          <col style={{ width: '20.27%' }} />
          <col style={{ width: '18.60%' }} />
        </colgroup>
        <tbody>
          {!ocorrencias.length ? (
            <tr>
              <td colSpan={5} className="h-[120px] text-center" style={celula}>
                <span className="font-semibold">Nenhum dia de campo neste mês.</span>
              </td>
            </tr>
          ) : (
            blocos.map((bloco, bi) => (
              <Fragment key={bloco.rotulo}>
                <tr>
                  <th
                    colSpan={5}
                    scope="colgroup"
                    className="h-[34px] px-2 text-[17px] font-bold text-white"
                    style={{ backgroundColor: corSecao(bloco.rotulo), ...borda }}
                  >
                    {bloco.rotulo}
                  </th>
                </tr>
                <tr>
                  <th scope="col" className="h-[41px] font-bold" style={coluna}>
                    Dia
                  </th>
                  <th scope="col" className="h-[41px] font-bold" style={coluna}>
                    Horário
                  </th>
                  <th scope="col" className="h-[41px] font-bold" style={coluna}>
                    Local
                  </th>
                  <th scope="col" className="h-[41px] font-bold" style={coluna}>
                    Dirigente
                  </th>
                  <th scope="col" className="h-[41px] font-bold" style={coluna}>
                    Ajudante
                  </th>
                </tr>

                {linhasDoBloco(bloco, ctxLinhas).map((linha, i) => {
                  const chaves = linha.ocs.map((oc) => oc.key)
                  const chave0 = chaves[0]
                  const primaria = linha.ocs[0]

                  const ids = chaves.map((k) => designacoes[k] ?? '')
                  const primeiroId = ids[0]
                  const manual = chaves.some((k) => Boolean(manuais[k]))
                  const texto = nomes
                    ? distintos(chaves.map((k) => nomes[k])).join(' · ') || 'Sem designação'
                    : distintos(ids.map(nomeDeId)).join(' · ') || 'Sem designação'
                  const candidatos = candidatosPara(primaria, dirigentes)

                  const idsAju = chaves.map((k) => ajudantes[k] ?? '')
                  const primeiroAju = idsAju[0]
                  const manualAju = chaves.some((k) => Boolean(manuaisAjudante[k]))
                  const textoAju = nomes
                    ? ''
                    : distintos(idsAju.map(nomeDeId)).join(' · ')
                  const candidatosAju = candidatosAjudantePara(primaria, dirigentes)
                  const ehHoje = linha.ocs.some((oc) => oc.iso === HOJE_ISO)

                  return (
                    <tr
                      key={chave0}
                      style={{ backgroundColor: i % 2 === 0 ? CORES.zebra : CORES.fundo }}
                    >
                      <td className="h-[43px] px-1 font-bold">
                        {linha.rotulo}
                        {ehHoje ? (
                          <span className="ml-1 font-bold" style={{ color: CORES_PLANILHA.mes }}>
                            (hoje)
                          </span>
                        ) : null}
                      </td>
                      <td className="h-[43px] px-1 font-normal">{primaria.campo.horario}</td>
                      <td className="h-[43px] px-1 font-normal">{primaria.campo.local}</td>
                      <td className="h-[43px] px-1 font-bold">
                        <span className="flex flex-wrap items-center justify-center gap-1.5">
                          {manual ? (
                            <span
                              className="marcador-manual size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: CORES.texto }}
                              title="Ajustada manualmente"
                              aria-hidden="true"
                            />
                          ) : null}
                          {somenteLeitura ? (
                            <span className="break-words leading-snug">{texto}</span>
                          ) : (
                            <>
                              <select
                                id={`dirigente-${chave0}`}
                                aria-label={`Dirigente designado para ${linha.rotulo}`}
                                className="selecao-dirigente w-full cursor-pointer appearance-none border-0 bg-transparent px-1 py-1 text-center font-bold outline-none hover:bg-white/50"
                                style={{ color: CORES.texto }}
                                value={primeiroId}
                                onChange={(e) => aoAlterarDesignacao?.(chaves, e.target.value)}
                              >
                                <option value="">— Sem designação —</option>
                                {candidatos.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.nome}
                                    {c.disponivel ? '' : ' (indisponível)'}
                                  </option>
                                ))}
                              </select>
                              <span className="rotulo-dirigente" aria-hidden="true">
                                {texto}
                              </span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="h-[43px] px-1 font-bold">
                        <span className="flex flex-wrap items-center justify-center gap-1.5">
                          {manualAju ? (
                            <span
                              className="marcador-manual size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: CORES.texto }}
                              title="Ajudante ajustada manualmente"
                              aria-hidden="true"
                            />
                          ) : null}
                          {somenteLeitura ? (
                            <span className="break-words leading-snug">
                              {textoAju || '\u00a0'}
                            </span>
                          ) : (
                            <>
                              <select
                                id={`ajudante-${chave0}`}
                                aria-label={`Ajudante de ${linha.rotulo}`}
                                className="selecao-dirigente w-full cursor-pointer appearance-none border-0 bg-transparent px-1 py-1 text-center font-bold outline-none hover:bg-white/50"
                                style={{ color: CORES.texto }}
                                value={primeiroAju}
                                onChange={(e) => aoAlterarAjudante?.(chaves, e.target.value)}
                              >
                                <option value="">— Sem ajudante —</option>
                                {candidatosAju.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.nome}
                                    {c.disponivel ? '' : ' (indisponível)'}
                                  </option>
                                ))}
                              </select>
                              <span className="rotulo-dirigente" aria-hidden="true">
                                {textoAju}
                              </span>
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  )
                })}

                <tr aria-hidden="true">
                  <td
                    colSpan={5}
                    className="p-0"
                    style={{
                      border: 'none',
                      backgroundColor: CORES.fundo,
                      height: bi === blocos.length - 1 ? 19 : 14,
                    }}
                  />
                </tr>
              </Fragment>
            ))
          )}
        </tbody>
      </table>

      <div className="flex h-[35px] items-center justify-center px-6">
        <p className="text-[19px] font-bold" style={{ color: CORES.cabecalho }}>
          {CITACAO}
        </p>
      </div>
    </div>
  )
})

export default EscalaCard
