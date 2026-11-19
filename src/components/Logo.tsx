import { useEffect, useState } from 'react'

interface LogoProps {
  className?: string
  alt?: string
  /** Usa a versão branca sempre (para fundos que não seguem o tema, ex.: o splash teal). */
  sempreBranca?: boolean
}

/**
 * Logotipo do Designa sem caixa nem fundo atrás (os PNGs têm alfa):
 * versão branca `LOGOTIPOW.png` quando o fundo é escuro e versão dark
 * `LOGOTIPO.png` quando o fundo é claro. A troca acompanha a classe `.dark`
 * do documento, então o tema muda junto na hora.
 */
export default function Logo({ className, alt = 'Designa', sempreBranca = false }: LogoProps) {
  const [escuro, setEscuro] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    if (sempreBranca) return undefined
    const raiz = document.documentElement
    const sincronizar = () => setEscuro(raiz.classList.contains('dark'))
    sincronizar()
    const observador = new MutationObserver(sincronizar)
    observador.observe(raiz, { attributes: true, attributeFilter: ['class'] })
    return () => observador.disconnect()
  }, [sempreBranca])

  const branco = sempreBranca || escuro

  return (
    <img
      src={branco ? '/img/LOGOTIPOW.png' : '/img/LOGOTIPO.png'}
      alt={alt}
      className={className}
      draggable={false}
    />
  )
}
