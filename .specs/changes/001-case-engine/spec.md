# Spec: Motor de casos (`packages/engine`)

| Field | Value |
|---|---|
| **ID** | CHG-001 |
| **Status** | approved |
| **Author** | Lucas de Oliveira Santos |
| **Created** | 2026-08-16 |
| **Approved** | 2026-08-16 |

## Context

Toda regra do Vestígio que decide *o que o jogador pode fazer agora* precisa existir num só lugar,
porque três consumidores diferentes dependem dela: o **servidor** (autoridade sobre coleta e
acusação), o **playtest** (prova que um caso é solúvel sem GPS, sem rede e sem jogador) e o **app**
(feedback de distância enquanto anda). Se essa regra nascesse dentro de uma rota HTTP, o playtest
teria que subir um servidor e o app teria que reimplementá-la — e as duas cópias divergiriam.

Esta spec cria o núcleo: o grafo de pistas, o estado da partida, o geofence e o julgamento da
acusação — tudo como função pura, conforme ADR-004.

## Scope

- Modelo de dados do caso em memória (`CaseDefinition`, `ClueDefinition`, `SolutionDefinition`)
- Geometria: distância Haversine, rumo (bearing), verificação de geofence, deslocamento de âncoras
  por uma origem configurável (REQ-19)
- Grafo de pistas: quais estão desbloqueadas, quais faltam, detecção de ciclo e de inalcançável
- Estado da partida: coletar pista (idempotente), caderno, pistas visíveis
- Acusação: julgamento único contra a solução, exigindo as pistas de sustentação
- Playtest: percorre um caso com posições simuladas e reporta se ele é solúvel

### Out of Scope

- Persistência, HTTP, banco — nada de I/O neste pacote (ADR-004)
- Leitura de arquivos YAML do módulo — é da spec CHG-002
- Qualquer coisa de LLM — é da spec CHG-003

## Requirements

### Functional

- [x] REQ-02: `canCollect` recusa fora do raio e informa a distância que falta
- [x] REQ-03: `unlockedClues` respeita `requires`; `canCollect` recusa pré-requisito faltante
- [x] REQ-05: `collectClue` devolve novo estado com o caderno atualizado, de forma idempotente
- [x] REQ-10: `judgeAccusation` aceita uma acusação por partida e exige as pistas de sustentação
- [x] REQ-16: `playtestCase` percorre o caso e detecta insolubilidade
- [x] REQ-19: `resolveAnchor` aplica uma origem configurável às âncoras do módulo

### Non-Functional

- [x] NFR-05: cobertura ≥ o limiar de `.specs/config.md## Defaults`
- [x] NFR-06: coleta idempotente e raio mínimo respeitado, para oscilação de GPS não punir o jogador

### Technical

| Layer | File / Component | Change Description |
|---|---|---|
| Domain | `packages/engine/src/types.ts` | Tipos do caso, do estado e dos veredictos |
| Domain | `packages/engine/src/geo.ts` | Haversine, bearing, geofence, origem configurável |
| Domain | `packages/engine/src/clue-graph.ts` | Desbloqueio, ciclo, alcançabilidade |
| Domain | `packages/engine/src/game-state.ts` | Coleta, caderno, pistas visíveis |
| Domain | `packages/engine/src/accusation.ts` | Julgamento da acusação |
| Domain | `packages/engine/src/playtest.ts` | Percurso simulado do caso |

> A casca de linha de comando do playtest (`npm run playtest`) **não** fica aqui: ela precisa ler
> um `case.yaml` do disco, e carregar módulo é responsabilidade de `@vestigio/module-schema`.
> O CLI entra junto com o carregador, em CHG-002. Este pacote continua sem I/O (ADR-004).

## Design

### Decisões de modelagem

**Estado imutável.** `collectClue` devolve um estado novo em vez de mutar. O servidor pode então
guardar o estado como valor, e o playtest pode ramificar percursos sem se contaminar.

**Recusa explicada, não booleano.** `canCollect` devolve um veredito discriminado
(`{ ok: true }` ou `{ ok: false, reason, ... }`) porque toda recusa tem que virar mensagem útil:
"faltam 218 m" e "você ainda não descobriu o cântaro" são erros diferentes para o jogador.

**Origem configurável (REQ-19).** As âncoras do módulo são coordenadas absolutas, mas o caso pode
declarar uma `origin`. Se a partida define outra origem, todas as âncoras são transladadas pelo
mesmo delta — o caso escrito para Barcarena passa a ser jogável em qualquer cidade preservando as
distâncias relativas entre as pistas.

### Estados (não-UI)

| Veredito de coleta | Significado |
|---|---|
| `ok` | Coletada agora |
| `already-collected` | Já estava no caderno — idempotente, não é erro |
| `too-far` | Fora do raio; acompanha a distância que falta |
| `locked` | Pré-requisitos faltando; acompanha quais |
| `unknown-clue` | Id inexistente no caso |

| Veredito de acusação | Significado |
|---|---|
| `solved` | Culpado certo **e** sustentação coletada |
| `unsupported` | Culpado certo, sustentação incompleta — o palpite não vale |
| `wrong` | Culpado errado |
| `already-accused` | Já houve acusação nesta partida |

### Edge Cases

- **Ciclo em `requires`** → `validateClueGraph` reporta; o caso é rejeitado antes de jogar
- **Pista que ninguém desbloqueia** → reportada como inalcançável
- **Pista sem âncora** (revelada só por NPC) → coletável sem verificação de posição
- **Raio fora dos limites** de `.specs/config.md## Game Constants` → reportado pela validação
- **Antimeridiano / polos** no Haversine → fórmula é estável; testado com par transmeridiano

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| O motor cresce e absorve responsabilidade de I/O | Med | High | Nenhuma dependência no `package.json` do pacote — a ausência é o gate |
| Haversine impreciso em distâncias curtas | Low | Med | Teste com pares de distância conhecida, tolerância de 0,5% |
| Playtest declarar solúvel um caso que trava em partida | Med | High | O playtest usa exatamente as mesmas funções que o servidor |

## Dependencies

- Nenhuma. Este é o pacote-raiz do domínio.

## Requirements Traceability

**Requirements:** [`requirements/001-vestigio-mvp/requirements.md`](../../requirements/001-vestigio-mvp/requirements.md)

| REQ ID | Requirement Summary | Priority | Acceptance Criteria |
|---|---|---|---|
| REQ-02 | Coleta só dentro do raio | Must | `canCollect` a 240 m recusa com `too-far` e a distância que falta |
| REQ-03 | Grafo de pré-requisitos | Must | Pista com `requires` não atendido recusa com `locked` nomeando o que falta |
| REQ-05 | Caderno do detetive | Must | `collectClue` duas vezes deixa uma única entrada |
| REQ-10 | Acusação única e sustentada | Must | Culpado certo sem sustentação → `unsupported`; segunda acusação → `already-accused` |
| REQ-16 | Playtest simulado | Must | Caso com pista inalcançável é reportado como insolúvel |
| REQ-19 | Âncoras relativas a origem | Should | Trocar a origem preserva as distâncias entre pistas |

## Tests

> **TDD:** escritos ANTES da implementação. Devem falhar (Red) antes do código existir.

### Test Cases

| ID | Test | Type | Description |
|---|---|---|---|
| TEST-01 | `distanceMeters` entre coordenadas conhecidas | unit | Precisão dentro de 0,5% |
| TEST-02 | `distanceMeters` é zero para o mesmo ponto | unit | Caso degenerado |
| TEST-03 | `distanceMeters` é simétrica | unit | Propriedade da métrica |
| TEST-04 | `bearingDegrees` aponta 0/90/180/270 nos rumos cardeais | unit | Base do posicionamento em AR (REQ-04) |
| TEST-05 | `isWithinGeofence` dentro / na borda / fora | unit | Fronteira inclusiva |
| TEST-06 | `resolveAnchor` translada pela origem preservando distâncias | unit | REQ-19 |
| TEST-07 | `unlockedClues` devolve as sem `requires` no início | unit | REQ-03 |
| TEST-08 | `unlockedClues` cresce conforme o caderno | unit | REQ-03 |
| TEST-09 | `validateClueGraph` detecta ciclo | unit | Caso rejeitado antes de jogar |
| TEST-10 | `validateClueGraph` detecta `requires` para id inexistente | unit | Erro de autoria |
| TEST-11 | `validateClueGraph` detecta pista inalcançável | unit | REQ-16 |
| TEST-12 | `validateClueGraph` detecta raio fora dos limites | unit | Game Constants |
| TEST-13 | `canCollect` recusa `too-far` com a distância que falta | unit | REQ-02 |
| TEST-14 | `canCollect` recusa `locked` nomeando os pré-requisitos | unit | REQ-03 |
| TEST-15 | `canCollect` recusa `unknown-clue` | unit | Id inexistente |
| TEST-16 | `canCollect` dispensa posição para pista sem âncora | unit | Pista revelada por NPC |
| TEST-17 | `collectClue` acrescenta ao caderno e não muta o estado anterior | unit | REQ-05, imutabilidade |
| TEST-18 | `collectClue` repetida é idempotente | unit | REQ-05, NFR-06 |
| TEST-19 | `collectClue` desbloqueia as dependentes | unit | REQ-03 |
| TEST-20 | `visibleClues` esconde coletadas e bloqueadas | unit | REQ-01 |
| TEST-21 | `unlockedCharacters` segue as pistas coletadas | unit | REQ-06 |
| TEST-22 | `judgeAccusation` acerto com sustentação → `solved` | unit | REQ-10 |
| TEST-23 | `judgeAccusation` acerto sem sustentação → `unsupported` | unit | REQ-10 |
| TEST-24 | `judgeAccusation` culpado errado → `wrong` | unit | REQ-10 |
| TEST-25 | `judgeAccusation` segunda vez → `already-accused` | unit | REQ-10 |
| TEST-26 | `playtestCase` percorre um caso solúvel e reporta a ordem | integration | REQ-16 |
| TEST-27 | `playtestCase` detecta caso insolúvel | integration | REQ-16 |
| TEST-28 | `playtestCase` reporta as pistas que ficaram inalcançáveis | integration | REQ-16 |

### Test Files

| File | What It Covers |
|---|---|
| `packages/engine/test/geo.test.ts` | TEST-01..06 |
| `packages/engine/test/clue-graph.test.ts` | TEST-07..12 |
| `packages/engine/test/game-state.test.ts` | TEST-13..21 |
| `packages/engine/test/accusation.test.ts` | TEST-22..25 |
| `packages/engine/test/playtest.test.ts` | TEST-26..28 |

---

## Validation Checklist

- [x] Tests written BEFORE implementation (Red phase) — 5 arquivos falhando por módulo ausente
- [x] All tests passing (Green phase) — 66 testes
- [x] Code refactored without breaking tests (Refactor phase)
- [x] Coverage meets threshold (`.specs/config.md## Defaults`) — 100% statements, 98,7% branches
- [x] Requirements met — REQ-02, 03, 05, 10, 16, 19
- [x] Edge cases tested
- [x] No regression in related features
- [x] Code follows conventions

## Notes

O pacote não declara **nenhuma** dependência de runtime, e isso é proposital: é a forma mais barata
de garantir o isolamento do ADR-004. No dia em que alguém precisar importar um cliente HTTP aqui, o
`package.json` vai obrigar a conversa.
