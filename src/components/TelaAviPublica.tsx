import type { DadosAvi } from '../lib/dominio'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FileDown, Link2, Loader2, Radio, RefreshCcw } from 'lucide-react'
import { TITULO_AVI, normalizarDadosAvi } from '../lib/avi'
import { lerChaveMes, nomeMes } from '../lib/datas'
import { baixarPdf } from '../lib/export'
import AviCard from './AviCard'
import { Botao, Kicker, Select } from './ui'

type Estado = 'carregando' | 'pronto' | 'vazio' | 'erro'

interface IrmaoPublico {
  id: string
  nome: string
  ativo: boolean
}

async function copiarLinkPublico(aoAvisar: (t: string) => void) {
  try {
    if (!navigator.clipboard) throw new Error('sem clipboard')
    await navigator.clipboard.writeText(window.location.href)
    aoAvisar('Link copiado.')
  } catch {
    aoAvisar('Não foi possível copiar — copie a URL do navegador.')
  }
}

/**
 * Rota pública /escala/:slug/AUDIO_VIDEO — escala do AVI visível (cartão em
 * faixa horizontal) com barra fixa de Baixar PDF e Copiar link.
 */
export default function TelaAviPublica({
  slug,
  aoAvisar,
}: {
  slug: string
  aoAvisar: (texto: string) => void
}) {
  const [estado, setEstado] = useState<Estado>('carregando')
  const [dadosBrutos, setDadosBrutos] = useState<unknown>(null)
  const [irmoes, setIrmoes] = useState<IrmaoPublico[]>([])
  const [congregacao, setCongregacao] = useState('')
  const [mesAtivo, setMesAtivo] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)

  const dados: DadosAvi = useMemo(() => normalizarDadosAvi(dadosBrutos), [dadosBrutos])

  useEffect(() => {
    let vivo = true
    fetch(`/api/escala/publico/${encodeURIComponent(slug)}/AUDIO_VIDEO`)
      .then(async (resposta) => {
        if (!vivo) return
        if (!resposta.ok) {
          setEstado('erro')
          return
        }
        const corpo = (await resposta.json()) as {
          congregacao?: { nome?: string }
          dados?: unknown
          irmoes?: IrmaoPublico[]
        }
        setDadosBrutos(corpo.dados ?? null)
        setIrmoes(Array.isArray(corpo.irmoes) ? corpo.irmoes : [])
        setCongregacao(corpo.congregacao?.nome ?? '')
        const gerados = Object.entries(
          corpo.dados && typeof corpo.dados === 'object'
            ? ((corpo.dados as { escalas?: Record<string, { geradoEm?: string }> }).escalas ?? {})
            : {},
        )
          .filter(([, registro]) => Boolean(registro?.geradoEm))
          .map(([chave]) => chave)
          .sort()
        setMesAtivo(gerados.length ? gerados[gerados.length - 1] : null)
        setEstado(gerados.length ? 'pronto' : 'vazio')
      })
      .catch(() => {
        if (vivo) setEstado('erro')
      })
    return () => {
      vivo = false
    }
  }, [slug, tentativa])

  const { ano, mes } = mesAtivo ? lerChaveMes(mesAtivo) : { ano: 0, mes: 0 }

  const mesesGerados = useMemo(
    () =>
      Object.entries(dados.escalas)
        .filter(([, registro]) => Boolean(registro.geradoEm))
        .map(([chave]) => chave)
        .sort(),
    [dados.escalas],
  )

  async function aoPdf() {
    if (!mesAtivo) return
    try {
      await baixarPdf(cardRef.current, mesAtivo, 'avi')
    } catch {
      aoAvisar('Não foi possível gerar o PDF.')
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 py-8 pb-28">
      <header className="text-center">
        <span
          className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-petrol text-white shadow-lg"
          aria-hidden="true"
        >
          <Radio className="size-7" />
        </span>
        <Kicker className="mt-4 text-muted">Áudio, Vídeo e Indicadores</Kicker>
        <h1 className="mt-1 text-[22px] font-bold leading-snug tracking-tight text-ink">
          {TITULO_AVI}
        </h1>
        <p className="mt-1 break-all text-sm text-muted">{congregacao || slug}</p>
      </header>

      {estado === 'carregando' ? (
        <p className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-card p-5 text-sm text-muted shadow-sm">
          <Loader2 className="size-4 animate-spin text-teal" aria-hidden="true" />
          Carregando escala…
        </p>
      ) : estado === 'erro' ? (
        <div className="mt-6 rounded-xl bg-card p-5 text-center shadow-sm">
          <p className="text-sm text-muted">
            Não foi possível carregar esta escala. Verifique o link.
          </p>
          <div className="mt-3 flex justify-center gap-2">
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
      ) : estado === 'vazio' ? (
        <div className="mt-6 rounded-xl bg-card p-5 text-center shadow-sm">
          <p className="text-sm text-muted">Nenhuma escala publicada neste link ainda.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {mesesGerados.length > 1 ? (
            <div>
              <label
                htmlFor="avi-publico-mes"
                className="mb-1 block text-[13px] font-semibold text-ink"
              >
                Mês
              </label>
              <Select
                id="avi-publico-mes"
                value={mesAtivo ?? ''}
                onChange={(e) => setMesAtivo(e.target.value)}
              >
                {mesesGerados.map((chave) => {
                  const { ano: a, mes: m } = lerChaveMes(chave)
                  return (
                    <option key={chave} value={chave}>
                      {nomeMes(m)} de {a}
                    </option>
                  )
                })}
              </Select>
            </div>
          ) : null}

          <div className="-mx-5 overflow-x-auto px-5 pb-2">
            <div ref={cardRef} className="w-[760px] shrink-0">
              <AviCard
                congregacao={congregacao}
                ano={ano}
                mes={mes}
                dados={dados}
                irmoes={irmoes}
              />
            </div>
          </div>
          <p className="text-center text-[13px] text-muted">
            Arraste o cartão para o lado para ver todas as funções.
          </p>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-md gap-2">
          <Botao
            variante="primario"
            className="flex-1"
            disabled={estado !== 'pronto'}
            onClick={aoPdf}
          >
            <FileDown className="size-4" aria-hidden="true" />
            Baixar PDF
          </Botao>
          <Botao
            variante="secundario"
            className="flex-1"
            disabled={estado !== 'pronto'}
            onClick={() => copiarLinkPublico(aoAvisar)}
          >
            <Link2 className="size-4" aria-hidden="true" />
            Copiar link
          </Botao>
        </div>
      </div>
    </div>
  )
}
