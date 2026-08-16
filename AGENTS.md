# AGENTS.md — Vestígio

> Primary instruction source for AI agents. **This file is project-owned** — stack, commands,
> architecture, and conventions live here. The kit-owned methodology rules are imported under
> `## Methodology`, so a methodology upgrade never touches this file. Keep it updated as the project evolves.

**Vestígio** é um jogo de mistério/detetive. O jogador se desloca pelo mapa real, encontra pistas
em realidade aumentada geolocalizada e interroga personagens vivos — agentes de IA cujo
conhecimento é uma wiki de lore. Casos são temáticos (bíblicos e baseados em fatos reais) e o
jogador pode **criar seus próprios módulos**: casos, personagens, skills e ferramentas.

## Overview

| Layer | Tech |
|---|---|
| Shell / Platform | MOBILE (Flutter — Android/iOS) |
| Frontend | Flutter / Dart |
| Backend | NODE (TypeScript + Fastify) |
| Database | POSTGRES (Supabase-hospedável) |
| Auth | E-mail/senha via backend próprio (JWT) |
| Language | pt-BR |

### Camada de IA

Cada personagem é um **agente** com provider próprio: qualquer endpoint **compatível com a API
da OpenAI** (`baseUrl` + `model` + chave). Resolução em cascata **personagem → módulo → servidor**.
A chave do jogador é cifrada em repouso e nunca sai do servidor.

---

## Commands

| Command | Where | Description |
|---|---|---|
| `npm run dev -w server` | root | Sobe a API do jogo |
| `npm run build -w server` | root | Compila o servidor |
| `npm test` | root | Roda todos os testes TS (vitest) |
| `npm run test:coverage` | root | Testes com cobertura |
| `npm run playtest -- <modulo>` | root | Percorre um caso pelo motor com GPS simulado |
| `npm run validate-module -- <caminho>` | root | Valida um bundle de módulo |
| `npm run check` | root | Gate da metodologia (check-consistency) |
| `flutter test` | `app/` | Testes do cliente |
| `flutter analyze` | `app/` | Lint do cliente |
| `flutter run` | `app/` | Roda o app em um aparelho |

---

## Architecture

```
app/ (Flutter)
  → MapScreen / ArScreen / NotebookScreen / ChatScreen
    → GameApiClient (HTTP + SSE)
      → server/ (Fastify)
        → routes/          (sessions, clues, chat, accuse)
          → services/      (regras de aplicação)
            → engine/      (packages/engine — domínio puro, sem I/O)
            → agent/       (runtime do personagem: provider OpenAI-compatible + tools)
              → lore/      (RAG sobre as páginas de lore do módulo)
            → repositories/(Postgres)
```

- **Routing:** rotas Fastify por recurso; navegação do app por `Navigator` nomeado.
- **Auth:** JWT emitido pelo servidor; o app guarda o token em armazenamento seguro.
- **Geofence:** o app compara sua posição com as âncoras via Haversine (`packages/engine`);
  o servidor **revalida** no `POST /clues/:id/collect` — o cliente nunca é fonte de verdade.

### Estrutura do repositório

```
.specs/          metodologia (requisitos → specs → archive, memory/ADRs)
.claude/skills/  skills do kit + skills do jogo (create-case, create-character-agent, …)
lore/            LLM-Wiki do jogo — o conhecimento dos personagens (ver lore/WIKI_SCHEMA.md)
packages/engine/        domínio puro: grafo de pistas, estado, geo
packages/module-schema/ contrato do bundle de módulo + validadores
server/          API do jogo + runtime de agentes
app/             cliente Flutter
modules/         módulos de caso (o piloto e os criados por jogadores)
```

---

## Project Conventions

Full conventions in `.specs/memory/conventions.md`. Summary:

- **Domínio antes de infra:** toda regra de jogo nasce em `packages/engine` como função pura,
  sem I/O, sem data/hora implícita, sem aleatoriedade não injetada. Só assim ela é testável e
  reutilizável pelo servidor, pelo playtest e (por porte) pelo app.
- **Backend:** Repository (dados) → Adapter (API externa, incl. o provider de LLM) →
  Service (regra de aplicação) → Route (HTTP). Nunca chamar Adapter direto de uma Route.
- **Frontend:** Flutter com widgets sem lógica; regra vive em serviços puros em `app/lib/core/`.
- **Nomes:** arquivos `kebab-case.ts`; tipos `PascalCase`; funções `camelCase`; ids de domínio
  em `kebab-case` (`poco-de-jaco`, `pista-cantaro`).
- **IDs:** ids de conteúdo são *slugs legíveis* declarados no módulo, não UUIDs — o autor do
  módulo escreve `requires: [pista-cantaro]` à mão.
- **Idioma:** conteúdo do jogo e documentação em **pt-BR**; identificadores de código em inglês.
- **Segredos:** nenhuma chave de API em código, teste ou log. Chaves de jogador são cifradas
  (AES-256-GCM) e mascaradas em qualquer serialização.
- **Clean Code:** SOLID em `.specs/memory/clean-code.md`.

---

## Testing

| | |
|---|---|
| **Framework** | Vitest (TypeScript) · `flutter test` (Dart) |
| **Coverage** | `@vitest/coverage-v8` (threshold: 90%) |
| **Run tests** | `npm test` |
| **Watch mode** | `npm run test:watch` |
| **Coverage report** | `npm run test:coverage` |

Full testing conventions in `.specs/memory/conventions.md## Testing`. **TDD is mandatory** (tests
before implementation) — see the methodology rules below.

**Nenhum teste chama uma LLM de verdade.** O runtime de agentes é testado contra um servidor
OpenAI-compatible falso, em memória: testes determinísticos, sem rede e sem custo de token.

---

## Key Features

1. **Mapa e geofence** — pistas ativas aparecem no mapa; ao entrar no raio, a investigação em AR abre.
2. **AR geolocalizada** — a pista é desenhada sobre a câmera por *bearing* + distância (sem ARCore).
3. **Personagens-agentes** — NPCs conversam via provider OpenAI-compatible, com ferramentas de jogo.
4. **Caderno do detetive** — pistas coletadas, com o grafo de desbloqueio.
5. **Acusação** — a dedução final é avaliada pelo motor contra a solução declarada no módulo.
6. **Módulos do jogador** — bundle declarativo (`case.yaml` + agentes + skills + lore).

## Known Gaps

- **Persistência**: sessões vivem em memória e se perdem ao reiniciar o servidor. O repositório
  já é uma interface, então o Postgres entra sem tocar em rotas nem no motor.
- **Chat sem streaming**: a resposta do personagem volta inteira. SSE fica para quando houver
  necessidade real de ver o texto aparecendo.
- **Autenticação**: o MVP identifica a partida pelo id de sessão; não há login.
- Sem multiplayer, sem marketplace de módulos, sem MCP externo — backlog dos requisitos 001.
- AR sem detecção de plano (ARCore/ARKit) — decisão registrada em ADR-005.
- **Não validado em campo**: o raio de 25 m foi escolhido por raciocínio sobre erro típico de GPS,
  não por playtest na rua. É a primeira coisa a calibrar com o aparelho na mão.

## Observations for agents

- **FAITHFULNESS vale para os NPCs.** Um personagem só afirma o que está fundamentado na lore do
  módulo. Sem fundamento, ele desconversa **em personagem** — nunca inventa pista, data ou nome.
- Antes de criar código novo, consulte `.specs/memory/component-catalog.md`.
- Conteúdo bíblico deve citar a referência (livro capítulo:versículo) na página de lore.

---

## Methodology

This project follows the spec-driven + TDD methodology. Its operational rules — Key Rules, the change
path, skills, and the memory/consistency model — are **kit-owned** and imported here, so methodology
upgrades replace one file and never touch this one. **Read and follow them**; the import inlines the
content for harnesses that support it (Claude Code), and names the file for those that don't:

@.specs/methodology.md
