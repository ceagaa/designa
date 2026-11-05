import { useState } from 'react'
import { CircleHelp } from 'lucide-react'
import type { Tema } from '../lib/tema'
import { temaSalvo } from '../lib/tema'
import ModalInfo from './ModalInfo'

/**
 * Botão de informação + sheet "Sobre o app": lista de opções (Política,
 * Aparência, Versão), cada uma abrindo a própria página dentro do sheet, com
 * botão de voltar. Usado nas páginas públicas; a área logada abre o sheet pela
 * lista de Ajustes (que passa `semAparencia`, porque lá a Aparência é linha
 * própria).
 *
 * `variante="cabecalho"` deixa o botão sem borda, no mesmo espírito dos
 * controles do header.
 *
 * Autocontido, o tema já é aplicado no documento pelo `iniciarTema()` de
 * main.tsx, então aqui basta ler a escolha salva para o modal abrir marcado.
 */
export default function InfoApp({
  variante = 'publico',
}: {
  variante?: 'publico' | 'cabecalho'
}) {
  const [aberto, setAberto] = useState(false)
  const [tema, setTema] = useState<Tema>(() => temaSalvo())

  const caixa =
    variante === 'cabecalho'
      ? 'flex size-11 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 active:bg-white/25'
      : 'flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink-soft transition-colors hover:border-teal/40 hover:text-teal'

  return (
    <>
      <button
        type="button"
        aria-label="Sobre o app"
        title="Sobre o app"
        onClick={() => setAberto(true)}
        className={caixa}
      >
        <CircleHelp className="size-5" strokeWidth={1.8} aria-hidden="true" />
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
