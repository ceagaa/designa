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
  // Títulos longos (personalizados) reduzem a fonte para não cortar na largura.
  const tamTitulo = titulo.length > 38 ? 24 : titulo.length > 30 ? 28 : 34
  return (
    <>
      <div className="flex h-[56px] border-b border-l border-t" style={borda}>
        <div className="flex w-[81.4%] items-center justify-center overflow-hidden px-3">
          <span
            className="whitespace-nowrap font-bold leading-normal"
            style={{ color: CORES.titulo, fontSize: tamTitulo }}
          >
            {titulo}
          </span>
        </div>
        <div
          className="flex w-[18.6%] items-center justify-center overflow-hidden"
          style={{ backgroundColor: CORES.mes }}
        >
          <span className="whitespace-nowrap px-1.5 text-[26px] font-bold leading-normal text-white">
            {mesRotulo || '\u00a0'}
          </span>
        </div>
      </div>

      <div
        className="flex h-[29px] items-center justify-center overflow-hidden border-b border-l px-3"
        style={{ borderLeftColor: CORES.linha, borderBottomColor: CORES.sublinha }}
      >
        <span className="whitespace-nowrap text-[13px] font-bold leading-normal" style={{ color: CORES.titulo }}>
          {congregacao}
        </span>
      </div>

      <div className="h-[4px]" style={{ backgroundColor: CORES.barra }} aria-hidden="true" />
    </>
  )
}
