import { useEffect } from 'react'
import { ArrowLeft, ChevronRight, ScrollText, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ATUALIZADO_EM, DOCUMENTOS } from '../lib/legais'
import type { TipoLegal } from '../lib/legais'
import InfoApp from './InfoApp'

const ICONE: Record<TipoLegal, LucideIcon> = {
  privacidade: ShieldCheck,
  termos: ScrollText,
}

/** Volta para quem abriu a página, ou cai na home quando é acesso direto. */
function voltar() {
  if (window.history.length > 1) window.history.back()
  else window.location.assign('/')
}

/**
 * Páginas legais públicas, `/privacidade` e `/termos`. Ficam sem login e com
 * endereço fixo, porque o consent screen do Google exige as duas URLs. O texto
 * mora em `src/lib/legais.ts`, aqui é só apresentação.
 */
export default function TelaLegal({ tipo }: { tipo: TipoLegal }) {
  const doc = DOCUMENTOS[tipo]
  const outro = DOCUMENTOS[tipo === 'privacidade' ? 'termos' : 'privacidade']
  const IconeSecao = ICONE[tipo]

  // Título da aba correto quando a página é aberta sozinha (ou compartilhada).
  useEffect(() => {
    const anterior = document.title
    document.title = `${doc.titulo} | Designa`
    return () => {
      document.title = anterior
    }
  }, [doc.titulo])

  return (
    <div className="min-h-svh bg-fundo">
      <header className="bg-primary-500 px-5 pb-8 pt-6 text-white">
        <div className="mx-auto flex w-full max-w-md items-start gap-3">
          <button
            type="button"
            aria-label="Voltar"
            onClick={voltar}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-primary-600 transition-colors hover:bg-white/90"
          >
            <ArrowLeft className="size-5" strokeWidth={1.8} aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold leading-snug tracking-tight text-white">
              {doc.titulo}
            </h1>
            <p className="mt-0.5 text-xs font-semibold text-white/80">
              Atualizado em {ATUALIZADO_EM}
            </p>
          </div>
          <InfoApp variante="cabecalho" />
        </div>
      </header>

      <main className="mx-auto -mt-4 w-full max-w-md rounded-t-[24px] bg-fundo px-5 pt-6 pb-16">
        <p className="mb-6 text-[15px] leading-[1.625] text-ink-soft">{doc.introducao}</p>

        <div className="flex flex-col gap-6">
          {doc.secoes.map((secao) => (
            <section key={secao.titulo}>
              <h2 className="flex items-center gap-2 text-base font-extrabold leading-snug text-ink">
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-tint text-teal"
                  aria-hidden="true"
                >
                  <IconeSecao className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
                </span>
                {secao.titulo}
              </h2>

              {secao.paragrafos?.map((paragrafo) => (
                <p key={paragrafo} className="mt-2 text-[15px] leading-[1.625] text-ink-soft">
                  {paragrafo}
                </p>
              ))}

              {secao.itens ? (
                <ul className="mt-2 flex flex-col gap-2">
                  {secao.itens.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <span
                        className="mt-2 size-1.5 shrink-0 rounded-full bg-teal"
                        aria-hidden="true"
                      />
                      <span className="text-[15px] leading-[1.625] text-ink-soft">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <nav className="mt-8 flex flex-col gap-3" aria-label="Documentos legais">
          <a
            href={outro.rota}
            className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 text-left shadow-sm transition-colors hover:bg-line-soft"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-tint text-teal">
                {outro.tipo === 'privacidade' ? (
                  <ShieldCheck className="size-4" strokeWidth={1.9} aria-hidden="true" />
                ) : (
                  <ScrollText className="size-4" strokeWidth={1.9} aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 text-sm font-bold text-ink">Ver {outro.rotulo}</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-faint" aria-hidden="true" />
          </a>

          <a
            href="/"
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-line bg-paper px-5 py-3 text-sm font-bold text-ink transition-colors hover:border-teal hover:text-teal"
          >
            Voltar ao app
          </a>
        </nav>
      </main>
    </div>
  )
}
