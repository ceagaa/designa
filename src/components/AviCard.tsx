import type { CSSProperties, Ref } from 'react'
import type { DadosAvi, IrmaoProjecao } from '../lib/dominio'
import { Fragment, forwardRef } from 'react'
import { CITACAO, CORES_PLANILHA, MESES, infoDia } from '../lib/constants'
import { isoDeHoje } from '../lib/datas'
import { FUNCOES_AVI } from '../lib/dominio'
import { TITULO_AVI, efetivasAvi, ocorrenciasAvi, registroAviDe, slotAvi } from '../lib/avi'
import CabecalhoEscala from './CabecalhoEscala'

/** Data de hoje resolvida uma vez (oxlint: sem Date instável no render). */
const HOJE_ISO = isoDeHoje()

const CORES = CORES_PLANILHA
const borda: CSSProperties = { borderColor: CORES.linha }
const coluna: CSSProperties = { backgroundColor: CORES.fundo, color: CORES.cabecalho, ...borda }
const celula: CSSProperties = { backgroundColor: CORES.fundo, color: CORES.texto, ...borda }

/**
 * Tabela do AVI fiel à aba "Audio/Vídeo & Indicadores" da planilha base:
 * uma tabela única em ordem cronológica (sem faixas de fim/meio de semana),
 * cabeçalho "Dia" + funções, célula do dia em duas linhas (nome / número)
 * com os nomes mesclados verticalmente e uma linha espaçadora entre as
 * reuniões. O rodapé traz a citação, como no Campo.
 */
export interface AviCardProps {
  congregacao: string
  ano: number
  mes: number
  dados: DadosAvi
  irmoes: IrmaoProjecao[]
  /** Texto exibido quando o mês ainda não foi gerado. */
  vazio?: string
}

const TOTAL_COLUNAS = FUNCOES_AVI.length + 1
/** Largura da coluna "Dia" (A+B mescladas na planilha: 181px de ~1493px). */
const LARGURA_DIA = '14.5%'
const LARGURA_FUNCAO = `${(100 - 14.5) / FUNCOES_AVI.length}%`

const AviCard = forwardRef(function AviCard(
  { congregacao, ano, mes, dados, irmoes, vazio }: AviCardProps,
  ref: Ref<HTMLDivElement>,
) {
  const chave = `${ano}-${mes + 1}`
  const registro = registroAviDe(dados, chave)
  const gerado = Boolean(registro.geradoEm)
  const nomes = new Map(irmoes.map((i) => [i.id, i.nome]))
  const efetivas = efetivasAvi(registro)
  const mesRotulo = MESES[mes] ?? ''
  const reunioes = ocorrenciasAvi(ano, mes, dados.diasReuniao)

  return (
    <div ref={ref} className="escala-card mx-auto w-[760px] bg-white">
      <CabecalhoEscala titulo={TITULO_AVI} congregacao={congregacao} mesRotulo={mesRotulo} />

      <table
        className="w-full table-fixed border-collapse text-center text-[15px]"
        style={{ color: CORES.texto }}
      >
        <colgroup>
          <col style={{ width: LARGURA_DIA }} />
          {FUNCOES_AVI.map((f) => (
            <col key={f.id} style={{ width: LARGURA_FUNCAO }} />
          ))}
        </colgroup>
        <tbody>
          <tr>
            <th
              scope="col"
              className="h-[38px] px-1 font-bold"
              style={coluna}
            >
              Dia
            </th>
            {FUNCOES_AVI.map((f) => (
              <th
                key={f.id}
                scope="col"
                className="h-[38px] px-1 font-bold leading-tight"
                style={coluna}
              >
                {f.coluna}
                {f.subtitulo ? (
                  <span className="block text-[11px] font-normal">{f.subtitulo}</span>
                ) : null}
              </th>
            ))}
          </tr>

          {!gerado || !reunioes.length ? (
            <tr>
              <td
                colSpan={TOTAL_COLUNAS}
                className="h-[120px] px-6 text-center text-[15px] font-semibold"
                style={celula}
              >
                {gerado
                  ? 'Nenhuma reunião AVI neste mês.'
                  : (vazio ?? 'Escala do mês ainda não gerada.')}
              </td>
            </tr>
          ) : (
            reunioes.map((oc) => {
              const ehHoje = oc.iso === HOJE_ISO
              return (
                <Fragment key={oc.iso}>
                  {/* Linha 1: nome do dia (mesclado) + nomes designados. */}
                  <tr style={{ backgroundColor: CORES.fundo }}>
                    <td
                      rowSpan={2}
                      colSpan={2}
                      className="h-[43px] px-1 align-middle font-bold"
                      style={celula}
                    >
                      {infoDia(oc.diaSemana).nome}
                    </td>
                    {FUNCOES_AVI.map((f) => {
                      const id = efetivas[slotAvi(oc.iso, f.id)]
                      return (
                        <td
                          key={f.id}
                          rowSpan={2}
                          className="h-[43px] px-1 align-middle font-semibold"
                          style={celula}
                        >
                          <span className="block break-words leading-snug">
                            {id ? (nomes.get(id) ?? '') : ''}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                  {/* Linha 2: número do dia. */}
                  <tr style={{ backgroundColor: CORES.fundo }}>
                    <td
                      colSpan={2}
                      className="h-[43px] px-1 align-middle font-bold"
                      style={celula}
                    >
                      {oc.dia}
                      {ehHoje ? (
                        <span className="ml-1" style={{ color: CORES.mes }}>
                          (hoje)
                        </span>
                      ) : null}
                    </td>
                  </tr>
                  {/* Linha espaçadora entre reuniões (36px na planilha). */}
                  <tr aria-hidden="true">
                    <td
                      colSpan={TOTAL_COLUNAS}
                      className="p-0"
                      style={{ border: 'none', backgroundColor: CORES.fundo, height: 36 }}
                    />
                  </tr>
                </Fragment>
              )
            })
          )}
        </tbody>
      </table>

      <div className="flex h-[35px] items-center justify-center px-6">
        <p className="text-[19px] font-bold" style={{ color: CORES.titulo }}>
          {CITACAO}
        </p>
      </div>
    </div>
  )
})

export default AviCard
