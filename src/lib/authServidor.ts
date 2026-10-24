/**
 * Autenticação no servidor: hash de senha (PBKDF2-SHA256), sessões em cookie
 * httpOnly, convites com token (validade de 7 dias) e utilitários de slug.
 *
 * O plano Workers Free limita a 10 ms de CPU por requisição — por isso as
 * iterações do PBKDF2 são calibradas (parâmetro `pbkdf2_iteracoes` no D1) para
 * usar ~5 ms e sobrar folga para o restante do Worker.
 */

import { ROTULO_SETOR, SETORES, type SetorId } from './dominio'

export { ROTULO_SETOR, SETORES }
export type { SetorId }

export interface UsuarioSessao {
  id: string
  congregacao_id: string
  email: string
  nome: string
  papel: 'ADMIN' | 'AJUDANTE'
  setor: SetorId | null
  congregacao: { nome: string; numero: string; slug: string }
}

interface Declaracao {
  bind(...params: unknown[]): Declaracao
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<unknown>
}

export interface Banco {
  prepare(query: string): Declaracao
}

const enc = new TextEncoder()
const ITER_PADRAO = 6000
const CHAVE_ITERACOES = 'pbkdf2_iteracoes'
export const TAMANHO_MINIMO_SENHA = 6
const DIAS_SESSAO = 30

function b64u(bytes: Uint8Array): string {
  let binario = ''
  for (let i = 0; i < bytes.length; i += 1) binario += String.fromCharCode(bytes[i])
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function deB64u(texto: string): Uint8Array<ArrayBuffer> {
  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/')
  const preenchido = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binario = atob(preenchido)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i)
  return bytes
}

async function derivarBits(
  senha: string,
  salt: Uint8Array<ArrayBuffer>,
  iteracoes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const chave = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iteracoes },
    chave,
    256,
  )
  return new Uint8Array(bits)
}

function cacheIteracoes(valor: number): number {
  ;(globalThis as { __pbkdf2Iter?: number }).__pbkdf2Iter = valor
  return valor
}

/** Iterações calibradas (cache do isolamento → D1 → padrão). */
export async function iteracoesPbkdf2(db: Banco): Promise<number> {
  const emCache = (globalThis as { __pbkdf2Iter?: number }).__pbkdf2Iter
  if (typeof emCache === 'number') return emCache
  try {
    const linha = await db.prepare('SELECT valor FROM parametros WHERE chave = ?').bind(CHAVE_ITERACOES).first<{ valor: string }>()
    const valor = Number(linha?.valor)
    if (Number.isFinite(valor) && valor >= 1000 && valor <= 200000) return cacheIteracoes(valor)
  } catch {
    /* segue com o padrão */
  }
  return ITER_PADRAO
}

/**
 * Mede quanto de CPU o plano atual aguenta e grava o melhor nº de iterações
 * (alvo ~5,5 ms, deixando folga sob o limite de 10 ms do plano Free).
 */
export async function calibrarIteracoes(db: Banco): Promise<number> {
  const alvoMs = 5.5
  const candidatos = [4000, 8000, 12000, 16000, 24000, 32000, 48000, 64000]
  const salt = crypto.getRandomValues(new Uint8Array(16))
  let melhor = candidatos[0]
  let acumulado = 0
  let anterior = 0
  let ultimaDuracao = 0
  for (const candidato of candidatos) {
    // Extrapolando a medida anterior evita estourar os 10 ms do plano Free
    // somando todas as rodadas da própria calibração.
    const estimativa = ultimaDuracao ? ultimaDuracao * (candidato / anterior) : 0
    if (acumulado + estimativa > 7.5) break
    const inicio = performance.now()
    await derivarBits('calibracao-segura', salt, candidato)
    const duracao = performance.now() - inicio
    acumulado += duracao
    anterior = candidato
    ultimaDuracao = duracao
    if (duracao > alvoMs) break
    melhor = candidato
  }
  await db
    .prepare(
      `INSERT INTO parametros (chave, valor) VALUES (?, ?)
       ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`,
    )
    .bind(CHAVE_ITERACOES, String(melhor))
    .run()
  return cacheIteracoes(melhor)
}

/** Gera o hash armazenável no formato `pbkdf2-sha256$iter$salt$hash`. */
export async function guardarSenha(db: Banco, senha: string): Promise<string> {
  const iteracoes = await iteracoesPbkdf2(db)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derivarBits(senha, salt, iteracoes)
  return `pbkdf2-sha256$${iteracoes}$${b64u(salt)}$${b64u(hash)}`
}

/** Confere a senha contra o hash (usa as iterações registradas no próprio hash). */
export async function conferirSenha(senha: string, armazenado: string): Promise<boolean> {
  try {
    const [algoritmo, iterTexto, salto, hashTexto] = armazenado.split('$')
    if (algoritmo !== 'pbkdf2-sha256') return false
    const iteracoes = Number(iterTexto)
    if (!Number.isFinite(iteracoes) || iteracoes < 1000 || iteracoes > 200000) return false
    const esperado = deB64u(hashTexto)
    const obtido = await derivarBits(senha, deB64u(salto), iteracoes)
    if (obtido.length !== esperado.length) return false
    let dif = 0
    for (let i = 0; i < obtido.length; i += 1) dif |= obtido[i] ^ esperado[i]
    return dif === 0
  } catch {
    return false
  }
}

/** Hash inexistente com o mesmo custo: equaliza o tempo de um login com e-mail inválido. */
export async function senhaFantasma(db: Banco): Promise<false> {
  const iteracoes = await iteracoesPbkdf2(db)
  await conferirSenha(
    'senha-inexistente',
    `pbkdf2-sha256$${iteracoes}$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`,
  )
  return false
}

export function novoToken(): string {
  return b64u(crypto.getRandomValues(new Uint8Array(32)))
}

export function novoId(prefixo: string): string {
  return `${prefixo}-${crypto.randomUUID()}`
}

function isoEm(dias: number): string {
  return new Date(Date.now() + dias * 86400000).toISOString()
}

export async function criarSessao(db: Banco, usuarioId: string): Promise<string> {
  const token = novoToken()
  try {
    await db.prepare('DELETE FROM sessoes WHERE expira_em <= ?').bind(new Date().toISOString()).run()
  } catch {
    /* limpeza best-effort */
  }
  await db
    .prepare('INSERT INTO sessoes (token, usuario_id, criado_em, expira_em) VALUES (?, ?, ?, ?)')
    .bind(token, usuarioId, new Date().toISOString(), isoEm(DIAS_SESSAO))
    .run()
  return token
}

export async function encerrarSessao(db: Banco, token: string): Promise<void> {
  await db.prepare('DELETE FROM sessoes WHERE token = ?').bind(token).run()
}

/** Resolve o token do cookie em usuário autenticado (ou null). */
export async function sessaoPorToken(db: Banco, token: string | null): Promise<UsuarioSessao | null> {
  if (!token) return null
  const linha = await db
    .prepare(
      `SELECT u.id, u.congregacao_id, u.email, u.nome, u.papel, u.setor,
              c.nome AS congregacao_nome, c.numero AS congregacao_numero, c.slug AS congregacao_slug
         FROM sessoes s
         JOIN usuarios u ON u.id = s.usuario_id
         JOIN congregacoes c ON c.id = u.congregacao_id
        WHERE s.token = ? AND s.expira_em > ?`,
    )
    .bind(token, new Date().toISOString())
    .first<{
      id: string
      congregacao_id: string
      email: string
      nome: string
      papel: 'ADMIN' | 'AJUDANTE'
      setor: string | null
      congregacao_nome: string
      congregacao_numero: string
      congregacao_slug: string
    }>()
  if (!linha) return null
  return {
    id: linha.id,
    congregacao_id: linha.congregacao_id,
    email: linha.email,
    nome: linha.nome,
    papel: linha.papel,
    setor: linha.setor && ehSetor(linha.setor) ? linha.setor : null,
    congregacao: {
      nome: linha.congregacao_nome,
      numero: linha.congregacao_numero,
      slug: linha.congregacao_slug,
    },
  }
}

export function cookieSessao(token: string): string {
  return `sessao=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DIAS_SESSAO * 86400}`
}

export function cookieLimpar(): string {
  return 'sessao=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
}

export function tokenDoCookie(header: string | null): string | null {
  if (!header) return null
  for (const par of header.split(';')) {
    const [chave, ...resto] = par.trim().split('=')
    if (chave === 'sessao' && resto.length) return resto.join('=')
  }
  return null
}

export function ehSetor(valor: unknown): valor is SetorId {
  return typeof valor === 'string' && (SETORES as readonly string[]).includes(valor)
}

export function podeAcessarSetor(usuario: UsuarioSessao, setor: SetorId): boolean {
  return usuario.papel === 'ADMIN' || usuario.setor === setor
}

export const podeCampo = (usuario: UsuarioSessao): boolean => podeAcessarSetor(usuario, 'CAMPO')

export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Slug estável: sem acentos/caixa alta, espaços viram hífen. */
export function slugificar(texto: string): string {
  return (
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'congregacao'
  )
}

export function slugBase(nome: string, numero: string): string {
  const base = slugificar(nome)
  const sufixo = numero.replace(/[^0-9a-zA-Z]/g, '').toLowerCase()
  return sufixo ? `${base}-${sufixo}` : base
}

/** Garante unicidade do slug público acrescentando -2, -3… */
export async function slugUnico(db: Banco, base: string): Promise<string> {
  for (let tentativa = 1; tentativa <= 50; tentativa += 1) {
    const candidato = tentativa === 1 ? base : `${base}-${tentativa}`
    const existe = await db.prepare('SELECT 1 AS ok FROM congregacoes WHERE slug = ?').bind(candidato).first()
    if (!existe) return candidato
  }
  return `${base}-${novoToken().slice(0, 6)}`
}

/** E-mail interno gerado pelo convite (o formulário do convidado não pede e-mail). */
export function emailDeConvite(nome: string, slugCongregacao: string, disponivel: (email: string) => Promise<boolean>): Promise<string> {
  return (async () => {
    const base = `${slugificar(nome.replace(/\s+/g, '.'))}.${slugificar(slugCongregacao)}`
    for (let tentativa = 1; tentativa <= 50; tentativa += 1) {
      const email = `${tentativa === 1 ? base : `${base}${tentativa}`}@dirigentes.app`
      if (await disponivel(email)) return email
    }
    return `${base}-${novoToken().slice(0, 6)}@dirigentes.app`
  })()
}
