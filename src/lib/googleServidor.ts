/**
 * Validador do ID token do Google no Worker (login com Google).
 *
 * Recebe o `credential` que o navegador obteve do Google Identity Services e
 * confere tudo o que interessa: assinatura contra o JWKS público do Google
 * (RS256, que é o algoritmo que o Google usa, com reserva para ES256), `iss`,
 * `aud` (o nosso Client ID), validade (`exp`/`nbf`) e se o e-mail está
 * verificado. Nada de client secret, só criptografia pública.
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
/** Algoritmos que o Google usa para assinar ID tokens. */
const ALGORITMOS_OK = new Set(['RS256', 'ES256'])

/** Bytes a partir de uma string hexadecimal (com ou sem espaços). */
function hex(texto: string): Uint8Array<ArrayBuffer> {
  const limpo = texto.replace(/\s+/g, '')
  const saida = new Uint8Array(limpo.length / 2)
  for (let i = 0; i < saida.length; i++) {
    saida[i] = parseInt(limpo.slice(i * 2, i * 2 + 2), 16)
  }
  return saida
}

/** Decodifica base64url em string UTF-8. */
function deB64url(base64: string): string {
  return new TextDecoder().decode(bytesDeB64url(base64))
}

/** Decodifica base64url em bytes, completando o padding que o JWT omitiu. */
function bytesDeB64url(base64: string): Uint8Array<ArrayBuffer> {
  const normal = base64.replace(/-/g, '+').replace(/_/g, '/')
  const comPadding = normal.padEnd(Math.ceil(normal.length / 4) * 4, '=')
  return Uint8Array.from(atob(comPadding), (c) => c.charCodeAt(0))
}

/** Junta trechos de um DER. */
function juntar(...partes: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  const tamanho = partes.reduce((total, parte) => total + parte.length, 0)
  const saida = new Uint8Array(tamanho)
  let offset = 0
  for (const parte of partes) {
    saida.set(parte, offset)
    offset += parte.length
  }
  return saida
}

/** Comprimento DER no formato curto ou longo. */
function comprimentoDER(tamanho: number): Uint8Array<ArrayBuffer> {
  if (tamanho < 0x80) return Uint8Array.of(tamanho)
  if (tamanho < 0x100) return Uint8Array.of(0x81, tamanho)
  if (tamanho < 0x10000) return Uint8Array.of(0x82, tamanho >> 8, tamanho & 0xff)
  throw new Error('jwks_sem_chave')
}

/** Envelope DER: tag + comprimento + conteúdo. */
function der(tag: number, conteudo: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  const cauda = comprimentoDER(conteudo.length)
  const saida = new Uint8Array(1 + cauda.length + conteudo.length)
  saida[0] = tag
  saida.set(cauda, 1)
  saida.set(conteudo, 1 + cauda.length)
  return saida
}

/** INTEGER DER, sem zeros à esquerda e com 0x00 se o alto bit estiver setado. */
function inteiroDER(bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  let inicio = 0
  while (inicio < bytes.length - 1 && bytes[inicio] === 0) inicio++
  const corpo = bytes.subarray(inicio)
  if ((corpo[0] & 0x80) !== 0) {
    const positivo = new Uint8Array(corpo.length + 1)
    positivo.set(corpo, 1)
    return der(0x02, positivo)
  }
  return der(0x02, corpo)
}

/**
 * Monta o SPKI RSA (SEQUENCE { SEQUENCE { rsaEncryption, NULL },
 * BIT STRING { SEQUENCE { INTEGER n, INTEGER e } } }) a partir dos campos
 * `n` e `e` do JWKS, que é o formato que o WebCrypto importa.
 */
function spkiRsa(modulo: string, expoente: string): Uint8Array<ArrayBuffer> {
  const algoritmo = der(
    0x30,
    juntar(hex('06 09 2A 86 48 86 F7 0D 01 01 01'), hex('05 00')),
  )
  const chavePublica = der(
    0x30,
    juntar(inteiroDER(bytesDeB64url(modulo)), inteiroDER(bytesDeB64url(expoente))),
  )
  // BIT STRING: primeiro byte é a contagem de bits não usados (0).
  return der(0x30, juntar(algoritmo, der(0x03, juntar(Uint8Array.of(0), chavePublica))))
}

/**
 * Monta o SPKI ECDSA P-256 a partir das coordenadas `x`/`y` do JWKS:
 * SEQUENCE { SEQUENCE { id-ecPublicKey, prime256v1 },
 *            BIT STRING { 0x04 || x || y } } (ponto não comprimido).
 */
function spkiEc(x: string, y: string): Uint8Array<ArrayBuffer> {
  const cabecalho = hex(
    '30 59 30 13 06 07 2A 86 48 CE 3D 02 01 06 08 2A 86 48 CE 3D 03 01 07 03 42 00',
  )
  const coord = (valor: string) => {
    const bytes = bytesDeB64url(valor)
    // P-256 exige 32 bytes por coordenada, com zero à esquerda se faltar.
    if (bytes.length === 32) return bytes
    const completo = new Uint8Array(32)
    completo.set(bytes.subarray(0, 32), 32 - Math.min(bytes.length, 32))
    return completo
  }
  const ponto = juntar(Uint8Array.of(0x04), coord(x), coord(y))
  return juntar(cabecalho, ponto)
}

/** Importa a chave do JWKS no formato que o WebCrypto usa para verificar. */
async function chaveDoJwks(chave: ChaveJwks, alg: string): Promise<CryptoKey> {
  if (chave.kty === 'RSA' || alg === 'RS256') {
    if (!chave.n || !chave.e) throw new Error('jwks_sem_chave')
    return crypto.subtle.importKey(
      'spki',
      spkiRsa(chave.n, chave.e),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
  }

  if (chave.x && chave.y) {
    return crypto.subtle.importKey(
      'spki',
      spkiEc(chave.x, chave.y),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )
  }

  if (chave.x5c?.[0]) {
    const certificado = bytesDeB64url(chave.x5c[0])
    return crypto.subtle.importKey(
      'spki',
      certificado,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )
  }

  throw new Error('jwks_sem_chave')
}

/** Baixa o JWKS do Google e devolve a chave do `kid` pedido. */
async function buscarChave(kid: string, alg: string): Promise<CryptoKey> {
  const resposta = await fetch(URL_JWKS, {
    headers: { accept: 'application/json' },
  })
  if (!resposta.ok) throw new Error('jwks_indisponivel')
  const corpo = (await resposta.json()) as { keys?: ChaveJwks[] }
  const chave = corpo.keys?.find((k) => k.kid === kid && k.kty !== 'oct')
  if (!chave) throw new Error('jwks_chave_desconhecida')
  return chaveDoJwks(chave, alg)
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

  const alg = cabecalho.alg ?? ''
  if (!ALGORITMOS_OK.has(alg) || !cabecalho.kid) throw new Error('credencial_invalida')

  const chave = await buscarChave(cabecalho.kid, alg)
  const assinatura = bytesDeB64url(partes[2])
  const dados = new TextEncoder().encode(`${partes[0]}.${partes[1]}`)
  const ok = await crypto.subtle.verify(
    alg === 'RS256' ? { name: 'RSASSA-PKCS1-v1_5' } : { name: 'ECDSA', hash: 'SHA-256' },
    chave,
    assinatura,
    dados,
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
