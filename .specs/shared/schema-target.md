# Target Schema (POSTGRES)

O banco do Vestígio. Hospedável em Supabase ou em qualquer Postgres 14+.

## Legend

- ✅ = Já existe
- 🔧 = Precisa de mudança
- 🆕 = Precisa ser criada

## Princípio que governa este schema

> **Não existe tabela de posição, de trajeto ou de histórico de localização — e isso é a
> implementação do `NFR-01`, não um esquecimento.**
>
> A coordenada do jogador entra na requisição de coleta, valida a distância e é descartada. A
> forma mais confiável de garantir que nenhum trajeto seja guardado não é uma política de
> retenção: é não haver coluna onde escrevê-lo. Se algum dia alguém precisar de "onde o jogador
> esteve", vai ter que criar a tabela — e aí a decisão será explícita, com nome e data.

## Tabelas

### 🆕 `players`

Quem joga. O MVP identificava a partida só pelo id de sessão; com contas, a partida passa a ter
dono (`CHG-008`).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `email` | `citext` | UNIQUE — `citext` para `Lucas@x.com` e `lucas@x.com` serem a mesma pessoa |
| `password_hash` | `text` | scrypt do `node:crypto`, com sal por usuário embutido |
| `created_at` | `timestamptz` | `now()` |

### 🆕 `sessions`

Uma partida. Substitui o `Map` em memória de `createInMemorySessionRepository`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `player_id` | `uuid` | FK → `players(id)` `ON DELETE CASCADE`; nulo enquanto houver partida anônima |
| `module_id` | `text` | Slug do módulo (`poco-de-jaco`). **Não** é FK: módulos vivem em arquivos, não no banco |
| `state` | `jsonb` | O `GameState` do motor, serializado inteiro |
| `created_at` | `timestamptz` | `now()` |
| `updated_at` | `timestamptz` | Tocado a cada gravação |

`state` é `jsonb` porque `GameState` já é dado JSON puro (`caseId`, `collectedClues`,
`accusation`, `origin`). Normalizar as pistas coletadas em tabela própria daria consultas que
ninguém precisa fazer e custaria a garantia de gravar o estado do motor **como um valor só** —
que é o que o ADR-004 comprou.

**Índice:** `sessions(player_id, updated_at desc)` — a consulta real é "minhas partidas recentes".

### 🆕 `session_conversations`

Histórico de interrogatório, uma linha por personagem.

| Column | Type | Notes |
|---|---|---|
| `session_id` | `uuid` | FK → `sessions(id)` `ON DELETE CASCADE` |
| `character_id` | `text` | Slug do personagem no módulo |
| `conversation` | `jsonb` | `{ messages, turns }` |
| `updated_at` | `timestamptz` | |
| | | PK composta `(session_id, character_id)` |

Tabela separada, e não uma coluna em `sessions`, por um motivo de escrita: um turno de chat
reescreve **uma** linha em vez do histórico inteiro da partida. Conversas crescem; o estado do
jogo não.

### 🆕 `player_providers`

A chave de API do jogador, cifrada. É o que fecha o `REQ-13` — hoje a cifra existe e não protege
nada, porque não há chave armazenada em lugar nenhum.

| Column | Type | Notes |
|---|---|---|
| `player_id` | `uuid` | FK → `players(id)` `ON DELETE CASCADE` |
| `scope` | `text` | `'default'` hoje; abre espaço para chave por módulo depois |
| `base_url` | `text` | Endpoint OpenAI-compatible |
| `model` | `text` | |
| `api_key_encrypted` | `text` | `iv:tag:ciphertext` em base64, AES-256-GCM (`encryptSecret`) |
| `created_at` | `timestamptz` | |
| | | PK composta `(player_id, scope)` |

**A chave em claro nunca é escrita aqui, nem em log, nem em resposta de API.** A chave-mestra da
cifra vive em `VESTIGIO_MASTER_KEY`, fora do banco e fora do git — guardar as duas no mesmo lugar
anularia a cifra.

### 🆕 `schema_migrations`

| Column | Type | Notes |
|---|---|---|
| `version` | `text` | PK, o nome do arquivo (`001_initial`) |
| `applied_at` | `timestamptz` | |

## Ordem de execução

1. `001_initial.sql` — `citext`, `pgcrypto`, e as cinco tabelas acima

Uma migration só, porque não há banco em produção para preservar. A partir do primeiro deploy,
cada mudança vira um arquivo novo — nunca uma edição do `001`.

## O que deliberadamente **não** está aqui

| Ausente | Por quê |
|---|---|
| Tabela de módulos | Módulo é um bundle de arquivos (ADR-009). Guardá-lo no banco só faz sentido quando houver publicação por usuário |
| Tabela de posições / trajeto | `NFR-01`, ver acima |
| Tabela de pistas / personagens | São conteúdo do módulo, não dado de aplicação. Duplicá-los no banco criaria duas verdades |
| `refresh_tokens` | O MVP usa um JWT de validade curta; rotação entra quando houver reclamação real |
