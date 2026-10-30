import type { DadosAvi } from '../lib/dominio'
import { useEffect, useMemo, useState } from 'react'
import { Loader2, Radio, RefreshCcw } from 'lucide-react'
import { FUNCOES_AVI } from '../lib/dominio'
import {
  TITULO_AVI,
  designacoesDe,
  efetivasAvi,
  normalizarDadosAvi,
  ocorrenciasAvi,
  registroAviDe,
} from '../lib/avi'
import { isoDeHoje, lerChaveMes, mesDaUrl, nomeMes } from '../lib/datas'
import { nomeDiaCurto } from '../lib/constants'
import { Botao, Select } from './ui'
import { CardHeroAvi, LinhaAvi } from './CardsDesignacao'

type Estado = 'carregando' | 'pronto' | 'vazio' | 'erro'

interface IrmaoPublico {
  id: string
  nome: string
  ativo: boolean
}

/** Data de hoje resolvida uma vez (evita Date instável no render). */
const HOJE_ISO = isoDeHoje()
const [HOJE_ANO, HOJE_MES] = HOJE_ISO.split('-').map(Number)

/**
 * Rota pública /escala/:slug/AVI — mesma visão do administrador: cabeçalho do
 * setor, card "Próxima reunião" e a lista de "Designações futuras". Sem botões de
 * PDF/link: aqui só se consulta a escala.
 */
export default function TelaAviPublica({ slug }: { slug: string }) {
  const [estado, setEstado] = useState<Estado>('carregando')
  const [dadosBrutos, setDadosBrutos] = useState<unknown>(null)
  const [irmoes, setIrmoes] = useState<IrmaoPublico[]>([])
  const [congregacao, setCongregacao] = useState('')
  const [mesAtivo, setMesAtivo] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)

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
        const pedido = mesDaUrl()
        setMesAtivo(
          pedido && gerados.includes(pedido)
            ? pedido
            : gerados.length
              ? gerados[gerados.length - 1]
              : null,
        )
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

  const porId = useMemo(() => new Map(irmoes.map((i) => [i.id, i])), [irmoes])

  const ocorrencias = useMemo(
    () => (mesAtivo ? ocorrenciasAvi(ano, mes, dados.diasReuniao) : []),
    [mesAtivo, ano, mes, dados.diasReuniao],
  )
  const efetivas = useMemo(() => {
    if (!mesAtivo) return {}
    return efetivasAvi(registroAviDe(dados, mesAtivo))
  }, [dados, mesAtivo])

  const ehMesAtual = ano === HOJE_ANO && mes === HOJE_MES - 1
  const proximas = ehMesAtual ? ocorrencias.filter((o) => o.iso >= HOJE_ISO) : ocorrencias
  const destaque = proximas[0] ?? null
  const ehHoje = Boolean(destaque && destaque.iso === HOJE_ISO)
  const posteriores = destaque ? proximas.filter((o) => o.iso > destaque.iso) : []
  /** A reunião seguinte ganha um card próprio logo abaixo do destaque. */
  const seguinte = posteriores[0] ?? null
  const futuras = posteriores.slice(1)

  function itemAvi(oc: { iso: string; diaSemana: number }) {
    const linhas = designacoesDe(oc.iso, efetivas, porId)
    return {
      key: oc.iso,
      iso: oc.iso,
      diaSemana: oc.diaSemana,
      resumo: linhas
        .filter((l) => l.nome)
        .map((l) => `${l.rotulo}: ${l.nome}`)
        .join(' · '),
      designadas: linhas.filter((l) => l.nome).length,
      total: FUNCOES_AVI.length,
    }
  }

  const linhasDestaque = destaque ? designacoesDe(destaque.iso, efetivas, porId) : []
  const designadasDestaque = linhasDestaque.filter((l) => l.nome).length
  const rotuloDestaque = ehMesAtual ? 'Próxima reunião' : 'Primeira reunião'
  const diaDestaque = destaque
    ? `${nomeDiaCurto(destaque.diaSemana)}, ${destaque.iso.slice(8, 10)}/${destaque.iso.slice(5, 7)}`
    : ''

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 pb-16">
      <header className="mb-5 flex items-start gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal text-white shadow-sm"
          aria-hidden="true"
        >
          <Radio className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-base font-bold leading-snug tracking-tight text-ink">
            {TITULO_AVI}
            {congregacao ? ` - ${congregacao}` : ''}
          </h1>
          <p className="mt-0.5 text-xs text-muted">
            {mesAtivo ? `${nomeMes(mes)} de ${ano}` : 'Escala do setor'}
          </p>
        </div>
      </header>

      {estado === 'carregando' ? (
        <p className="flex items-center justify-center gap-2 rounded-xl bg-card p-5 text-sm text-muted shadow-sm">
          <Loader2 className="size-4 animate-spin text-teal" aria-hidden="true" />
          Carregando escala…
        </p>
      ) : estado === 'erro' ? (
        <div className="rounded-xl bg-card p-5 text-center shadow-sm">
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
        <div className="rounded-xl bg-card p-5 text-center shadow-sm">
          <p className="text-sm text-muted">Nenhuma escala publicada neste link ainda.</p>
        </div>
      ) : (
        <div className="space-y-5">
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

          {destaque ? (
            <CardHeroAvi
              rotulo={rotuloDestaque}
              dia={diaDestaque}
              ehHoje={ehHoje}
              linhas={linhasDestaque}
              designadas={designadasDestaque}
              total={FUNCOES_AVI.length}
            />
          ) : (
            <section className="rounded-2xl border border-dashed border-line bg-card px-6 py-9 text-center">
              <p className="mx-auto max-w-sm text-sm text-muted">
                Não há mais reuniões AVI a partir de hoje neste mês.
              </p>
            </section>
          )}

          {seguinte ? <LinhaAvi item={itemAvi(seguinte)} /> : null}

          {futuras.length ? (
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-2 px-1">
                <h2 className="text-lg font-semibold text-ink">Designações futuras</h2>
                <p className="text-[13px] text-muted">
                  {futuras.length} próxima{futuras.length === 1 ? '' : 's'} reunião
                  {futuras.length === 1 ? '' : 'ões'}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {futuras.map((oc) => (
                  <LinhaAvi key={oc.iso} item={itemAvi(oc)} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}
