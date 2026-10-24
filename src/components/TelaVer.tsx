import type { ConfigEscala, Ocorrencia } from '../lib/dominio'
import { useMemo, useRef } from 'react'
import { Clock, FileDown, ImageDown, Link as LinkIcon, MapPin } from 'lucide-react'
import { decodificar } from '../lib/compartilhamento'
import { isoDeHoje } from '../lib/datas'
import { ehFeriado, ehUltimoDomingo, rotuloEspecial } from '../lib/feriados'
import { MESES, nomeDiaCurto } from '../lib/constants'
import { baixarImagem, baixarPdf } from '../lib/export'
import { Botao, Kicker } from './ui'
import EscalaCard from './EscalaCard'

/** Data de hoje resolvida uma vez (evita Date instável no render). */
const HOJE_ISO = isoDeHoje()
const AGORA_HHMM = new Date().toTimeString().slice(0, 5)

interface LinhaDia {
  key: string
  iso: string
  diaSemana: number
  horario: string
  local: string
  nome: string
  fixo: boolean
}

function ddMm(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

function isoParaDia(iso: string): number {
  return new Date(`${iso}T12:00:00`).getDay()
}

function rotuloDe(iso: string): string | null {
  return rotuloEspecial({ feriado: ehFeriado(iso), ultimoDomingo: ehUltimoDomingo(iso) })
}

export default function TelaVer({
  payload,
  aoVoltar,
  aoAvisar,
  linkPublico,
}: {
  payload: string
  aoVoltar: () => void
  aoAvisar: (mensagem: string) => void
  /** Quando presente (rota pública), mostra a barra fixa PDF + Copiar link. */
  linkPublico?: string
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const dados = useMemo(() => decodificar(payload ?? ''), [payload])

  const linhas = useMemo(() => {
    if (!dados) return []
    return dados.r
      .filter((linha) => Array.isArray(linha) && linha[0])
      .map((linha, i): LinhaDia => {
        const [iso, horario, local, nome, fixo] = linha
        return {
          key: `v-${i}`,
          iso,
          diaSemana: isoParaDia(iso),
          horario,
          local,
          nome,
          fixo: fixo === '1',
        }
      })
  }, [dados])

  const ocorrencias = useMemo(
    (): Ocorrencia[] =>
      linhas.map((l) => ({
        key: l.key,
        data: new Date(`${l.iso}T12:00:00`),
        iso: l.iso,
        dia: Number(l.iso.slice(8, 10)),
        diaSemana: l.diaSemana,
        feriado: ehFeriado(l.iso),
        ultimoDomingo: ehUltimoDomingo(l.iso),
        campo: {
          id: `campo-${l.key}`,
          diaSemana: l.diaSemana,
          horario: l.horario,
          local: l.local,
          fixo: l.fixo ? '1' : null,
        },
      })),
    [linhas],
  )

  const nomes = useMemo(
    () => Object.fromEntries(linhas.map((l) => [l.key, l.nome])),
    [linhas],
  )

  const config = useMemo(
    (): ConfigEscala | null =>
      dados
        ? {
            titulo: dados.t,
            congregacao: dados.c,
            designacao_fixa: true,
            frequencia_padrao: 'quinzenal',
            evitar_consecutivos: true,
            equilibrar_fds: true,
            limite_mensal: 3,
            ajustar_feriados: false,
            horario_feriado: '08:00',
            disparo_dia: 20,
            disparo_hora: '00:00',
          }
        : null,
    [dados],
  )

  const hoje = linhas.filter((l) => l.iso === HOJE_ISO)
  const destaque =
    (hoje.length ? (hoje.find((l) => l.horario >= AGORA_HHMM) ?? hoje[hoje.length - 1]) : null) ??
    linhas.find((l) => l.iso > HOJE_ISO) ??
    linhas[0] ??
    null
  const restantes = destaque ? linhas.filter((l) => l.key !== destaque.key) : linhas
  const rotuloDestaque = hoje.length ? 'Quem dirige hoje' : 'Próxima saída'
  const chave = dados ? `${dados.a}-${dados.m + 1}` : ''

  if (!dados || !config) {
    return (
      <div className="mx-auto flex min-h-svh max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
        <LinkIcon className="size-8 text-crimson" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-ink">Link inválido</h1>
        <p className="text-sm text-muted">
          Este link não contém uma designação válida. Peça para a pessoa gerar o link novamente na
          tela da designação pronta.
        </p>
        <Botao variante="primario" onClick={aoVoltar}>
          Voltar para o app
        </Botao>
      </div>
    )
  }

  async function baixarPdfDaPagina() {
    try {
      await baixarPdf(cardRef.current, chave)
      aoAvisar('PDF baixado.')
    } catch (e) {
      aoAvisar(e instanceof Error ? e.message : 'Não foi possível gerar o PDF.')
    }
  }

  async function baixarImagemDaPagina() {
    try {
      await baixarImagem(cardRef.current, chave)
      aoAvisar('Imagem baixada.')
    } catch (e) {
      aoAvisar(e instanceof Error ? e.message : 'Não foi possível gerar a imagem.')
    }
  }

  async function copiarLinkPublico() {
    if (!linkPublico) return
    try {
      if (!navigator.clipboard) throw new Error('sem clipboard')
      await navigator.clipboard.writeText(linkPublico)
      aoAvisar('Link copiado.')
    } catch {
      aoAvisar('Não foi possível copiar — copie a URL do navegador.')
    }
  }

  return (
    <div className={`mx-auto w-full max-w-2xl px-4 py-6 ${linkPublico ? 'pb-32' : 'pb-16'}`}>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal text-white shadow-sm"
            aria-hidden="true"
          >
            <MapPin className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-snug tracking-tight text-ink">
              {dados.t} - {dados.c}
            </h1>
            <p className="mt-0.5 text-xs text-muted">
              {MESES[dados.m]} de {dados.a} · somente leitura
            </p>
          </div>
        </div>
        <Botao variante="fantasma" className="shrink-0" onClick={aoVoltar}>
          {linkPublico ? 'Ir para o app' : 'Voltar para o app'}
        </Botao>
      </header>

      {destaque ? (
        <section
          className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal to-teal-deep p-6 text-white shadow-xl ${
            destaque.iso === HOJE_ISO ? 'escala-hoje-branco' : ''
          }`}
        >
          <div
            className="pointer-events-none absolute -bottom-10 -right-8 size-44 rounded-full bg-white/10 blur-2xl"
            aria-hidden="true"
          />
          <div className="relative z-10 flex items-center justify-between gap-3">
            <Kicker className="text-white/80">{rotuloDestaque}</Kicker>
            <span className="flex shrink-0 items-center gap-2">
              {rotuloDe(destaque.iso) ? (
                <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-bold tracking-wide text-white">
                  {rotuloDe(destaque.iso)}
                </span>
              ) : null}
              {destaque.iso === HOJE_ISO ? (
                <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-bold tracking-wide text-teal-deep">
                  <span className="size-1.5 animate-pulse rounded-full bg-crimson" aria-hidden="true" />
                  HOJE
                </span>
              ) : null}
              <span className="rounded-full bg-white/15 px-3 py-0.5 text-xs font-bold tracking-wide text-white">
                {nomeDiaCurto(destaque.diaSemana)}, {ddMm(destaque.iso)}
              </span>
            </span>
          </div>
          <div className="relative z-10 mt-3">
            <p className="text-[32px] font-extrabold leading-tight">
              {destaque.nome || 'Sem designação'}
            </p>
          </div>
          <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
            <span className="flex min-w-0 items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate text-sm">{destaque.local}</span>
            </span>
            <span className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm">
              <Clock className="size-4 shrink-0" aria-hidden="true" />
              <span className="text-sm">{destaque.horario}</span>
            </span>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-line bg-card px-6 py-9 text-center">
          <p className="text-sm text-muted">Nenhuma programação neste link.</p>
        </section>
      )}

      {restantes.length ? (
        <section className="mt-5 space-y-2">
          <h2 className="px-1 text-lg font-semibold text-ink">Próximos dias</h2>
          <div className="flex flex-col gap-2">
            {restantes.map((l) => (
              <article
                key={l.key}
                className={`rounded-xl bg-card p-4 shadow-sm ${l.iso === HOJE_ISO ? 'escala-hoje' : ''}`}
              >
                <p className="text-sm font-bold text-ink">{l.nome || 'Sem designação'}</p>
                <p className="mt-1 text-[13px] text-muted">
                  {l.iso === HOJE_ISO ? (
                    <span className="mr-1.5 inline-flex items-center gap-1 rounded-full bg-teal px-2 py-0.5 text-[11px] font-bold text-white align-middle">
                      <span className="size-1.5 animate-pulse rounded-full bg-crimson" aria-hidden="true" />
                      HOJE
                    </span>
                  ) : null}
                  {nomeDiaCurto(l.diaSemana)}, {ddMm(l.iso)}
                  {rotuloDe(l.iso) ? (
                    <span className="ml-1.5 rounded-full bg-line px-2 py-0.5 text-[11px] font-bold text-ink-soft">
                      {rotuloDe(l.iso)}
                    </span>
                  ) : null}
                  {' · '}
                  {l.horario} - {l.local}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {linkPublico ? null : (
        <div className="mt-6 flex flex-wrap gap-2">
          <Botao variante="primario" onClick={baixarPdfDaPagina}>
            <FileDown className="size-4" aria-hidden="true" />
            Baixar PDF
          </Botao>
          <Botao onClick={baixarImagemDaPagina}>
            <ImageDown className="size-4" aria-hidden="true" />
            Baixar imagem
          </Botao>
        </div>
      )}

      <p className="mt-4 text-[13px] text-muted">
        Somente leitura: esta é a programação que foi compartilhada com você.
      </p>

      <div
        className="pointer-events-none fixed left-[-10000px] top-0 w-[760px] overflow-hidden"
        aria-hidden="true"
      >
        <EscalaCard
          ref={cardRef}
          config={config}
          ocorrencias={ocorrencias}
          dirigentes={[]}
          designacoes={{}}
          nomes={nomes}
          somenteLeitura
        />
      </div>

      {linkPublico ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-2xl gap-2">
            <Botao variante="primario" className="flex-1" onClick={baixarPdfDaPagina}>
              <FileDown className="size-4" aria-hidden="true" />
              Baixar PDF
            </Botao>
            <Botao variante="secundario" className="flex-1" onClick={copiarLinkPublico}>
              <LinkIcon className="size-4" aria-hidden="true" />
              Copiar link
            </Botao>
          </div>
        </div>
      ) : null}
    </div>
  )
}
