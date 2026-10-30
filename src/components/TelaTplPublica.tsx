import type { DadosTpl } from '../lib/dominio'
import type { LinhaTpl } from '../lib/tpl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, FileDown, Link2, Loader2, MapPin, RefreshCcw, ShoppingCart } from 'lucide-react'
import { chaveMes, lerChaveMes, nomeMes } from '../lib/datas'
import { TITULO_TPL, diaTexto, linhasTplPara, mesesTpl, normalizarDadosTpl } from '../lib/tpl'
import { baixarPdf } from '../lib/export'
import TplCard from './TplCard'
import { Botao, Kicker, Select } from './ui'

type Estado = 'carregando' | 'pronto' | 'vazio' | 'erro'

/** Meses que têm períodos cadastrados e, portanto, linhas para mostrar. */
function mesesComConteudo(dados: DadosTpl): string[] {
  return mesesTpl(dados).filter((chave) => {
    const { ano, mes } = lerChaveMes(chave)
    return linhasTplPara(dados, ano, mes).length > 0
  })
}

function mesTemDupla(dados: DadosTpl, chave: string): boolean {
  const { ano, mes } = lerChaveMes(chave)
  return linhasTplPara(dados, ano, mes).some((linha) => linha.dupla.length > 0)
}

/**
 * Escolhe o mês mais útil para abrir: o atual se já tiver duplas, depois o
 * próximo com duplas, depois o último mês passado com duplas e, por fim, o
 * mês mais recente que tenha estrutura para mostrar.
 */
function mesInicial(dados: DadosTpl, meses: string[]): string | null {
  if (!meses.length) return null
  const agora = new Date()
  const atual = chaveMes(agora.getFullYear(), agora.getMonth())
  const comDuplas = meses.filter((chave) => mesTemDupla(dados, chave))
  const futuros = comDuplas.filter((chave) => chave >= atual)
  const passados = comDuplas.filter((chave) => chave < atual)
  return (
    futuros[0] ??
    passados[passados.length - 1] ??
    (meses.includes(atual) ? atual : meses[meses.length - 1]) ??
    null
  )
}

/**
 * Rota pública /tpl/:slug — escala do TPL compartilhada por link, com filtros
 * de dia e ponto, duplas (mínimo 2) e exportação em PDF. A escala é montada
 * manualmente no app; aqui ela é apenas exibida.
 */
export default function TelaTplPublica({
  slug,
  aoAvisar,
}: {
  slug: string
  aoAvisar: (texto: string) => void
}) {
  const [estado, setEstado] = useState<Estado>('carregando')
  const [dadosBrutos, setDadosBrutos] = useState<unknown>(null)
  const [congregacao, setCongregacao] = useState('')
  const [mesesDisponiveis, setMesesDisponiveis] = useState<string[]>([])
  const [mesAtivo, setMesAtivo] = useState<string | null>(null)
  const [isoFiltro, setIsoFiltro] = useState('')
  const [pontoFiltro, setPontoFiltro] = useState('')
  const [tentativa, setTentativa] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)

  const dados: DadosTpl = useMemo(() => normalizarDadosTpl(dadosBrutos), [dadosBrutos])

  useEffect(() => {
    let vivo = true
    fetch(`/api/tpl/publico/${encodeURIComponent(slug)}`)
      .then(async (resposta) => {
        if (!vivo) return
        if (!resposta.ok) {
          setEstado('erro')
          return
        }
        const corpo = (await resposta.json()) as {
          congregacao?: { nome?: string }
          dados?: unknown
        }
        const brutos = corpo.dados ?? null
        const normalizado = normalizarDadosTpl(brutos)
        const meses = mesesComConteudo(normalizado)
        setDadosBrutos(brutos)
        setCongregacao(corpo.congregacao?.nome ?? '')
        setMesesDisponiveis(meses)
        setMesAtivo(mesInicial(normalizado, meses))
        setIsoFiltro('')
        setPontoFiltro('')
        setEstado(meses.length ? 'pronto' : 'vazio')
      })
      .catch(() => {
        if (vivo) setEstado('erro')
      })
    return () => {
      vivo = false
    }
  }, [slug, tentativa])

  const { ano, mes } = mesAtivo ? lerChaveMes(mesAtivo) : { ano: 0, mes: 0 }

  const linhas: LinhaTpl[] = useMemo(
    () => (mesAtivo ? linhasTplPara(dados, ano, mes) : []),
    [dados, ano, mes, mesAtivo],
  )

  const linhasFiltradas = useMemo(
    () =>
      linhas.filter(
        (linha) =>
          (!isoFiltro || linha.iso === isoFiltro) &&
          (!pontoFiltro || linha.ponto === pontoFiltro),
      ),
    [linhas, isoFiltro, pontoFiltro],
  )

  const opcoesDias = useMemo(() => [...new Set(linhas.map((l) => l.iso))], [linhas])
  const opcoesPontos = useMemo(
    () => [...new Set(linhas.map((l) => l.ponto))].sort((a, b) => a.localeCompare(b)),
    [linhas],
  )

  const agrupadas = useMemo(() => {
    const mapa = new Map<string, LinhaTpl[]>()
    for (const linha of linhasFiltradas) {
      const lista = mapa.get(linha.iso) ?? []
      lista.push(linha)
      mapa.set(linha.iso, lista)
    }
    return [...mapa.entries()]
  }, [linhasFiltradas])

  async function aoPdf() {
    if (!mesAtivo || !linhasFiltradas.length || !cardRef.current) {
      aoAvisar('Não há uma escala para baixar neste mês.')
      return
    }
    try {
      await baixarPdf(cardRef.current, mesAtivo, 'tpl')
    } catch {
      aoAvisar('Não foi possível gerar o PDF.')
    }
  }

  async function copiarLinkPublico() {
    try {
      if (!navigator.clipboard) throw new Error('sem clipboard')
      await navigator.clipboard.writeText(window.location.href)
      aoAvisar('Link copiado.')
    } catch {
      aoAvisar('Não foi possível copiar — copie a URL do navegador.')
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 py-8 pb-32">
      <header className="text-center">
        <span
          className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-wine text-white shadow-lg"
          aria-hidden="true"
        >
          <ShoppingCart className="size-7" />
        </span>
        <Kicker className="mt-4 text-muted">Testemunho Público Local</Kicker>
        <h1 className="mt-1 text-[22px] font-bold leading-snug tracking-tight text-ink">
          {TITULO_TPL}
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
          <Botao
            variante="secundario"
            className="mt-3"
            onClick={() => {
              setEstado('carregando')
              setTentativa((t) => t + 1)
            }}
          >
            <RefreshCcw className="size-4" aria-hidden="true" />
            Tentar de novo
          </Botao>
        </div>
      ) : estado === 'vazio' ? (
        <div className="mt-6 rounded-xl bg-card p-5 text-center shadow-sm">
          <p className="text-sm text-muted">Ainda não há uma escala publicada neste link.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {mesesDisponiveis.length > 1 ? (
            <div>
              <label
                htmlFor="tpl-publico-mes"
                className="mb-1 block text-[13px] font-semibold text-ink"
              >
                Mês
              </label>
              <Select
                id="tpl-publico-mes"
                value={mesAtivo ?? ''}
                onChange={(e) => {
                  setMesAtivo(e.target.value)
                  setIsoFiltro('')
                  setPontoFiltro('')
                }}
              >
                {mesesDisponiveis.map((chave) => {
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

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="tpl-publico-dia"
                className="mb-1 block text-[13px] font-semibold text-ink"
              >
                Dia
              </label>
              <Select
                id="tpl-publico-dia"
                value={isoFiltro}
                onChange={(e) => setIsoFiltro(e.target.value)}
              >
                <option value="">Todos</option>
                {opcoesDias.map((iso) => {
                  const linha = linhas.find((l) => l.iso === iso)
                  return (
                    <option key={iso} value={iso}>
                      {linha ? `${diaTexto(linha.diaSemana)} ${linha.dia}` : iso}
                    </option>
                  )
                })}
              </Select>
            </div>
            <div>
              <label
                htmlFor="tpl-publico-ponto"
                className="mb-1 block text-[13px] font-semibold text-ink"
              >
                Ponto
              </label>
              <Select
                id="tpl-publico-ponto"
                value={pontoFiltro}
                onChange={(e) => setPontoFiltro(e.target.value)}
              >
                <option value="">Todos</option>
                {opcoesPontos.map((ponto) => (
                  <option key={ponto} value={ponto}>
                    {ponto}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {agrupadas.length ? (
            <div className="space-y-3">
              {agrupadas.map(([iso, doDia]) => (
                <article key={iso} className="overflow-hidden rounded-2xl bg-card shadow-sm">
                  <h2 className="flex items-center gap-2 bg-wine px-4 py-2 text-sm font-bold text-white">
                    <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
                    {diaTexto(doDia[0].diaSemana)} · {doDia[0].dia}/
                    {String(mes + 1).padStart(2, '0')}
                  </h2>
                  <div className="divide-y divide-line">
                    {doDia.map((linha) => (
                      <div key={`${iso}-${linha.ponto}-${linha.turno}`} className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-ink">
                            Retirada: {linha.ponto}
                          </p>
                          <p className="mt-0.5 text-[13px] text-muted">
                            Trabalho: {linha.local || 'Local a definir'} · {linha.turno}
                          </p>
                          {linha.incompleta ? (
                            <span className="rounded-full bg-crimson-bg px-2.5 py-0.5 text-[11px] font-bold text-crimson">
                              dupla incompleta
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[15px] leading-snug text-ink-soft">
                          {linha.dupla.length ? linha.dupla.join(' · ') : 'Sem dupla'}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-card p-5 text-center shadow-sm">
              <p className="flex items-center justify-center gap-2 text-sm text-muted">
                <MapPin className="size-4 text-teal" aria-hidden="true" />
                Nenhum horário com esses filtros.
              </p>
              <Botao
                variante="fantasma"
                className="mt-2"
                onClick={() => {
                  setIsoFiltro('')
                  setPontoFiltro('')
                }}
              >
                Limpar filtros
              </Botao>
            </div>
          )}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-md gap-2">
          <Botao
            variante="primario"
            className="flex-1"
            disabled={estado !== 'pronto' || !linhasFiltradas.length}
            onClick={aoPdf}
          >
            <FileDown className="size-4" aria-hidden="true" />
            Baixar PDF
          </Botao>
          <Botao
            variante="secundario"
            className="flex-1"
            disabled={estado !== 'pronto'}
            onClick={copiarLinkPublico}
          >
            <Link2 className="size-4" aria-hidden="true" />
            Copiar link
          </Botao>
        </div>
      </div>

      {estado === 'pronto' && mesAtivo && linhasFiltradas.length ? (
        <div className="fixed left-[-10000px] top-0 w-[760px] overflow-hidden" aria-hidden="true">
          <TplCard
            ref={cardRef}
            congregacao={congregacao}
            mes={mes}
            linhas={linhasFiltradas}
          />
        </div>
      ) : null}
    </div>
  )
}
