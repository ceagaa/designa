import { useState } from 'react'
import { Info } from 'lucide-react'
import type { Tema } from '../lib/tema'
import { temaSalvo } from '../lib/tema'
import ModalInfo from './ModalInfo'

/**
 * Botão de informação das páginas públicas: abre o sheet "Sobre o app"
 * (versão, finalidade, privacidade e tema claro/escuro/automático).
 *
 * Autocontido — cada página pública só o renderiza no cabeçalho. O tema já é
 * aplicado no documento pelo `iniciarTema()` de main.tsx, então aqui basta
 * ler a escolha salva para marcar o botão ativo.
 */
export default function InfoPublica({ className = '' }: { className?: string }) {
  const [aberto, setAberto] = useState(false)
  const [tema, setTema] = useState<Tema>(() => temaSalvo())

  return (
    <>
      <button
        type="button"
        aria-label="Sobre o app"
        title="Sobre o app"
        onClick={() => setAberto(true)}
        className={`flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink-soft transition-colors hover:border-teal/40 hover:text-teal ${className}`}
      >
        <Info className="size-5" aria-hidden="true" />
      </button>

      <ModalInfo
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        tema={tema}
        aoMudarTema={setTema}
      />
    </>
  )
}
