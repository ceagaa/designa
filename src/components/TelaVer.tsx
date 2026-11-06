import { useMemo } from 'react'
import { Link as LinkIcon, MapPin } from 'lucide-react'
import { decodificar } from '../lib/compartilhamento'
import { ddMm, isoDeHoje } from '../lib/datas'
import { ehFeriado, ehUltimoDomingo, rotuloEspecial } from '../lib/feriados'
import { MESES, nomeDiaCurto } from '../lib/constants'
import { AvisoTerritorios, CardHeroCampo, LinhaCampo } from './CardsDesignacao'
import InfoApp from './InfoApp'

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

function isoParaDia(iso: string): number {
  return new Date(`${iso}T12:00:00`).getDay()
}

function rotuloDe(iso: string): string | null {
  return rotuloEspecial({ feriado: ehFeriado(iso), ultimoDomingo: ehUltimoDomingo(iso) })
}

export default function TelaVer({ payload }: { payload: string }) {
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
    : destaque.iso >= HOJE_ISO
      ? 'Próxima designação'
      : 'Última saída'

  /** Próximas saídas depois do card de destaque, mesma lista do admin. */
  const restantes = futuras.filter((linha) => linha.key !== destaque?.key)

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

  return (
    <div className="min-h-svh bg-fundo">
      <header className="bg-primary-500 px-5 pb-8 pt-6 text-white">
        <div className="mx-auto flex w-full max-w-md items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-primary-600"
              aria-hidden="true"
            >
              <MapPin className="size-5" strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-extrabold leading-snug tracking-tight text-white">
                {dados.t}, {dados.c}
              </h1>
              <p className="mt-0.5 text-xs font-semibold text-white/80">
                {MESES[dados.m]} de {dados.a}
              </p>
            </div>
          </div>
          <InfoApp variante="cabecalho" />
        </div>
      </header>

      <main className="mx-auto -mt-4 w-full max-w-md rounded-t-[24px] bg-fundo px-5 pt-6 pb-16">
        {destaque ? (
          <CardHeroCampo
            rotulo={rotuloDestaque}
            especial={rotuloDe(destaque.iso)}
            dia={`${nomeDiaCurto(destaque.diaSemana)}, ${ddMm(destaque.iso)}`}
            nome={destaque.nome || null}
            ajudante={destaque.ajudante || null}
            local={destaque.local}
            horario={destaque.horario}
            ehHoje={destaque.iso === HOJE_ISO}
            rodape={<AvisoTerritorios />}
          />
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
                  {futuras.length} próxima{futuras.length === 1 ? '' : 's'} saída
                  {futuras.length === 1 ? '' : 's'}
                </p>
              ) : null}
            </div>

            {restantes.length ? (
              <div className="flex flex-col gap-2">
                {restantes.map((linha) => (
                  <LinhaCampo
                    key={linha.key}
                    item={{
                      key: linha.key,
                      iso: linha.iso,
                      diaSemana: linha.diaSemana,
                      horario: linha.horario,
                      local: linha.local,
                      nome: linha.nome || null,
                      ajudante: linha.ajudante || null,
                      especial: rotuloDe(linha.iso),
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-card px-4 py-5 text-center text-sm text-muted">
                Não há mais saídas de campo a partir de hoje.
              </p>
            )}
          </section>
        ) : null}
      </main>

      <footer className="mx-auto w-full max-w-md px-5 pb-10 text-center text-xs font-semibold text-muted">
        Atualizado automaticamente · Designa
      </footer>
    </div>
  )
}
