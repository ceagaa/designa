/**
 * Validador do ID token do Google no Worker (login com Google).
 *
 * Recebe o `credential` que o navegador obteve do Google Identity Services e
 * confere tudo o que interessa: assinatura ES256 contra o JWKS público do
 * Google, `iss`, `aud` (o nosso Client ID), validade (`exp`/`nbf`) e se o
 * e-mail está verificado. Nada de client secret, só criptografia pública.
 */

/** Chave pública do Google (JWKS) com o que precisamos importar. */
interface ChaveJwks {
  kty: string
  kid: string
  use?: string
  alg?: string
  x5c?: string[]
  n?: string
  e?: string
  x?: string
  y?: string
}

/** Payload padrão de um ID token do Google. */
export interface PayloadGoogle {
  iss?: string
  aud?: string
  sub?: string
  email?: string
  email_verified?: boolean
  name?: string
  given_name?: string
  family_name?: string
  picture?: string
  exp?: number
  nbf?: number
  iat?: number
}

const URL_JWKS = 'https://www.googleapis.com/oauth2/v3/certs'
const ISS_ESPERADO = 'https://accounts.google.com'
/** Folga de segurança no relógio, para tokens criados agora mesmo. */
const TOLERANCIA_SEG = 60

/** Decodifica base64url em string UTF-8. */
function deB64url(base64: string): string {
  const normal = base64.replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(normal), (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/**
 * Importa a chave ECDSA P-256 (formato SPKI DER) a partir do campo `x`/`y`
 * do JWKS. O Google publica em `x5c` (certificado) e em coordenadas, então
 * preferimos as coordenadas: dá para montar o SPKI sem decodificar o cert.
 */
async function chaveDoJwks(chave: ChaveJwks): Promise<CryptoKey> {
  if (chave.x && chave.y) {
    const cabecalho = Uint8Array.from(
      '3059301306072a8648ce3d020106082a8648ce3d030107034200',
      (hex) => parseInt(hex, 16),
    )
    const coord = (valor: string) => {
      const limpo = valor.replace(/-/g, '+').replace(/_/g, '/')
      const bruto = atob(limpo.padEnd(Math.ceil(limpo.length / 4) * 4, '='))
      const bytes = Uint8Array.from(bruto, (c) => c.charCodeAt(0))
      // P-256 exige 32 bytes por coordenada, com zero à esquerda se faltar.
      if (bytes.length === 32) return bytes
      const completo = new Uint8Array(32)
      completo.set(bytes, 32 - bytes.length)
      return completo
    }
    const spki = new Uint8Array(cabecalho.length + 66)
    spki.set(cabecalho)
    spki.set(coord(chave.x), cabecalho.length)
    spki.set(coord(chave.y), cabecalho.length + 32)
    return crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
      'verify',
    ])
  }

  if (chave.x5c?.[0]) {
    const der = Uint8Array.from(atob(chave.x5c[0]), (c) => c.charCodeAt(0))
    return crypto.subtle.importKey('spki', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
      'verify',
    ])
  }

  throw new Error('jwks_sem_chave')
}

/** Baixa o JWKS do Google e devolve a chave do `kid` pedido. */
async function buscarChave(kid: string): Promise<CryptoKey> {
  const resposta = await fetch(URL_JWKS, {
    headers: { accept: 'application/json' },
  })
  if (!resposta.ok) throw new Error('jwks_indisponivel')
  const corpo = (await resposta.json()) as { keys?: ChaveJwks[] }
  const chave = corpo.keys?.find((k) => k.kid === kid && k.kty === 'EC')
  if (!chave) throw new Error('jwks_chave_desconhecida')
  return chaveDoJwks(chave)
}

/**
 * Verifica o credential do Google e devolve o payload, ou lança com o código
 * do problema: `assinatura_invalida`, `aud_invalida`, `token_expirado`,
 * `email_nao_verificado`, `credencial_invalida`.
 *
 * @param credential JWT vindo do Google Identity Services
 * @param clienteId Client ID do nosso app, para conferir o `aud`
 */
export async function verificarGoogle(
  credential: string,
  clienteId: string,
): Promise<PayloadGoogle> {
  const partes = credential.split('.')
  if (partes.length !== 3) throw new Error('credencial_invalida')

  let cabecalho: { alg?: string; kid?: string }
  let payload: PayloadGoogle
  try {
    cabecalho = JSON.parse(deB64url(partes[0])) as { alg?: string; kid?: string }
    payload = JSON.parse(deB64url(partes[1])) as PayloadGoogle
  } catch {
    throw new Error('credencial_invalida')
  }

  if (cabecalho.alg !== 'ES256' || !cabecalho.kid) throw new Error('credencial_invalida')

  const chave = await buscarChave(cabecalho.kid)
  const assinatura = Uint8Array.from(
    atob(partes[2].replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0),
  )
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    chave,
    assinatura,
    new TextEncoder().encode(`${partes[0]}.${partes[1]}`),
  )
  if (!ok) throw new Error('assinatura_invalida')

  const agora = Math.floor(Date.now() / 1000)
  if (payload.iss !== ISS_ESPERADO && payload.iss !== `${ISS_ESPERADO}/accounts.google.com`) {
    throw new Error('iss_invalido')
  }
  if (payload.aud !== clienteId) throw new Error('aud_invalida')
  if (typeof payload.exp === 'number' && payload.exp < agora - TOLERANCIA_SEG) {
    throw new Error('token_expirado')
  }
  if (typeof payload.nbf === 'number' && payload.nbf > agora + TOLERANCIA_SEG) {
    throw new Error('token_expirado')
  }
  if (!payload.email) throw new Error('sem_email')
  if (payload.email_verified !== true) throw new Error('email_nao_verificado')

  return payload
}
