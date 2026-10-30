import type { Campo, ConfigEscala, SetorId } from '../lib/dominio'
import { ROTULO_SETOR, SETORES } from '../lib/dominio'
import { useEffect, useState } from 'react'
import {
  Bell,
  BookOpen,
  Building2,
  Check,
  ChevronRight,
  Copy,
  FileText,
  Link2,
  Loader2,
  MapPin,
  Radio,
  Send,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { MESES } from '../lib/constants'
import type { ConviteListado, MembroEquipe } from '../lib/authApi'
import {
  ErroAuth,
  gerarConvite,
  listarConvites,
  listarEquipe,
  removerConvite,
  removerEquipe,
  textoErroAuth,
} from '../lib/authApi'
import type { EstadoNotificacoes, ResultadoAtivacao, ResultadoTestePush } from '../lib/push'
import { ativarNotificacoes, enviarTestePush, estadoNotificacoes } from '../lib/push'
import { Botao, Input, Kicker, Modal, Rotulo, Select, Toggle } from './ui'

interface ConviteVisivel extends ConviteListado {
  criadoFmt: string
  expiraFmt: string
}

function dataCurta(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

const DESCRICAO_SETOR: Record<SetorId, string> = {
  CAMPO: 'Designação, voluntários e locais',
  AUDIO_VIDEO: 'Designações e escala AVI',
  TPL: 'Estrutura e escala manual do TPL',
}

/** Horários oferecidos para o feriado: 05:00 às 21:30, de 30 em 30 minutos. */
const HORARIOS_FERIADO: string[] = Array.from({ length: 34 }, (_, i) => {
  const minutos = 5 * 60 + i * 30
  const hora = Math.floor(minutos / 60)
  const resto = minutos % 60
  return `${String(hora).padStart(2, '0')}:${String(resto).padStart(2, '0')}`
})

/** Dias oferecidos para o disparo automático (1–31). */
const DIAS_DISPARO: number[] = Array.from({ length: 31 }, (_, i) => i + 1)

/** Horários do disparo automático: 00:00 às 23:30, de 30 em 30 minutos. */
const HORARIOS_DISPARO: string[] = Array.from(
  { length: 48 },
  (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`,
)

/** Data de hoje resolvida uma vez (oxlint: sem Date instável no render). */
const HOJE = new Date()
const ATUALIZADO = `em ${MESES[HOJE.getMonth()]} de ${HOJE.getFullYear()}`
const PROXIMO_MES = HOJE.getMonth() === 11 ? 0 : HOJE.getMonth() + 1

function textoTeste(resultado: ResultadoTestePush): string {
  if (resultado.erro === 'nao_configurado') {
    return 'Falta configurar as chaves de push no servidor (PUSH_VAPID_PUBLICA / PUSH_VAPID_PRIVADA).'
  }
  if (resultado.erro === 'pin_invalido') return 'PIN incorreto — tente novamente.'
  if (resultado.erro) return 'Não foi possível enviar o teste agora. Tente de novo.'
  const enviadas = resultado.enviadas ?? 0
  const removidas = resultado.removidas ?? 0
  const falhas = resultado.falhas ?? 0
  if (enviadas === 0 && falhas === 0 && removidas === 0) {
    return 'Nenhum aparelho inscrito — ative as notificações primeiro.'
  }
  const partes = [`Teste enviado para ${enviadas} aparelho(s)`]
  if (removidas > 0) partes.push(`${removidas} desativado(s)`)
  if (falhas > 0) partes.push(`${falhas} falha(s)`)
  return `${partes.join(' • ')}.`
}

function Linha({
  rotulo,
  descricao,
  children,
  acao,
}: {
  rotulo: string
  descricao?: string
  children?: React.ReactNode
  acao?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0 pr-1">
        <p className="text-sm font-semibold text-ink">{rotulo}</p>
        {descricao ? <p className="mt-0.5 text-[13px] text-muted">{descricao}</p> : null}
        {children ? <div className="mt-1.5">{children}</div> : null}
      </div>
      {acao}
    </div>
  )
}

function TituloSecao({
  titulo,
  descricao,
  badge,
}: {
  titulo: string
  descricao?: string
  badge?: string
}) {
  return (
    <div className="flex items-end justify-between gap-3 px-1">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-ink">{titulo}</h2>
        {descricao ? <p className="mt-0.5 text-sm text-muted">{descricao}</p> : null}
      </div>
      {badge ? <span className="shrink-0 text-xs font-bold text-muted">{badge}</span> : null}
    </div>
  )
}

interface ConfigCamposProps {
  config: ConfigEscala
  campos: Campo[]
  /** Exibe as seções de convites e equipe (somente administrador). */
  admin?: boolean
  /** Id da conta logada (evita remover a própria conta na tela). */
  usuarioId?: string
  congregacaoNumero?: string
  visao?: 'geral' | 'campo'
  aoIrParaSetor?: (setor: SetorId) => void
  aoIrParaPessoas?: () => void
  aoSalvarCongregacao?: (nome: string, numero: string) => Promise<void>
  aoAlterarConfig: (patch: Partial<ConfigEscala>) => void
  /** Abre a tela Locais (dias e horários de campo). */
  aoIrParaLocais?: () => void
  /** Mensagem efêmera (toast) do App. */
  aoAvisar?: (texto: string) => void
}

function iniciaisEquipe(nome: string): string {
  return (
    nome
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0] ?? '')
      .join('')
      .toUpperCase() || '?'
  )
}

function textoErroEquipe(codigo: string): string {
  if (codigo === 'nao_remover_self') return 'Você não pode remover a própria conta.'
  if (codigo === 'ultimo_admin') return 'Precisa permanecer ao menos um administrador.'
  if (codigo === 'membro_nao_encontrado') return 'Essa conta já saiu da equipe.'
  if (codigo === 'permissao_negada') return 'Apenas o administrador pode gerenciar a equipe.'
  return textoErroAuth(codigo)
}

export default function ConfigCampos({
  config,
  campos,
  admin = false,
  usuarioId,
  congregacaoNumero = '',
  visao = 'geral',
  aoIrParaSetor,
  aoIrParaPessoas,
  aoSalvarCongregacao,
  aoAlterarConfig,
  aoIrParaLocais,
  aoAvisar,
}: ConfigCamposProps) {
  const [editandoCong, setEditandoCong] = useState(false)
  const [nomeCongregacao, setNomeCongregacao] = useState(config.congregacao)
  const [numeroCongregacao, setNumeroCongregacao] = useState(congregacaoNumero)
  const [salvandoCongregacao, setSalvandoCongregacao] = useState(false)
  const [erroCongregacao, setErroCongregacao] = useState('')
  const [editandoCabecalho, setEditandoCabecalho] = useState(false)
  const [push, setPush] = useState<EstadoNotificacoes | null>(null)
  const [pushOcupado, setPushOcupado] = useState(false)
  const [pushMensagem, setPushMensagem] = useState<string | null>(null)
  const [testeOcupado, setTesteOcupado] = useState(false)
  const [testeMensagem, setTesteMensagem] = useState<string | null>(null)
  const [convites, setConvites] = useState<ConviteVisivel[] | null>(null)
  const [conviteOcupado, setConviteOcupado] = useState<SetorId | null>(null)
  const [conviteErro, setConviteErro] = useState<string | null>(null)
  const [linkNovo, setLinkNovo] = useState<{ setor: SetorId; href: string; expiraFmt: string } | null>(null)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [equipe, setEquipe] = useState<MembroEquipe[] | null>(null)
  const [membroRemovendo, setMembroRemovendo] = useState<MembroEquipe | null>(null)
  const [removendoOcupado, setRemovendoOcupado] = useState(false)
  const [equipeErro, setEquipeErro] = useState<string | null>(null)
  const [conviteRemovendo, setConviteRemovendo] = useState<ConviteVisivel | null>(null)
  const [conviteRemocaoOcupada, setConviteRemocaoOcupada] = useState(false)

  useEffect(() => {
    let vivo = true
    estadoNotificacoes().then((estado) => {
      if (vivo) setPush(estado)
    })
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => {
    if (!admin) return undefined
    let vivo = true
    listarConvites()
      .then((lista) => {
        if (!vivo) return
        setConvites(
          lista.map((convite) => ({
            ...convite,
            criadoFmt: dataCurta(convite.criado_em),
            expiraFmt: dataCurta(convite.expira_em),
          })),
        )
      })
      .catch(() => {
        if (vivo) setConvites([])
      })
    return () => {
      vivo = false
    }
  }, [admin])

  useEffect(() => {
    if (!admin) return undefined
    let vivo = true
    listarEquipe()
      .then((lista) => {
        if (vivo) setEquipe(lista)
      })
      .catch(() => {
        if (vivo) setEquipe([])
      })
    return () => {
      vivo = false
    }
  }, [admin])

  async function aoConfirmarRemocao() {
    if (!membroRemovendo) return
    setRemovendoOcupado(true)
    setEquipeErro(null)
    try {
      await removerEquipe(membroRemovendo.id)
      const lista = await listarEquipe()
      setEquipe(lista)
      aoAvisar?.(`${membroRemovendo.nome} saiu da equipe.`)
      setMembroRemovendo(null)
    } catch (falha) {
      setEquipeErro(
        falha instanceof ErroAuth ? textoErroEquipe(falha.codigo) : 'Falha de conexão.',
      )
    } finally {
      setRemovendoOcupado(false)
    }
  }

  function linkAbsoluto(caminho: string): string {
    return new URL(caminho, window.location.origin).href
  }

  async function copiar(href: string, id: string) {
    try {
      await navigator.clipboard?.writeText(href)
      setCopiado(id)
      setTimeout(() => setCopiado((atual) => (atual === id ? null : atual)), 2400)
    } catch {
      setConviteErro('Não foi possível copiar o link.')
    }
  }

  async function aoGerarConvite(setor: SetorId) {
    setConviteOcupado(setor)
    setConviteErro(null)
    setLinkNovo(null)
    try {
      const resultado = await gerarConvite(setor)
      const href = linkAbsoluto(resultado.link)
      setLinkNovo({ setor, href, expiraFmt: dataCurta(resultado.expira_em) })
      const lista = await listarConvites()
      setConvites(
        lista.map((convite) => ({
          ...convite,
          criadoFmt: dataCurta(convite.criado_em),
          expiraFmt: dataCurta(convite.expira_em),
        })),
      )
    } catch (falha) {
      setConviteErro(falha instanceof ErroAuth ? textoErroAuth(falha.codigo) : 'Falha de conexão.')
    } finally {
      setConviteOcupado(null)
    }
  }

  async function aoConfirmarRemocaoConvite() {
    if (!conviteRemovendo) return
    setConviteRemocaoOcupada(true)
    setConviteErro(null)
    try {
      await removerConvite(conviteRemovendo.token)
      const lista = await listarConvites()
      setConvites(
        lista.map((convite) => ({
          ...convite,
          criadoFmt: dataCurta(convite.criado_em),
          expiraFmt: dataCurta(convite.expira_em),
        })),
      )
      setConviteRemovendo(null)
      aoAvisar?.('Link de convite removido.')
    } catch (falha) {
      setConviteErro(falha instanceof ErroAuth ? textoErroAuth(falha.codigo) : 'Falha de conexão.')
    } finally {
      setConviteRemocaoOcupada(false)
    }
  }

  async function salvarCongregacao() {
    if (!nomeCongregacao.trim()) {
      setErroCongregacao('Informe o nome da congregação.')
      return
    }
    if (!aoSalvarCongregacao) return
    setSalvandoCongregacao(true)
    setErroCongregacao('')
    try {
      await aoSalvarCongregacao(nomeCongregacao.trim(), numeroCongregacao.trim())
      setEditandoCong(false)
      aoAvisar?.('Dados da congregação atualizados.')
    } catch {
      setErroCongregacao('Não foi possível salvar. Verifique a conexão e tente novamente.')
    } finally {
      setSalvandoCongregacao(false)
    }
  }

  function abrirEdicaoCongregacao() {
    setNomeCongregacao(config.congregacao)
    setNumeroCongregacao(congregacaoNumero)
    setErroCongregacao('')
    setEditandoCong(true)
  }

  async function aoAtivarPush() {
    setPushOcupado(true)
    setPushMensagem(null)
    const resultado = await ativarNotificacoes()
    const textos: Record<ResultadoAtivacao, string> = {
      ativo: 'Pronto! Este aparelho já recebe notificações da escala.',
      aguardando_servidor:
        'Permissão concedida. Falta configurar as chaves de push no servidor (PUSH_VAPID_PUBLICA).',
      bloqueado: 'Notificações bloqueadas — libere-as nas configurações do navegador.',
      incompativel: 'Este navegador não suporta notificações.',
      erro: 'Não foi possível ativar agora. Tente de novo.',
    }
    setPushMensagem(textos[resultado])
    setPush(await estadoNotificacoes())
    setPushOcupado(false)
  }

  async function aoEnviarTeste() {
    setTesteOcupado(true)
    setTesteMensagem(null)
    const resultado = await enviarTestePush()
    setTesteMensagem(textoTeste(resultado))
    setTesteOcupado(false)
  }

  const fixaLigada = config.designacao_fixa === true
  const feriadoLigado = config.ajustar_feriados === true

  return (
    <div className="space-y-6">
      <header>
        <Kicker className="text-muted">
          {visao === 'geral' ? 'Configurações gerais' : 'Setor'}
        </Kicker>
        <h1 className="mt-1 text-[26px] font-bold tracking-tight text-ink">
          {visao === 'geral' ? 'Configurações' : 'Campo'}
        </h1>
        {visao === 'geral' ? (
          <p className="mt-1.5 text-sm text-muted">
            Congregação, equipe, convites, notificações e configurações por setor.
          </p>
        ) : null}
      </header>

      {visao === 'geral' ? (
        <>
          <div className="rounded-xl bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3.5">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-teal-tint text-teal">
                  <Building2 className="size-6" aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-ink">
                    {config.congregacao || config.titulo || 'Minha congregação'}
                  </span>
                  <span className="mt-0.5 text-[13px] text-muted">
                    {congregacaoNumero ? `Nº ${congregacaoNumero}` : 'Número não informado'}
                  </span>
                </div>
              </div>
              {admin ? (
                <button
                  type="button"
                  aria-label="Editar congregação"
                  onClick={abrirEdicaoCongregacao}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-teal-tint hover:text-teal"
                >
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
                    <path
                      d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ) : null}
            </div>
          </div>

          <section className="space-y-2">
            <TituloSecao titulo="Setores" descricao="Abra a configuração de cada departamento" />
            <div className="flex flex-col gap-2">
              {SETORES.map((setor) => {
                const Icone =
                  setor === 'CAMPO' ? MapPin : setor === 'AUDIO_VIDEO' ? Radio : BookOpen
                return (
                  <button
                    key={setor}
                    type="button"
                    onClick={() => aoIrParaSetor?.(setor)}
                    className="flex w-full items-center gap-3 rounded-xl bg-card p-4 text-left shadow-sm transition-colors hover:bg-canvas"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-tint text-teal">
                      <Icone className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">
                        {ROTULO_SETOR[setor]}
                      </span>
                      <span className="block text-[13px] text-muted">
                        {DESCRICAO_SETOR[setor]}
                      </span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden="true" />
                  </button>
                )
              })}
            </div>
          </section>
        </>
      ) : null}

      {visao === 'campo' ? (
        <>
      <div className="px-1 pt-1">
        <Kicker className="text-teal">Configurações do setor Campo</Kicker>
      </div>

      <section className="space-y-2">
        <TituloSecao titulo="Cabeçalho da escala" descricao="Título exibido nas programações do Campo" />
        <div className="divide-y divide-line-soft overflow-hidden rounded-xl bg-card shadow-sm">
          <Linha
            rotulo="Título da escala"
            descricao={config.titulo}
            acao={
              <Botao variante="secundario" onClick={() => setEditandoCabecalho(true)}>
                <FileText className="size-4" aria-hidden="true" />
                Editar
              </Botao>
            }
          />
        </div>
      </section>

      {aoIrParaLocais ? (
        <section className="space-y-2">
          <TituloSecao
            titulo="Configuração de campos"
            descricao="Dias, horários e locais da designação do Campo"
          />
          <div className="divide-y divide-line-soft overflow-hidden rounded-xl bg-card shadow-sm">
            <Linha
              rotulo="Dias de campo"
              descricao={
                campos.length
                  ? `${campos.length} configurado${campos.length === 1 ? '' : 's'} — horários e locais`
                  : 'Nenhum dia configurado ainda'
              }
              acao={
                <Botao variante="secundario" className="shrink-0" onClick={aoIrParaLocais}>
                  <MapPin className="size-4" aria-hidden="true" />
                  Abrir
                </Botao>
              }
            />
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <TituloSecao
          titulo="Regras do Rodízio"
          descricao="Critérios inteligentes para a geração automática da escala"
        />
        <div className="divide-y divide-line-soft overflow-hidden rounded-xl bg-card shadow-sm">
          <Linha
            rotulo="Frequência mensal"
            descricao="Limite 1x, 2x ou 3x definido na ficha de cada voluntário."
            acao={
              aoIrParaPessoas ? (
                <Botao variante="secundario" onClick={aoIrParaPessoas}>
                  Editar fichas
                </Botao>
              ) : null
            }
          />
          <Linha
            rotulo="Evitar dias consecutivos"
            descricao="Garante intervalo de descanso para o mesmo voluntário"
            acao={
              <Toggle
                rotulo="Evitar dias consecutivos"
                checked={config.evitar_consecutivos !== false}
                aoMudar={(valor) => aoAlterarConfig({ evitar_consecutivos: valor })}
              />
            }
          />
          <Linha
            rotulo="Equilibrar fins de semana"
            descricao="Distribui saídas de sábado e domingo de forma equitativa"
            acao={
              <Toggle
                rotulo="Equilibrar fins de semana"
                checked={config.equilibrar_fds !== false}
                aoMudar={(valor) => aoAlterarConfig({ equilibrar_fds: valor })}
              />
            }
          />
          <Linha
            rotulo="Designação fixa"
            descricao={
              fixaLigada
                ? 'Cada dia usa o voluntário fixo cadastrado nele.'
                : 'Distribui conforme a frequência de cada ficha.'
            }
            acao={
              <Toggle
                rotulo="Designação fixa"
                checked={fixaLigada}
                aoMudar={(valor) => aoAlterarConfig({ designacao_fixa: valor })}
              />
            }
          />
        </div>
        {fixaLigada && !campos.some((c) => c.fixo) ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] text-ink">
            <p className="min-w-0 flex-1">
              Nenhum dia tem “Quem dirige” definido: informe o voluntário fixo de cada dia na
              tela Locais.
            </p>
            {aoIrParaLocais ? (
              <Botao variante="fantasma" className="shrink-0 text-crimson" onClick={aoIrParaLocais}>
                Abrir Locais
              </Botao>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <TituloSecao
          titulo="Feriados"
          descricao="Horário especial nos dias de campo que caem em feriado"
        />
        <div className="divide-y divide-line-soft overflow-hidden rounded-xl bg-card shadow-sm">
          <Linha
            rotulo="Ajustar horário nos feriados"
            descricao={
              feriadoLigado
                ? `Os feriados passam a sair às ${config.horario_feriado}.`
                : 'Mantém o horário regular do dia.'
            }
            acao={
              <Toggle
                rotulo="Ajustar horário nos feriados"
                checked={feriadoLigado}
                aoMudar={(valor) => aoAlterarConfig({ ajustar_feriados: valor })}
              />
            }
          />
          {feriadoLigado ? (
            <Linha
              rotulo="Horário dos feriados"
              descricao="Passa a valer em todos os feriados da escala"
              acao={
                <Select
                  aria-label="Horário dos feriados"
                  className="w-28"
                  value={config.horario_feriado}
                  onChange={(e) => aoAlterarConfig({ horario_feriado: e.target.value })}
                >
                  {HORARIOS_FERIADO.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              }
            />
          ) : null}
        </div>
      </section>

      <section className="space-y-2">
        <TituloSecao
          titulo="Geração automática"
          descricao="Quando a escala do mês seguinte é criada sozinha"
        />
        <div className="divide-y divide-line-soft overflow-hidden rounded-xl bg-card shadow-sm">
          <Linha
            rotulo="Dia do disparo"
            descricao={`Todo mês no dia ${config.disparo_dia}, às ${config.disparo_hora} (horário de São Paulo)`}
            acao={
              <Select
                aria-label="Dia do disparo"
                className="w-24"
                value={String(config.disparo_dia)}
                onChange={(e) => aoAlterarConfig({ disparo_dia: Number(e.target.value) })}
              >
                {DIAS_DISPARO.map((dia) => (
                  <option key={dia} value={dia}>
                    {dia}
                  </option>
                ))}
              </Select>
            }
          />
          <Linha
            rotulo="Horário do disparo"
            descricao="A escala entra sozinha e os aparelhos inscritos recebem um aviso"
            acao={
              <Select
                aria-label="Horário do disparo"
                className="w-28"
                value={config.disparo_hora}
                onChange={(e) => aoAlterarConfig({ disparo_hora: e.target.value })}
              >
                {HORARIOS_DISPARO.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </Select>
            }
          />
        </div>
        <p className="rounded-xl border-l-2 border-teal bg-teal-tint px-3 py-2 text-[13px] text-ink">
          A escala de {MESES[PROXIMO_MES]} será gerada no dia {config.disparo_dia}, às{' '}
          {config.disparo_hora}, e os aparelhos receberão um aviso.
        </p>
      </section>
        </>
      ) : null}

      {visao === 'geral' ? (
        <>
      <div className="px-1 pt-1">
        <Kicker className="text-teal">Acesso à conta</Kicker>
      </div>

      {admin ? (
        <section className="space-y-2">
          <TituloSecao titulo="Equipe" descricao="Contas com acesso ao aplicativo" />
          {!equipe ? (
            <p className="rounded-xl bg-card px-4 py-3 text-[13px] text-muted shadow-sm">
              Carregando equipe…
            </p>
          ) : !equipe.length ? (
            <p className="px-1 text-[13px] text-muted">Nenhuma conta encontrada.</p>
          ) : (
            <ul className="divide-y divide-line-soft overflow-hidden rounded-xl bg-card shadow-sm">
              {equipe.map((membro) => {
                const eu = membro.id === usuarioId
                return (
                  <li key={membro.id} className="flex items-center gap-3 p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-tint text-sm font-bold text-teal-deep">
                      {iniciaisEquipe(membro.nome)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {membro.nome}
                        {eu ? <span className="ml-1.5 font-normal text-muted">(você)</span> : null}
                      </p>
                      <p className="truncate text-[13px] text-muted">{membro.email}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        membro.papel === 'ADMIN'
                          ? 'bg-teal-tint text-teal-deep'
                          : 'bg-line text-ink-soft'
                      }`}
                    >
                      {membro.papel === 'ADMIN'
                        ? 'Administrador'
                        : (membro.setor ? ROTULO_SETOR[membro.setor] : 'Ajudante')}
                    </span>
                    {eu ? null : (
                      <button
                        type="button"
                        aria-label={`Remover ${membro.nome} da equipe`}
                        onClick={() => {
                          setEquipeErro(null)
                          setMembroRemovendo(membro)
                        }}
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-crimson transition-colors hover:bg-crimson-bg"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {equipeErro ? (
            <p role="alert" className="text-[13px] font-semibold text-crimson">
              {equipeErro}
            </p>
          ) : null}
        </section>
      ) : null}

      {admin ? (
        <section className="space-y-2">
          <TituloSecao
            titulo="Convites de acesso"
            descricao="Convide ajudantes por link — validade de 7 dias, uso único"
          />
          <div className="divide-y divide-line-soft overflow-hidden rounded-xl bg-card shadow-sm">
            {SETORES.map((setor) => (
              <Linha
                key={setor}
                rotulo={ROTULO_SETOR[setor]}
                descricao={DESCRICAO_SETOR[setor]}
                acao={
                  <Botao
                    variante="secundario"
                    disabled={conviteOcupado !== null}
                    onClick={() => aoGerarConvite(setor)}
                  >
                    {conviteOcupado === setor ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <UserPlus className="size-4" aria-hidden="true" />
                    )}
                    {conviteOcupado === setor ? 'Gerando…' : 'Gerar link'}
                  </Botao>
                }
              />
            ))}
          </div>

          {linkNovo ? (
            <div className="rounded-xl border-l-2 border-teal bg-teal-tint p-4">
              <Kicker className="text-teal">Link gerado — {ROTULO_SETOR[linkNovo.setor]}</Kicker>
              <p className="mt-1 break-all font-mono text-[12px] text-ink">{linkNovo.href}</p>
              <div className="mt-2 flex items-center gap-2">
                <Botao variante="primario" onClick={() => copiar(linkNovo.href, 'novo')}>
                  <Copy className="size-4" aria-hidden="true" />
                  {copiado === 'novo' ? 'Copiado!' : 'Copiar link'}
                </Botao>
                <span className="text-[12px] font-semibold text-muted">
                  expira em {linkNovo.expiraFmt}
                </span>
              </div>
            </div>
          ) : null}

          {conviteErro ? (
            <p
              role="alert"
              className="rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] font-semibold text-ink"
            >
              {conviteErro}
            </p>
          ) : null}

          {convites === null ? (
            <p className="px-1 text-[13px] text-muted">Carregando convites…</p>
          ) : convites.length ? (
            <div className="divide-y divide-line-soft overflow-hidden rounded-xl bg-card shadow-sm">
              {convites.map((convite) => (
                <div
                  key={convite.token}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {ROTULO_SETOR[convite.setor]}
                    </p>
                    <p className="text-[12px] text-muted">
                      gerado em {convite.criadoFmt} • expira em {convite.expiraFmt}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        convite.status === 'ativo'
                          ? 'bg-success-bg text-success'
                          : convite.status === 'expirado'
                            ? 'bg-line-soft text-muted'
                            : 'bg-teal-tint text-teal'
                      }`}
                    >
                      {convite.status === 'ativo'
                        ? 'Ativo'
                        : convite.status === 'expirado'
                          ? 'Expirado'
                          : 'Usado'}
                    </span>
                    {convite.status === 'ativo' ? (
                      <button
                        type="button"
                        aria-label="Copiar link do convite"
                        onClick={() =>
                          copiar(linkAbsoluto(`/aceitar-convite?token=${convite.token}`), convite.token)
                        }
                        className="flex size-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-teal-tint hover:text-teal"
                      >
                        {copiado === convite.token ? (
                          <Check className="size-4 text-success" aria-hidden="true" />
                        ) : (
                          <Link2 className="size-4" aria-hidden="true" />
                        )}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label="Excluir convite"
                      onClick={() => setConviteRemovendo(convite)}
                      className="flex size-8 items-center justify-center rounded-full text-crimson transition-colors hover:bg-crimson-bg"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-1 text-[13px] text-muted">Nenhum convite gerado ainda.</p>
          )}
        </section>
      ) : null}

      <div className="px-1 pt-1">
        <Kicker className="text-teal">Avisos</Kicker>
      </div>

      <section className="space-y-2">
        <TituloSecao titulo="Notificações" descricao="Avisos no aparelho mesmo com o app fechado" />
        <div className="rounded-xl bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3.5">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-tint text-teal"
              aria-hidden="true"
            >
              <Bell className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Notificações push</p>
              <p className="mt-0.5 text-[13px] text-muted">
                {!push
                  ? 'Verificando este aparelho…'
                  : !push.suporta
                    ? 'Este navegador não suporta notificações.'
                    : push.inscrito
                      ? 'Ativo neste aparelho.'
                      : push.permissao === 'denied'
                        ? 'Bloqueadas — libere nas configurações do navegador.'
                        : 'Ative para receber avisos da escala no aparelho.'}
              </p>
              {pushMensagem ? (
                <p className="mt-1.5 text-[12px] font-semibold text-teal">{pushMensagem}</p>
              ) : null}
            </div>
          </div>
          <Botao
            variante="primario"
            className="mt-3 w-full"
            disabled={!push?.suporta || push?.inscrito === true || pushOcupado}
            onClick={aoAtivarPush}
          >
            <Bell className="size-4" aria-hidden="true" />
            {push?.inscrito ? 'Notificações ativadas' : 'Ativar notificações'}
          </Botao>
          <Botao
            variante="secundario"
            className="mt-2 w-full"
            disabled={pushOcupado || testeOcupado}
            onClick={aoEnviarTeste}
          >
            <Send className="size-4" aria-hidden="true" />
            {testeOcupado ? 'Enviando teste…' : 'Enviar teste'}
          </Botao>
          {testeMensagem ? (
            <p className="mt-2 text-[12px] font-semibold text-teal">{testeMensagem}</p>
          ) : null}
        </div>
      </section>

      <footer className="flex flex-col items-center gap-1 pb-4 pt-2 text-center">
        <span className="mb-1 flex size-8 items-center justify-center rounded-full bg-teal-tint text-teal">
          <ShieldCheck className="size-[18px]" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold text-ink">Designa</span>
        <span className="text-[11px] font-semibold text-muted">
          {config.congregacao ? `${config.congregacao} • ` : ''}Atualizado {ATUALIZADO}
        </span>
      </footer>
        </>
      ) : null}

      <Modal
        aberto={editandoCabecalho}
        aoFechar={() => setEditandoCabecalho(false)}
        titulo="Cabeçalho da escala"
        descricao="Título exibido no topo da programação do Campo."
        largura="max-w-lg"
      >
        <div className="space-y-4 px-5 py-4">
          <div>
            <Rotulo htmlFor="cfg-titulo">Título da escala</Rotulo>
            <Input
              id="cfg-titulo"
              value={config.titulo}
              onChange={(e) => aoAlterarConfig({ titulo: e.target.value })}
              placeholder="Ex.: Designação de Campo"
              autoFocus
            />
          </div>
          <Botao
            variante="primario"
            className="w-full"
            onClick={() => setEditandoCabecalho(false)}
          >
            <Check className="size-4" aria-hidden="true" />
            Concluir
          </Botao>
        </div>
      </Modal>

      <Modal
        aberto={editandoCong}
        aoFechar={() => {
          if (!salvandoCongregacao) setEditandoCong(false)
        }}
        titulo="Congregação"
        descricao="Atualize o nome e o número da congregação."
        largura="max-w-lg"
      >
        <div className="space-y-4 px-5 py-4">
          <div>
            <Rotulo htmlFor="cfg-cong">Nome da congregação</Rotulo>
            <Input
              id="cfg-cong"
              value={nomeCongregacao}
              onChange={(e) => setNomeCongregacao(e.target.value)}
              placeholder="Ex.: Bancários"
              autoCapitalize="words"
              enterKeyHint="next"
              autoFocus
            />
          </div>
          <div>
            <Rotulo htmlFor="cfg-numero">Número da congregação (opcional)</Rotulo>
            <Input
              id="cfg-numero"
              value={numeroCongregacao}
              onChange={(e) => setNumeroCongregacao(e.target.value)}
              placeholder="Ex.: 12345"
              enterKeyHint="done"
            />
          </div>
          {erroCongregacao ? (
            <p role="alert" className="text-sm font-semibold text-crimson">
              {erroCongregacao}
            </p>
          ) : null}
          <Botao
            variante="primario"
            className="w-full"
            disabled={salvandoCongregacao}
            onClick={salvarCongregacao}
          >
            <Check className="size-4" aria-hidden="true" />
            {salvandoCongregacao ? 'Salvando…' : 'Salvar congregação'}
          </Botao>
        </div>
      </Modal>

      <Modal
        aberto={membroRemovendo !== null}
        aoFechar={() => {
          if (!removendoOcupado) setMembroRemovendo(null)
        }}
        titulo="Remover da equipe?"
        descricao={
          membroRemovendo
            ? `${membroRemovendo.nome} perde o acesso ao aplicativo imediatamente. As fichas e a escala continuam salvas.`
            : undefined
        }
        largura="max-w-sm"
      >
        <div className="flex gap-2 px-5 py-4">
          <Botao
            className="flex-1"
            disabled={removendoOcupado}
            onClick={() => setMembroRemovendo(null)}
          >
            Cancelar
          </Botao>
          <Botao
            variante="vinho"
            className="flex-1"
            disabled={removendoOcupado}
            onClick={aoConfirmarRemocao}
          >
            <Users className="size-4" aria-hidden="true" />
            {removendoOcupado ? 'Removendo…' : 'Remover'}
          </Botao>
        </div>
      </Modal>

      <Modal
        aberto={conviteRemovendo !== null}
        aoFechar={() => {
          if (!conviteRemocaoOcupada) setConviteRemovendo(null)
        }}
        titulo="Excluir link de convite?"
        descricao="O link deixará de funcionar imediatamente, mesmo que ainda não tenha expirado."
        largura="max-w-sm"
      >
        <div className="flex gap-2 px-5 py-4">
          <Botao
            className="flex-1"
            disabled={conviteRemocaoOcupada}
            onClick={() => setConviteRemovendo(null)}
          >
            Cancelar
          </Botao>
          <Botao
            variante="vinho"
            className="flex-1"
            disabled={conviteRemocaoOcupada}
            onClick={aoConfirmarRemocaoConvite}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {conviteRemocaoOcupada ? 'Excluindo…' : 'Excluir'}
          </Botao>
        </div>
      </Modal>
    </div>
  )
}
