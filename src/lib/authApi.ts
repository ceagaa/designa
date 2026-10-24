/** Cliente da API de autenticação (Fase 1): sessão, cadastro, convites e setores. */
import type { SetorId, Usuario } from './dominio'
import { cabecalhosPin } from './api'

const CHAVE_SESSAO = 'dirigentes:sessao'

export class ErroAuth extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
  ) {
    super(codigo)
    this.name = 'ErroAuth'
  }
}

async function pedir<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(caminho, {
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...cabecalhosPin(),
      ...(init?.headers ?? {}),
    },
  })
  let dados: unknown = null
  try {
    dados = await resposta.json()
  } catch {
    /* resposta sem corpo JSON */
  }
  if (!resposta.ok) {
    const codigo = (dados as { erro?: string } | null)?.erro ?? `http_${resposta.status}`
    throw new ErroAuth(resposta.status, codigo)
  }
  return dados as T
}

function guardarSessaoLocal(usuario: Usuario): void {
  try {
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(usuario))
  } catch {
    /* armazenamento indisponível */
  }
}

function lerSessaoLocal(): Usuario | null {
  try {
    const bruto = localStorage.getItem(CHAVE_SESSAO)
    if (!bruto) return null
    const usuario = JSON.parse(bruto) as Usuario
    return usuario && typeof usuario.id === 'string' ? usuario : null
  } catch {
    return null
  }
}

function limparSessaoLocal(): void {
  try {
    localStorage.removeItem(CHAVE_SESSAO)
  } catch {
    /* armazenamento indisponível */
  }
}

/**
 * Sessão atual: API primeiro; em falha de rede usa o cache local (PWA offline).
 * 401/403 limpa o cache e devolve null (tela de login).
 */
export async function sessaoAtual(): Promise<Usuario | null> {
  try {
    const dados = await pedir<{ usuario: Usuario }>('/api/auth/eu')
    guardarSessaoLocal(dados.usuario)
    return dados.usuario
  } catch (erro) {
    if (erro instanceof ErroAuth) {
      if (erro.status === 401 || erro.status === 403) limparSessaoLocal()
      return null
    }
    // Falha de rede: segue com a última sessão conhecida deste aparelho.
    return lerSessaoLocal()
  }
}

export async function entrar(email: string, senha: string): Promise<Usuario> {
  const dados = await pedir<{ usuario: Usuario }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha }),
  })
  guardarSessaoLocal(dados.usuario)
  return dados.usuario
}

export interface CadastroAdmin {
  nome: string
  email: string
  senha: string
  congregacaoNome: string
  congregacaoNumero: string
}

export async function criarConta(dados: CadastroAdmin): Promise<Usuario> {
  const resposta = await pedir<{ usuario: Usuario }>('/api/auth/cadastro', {
    method: 'POST',
    body: JSON.stringify(dados),
  })
  guardarSessaoLocal(resposta.usuario)
  return resposta.usuario
}

export async function sair(): Promise<void> {
  limparSessaoLocal()
  try {
    await pedir('/api/auth/logout', { method: 'POST' })
  } catch {
    /* a sessão local já foi apagada */
  }
}

export interface InfoConvite {
  congregacao: string
  setor: SetorId
}

export async function infoConvite(token: string): Promise<InfoConvite> {
  return pedir<InfoConvite>(`/api/convites/${encodeURIComponent(token)}`)
}

export async function aceitarConvite(dados: {
  token: string
  nome: string
  senha: string
}): Promise<{ usuario: Usuario; email: string }> {
  const resposta = await pedir<{ usuario: Usuario; email: string }>('/api/convites/aceitar', {
    method: 'POST',
    body: JSON.stringify(dados),
  })
  guardarSessaoLocal(resposta.usuario)
  return resposta
}

export interface ConviteListado {
  token: string
  setor: SetorId
  criado_em: string
  expira_em: string
  usado_em: string | null
  status: 'ativo' | 'expirado' | 'usado'
}

export async function gerarConvite(setor: SetorId): Promise<{ token: string; link: string; expira_em: string }> {
  return pedir(`/api/convites`, { method: 'POST', body: JSON.stringify({ setor }) })
}

export async function listarConvites(): Promise<ConviteListado[]> {
  const dados = await pedir<{ convites: ConviteListado[] }>('/api/convites')
  return dados.convites
}

/** Membro da equipe (contas da congregação) — admin. */
export interface MembroEquipe {
  id: string
  nome: string
  email: string
  papel: 'ADMIN' | 'AJUDANTE'
  setor: SetorId | null
  criado_em: string
}

export async function listarEquipe(): Promise<MembroEquipe[]> {
  const dados = await pedir<{ equipe: MembroEquipe[] }>('/api/equipe')
  return dados.equipe
}

export async function removerEquipe(id: string): Promise<void> {
  await pedir(`/api/equipe/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** Projeção mínima de irmão (cadastro unificado) devolvida pelo setor AVI. */
export interface IrmaoProjecao {
  id: string
  nome: string
  ativo: boolean
}

/**
 * Carga estendida do setor: dados do módulo + projeção de irmãos (AVI) e
 * cabeçalho da congregação. O ajudante de setor não acessa /api/estado.
 */
export async function carregarSetorExtenso(setor: SetorId): Promise<{
  dados: Record<string, unknown>
  dirigentes?: IrmaoProjecao[]
  config?: { titulo: string; congregacao: string }
}> {
  return pedir(`/api/setor/${setor}`)
}

export async function salvarDadosSetor(setor: SetorId, dados: Record<string, unknown>): Promise<void> {
  await pedir(`/api/setor/${setor}`, { method: 'PUT', body: JSON.stringify({ dados }) })
}

/** Mensagens amigáveis para os códigos de erro da API de auth. */
export function textoErroAuth(codigo: string): string {
  const textos: Record<string, string> = {
    credenciais: 'E-mail ou senha incorretos.',
    email_em_uso: 'Já existe uma conta com este e-mail.',
    email_invalido: 'Informe um e-mail válido.',
    senha_curta: `A senha precisa de pelo menos 6 caracteres.`,
    nome_invalido: 'Preencha o nome completo.',
    congregacao_invalida: 'Informe o nome da congregação (mínimo 3 letras).',
    convite_invalido: 'Convite inválido. Peça um novo link ao administrador.',
    convite_expirado: 'Este convite expirou (validade de 7 dias). Peça um novo link.',
    convite_usado: 'Este convite já foi usado. Peça um novo link ao administrador.',
    pin_invalido: 'PIN incorreto — tente novamente.',
    falha_cadastro: 'Não foi possível criar a conta agora. Tente de novo.',
    falha_login: 'Não foi possível entrar agora. Tente de novo.',
    falha_aceite: 'Não foi possível concluir o convite agora. Tente de novo.',
  }
  return textos[codigo] ?? 'Não foi possível concluir. Verifique os dados e tente de novo.'
}
