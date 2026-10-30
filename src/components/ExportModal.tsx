import type { RefObject } from 'react'
import type { ConfigEscala, Dirigente, Ocorrencia } from '../lib/dominio'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ClipboardCopy, FileDown, ImageDown, Link as LinkIcon, Loader2, Share2 } from 'lucide-react'
import { linkDe, montarPayload } from '../lib/compartilhamento'
import {
  baixarImagem,
  baixarPdf,
  capturarNo,
  compartilhar,
  copiarTexto,
  textoSimplificado,
} from '../lib/export'
import { Botao, Modal } from './ui'

interface ExportModalProps {
  aberto: boolean
  aoFechar: () => void
  noAlvo: RefObject<HTMLDivElement | null>
  chave: string
  ano: number
  mes: string
  config: ConfigEscala
  ocorrencias: Ocorrencia[]
  efetivas: Record<string, string>
  efetivasAjudante?: Record<string, string>
  dirigentes: Dirigente[]
  aoAvisar: (mensagem: string) => void
}

export default function ExportModal({
  aberto,
  aoFechar,
  noAlvo,
  chave,
  ano,
  mes,
  config,
  ocorrencias,
  efetivas,
  efetivasAjudante,
  dirigentes,
  aoAvisar,
}: ExportModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [previa, setPrevia] = useState('')
  const [ocupado, setOcupado] = useState('')
  const [erro, setErro] = useState('')

  const texto = useMemo(
    () => textoSimplificado({ config, chave, ocorrencias, designacoes: efetivas, dirigentes }),
    [config, chave, ocorrencias, efetivas, dirigentes],
  )

  const link = useMemo(() => {
    try {
      const payload = montarPayload({
        config,
        chave,
        ocorrencias,
        designacoes: efetivas,
        designacoesAjudante: efetivasAjudante,
        dirigentes,
      })
      return payload.r.length ? linkDe(payload) : ''
    } catch {
      return ''
    }
  }, [config, chave, ocorrencias, efetivas, efetivasAjudante, dirigentes])

  useEffect(() => {
    if (!aberto) return undefined

    let vivo = true
    ;(async () => {
      try {
        const canvas = await capturarNo(noAlvo.current)
        if (!vivo) return
        canvasRef.current = canvas
        setPrevia(canvas.toDataURL('image/png'))
      } catch (e) {
        console.warn(e)
        if (vivo) setErro('Não foi possível renderizar a escala. Tente novamente.')
      }
    })()

    return () => {
      vivo = false
      canvasRef.current = null
    }
  }, [aberto, noAlvo])

  async function executar(
    rotulo: string,
    acao: (canvas: HTMLCanvasElement) => Promise<unknown>,
    sucesso?: string | ((resultado: unknown) => string),
  ) {
    if (!canvasRef.current || ocupado) return
    setOcupado(rotulo)
    setErro('')
    try {
      const resultado = await acao(canvasRef.current)
      const aviso = typeof sucesso === 'function' ? sucesso(resultado) : sucesso
      if (aviso) aoAvisar(aviso)
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        console.warn(e)
        setErro(e.message || 'A ação não foi concluída. Tente novamente.')
      }
    } finally {
      setOcupado('')
    }
  }

  const carregando = aberto && !previa && !erro
  const disponivel = Boolean(previa) && !ocupado

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Exportar escala"
      descricao={`Prévia fiel do cartão de ${mes} de ${ano} — o arquivo sai com esta mesma aparência.`}
    >
      <div className="space-y-4 px-5 py-4">
        <div className="flex min-h-[160px] items-center justify-center border border-line bg-paper p-3">
          {carregando ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Gerando prévia…
            </p>
          ) : erro ? (
            <p role="alert" className="max-w-sm text-center text-sm font-semibold text-crimson">
              {erro}
            </p>
          ) : (
            <img
              src={previa}
              alt="Prévia da escala pronta para exportação"
              className="max-h-[40svh] w-auto max-w-full border border-line"
            />
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Botao
            variante="primario"
            disabled={!disponivel}
            onClick={() => executar('PDF', (c) => baixarPdf(c, chave), 'PDF baixado.')}
          >
            {ocupado === 'PDF' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileDown className="size-4" />
            )}
            Baixar PDF
          </Botao>

          <Botao
            variante="secundario"
            disabled={!disponivel}
            onClick={() => executar('Imagem', (c) => baixarImagem(c, chave), 'Imagem baixada.')}
          >
            {ocupado === 'Imagem' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImageDown className="size-4" />
            )}
            Baixar imagem PNG
          </Botao>

          <Botao
            variante="vinho"
            disabled={!disponivel}
            onClick={() =>
              executar(
                'Compartilhar',
                (c) => compartilhar({ canvas: c, chave, texto }),
                (destino) =>
                  destino === 'copiado'
                    ? 'Compartilhamento indisponível aqui: texto copiado.'
                    : 'Escala compartilhada.',
              )
            }
          >
            {ocupado === 'Compartilhar' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Share2 className="size-4" />
            )}
            Compartilhar
          </Botao>

          <Botao
            variante="secundario"
            disabled={ocupado !== ''}
            onClick={() => executar('Texto', () => copiarTexto(texto), 'Texto copiado para colar no WhatsApp.')}
          >
            {ocupado === 'Texto' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ClipboardCopy className="size-4" />
            )}
            Copiar texto
          </Botao>

          <Botao
            variante="secundario"
            disabled={ocupado !== '' || !link}
            onClick={() =>
              executar(
                'Link',
                () => copiarTexto(link),
                'Link da designação copiado. Cole no WhatsApp ou em qualquer conversa.',
              )
            }
          >
            {ocupado === 'Link' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LinkIcon className="size-4" />
            )}
            Copiar link
          </Botao>
        </div>

        <details className="border border-line bg-paper px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-ink">
            Ver texto que será copiado
          </summary>
          <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap border-t border-line-soft pt-3 text-[13px] leading-relaxed text-muted">
            {texto}
          </pre>
        </details>
      </div>
    </Modal>
  )
}
