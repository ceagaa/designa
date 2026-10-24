import type { CSSProperties, Ref } from 'react'
import type { LinhaTpl } from '../lib/tpl'
import { forwardRef } from 'react'
import { CITACAO, CORES, CORES_PLANILHA, MESES } from '../lib/constants'
import { isoDeHoje } from '../lib/datas'
import { TITULO_TPL, diaTexto } from '../lib/tpl'
import CabecalhoEscala from './CabecalhoEscala'

/** Data de hoje resolvida uma vez (oxlint: sem Date instável no render). */
const HOJE_ISO = isoDeHoje()

const borda: CSSProperties = { borderColor: CORES_PLANILHA.linha }

/**
 * Cartão do TPL para impressão/PDF: cabeçalho oficial da congregação e tabela
 * Data | Ponto | Turno | Dupla (mínimo 2 participantes por linha).
 */
const TplCard = forwardRef(function TplCard(
  { congregacao, mes, linhas, vazio }: {
    congregacao: string
    mes: number
    linhas: LinhaTpl[]
    vazio?: string
  },
  ref: Ref<HTMLDivElement>,
) {
  const mesRotulo = MESES[mes] ?? ''

  return (
    <div ref={ref} className="escala-card mx-auto w-[760px] bg-white">
      <CabecalhoEscala titulo={TITULO_TPL} congregacao={congregacao} mesRotulo={mesRotulo} />

      {!linhas.length ? (
        <div className="flex h-[120px] items-center justify-center px-6">
          <span className="text-center text-[16px] font-semibold">
            {vazio ?? 'Nenhuma escala publicada neste período.'}
          </span>
        </div>
      ) : (
        <table
          className="mt-2 w-full table-fixed border-collapse text-center text-[16px]"
          style={{ color: CORES_PLANILHA.texto }}
        >
          <colgroup>
            <col style={{ width: '24%' }} />
            <col style={{ width: '28%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '28%' }} />
          </colgroup>
          <tbody>
            <tr>
              <th scope="col" className="h-[40px] px-2 text-[15px] font-bold text-white" style={{ backgroundColor: CORES_PLANILHA.mes, ...borda }}>
                Dia
              </th>
              <th scope="col" className="h-[40px] px-2 text-[15px] font-bold text-white" style={{ backgroundColor: CORES_PLANILHA.mes, ...borda }}>
                Ponto de apoio
              </th>
              <th scope="col" className="h-[40px] px-2 text-[15px] font-bold text-white" style={{ backgroundColor: CORES_PLANILHA.mes, ...borda }}>
                Turno
              </th>
              <th scope="col" className="h-[40px] px-2 text-[15px] font-bold text-white" style={{ backgroundColor: CORES_PLANILHA.mes, ...borda }}>
                Dupla
              </th>
            </tr>

            {linhas.map((linha, i) => (
              <tr
                key={`${linha.iso}-${linha.ponto}-${linha.turno}`}
                style={{ backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F9FBFD' }}
              >
                <td className="h-[38px] px-2 font-bold" style={borda}>
                  {diaTexto(linha.diaSemana)} {linha.dia}
                  {linha.iso === HOJE_ISO ? (
                    <span className="ml-1" style={{ color: CORES_PLANILHA.mes }}>
                      (hoje)
                    </span>
                  ) : null}
                </td>
                <td className="h-[38px] px-2" style={borda}>
                  {linha.ponto}
                </td>
                <td className="h-[38px] px-2" style={borda}>
                  {linha.turno}
                </td>
                <td className="h-[38px] px-2 font-semibold" style={borda}>
                  {linha.dupla.length ? (
                    <span className="block break-words leading-snug">
                      {linha.dupla.join(' · ')}
                    </span>
                  ) : (
                    <span style={{ color: CORES_PLANILHA.mes }}>Sem dupla</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex h-[30px] items-center justify-end px-6">
        <p className="text-[12px] font-semibold" style={{ color: CORES_PLANILHA.texto }}>
          {congregacao}
        </p>
      </div>

      <div className="flex h-[35px] items-center justify-center px-6 pb-2">
        <p className="text-center text-[15px] font-bold" style={{ color: CORES.vinho }}>
          {CITACAO}
        </p>
      </div>
    </div>
  )
})

export default TplCard
