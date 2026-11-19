import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Eye, EyeOff, Loader2, Mail, UserCheck, Users } from 'lucide-react'
import type { Usuario } from '../lib/dominio'
import { ROTULO_SETOR } from '../lib/dominio'
import { ErroAuth, aceitarConvite, entrarComGoogle, infoConvite, textoErroAuth } from '../lib/authApi'
import { googleConfigurado, renderizarBotaoGoogle } from '../lib/google'
import { Botao, Input, Kicker, Rotulo } from './ui'
import Logo from './Logo'

interface InfoConvite {
  congregacao: string
  setor: keyof typeof ROTULO_SETOR
}

type Fase =
  | { id: 'verificando' }
  | { id: 'erro'; codigo: string }
  | { id: 'form'; info: InfoConvite }
  | { id: 'pronto'; usuario: Usuario; email: string }

/** Tela pública do convidado: lê o token e cria a conta do ajudante do setor. */
export default function TelaConvite({
  token,
  aoEntrar,
}: {
  token: string
  aoEntrar: (usuario: Usuario) => void
}) {
  const [fase, setFase] = useState<Fase>({ id: 'verificando' })
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  /** Validando o credential do Google antes de preencher a ficha. */
  const [validando, setValidando] = useState(false)
  const [verSenha, setVerSenha] = useState(false)
  /** Credential do Google de quem ainda não tem conta: fecha o convite sem senha. */
  const [credencialGoogle, setCredencialGoogle] = useState<string | null>(null)

  /** Chegou pelo Google e falta só confirmar: e-mail vem do Google. */
  const viaGoogle = credencialGoogle !== null

  /** Botão do Google: valida o credential e preenche a ficha do convidado. */
  async function aoEntrarComGoogle(credential: string) {
    setErro(null)
    setValidando(true)
    try {
      const resposta = await entrarComGoogle(credential)
      if ('usuario' in resposta) {
        // Conta já existe: o convite não pode ser usado de novo neste e-mail.
        setErro('Já existe uma conta com este e-mail. Faça login ou use outro.')
        return
      }
      setNome(resposta.nome)
      setEmail(resposta.email)
      setSenha('')
      setCredencialGoogle(credential)
    } catch (falha) {
      setErro(
        falha instanceof ErroAuth ? textoErroAuth(falha.codigo) : 'Falha de conexão, tente novamente.',
      )
    } finally {
      setValidando(false)
    }
  }

  // Guarda a versão mais recente do callback para o efeito do botão usar.
  const aoGoogleRef = useRef(aoEntrarComGoogle)
  useEffect(() => {
    aoGoogleRef.current = aoEntrarComGoogle
  })

  // Desenha o botão oficial do Google antes do formulário do convidado.
  const alvoGoogle = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (fase.id !== 'form' || viaGoogle || !googleConfigurado) return
    const alvo = alvoGoogle.current
    if (!alvo) return
    let vivo = true
    renderizarBotaoGoogle(alvo, (credential) => {
      if (vivo) void aoGoogleRef.current(credential)
    }).catch(() => {
      // GIS fora do ar: o alvo fica vazio e o formulário segue normal.
      if (vivo) alvo.replaceChildren()
    })
    return () => {
      vivo = false
    }
  }, [fase.id, viaGoogle])

  useEffect(() => {
    let vivo = true
    infoConvite(token)
      .then((info) => {
        if (vivo) setFase({ id: 'form', info })
      })
      .catch((falha: unknown) => {
        if (vivo) {
          setFase({
            id: 'erro',
            codigo: falha instanceof ErroAuth ? falha.codigo : 'falha_conexao',
          })
        }
      })
    return () => {
      vivo = false
    }
  }, [token])

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)
    const completo = nome.trim()
    const emailLimpo = email.trim().toLowerCase()

    if (completo.length < 3) {
      setErro('Informe seu nome completo.')
      return
    }
    // No convite pelo Google, e-mail e senha vêm do próprio Google.
    if (!viaGoogle) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailLimpo)) {
        setErro('Informe um e-mail válido.')
        return
      }
      if (senha.length < 6) {
        setErro('A senha precisa de pelo menos 6 caracteres.')
        return
      }
    }

    setOcupado(true)
    try {
      const resultado = await aceitarConvite({
        token,
        nome: completo,
        email: emailLimpo,
        senha,
        credential: credencialGoogle ?? undefined,
      })
      setFase({ id: 'pronto', usuario: resultado.usuario, email: resultado.email })
    } catch (falha) {
      if (falha instanceof ErroAuth && (falha.status === 404 || falha.status === 410)) {
        setFase({ id: 'erro', codigo: falha.codigo })
      } else if (falha instanceof ErroAuth && falha.codigo === 'email_em_uso') {
        setErro('Já existe uma conta com este e-mail. Faça login ou use outro.')
      } else {
        setErro(falha instanceof ErroAuth ? textoErroAuth(falha.codigo) : 'Falha de conexão, tente novamente.')
      }
    } finally {
      setOcupado(false)
    }
  }

  if (fase.id === 'verificando') {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 px-6 text-center">
        <Loader2 className="size-7 animate-spin text-teal" aria-hidden="true" />
        <p className="text-sm text-muted">Verificando o convite…</p>
      </div>
    )
  }

  if (fase.id === 'erro') {
    return (
      <div className="mx-auto flex min-h-svh max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-crimson-bg text-crimson">
          <AlertTriangle className="size-7" aria-hidden="true" />
        </span>
        <h1 className="text-xl font-bold text-ink">Convite indisponível</h1>
        <p className="max-w-sm text-sm text-muted">{textoErroAuth(fase.codigo)}</p>
        <Botao variante="primario" onClick={() => window.location.assign('/')}>
          Ir para o login
        </Botao>
      </div>
    )
  }

  if (fase.id === 'pronto') {
    return (
      <div className="mx-auto flex min-h-svh max-w-lg flex-col items-center justify-center gap-5 px-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-success-bg text-success">
          <UserCheck className="size-7" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-ink">Conta criada!</h1>
          <p className="mt-1 text-sm text-muted">
            Acesso completo ao setor {ROTULO_SETOR[fase.usuario.setor ?? 'CAMPO']}, incluindo
            cadastro de voluntários e configuração do departamento.
          </p>
        </div>
        <div className="w-full rounded-xl border border-line bg-card p-4 text-left shadow-sm">
          <Kicker className="text-muted">Seu e-mail de acesso</Kicker>
          <p className="mt-1 flex items-center gap-2 break-all text-sm font-semibold text-ink">
            <Mail className="size-4 shrink-0 text-teal" aria-hidden="true" />
            {fase.email}
          </p>
          <p className="mt-1.5 text-[12px] text-muted">
            {viaGoogle
              ? 'Use este e-mail para entrar de novo pela sua conta Google, neste aparelho ou em outro.'
              : 'Use este e-mail e a senha que você escolheu para entrar de novo, neste aparelho ou em outro.'}
          </p>
        </div>
        <Botao variante="primario" className="w-full" onClick={() => aoEntrar(fase.usuario)}>
          <Users className="size-4" aria-hidden="true" />
          Entrar no app
        </Botao>
      </div>
    )
  }

  const info = fase.info

  return (
    <div className="flex min-h-svh flex-col justify-center px-5 py-8">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-5 text-center">
          <Logo alt="" className="mx-auto h-9 w-auto" />
          <h1 className="mt-4 text-[18px] font-bold leading-snug tracking-tight text-ink">
            Você foi convidado para gerenciar{' '}
            <span className="text-teal">{ROTULO_SETOR[info.setor]}</span> na Congregação{' '}
            {info.congregacao}.
          </h1>
        </header>

        {/* Primeiro o Google, depois o formulário do convidado. */}
        {googleConfigurado && !viaGoogle ? (
          <div className="mb-5">
            <div ref={alvoGoogle} className="flex justify-center" />
            <div className="mt-4 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-faint">ou</span>
              <span className="h-px flex-1 bg-line" />
            </div>
          </div>
        ) : null}

        <form onSubmit={enviar} className="space-y-4" noValidate>
          <div>
            <Rotulo htmlFor="cv-nome">Nome Completo</Rotulo>
            <Input
              id="cv-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="name"
              autoCapitalize="words"
              placeholder="Nome completo"
              autoFocus
              enterKeyHint="next"
            />
          </div>
          <div>
            <Rotulo htmlFor="cv-email">E-mail</Rotulo>
            <Input
              id="cv-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={viaGoogle}
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              placeholder="voce@exemplo.com"
              enterKeyHint="next"
              className={viaGoogle ? 'bg-line-soft text-muted' : ''}
            />
            {viaGoogle ? (
              <p className="mt-1.5 text-xs font-semibold text-teal">
                Conta do Google, validada pelo próprio Google.
              </p>
            ) : null}
          </div>
          {!viaGoogle ? (
            <div>
              <Rotulo htmlFor="cv-senha">Senha</Rotulo>
              <div className="relative">
                <Input
                  id="cv-senha"
                  type={verSenha ? 'text' : 'password'}
                  className="pr-11"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Mínimo de 6 caracteres"
                  enterKeyHint="done"
                />
                <button
                  type="button"
                  onClick={() => setVerSenha((v) => !v)}
                  aria-pressed={verSenha}
                  aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  title={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted transition-colors hover:bg-canvas hover:text-teal"
                >
                  {verSenha ? (
                    <EyeOff className="size-4" aria-hidden="true" />
                  ) : (
                    <Eye className="size-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          ) : null}

          {erro ? (
            <p
              role="alert"
              className="rounded-xl bg-crimson-bg px-3 py-2 text-[13px] font-semibold text-ink"
            >
              {erro}
            </p>
          ) : null}

          <Botao
            type="submit"
            variante="primario"
            className="w-full"
            disabled={ocupado || validando}
          >
            {ocupado || validando ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {ocupado
              ? 'Criando conta…'
              : validando
                ? 'Aguarde…'
                : viaGoogle
                  ? 'Confirmar e entrar'
                  : 'Criar conta e entrar'}
          </Botao>
        </form>

        {viaGoogle ? (
          <p className="mt-4 text-center text-[13px] text-muted">
            Prefere usar e-mail e senha?{' '}
            <button
              type="button"
              onClick={() => {
                setCredencialGoogle(null)
                setSenha('')
                setErro(null)
              }}
              className="font-semibold text-teal underline-offset-2 hover:underline"
            >
              Usar senha
            </button>
          </p>
        ) : null}

        <p className="mt-4 text-center text-[12px] text-muted">
          Você terá acesso completo ao setor {ROTULO_SETOR[info.setor]}: escala, voluntários e
          configuração do departamento.
        </p>
      </div>
    </div>
  )
}
