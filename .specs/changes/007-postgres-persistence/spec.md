# Spec: Persistência em Postgres (`server/src/db`)

| Field | Value |
|---|---|
| **ID** | CHG-007 |
| **Status** | approved |
| **Author** | Lucas de Oliveira Santos |
| **Created** | 2026-08-17 |
| **Approved** | 2026-08-17 |

## Context

A partida vive em memória. Reiniciar o servidor apaga o caso de quem estava jogando — e o jogo
acabou de ser testado em aparelho, então isso deixou de ser hipótese. Pior: sem partida
persistida não há como ter dono, e sem dono não há módulos do jogador, compartilhamento nem
qualquer coisa multiusuário.

Esta spec troca o `Map` por Postgres. O motor não é tocado: era exatamente para este dia que o
ADR-004 manteve o domínio sem I/O.

## Scope

- Migrations em SQL puro + runner (`npm run migrate`)
- `PostgresSessionRepository` implementando a interface existente
- **A interface vira assíncrona** — e as camadas acima acompanham
- Suíte de contrato única, rodada contra as duas implementações
- Remoção de `game-service.preview()`, que é código morto

### Out of Scope

- Contas de jogador — é CHG-008 (a coluna `player_id` já nasce aqui, nula)
- Chave do jogador cifrada em repouso — é CHG-008
- Aplicar as migrations em qualquer ambiente seu; isto entrega o arquivo, você aplica

## Requirements

### Functional

- [x] REQ-05: o caderno sobrevive a um reinício do servidor
- [x] REQ-06: o histórico de conversa por personagem sobrevive a um reinício

### Non-Functional

- [x] NFR-01: **nenhuma tabela guarda posição ou trajeto do jogador**
- [x] NFR-05: cobertura ≥ o limiar de `.specs/config.md## Defaults`

### Technical

| Layer | File / Component | Change Description |
|---|---|---|
| Migration | `server/migrations/001_initial.sql` | O schema de `.specs/shared/schema-target.md` |
| Adapter | `server/src/db/pool.ts` | Pool `pg` a partir de `DATABASE_URL` |
| Adapter | `server/src/db/migrate.ts` | Runner idempotente + CLI |
| Repository | `server/src/repositories/session-repository.ts` | Interface **async**; a versão em memória continua |
| Repository | `server/src/repositories/postgres-session-repository.ts` | A implementação nova |
| Service | `server/src/services/game-service.ts` | `start`/`get`/`collect`/`accuse` viram `async`; sai `preview` |
| Route | `server/src/routes/game-routes.ts` | `await` nas chamadas |
| App | `server/src/app.ts` | Escolhe o repositório conforme `DATABASE_URL` |

## Design

### O comentário que estava errado

`session-repository.ts` afirmava que trocar memória por Postgres "não toca em nenhuma rota nem no
motor". **O motor de fato não é tocado** — essa metade estava certa e é a que importa. Mas a
interface era síncrona, e Postgres não é. A cascata real:

```
SessionRepository  (sync → async)
  └── game-service   start/get/collect/accuse viram async
        └── game-routes   handlers já eram async; só faltou await
              └── engine   INTACTO
```

Um ponto de construção, quatro métodos, zero mudança no domínio. O comentário passa a dizer isso.

### Por que a versão em memória fica

Não é código morto nem "fallback": é como o projeto roda sem banco. Quem clona o repositório
consegue jogar sem instalar Postgres, e a suíte de testes da API continua rápida. As duas
implementações passam **pela mesma suíte de contrato**, que é o que impede uma de divergir da
outra em silêncio.

### Serialização

`GameState` e `Conversation` já são dados JSON puros — vão para `jsonb` direto. O único cuidado
é `conversations`, que é um `Map` em memória e vira linhas em `session_conversations`.

### `updated_at` e concorrência

O MVP grava o estado inteiro a cada ação (`UPDATE … SET state = $1`). Sem controle de versão: um
jogador só, num aparelho só. Se um dia houver dois clientes na mesma partida, entra `updated_at`
como optimistic lock — a coluna já existe para isso.

### Edge Cases

- `DATABASE_URL` ausente → repositório em memória, com aviso no log
- Banco fora do ar na subida → o servidor **falha ao subir**, em vez de aceitar partidas que
  não vai conseguir salvar
- Sessão inexistente → `undefined`, igual à versão em memória
- Migration já aplicada → ignorada (`schema_migrations`)
- Migration com erro → transação revertida, e o runner para na primeira falha

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| As duas implementações divergirem | High | High | Suíte de contrato única para as duas |
| A mudança async espalhar mais que o previsto | Med | Med | Raio mapeado antes; rotas já eram async |
| Teste de banco travar a CI de quem não tem Postgres | Med | Low | Sem `DATABASE_URL`, os testes de Postgres **pulam** |

## Dependencies

- CHG-004 (a API que passa a persistir)

## Requirements Traceability

**Requirements:** [`requirements/001-vestigio-mvp/requirements.md`](../../requirements/001-vestigio-mvp/requirements.md)

| REQ ID | Requirement Summary | Priority | Acceptance Criteria |
|---|---|---|---|
| REQ-05 | Caderno do detetive | Must | O caderno continua íntegro depois de reiniciar o processo |
| REQ-06 | Conversa com personagem | Must | O histórico continua íntegro depois de reiniciar o processo |

## Tests

> **TDD:** escritos ANTES da implementação.

### Test Cases

| ID | Test | Type | Description |
|---|---|---|---|
| TEST-01 | `create` devolve sessão com id | contrato | Nas duas implementações |
| TEST-02 | `get` devolve o que `create` criou | contrato | |
| TEST-03 | `get` de id inexistente devolve `undefined` | contrato | Edge case |
| TEST-04 | `save` persiste o estado alterado | contrato | REQ-05 |
| TEST-05 | `save` preserva as conversas por personagem | contrato | REQ-06 |
| TEST-06 | Conversas de personagens diferentes não se misturam | contrato | REQ-06 |
| TEST-07 | `origin` da partida sobrevive à ida e volta | contrato | REQ-19 |
| TEST-08 | A acusação sobrevive à ida e volta | contrato | REQ-10 |
| TEST-09 | Duas sessões não se contaminam | contrato | |
| TEST-10 | **Um pool novo enxerga o que o anterior gravou** | postgres | REQ-05 — é o teste que descreve o problema |
| TEST-11 | Migrations são idempotentes | postgres | Rodar duas vezes não quebra |
| TEST-12 | Migration com erro não deixa metade aplicada | postgres | Transação |
| TEST-13 | Nenhuma tabela tem coluna de posição/trajeto | postgres | NFR-01, verificado no catálogo |
| TEST-14 | A API inteira funciona sobre Postgres | integration | Regressão de CHG-004 |

### Test Files

| File | What It Covers |
|---|---|
| `server/test/session-repository-contract.ts` | A suíte compartilhada |
| `server/test/session-repository.test.ts` | TEST-01..09 nas duas implementações |
| `server/test/postgres-persistence.test.ts` | TEST-10..14 |

---

## Validation Checklist

- [x] Tests written BEFORE implementation (Red phase)
- [x] All tests passing (Green phase) — 342 testes
- [x] Coverage meets threshold (`.specs/config.md## Defaults`) — 98,4% statements, 90,3% branches
- [x] Requirements met — REQ-05, REQ-06 e NFR-01
- [x] Edge cases tested
- [x] **Prova de campo:** partida aberta, pista coletada, `kill -9` no processo, servidor de volta
      e o caderno intacto

### Achado: `citext` não serve

A primeira versão da migration usava a extensão `citext` para o e-mail ser insensível a caixa.
Falhou nos testes: uma extensão é instalada em **um** schema e fica invisível nos outros, então o
`IF NOT EXISTS` da segunda execução pulava a criação e o tipo sumia. O mesmo aconteceria num banco
gerenciado onde o app não é superusuário.

Trocado por `CREATE UNIQUE INDEX ... ON players (lower(email))`: mesma garantia, imposta pelo
banco, sem extensão nenhuma. `pgcrypto` também saiu — `gen_random_uuid()` é nativo desde o
Postgres 13.

## Notes

O runner de migrations é ~40 linhas de SQL puro em vez de um ORM. Combina com o resto do projeto
(sem passo de build, `node --experimental-strip-types` roda o código como está) e mantém o SQL
legível por qualquer pessoa que abra o arquivo — inclusive por você, aplicando no Supabase pelo
editor deles.
