import { Hono } from 'hono'
import type { Estado } from './lib/dominio'
import { estadoInicial, normalizarEstado } from './lib/estadoInicial'
import { gerarEscalaDoMes, proximoMes } from './lib/gerador'
import { enviarParaTodas } from './lib/pushServidor'
import { MESES } from './lib/constants'

const ID_REGISTRO = 'default_config'

interface D1Statement {
  bind(...params: unknown[]): D1Statement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<unknown>
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

async function carregarEstado(db: D1Database): Promise<Estado> {
  const linha = await db
    .prepare('SELECT dirigentes, config_campos, escalas FROM estado WHERE id = ?')
    .bind(ID_REGISTRO)
    .first<LinhaEstado>()
  if (!linha) return estadoInicial()
  return normalizarEstado({
    dirigentes: paraObjeto(linha.dirigentes, []),
    config_campos: paraObjeto(linha.config_campos, []),
    escalas: paraObjeto(linha.escalas, {}),
  })
}

async function salvarEstadoD1(db: D1Database, estado: Estado): Promise<void> {
  await db
    .prepare(
      `INSERT INTO estado (id, dirigentes, config_campos, escalas, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         dirigentes = excluded.dirigentes,
         config_campos = excluded.config_campos,
         escalas = excluded.escalas,
         updated_at = excluded.updated_at`,
    )
    .bind(
      ID_REGISTRO,
      JSON.stringify(estado.dirigentes),
      JSON.stringify(estado.config_campos),
      JSON.stringify(estado.escalas),
      new Date().toISOString(),
    )
    .run()
}

const CHAVE_RE = /^\d{4}-\d{1,2}$/

const app = new Hono<{ Bindings: Env }>()

app.get('/api/estado', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  try {
    const estado = await carregarEstado(c.env.DB)
    return c.json({ estado })
  } catch {
    return c.json({ erro: 'falha_leitura' }, 500)
  }
})

app.put('/api/estado', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  try {
    const corpo = await c.req.json<{ estado?: unknown }>()
    const estado = normalizarEstado(corpo.estado)
    await salvarEstadoD1(c.env.DB, estado)
    return c.json({ ok: true, estado })
  } catch {
    return c.json({ erro: 'falha_gravacao' }, 500)
  }
})

app.post('/api/escala/gerar', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  try {
    const corpo = await c.req.json<{ chave?: unknown }>()
    const chave = typeof corpo.chave === 'string' ? corpo.chave : ''
    if (!CHAVE_RE.test(chave)) return c.json({ erro: 'chave_invalida' }, 400)

    const estadoAtual = await carregarEstado(c.env.DB)
    const novo = gerarEscalaDoMes(estadoAtual, chave)
    if (novo === estadoAtual) return c.json({ erro: 'escala_existente' }, 409)

    await salvarEstadoD1(c.env.DB, novo)
    return c.json({ estado: novo })
  } catch {
    return c.json({ erro: 'falha_geracao' }, 500)
  }
})

/** Chave pública VAPID usada pelo navegador para inscrever-se no push. */
app.get('/api/push/vapid-publica', (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  const chave = c.env.PUSH_VAPID_PUBLICA
  if (!chave) return c.json({ erro: 'nao_configurado' }, 404)
  return c.json({ chave })
})

/** Guarda (ou atualiza) a inscrição push de um aparelho. */
app.post('/api/push/inscricao', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
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
      `INSERT INTO push_inscricoes (endpoint, chave_p256dh, chave_auth, ativo, criado_em, atualizado_em)
       VALUES (?, ?, ?, 1, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         chave_p256dh = excluded.chave_p256dh,
         chave_auth = excluded.chave_auth,
         ativo = 1,
         atualizado_em = excluded.atualizado_em`,
    )
      .bind(endpoint, p256dh, auth, agora, agora)
      .run()
    return c.json({ ok: true })
  } catch {
    return c.json({ erro: 'falha_inscricao' }, 500)
  }
})

/** Envia uma notificação de teste para todos os aparelhos inscritos. */
app.post('/api/push/testar', async (c) => {
  if (!pinValido(c.env, c.req.raw)) return c.json({ erro: 'pin_invalido' }, 401)
  if (!c.env.PUSH_VAPID_PUBLICA || !c.env.PUSH_VAPID_PRIVADA) {
    return c.json({ erro: 'nao_configurado' }, 404)
  }
  try {
    const resultado = await enviarParaTodas(c.env, {
      titulo: 'Teste de notificação',
      corpo: 'Tudo certo! Os avisos da escala estão funcionando neste aparelho.',
      url: '/',
      tag: 'teste',
    })
    return c.json(resultado)
  } catch {
    return c.json({ erro: 'falha_envio' }, 500)
  }
})

/** Gera (no dia e horário configurados, fuso de São Paulo) a escala do mês seguinte e avisa os aparelhos. */
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

  const estado = await carregarEstado(env.DB)
  const config = estado.escalas._config
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const diaEfetivo = Math.min(config.disparo_dia, diasNoMes)
  const [horaAlvo, minutoAlvo] = config.disparo_hora.split(':').map(Number)
  const alvo = horaAlvo * 60 + minutoAlvo
  const devido = dia > diaEfetivo || (dia === diaEfetivo && minutos >= alvo)
  if (!devido) return

  const proximo = proximoMes(ano, mes)
  const novo = gerarEscalaDoMes(estado, proximo.chave)
  if (novo === estado) return

  await salvarEstadoD1(env.DB, novo)
  console.log(
    `[agendamento] escala ${proximo.chave} gerada (disparo dia ${config.disparo_dia} às ${config.disparo_hora})`,
  )

  const envio = await enviarParaTodas(env, {
    titulo: `Escala de ${MESES[proximo.mes]}`,
    corpo: `A escala de ${MESES[proximo.mes]} já está disponível no app.`,
    url: '/',
    tag: 'escala-mensal',
  })
  console.log(`[agendamento] push: ${JSON.stringify(envio)}`)
}

export default {
  fetch: app.fetch,
  scheduled: (_evento: unknown, env: Env) => executarAgendamento(env),
}
