/**
 * Splash (12 do manual): fundo em degradê teal com brilho radial e o logotipo
 * sozinho, em cartão branco arredondado que cresce de 0.72 → 1.
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
        <div className="splash-logo grid place-items-center rounded-[28px] bg-white px-10 py-8 shadow-logo sm:px-12">
          <img
            src="/img/LOGOTIPO.png"
            alt=""
            className="w-60 max-w-none sm:w-72"
            draggable={false}
          />
        </div>
      </div>
    </div>
  )
}
