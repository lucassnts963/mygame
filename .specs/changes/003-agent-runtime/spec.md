# Spec: Runtime dos personagens-agentes (`server/src/agent`)

| Field | Value |
|---|---|
| **ID** | CHG-003 |
| **Status** | approved |
| **Author** | Lucas de Oliveira Santos |
| **Created** | 2026-08-16 |
| **Approved** | 2026-08-16 |

## Context

Interrogar é o coração do gênero detetive, e é exatamente onde jogos costumam decepcionar: a
árvore de diálogo acaba no terceiro clique. Um agente de IA resolve isso — mas traz um problema
pior, porque um NPC que inventa um álibi torna o caso **insolúvel** e pune o jogador por ter
confiado na informação.

Esta spec constrói o runtime que dá liberdade sem perder a verdade: um agente que conversa
livremente, mas cujas afirmações passam pela lore. E que fala com **qualquer** endpoint compatível
com a API da OpenAI, com chave por personagem (ADR-007), para o custo não recair sobre quem
hospeda e o jogador poder rodar até um modelo local.

## Scope

- Cliente de provider OpenAI-compatible (`chat/completions` + *function calling*)
- Resolução de provider em cascata personagem → módulo → servidor
- Cifra AES-256-GCM das chaves, com mascaramento no próprio tipo
- Montagem do *system prompt* a partir de persona + regras do cânone + skills
- As quatro ferramentas do NPC: `consultar_lore`, `verificar_caderno`, `revelar_pista`, `recusar_responder`
- Busca textual na lore, com páginas `spoiler` excluídas na origem
- Laço de conversa com teto de turnos
- Um servidor OpenAI-compatible **falso**, em memória, para os testes

### Out of Scope

- Rotas HTTP — é CHG-004
- Servidores MCP externos declarados pelo módulo — desenho já cabe no `agent.yaml`, fica para depois
- Embeddings / RAG vetorial — o MVP usa busca textual
- Voz (TTS/STT)

## Requirements

### Functional

- [x] REQ-06: `runAgentTurn` conversa e devolve a fala do personagem
- [x] REQ-07: `consultar_lore` é a única fonte de fato, e nunca devolve página `spoiler`
- [x] REQ-08: `verificar_caderno` informa ao NPC o que o detetive já sabe
- [x] REQ-09: `revelar_pista` concede pista quando as condições do módulo são atendidas
- [x] REQ-11: cliente fala com qualquer endpoint OpenAI-compatible
- [x] REQ-12: provider resolvido em cascata personagem → módulo → servidor
- [x] REQ-13: chave cifrada em repouso e mascarada em qualquer serialização
- [x] REQ-15: skills carregadas sob demanda — só a `description` no prompt até serem acionadas
- [x] REQ-18: teto de turnos por conversa, de `.specs/config.md## Game Constants`

### Non-Functional

- [x] NFR-02: nenhuma serialização expõe a chave; só os 4 últimos caracteres
- [x] NFR-04: nenhum teste toca a rede ou uma LLM real
- [x] NFR-05: cobertura ≥ o limiar de `.specs/config.md## Defaults`

### Technical

| Layer | File / Component | Change Description |
|---|---|---|
| Domain | `server/src/agent/crypto.ts` | AES-256-GCM + `SecretKey` que se mascara sozinho |
| Domain | `server/src/agent/provider-resolution.ts` | A cascata de providers |
| Adapter | `server/src/agent/openai-client.ts` | `chat/completions` via `fetch` injetável |
| Domain | `server/src/agent/lore-index.ts` | Busca textual, com spoiler excluído na origem |
| Domain | `server/src/agent/system-prompt.ts` | Persona + cânone + catálogo de skills |
| Domain | `server/src/agent/tools.ts` | As quatro ferramentas e seus efeitos |
| Service | `server/src/agent/runtime.ts` | O laço de conversa |
| Test | `server/test/fake-openai.ts` | Servidor OpenAI-compatible falso |

## Design

### Por que um protocolo, e não um SDK

O runtime fala **só** `POST {base_url}/chat/completions` no formato da OpenAI. Não há SDK, não há
`if (provider === "anthropic")`. O preço é abrir mão de recursos proprietários; o ganho é que o
jogo sobrevive à troca de qualquer fornecedor e um módulo pode declarar Ollama sem código novo.

### A chave que não sabe se imprimir

`SecretKey` é uma classe cujo `toString`, `toJSON` e `util.inspect` devolvem `sk-…3f9a`. O valor
em claro só sai por `.reveal()`, chamado num único lugar: a montagem do header da requisição.

Isso é diferente de "lembrar de mascarar no endpoint". Aqui é impossível vazar por descuido: um
`console.log(config)` ou um `JSON.stringify` de erro imprime a máscara. O risco deixa de depender
de disciplina.

### FAITHFULNESS em três camadas

1. **Prompt** — as regras de `lore/wiki/_regras/como-personagens-respondem` entram no system prompt.
2. **Ferramenta** — `consultar_lore` devolve trechos reais; não há como o modelo "consultar" o que
   não existe.
3. **Origem** — páginas `spoiler: true` são removidas no *índice*, não na resposta. O agente não
   tem como pedir o que nunca foi indexado, e por isso nenhum jogo de palavras do jogador extrai
   a solução (ADR-006).

### Skills sob demanda

No system prompt entra só o catálogo: `nome — description`. O corpo da skill entra na conversa
apenas quando o modelo a aciona. É o mesmo *progressive disclosure* do Claude Code, e pela mesma
razão: dez skills inteiras no prompt custam caro e afogam a instrução que importa.

### Edge Cases

- Provider ausente em toda a cascata → erro claro antes de qualquer chamada de rede
- Variável de ambiente da chave não definida → erro nomeando a variável
- Modelo pede ferramenta inexistente → devolve erro *como resultado de ferramenta*, e a conversa
  segue; derrubar o turno por isso seria pior para o jogador
- Modelo pede `revelar_pista` de pista já coletada → idempotente
- Modelo pede `revelar_pista` sem as condições → recusado, e o motivo volta como resultado
- Teto de turnos atingido → devolve a última fala, sem erro
- Provider responde 500 ou JSON inválido → erro tratado, sem vazar a chave na mensagem

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Modelo ignora as ferramentas e inventa | Med | High | Prompt explícito + a solução fora do índice; um NPC que inventa erra sem estragar o caso |
| Chave vaza em log | Low | High | Mascaramento no tipo, não no endpoint |
| Laço de ferramentas não termina | Low | Med | Teto de turnos e teto de chamadas por turno |
| Custo por conversa dispara | Med | Med | Teto de turnos, `max_tokens`, prompt pedindo brevidade |

## Dependencies

- `@vestigio/engine` (CHG-001) — estado da partida e coleta de pista
- `@vestigio/module-schema` (CHG-002) — `agent.yaml` e páginas de lore

## Requirements Traceability

**Requirements:** [`requirements/001-vestigio-mvp/requirements.md`](../../requirements/001-vestigio-mvp/requirements.md)

| REQ ID | Requirement Summary | Priority | Acceptance Criteria |
|---|---|---|---|
| REQ-06 | Conversa livre com o personagem | Must | Um turno devolve fala do NPC |
| REQ-07 | FAITHFULNESS via `consultar_lore` | Must | Página spoiler nunca aparece no resultado |
| REQ-08 | `verificar_caderno` | Should | Devolve as pistas já coletadas |
| REQ-09 | `revelar_pista` | Should | Concede só com as condições atendidas |
| REQ-11 | Provider OpenAI-compatible | Must | Client funciona contra servidor falso |
| REQ-12 | Cascata de providers | Must | Personagem vence módulo, que vence servidor |
| REQ-13 | Chave cifrada e mascarada | Must | `JSON.stringify` não revela a chave |
| REQ-15 | Skills sob demanda | Should | Só a `description` entra no prompt inicial |
| REQ-18 | Teto de turnos | Should | Conversa para no teto sem erro |

## Tests

> **TDD:** escritos ANTES da implementação.

### Test Cases

| ID | Test | Type | Description |
|---|---|---|---|
| TEST-01 | `encrypt`/`decrypt` faz a volta completa | unit | REQ-13 |
| TEST-02 | Cada cifra usa IV novo | unit | Mesma chave, textos cifrados diferentes |
| TEST-03 | Texto cifrado adulterado é rejeitado | unit | Autenticação do GCM |
| TEST-04 | `SecretKey` mascara em `toString`/`toJSON`/log | unit | NFR-02 |
| TEST-05 | `SecretKey.reveal()` devolve o valor | unit | REQ-13 |
| TEST-06 | Cascata: personagem vence módulo e servidor | unit | REQ-12 |
| TEST-07 | Cascata: módulo vence servidor | unit | REQ-12 |
| TEST-08 | Cascata: sem nenhum provider, erro claro | unit | Edge case |
| TEST-09 | Cascata: variável de ambiente ausente, erro nomeando-a | unit | Edge case |
| TEST-10 | `openai-client` envia mensagens e ferramentas | unit | REQ-11 |
| TEST-11 | `openai-client` manda a chave no header | unit | REQ-11 |
| TEST-12 | `openai-client` trata erro HTTP sem vazar a chave | unit | NFR-02 |
| TEST-13 | `loreIndex` acha por palavra do corpo | unit | REQ-07 |
| TEST-14 | `loreIndex` acha por título | unit | REQ-07 |
| TEST-15 | `loreIndex` **nunca** indexa página spoiler | unit | REQ-07 |
| TEST-16 | `loreIndex` sem resultado devolve vazio | unit | REQ-07 |
| TEST-17 | `buildSystemPrompt` traz persona e regras do cânone | unit | REQ-07 |
| TEST-18 | `buildSystemPrompt` lista só a `description` das skills | unit | REQ-15 |
| TEST-19 | `buildSystemPrompt` não contém texto de página spoiler | unit | REQ-07 |
| TEST-20 | `consultar_lore` devolve trechos | unit | REQ-07 |
| TEST-21 | `verificar_caderno` devolve as pistas coletadas | unit | REQ-08 |
| TEST-22 | `revelar_pista` concede com condições atendidas | unit | REQ-09 |
| TEST-23 | `revelar_pista` recusa sem condições | unit | REQ-09 |
| TEST-24 | `revelar_pista` é idempotente | unit | Edge case |
| TEST-25 | `carregar_skill` devolve o corpo da skill | unit | REQ-15 |
| TEST-26 | Ferramenta desconhecida vira resultado de erro, não exceção | unit | Edge case |
| TEST-27 | `runAgentTurn` devolve a fala do personagem | integration | REQ-06 |
| TEST-28 | `runAgentTurn` executa ferramenta e continua | integration | REQ-07 |
| TEST-29 | `runAgentTurn` propaga a pista revelada para o estado | integration | REQ-09 |
| TEST-30 | `runAgentTurn` para no teto de chamadas de ferramenta | integration | REQ-18 |
| TEST-31 | `runAgentTurn` recusa passar do teto de turnos | integration | REQ-18 |
| TEST-32 | `runAgentTurn` mantém o histórico entre turnos | integration | REQ-06 |

### Test Files

| File | What It Covers |
|---|---|
| `server/test/crypto.test.ts` | TEST-01..05 |
| `server/test/provider-resolution.test.ts` | TEST-06..09 |
| `server/test/openai-client.test.ts` | TEST-10..12 |
| `server/test/lore-index.test.ts` | TEST-13..16 |
| `server/test/system-prompt.test.ts` | TEST-17..19 |
| `server/test/tools.test.ts` | TEST-20..26 |
| `server/test/runtime.test.ts` | TEST-27..32 |

---

## Validation Checklist

- [x] Tests written BEFORE implementation (Red phase) — 7 arquivos falhando por módulo ausente
- [x] All tests passing (Green phase) — 250 testes no repositório
- [x] Code refactored without breaking tests (Refactor phase)
- [x] Coverage meets threshold (`.specs/config.md## Defaults`) — 99,7% statements, 95,7% branches
- [x] Requirements met — REQ-06..09, 11, 12, 13, 15, 18
- [x] Edge cases tested
- [x] Code follows conventions

### Achado durante a implementação: `grantClue`

O UC-01 Alt-02 diz que uma pista revelada por um personagem dispensa a verificação de posição — e
o motor, tal como CHG-001 o deixou, exigia posição para toda pista com âncora. Faltava a operação
**conceder**, distinta de **coletar**.

`grantClue` foi acrescentada a `packages/engine` com testes próprios: burla a geografia (a
informação veio da boca de alguém, mandar o jogador até o lugar seria absurdo) mas **não** burla
os pré-requisitos nem a idempotência — conceder não pode atalhar o grafo de dedução.

## Notes

O servidor falso (`server/test/fake-openai.ts`) é um objeto que implementa a mesma interface de
`fetch` e devolve respostas roteirizadas. Não sobe porta, não usa rede: a suíte inteira roda
offline e sem custo de token, que é o que torna viável testar um agente de verdade (NFR-04).
