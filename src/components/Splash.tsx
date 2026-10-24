export default function Splash({ congregacao, saindo }: { congregacao: string; saindo: boolean }) {
  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center bg-teal px-6 text-center text-white splash ${
        saindo ? 'splash-saindo' : ''
      }`}
    >
      <h1 className="rounded-2xl bg-white px-6 py-4 shadow-xl">
        <img
          src="/img/LOGOTIPO.png"
          alt="Designa"
          className="h-10 w-auto sm:h-12"
          draggable={false}
        />
      </h1>
      <p className="mt-5 max-w-sm text-sm font-semibold text-white/85">{congregacao}</p>
    </div>
  )
}
