import type { DadosTpl } from '../lib/dominio'
import type { OcorrenciaTpl } from '../lib/tpl'
import { useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCcw, ShoppingCart } from 'lucide-react'
import { chaveMes, isoDeHoje, lerChaveMes, mesDaUrl, nomeMes } from '../lib/datas'
import { infoDia } from '../lib/constants'
import {
  TITULO_TPL,
  efetivasTpl,
  mesesTpl,
  normalizarDadosTpl,
  ocorrenciasTpl,
  registroTplDe,
  turnoTexto,
} from '../lib/tpl'
import { MINIMO_DUPLA } from '../lib/dominio'
import { Botao } from './ui'
import { CardHeroTpl, LinhaTpl } from './CardsDesignacao'

type Estado = 'carregando' | 'pronto' | 'vazio' | 'erro'

/** Data de hoje resolvida uma vez (evita Date instável no render). */
const HOJE_ISO = isoDeHoje()
const [HOJE_ANO, HOJE_MES] = HOJE_ISO.split('-').map(Number)

/** Meses que têm períodos cadastrados e, portanto, linhas para mostrar. */
function mesesComConteudo(dados: DadosTpl): string[] {
  return mesesTpl(dados).filter((chave) => {
    const { ano, mes } = lerChaveMes(chave)
    return ocorrenciasTpl(ano, mes, dados.periodos).length > 0
  })
}

/**
 * Rota pública /tpl/:slug — mesma visão do administrador: cabeçalho do setor,
 * card "Próxima designação" (Data/Retirada, Trabalho e Voluntários) e a lista
 * de "Próximos dias". Sem botões de PDF/link: aqui só se consulta a escala.
 */
export default function TelaTplPublica({ slug }: { slug: string }) {
  const [estado, setEstado] = useState<Estado>('carregando')
  const [dadosBrutos, setDadosBrutos] = useState<unknown>(null)
  const [congregacao, setCongregacao] = useState('')
  const [mesAtivo, setMesAtivo] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)

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
        const pedido = mesDaUrl()
        setDadosBrutos(brutos)
        setCongregacao(corpo.congregacao?.nome ?? '')
        setMesAtivo(pedido && meses.includes(pedido) ? pedido : mesInicial(meses))
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

  const porId = useMemo(
    () => new Map(dados.participantes.map((p) => [p.id, p])),
    [dados.participantes],
  )
  const registro = useMemo(
    () => (mesAtivo ? registroTplDe(dados, mesAtivo) : null),
    [dados, mesAtivo],
  )
  const efetivas = useMemo(() => (registro ? efetivasTpl(registro) : {}), [registro])
  const ocorrencias = useMemo(
    () => (mesAtivo ? ocorrenciasTpl(ano, mes, dados.periodos) : []),
    [mesAtivo, ano, mes, dados.periodos],
  )

  const ehMesAtual = ano === HOJE_ANO && mes === HOJE_MES - 1
  const proximas = ehMesAtual ? ocorrencias.filter((o) => o.iso >= HOJE_ISO) : ocorrencias
  const destaque = proximas[0] ?? null
  const ehHoje = Boolean(destaque && destaque.iso === HOJE_ISO)
  const posteriores = destaque ? proximas.filter((o) => o.key !== destaque.key) : proximas

  function itemDe(oc: OcorrenciaTpl) {
    const ponto = dados.pontos.find((p) => p.id === oc.periodo.pontoId)
    const local = dados.locais.find((l) => l.id === oc.periodo.localId)
    const nomes = (efetivas[oc.key]?.ids ?? []).map((id) =>
      id ? (porId.get(id)?.nome ?? null) : null,
    )
    const turno = turnoTexto(oc.periodo)
    return {
      key: oc.key,
      iso: oc.iso,
      diaSemana: oc.diaSemana,
      ponto: ponto?.nome ?? 'Ponto',
      turno,
      local: local?.nome ?? null,
      detalhe: `${ponto?.nome ?? 'Ponto'} · ${turno}${local ? ` · ${local.nome}` : ''}`,
      nomes,
      designadas: nomes.filter(Boolean).length,
      total: MINIMO_DUPLA,
    }
  }

  const itemDestaque = destaque ? itemDe(destaque) : null

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 pb-16">
      <header className="mb-5 flex items-start gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal text-white shadow-sm"
          aria-hidden="true"
        >
          <ShoppingCart className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-base font-bold leading-snug tracking-tight text-ink">
            {TITULO_TPL}
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
        <div className="rounded-xl bg-card p-5 text-center shadow-sm">
          <p className="text-sm text-muted">Ainda não há uma escala publicada neste link.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {itemDestaque ? (
            <CardHeroTpl
              rotulo={ehMesAtual ? 'Próxima designação' : 'Primeira designação'}
              dia={`${infoDia(itemDestaque.diaSemana).curto}, ${itemDestaque.iso.slice(8, 10)}/${itemDestaque.iso.slice(5, 7)}`}
              ehHoje={ehHoje}
              ponto={itemDestaque.ponto}
              turno={itemDestaque.turno}
              local={itemDestaque.local}
              nomes={itemDestaque.nomes}
              designadas={itemDestaque.designadas}
              total={itemDestaque.total}
            />
          ) : (
            <section className="rounded-2xl border border-dashed border-line bg-card px-6 py-9 text-center">
              <p className="mx-auto max-w-sm text-sm text-muted">
                Não há mais saídas de TPL a partir de hoje neste mês.
              </p>
            </section>
          )}

          {posteriores.length ? (
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-2 px-1">
                <h2 className="text-lg font-semibold text-ink">Próximos dias</h2>
                <p className="text-[13px] text-muted">
                  {posteriores.length} próxima{posteriores.length === 1 ? '' : 's'} saída
                  {posteriores.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {posteriores.map((oc) => (
                  <LinhaTpl key={oc.key} item={itemDe(oc)} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}

/**
 * Escolhe o mês mais útil para abrir: o atual se já tiver duplas, depois o
 * próximo com duplas, depois o último mês passado com duplas e, por fim, o
 * mês mais recente que tenha estrutura para mostrar.
 */
function mesInicial(meses: string[]): string | null {
  if (!meses.length) return null
  const agora = new Date()
  const atual = chaveMes(agora.getFullYear(), agora.getMonth())
  const futuros = meses.filter((chave) => chave >= atual)
  const passados = meses.filter((chave) => chave < atual)
  return futuros[0] ?? passados[passados.length - 1] ?? meses[meses.length - 1] ?? null
}
