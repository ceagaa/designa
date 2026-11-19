/**
 * Login com Google pelo Google Identity Services (GIS).
 *
 * É o fluxo de ID token: o navegador devolve um `credential` (JWT assinado pelo
 * Google) e o Worker valida a assinatura antes de abrir a sessão. Não há
 * redirecionamento, por isso só as Origens JavaScript autorizadas importam.
 *
 * O Client ID é público e vem do `.env` (`VITE_GOOGLE_CLIENT_ID`). Sem ele o
 * botão simplesmente não é renderizado.
 */

interface GoogleAccountsId {
  initialize(opcoes: {
    client_id: string
    callback: (resposta: { credential?: string }) => void
    auto_select?: boolean
    cancel_on_outside_click?: boolean
  }): void
  renderButton(
    alvo: HTMLElement,
    opcoes: {
      theme?: 'outline' | 'filled_black' | 'filled_blue'
      size?: 'large' | 'medium' | 'small'
      text?: 'continue_with' | 'signup_with' | 'signin_with' | 'continue'
      width?: number
      shape?: 'rectangular' | 'pill'
      locale?: string
    },
  ): void
}

interface JanelaGoogle {
  google?: { accounts?: { id?: GoogleAccountsId } }
}

declare global {
  interface Window extends JanelaGoogle {}
}

/** Client ID do Google, público, lido do `.env` no build. */
export const CLIENTE_ID_GOOGLE = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()

/** Só existe configuração quando há Client ID preenchido. */
export const googleConfigurado = CLIENTE_ID_GOOGLE.length > 0

const URL_SCRIPT = 'https://accounts.google.com/gsi/client'

let carregando: Promise<void> | null = null

/** Último callback registrado: o GIS guarda só o do primeiro `initialize`. */
let aoEntrarAtual: ((credential: string) => void) | null = null
let inicializado = false

/** Carrega o script do GIS uma única vez por página. */
export function carregarGoogle(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (carregando) return carregando

  carregando = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = URL_SCRIPT
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      carregando = null
      reject(new Error('gis_indisponivel'))
    }
    document.head.appendChild(script)
  })

  return carregando
}

/**
 * Desenha o botão oficial do Google dentro de `alvo` e chama `aoEntrar` com o
 * credential quando a pessoa escolhe a conta. Promete depois do botão estar no
 * ar; se o GIS não carregar, o alvo fica vazio e nada é renderizado.
 */
export async function renderizarBotaoGoogle(
  alvo: HTMLElement,
  aoEntrar: (credential: string) => void,
): Promise<void> {
  if (!googleConfigurado) return
  await carregarGoogle()

  const id = window.google?.accounts?.id
  if (!id) throw new Error('gis_indisponivel')

  // Guarda o callback mais recente: o GIS só aceita um initialize por página
  // (o React monta o efeito duas vezes em desenvolvimento) e o clique usa o
  // último registrado.
  aoEntrarAtual = aoEntrar
  if (!inicializado) {
    inicializado = true
    id.initialize({
      client_id: CLIENTE_ID_GOOGLE,
      callback: (resposta) => {
        if (resposta.credential) aoEntrarAtual?.(resposta.credential)
      },
    })
  }

  const escuro = document.documentElement.classList.contains('dark')
  alvo.replaceChildren()
  id.renderButton(alvo, {
    theme: escuro ? 'filled_black' : 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    width: 320,
    locale: 'pt-BR',
  })
}
