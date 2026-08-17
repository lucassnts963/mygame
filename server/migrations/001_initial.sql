-- Vestígio — schema inicial.
-- O desenho e os porquês vivem em .specs/shared/schema-target.md.
--
-- NÃO EXISTE tabela de posição, trajeto ou histórico de localização, e isso é a implementação do
-- NFR-01, não um esquecimento: a forma confiável de garantir que nenhum trajeto seja guardado é
-- não haver coluna onde escrevê-lo.

-- Sem CREATE EXTENSION. `gen_random_uuid()` é nativo desde o Postgres 13, e `citext` seria uma
-- extensão instalada em UM schema e invisível nos outros — o que quebra tanto os schemas de teste
-- quanto um deploy em banco gerenciado onde o app não é superusuário.

-- Quem joga. Nasce nesta migration para as sessões já poderem apontar para cá (CHG-008).
CREATE TABLE IF NOT EXISTS players (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Unicidade sem distinção de caixa, garantida pelo BANCO e não pela lembrança de quem escreve o
-- INSERT: 'Lucas@x.com' e 'lucas@x.com' são a mesma pessoa.
CREATE UNIQUE INDEX IF NOT EXISTS players_email_unique ON players (lower(email));

-- Uma partida.
CREATE TABLE IF NOT EXISTS sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nulo enquanto houver partida anônima; CHG-008 passa a preencher.
  player_id  uuid REFERENCES players(id) ON DELETE CASCADE,
  -- Slug do módulo. Deliberadamente NÃO é FK: módulos vivem em arquivos (ADR-009), e uma FK
  -- para uma tabela que não existe criaria duas verdades sobre o mesmo conteúdo.
  module_id  text NOT NULL,
  -- O GameState do motor inteiro. Normalizar as pistas em tabela própria daria consultas que
  -- ninguém faz e custaria a garantia de gravar o estado como um valor só (ADR-004).
  state      jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- A consulta real é "minhas partidas recentes".
CREATE INDEX IF NOT EXISTS sessions_player_recent
  ON sessions (player_id, updated_at DESC);

-- Histórico de interrogatório, uma linha por personagem: um turno de chat reescreve UMA linha,
-- não o histórico inteiro da partida. Conversas crescem; o estado do jogo não.
CREATE TABLE IF NOT EXISTS session_conversations (
  session_id   uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  character_id text NOT NULL,
  conversation jsonb NOT NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, character_id)
);

-- A chave de API do jogador, cifrada (AES-256-GCM, ver server/src/agent/crypto.ts).
-- A chave-mestra vive em VESTIGIO_MASTER_KEY, FORA do banco: guardar as duas no mesmo lugar
-- anularia a cifra.
CREATE TABLE IF NOT EXISTS player_providers (
  player_id         uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  scope             text NOT NULL DEFAULT 'default',
  base_url          text NOT NULL,
  model             text NOT NULL,
  api_key_encrypted text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, scope)
);
