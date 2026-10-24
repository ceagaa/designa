import type { CSSProperties } from 'react'
import { CORES_PLANILHA } from '../lib/constants'

const CORES = CORES_PLANILHA
const borda: CSSProperties = { borderColor: CORES.linha }

/**
 * Cabeçalho fiel à planilha de referência: título em vinho + bloco do mês,
 * congregação centralizada e barra escura. Usado pelo cartão do Campo e do AVI.
 */
export default function CabecalhoEscala({
  titulo,
  congregacao,
  mesRotulo,
}: {
  titulo: string
  congregacao: string
  mesRotulo: string
}) {
  return (
    <>
      <div className="flex h-[43px] border-b border-l border-t" style={borda}>
        <div className="flex w-[81.4%] items-center justify-center overflow-hidden px-3">
          <span
            className="truncate text-[34px] font-bold leading-none"
            style={{ color: CORES.titulo }}
          >
            {titulo}
          </span>
        </div>
        <div
          className="flex w-[18.6%] items-center justify-center overflow-hidden"
          style={{ backgroundColor: CORES.mes }}
        >
          <span className="truncate px-1 text-[34px] font-bold leading-none text-white">
            {mesRotulo || '\u00a0'}
          </span>
        </div>
      </div>

      <div
        className="flex h-[27px] items-center justify-center overflow-hidden border-b border-l px-3"
        style={{ borderLeftColor: CORES.linha, borderBottomColor: CORES.sublinha }}
      >
        <span className="truncate text-[13px] font-bold" style={{ color: CORES.titulo }}>
          {congregacao}
        </span>
      </div>

      <div className="h-[4px]" style={{ backgroundColor: CORES.barra }} aria-hidden="true" />
    </>
  )
}
