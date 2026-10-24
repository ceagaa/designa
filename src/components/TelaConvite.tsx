import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { AlertTriangle, Eye, EyeOff, Loader2, Mail, UserCheck, Users } from 'lucide-react'
import type { Usuario } from '../lib/dominio'
import { ROTULO_SETOR } from '../lib/dominio'
import { ErroAuth, aceitarConvite, infoConvite, textoErroAuth } from '../lib/authApi'
import { Botao, Input, Kicker, Rotulo } from './ui'

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
  const [sobrenome, setSobrenome] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [verSenha, setVerSenha] = useState(false)

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
    const completo = `${nome.trim()} ${sobrenome.trim()}`.trim()
    if (completo.length < 3) {
      setErro('Informe nome e sobrenome.')
      return
    }
    if (senha.length < 6) {
      setErro('A senha precisa de pelo menos 6 caracteres.')
      return
    }
    setOcupado(true)
    try {
      const resultado = await aceitarConvite({ token, nome: completo, senha })
      setFase({ id: 'pronto', usuario: resultado.usuario, email: resultado.email })
    } catch (falha) {
      if (falha instanceof ErroAuth && (falha.status === 404 || falha.status === 410)) {
        setFase({ id: 'erro', codigo: falha.codigo })
      } else {
        setErro(falha instanceof ErroAuth ? textoErroAuth(falha.codigo) : 'Falha de conexão — tente novamente.')
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
            Acesso liberado ao setor {ROTULO_SETOR[fase.usuario.setor ?? 'CAMPO']}.
          </p>
        </div>
        <div className="w-full rounded-xl border border-line bg-card p-4 text-left shadow-sm">
          <Kicker className="text-muted">Seu e-mail de acesso</Kicker>
          <p className="mt-1 flex items-center gap-2 break-all text-sm font-semibold text-ink">
            <Mail className="size-4 shrink-0 text-teal" aria-hidden="true" />
            {fase.email}
          </p>
          <p className="mt-1.5 text-[12px] text-muted">
            Guarde este e-mail: é com ele (e esta senha) que você entra depois, neste mesmo
            aparelho ou em outro.
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
          <span
            className="mx-auto flex w-fit items-center justify-center rounded-2xl bg-white px-5 py-3 shadow-lg"
            aria-hidden="true"
          >
            <img src="/img/LOGOTIPO.png" alt="" className="h-9 w-auto" draggable={false} />
          </span>
          <h1 className="mt-4 text-[22px] font-bold leading-snug tracking-tight text-ink">
            Você foi convidado para gerenciar{' '}
            <span className="text-teal">{ROTULO_SETOR[info.setor]}</span> na Congregação{' '}
            {info.congregacao}.
          </h1>
        </header>

        <form onSubmit={enviar} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Rotulo htmlFor="cv-nome">Nome</Rotulo>
              <Input
                id="cv-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoComplete="given-name"
                autoCapitalize="words"
                placeholder="Nome"
                autoFocus
                enterKeyHint="next"
              />
            </div>
            <div>
              <Rotulo htmlFor="cv-sobrenome">Sobrenome</Rotulo>
              <Input
                id="cv-sobrenome"
                value={sobrenome}
                onChange={(e) => setSobrenome(e.target.value)}
                autoComplete="family-name"
                autoCapitalize="words"
                placeholder="Sobrenome"
                enterKeyHint="next"
              />
            </div>
          </div>
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

          {erro ? (
            <p
              role="alert"
              className="rounded-xl border-l-2 border-crimson bg-crimson-bg px-3 py-2 text-[13px] font-semibold text-ink"
            >
              {erro}
            </p>
          ) : null}

          <Botao type="submit" variante="primario" className="w-full" disabled={ocupado}>
            {ocupado ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {ocupado ? 'Criando conta…' : 'Criar conta e entrar'}
          </Botao>
        </form>

        <p className="mt-4 text-center text-[12px] text-muted">
          Acesso restrito ao setor {ROTULO_SETOR[info.setor]}.
        </p>
      </div>
    </div>
  )
}
