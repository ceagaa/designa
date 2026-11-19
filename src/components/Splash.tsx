/**
 * Splash (12 do manual): fundo em degradê teal com brilho radial e o
 * logotipo sozinho, em versão branca (o PNG é recolorido com filtro),
 * sem cartão ou qualquer caixa atrás dele.
 *
 * O texto visível é `aria-hidden` de propósito: o anúncio para leitores de
 * tela vem do `role="status"` com a frase sr-only.
 */
export default function Splash({ saindo }: { saindo: boolean }) {
  return (
    <div
      role="status"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#4a90a2] via-[#3d7a8a] to-[#336474] px-6 text-center text-white splash ${
        saindo ? 'splash-saindo' : ''
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(88,164,181,0.55)_0%,transparent_62%)]"
        aria-hidden="true"
      />
      <span className="sr-only">Carregando Designa…</span>

      <div className="relative flex flex-col items-center" aria-hidden="true">
        <div className="splash-logo">
          <img
            src="/img/LOGOTIPO.png"
            alt=""
            className="w-60 max-w-none brightness-0 invert drop-shadow-[0_2px_10px_rgba(0,0,0,0.18)] sm:w-72"
            draggable={false}
          />
        </div>
      </div>
    </div>
  )
}
