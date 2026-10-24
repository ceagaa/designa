/** Push do servidor: VAPID (RFC 8292) + criptografia aes128gcm (RFC 8291) sobre Web Push (RFC 8030).
 *  A derivação de chaves e o cabeçalho foram validados contra o vetor de teste do RFC 8291, Appendix A. */

type Bytes = Uint8Array<ArrayBuffer>

interface DeclaracaoPush {
  bind(...params: unknown[]): DeclaracaoPush
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<unknown>
}

interface BancoPush {
  prepare(sql: string): DeclaracaoPush
}

export interface AmbientePush {
  DB: BancoPush
  /** Chave pública VAPID (base64url, 65 bytes crus). */
  PUSH_VAPID_PUBLICA?: string
  /** Escalar privada VAPID (base64url, 32 bytes). */
  PUSH_VAPID_PRIVADA?: string
}

export interface NotificacaoPush {
  titulo: string
  corpo: string
  url?: string
  tag?: string
}

export interface ResultadoEnvio {
  /** false quando os segredos VAPID ainda não estão configurados. */
  configurado: boolean
  enviadas: number
  removidas: number
  falhas: number
}

interface Inscricao {
  endpoint: string
  chave_p256dh: string
  chave_auth: string
}

const codificador = new TextEncoder()

function textoBytes(texto: string): Bytes {
  return new Uint8Array(codificador.encode(texto))
}

function emBytesHex(hex: string): Bytes {
  const saida = new Uint8Array(hex.length / 2)
  for (let i = 0; i < saida.length; i += 1) saida[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return saida
}

/** Prefixo DER do PKCS#8 mínimo de uma chave P-256 (ECPrivateKey com versão 1). */
const PREFIXO_PKCS8 = emBytesHex('308141020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420')
/** Prefixo DER do SPKI de uma pública P-256 (65 bytes no formato não comprimido). */
const PREFIXO_SPKI = emBytesHex('3059301306072a8648ce3d020106082a8648ce3d030107034200')

function paraB64u(bytes: Bytes): string {
  let texto = ''
  for (let i = 0; i < bytes.length; i += 1) texto += String.fromCharCode(bytes[i])
  return btoa(texto).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function deB64u(texto: string): Bytes {
  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/')
  const binario = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  const saida = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i += 1) saida[i] = binario.charCodeAt(i)
  return saida
}

function concatenar(...pedacos: Bytes[]): Bytes {
  const total = pedacos.reduce((soma, p) => soma + p.length, 0)
  const saida = new Uint8Array(total)
  let deslocamento = 0
  for (const pedaco of pedacos) {
    saida.set(pedaco, deslocamento)
    deslocamento += pedaco.length
  }
  return saida
}

async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, comprimento: number): Promise<Bytes> {
  const chave = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, chave, comprimento * 8)
  return new Uint8Array(bits)
}

/** JWT ES256 assinado com a chave VAPID (r||s de 64 bytes, formato exigido pelo JWT). */
async function jwtVapid(privada: string, aud: string): Promise<string> {
  const der = concatenar(PREFIXO_PKCS8, deB64u(privada))
  const chave = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const b64 = (valor: unknown) => paraB64u(textoBytes(JSON.stringify(valor)))
  const agora = Math.floor(Date.now() / 1000)
  const dados = `${b64({ typ: 'JWT', alg: 'ES256' })}.${b64({
    aud,
    exp: agora + 43200,
    sub: 'https://dirigentes.sswebtechcontato.workers.dev',
  })}`
  const assinatura = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, chave, textoBytes(dados)),
  )
  return `${dados}.${paraB64u(assinatura)}`
}

/** Criptografa o payload para o agente (RFC 8291): ECDH efêmero + HKDF + AES-128-GCM. */
async function criptografar(publicaUa: Bytes, auth: Bytes, plano: Bytes): Promise<Bytes> {
  const efemera = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', efemera.publicKey))
  const publicaAs = spki.slice(spki.length - 65)

  const chaveUa = await crypto.subtle.importKey(
    'spki',
    concatenar(PREFIXO_SPKI, publicaUa),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const segredo = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: chaveUa }, efemera.privateKey, 256),
  )

  const infoChave = concatenar(textoBytes('WebPush: info'), new Uint8Array([0]), publicaUa, publicaAs)
  const ikm = await hkdf(auth, segredo, infoChave, 32)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, textoBytes('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, textoBytes('Content-Encoding: nonce\0'), 12)

  const chaveCek = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const cifrado = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: 128 },
      chaveCek,
      concatenar(plano, new Uint8Array([0x02])),
    ),
  )

  // salt(16) + rs uint32 = 4096 + idlen 0x41 + pública efêmera (RFC 8188 s2.1)
  const cabecalho = concatenar(salt, new Uint8Array([0x00, 0x00, 0x10, 0x00, 0x41]), publicaAs)
  return concatenar(cabecalho, cifrado)
}

async function enviarUm(
  env: AmbientePush,
  inscricao: Inscricao,
  notificacao: NotificacaoPush,
  publica: string,
  privada: string,
): Promise<'enviada' | 'removida' | 'falha'> {
  try {
    const publicaUa = deB64u(inscricao.chave_p256dh)
    const auth = deB64u(inscricao.chave_auth)
    if (publicaUa.length !== 65 || auth.length !== 16) return 'falha'

    const payload = JSON.stringify({
      titulo: notificacao.titulo,
      corpo: notificacao.corpo,
      url: notificacao.url ?? '/',
      tag: notificacao.tag ?? 'dirigentes',
    })
    const corpo = await criptografar(publicaUa, auth, textoBytes(payload))
    const jwt = await jwtVapid(privada, new URL(inscricao.endpoint).origin)

    const resposta = await fetch(inscricao.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${jwt}, k=${publica}`,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '86400',
        Urgency: 'normal',
      },
      body: corpo,
    })

    if (resposta.status === 404 || resposta.status === 410) {
      await env.DB.prepare('UPDATE push_inscricoes SET ativo = 0, atualizado_em = ? WHERE endpoint = ?')
        .bind(new Date().toISOString(), inscricao.endpoint)
        .run()
      return 'removida'
    }
    return resposta.ok ? 'enviada' : 'falha'
  } catch {
    return 'falha'
  }
}

/**
 * Envia uma notificação para as inscrições ativas da congregação (404/410
 * desativam o aparelho). `congregacaoId` nulo/atrasado casa também com as
 * inscrições legadas (NULL), que continuam recebendo os avisos da escala.
 */
export async function enviarParaTodas(
  env: AmbientePush,
  notificacao: NotificacaoPush,
  congregacaoId?: string | null,
): Promise<ResultadoEnvio> {
  const publica = env.PUSH_VAPID_PUBLICA
  const privada = env.PUSH_VAPID_PRIVADA
  if (!publica || !privada) return { configurado: false, enviadas: 0, removidas: 0, falhas: 0 }

  const consulta = await env.DB.prepare(
    `SELECT endpoint, chave_p256dh, chave_auth FROM push_inscricoes
      WHERE ativo = 1 AND (congregacao_id = ? OR congregacao_id IS NULL)`,
  )
    .bind(congregacaoId ?? null)
    .all<Inscricao>()
  const resultados = await Promise.all(
    (consulta.results ?? []).map((inscricao) => enviarUm(env, inscricao, notificacao, publica, privada)),
  )

  return {
    configurado: true,
    enviadas: resultados.filter((r) => r === 'enviada').length,
    removidas: resultados.filter((r) => r === 'removida').length,
    falhas: resultados.filter((r) => r === 'falha').length,
  }
}
