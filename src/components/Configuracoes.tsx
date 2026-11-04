import type { ConfigEscala, SetorId, Tela, Usuario } from '../lib/dominio'
import { ROTULO_SETOR, SETORES } from '../lib/dominio'
import { useEffect, useState } from 'react'
import {
  Bell,
  BookOpen,
  Building2,
  Check,
  ChevronRight,
  Copy,
  Info,
  Link2,
  Loader2,
  MapPin,
  Radio,
  Send,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRound,
} from 'lucide-react'
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
import type { TipoToast } from './Toast'
import type { Tema } from '../lib/tema'
import { temaSalvo } from '../lib/tema'
import { Botao, Input, Kicker, PopConfirm, Rotulo } from './ui'
import ModalInfo from './ModalInfo'

const DESCRICAO_SETOR: Record<SetorId, string> = {
  CAMPO: 'Designação, voluntários e locais',
  AUDIO_VIDEO: 'Designações e escala AVI',
  TPL: 'Estrutura e escala manual do TPL',
}

function dataCurta(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function iniciais(nome: string): string {
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

function textoTeste(resultado: ResultadoTestePush): string {
  if (resultado.erro === 'nao_configurado') {
    return 'Falta configurar as chaves de push no servidor (PUSH_VAPID_PUBLICA / PUSH_VAPID_PRIVADA).'
  }
  if (resultado.erro === 'pin_invalido') return 'PIN incorreto, tente novamente.'
  if (resultado.erro) return 'Não foi possível enviar o teste agora. Tente de novo.'
  const enviadas = resultado.enviadas ?? 0
  const removidas = resultado.removidas ?? 0
  const falhas = resultado.falhas ?? 0
  if (enviadas === 0 && falhas === 0 && removidas === 0) {
    return 'Nenhum aparelho inscrito, ative as notificações primeiro.'
  }
  const partes = [`Teste enviado para ${enviadas} aparelho(s)`]
  if (removidas > 0) partes.push(`${removidas} desativado(s)`)
  if (falhas > 0) partes.push(`${falhas} falha(s)`)
  return `${partes.join(' • ')}.`
}

/** Linha de lista padrão (separadores, sem cartão) com ícone + rótulo + seta. */
function LinhaNav({
  Icone,
  rotulo,
  descricao,
  onClick,
}: {
  Icone: typeof Building2
  rotulo: string
  descricao?: string
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-[68px] w-full items-center gap-4 px-1 py-3 text-left transition-colors hover:bg-line-soft"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-tint text-teal">
          <Icone className="size-5" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-ink">{rotulo}</span>
          {descricao ? (
            <span className="block text-[13px] text-muted">{descricao}</span>
          ) : null}
        </span>
        <ChevronRight className="size-5 shrink-0 text-faint" strokeWidth={2} aria-hidden="true" />
      </button>
    </li>
  )
}

/** Cabeçalho padrão das subpáginas de Ajustes. */
function CabecalhoSub({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <header>
      <Kicker className="text-muted">Ajustes</Kicker>
      <h1 className="mt-1 text-[26px] font-bold tracking-tight text-ink">{titulo}</h1>
      <p className="mt-1.5 text-sm text-muted">{descricao}</p>
    </header>
  )
}

/** Raiz de Ajustes: lista com separadores (Congregação, Departamentos, Conta, Notificações, Sobre o app). */
export function TelaAjustes({
  usuario,
  aoIrPara,
}: {
  usuario: Usuario
  aoIrPara: (tela: Tela) => void
}) {
  const [sobreAberto, setSobreAberto] = useState(false)
  const [tema, setTema] = useState<Tema>(() => temaSalvo())
  const ehAdmin = usuario.papel === 'ADMIN'

  return (
    <div className="space-y-6">
      <header>
        <Kicker className="text-muted">Configurações gerais</Kicker>
        <h1 className="mt-1 text-[26px] font-bold tracking-tight text-ink">Ajustes</h1>
        <p className="mt-1.5 text-sm text-muted">
          Congregação, departamentos, conta e notificações.
        </p>
      </header>

      <ul className="divide-y divide-line">
        {ehAdmin ? (
          <LinhaNav
            Icone={Building2}
            rotulo="Congregação"
            descricao="Nome e número da congregação"
            onClick={() => aoIrPara('ajustesCongregacao')}
          />
        ) : null}
        <LinhaNav
          Icone={MapPin}
          rotulo="Departamentos"
          descricao="Configuração de cada setor"
          onClick={() => aoIrPara('ajustesDepartamentos')}
        />
        <LinhaNav
          Icone={UserRound}
          rotulo="Conta"
          descricao={ehAdmin ? 'Sua conta e convites de acesso' : 'Sua conta de acesso'}
          onClick={() => aoIrPara('ajustesConta')}
        />
        <LinhaNav
          Icone={Bell}
          rotulo="Notificações"
          descricao="Avisos da escala no aparelho"
          onClick={() => aoIrPara('ajustesNotificacoes')}
        />
        <LinhaNav
          Icone={Info}
          rotulo="Sobre o app"
          descricao="Para que serve, privacidade, aparência e versão"
          onClick={() => setSobreAberto(true)}
        />
      </ul>

      <ModalInfo
        aberto={sobreAberto}
        aoFechar={() => setSobreAberto(false)}
        tema={tema}
        aoMudarTema={setTema}
      />
    </div>
  )
}

/** Subpágina Congregação: nome e número para salvar/editar. */
export function TelaCongregacao({
  config,
  congregacaoNumero,
  aoSalvar,
  aoAvisar,
}: {
  config: ConfigEscala
  congregacaoNumero: string
  aoSalvar: (nome: string, numero: string) => Promise<void>
  aoAvisar?: (texto: string, tipo?: TipoToast) => void
}) {
  const [nome, setNome] = useState(config.congregacao)
  const [numero, setNumero] = useState(congregacaoNumero)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!nome.trim()) {
      setErro('Informe o nome da congregação.')
      return
    }
    setSalvando(true)
    setErro('')
    try {
      await aoSalvar(nome.trim(), numero.trim())
      aoAvisar?.('Dados da congregação atualizados.')
    } catch {
      setErro('Não foi possível salvar. Verifique a conexão e tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-5">
      <CabecalhoSub
        titulo="Congregação"
        descricao="Identificação usada no cabeçalho das escalas e nos links públicos."
      />
      <div>
        <Rotulo htmlFor="cfg-cong">Nome da congregação</Rotulo>
        <Input
          id="cfg-cong"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
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
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="Ex.: 12345"
          enterKeyHint="done"
        />
      </div>
      {erro ? (
        <p role="alert" className="text-sm font-semibold text-crimson">
          {erro}
        </p>
      ) : null}
      <Botao variante="primario" className="w-full" disabled={salvando} onClick={salvar}>
        <Check className="size-4" aria-hidden="true" />
        {salvando ? 'Salvando…' : 'Salvar congregação'}
      </Botao>
    </div>
  )
}

/** Subpágina Departamentos: lista dos setores; clicar abre a configuração dele. */
export function TelaDepartamentos({
  usuario,
  aoIrParaSetor,
}: {
  usuario: Usuario
  aoIrParaSetor: (setor: SetorId) => void
}) {
  const setores: SetorId[] =
    usuario.papel === 'ADMIN' ? [...SETORES] : usuario.setor ? [usuario.setor] : []

  return (
    <div className="space-y-4">
      <CabecalhoSub
        titulo="Departamentos"
        descricao="Abra a configuração de cada setor da congregação."
      />
      <ul className="divide-y divide-line">
        {setores.map((setor) => {
          const Icone = setor === 'CAMPO' ? MapPin : setor === 'AUDIO_VIDEO' ? Radio : BookOpen
          return (
            <LinhaNav
              key={setor}
              Icone={Icone}
              rotulo={ROTULO_SETOR[setor]}
              descricao={DESCRICAO_SETOR[setor]}
              onClick={() => aoIrParaSetor(setor)}
            />
          )
        })}
      </ul>
    </div>
  )
}

interface ConviteVisivel extends ConviteListado {
  criadoFmt: string
  expiraFmt: string
}

/** Subpágina Conta: identidade da conta e, para o admin, convites e equipe. */
export function TelaConta({
  usuario,
  aoAvisar,
}: {
  usuario: Usuario
  aoAvisar?: (texto: string, tipo?: TipoToast) => void
}) {
  const admin = usuario.papel === 'ADMIN'
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
      setLinkNovo({ setor, href: linkAbsoluto(resultado.link), expiraFmt: dataCurta(resultado.expira_em) })
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
      aoAvisar?.('Link de convite removido.', 'remocao')
    } catch (falha) {
      setConviteErro(falha instanceof ErroAuth ? textoErroAuth(falha.codigo) : 'Falha de conexão.')
    } finally {
      setConviteRemocaoOcupada(false)
    }
  }

  async function aoConfirmarRemocao() {
    if (!membroRemovendo) return
    setRemovendoOcupado(true)
    setEquipeErro(null)
    try {
      await removerEquipe(membroRemovendo.id)
      const lista = await listarEquipe()
      setEquipe(lista)
      aoAvisar?.(`${membroRemovendo.nome} saiu da equipe.`, 'remocao')
      setMembroRemovendo(null)
    } catch (falha) {
      setEquipeErro(
        falha instanceof ErroAuth ? textoErroEquipe(falha.codigo) : 'Falha de conexão.',
      )
    } finally {
      setRemovendoOcupado(false)
    }
  }

  return (
    <div className="space-y-6">
      <CabecalhoSub
        titulo="Conta"
        descricao={admin ? 'Sua conta, convites de acesso e a equipe.' : 'Sua conta de acesso.'}
      />

      <ul className="divide-y divide-line">
        <li className="flex items-center gap-4 px-1 py-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-tint text-sm font-bold text-primary-700">
            {iniciais(usuario.nome)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{usuario.nome}</p>
            <p className="truncate text-[13px] text-muted">{usuario.email}</p>
          </div>
          <span className="shrink-0 text-[13px] font-semibold text-muted">
            {admin ? 'Administrador' : 'Ajudante'}
          </span>
        </li>
      </ul>

      {admin ? (
        <>
          <section className="space-y-2">
            <h2 className="px-1 text-lg font-semibold text-ink">Convites de acesso</h2>
            <p className="px-1 text-sm text-muted">
              Convide ajudantes por link, com validade de 7 dias e uso único.
            </p>
            <ul className="divide-y divide-line">
              {SETORES.map((setor) => (
                <li key={setor} className="flex items-center justify-between gap-4 px-1 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{ROTULO_SETOR[setor]}</p>
                    <p className="text-[13px] text-muted">{DESCRICAO_SETOR[setor]}</p>
                  </div>
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
                </li>
              ))}
            </ul>

            {linkNovo ? (
              <div className="rounded-xl border-l-2 border-teal bg-teal-tint p-4">
                <Kicker className="text-teal">Link gerado para {ROTULO_SETOR[linkNovo.setor]}</Kicker>
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
              <p role="alert" className="rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] font-semibold text-ink">
                {conviteErro}
              </p>
            ) : null}

            {convites === null ? (
              <p className="px-1 text-[13px] text-muted">Carregando convites…</p>
            ) : convites.length ? (
              <ul className="divide-y divide-line">
                {convites.map((convite) => (
                  <li key={convite.token} className="flex items-center justify-between gap-3 px-1 py-3">
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
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-1 text-[13px] text-muted">Nenhum convite gerado ainda.</p>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="px-1 text-lg font-semibold text-ink">Equipe</h2>
            <p className="px-1 text-sm text-muted">Contas com acesso ao aplicativo.</p>
            {!equipe ? (
              <p className="px-1 text-[13px] text-muted">Carregando equipe…</p>
            ) : !equipe.length ? (
              <p className="px-1 text-[13px] text-muted">Nenhuma conta encontrada.</p>
            ) : (
              <ul className="divide-y divide-line">
                {equipe.map((membro) => {
                  const eu = membro.id === usuario.id
                  return (
                    <li key={membro.id} className="flex items-center gap-3 px-1 py-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-tint text-sm font-bold text-primary-700">
                        {iniciais(membro.nome)}
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
                            ? 'bg-teal-tint text-primary-700'
                            : 'bg-line text-ink-soft'
                        }`}
                      >
                        {membro.papel === 'ADMIN'
                          ? 'Administrador'
                          : membro.setor
                            ? ROTULO_SETOR[membro.setor]
                            : 'Ajudante'}
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
              <p role="alert" className="px-1 text-[13px] font-semibold text-crimson">
                {equipeErro}
              </p>
            ) : null}
          </section>
        </>
      ) : null}

      <PopConfirm
        aberto={membroRemovendo !== null}
        aoFechar={() => {
          if (!removendoOcupado) setMembroRemovendo(null)
        }}
        titulo="Remover da equipe?"
        descricao={
          membroRemovendo
            ? `${membroRemovendo.nome} perde o acesso ao aplicativo imediatamente. As fichas e a escala continuam salvas.`
            : ''
        }
        confirmarRotulo="Remover"
        ocupado={removendoOcupado}
        aoConfirmar={aoConfirmarRemocao}
      />

      <PopConfirm
        aberto={conviteRemovendo !== null}
        aoFechar={() => {
          if (!conviteRemocaoOcupada) setConviteRemovendo(null)
        }}
        titulo="Excluir link de convite?"
        descricao="O link deixará de funcionar imediatamente, mesmo que ainda não tenha expirado."
        ocupado={conviteRemocaoOcupada}
        aoConfirmar={aoConfirmarRemocaoConvite}
      />
    </div>
  )
}

/** Subpágina Notificações: ativação e teste do push. */
export function TelaNotificacoes({
  aoAvisar,
}: {
  aoAvisar?: (texto: string, tipo?: TipoToast) => void
}) {
  const [push, setPush] = useState<EstadoNotificacoes | null>(null)
  const [pushOcupado, setPushOcupado] = useState(false)
  const [pushMensagem, setPushMensagem] = useState<string | null>(null)
  const [testeOcupado, setTesteOcupado] = useState(false)
  const [testeMensagem, setTesteMensagem] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    estadoNotificacoes().then((estado) => {
      if (vivo) setPush(estado)
    })
    return () => {
      vivo = false
    }
  }, [])

  async function aoAtivarPush() {
    setPushOcupado(true)
    setPushMensagem(null)
    const resultado = await ativarNotificacoes()
    const textos: Record<ResultadoAtivacao, string> = {
      ativo: 'Pronto! Este aparelho já recebe notificações da escala.',
      aguardando_servidor:
        'Permissão concedida. Falta configurar as chaves de push no servidor (PUSH_VAPID_PUBLICA).',
      bloqueado: 'Notificações bloqueadas, libere-as nas configurações do navegador.',
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
    if (!resultado.erro) aoAvisar?.('Teste enviado.')
  }

  return (
    <div className="space-y-6">
      <CabecalhoSub
        titulo="Notificações"
        descricao="Avisos no aparelho mesmo com o app fechado."
      />

      <div className="rounded-xl border-l-2 border-teal bg-teal-tint p-4">
        <p className="text-sm font-semibold text-teal">Notificações push</p>
        <p className="mt-0.5 text-[13px] text-ink">
          {!push
            ? 'Verificando este aparelho…'
            : !push.suporta
              ? 'Este navegador não suporta notificações.'
              : push.inscrito
                ? 'Ativo neste aparelho.'
                : push.permissao === 'denied'
                  ? 'Bloqueadas, libere nas configurações do navegador.'
                  : 'Ative para receber avisos da escala no aparelho.'}
        </p>
        {pushMensagem ? (
          <p className="mt-1.5 text-[12px] font-semibold text-teal">{pushMensagem}</p>
        ) : null}
      </div>

      <Botao
        variante="primario"
        className="w-full"
        disabled={!push?.suporta || push?.inscrito === true || pushOcupado}
        onClick={aoAtivarPush}
      >
        <Bell className="size-4" aria-hidden="true" />
        {push?.inscrito ? 'Notificações ativadas' : 'Ativar notificações'}
      </Botao>

      <Botao
        variante="secundario"
        className="w-full"
        disabled={pushOcupado || testeOcupado}
        onClick={aoEnviarTeste}
      >
        <Send className="size-4" aria-hidden="true" />
        {testeOcupado ? 'Enviando teste…' : 'Enviar teste'}
      </Botao>

      {testeMensagem ? (
        <p className="rounded-xl border-l-2 border-teal bg-teal-tint px-3 py-2 text-[13px] text-ink">
          {testeMensagem}
        </p>
      ) : null}

      <footer className="flex flex-col items-center gap-1 pb-2 pt-4 text-center">
        <span className="mb-1 flex size-8 items-center justify-center rounded-full bg-teal-tint text-teal">
          <ShieldCheck className="size-[18px]" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold text-ink">Designa</span>
      </footer>
    </div>
  )
}
