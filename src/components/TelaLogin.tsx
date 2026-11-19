import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Eye, EyeOff, Loader2, UserPlus } from 'lucide-react'
import type { Usuario } from '../lib/dominio'
import { ErroAuth, criarConta, entrar, entrarComGoogle, textoErroAuth } from '../lib/authApi'
import { googleConfigurado, renderizarBotaoGoogle } from '../lib/google'
import { Botao, Input, Kicker, Rotulo } from './ui'
import Logo from './Logo'

type Modo = 'entrar' | 'criar'

/** Tela de acesso: login do administrador ou criação de conta + congregação. */
export default function TelaLogin({ aoEntrar }: { aoEntrar: (usuario: Usuario) => void }) {
  const [modo, setModo] = useState<Modo>('entrar')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [verSenha, setVerSenha] = useState(false)

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nome, setNome] = useState('')
  const [congregacaoNome, setCongregacaoNome] = useState('')
  const [congregacaoNumero, setCongregacaoNumero] = useState('')
  /** Credential do Google de quem ainda não tem conta no D1 (cadastro pendente). */
  const [credencialGoogle, setCredencialGoogle] = useState<string | null>(null)

  /** Chegou pelo Google e falta só a congregação: sem campo de senha. */
  const viaGoogle = credencialGoogle !== null

  function trocarModo(novo: Modo) {
    setModo(novo)
    setErro(null)
    setVerSenha(false)
    // Sair do cadastro pendente descarta o credential do Google.
    if (novo === 'entrar') setCredencialGoogle(null)
  }

  /** Callback do Google Identity Services: conta existente entra, nova prefills. */
  async function aoEntrarComGoogle(credential: string) {
    setErro(null)
    setOcupado(true)
    try {
      const resposta = await entrarComGoogle(credential)
      if ('usuario' in resposta) {
        aoEntrar(resposta.usuario)
        return
      }
      setNome(resposta.nome)
      setEmail(resposta.email)
      setSenha('')
      setCredencialGoogle(credential)
      setModo('criar')
    } catch (falha) {
      setErro(falha instanceof ErroAuth ? textoErroAuth(falha.codigo) : 'Falha de conexão, tente novamente.')
    } finally {
      setOcupado(false)
    }
  }

  // Guarda a versão mais recente do callback para o efeito do botão usar.
  const aoGoogleRef = useRef(aoEntrarComGoogle)
  useEffect(() => {
    aoGoogleRef.current = aoEntrarComGoogle
  })

  // Desenha o botão oficial do Google no modo Entrar (só com Client ID no .env).
  const alvoGoogle = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (modo !== 'entrar' || !googleConfigurado) return
    const alvo = alvoGoogle.current
    if (!alvo) return
    let vivo = true
    renderizarBotaoGoogle(alvo, (credential) => {
      if (vivo) void aoGoogleRef.current(credential)
    }).catch(() => {
      // GIS fora do ar: o alvo fica vazio e o login por e-mail segue normal.
      if (vivo) alvo.replaceChildren()
    })
    return () => {
      vivo = false
    }
  }, [modo])

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (modo === 'entrar') {
      if (!email.trim() || !senha) {
        setErro('Preencha o e-mail e a senha.')
        return
      }
    } else {
      if (nome.trim().length < 2) {
        setErro('Informe seu nome completo.')
        return
      }
      // No cadastro pelo Google, e-mail e senha vêm do próprio Google.
      if (!viaGoogle) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
          setErro('Informe um e-mail válido.')
          return
        }
        if (senha.length < 6) {
          setErro('A senha precisa de pelo menos 6 caracteres.')
          return
        }
      }
      if (congregacaoNome.trim().length < 3) {
        setErro('Informe o nome da congregação.')
        return
      }
    }

    setOcupado(true)
    try {
      const usuario =
        modo === 'entrar'
          ? await entrar(email.trim(), senha)
          : viaGoogle
            ? await completarCadastroGoogle()
            : await criarConta({
                nome: nome.trim(),
                email: email.trim(),
                senha,
                congregacaoNome: congregacaoNome.trim(),
                congregacaoNumero: congregacaoNumero.trim(),
              })
      aoEntrar(usuario)
    } catch (falha) {
      setErro(falha instanceof ErroAuth ? textoErroAuth(falha.codigo) : 'Falha de conexão, tente novamente.')
    } finally {
      setOcupado(false)
    }
  }

  /** Envia a congregação para o Worker criar a conta a partir do credential. */
  async function completarCadastroGoogle(): Promise<Usuario> {
    const resposta = await entrarComGoogle(credencialGoogle ?? '', {
      congregacaoNome: congregacaoNome.trim(),
      congregacaoNumero: congregacaoNumero.trim(),
    })
    if ('usuario' in resposta) return resposta.usuario
    // Sem congregação válida o Worker devolve de novo o prefill.
    throw new ErroAuth(400, 'congregacao_invalida')
  }

  const ehCriar = modo === 'criar'

  return (
    <div className="flex min-h-svh items-center justify-center px-5 py-8">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-10 md:grid-cols-2 md:gap-16">
        <header className="text-center md:text-left">
          <h1 className="mx-auto w-fit md:mx-0">
            <Logo alt="Designa" className="h-14 w-auto md:h-20" />
          </h1>
          <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-teal">
            Designações mecânicas automáticas
          </p>
          <h2 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-ink md:text-3xl">
            Tudo o que sua equipe precisa para cuidar das designações mecânicas da congregação.
          </h2>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted">
            Automatize a designação mecânica, acompanhe em tempo real e mantenha a boa organização
            em um só lugar.
          </p>
          <p className="mt-5 text-sm font-semibold text-ink">
            Feito para automatizar as designações mecânicas
          </p>
        </header>

        <div className="w-full max-w-md md:justify-self-end">
          <div
            role="group"
            aria-label="Modo de acesso"
            className="flex rounded-xl bg-card p-1 shadow-sm"
          >
            <button
              type="button"
              aria-pressed={!ehCriar}
              onClick={() => trocarModo('entrar')}
              className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                !ehCriar ? 'bg-teal text-white shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              aria-pressed={ehCriar}
              onClick={() => trocarModo('criar')}
              className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                ehCriar ? 'bg-teal text-white shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={enviar} className="mt-5 space-y-4" noValidate>
            {ehCriar ? (
              <div>
                <Rotulo htmlFor="lg-nome">Nome do administrador</Rotulo>
                <Input
                  id="lg-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  autoComplete="name"
                  placeholder="Seu nome completo"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  autoFocus
                />
              </div>
            ) : null}

            <div>
              <Rotulo htmlFor="lg-email">E-mail</Rotulo>
              <Input
                id="lg-email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={viaGoogle}
                autoComplete="email"
                placeholder="voce@exemplo.com"
                enterKeyHint={ehCriar ? 'next' : 'next'}
                autoFocus={!ehCriar && !viaGoogle}
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
                <Rotulo htmlFor="lg-senha">Senha</Rotulo>
                <div className="relative">
                  <Input
                    id="lg-senha"
                    type={verSenha ? 'text' : 'password'}
                    className="pr-11"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    autoComplete={ehCriar ? 'new-password' : 'current-password'}
                    placeholder={ehCriar ? 'Mínimo de 6 caracteres' : 'Sua senha'}
                    enterKeyHint={ehCriar ? 'next' : 'done'}
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

            {ehCriar ? (
              <>
                <div className="border-t border-line-soft pt-4">
                  <Kicker className="text-muted">Congregação</Kicker>
                </div>
                <div>
                  <Rotulo htmlFor="lg-cong">Nome da congregação</Rotulo>
                  <Input
                    id="lg-cong"
                    value={congregacaoNome}
                    onChange={(e) => setCongregacaoNome(e.target.value)}
                    placeholder="Ex.: Bancários"
                    autoCapitalize="words"
                    enterKeyHint="next"
                  />
                </div>
                <div>
                  <Rotulo htmlFor="lg-num">Número (opcional)</Rotulo>
                  <Input
                    id="lg-num"
                    inputMode="numeric"
                    value={congregacaoNumero}
                    onChange={(e) => setCongregacaoNumero(e.target.value)}
                    placeholder="Ex.: 140921"
                    enterKeyHint="done"
                  />
                </div>
              </>
            ) : null}

            {erro ? (
              <p
                role="alert"
                className="rounded-xl bg-crimson-bg px-3 py-2 text-[13px] font-semibold text-ink"
              >
                {erro}
              </p>
            ) : null}

            <Botao type="submit" variante="primario" className="w-full" disabled={ocupado}>
              {ocupado ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : ehCriar ? (
                <UserPlus className="size-4" aria-hidden="true" />
              ) : (
                <ArrowRight className="size-4" aria-hidden="true" />
              )}
              {ocupado ? 'Aguarde…' : ehCriar ? 'Criar conta' : 'Entrar'}
            </Botao>
          </form>

          {!ehCriar && googleConfigurado ? (
            <div className="mt-5">
              <div className="flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-line" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-faint">ou</span>
                <span className="h-px flex-1 bg-line" />
              </div>
              <div ref={alvoGoogle} className="mt-4 flex justify-center" />
            </div>
          ) : null}

          <p className="mt-5 text-center text-[13px] text-muted">
            {viaGoogle ? (
              <>
                Prefere usar e-mail e senha?{' '}
                <button
                  type="button"
                  onClick={() => trocarModo('entrar')}
                  className="font-semibold text-teal underline-offset-2 hover:underline"
                >
                  Entrar com senha
                </button>
              </>
            ) : ehCriar ? (
              <>
                Já tem conta?{' '}
                <button
                  type="button"
                  onClick={() => trocarModo('entrar')}
                  className="font-semibold text-teal underline-offset-2 hover:underline"
                >
                  Entrar
                </button>
              </>
            ) : (
              <>
                Não tem conta?{' '}
                <button
                  type="button"
                  onClick={() => trocarModo('criar')}
                  className="font-semibold text-teal underline-offset-2 hover:underline"
                >
                  Criar conta de administrador
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
