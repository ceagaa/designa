import type { CSSProperties, Ref } from 'react'
import type { DadosAvi, IrmaoProjecao, OcorrenciaAvi } from '../lib/dominio'
import { Fragment, forwardRef } from 'react'
import { CITACAO, CORES, CORES_PLANILHA, MESES, infoDia } from '../lib/constants'
import { isoDeHoje } from '../lib/datas'
import { FUNCOES_AVI } from '../lib/dominio'
import { TITULO_AVI, efetivasAvi, registroAviDe, slotAvi } from '../lib/avi'
import CabecalhoEscala from './CabecalhoEscala'

/** Data de hoje resolvida uma vez (oxlint: sem Date instável no render). */
const HOJE_ISO = isoDeHoje()

const linha: CSSProperties = { borderColor: CORES_PLANILHA.linha }

interface SecaoVisual {
  id: 'fds' | 'meio'
  rotulo: string
  cabecalho: string
  conteudo: string
}

const SECOES: readonly SecaoVisual[] = [
  {
    id: 'fds',
    rotulo: 'FIM DE SEMANA',
    cabecalho: CORES.petroleo,
    conteudo: CORES.conteudoFimDeSemana,
  },
  {
    id: 'meio',
    rotulo: 'MEIO DE SEMANA',
    cabecalho: CORES.vinho,
    conteudo: CORES.conteudoSemana,
  },
]

export interface AviCardProps {
  congregacao: string
  ano: number
  mes: number
  dados: DadosAvi
  irmoes: IrmaoProjecao[]
  /** Texto exibido quando o mês ainda não foi gerado. */
  vazio?: string
}

function reunioesDoMes(ano: number, mes: number, diaSemanaAlvo: number): OcorrenciaAvi[] {
  const totalDias = new Date(ano, mes + 1, 0).getDate()
  const lista: OcorrenciaAvi[] = []
  for (let dia = 1; dia <= totalDias; dia += 1) {
    const data = new Date(ano, mes, dia)
    if (data.getDay() !== diaSemanaAlvo) continue
    const iso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    lista.push({
      key: iso,
      iso,
      dia,
      diaSemana: diaSemanaAlvo,
      secao: diaSemanaAlvo === 0 ? 'fds' : 'meio',
    })
  }
  return lista
}

/**
 * Cartão do AVI fiel à aba "Audio/Vídeo & Indicadores" da planilha original:
 * seções de fim de semana (petróleo #045A6C / #F9FBFD) e meio de semana
 * (vinho #7E0024 / #FFF3F3), colunas das 5 funções e rodapé com a citação.
 */
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
  const meio = dados.diaSemanaMeio === 4 ? 4 : 3

  return (
    <div ref={ref} className="escala-card mx-auto w-[760px] bg-white">
      <CabecalhoEscala titulo={TITULO_AVI} congregacao={congregacao} mesRotulo={mesRotulo} />

      {!gerado ? (
        <div className="flex h-[120px] items-center justify-center px-6">
          <span className="text-center text-[16px] font-semibold">
            {vazio ?? 'Escala do mês ainda não gerada.'}
          </span>
        </div>
      ) : (
        SECOES.map((secao) => {
          const reunioes = reunioesDoMes(ano, mes, secao.id === 'fds' ? 0 : meio)
          return (
            <Fragment key={secao.id}>
              <div className="h-[8px]" aria-hidden="true" />
              <table
                className="w-full table-fixed border-collapse text-center text-[15px]"
                style={{ color: CORES_PLANILHA.texto }}
              >
                <colgroup>
                  <col style={{ width: '13%' }} />
                  {FUNCOES_AVI.map((f) => (
                    <col key={f.id} style={{ width: '17.4%' }} />
                  ))}
                </colgroup>
                <tbody>
                  <tr>
                    <th
                      colSpan={6}
                      scope="colgroup"
                      className="h-[30px] px-2 text-[14px] font-bold uppercase tracking-wide text-white"
                      style={{ backgroundColor: secao.cabecalho, ...linha }}
                    >
                      {secao.rotulo}
                    </th>
                  </tr>
                  <tr>
                    <th
                      scope="col"
                      className="h-[42px] px-1 text-[14px] font-bold text-white"
                      style={{ backgroundColor: secao.cabecalho, ...linha }}
                    >
                      Dia
                    </th>
                    {FUNCOES_AVI.map((f) => (
                      <th
                        key={f.id}
                        scope="col"
                        className="h-[42px] px-1 text-[13px] font-bold leading-tight text-white"
                        style={{ backgroundColor: secao.cabecalho, ...linha }}
                      >
                        {f.coluna}
                        {f.subtitulo ? (
                          <span className="block text-[11px] font-normal">{f.subtitulo}</span>
                        ) : null}
                      </th>
                    ))}
                  </tr>

                  {!reunioes.length ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="h-[46px] px-2 text-center text-[14px]"
                        style={{ backgroundColor: secao.conteudo, ...linha }}
                      >
                        Nenhuma reunião neste período.
                      </td>
                    </tr>
                  ) : (
                    reunioes.map((oc) => (
                      <tr key={oc.iso} style={{ backgroundColor: secao.conteudo }}>
                        <td className="h-[46px] px-1 align-middle" style={linha}>
                          <span className="block font-bold">{infoDia(oc.diaSemana).nome}</span>
                          <span className="block text-[13px] font-bold">
                            {oc.dia}
                            {oc.iso === HOJE_ISO ? (
                              <span className="ml-1" style={{ color: CORES_PLANILHA.mes }}>
                                (hoje)
                              </span>
                            ) : null}
                          </span>
                        </td>
                        {FUNCOES_AVI.map((f) => {
                          const id = efetivas[slotAvi(oc.iso, f.id)]
                          return (
                            <td key={f.id} className="h-[46px] px-1 align-middle" style={linha}>
                              <span className="block break-words leading-snug font-semibold">
                                {id ? (nomes.get(id) ?? '') : ''}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </Fragment>
          )
        })
      )}

      <div className="flex h-[35px] items-center justify-center px-6">
        <p className="text-[17px] font-bold" style={{ color: CORES.vinho }}>
          {CITACAO}
        </p>
      </div>
    </div>
  )
})

export default AviCard
