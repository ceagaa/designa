-- Fase 1: multi-tenant (congregações), autenticação, convites e dados por setor.

-- Estado passa a ser por congregação (linha legada fica NULL até o 1º cadastro reivindicá-la).
ALTER TABLE estado ADD COLUMN congregacao_id TEXT;

CREATE TABLE IF NOT EXISTS congregacoes (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  numero TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL,
  criado_em TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_congregacoes_slug ON congregacoes(slug);

CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  congregacao_id TEXT NOT NULL,
  email TEXT NOT NULL,
  nome TEXT NOT NULL,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('ADMIN', 'AJUDANTE')),
  setor TEXT CHECK (setor IS NULL OR setor IN ('CAMPO', 'AUDIO_VIDEO', 'TPL')),
  criado_em TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_congregacao ON usuarios(congregacao_id);

CREATE TABLE IF NOT EXISTS convites (
  token TEXT PRIMARY KEY,
  congregacao_id TEXT NOT NULL,
  setor TEXT NOT NULL CHECK (setor IN ('CAMPO', 'AUDIO_VIDEO', 'TPL')),
  criado_por TEXT NOT NULL,
  criado_em TEXT NOT NULL,
  expira_em TEXT NOT NULL,
  usado_por TEXT,
  usado_em TEXT
);
CREATE INDEX IF NOT EXISTS idx_convites_congregacao ON convites(congregacao_id);

CREATE TABLE IF NOT EXISTS sessoes (
  token TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL,
  criado_em TEXT NOT NULL,
  expira_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id);

-- Estado dos setores AVI e TPL (JSON por congregação).
CREATE TABLE IF NOT EXISTS setor_dados (
  congregacao_id TEXT NOT NULL,
  setor TEXT NOT NULL CHECK (setor IN ('AUDIO_VIDEO', 'TPL')),
  dados TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (congregacao_id, setor)
);

-- Parâmetros ajustáveis (ex.: iterações do PBKDF2 calibradas no plano Free).
CREATE TABLE IF NOT EXISTS parametros (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

-- Inscrições push passam a pertencer a uma congregação (NULL = legado).
ALTER TABLE push_inscricoes ADD COLUMN congregacao_id TEXT;
