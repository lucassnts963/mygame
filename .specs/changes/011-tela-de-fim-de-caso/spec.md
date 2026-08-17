# Spec: A tela de fim de caso

| Field | Value |
|---|---|
| **ID** | CHG-011 |
| **Status** | approved |
| **Author** | Lucas de Oliveira Santos |
| **Created** | 2026-08-17 |
| **Approved** | 2026-08-17 |

## Context

A acusação termina com **uma frase** — "Caso encerrado. Você reuniu o que provava." — e a partida
para. O botão de acusar fica cinza e nada mais acontece.

Pior: **o epílogo já está escrito e é inalcançável**. `modules/poco-de-jaco/case.yaml` declara
`reveal: casos/a-verdade`, uma página com a leitura completa do caso. Mas `SolutionDefinition`, no
motor, tem só `culprit` e `supportingClues`: `toCaseDefinition` **descarta** o `reveal`.

É a **mesma classe de defeito pela segunda vez**. O `CHG-009` achou a `description` das pistas
sendo aceita pelo schema, lida pelo loader e descartada no domínio. `reveal` é idêntico. Um campo
que o domínio não tem some sem erro nenhum — nem o compilador, nem o validador, nem um teste
reclamam. Esta spec fecha o segundo caso e faz a varredura por outros.

Um mistério sem desfecho é promessa quebrada: o jogador anda pela cidade, interroga, deduz — e
fecha o app sem saber se entendeu.

## Scope

- `caseOutcome()` no motor: veredito, o que foi encontrado, o que ficou para trás
- `solution.reveal` atravessando módulo → motor → API → app
- O epílogo entregue ao jogador **só depois da acusação**
- Tela de desfecho, com manchete própria para cada veredito
- Modo leitura depois do fim: caderno, conversas e desfecho seguem acessíveis
- A página de `reveal` passa a ser prosa para o jogador, e a convenção fica documentada

### Out of Scope

- Recomeçar o caso — decisão do autor: modo leitura, sem rejogar
- Compartilhar desfecho, tempo de partida, pontuação
- Fim de caso por abandono: só existe fim por acusação
- Contas, login e streaming SSE: seguem adiados

## Requirements

### Functional

- [x] REQ-10: o veredito da acusação chega ao jogador explicado, não como uma frase genérica
- [x] REQ-05: o desfecho mostra o caderno completo e **o que ficou para trás**
- [x] REQ-17: o caso piloto tem desfecho jogável, com o epílogo que já estava escrito

### Non-Functional

- [x] NFR-05: cobertura ≥ o limiar de `.specs/config.md## Defaults`
- [x] NFR-09: **o texto da solução não aparece em resposta nenhuma antes da acusação**

### Technical

| Layer | File / Component | Change Description |
|---|---|---|
| Domain | `packages/engine/src/types.ts` | `reveal?` em `SolutionDefinition`; tipo `CaseOutcome` |
| Domain | `packages/engine/src/outcome.ts` | **novo** — `caseOutcome()` puro |
| Contract | `packages/module-schema/src/schemas/index.ts` | `toCaseDefinition` mapeia `solution.reveal` |
| Service | `server/src/services/game-service.ts` | `outcome` na visão, só após a acusação |
| Content | `modules/poco-de-jaco/lore/wiki/casos/a-verdade.md` | Corpo vira epílogo do jogador |
| Docs | `lore/WIKI_SCHEMA.md` | Convenção da página de `reveal` |
| UI | `app/lib/features/outcome/outcome_screen.dart` | **nova** — a tela |
| UI | `app/lib/features/map/map_screen.dart` | Modo leitura + "ver o desfecho" |

## Design

### O desfecho é domínio, não tela

`caseOutcome(caseDef, state)` devolve `null` enquanto a partida não acabou, e quando acabou traz
veredito, quem foi acusado, quem era, o que foi encontrado, e **o que ficou para trás**.

Fica no motor pelo mesmo motivo do resto (ADR-004): é regra de jogo, testável sem tela, e reusável
pelo playtest — que passa a poder afirmar "este caso tem desfecho", não só "este caso fecha".

**`missedClues` é o beat mais forte do desfecho.** "Três pistas ficaram no mapa" é o que faz querer
o próximo caso. Como a partida acabou, mostrar o texto delas não entrega nada que o jogador ainda
pudesse conquistar — é recompensa por terminar, não spoiler.

### Três desfechos, três sensações

| Veredito | O que aconteceu | Manchete |
|---|---|---|
| `solved` | Reconstruiu e provou | "Você reconstruiu o que aconteceu." |
| `unsupported` | Apontou certo, sem prova | **"Você tinha razão. Não tinha a prova."** |
| `wrong` | Apontou errado | "Não foi quem você pensou." |

O `unsupported` é o desfecho mais interessante do jogo e hoje some numa mensagem genérica: o
jogador **acertou a pessoa** e não reuniu o que sustentava. Merece ser dito com essas palavras.

Nos três, o epílogo vem em seguida. A acusação é uma só e o caso acabou de qualquer forma — não há
segunda chance a preservar, e mistério sem resposta não fecha.

### A disciplina do spoiler, invertida no fim

A página `spoiler: true` nunca entra no contexto de um agente (ADR-006) e não é indexada na
origem. **Isso não muda.** O que muda é que, e somente depois da acusação, ela vai para o jogador.

Na API: `outcome` só é incluído quando `state.accusation != null`. Antes disso o texto da solução
não aparece em resposta nenhuma, e é o `TEST-11` que verifica isso varrendo o corpo de todas as
respostas anteriores à acusação.

### A página de `reveal` vira texto para o jogador

`casos/a-verdade.md` abre com um bloco explicando **ao autor** que a página é spoiler e que o
ADR-006 manda. É documentação de autoria, e mostrá-la ao jogador quebraria a imersão no momento em
que ela mais importa.

Esta spec muda o contrato: **o corpo de uma página de `reveal` é prosa para o jogador**. A nota de
autoria sai do corpo e a regra fica escrita em `lore/WIKI_SCHEMA.md`.

### Edge Cases

- Caso sem `reveal` → veredito sem epílogo, sem quebrar
- `reveal` apontando para página inexistente → veredito sem epílogo (o lint já reprova o módulo)
- Caso 100% explorado → listas vazias, não ausentes: a tela decide não renderizar
- Partida não terminada → `outcome` ausente
- Acusar personagem inexistente → segue `404`; não gera desfecho

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| O epílogo vazar antes da acusação | Low | **High** | `TEST-11` varre o corpo de todas as respostas anteriores |
| A nota de autoria aparecer para o jogador | Med | Med | `TEST-17` reprova nota de autoria no corpo do `reveal` do piloto |
| Outro campo do schema sumindo no domínio | **High** | Med | Varredura declarada na verificação desta spec |

## Dependencies

- CHG-001 (motor), CHG-002 (contrato), CHG-004 (API), CHG-005 (app), CHG-009 (o texto chegando)

## Requirements Traceability

**Requirements:** [`requirements/001-vestigio-mvp/requirements.md`](../../requirements/001-vestigio-mvp/requirements.md)

| REQ ID | Requirement Summary | Priority | Acceptance Criteria |
|---|---|---|---|
| REQ-05 | Caderno do detetive | Must | O desfecho mostra o caderno completo e o que ficou para trás |
| REQ-10 | Acusação única, julgada com sustentação | Must | Cada veredito tem manchete própria e traz o epílogo |
| REQ-17 | Caso bíblico piloto jogável | Must | O piloto termina com o epílogo que já estava escrito |

## Tests

> **TDD:** escritos ANTES da implementação.

### Test Cases

| ID | Test | Type |
|---|---|---|
| TEST-01 | `caseOutcome` devolve `null` enquanto a partida não acabou | unit (TS) |
| TEST-02 | `solved` com a sustentação reunida | unit (TS) |
| TEST-03 | `unsupported` quando acertou sem provar | unit (TS) |
| TEST-04 | `wrong` quando apontou errado | unit (TS) |
| TEST-05 | Lista as pistas encontradas, com o texto | unit (TS) |
| TEST-06 | Lista as pistas que ficaram no mapa | unit (TS) |
| TEST-07 | Lista os personagens com quem nunca falou | unit (TS) |
| TEST-08 | Caso 100% explorado devolve listas vazias | unit (TS) |
| TEST-09 | `toCaseDefinition` mapeia `solution.reveal` | unit (TS) |
| TEST-10 | `toCaseDefinition` omite quando não há `reveal` | unit (TS) |
| TEST-11 | **Nenhuma resposta contém o texto da solução antes da acusação** | integration (TS) |
| TEST-12 | Depois da acusação, `outcome` traz o epílogo | integration (TS) |
| TEST-13 | `outcome` ausente em partida não terminada | integration (TS) |
| TEST-14 | Errar também traz o epílogo | integration (TS) |
| TEST-15 | Caso sem `reveal` termina sem epílogo, sem quebrar | integration (TS) |
| TEST-16 | O piloto declara `reveal`, e a página existe e é `spoiler: true` | integration (TS) |
| TEST-17 | O corpo do `reveal` do piloto não contém nota de autoria | integration (TS) |
| TEST-18 | `CaseOutcome.fromJson` lê veredito, epílogo e listas | unit (Dart) |
| TEST-19 | Manchete diferente por veredito | unit (Dart) |
| TEST-20 | A tela mostra o epílogo | widget (Dart) |
| TEST-21 | A tela mostra as pistas que ficaram para trás | widget (Dart) |
| TEST-22 | Sem pistas perdidas, não renderiza seção vazia | widget (Dart) |
| TEST-23 | Sem epílogo, mostra só o veredito | widget (Dart) |
| TEST-24 | O mapa oferece "ver o desfecho" quando terminou | widget (Dart) |

### Test Files

| File | What It Covers |
|---|---|
| `packages/engine/test/outcome.test.ts` | TEST-01..08 |
| `packages/module-schema/test/schemas.test.ts` | TEST-09..10 |
| `packages/module-schema/test/pilot-module.test.ts` | TEST-16..17 |
| `server/test/game-api.test.ts` | TEST-11..14, contra o módulo piloto de verdade |
| `server/test/outcome-service.test.ts` | TEST-15 — casos sem epílogo, que o piloto não representa |
| `app/test/outcome_test.dart` | TEST-18..23 |
| `app/test/widgets_test.dart` | TEST-24 |

---

## Validation Checklist

- [x] Tests written BEFORE implementation (Red phase)
- [x] All tests passing (Green phase) — 391 testes TS, 84 testes Dart
- [x] Coverage meets threshold — conferido pelo **exit code** (`0`); branches 90.9%
- [x] `flutter analyze` limpo
- [x] Requirements met
- [x] Prova manual: acertando **e** errando, o epílogo chega
- [x] Varredura por outros campos do schema não mapeados no domínio (abaixo)

## A varredura: o que mais o schema aceita e ninguém lê

`description` (CHG-009) e `reveal` (esta spec) foram o mesmo defeito duas vezes. A varredura
comparou **campo a campo** o que `schemas/definitions.ts` aceita com o que o domínio, o runtime e
a API de fato consomem. Achou mais quatro — nenhum tão grave quanto os dois primeiros, porque
nenhum deles é conteúdo escrito pelo autor que some. Ficam registrados, não corrigidos: cada um é
uma decisão de produto, não um conserto.

| Campo | Onde | Situação |
|---|---|---|
| `clues[].lore` | `case.yaml` | **Morto.** Aceito pelo schema, tipado em `types.ts`, lido por ninguém. |
| `agent.tools` | `agent.yaml` | **Morto.** `buildSpecs` fixa as três ferramentas; a lista do autor é ignorada. |
| `agent.lore` | `agent.yaml` | **Mente.** O validador confere que a lista não expõe spoiler, mas o runtime entrega `module.loaded.lore` **inteira** ao índice. Quem escreve `lore: [personagens/samaritana]` esperando limitar o que o personagem sabe não limita nada. |
| `characters[].agent` | `case.yaml` | **Meio-morto.** O validador exige que o arquivo exista; a amarração em `module-registry` é pelo `id` de dentro do arquivo de agente. Se os dois divergirem, o personagem fica sem agente com o módulo válido. |

Os dois primeiros são campos a implementar ou remover. O terceiro é o que mais importa: não é
vazamento (spoiler continua barrado na origem, ADR-006), mas é uma promessa de escopo que o motor
não cumpre — e escopo de conhecimento por personagem é justamente o que dá textura a um elenco.
O quarto vira `error` de lint barato: comparar `characters[].agent` com o `id` do arquivo apontado.

> A lição que fica é anterior a qualquer um deles: **um campo aceito pelo schema e não consumido
> falha em silêncio**. Nem compilador, nem validador, nem teste reclamam. Enquanto o contrato for
> `additionalProperties` aberto por princípio (ADR-009), a checagem "todo campo declarado tem
> consumidor" precisa ser um teste, não uma varredura manual a cada duas specs.

## Notes

A spec é `011` e não `010` porque `requirements/010-casos-da-cidade` já ocupa o `010`, e o
`check-consistency` pareia requisitos e specs pelo mesmo número — colisão registrada em
`.specs/memory/log.md`.
