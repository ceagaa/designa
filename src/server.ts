import { Hono } from 'hono'
import type { Dirigente, Estado } from './lib/dominio'
import { estadoVazio, normalizarEstado, registroDe } from './lib/estadoInicial'
import { gerarEscalaDoMes, proximoMes } from './lib/gerador'
import { chaveMes, lerChaveMes, ocorrenciasDoMes } from './lib/datas'
import { codificar, montarPayload } from './lib/compartilhamento'
import { enviarParaTodas } from './lib/pushServidor'
import { gerarAviDoMes, normalizarDadosAvi } from './lib/avi'
import { normalizarDadosTpl, sanitizarParaPublico } from './lib/tpl'
import { MESES } from './lib/constants'
import type { SetorId, UsuarioSessao } from './lib/authServidor'
import {
  TAMANHO_MINIMO_SENHA,
  calibrarIteracoes,
  conferirSenha,
  cookieLimpar,
  cookieSessao,
  criarSessao,
  emailDeConvite,
  emailValido,
  encerrarSessao,
  ehSetor,
  guardarSenha,
  novoId,
  normalizarEmail,
  novoToken,
  podeAcessarSetor,
  podeCampo,
  senhaFantasma,
  sessaoPorToken,
  slugBase,
  slugUnico,
  tokenDoCookie,
} from './lib/authServidor'

interface D1Statement {
  bind(...params: unknown[]): D1Statement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<{ meta?: { changes?: number } } | unknown>
}

interface D1Database {
  prepare(query: string): D1Statement
}

interface Env {
  DB: D1Database
  /** Opcional: protege a API. Configure com `wrangler secret put APP_PIN`. */
  APP_PIN?: string
  /** Chave pública VAPID (base64url) do push. Configure com `wrangler secret put PUSH_VAPID_PUBLICA`. */
  PUSH_VAPID_PUBLICA?: string
  /** Escalar privada VAPID (base64url) do push. Configure com `wrangler secret put PUSH_VAPID_PRIVADA`. */
  PUSH_VAPID_PRIVADA?: string
}

interface LinhaEstado {
  id?: string
  congregacao_id?: string | null
  dirigentes: string
  config_campos: string
  escalas: string
}

function pinValido(env: Env, req: Request): boolean {
  if (!env.APP_PIN) return true
  return req.headers.get('x-app-pin') === env.APP_PIN
}

function paraObjeto<T>(valor: unknown, padrao: T): T {
  if (typeof valor !== 'string') return (valor as T) ?? padrao
  try {
    return JSON.parse(valor) as T
  } catch {
    return padrao
  }
}

function estadoDaLinha(linha: LinhaEstado): Estado {
  return normalizarEstado({
    dirigentes: paraObjeto(linha.dirigentes, []),
    config_campos: paraObjeto(linha.config_campos, []),
    escalas: paraObjeto(linha.escalas, {}),
  })
}

/** Estado da congregação: linha própria ou base vazia com o nome dela. */
async function carregarEstado(db: D1Database, usuario: UsuarioSessao): Promise<Estado> {
  return estadoPorCongregacao(db, usuario.congregacao_id, usuario.congregacao.nome)
}

/** Estado por congregação (rotas públicas não têm sessão). */
async function estadoPorCongregacao(
  db: D1Database,
  congregacaoId: string,
  nomeFallback: string,
): Promise<Estado> {
  const linha = await db
    .prepare('SELECT dirigentes, config_campos, escalas FROM estado WHERE congregacao_id = ?')
    .bind(congregacaoId)
    .first<LinhaEstado>()
  if (!linha) return estadoVazio(nomeFallback)
  return estadoDaLinha(linha)
}

async function salvarEstadoD1(db: D1Database, usuario: UsuarioSessao, estado: Estado): Promise<void> {
  const existente = await db.prepare('SELECT id FROM estado WHERE congregacao_id = ?').bind(usuario.congregacao_id).first<{ id: string }>()
  const id = existente?.id ?? usuario.congregacao_id
  await db
    .prepare(
      `INSERT INTO estado (id, congregacao_id, dirigentes, config_campos, escalas, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         congregacao_id = excluded.congregacao_id,
         dirigentes = excluded.dirigentes,
         config_campos = excluded.config_campos,
         escalas = excluded.escalas,
         updated_at = excluded.updated_at`,
    )
    .bind(
      id,
      usuario.congregacao_id,
      JSON.stringify(estado.dirigentes),
      JSON.stringify(estado.config_campos),
      JSON.stringify(estado.escalas),
      new Date().toISOString(),
    )
    .run()
}

const CHAVE_RE = /^\d{4}-\d{1,2}$/
const TAMANHO_MAXIMO_SETOR = 400_000

const app = new Hono<{ Bindings: Env }>()

/** Usuário da sessão (cookie httpOnly) ou null. */
async function sessaoDe(c: { env: Env; req: { raw: Request } }): Promise<UsuarioSessao | null> {
  return sessaoPorToken(c.env.DB, tokenDoCookie(c.req.raw.headers.get('cookie')))
}

/** Resposta padrão 401 quando não há sessão. */
function semSessao(c: { json: (data: unknown, status?: number) => Response }) {
  return c.json({ erro: 'sem_sessao' }, 401)
}

function semPermissao(c: { json: (data: unknown, status?: number) => Response }) {
  return c.json({ erro: 'permissao_negada' }, 403)
}

/* ------------------------------ Autenticação ------------------------------ */

app.post('/api/auth/cadastro', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  try {
    const corpo = await c.req.json<{
      nome?: unknown
      email?: unknown
      senha?: unknown
      congregacaoNome?: unknown
      congregacaoNumero?: unknown
    }>()
    const nome = String(corpo.nome ?? '').trim()
    const email = normalizarEmail(String(corpo.email ?? ''))
    const senha = String(corpo.senha ?? '')
    const congNome = String(corpo.congregacaoNome ?? '').trim()
    const congNumero = String(corpo.congregacaoNumero ?? '').trim()

    if (nome.length < 2) return c.json({ erro: 'nome_invalido' }, 400)
    if (!emailValido(email)) return c.json({ erro: 'email_invalido' }, 400)
    if (senha.length < TAMANHO_MINIMO_SENHA) return c.json({ erro: 'senha_curta' }, 400)
    if (congNome.length < 3) return c.json({ erro: 'congregacao_invalida' }, 400)

    const existe = await c.env.DB.prepare('SELECT 1 AS ok FROM usuarios WHERE email = ?').bind(email).first()
    if (existe) return c.json({ erro: 'email_em_uso' }, 409)

    const agora = new Date().toISOString()
    const congregacaoId = novoId('cong')
    const slug = await slugUnico(c.env.DB, slugBase(congNome, congNumero))
    await c.env.DB
      .prepare('INSERT INTO congregacoes (id, nome, numero, slug, criado_em) VALUES (?, ?, ?, ?, ?)')
      .bind(congregacaoId, congNome, congNumero, slug, agora)
      .run()

    const usuarioId = novoId('usr')
    await c.env.DB
      .prepare(
        `INSERT INTO usuarios (id, congregacao_id, email, nome, senha_hash, papel, setor, criado_em)
         VALUES (?, ?, ?, ?, ?, 'ADMIN', NULL, ?)`,
      )
      .bind(usuarioId, congregacaoId, email, nome, await guardarSenha(c.env.DB, senha), agora)
      .run()

    // A primeira congregação assume o estado legado (dados já existentes).
    await c.env.DB
      .prepare('UPDATE estado SET congregacao_id = ? WHERE congregacao_id IS NULL')
      .bind(congregacaoId)
      .run()

    const token = await criarSessao(c.env.DB, usuarioId)
    const usuario = await sessaoPorToken(c.env.DB, token)
    c.header('Set-Cookie', cookieSessao(token))
    return c.json({ usuario }, 201)
  } catch (erro) {
    console.error('[cadastro]', erro)
    return c.json({ erro: 'falha_cadastro' }, 500)
  }
})

app.post('/api/auth/login', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  try {
    const corpo = await c.req.json<{ email?: unknown; senha?: unknown }>()
    const email = normalizarEmail(String(corpo.email ?? ''))
    const senha = String(corpo.senha ?? '')
    if (!emailValido(email) || !senha) return c.json({ erro: 'credenciais' }, 401)

    const linha = await c.env.DB
      .prepare('SELECT id, senha_hash FROM usuarios WHERE email = ?')
      .bind(email)
      .first<{ id: string; senha_hash: string }>()
    const confere = linha ? await conferirSenha(senha, linha.senha_hash) : await senhaFantasma(c.env.DB)
    if (!linha || !confere) return c.json({ erro: 'credenciais' }, 401)

    const token = await criarSessao(c.env.DB, linha.id)
    const usuario = await sessaoPorToken(c.env.DB, token)
    c.header('Set-Cookie', cookieSessao(token))
    return c.json({ usuario })
  } catch (erro) {
    console.error('[login]', erro)
    return c.json({ erro: 'falha_login' }, 500)
  }
})

app.post('/api/auth/logout', async (c) => {
  try {
    const token = tokenDoCookie(c.req.raw.headers.get('cookie'))
    if (token) await encerrarSessao(c.env.DB, token)
  } catch {
    /* segue limpando o cookie */
  }
  c.header('Set-Cookie', cookieLimpar())
  return c.json({ ok: true })
})

app.get('/api/auth/eu', async (c) => {
  const usuario = await sessaoDe(c)
  if (!usuario) return c.json({ erro: 'sem_sessao' }, 401)
  return c.json({ usuario })
})

app.put('/api/congregacao', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  const usuario = await sessaoDe(c)
  if (!usuario) return semSessao(c)
  if (usuario.papel !== 'ADMIN') return semPermissao(c)
  try {
    const corpo = await c.req.json<{ nome?: unknown; numero?: unknown }>()
    const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : ''
    const numero = typeof corpo.numero === 'string' ? corpo.numero.trim() : ''
    if (nome.length < 3) return c.json({ erro: 'congregacao_invalida' }, 400)
    if (numero.length > 30) return c.json({ erro: 'numero_congregacao_invalido' }, 400)

    await c.env.DB
      .prepare('UPDATE congregacoes SET nome = ?, numero = ? WHERE id = ?')
      .bind(nome, numero, usuario.congregacao_id)
      .run()
    const atualizado = await sessaoPorToken(c.env.DB, tokenDoCookie(c.req.raw.headers.get('cookie')))
    if (!atualizado) return semSessao(c)
    return c.json({ usuario: atualizado })
  } catch {
    return c.json({ erro: 'falha_atualizacao_congregacao' }, 500)
  }
})

/** Calibra as iterações do PBKDF2 ao CPU real do plano (limite Free: 10 ms). */
app.post('/api/auth/calibrar', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  const usuario = await sessaoDe(c)
  if (!usuario) return semSessao(c)
  if (usuario.papel !== 'ADMIN') return semPermissao(c)
  try {
    const iteracoes = await calibrarIteracoes(c.env.DB)
    return c.json({ iteracoes })
  } catch {
    return c.json({ erro: 'falha_calibracao' }, 500)
  }
})

/* -------------------------------- Convites -------------------------------- */

app.post('/api/convites', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  const usuario = await sessaoDe(c)
  if (!usuario) return semSessao(c)
  if (usuario.papel !== 'ADMIN') return semPermissao(c)
  try {
    const corpo = await c.req.json<{ setor?: unknown }>()
    if (!ehSetor(corpo.setor)) return c.json({ erro: 'setor_invalido' }, 400)
    const token = novoToken()
    const agora = new Date()
    const expira = new Date(agora.getTime() + 7 * 86400000).toISOString()
    await c.env.DB
      .prepare(
        `INSERT INTO convites (token, congregacao_id, setor, criado_por, criado_em, expira_em)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(token, usuario.congregacao_id, corpo.setor, usuario.id, agora.toISOString(), expira)
      .run()
    return c.json({ token, setor: corpo.setor, expira_em: expira, link: `/aceitar-convite?token=${token}` }, 201)
  } catch {
    return c.json({ erro: 'falha_convite' }, 500)
  }
})

app.get('/api/convites', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  const usuario = await sessaoDe(c)
  if (!usuario) return semSessao(c)
  if (usuario.papel !== 'ADMIN') return semPermissao(c)
  try {
    const consulta = await c.env.DB
      .prepare(
        `SELECT token, setor, criado_em, expira_em, usado_em FROM convites
          WHERE congregacao_id = ? ORDER BY criado_em DESC LIMIT 50`,
      )
      .bind(usuario.congregacao_id)
      .all<{ token: string; setor: string; criado_em: string; expira_em: string; usado_em: string | null }>()
    const agora = new Date().toISOString()
    const convites = consulta.results.map((linha) => ({
      ...linha,
      setor: ehSetor(linha.setor) ? linha.setor : ('CAMPO' as SetorId),
      status: linha.usado_em ? 'usado' : linha.expira_em <= agora ? 'expirado' : 'ativo',
    }))
    return c.json({ convites })
  } catch {
    return c.json({ erro: 'falha_listagem' }, 500)
  }
})

app.delete('/api/convites/:token', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  const usuario = await sessaoDe(c)
  if (!usuario) return semSessao(c)
  if (usuario.papel !== 'ADMIN') return semPermissao(c)
  try {
    const resultado = await c.env.DB
      .prepare('DELETE FROM convites WHERE token = ? AND congregacao_id = ?')
      .bind(c.req.param('token'), usuario.congregacao_id)
      .run()
    if (typeof resultado === 'object' && resultado !== null && 'meta' in resultado) {
      const meta = resultado.meta as { changes?: number } | undefined
      if (meta?.changes === 0) return c.json({ erro: 'convite_nao_encontrado' }, 404)
    }
    return c.json({ ok: true })
  } catch {
    return c.json({ erro: 'falha_remocao_convite' }, 500)
  }
})

/** Informação pública do convite (tela do convidado). */
app.get('/api/convites/:token', async (c) => {
  const token = c.req.param('token') ?? ''
  if (token.length < 10) return c.json({ erro: 'convite_invalido' }, 404)
  try {
    const linha = await c.env.DB
      .prepare(
        `SELECT v.setor, v.expira_em, v.usado_em, c.nome AS congregacao_nome
           FROM convites v JOIN congregacoes c ON c.id = v.congregacao_id
          WHERE v.token = ?`,
      )
      .bind(token)
      .first<{ setor: string; expira_em: string; usado_em: string | null; congregacao_nome: string }>()
    if (!linha) return c.json({ erro: 'convite_invalido' }, 404)
    if (linha.usado_em) return c.json({ erro: 'convite_usado' }, 410)
    if (linha.expira_em <= new Date().toISOString()) return c.json({ erro: 'convite_expirado' }, 410)
    return c.json({
      congregacao: linha.congregacao_nome,
      setor: ehSetor(linha.setor) ? linha.setor : 'CAMPO',
    })
  } catch {
    return c.json({ erro: 'falha_convite' }, 500)
  }
})

/** Convidado cria a conta do ajudante e entra já autenticado. */
app.post('/api/convites/aceitar', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  try {
    const corpo = await c.req.json<{ token?: unknown; nome?: unknown; senha?: unknown }>()
    const token = String(corpo.token ?? '')
    const nome = String(corpo.nome ?? '').trim()
    const senha = String(corpo.senha ?? '')
    if (nome.length < 3) return c.json({ erro: 'nome_invalido' }, 400)
    if (senha.length < TAMANHO_MINIMO_SENHA) return c.json({ erro: 'senha_curta' }, 400)

    const convite = await c.env.DB
      .prepare(
        `SELECT v.token, v.congregacao_id, v.setor, v.expira_em, v.usado_em, c.slug AS slug_congregacao
           FROM convites v JOIN congregacoes c ON c.id = v.congregacao_id
          WHERE v.token = ?`,
      )
      .bind(token)
      .first<{ token: string; congregacao_id: string; setor: string; expira_em: string; usado_em: string | null; slug_congregacao: string }>()
    if (!convite) return c.json({ erro: 'convite_invalido' }, 404)
    if (convite.usado_em) return c.json({ erro: 'convite_usado' }, 410)
    if (convite.expira_em <= new Date().toISOString()) return c.json({ erro: 'convite_expirado' }, 410)
    if (!ehSetor(convite.setor)) return c.json({ erro: 'convite_invalido' }, 404)

    const email = await emailDeConvite(nome, convite.slug_congregacao, async (candidato) => {
      const achou = await c.env.DB.prepare('SELECT 1 AS ok FROM usuarios WHERE email = ?').bind(candidato).first()
      return !achou
    })

    const agora = new Date().toISOString()
    const usuarioId = novoId('usr')
    await c.env.DB
      .prepare(
        `INSERT INTO usuarios (id, congregacao_id, email, nome, senha_hash, papel, setor, criado_em)
         VALUES (?, ?, ?, ?, ?, 'AJUDANTE', ?, ?)`,
      )
      .bind(usuarioId, convite.congregacao_id, email, nome, await guardarSenha(c.env.DB, senha), convite.setor, agora)
      .run()

    const marcado = await c.env.DB
      .prepare('UPDATE convites SET usado_por = ?, usado_em = ? WHERE token = ? AND usado_em IS NULL')
      .bind(usuarioId, agora, token)
      .run()
    const alterados = (marcado as { meta?: { changes?: number } } | null)?.meta?.changes ?? 1
    if (!alterados) {
      // Outro aparelho concluiu antes: desfaz esta conta.
      await c.env.DB.prepare('DELETE FROM usuarios WHERE id = ?').bind(usuarioId).run()
      return c.json({ erro: 'convite_usado' }, 410)
    }

    const sessaoToken = await criarSessao(c.env.DB, usuarioId)
    const usuario = await sessaoPorToken(c.env.DB, sessaoToken)
    c.header('Set-Cookie', cookieSessao(sessaoToken))
    return c.json({ usuario, email })
  } catch (erro) {
    console.error('[aceitar]', erro)
    return c.json({ erro: 'falha_aceite' }, 500)
  }
})

/* --------------------------------- Equipe --------------------------------- */

app.get('/api/equipe', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  const usuario = await sessaoDe(c)
  if (!usuario) return semSessao(c)
  if (usuario.papel !== 'ADMIN') return semPermissao(c)
  try {
    const consulta = await c.env.DB
      .prepare(
        `SELECT id, nome, email, papel, setor, criado_em FROM usuarios
          WHERE congregacao_id = ?
          ORDER BY CASE papel WHEN 'ADMIN' THEN 0 ELSE 1 END, nome COLLATE NOCASE`,
      )
      .bind(usuario.congregacao_id)
      .all<{ id: string; nome: string; email: string; papel: string; setor: string | null; criado_em: string }>()
    const equipe = consulta.results.map((linha) => ({
      ...linha,
      papel: linha.papel === 'ADMIN' ? 'ADMIN' : 'AJUDANTE',
      setor: ehSetor(linha.setor ?? '') ? (linha.setor as SetorId) : null,
    }))
    return c.json({ equipe })
  } catch {
    return c.json({ erro: 'falha_listagem' }, 500)
  }
})

app.delete('/api/equipe/:id', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  const usuario = await sessaoDe(c)
  if (!usuario) return semSessao(c)
  if (usuario.papel !== 'ADMIN') return semPermissao(c)
  try {
    const id = c.req.param('id') ?? ''
    if (!id) return c.json({ erro: 'membro_invalido' }, 400)
    if (id === usuario.id) return c.json({ erro: 'nao_remover_self' }, 400)

    const alvo = await c.env.DB
      .prepare('SELECT id, papel FROM usuarios WHERE id = ? AND congregacao_id = ?')
      .bind(id, usuario.congregacao_id)
      .first<{ id: string; papel: string }>()
    if (!alvo) return c.json({ erro: 'membro_nao_encontrado' }, 404)

    if (alvo.papel === 'ADMIN') {
      const contagem = await c.env.DB
        .prepare(`SELECT COUNT(*) AS n FROM usuarios WHERE congregacao_id = ? AND papel = 'ADMIN'`)
        .bind(usuario.congregacao_id)
        .first<{ n: number }>()
      if ((contagem?.n ?? 0) <= 1) return c.json({ erro: 'ultimo_admin' }, 400)
    }

    await c.env.DB.prepare('DELETE FROM sessoes WHERE usuario_id = ?').bind(id).run()
    await c.env.DB.prepare('DELETE FROM usuarios WHERE id = ?').bind(id).run()
    return c.json({ ok: true })
  } catch {
    return c.json({ erro: 'falha_remocao' }, 500)
  }
})

/* --------------------------- Estado (setor Campo) --------------------------- */

app.get('/api/estado', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  const usuario = await sessaoDe(c)
  if (!usuario) return semSessao(c)
  if (!podeCampo(usuario)) return semPermissao(c)
  try {
    const estado = await carregarEstado(c.env.DB, usuario)
    return c.json({ estado })
  } catch {
    return c.json({ erro: 'falha_leitura' }, 500)
  }
})

app.put('/api/estado', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  const usuario = await sessaoDe(c)
  if (!usuario) return semSessao(c)
  if (!podeCampo(usuario)) return semPermissao(c)
  try {
    const corpo = await c.req.json<{ estado?: unknown }>()
    const estado = normalizarEstado(corpo.estado)
    await salvarEstadoD1(c.env.DB, usuario, estado)
    return c.json({ ok: true, estado })
  } catch {
    return c.json({ erro: 'falha_gravacao' }, 500)
  }
})

app.post('/api/escala/gerar', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  const usuario = await sessaoDe(c)
  if (!usuario) return semSessao(c)
  if (!podeCampo(usuario)) return semPermissao(c)
  try {
    const corpo = await c.req.json<{ chave?: unknown }>()
    const chave = typeof corpo.chave === 'string' ? corpo.chave : ''
    if (!CHAVE_RE.test(chave)) return c.json({ erro: 'chave_invalida' }, 400)

    const estadoAtual = await carregarEstado(c.env.DB, usuario)
    const novo = gerarEscalaDoMes(estadoAtual, chave)
    if (novo === estadoAtual) return c.json({ erro: 'escala_existente' }, 409)

    await salvarEstadoD1(c.env.DB, usuario, novo)
    return c.json({ estado: novo })
  } catch {
    return c.json({ erro: 'falha_geracao' }, 500)
  }
})

/* ------------------------ Estado dos setores AVI e TPL ------------------------ */

/**
 * Voluntários que pertencem a um setor. Registros antigos (sem `departamento`)
 * continuam aparecendo no AVI/TPL quando já tinham aptidão ou participação.
 */
function voluntariosDoSetor(
  estado: Estado,
  setor: SetorId,
  dados: Record<string, unknown>,
): Dirigente[] {
  return estado.dirigentes.filter((d) => {
    if (setor === 'CAMPO') return (d.departamento ?? 'CAMPO') === 'CAMPO'
    if (setor === 'AUDIO_VIDEO') {
      if (d.departamento === 'AUDIO_VIDEO') return true
      // Sem departamento explícito, a ficha antiga continua no AVI se tinha aptidão.
      if (d.departamento != null) return false
      const aptidoes = dados.aptidoes as Record<string, unknown> | undefined
      const lista = aptidoes?.[d.id]
      return Array.isArray(lista) && lista.length > 0
    }
    if (d.departamento === 'TPL') return true
    if (d.departamento != null) return false
    const participantes = dados.participantes as Array<{ id?: string }> | undefined
    return Boolean(participantes?.some((p) => p.id === d.id))
  })
}

function projetarIrmao(d: Dirigente) {
  return {
    id: d.id,
    nome: d.nome,
    ativo: d.ativo !== false,
    departamento: d.departamento ?? 'CAMPO',
    reunioes: d.reunioes ?? 'ambos',
    frequencia: d.frequencia,
    limiteMensal: d.limiteMensal ?? 1,
  }
}

/** Voluntários do TPL + participantes antigos que ainda não têm ficha. */
function participantesDoTpl(
  estado: Estado,
  dados: Record<string, unknown>,
): Array<{ id: string; nome: string; ativo: boolean }> {
  const normalizado = normalizarDadosTpl(dados)
  const mapa = new Map(
    normalizado.participantes.map((p) => [
      p.id,
      { id: p.id, nome: p.nome, ativo: p.ativo !== false },
    ]),
  )
  for (const d of voluntariosDoSetor(estado, 'TPL', dados)) {
    mapa.set(d.id, { id: d.id, nome: d.nome, ativo: d.ativo !== false })
  }
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome))
}

async function dadosDoSetor(env: Env, congregacaoId: string, setor: SetorId): Promise<Record<string, unknown>> {
  const linha = await env.DB
    .prepare('SELECT dados FROM setor_dados WHERE congregacao_id = ? AND setor = ?')
    .bind(congregacaoId, setor)
    .first<{ dados: string }>()
  if (!linha) return {}
  return paraObjeto<Record<string, unknown>>(linha.dados, {})
}

app.get('/api/setor/:setor', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  const usuario = await sessaoDe(c)
  if (!usuario) return semSessao(c)
  const setor = c.req.param('setor')
  if (!ehSetor(setor)) return c.json({ erro: 'setor_invalido' }, 400)
  if (!podeAcessarSetor(usuario, setor)) return semPermissao(c)
  try {
    const dados = await dadosDoSetor(c.env, usuario.congregacao_id, setor)
    if (setor === 'CAMPO') return c.json({ dados })

    // AVI/TPL: projeção mínima para o módulo (o ajudante não lê /api/estado).
    const estado = await carregarEstado(c.env.DB, usuario)
    const config = {
      titulo: estado.escalas._config.titulo,
      congregacao: estado.escalas._config.congregacao,
    }
    if (setor === 'AUDIO_VIDEO') {
      const dirigentes = voluntariosDoSetor(estado, setor, dados).map(projetarIrmao)
      return c.json({ dados, dirigentes, config })
    }

    // TPL: os participantes vêm dos voluntários, não de um cadastro separado.
    // O `dados` continua com os participantes antigos; os voluntários vão à parte
    // para não serem gravados de volta como se fossem cadastro do setor.
    const participantes = participantesDoTpl(estado, dados)
    return c.json({ dados, dirigentes: participantes, config })
  } catch {
    return c.json({ erro: 'falha_leitura' }, 500)
  }
})

app.put('/api/setor/:setor', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  const usuario = await sessaoDe(c)
  if (!usuario) return semSessao(c)
  const setor = c.req.param('setor')
  if (!ehSetor(setor)) return c.json({ erro: 'setor_invalido' }, 400)
  if (!podeAcessarSetor(usuario, setor)) return semPermissao(c)
  try {
    const corpo = await c.req.json<{ dados?: unknown }>()
    if (!corpo.dados || typeof corpo.dados !== 'object' || Array.isArray(corpo.dados)) {
      return c.json({ erro: 'dados_invalidos' }, 400)
    }
    const texto = JSON.stringify(corpo.dados)
    if (texto.length > TAMANHO_MAXIMO_SETOR) return c.json({ erro: 'dados_grandes' }, 413)
    await c.env.DB
      .prepare(
        `INSERT INTO setor_dados (congregacao_id, setor, dados, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(congregacao_id, setor) DO UPDATE SET dados = excluded.dados, updated_at = excluded.updated_at`,
      )
      .bind(usuario.congregacao_id, setor, texto, new Date().toISOString())
      .run()
    return c.json({ ok: true })
  } catch {
    return c.json({ erro: 'falha_gravacao' }, 500)
  }
})

/* ----------------------------- Escala pública ----------------------------- */

type SetorPublico = 'CAMPO' | 'AUDIO_VIDEO' | 'TPL'

function setorPublico(bruto: string): SetorPublico | null {
  const valor = bruto.toUpperCase()
  if (valor === 'CAMPO') return 'CAMPO'
  if (valor === 'TPL') return 'TPL'
  if (valor === 'AUDIO_VIDEO' || valor === 'AVI' || valor === 'AUDIO-VIDEO') return 'AUDIO_VIDEO'
  return null
}

async function publicoPorSlug(
  env: Env,
  slug: string,
  setor: SetorPublico,
): Promise<{ status: number; corpo: Record<string, unknown> }> {
  const congregacao = await env.DB
    .prepare('SELECT id, nome FROM congregacoes WHERE slug = ?')
    .bind(slug)
    .first<{ id: string; nome: string }>()
  if (!congregacao) return { status: 404, corpo: { erro: 'nao_encontrado' } }

  const cabecalho = { congregacao: { nome: congregacao.nome, slug } }
  const estado = await estadoPorCongregacao(env.DB, congregacao.id, congregacao.nome)
  const config = estado.escalas._config

  if (setor === 'TPL') {
    const dados = await dadosDoSetor(env, congregacao.id, 'TPL')
    const participantes = participantesDoTpl(estado, dados)
    return {
      status: 200,
      corpo: {
        ...cabecalho,
        dados: sanitizarParaPublico(
          normalizarDadosTpl({ ...dados, participantes }),
        ),
      },
    }
  }

  if (setor === 'AUDIO_VIDEO') {
    const dados = await dadosDoSetor(env, congregacao.id, 'AUDIO_VIDEO')
    return {
      status: 200,
      corpo: {
        ...cabecalho,
        dados,
        // Projeção mínima: sem telefone.
        irmoes: voluntariosDoSetor(estado, 'AUDIO_VIDEO', dados).map(projetarIrmao),
        config: { titulo: config.titulo, congregacao: config.congregacao },
      },
    }
  }

  // CAMPO: prefere o mês atual; se ainda não foi gerado, mostra o próximo.
  const chaves = Object.keys(estado.escalas)
    .filter((k) => k !== '_config' && /^\d{4}-\d{1,2}$/.test(k))
    .sort()
  const geradas = chaves.filter((k) => registroDe(estado.escalas, k).geradoEm != null)
  const agora = new Date()
  const atual = chaveMes(agora.getFullYear(), agora.getMonth())
  const chave = geradas.includes(atual)
    ? atual
    : geradas.find((k) => k > atual) ??
      geradas[geradas.length - 1] ??
      chaves[chaves.length - 1] ??
      atual
  const { ano, mes } = lerChaveMes(chave)
  const registro = registroDe(estado.escalas, chave)
  const efetivas: Record<string, string> = {
    ...(registro.auto ?? {}),
    ...(registro.manuais ?? {}),
  }
  const efetivasAjudante: Record<string, string> = {
    ...(registro.autoAjudante ?? {}),
    ...(registro.manuaisAjudante ?? {}),
  }
  const ocorrencias = ocorrenciasDoMes(ano, mes, estado.config_campos, config).filter(
    (ocorrencia) => !registro.removidas?.[ocorrencia.key],
  )
  const payload = montarPayload({
    config,
    chave,
    ocorrencias,
    designacoes: efetivas,
    designacoesAjudante: efetivasAjudante,
    // A rota pública do Campo não precisa expor nomes de outros setores.
    dirigentes: estado.dirigentes.filter(
      (d) => (d.departamento ?? 'CAMPO') === 'CAMPO',
    ),
  })
  return {
    status: 200,
    corpo: { ...cabecalho, chave, payload: codificar(payload) },
  }
}

/** Escala do TPL por slug, sem login (alias da rota /tpl/:slug). */
app.get('/api/tpl/publico/:slug', async (c) => {
  try {
    const { status, corpo } = await publicoPorSlug(
      c.env,
      c.req.param('slug') ?? '',
      'TPL',
    )
    return c.json(corpo, status as 200 | 404 | 500)
  } catch {
    return c.json({ erro: 'falha_leitura' }, 500)
  }
})

/**
 * Rota pública única dos três setores: /api/escala/publico/:slug/:setor
 * (CAMPO → payload somente leitura; AVI → dados + irmãos; TPL → sanitizado).
 */
app.get('/api/escala/publico/:slug/:setor', async (c) => {
  const setor = setorPublico(c.req.param('setor') ?? '')
  if (!setor) return c.json({ erro: 'setor_invalido' }, 400)
  try {
    const { status, corpo } = await publicoPorSlug(c.env, c.req.param('slug') ?? '', setor)
    return c.json(corpo, status as 200 | 404 | 500)
  } catch {
    return c.json({ erro: 'falha_leitura' }, 500)
  }
})

/* --------------------------------- Push --------------------------------- */

/** Chave pública VAPID usada pelo navegador para inscrever-se no push. */
app.get('/api/push/vapid-publica', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  const usuario = await sessaoDe(c)
  if (!usuario) return semSessao(c)
  const chave = c.env.PUSH_VAPID_PUBLICA
  if (!chave) return c.json({ erro: 'nao_configurado' }, 404)
  return c.json({ chave })
})

/** Guarda (ou atualiza) a inscrição push de um aparelho. */
app.post('/api/push/inscricao', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  const usuario = await sessaoDe(c)
  if (!usuario) return semSessao(c)
  try {
    const corpo = await c.req.json<{ endpoint?: unknown; p256dh?: unknown; auth?: unknown }>()
    const endpoint = typeof corpo.endpoint === 'string' ? corpo.endpoint : ''
    const p256dh = typeof corpo.p256dh === 'string' ? corpo.p256dh : ''
    const auth = typeof corpo.auth === 'string' ? corpo.auth : ''
    if (!endpoint.startsWith('https://') || !p256dh || !auth) {
      return c.json({ erro: 'inscricao_invalida' }, 400)
    }
    const agora = new Date().toISOString()
    await c.env.DB.prepare(
      `INSERT INTO push_inscricoes (endpoint, chave_p256dh, chave_auth, ativo, criado_em, atualizado_em, congregacao_id)
       VALUES (?, ?, ?, 1, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         chave_p256dh = excluded.chave_p256dh,
         chave_auth = excluded.chave_auth,
         ativo = 1,
         congregacao_id = excluded.congregacao_id,
         atualizado_em = excluded.atualizado_em`,
    )
      .bind(endpoint, p256dh, auth, agora, agora, usuario.congregacao_id)
      .run()
    return c.json({ ok: true })
  } catch {
    return c.json({ erro: 'falha_inscricao' }, 500)
  }
})

/** Envia uma notificação de teste para os aparelhos inscritos (admin). */
app.post('/api/push/testar', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  const usuario = await sessaoDe(c)
  if (!usuario) return semSessao(c)
  if (usuario.papel !== 'ADMIN') return semPermissao(c)
  if (!c.env.PUSH_VAPID_PUBLICA || !c.env.PUSH_VAPID_PRIVADA) {
    return c.json({ erro: 'nao_configurado' }, 404)
  }
  try {
    const resultado = await enviarParaTodas(
      c.env,
      {
        titulo: 'Teste de notificação',
        corpo: 'Tudo certo! Os avisos da escala estão funcionando neste aparelho.',
        url: '/',
        tag: 'teste',
      },
      usuario.congregacao_id,
    )
    return c.json(resultado)
  } catch {
    return c.json({ erro: 'falha_envio' }, 500)
  }
})

/* ------------------------------ Agendamento ------------------------------ */

/** Gera (no dia e horário configurados, fuso de São Paulo) a escala do mês seguinte de cada congregação e avisa os aparelhos. */
async function executarAgendamento(env: Env): Promise<void> {
  const agora = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const numero = (tipo: string) => Number(agora.find((parte) => parte.type === tipo)?.value ?? '0')
  const ano = numero('year')
  const mes = numero('month') - 1
  const dia = numero('day')
  const minutos = numero('hour') * 60 + numero('minute')
  const proximo = proximoMes(ano, mes)

  const consulta = await env.DB.prepare(
    'SELECT id, congregacao_id, dirigentes, config_campos, escalas FROM estado',
  ).all<LinhaEstado>()

  for (const linha of consulta.results ?? []) {
    const estado = estadoDaLinha(linha)
    const config = estado.escalas._config
    const diasNoMes = new Date(ano, mes + 1, 0).getDate()
    const diaEfetivo = Math.min(config.disparo_dia, diasNoMes)
    const [horaAlvo, minutoAlvo] = config.disparo_hora.split(':').map(Number)
    const alvo = horaAlvo * 60 + minutoAlvo
    const devido = dia > diaEfetivo || (dia === diaEfetivo && minutos >= alvo)
    if (!devido) continue

    const novo = gerarEscalaDoMes(estado, proximo.chave)
    if (novo === estado) continue

    await env.DB
      .prepare('UPDATE estado SET dirigentes = ?, config_campos = ?, escalas = ?, updated_at = ? WHERE id = ?')
      .bind(
        JSON.stringify(novo.dirigentes),
        JSON.stringify(novo.config_campos),
        JSON.stringify(novo.escalas),
        new Date().toISOString(),
        linha.id ?? '',
      )
      .run()
    console.log(
      `[agendamento] escala ${proximo.chave} gerada (disparo dia ${config.disparo_dia} às ${config.disparo_hora})`,
    )

    const envio = await enviarParaTodas(
      env,
      {
        titulo: `Escala de ${MESES[proximo.mes]}`,
        corpo: `A escala de ${MESES[proximo.mes]} já está disponível no app.`,
        url: '/',
        tag: 'escala-mensal',
      },
      linha.congregacao_id,
    )
    console.log(`[agendamento] push: ${JSON.stringify(envio)}`)
  }

  const setores = await env.DB
    .prepare("SELECT congregacao_id, setor, dados FROM setor_dados WHERE setor = 'AUDIO_VIDEO'")
    .all<{ congregacao_id: string; dados: string }>()

  for (const linha of setores.results ?? []) {
    const dados = normalizarDadosAvi(paraObjeto(linha.dados, {}))
    const config = dados.geracaoAutomatica
    if (!config.ativa) continue
    const diasNoMes = new Date(ano, mes + 1, 0).getDate()
    const diaEfetivo = Math.min(config.dia, diasNoMes)
    const [horaAlvo, minutoAlvo] = config.hora.split(':').map(Number)
    const alvo = horaAlvo * 60 + minutoAlvo
    const devido = dia > diaEfetivo || (dia === diaEfetivo && minutos >= alvo)
    if (!devido) continue

    const estado = await estadoPorCongregacao(env.DB, linha.congregacao_id, '')
    const novo = gerarAviDoMes(
      dados,
      voluntariosDoSetor(
        estado,
        'AUDIO_VIDEO',
        dados as unknown as Record<string, unknown>,
      ).map(projetarIrmao),
      proximo.chave,
    )
    if (novo === dados) continue

    await env.DB
      .prepare(
        `UPDATE setor_dados SET dados = ?, updated_at = ?
          WHERE congregacao_id = ? AND setor = 'AUDIO_VIDEO'`,
      )
      .bind(JSON.stringify(novo), new Date().toISOString(), linha.congregacao_id)
      .run()
    console.log(`[agendamento] escala AVI ${proximo.chave} gerada`)

    const envio = await enviarParaTodas(
      env,
      {
        titulo: `Escala AVI de ${MESES[proximo.mes]}`,
        corpo: `A escala AVI de ${MESES[proximo.mes]} já está disponível.`,
        url: '/',
        tag: 'escala-avi',
      },
      linha.congregacao_id,
    )
    console.log(`[agendamento] push AVI: ${JSON.stringify(envio)}`)
  }
}

export default {
  fetch: app.fetch,
  scheduled: (_evento: unknown, env: Env) => executarAgendamento(env),
}
