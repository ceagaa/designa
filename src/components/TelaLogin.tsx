import type { FormEvent } from 'react'
import { useState } from 'react'
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck, UserPlus } from 'lucide-react'
import type { Usuario } from '../lib/dominio'
import { ErroAuth, criarConta, entrar, textoErroAuth } from '../lib/authApi'
import { Botao, Input, Kicker, Rotulo } from './ui'

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

  function trocarModo(novo: Modo) {
    setModo(novo)
    setErro(null)
    setVerSenha(false)
  }

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
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
        setErro('Informe um e-mail válido.')
        return
      }
      if (senha.length < 6) {
        setErro('A senha precisa de pelo menos 6 caracteres.')
        return
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
          : await criarConta({
              nome: nome.trim(),
              email: email.trim(),
              senha,
              congregacaoNome: congregacaoNome.trim(),
              congregacaoNumero: congregacaoNumero.trim(),
            })
      aoEntrar(usuario)
    } catch (falha) {
      setErro(falha instanceof ErroAuth ? textoErroAuth(falha.codigo) : 'Falha de conexão — tente novamente.')
    } finally {
      setOcupado(false)
    }
  }

  const ehCriar = modo === 'criar'

  return (
    <div className="flex min-h-svh flex-col justify-center px-5 py-8">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-6 text-center">
          <span
            className="mx-auto flex w-fit items-center justify-center rounded-2xl bg-white px-5 py-3 shadow-lg"
            aria-hidden="true"
          >
            <img src="/img/LOGOTIPO.png" alt="" className="h-9 w-auto" draggable={false} />
          </span>
          <h1 className="mt-4 text-[27px] font-bold tracking-tight text-ink">Designa</h1>
          <p className="mt-1 text-sm text-muted">
            Designação da congregação, com acesso por setor.
          </p>
        </header>

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
              autoComplete="email"
              placeholder="voce@exemplo.com"
              enterKeyHint={ehCriar ? 'next' : 'next'}
              autoFocus={!ehCriar}
            />
          </div>

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
              className="rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] font-semibold text-ink"
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

        <p className="mt-5 text-center text-[13px] text-muted">
          {ehCriar ? (
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

        <p className="mt-4 flex items-start justify-center gap-1.5 text-center text-[12px] text-muted">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Recebeu um convite? O link do convite já abre direto o cadastro do seu setor.
        </p>
      </div>
    </div>
  )
}
