import type { Usuario } from '../lib/dominio'
import { ROTULO_SETOR } from '../lib/dominio'
import { Building2, LogOut, ShieldCheck, UserRound } from 'lucide-react'
import { Botao } from './ui'
import { iniciais } from '../lib/utilitarios'

/**
 * Área de perfil: identidade da conta logada, departamento que gerencia e a
 * congregação, com a saída da conta no fim. Usa separadores (sem cartões).
 */
export default function TelaPerfil({
  usuario,
  aoSair,
}: {
  usuario: Usuario
  aoSair: () => void
}) {
  const ehAdmin = usuario.papel === 'ADMIN'
  const departamento = ehAdmin
    ? 'Administrador geral'
    : usuario.setor
      ? ROTULO_SETOR[usuario.setor]
      : 'Ajudante'

  return (
    <div className="space-y-6">
      <header className="flex flex-col items-center gap-3 py-2 text-center">
        <span
          className="flex size-20 items-center justify-center rounded-full bg-teal-tint text-2xl font-extrabold text-primary-700"
          aria-hidden="true"
        >
          {iniciais(usuario.nome)}
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-ink">{usuario.nome}</h1>
          <p className="mt-0.5 truncate text-sm text-muted">{usuario.email}</p>
        </div>
      </header>

      <ul className="divide-y divide-line">
        <li className="flex items-center gap-4 px-1 py-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-teal-tint text-teal">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">Departamento</p>
            <p className="text-[13px] text-muted">
              {ehAdmin ? 'Gerencia todos os setores da congregação' : 'Acesso apenas a este setor'}
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-ink">{departamento}</span>
        </li>
        <li className="flex items-center gap-4 px-1 py-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-teal-tint text-teal">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">Congregação</p>
            <p className="text-[13px] text-muted">
              {usuario.congregacao.numero
                ? `Nº ${usuario.congregacao.numero}`
                : 'Número não informado'}
            </p>
          </div>
          <span className="shrink-0 max-w-[40%] truncate text-sm font-semibold text-ink">
            {usuario.congregacao.nome}
          </span>
        </li>
        <li className="flex items-center gap-4 px-1 py-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-teal-tint text-teal">
            <UserRound className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">Conta</p>
            <p className="text-[13px] text-muted">
              {ehAdmin ? 'Administrador' : 'Ajudante por convite'}
            </p>
          </div>
        </li>
      </ul>

      <Botao variante="secundario" className="w-full" onClick={aoSair}>
        <LogOut className="size-4" aria-hidden="true" />
        Sair da conta
      </Botao>
    </div>
  )
}
