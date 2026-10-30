import { useMemo } from 'react'
import { CalendarDays, Clock, Link as LinkIcon, MapPin } from 'lucide-react'
import { decodificar } from '../lib/compartilhamento'
import { isoDeHoje } from '../lib/datas'
import { ehFeriado, ehUltimoDomingo, rotuloEspecial } from '../lib/feriados'
import { MESES, nomeDiaCurto } from '../lib/constants'
import { Botao, Kicker } from './ui'

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
  /** Ajudante do dia (6º campo do payload; vazio em links antigos). */
  ajudante: string
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
  aoAvisar,
  linkPublico,
}: {
  payload: string
  aoAvisar: (mensagem: string) => void
  /** Quando presente (rota pública), mostra a ação fixa para copiar o link. */
  linkPublico?: string
}) {
  const dados = useMemo(() => decodificar(payload ?? ''), [payload])

  const linhas = useMemo(() => {
    if (!dados) return []
    return dados.r
      .filter((linha) => Array.isArray(linha) && linha[0])
      .map((linha, i): LinhaDia => {
        const [iso, horario, local, nome, , ajudante] = linha
        return {
          key: `v-${i}`,
          iso,
          diaSemana: isoParaDia(iso),
          horario,
          local,
          nome,
          ajudante: ajudante ?? '',
        }
      })
      .sort((a, b) => a.iso.localeCompare(b.iso) || a.horario.localeCompare(b.horario))
  }, [dados])

  /** Saídas que ainda valem: de hoje em diante (hoje só se o horário ainda vem). */
  const futuras = useMemo(
    () =>
      linhas.filter(
        (linha) => linha.iso > HOJE_ISO || (linha.iso === HOJE_ISO && linha.horario >= AGORA_HHMM),
      ),
    [linhas],
  )

  const proxima = futuras[0] ?? null

  const hoje = useMemo(() => linhas.filter((linha) => linha.iso === HOJE_ISO), [linhas])
  const destaque = proxima ?? hoje[hoje.length - 1] ?? linhas[linhas.length - 1] ?? null
  const rotuloDestaque = !destaque
    ? ''
    : destaque.iso === HOJE_ISO
      ? 'Quem dirige hoje'
      : destaque.iso > HOJE_ISO
        ? 'Próxima saída'
        : 'Última saída'

  if (!dados) {
    return (
      <div className="mx-auto flex min-h-svh max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
        <LinkIcon className="size-8 text-crimson" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-ink">Link inválido</h1>
        <p className="text-sm text-muted">
          Este link não contém uma designação válida. Peça para a pessoa gerar o link novamente na
          tela da designação pronta.
        </p>
      </div>
    )
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
              {MESES[dados.m]} de {dados.a}
            </p>
          </div>
        </div>
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
            {destaque.ajudante ? (
              <p className="mt-0.5 text-sm text-white/75">
                <span className="font-semibold text-white/60">Ajudante:</span> {destaque.ajudante}
              </p>
            ) : null}
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

      {linhas.length ? (
        <section className="mt-5 space-y-3">
          <div className="flex items-end justify-between gap-2 px-1">
            <h2 className="text-lg font-semibold text-ink">Próximos dias</h2>
            {futuras.length ? (
              <p className="text-[13px] text-muted">
                {futuras.length} próxima{futuras.length === 1 ? '' : 's'} saída{futuras.length === 1 ? '' : 's'}
              </p>
            ) : null}
          </div>

          {futuras.length ? (
            <div className="flex flex-col gap-2">
              {futuras.map((linha) => {
                const ehHoje = linha.iso === HOJE_ISO
                const ehDestaque = destaque?.key === linha.key
                const especial = rotuloDe(linha.iso)
                return (
                  <article
                    key={linha.key}
                    className={`rounded-xl bg-card p-4 shadow-sm ${
                      ehHoje
                        ? 'escala-hoje'
                        : ehDestaque
                          ? 'ring-2 ring-teal/35'
                          : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-teal">
                          {linha.nome || <span className="text-crimson">Sem designação</span>}
                          {linha.ajudante && linha.nome ? (
                            <span className="ml-1.5 text-[13px] font-semibold text-muted">
                              + {linha.ajudante}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-muted">
                          <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
                          <span>
                            {nomeDiaCurto(linha.diaSemana)}, {ddMm(linha.iso)}
                          </span>
                          {especial ? (
                            <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-bold text-ink-soft">
                              {especial}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      {ehHoje ? (
                        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-teal px-2.5 py-0.5 text-[11px] font-bold text-white">
                          <span
                            className="size-1.5 animate-pulse rounded-full bg-crimson"
                            aria-hidden="true"
                          />
                          HOJE
                        </span>
                      ) : ehDestaque ? (
                        <span className="shrink-0 rounded-full bg-teal-tint px-2.5 py-0.5 text-[11px] font-bold text-teal">
                          PRÓXIMA
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-soft">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5 text-teal" aria-hidden="true" />
                        {linha.horario}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5 text-teal" aria-hidden="true" />
                        {linha.local}
                      </span>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <p className="rounded-xl bg-card px-4 py-5 text-center text-sm text-muted">
              Não há mais saídas de campo a partir de hoje.
            </p>
          )}
        </section>
      ) : null}

      {linkPublico ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-2xl gap-2">
            <Botao variante="secundario" className="w-full" onClick={copiarLinkPublico}>
              <LinkIcon className="size-4" aria-hidden="true" />
              Copiar link
            </Botao>
          </div>
        </div>
      ) : null}
    </div>
  )
}
