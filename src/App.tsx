import type { AbaNav, Estado, RegistroMes, Tela, Usuario } from './lib/dominio'
import { useEffect, useMemo, useRef, useState } from 'react'
import AppHeader from './components/AppHeader'
import type { Notificacao } from './components/SinoNotificacoes'
import BottomNav from './components/BottomNav'
import ConfigCampos from './components/ConfigCampos'
import EscalaCard from './components/EscalaCard'
import ExportModal from './components/ExportModal'
import Locais from './components/Locais'
import ResumoDesignacao from './components/ResumoDesignacao'
import Splash from './components/Splash'
import TabelaEscala from './components/TabelaEscala'
import TelaAvi from './components/TelaAvi'
import TelaAviPublica from './components/TelaAviPublica'
import TelaConvite from './components/TelaConvite'
import TelaDesignacoes from './components/TelaDesignacoes'
import TelaEscalaPublica from './components/TelaEscalaPublica'
import TelaLogin from './components/TelaLogin'
import TelaPessoas from './components/TelaPessoas'
import TelaTpl from './components/TelaTpl'
import TelaTplPublica from './components/TelaTplPublica'
import TelaVer from './components/TelaVer'
import { Modal } from './components/ui'
import { lerHashVer, linkDe, montarPayload } from './lib/compartilhamento'
import { chaveMes, ocorrenciasDoMes, nomeMes } from './lib/datas'
import { estadoInicial, registroDe } from './lib/estadoInicial'
import { gerarEscalaDoMes, proximoMes } from './lib/gerador'
import { Erro401, carregarEstado, gerarEscalaRemota, salvarEstado } from './lib/api'
import { sair as sairAuth, sessaoAtual } from './lib/authApi'

type StatusId = 'carregando' | 'salvando' | 'sincronizado' | 'local' | 'erro'

/** Rotas públicas (não exigem sessão): convite do ajudante e escala por slug. */
type RotaPublica =
  | { tipo: 'convite'; token: string }
  | { tipo: 'tpl'; slug: string }
  | { tipo: 'escala'; slug: string; setor: 'CAMPO' | 'AUDIO_VIDEO' }
  | null

function lerRotaPublica(): RotaPublica {
  const caminho = window.location.pathname
  if (caminho.startsWith('/aceitar-convite')) {
    const token = new URLSearchParams(window.location.search).get('token') ?? ''
    return token ? { tipo: 'convite', token } : null
  }
  const escala = caminho.match(/^\/escala\/([^/]+)\/([^/]+)\/?$/)
  if (escala) {
    const slug = decodeURIComponent(escala[1])
    const setor = escala[2].toUpperCase()
    if (setor === 'CAMPO') return { tipo: 'escala', slug, setor: 'CAMPO' }
    if (setor === 'AVI' || setor === 'AUDIO_VIDEO' || setor === 'AUDIO-VIDEO') {
      return { tipo: 'escala', slug, setor: 'AUDIO_VIDEO' }
    }
    if (setor === 'TPL') return { tipo: 'tpl', slug }
    return null
  }
  const casamento = caminho.match(/^\/tpl\/([^/]+)\/?$/)
  if (casamento) return { tipo: 'tpl', slug: decodeURIComponent(casamento[1]) }
  return null
}

function permiteCampo(usuario: Usuario | null): boolean {
  return Boolean(usuario && (usuario.papel === 'ADMIN' || usuario.setor === 'CAMPO'))
}

function telaInicialPara(_usuario: Usuario): Tela {
  return 'designacoes'
}

/** Aba inferior ativa para cada tela. */
const ABA_DA_TELA: Record<Tela, AbaNav> = {
  designacoes: 'designacoes',
  campo: 'designacoes',
  montagem: 'designacoes',
  avi: 'designacoes',
  tpl: 'designacoes',
  pessoas: 'pessoas',
  ajustes: 'ajustes',
  locais: 'ajustes',
}

export default function App() {
  const [estado, setEstado] = useState<Estado>(estadoInicial)
  const [pronto, setPronto] = useState(false)
  const [splash, setSplash] = useState<'ativo' | 'saindo' | null>('ativo')
  const [status, setStatus] = useState<StatusId>('carregando')
  const [tela, setTela] = useState<Tela>('designacoes')
  const [ano, setAno] = useState(() => new Date().getFullYear())
  const [mes, setMes] = useState(() => new Date().getMonth())
  const [manterManuais, setManterManuais] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [tabelaAberta, setTabelaAberta] = useState(false)
  const [aviso, setAviso] = useState('')
  const [payloadVer, setPayloadVer] = useState<string | null>(() => lerHashVer())
  const [rota, setRota] = useState<RotaPublica>(() => lerRotaPublica())
  const [sessao, setSessao] = useState<'verificando' | 'sem' | 'ok'>('verificando')
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  /** De onde a tela Locais foi aberta (para o voltar correto). */
  const [voltaLocais, setVoltaLocais] = useState<Tela>('ajustes')
  const cardRef = useRef<HTMLDivElement>(null)
  const inicioSplash = useRef(0)

  const { dirigentes, config_campos: campos, escalas } = estado
  const config = escalas._config
  const chave = chaveMes(ano, mes)
  const registro = registroDe(escalas, chave)
  const podeGerenciarCampo = permiteCampo(usuario)

  const ocorrencias = useMemo(
    () => ocorrenciasDoMes(ano, mes, campos, config),
    [ano, mes, campos, config],
  )

  const efetivas = useMemo(() => {
    const base = { ...(registro.auto ?? {}) }
    for (const [k, v] of Object.entries(registro.manuais ?? {})) base[k] = v
    return base
  }, [registro])

  const efetivasAjudante = useMemo(() => {
    const base = { ...(registro.autoAjudante ?? {}) }
    for (const [k, v] of Object.entries(registro.manuaisAjudante ?? {})) base[k] = v
    return base
  }, [registro])

  const designados = ocorrencias.filter((o) => efetivas[o.key]).length
  const pronta = ocorrencias.length > 0 && designados === ocorrencias.length

  const proximo = useMemo(() => proximoMes(ano, mes), [ano, mes])
  const proximoPronto = registroDe(escalas, proximo.chave).geradoEm != null

  function encerrarLocal() {
    setUsuario(null)
    setSessao('sem')
    setPronto(false)
    setStatus('carregando')
    setTela('designacoes')
  }

  async function tentarSincronizar() {
    setStatus('salvando')
    try {
      await salvarEstado(estado)
      setStatus('sincronizado')
    } catch (falha) {
      if (falha instanceof Erro401) {
        encerrarLocal()
        return
      }
      setStatus('erro')
    }
  }

  function montarNotificacoes(): Notificacao[] {
    const lista: Notificacao[] = []
    const pendentes = ocorrencias.length - designados

    if (status === 'erro') {
      lista.push({
        id: 'sync-erro',
        titulo: 'Sem sincronização',
        detalhe: 'Toque para tentar gravar na nuvem',
        tom: 'alerta',
        aoClicar: tentarSincronizar,
      })
    } else if (status === 'local') {
      lista.push({
        id: 'sync-local',
        titulo: 'Salvo neste aparelho',
        detalhe: 'Sem conexão com a nuvem no momento',
        tom: 'neutro',
      })
    }

    if (!dirigentes.length) {
      lista.push({
        id: 'sem-dirigentes',
        titulo: 'Nenhum dirigente cadastrado',
        detalhe: 'Cadastre a equipe para gerar a escala',
        tom: 'alerta',
        aoClicar: () => setTela('pessoas'),
      })
    } else if (!campos.length) {
      lista.push({
        id: 'sem-campos',
        titulo: 'Sem dias de campo',
        detalhe: 'Configure dia, horário e ponto de encontro',
        tom: 'alerta',
        aoClicar: () => setTela('locais'),
      })
    } else if (ocorrencias.length && pendentes > 0) {
      lista.push({
        id: `pend-${chave}`,
        titulo: `${pendentes} de ${ocorrencias.length} dias sem designação`,
        detalhe: `Monte a escala de ${nomeMes(mes)}`,
        tom: 'alerta',
        aoClicar: () => setTabelaAberta(true),
      })
    } else if (pronta) {
      lista.push({
        id: `pronta-${chave}`,
        titulo: `Designação de ${nomeMes(mes)} pronta`,
        detalhe: 'Todos os dias com dirigente',
        tom: 'sucesso',
        aoClicar: () => setTela('campo'),
      })
    }

    if (proximoPronto) {
      lista.push({
        id: `prox-${proximo.chave}`,
        titulo: `Escala de ${nomeMes(proximo.mes)} pronta`,
        detalhe: 'Abra para conferir o próximo mês',
        tom: 'sucesso',
        aoClicar: () => {
          setAno(proximo.ano)
          setMes(proximo.mes)
        },
      })
    }

    return lista
  }

  useEffect(() => {
    inicioSplash.current = Date.now()
    let vivo = true
    sessaoAtual()
      .then((novoUsuario) => {
        if (!vivo) return
        if (novoUsuario) {
          setUsuario(novoUsuario)
          setTela(telaInicialPara(novoUsuario))
          setSessao('ok')
        } else {
          setSessao('sem')
        }
      })
      .catch(() => {
        if (vivo) setSessao('sem')
      })
    return () => {
      vivo = false
    }
  }, [])

  // Carrega o estado (setor Campo) somente com sessão válida.
  useEffect(() => {
    if (sessao !== 'ok' || !usuario || !permiteCampo(usuario)) return undefined
    let vivo = true
    carregarEstado()
      .then(({ estado: carregado, origem }) => {
        if (!vivo) return
        setEstado(carregado)
        setPronto(true)
        setStatus(origem === 'nuvem' ? 'sincronizado' : 'local')
      })
      .catch((falha: unknown) => {
        if (falha instanceof Erro401 && vivo) encerrarLocal()
      })
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- encerrarLocal é estável por sessão
  }, [sessao, usuario])

  const sessaoResolvida = sessao !== 'verificando'
  const prontoParaSair =
    sessaoResolvida && (sessao !== 'ok' || pronto || !permiteCampo(usuario))

  useEffect(() => {
    if (!prontoParaSair || splash !== 'ativo') return undefined
    const restante = Math.max(0, 1100 - (Date.now() - inicioSplash.current))
    const saida = setTimeout(() => {
      setSplash('saindo')
      setTimeout(() => setSplash(null), 450)
    }, restante)
    return () => clearTimeout(saida)
  }, [prontoParaSair, splash])

  useEffect(() => {
    const aoMudarHash = () => setPayloadVer(lerHashVer())
    window.addEventListener('hashchange', aoMudarHash)
    return () => window.removeEventListener('hashchange', aoMudarHash)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [tela])

  useEffect(() => {
    if (!pronto || sessao !== 'ok' || !permiteCampo(usuario)) return undefined
    const timer = setTimeout(async () => {
      setStatus('salvando')
      try {
        await salvarEstado(estado)
        setStatus('sincronizado')
      } catch (falha) {
        if (falha instanceof Erro401) {
          encerrarLocal()
          return
        }
        setStatus('erro')
      }
    }, 800)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- encerrarLocal é estável por sessão
  }, [estado, pronto, sessao, usuario])

  useEffect(() => {
    if (!aviso) return undefined
    const timer = setTimeout(() => setAviso(''), 3200)
    return () => clearTimeout(timer)
  }, [aviso])

  function atualizar(fn: (estado: Estado) => Estado) {
    setEstado((atual) => fn(atual))
  }

  function alterarRegistro(chaveDoMes: string, novoRegistro: RegistroMes) {
    atualizar((e) => ({ ...e, escalas: { ...e.escalas, [chaveDoMes]: novoRegistro } as Estado['escalas'] }))
  }

  function gerar() {
    const manuais = manterManuais ? (registro.manuais ?? {}) : {}
    const manuaisAjudante = manterManuais ? (registro.manuaisAjudante ?? {}) : {}
    const atualizado: Estado = {
      ...estado,
      escalas: {
        ...estado.escalas,
        [chave]: { ...registro, manuais, manuaisAjudante },
      } as Estado['escalas'],
    }
    setEstado(gerarEscalaDoMes(atualizado, chave, { forcar: true }))
    setAviso(
      ocorrencias.length
        ? `Designação de ${nomeMes(mes)} de ${ano} gerada.`
        : 'Nenhum dia de campo neste mês.',
    )
  }

  /** Gera (ou tenta gerar) a escala do mês seguinte: Worker primeiro, local se offline. */
  async function adiantarProximoMes() {
    if (proximoPronto) {
      setAviso(`Escala de ${nomeMes(proximo.mes)} já existe.`)
      return
    }
    const resultado = await gerarEscalaRemota(proximo.chave)
    if (resultado.ok) {
      setEstado(resultado.estado)
      setAviso(`Escala de ${nomeMes(proximo.mes)} de ${proximo.ano} gerada.`)
      return
    }
    if (resultado.motivo === 'existe') {
      const { estado: doServidor } = await carregarEstado()
      setEstado(doServidor)
      setAviso(`Escala de ${nomeMes(proximo.mes)} já existe no servidor.`)
      return
    }
    setEstado(gerarEscalaDoMes(estado, proximo.chave))
    setAviso(`Sem conexão: escala de ${nomeMes(proximo.mes)} gerada neste aparelho.`)
  }

  /** Aplica o mesmo valor a várias ocorrências (linha agrupada de dia fixo). */
  function alterarDesignacoesLote(chaves: string[], valor: string) {
    const auto = registro.auto ?? {}
    const manuais = { ...(registro.manuais ?? {}) }

    for (const key of chaves) {
      if (valor === '') {
        if (auto[key]) manuais[key] = ''
        else delete manuais[key]
      } else if (valor === auto[key]) {
        delete manuais[key]
      } else {
        manuais[key] = valor
      }
    }

    alterarRegistro(chave, { ...registro, manuais })
  }

  function alterarAjudantesLote(chaves: string[], valor: string) {
    const auto = registro.autoAjudante ?? {}
    const manuaisAjudante = { ...(registro.manuaisAjudante ?? {}) }

    for (const key of chaves) {
      if (valor === '') {
        if (auto[key]) manuaisAjudante[key] = ''
        else delete manuaisAjudante[key]
      } else if (valor === auto[key]) {
        delete manuaisAjudante[key]
      } else {
        manuaisAjudante[key] = valor
      }
    }

    alterarRegistro(chave, { ...registro, manuaisAjudante })
  }

  function limparDesignacao() {
    alterarRegistro(chave, { auto: {}, manuais: {}, autoAjudante: {}, manuaisAjudante: {} })
    setAviso(`Designação de ${nomeMes(mes)} de ${ano} limpa.`)
  }

  function limparManuais() {
    alterarRegistro(chave, { ...registro, manuais: {}, manuaisAjudante: {} })
    setAviso('Ajustes manuais removidos: a escala voltou ao rodízio automático.')
  }

  function exportar() {
    if (tabelaAberta && !cardRef.current) {
      setAviso('Gere a designação antes de exportar.')
      return
    }
    setModalAberto(true)
  }

  function copiarLink() {
    try {
      const payload = montarPayload({
        config,
        chave,
        ocorrencias,
        designacoes: efetivas,
        dirigentes,
      })
      if (!payload.r.length) {
        setAviso('Gere a designação antes de copiar o link.')
        return
      }
      navigator.clipboard
        ?.writeText(linkDe(payload))
        .then(() => setAviso('Link da designação copiado.'))
        .catch(() => setAviso('Não foi possível copiar o link.'))
    } catch {
      setAviso('Não foi possível copiar o link.')
    }
  }

  function voltarDoApp() {
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    setPayloadVer(null)
  }

  function aoEntrar(novoUsuario: Usuario) {
    setUsuario(novoUsuario)
    setTela(telaInicialPara(novoUsuario))
    setSessao('ok')
    setRota(null)
    window.history.replaceState(null, '', '/')
  }

  async function aoSair() {
    await sairAuth()
    encerrarLocal()
    setAviso('Sessão encerrada.')
  }

  const ehRotaPublica = rota !== null || payloadVer !== null
  const abasDisponiveis: AbaNav[] = !usuario
    ? []
    : usuario.papel === 'ADMIN'
      ? ['designacoes', 'pessoas', 'ajustes']
      : usuario.setor === 'CAMPO'
        ? ['designacoes', 'pessoas']
        : ['designacoes']

  const abaNav: AbaNav = ABA_DA_TELA[tela] ?? 'designacoes'
  const tituloHeader =
    tela === 'designacoes'
      ? 'Designações'
      : tela === 'campo'
        ? 'Saídas de Campo'
        : tela === 'montagem'
          ? 'Montar designação'
          : tela === 'avi'
            ? 'Áudio, Vídeo e Indicadores'
            : tela === 'tpl'
              ? 'Testemunho Público Local'
              : tela === 'pessoas'
                ? 'Pessoas'
                : tela === 'ajustes'
                  ? 'Ajustes'
                  : tela === 'locais'
                    ? 'Locais de campo'
                    : 'Designações'

  const aoVoltarHeader =
    tela === 'montagem'
      ? () => setTela('campo')
      : tela === 'campo' || tela === 'avi' || tela === 'tpl'
        ? () => setTela('designacoes')
        : tela === 'locais'
          ? () => setTela(voltaLocais)
          : undefined

  if (payloadVer) {
    return (
      <div className="min-h-svh">
        <TelaVer payload={payloadVer} aoVoltar={voltarDoApp} aoAvisar={setAviso} />
        {aviso ? (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-5 left-1/2 z-50 max-w-[92vw] -translate-x-1/2 bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
          >
            {aviso}
          </div>
        ) : null}
      </div>
    )
  }

  if (rota?.tipo === 'convite') {
    return (
      <div className="min-h-svh">
        <TelaConvite token={rota.token} aoEntrar={aoEntrar} />
        {aviso ? (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-5 left-1/2 z-50 max-w-[92vw] -translate-x-1/2 bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
          >
            {aviso}
          </div>
        ) : null}
      </div>
    )
  }

  if (rota?.tipo === 'tpl') {
    return (
      <div className="min-h-svh">
        <TelaTplPublica slug={rota.slug} aoAvisar={setAviso} />
        {aviso ? (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-5 left-1/2 z-50 max-w-[92vw] -translate-x-1/2 bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
          >
            {aviso}
          </div>
        ) : null}
      </div>
    )
  }

  if (rota?.tipo === 'escala') {
    return (
      <div className="min-h-svh">
        {rota.setor === 'CAMPO' ? (
          <TelaEscalaPublica slug={rota.slug} aoAvisar={setAviso} />
        ) : (
          <TelaAviPublica slug={rota.slug} aoAvisar={setAviso} />
        )}
        {aviso ? (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-5 left-1/2 z-50 max-w-[92vw] -translate-x-1/2 bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
          >
            {aviso}
          </div>
        ) : null}
      </div>
    )
  }

  if (sessao === 'verificando') {
    return (
      <div className="min-h-svh">
        {splash ? <Splash congregacao={config.congregacao} saindo={splash === 'saindo'} /> : null}
      </div>
    )
  }

  if (sessao === 'sem' || !usuario) {
    return (
      <div className="min-h-svh">
        {splash ? <Splash congregacao={config.congregacao} saindo={splash === 'saindo'} /> : null}
        <TelaLogin aoEntrar={aoEntrar} />
        {aviso ? (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-5 left-1/2 z-50 max-w-[92vw] -translate-x-1/2 bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
          >
            {aviso}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="min-h-svh">
      {splash && !ehRotaPublica ? <Splash congregacao={config.congregacao} saindo={splash === 'saindo'} /> : null}

      <AppHeader
        titulo={tituloHeader}
        notificacoes={podeGerenciarCampo ? montarNotificacoes() : []}
        aoVoltar={aoVoltarHeader}
        aoSair={aoSair}
      />

      <main
        className={`mx-auto w-full max-w-[640px] px-4 py-5 ${
          tela === 'campo' || tela === 'montagem' ? 'pb-40' : 'pb-28'
        }`}
      >
        {tela === 'designacoes' && usuario ? (
          <TelaDesignacoes
            usuario={usuario}
            estado={estado}
            ano={ano}
            mes={mes}
            aoAbrir={setTela}
          />
        ) : null}

        {tela === 'campo' && podeGerenciarCampo ? (
          <ResumoDesignacao
            ano={ano}
            mes={mes}
            aoMudarData={(novoAno, novoMes) => {
              setAno(novoAno)
              setMes(novoMes)
            }}
            ocorrencias={ocorrencias}
            efetivas={efetivas}
            dirigentes={dirigentes}
            campos={campos}
            pronta={pronta}
            proximoNome={nomeMes(proximo.mes)}
            proximoPronto={proximoPronto}
            aoAdiantar={adiantarProximoMes}
            aoVerProximo={() => {
              setAno(proximo.ano)
              setMes(proximo.mes)
            }}
            aoMontar={() => setTabelaAberta(true)}
            aoGerar={gerar}
            aoLimparDesignacao={limparDesignacao}
            aoVer={exportar}
            aoCopiarLink={copiarLink}
            aoConfigurar={() => {
              setVoltaLocais('campo')
              setTela('locais')
            }}
            aoCadastrar={() => setTela('pessoas')}
          />
        ) : null}

        {tela === 'pessoas' && usuario ? (
          <TelaPessoas
            usuario={usuario}
            dirigentes={dirigentes}
            campos={campos}
            frequenciaPadrao={config.frequencia_padrao}
            ano={ano}
            mes={mes}
            efetivas={efetivas}
            aoAlterar={(lista) => atualizar((e) => ({ ...e, dirigentes: lista }))}
            aoConfigurar={() => {
              setVoltaLocais('pessoas')
              setTela('locais')
            }}
            aoAvisar={setAviso}
          />
        ) : null}

        {tela === 'locais' ? (
          <Locais
            campos={campos}
            dirigentes={dirigentes}
            aoAlterarCampos={(lista) => atualizar((e) => ({ ...e, config_campos: lista }))}
          />
        ) : null}

        {tela === 'ajustes' ? (
          <ConfigCampos
            config={config}
            campos={campos}
            admin={usuario?.papel === 'ADMIN'}
            usuarioId={usuario?.id}
            aoAlterarConfig={(patch) =>
              atualizar((e) => ({
                ...e,
                escalas: { ...e.escalas, _config: { ...e.escalas._config, ...patch } },
              }))
            }
            aoExportar={exportar}
            aoCopiarLink={copiarLink}
            aoIrParaLocais={() => {
              setVoltaLocais('ajustes')
              setTela('locais')
            }}
            aoAvisar={setAviso}
          />
        ) : null}

        {tela === 'avi' ? (
          <TelaAvi aoAvisar={setAviso} aoIrParaPessoas={() => setTela('pessoas')} />
        ) : null}

        {tela === 'tpl' && usuario ? (
          <TelaTpl slug={usuario.congregacao.slug} aoAvisar={setAviso} />
        ) : null}
      </main>

      <BottomNav
        itens={abasDisponiveis}
        aba={abaNav}
        aoMudar={(id) => setTela(id)}
      />

      {tabelaAberta ? (
        <Modal
          aberto
          aoFechar={() => setTabelaAberta(false)}
          titulo="Tabela completa"
          descricao={`${nomeMes(mes)} de ${ano}`}
          largura="max-w-4xl"
        >
          <div className="px-5 py-4">
            <TabelaEscala
              ano={ano}
              mes={mes}
              config={config}
              aoMudarData={(novoAno, novoMes) => {
                setAno(novoAno)
                setMes(novoMes)
              }}
              dirigentes={dirigentes}
              campos={campos}
              ocorrencias={ocorrencias}
              registro={registro}
              efetivas={efetivas}
              manterManuais={manterManuais}
              aoAlterarManter={setManterManuais}
              aoGerar={gerar}
              aoAlterarDesignacao={alterarDesignacoesLote}
              aoAlterarAjudante={alterarAjudantesLote}
              efetivasAjudante={efetivasAjudante}
              aoLimparManuais={limparManuais}
              aoConfigurar={() => {
                setTabelaAberta(false)
                setVoltaLocais('campo')
                setTela('locais')
              }}
              aoCadastrar={() => {
                setTabelaAberta(false)
                setTela('pessoas')
              }}
              cardRef={cardRef}
              pronta={pronta}
              aoConcluir={() => {
                setTabelaAberta(false)
                setModalAberto(true)
              }}
            />
          </div>
        </Modal>
      ) : null}

      {modalAberto && !tabelaAberta ? (
        <div
          className="fixed left-[-10000px] top-0 w-[760px] overflow-hidden"
          aria-hidden="true"
        >
          <EscalaCard
            ref={cardRef}
            config={config}
            ocorrencias={ocorrencias}
            dirigentes={dirigentes}
            designacoes={efetivas}
            manuais={registro.manuais ?? {}}
            ajudantes={efetivasAjudante}
            manuaisAjudante={registro.manuaisAjudante ?? {}}
          />
        </div>
      ) : null}

      {modalAberto ? (
        <ExportModal
          aberto={modalAberto}
          aoFechar={() => setModalAberto(false)}
          noAlvo={cardRef}
          chave={chave}
          ano={ano}
          mes={nomeMes(mes)}
          config={config}
          ocorrencias={ocorrencias}
          efetivas={efetivas}
          dirigentes={dirigentes}
          aoAvisar={setAviso}
        />
      ) : null}

      {aviso ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 z-50 max-w-[92vw] -translate-x-1/2 bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
        >
          {aviso}
        </div>
      ) : null}
    </div>
  )
}
