import { useEffect, useState } from 'react'
import { Loader2, RefreshCcw } from 'lucide-react'
import { Botao } from './ui'
import TelaVer from './TelaVer'

type Estado = 'carregando' | 'pronto' | 'erro'

/**
 * Rota pública /escala/:slug/CAMPO — visão somente leitura da programação,
 * com "Próximos dias" (mesmos cards do administrador).
 */
export default function TelaEscalaPublica({ slug }: { slug: string }) {
  const [estado, setEstado] = useState<Estado>('carregando')
  const [payload, setPayload] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let vivo = true
    fetch(`/api/escala/publico/${encodeURIComponent(slug)}/CAMPO`)
      .then(async (resposta) => {
        if (!vivo) return
        if (!resposta.ok) {
          setEstado('erro')
          return
        }
        const corpo = (await resposta.json()) as { payload?: unknown }
        if (typeof corpo.payload !== 'string' || !corpo.payload) {
          setEstado('erro')
          return
        }
        setPayload(corpo.payload)
        setEstado('pronto')
      })
      .catch(() => {
        if (vivo) setEstado('erro')
      })
    return () => {
      vivo = false
    }
  }, [slug, tentativa])

  if (estado === 'pronto' && payload) {
    return <TelaVer payload={payload} />
  }

  if (estado === 'erro') {
    return (
      <div className="mx-auto flex min-h-svh max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-bold text-ink">Escala não encontrada</h1>
        <p className="text-sm text-muted">
          Este link não corresponde a nenhuma congregação. Peça um novo link à pessoa que publicou.
        </p>
        <div className="flex gap-2">
          <Botao
            variante="secundario"
            onClick={() => {
              setEstado('carregando')
              setTentativa((t) => t + 1)
            }}
          >
            <RefreshCcw className="size-4" aria-hidden="true" />
            Tentar de novo
          </Botao>
        </div>
      </div>
    )
  }

  return (
    <p className="flex min-h-svh items-center justify-center gap-2 text-sm text-muted">
      <Loader2 className="size-4 animate-spin text-teal" aria-hidden="true" />
      Carregando escala…
    </p>
  )
}
