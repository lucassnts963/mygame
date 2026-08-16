# Spec: API do jogo (`server/src/routes`)

| Field | Value |
|---|---|
| **ID** | CHG-004 |
| **Status** | approved |
| **Author** | Lucas de Oliveira Santos |
| **Created** | 2026-08-16 |
| **Approved** | 2026-08-16 |

## Context

O motor (CHG-001), o contrato de módulo (CHG-002) e o runtime de agentes (CHG-003) já existem,
mas só se falam por importação. Falta a camada que o app Flutter consome — e, principalmente,
falta o lugar onde o servidor exerce sua **autoridade**: o cliente informa a posição do jogador,
e um cliente pode mentir.

A regra do ADR-004 se materializa aqui: o app compara posições para dar feedback ("faltam 200 m"),
mas quem decide se uma pista foi coletada é o servidor, revalidando por conta própria (REQ-02).

## Scope

- `POST /sessions` — abre partida a partir de um módulo, com origem opcional
- `GET /sessions/:id` — estado: pistas visíveis, caderno, personagens desbloqueados
- `POST /sessions/:id/clues/:clueId/collect` — coleta **revalidada** no servidor
- `POST /sessions/:id/characters/:characterId/chat` — um turno de interrogatório
- `POST /sessions/:id/accuse` — a dedução final
- Registro de módulos carregados do disco na subida
- Repositório de sessões em memória

### Out of Scope

- Autenticação de jogador (JWT) — o MVP identifica a partida pelo id de sessão
- Persistência em Postgres — o schema-alvo fica documentado, a implementação não
- Streaming SSE — a resposta do chat volta inteira; SSE entra quando houver app para consumir

## Requirements

### Functional

- [x] REQ-01: `GET /sessions/:id` devolve as pistas visíveis com distância até cada uma
- [x] REQ-02: a coleta é **revalidada** no servidor; o cliente nunca é fonte de verdade
- [x] REQ-05: o caderno é devolvido a cada mudança de estado
- [x] REQ-06: o chat devolve a fala do personagem e o estado atualizado
- [x] REQ-10: a acusação é julgada uma vez e devolve o veredito explicado

### Non-Functional

- [x] NFR-01: a posição é usada para validar e descartada — nenhum trajeto é guardado
- [x] NFR-02: nenhuma resposta expõe chave de provider
- [x] NFR-05: cobertura ≥ o limiar de `.specs/config.md## Defaults`

### Technical

| Layer | File / Component | Change Description |
|---|---|---|
| Repository | `server/src/repositories/session-repository.ts` | Sessões em memória |
| Repository | `server/src/repositories/module-registry.ts` | Módulos carregados do disco |
| Service | `server/src/services/game-service.ts` | Regra de aplicação sobre o motor |
| Route | `server/src/routes/game-routes.ts` | Rotas Fastify |
| App | `server/src/app.ts` | Composição, injetável para teste |

## Design

### Onde a autoridade fica

O `POST /clues/:id/collect` recebe `{ lat, lng }` e chama `canCollect` do motor com a âncora
resolvida. Se o cliente mentir a posição, mente para o servidor — mas o ponto não é impedir
trapaça sofisticada num jogo solo: é que a regra tenha **um** dono. No dia em que houver ranking
ou multiplayer, o dono já é o certo.

### Erro de jogo não é erro de HTTP 500

Uma coleta recusada por distância é um **resultado esperado**, não uma falha: devolve `409` com o
veredito estruturado (`too-far`, com quantos metros faltam), e o app transforma isso em mensagem.
Só falha de infraestrutura vira `500`.

### Sessão como valor

`GameSession` guarda `state` (do motor) e as conversas por personagem. Como o motor é imutável,
salvar é trocar o valor inteiro — não há mutação parcial nem estado meio-atualizado.

### Edge Cases

- Sessão inexistente → `404`
- Módulo inexistente ao abrir partida → `404` nomeando o módulo
- Personagem bloqueado → `409`, sem chamar o provider
- Segunda acusação → `409` com `already-accused`
- Provider não configurado → `503`, distinguindo "o jogo está de pé, a IA não está"

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Sessão em memória se perde ao reiniciar | High | Med | Aceito no MVP; o repositório é uma interface, o Postgres entra sem tocar nas rotas |
| Cliente mente a posição | Med | Low | Servidor revalida; num jogo solo o prejuízo é do próprio jogador |
| Chave vaza em resposta de erro | Low | High | `SecretKey` mascara no tipo (CHG-003); teste cobre o corpo do erro |

## Dependencies

- CHG-001, CHG-002, CHG-003

## Requirements Traceability

**Requirements:** [`requirements/001-vestigio-mvp/requirements.md`](../../requirements/001-vestigio-mvp/requirements.md)

| REQ ID | Requirement Summary | Priority | Acceptance Criteria |
|---|---|---|---|
| REQ-01 | Pistas visíveis com distância | Must | `GET /sessions/:id` traz distância por pista |
| REQ-02 | Coleta revalidada no servidor | Must | Posição longe recebe `409 too-far` |
| REQ-05 | Caderno | Must | Estado traz o caderno atualizado |
| REQ-06 | Chat com personagem | Must | Turno devolve fala e estado |
| REQ-10 | Acusação única | Must | Segunda tentativa recebe `409 already-accused` |

## Tests

> **TDD:** escritos ANTES da implementação. Fastify `inject`, sem abrir porta.

### Test Cases

| ID | Test | Type | Description |
|---|---|---|---|
| TEST-01 | `POST /sessions` abre partida no módulo piloto | integration | REQ-01 |
| TEST-02 | `POST /sessions` com módulo inexistente → 404 | integration | Edge case |
| TEST-03 | `POST /sessions` aceita origem para relocar o caso | integration | REQ-19 |
| TEST-04 | `GET /sessions/:id` traz pistas visíveis e caderno | integration | REQ-01, REQ-05 |
| TEST-05 | `GET /sessions/:id` traz distância quando há posição | integration | REQ-01 |
| TEST-06 | `GET /sessions/:id` inexistente → 404 | integration | Edge case |
| TEST-07 | Coleta dentro do raio → 200 e caderno atualizado | integration | REQ-02 |
| TEST-08 | Coleta longe → 409 `too-far` com metros faltando | integration | REQ-02 |
| TEST-09 | Coleta bloqueada → 409 `locked` com o que falta | integration | REQ-03 |
| TEST-10 | Coleta repetida é idempotente → 200 | integration | NFR-06 |
| TEST-11 | Coleta de pista inexistente → 404 | integration | Edge case |
| TEST-12 | Coletar desbloqueia personagem | integration | REQ-06 |
| TEST-13 | Chat devolve fala do personagem | integration | REQ-06 |
| TEST-14 | Chat com personagem bloqueado → 409 sem chamar provider | integration | Edge case |
| TEST-15 | Chat propaga pista revelada para o estado | integration | REQ-09 |
| TEST-16 | Chat mantém histórico entre turnos | integration | REQ-06 |
| TEST-17 | Nenhuma resposta contém chave de provider | integration | NFR-02 |
| TEST-18 | Acusação correta e sustentada → `solved` | integration | REQ-10 |
| TEST-19 | Acusação sem sustentação → 409 `unsupported` | integration | REQ-10 |
| TEST-20 | Segunda acusação → 409 `already-accused` | integration | REQ-10 |
| TEST-21 | `GET /modules` lista os módulos disponíveis | integration | REQ-01 |
| TEST-22 | Nenhuma resposta guarda trajeto do jogador | integration | NFR-01 |

### Test Files

| File | What It Covers |
|---|---|
| `server/test/game-api.test.ts` | TEST-01..22 |

---

## Validation Checklist

- [x] Tests written BEFORE implementation (Red phase)
- [x] All tests passing (Green phase) — 310 testes no repositório
- [x] Coverage meets threshold (`.specs/config.md## Defaults`) — 98,7% statements, 91,8% branches
- [x] Requirements met — REQ-01, 02, 05, 06, 10
- [x] Edge cases tested

### Achado durante a implementação: a cascata precisa PULAR, não falhar

Os testes da API expuseram um defeito de desenho em CHG-003. A Samaritana declara
`api_key_env: VESTIGIO_SAMARITANA_KEY` — uma variável que existe na máquina de **quem escreveu o
módulo** e em mais nenhuma. Como a cascata falhava duro quando a variável do nível escolhido não
existia, **todo módulo compartilhado seria injogável por qualquer pessoa que não fosse o autor** —
o oposto exato do que ADR-007 e ADR-009 se propõem.

`resolveProvider` passou a **pular** o nível cuja chave não está configurada e seguir para o
próximo, falhando só quando nenhum nível é utilizável — e, aí sim, dizendo o que foi pulado e por
quê. Quem recebe o módulo joga com o provider que tem; o autor continua rodando com o dele.

## Notes

`buildApp` recebe as dependências (registro de módulos, provider, `fetch`) por parâmetro. É o que
deixa a suíte inteira rodar contra o servidor OpenAI falso, sem rede — a mesma escolha de injeção
que já sustenta CHG-003.
