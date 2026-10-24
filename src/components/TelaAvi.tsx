import type { AptidaoId, DadosAvi } from '../lib/dominio'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  ImageDown,
  RefreshCcw,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { FUNCOES_AVI } from '../lib/dominio'
import { CITACAO, CONGREGACAO_PADRAO, infoDia } from '../lib/constants'
import { chaveMes, nomeMes } from '../lib/datas'
import {
  TITULO_AVI,
  aptidoesDe,
  efetivasAvi,
  gerarAviDoMes,
  normalizarDadosAvi,
  ocorrenciasAvi,
  registroAviDe,
  slotAvi,
} from '../lib/avi'
import { carregarSetorExtenso, ErroAuth, salvarDadosSetor } from '../lib/authApi'
import { baixarImagem, baixarPdf, capturarNo, compartilhar } from '../lib/export'
import AviCard from './AviCard'
import { Botao, Modal, Rotulo, Select, Vazio } from './ui'

interface Secao {
  id: 'fds' | 'meio'
  rotulo: string
  banda: string
  texto: string
  linha: string
}

const SECOES: readonly Secao[] = [
  {
    id: 'fds',
    rotulo: 'Fim de semana',
    banda: 'bg-petrol text-white',
    texto: 'text-petrol',
    linha: 'border-petrol/30',
  },
  {
    id: 'meio',
    rotulo: 'Meio de semana',
    banda: 'bg-wine text-white',
    texto: 'text-wine',
    linha: 'border-wine/30',
  },
]

const TITULO_CARTAO = TITULO_AVI

/** Tela do setor AVI: escala mensal por designação, cadastro unificado e exportação. */
export default function TelaAvi({
  aoAvisar,
  aoIrParaPessoas,
}: {
  aoAvisar: (texto: string) => void
  /** Abre a tela Pessoas (designações AVI) — administrador. */
  aoIrParaPessoas?: () => void
}) {
  const [dadosBrutos, setDadosBrutos] = useState<unknown>(null)
  const [irmoes, setIrmoes] = useState<Array<{ id: string; nome: string; ativo: boolean }>>([])
  const [congregacao, setCongregacao] = useState(CONGREGACAO_PADRAO)
  const [carregado, setCarregado] = useState(false)
  const [falhaCarga, setFalhaCarga] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const [ano, setAno] = useState(() => new Date().getFullYear())
  const [mes, setMes] = useState(() => new Date().getMonth())
  const [confirmando, setConfirmando] = useState<'gerar' | 'limparAjustes' | 'limparEscala' | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const dados: DadosAvi = useMemo(() => normalizarDadosAvi(dadosBrutos), [dadosBrutos])
  const chave = chaveMes(ano, mes)

  useEffect(() => {
    let vivo = true
    setCarregado(false)
    setFalhaCarga(false)
    carregarSetorExtenso('AUDIO_VIDEO')
      .then((resposta) => {
        if (!vivo) return
        setDadosBrutos(resposta.dados)
        setIrmoes(resposta.dirigentes ?? [])
        setCongregacao(resposta.config?.congregacao ?? CONGREGACAO_PADRAO)
        setCarregado(true)
      })
      .catch((falha: unknown) => {
        if (!vivo) return
        setDadosBrutos(null)
        setCarregado(true)
        const sessaoExpirada =
          falha instanceof ErroAuth && (falha.status === 401 || falha.status === 403)
        setFalhaCarga(!sessaoExpirada)
        if (sessaoExpirada) aoAvisar('Sessão expirada. Entre novamente.')
      })
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega por tentativa
  }, [tentativa])

  const registro = registroAviDe(dados, chave)
  const efetivas = useMemo(() => efetivasAvi(registro), [registro])
  const ocorrencias = useMemo(
    () => ocorrenciasAvi(ano, mes, dados.diaSemanaMeio),
    [ano, mes, dados.diaSemanaMeio],
  )
  const gerado = Boolean(registro.geradoEm)

  const totalSlots = ocorrencias.length * FUNCOES_AVI.length
  const preenchidos = useMemo(() => {
    let n = 0
    for (const oc of ocorrencias) {
      for (const f of FUNCOES_AVI) if (efetivas[slotAvi(oc.iso, f.id)]) n += 1
    }
    return n
  }, [ocorrencias, efetivas])
  const pronta = gerado && totalSlots > 0 && preenchidos === totalSlots
  const temManuais = Object.keys(registro.manuais ?? {}).length > 0

  const aptosPorFuncao = useMemo(() => {
    const mapa: Record<AptidaoId, string[]> = { som: [], video: [], palco: [], microfone: [], indicador: [] }
    for (const irmao of irmoes) {
      for (const aptidao of aptidoesDe(dados, irmao.id)) mapa[aptidao].push(irmao.id)
    }
    return mapa
  }, [dados, irmoes])

  const funcoesSemApto = FUNCOES_AVI.filter(
    (f) => ocorrencias.length > 0 && aptosPorFuncao[f.id].length === 0,
  )
  const porId = useMemo(() => new Map(irmoes.map((i) => [i.id, i])), [irmoes])

  async function persistir(novos: DadosAvi): Promise<boolean> {
    setDadosBrutos(novos)
    try {
      await salvarDadosSetor('AUDIO_VIDEO', novos as unknown as Record<string, unknown>)
      return true
    } catch (falha) {
      if (falha instanceof ErroAuth && (falha.status === 401 || falha.status === 403)) {
        aoAvisar('Sessão expirada. Entre novamente.')
      } else {
        aoAvisar('Não foi possível salvar na nuvem. Tente de novo.')
      }
      return false
    }
  }

  function executarGeracao() {
    if (!carregado || ocupado) return
    setOcupado(true)
    const geradoNovo = gerarAviDoMes(dados, irmoes, chave, { forcar: true })
    void persistir(geradoNovo).then(() => {
      setOcupado(false)
      aoAvisar(
        ocorrencias.length
          ? `Escala AVI de ${nomeMes(mes)} de ${ano} gerada.`
          : 'Nenhuma reunião AVI neste mês.',
      )
    })
    setConfirmando(null)
  }

  function pedirGeracao() {
    if (gerado) setConfirmando('gerar')
    else executarGeracao()
  }

  function alterarSlot(slot: string, idIrmao: string) {
    const manuais = { ...(registro.manuais ?? {}) }
    if (idIrmao === (registro.auto ?? {})[slot]) delete manuais[slot]
    else manuais[slot] = idIrmao
    void persistir({
      ...dados,
      escalas: { ...dados.escalas, [chave]: { ...registro, manuais } },
    })
  }

  function limparAjustes() {
    void persistir({
      ...dados,
      escalas: { ...dados.escalas, [chave]: { ...registro, manuais: {} } },
    }).then(() => aoAvisar('Ajustes manuais removidos.'))
    setConfirmando(null)
  }

  function limparEscala() {
    const escalas = { ...dados.escalas }
    delete escalas[chave]
    void persistir({ ...dados, escalas }).then(() =>
      aoAvisar(`Escala de ${nomeMes(mes)} de ${ano} limpa.`),
    )
    setConfirmando(null)
  }

  function mudarMeioDia(valor: string) {
    const novo = valor === '4' ? 4 : 3
    if (novo === dados.diaSemanaMeio) return
    void persistir({ ...dados, diaSemanaMeio: novo }).then(() => {
      aoAvisar(
        gerado
          ? `Meio de semana agora é ${novo === 4 ? 'quinta' : 'quarta'}. Gere a escala de novo para aplicar.`
          : `Reunião de meio de semana: ${novo === 4 ? 'quinta-feira' : 'quarta-feira'}.`,
      )
    })
  }

  function textoCompartilhado(): string {
    const linhas = [`*${TITULO_CARTAO}*`, `${congregacao} — ${nomeMes(mes)} de ${ano}`, '']
    for (const secao of SECOES) {
      const alvo = secao.id === 'fds' ? 0 : dados.diaSemanaMeio === 4 ? 4 : 3
      for (const oc of ocorrencias) {
        if (oc.diaSemana !== alvo) continue
        linhas.push(`*${infoDia(oc.diaSemana).nome} ${oc.dia}*`)
        const partes = FUNCOES_AVI.map((f) => {
          const id = efetivas[slotAvi(oc.iso, f.id)]
          return `${f.rotulo}: ${id ? (porId.get(id)?.nome ?? '') : '—'}`
        })
        linhas.push(`> ${partes.join(' · ')}`)
      }
    }
    linhas.push('', `_${CITACAO}_`)
    return linhas.join('\n')
  }

  async function aoCompartilhar() {
    try {
      const canvas = await capturarNo(cardRef.current)
      const resultado = await compartilhar({
        canvas,
        chave,
        texto: textoCompartilhado(),
        prefixo: 'avi',
        titulo: `AVI de ${nomeMes(mes)} de ${ano}`,
      })
      if (resultado === 'copiado') aoAvisar('Texto da escala copiado.')
    } catch {
      aoAvisar('Não foi possível compartilhar agora.')
    }
  }

  async function aoPdf() {
    try {
      await baixarPdf(cardRef.current, chave, 'avi')
    } catch {
      aoAvisar('Não foi possível gerar o PDF.')
    }
  }

  async function aoPng() {
    try {
      await baixarImagem(cardRef.current, chave, 'avi')
    } catch {
      aoAvisar('Não foi possível gerar a imagem.')
    }
  }

  function mudarMes(delta: number) {
    const base = new Date(ano, mes + delta, 1)
    setAno(base.getFullYear())
    setMes(base.getMonth())
  }

  if (!carregado) {
    return (
      <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
        <RefreshCcw className="size-4 animate-spin text-teal" aria-hidden="true" />
        Carregando setor…
      </p>
    )
  }

  const status = !gerado ? 'não gerada' : pronta ? 'pronta' : 'pendente'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Botao
          variante="fantasma"
          aria-label="Mês anterior"
          className="px-2"
          onClick={() => mudarMes(-1)}
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </Botao>
        <h2 className="text-lg font-bold text-ink">
          {nomeMes(mes)} de {ano}
        </h2>
        <Botao
          variante="fantasma"
          aria-label="Próximo mês"
          className="px-2"
          onClick={() => mudarMes(1)}
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </Botao>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            status === 'pronta'
              ? 'bg-success-bg text-success'
              : status === 'pendente'
                ? 'bg-crimson-bg text-crimson'
                : 'bg-line text-ink-soft'
          }`}
        >
          {status === 'não gerada'
            ? 'Escala não gerada'
            : status === 'pronta'
              ? `Completa · ${preenchidos} designações`
              : `Pendente · ${preenchidos}/${totalSlots}`}
        </span>

        {aoIrParaPessoas ? (
          <Botao
            variante="fantasma"
            className="px-2.5 py-1.5 text-[13px]"
            onClick={aoIrParaPessoas}
          >
            Designações AVI
          </Botao>
        ) : (
          <span className="max-w-[55%] text-right text-[13px] text-muted">
            As designações ficam em Pessoas, pelo administrador.
          </span>
        )}
      </div>

      {falhaCarga ? (
        <p className="flex items-center justify-between gap-2 rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] text-ink">
          Não foi possível carregar os dados do setor.
          <button
            type="button"
            className="font-bold text-crimson underline"
            onClick={() => setTentativa((t) => t + 1)}
          >
            Tentar de novo
          </button>
        </p>
      ) : null}

      <section className="rounded-2xl bg-card p-4 shadow-sm">
            <Rotulo htmlFor="avi-meio">Reunião de meio de semana</Rotulo>
            <Select
              id="avi-meio"
              value={dados.diaSemanaMeio === 4 ? '4' : '3'}
              onChange={(e) => mudarMeioDia(e.target.value)}
            >
              <option value="3">Quarta-feira</option>
              <option value="4">Quinta-feira</option>
            </Select>
            <p className="mt-2 text-[13px] text-muted">
              Os domingos do mês formam a seção de fim de semana; o meio de semana usa {dados.diaSemanaMeio === 4 ? 'quinta' : 'quarta'}.
            </p>
          </section>

          {funcoesSemApto.length ? (
            <p className="rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] text-ink">
              Nenhum irmão apto para: {funcoesSemApto.map((f) => f.rotulo).join(', ')}. Marque as
              designações em Pessoas.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Botao variante="primario" onClick={pedirGeracao} disabled={ocupado}>
              <Sparkles className="size-4" aria-hidden="true" />
              {gerado ? 'Gerar novamente' : 'Gerar escala'}
            </Botao>
            {temManuais ? (
              <Botao variante="secundario" onClick={() => setConfirmando('limparAjustes')}>
                <RefreshCcw className="size-4" aria-hidden="true" />
                Limpar ajustes
              </Botao>
            ) : null}
            {gerado ? (
              <Botao variante="fantasma" className="text-crimson" onClick={() => setConfirmando('limparEscala')}>
                <Trash2 className="size-4" aria-hidden="true" />
                Limpar escala
              </Botao>
            ) : null}
          </div>

          {gerado ? (
            <div className="flex flex-wrap gap-2">
              <Botao variante="secundario" onClick={aoPdf}>
                <FileDown className="size-4" aria-hidden="true" />
                Baixar PDF
              </Botao>
              <Botao variante="secundario" onClick={aoPng}>
                <ImageDown className="size-4" aria-hidden="true" />
                Baixar PNG
              </Botao>
              <Botao variante="secundario" onClick={aoCompartilhar}>
                <Share2 className="size-4" aria-hidden="true" />
                Compartilhar
              </Botao>
            </div>
          ) : null}

          {!ocorrencias.length ? (
            <Vazio
              icone={Sparkles}
              titulo={`Nenhuma reunião AVI em ${nomeMes(mes)} de ${ano}.`}
            />
          ) : (
            SECOES.map((secao) => {
              const alvo = secao.id === 'fds' ? 0 : dados.diaSemanaMeio === 4 ? 4 : 3
              const reunioes = ocorrencias.filter((oc) => oc.diaSemana === alvo)
              if (!reunioes.length) return null
              return (
                <section key={secao.id} className="space-y-2">
                  <div className={`rounded-xl px-3 py-2 text-sm font-bold uppercase tracking-wide ${secao.banda}`}>
                    {secao.rotulo}
                  </div>
                  {reunioes.map((oc) => (
                    <article
                      key={oc.iso}
                      className={`rounded-2xl border bg-card p-4 shadow-sm ${secao.linha}`}
                    >
                      <h3 className={`text-sm font-bold ${secao.texto}`}>
                        {infoDia(oc.diaSemana).nome} · {oc.dia}/{String(mes + 1).padStart(2, '0')}
                      </h3>
                      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {FUNCOES_AVI.map((f) => {
                          const slot = slotAvi(oc.iso, f.id)
                          const idAtual = efetivas[slot] ?? ''
                          const aptos = new Set(aptosPorFuncao[f.id])
                          const opcoes = [...irmoes]
                            .filter((i) => i.ativo || i.id === idAtual)
                            .sort((a, b) => Number(aptos.has(b.id)) - Number(aptos.has(a.id)) || a.nome.localeCompare(b.nome))
                          return (
                            <div key={f.id}>
                              <label
                                htmlFor={`avi-${slot}`}
                                className="block text-[12px] font-semibold text-muted"
                              >
                                {f.rotulo}
                              </label>
                              <Select
                                id={`avi-${slot}`}
                                className="mt-0.5"
                                value={idAtual}
                                onChange={(e) => alterarSlot(slot, e.target.value)}
                              >
                                <option value="">— Sem designação —</option>
                                {opcoes.map((i) => (
                                  <option key={i.id} value={i.id}>
                                    {i.nome}
                                    {aptos.has(i.id) ? '' : i.ativo ? ' (não apto)' : ' (inativo)'}
                                  </option>
                                ))}
                              </Select>
                            </div>
                          )
                        })}
                      </div>
                    </article>
                  ))}
                </section>
              )
            })
          )}

      {gerado ? (
        <div className="fixed left-[-10000px] top-0 w-[760px] overflow-hidden" aria-hidden="true">
          <AviCard
            ref={cardRef}
            congregacao={congregacao}
            ano={ano}
            mes={mes}
            dados={dados}
            irmoes={irmoes}
          />
        </div>
      ) : null}

      <Modal
        aberto={confirmando !== null}
        aoFechar={() => setConfirmando(null)}
        titulo={
          confirmando === 'gerar'
            ? 'Gerar novamente?'
            : confirmando === 'limparAjustes'
              ? 'Limpar ajustes manuais?'
              : 'Limpar escala do mês?'
        }
        descricao={
          confirmando === 'gerar'
            ? `A escala de ${nomeMes(mes)} de ${ano} será refeita. Os ajustes manuais são preservados.`
            : confirmando === 'limparAjustes'
              ? 'Todas as linhas voltam ao rodízio automático.'
              : 'A escala deste mês será apagada. Esta ação não pode ser desfeita.'
        }
        largura="max-w-sm"
      >
        <div className="flex gap-2 px-5 py-4">
          <Botao className="flex-1" onClick={() => setConfirmando(null)}>
            Cancelar
          </Botao>
          <Botao
            variante={confirmando === 'limparEscala' ? 'vinho' : 'primario'}
            className="flex-1"
            onClick={() => {
              if (confirmando === 'gerar') executarGeracao()
              else if (confirmando === 'limparAjustes') limparAjustes()
              else if (confirmando === 'limparEscala') limparEscala()
            }}
          >
            {confirmando === 'gerar' ? 'Gerar' : 'Confirmar'}
          </Botao>
        </div>
      </Modal>
    </div>
  )
}
