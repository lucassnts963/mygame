# Component Catalog

> Living inventory of reusable code in this project. Before writing anything new, check here first. After creating something reusable, add it here.

---

## Purpose

This catalog prevents duplication and enables code reuse. Every entry describes **what** the component does, **where** it lives, and **how** to use it. Agents and developers consult this before creating new code.

---

## Usage Rules

| Rule | Description |
|---|---|
| **Check before you create** | Before implementing a new component, hook, or utility, scan this catalog. If something similar exists, reuse or extend it. |
| **Add after you create** | After implementing a reusable piece, add an entry here. Include the file path, purpose, and a one-line usage example. |
| **Never duplicate** | If this catalog has an entry that matches your need, use it. Do not create a parallel implementation. |
| **Keep it current** | When refactoring or removing a component, update or remove its entry here. Stale entries are worse than no entries. |

---

## Components

Components are UI elements (React, Vue, Svelte, etc.) in `src/components/`.

| Component | Path | Purpose | Props / Input | Example |
|---|---|---|---|---|
| — | — | — | — | — |

<!-- 
Template for new entries:
| `ComponentName` | `src/components/ComponentName.{EXT}` | <what it renders> | `prop1: type, prop2: type` | `<ComponentName prop1={value} />` |
-->

---

## Repositories

Data access layer in `backend/src/db/repository/`. One per database entity. CRUD only.

| Repository | Path | Entity | Key Methods | Example |
|---|---|---|---|---|
| — | — | — | — | — |

<!-- 
Template for new entries:
| `EntityRepository` | `backend/src/db/repository/EntityRepository.{EXT}` | `entity_name` | `findById, save, delete, list` | `const user = await userRepository.findById(id)` |
-->

---

## Adapters

External service integrations in `backend/src/adapters/`. One per external service.

| Adapter | Path | External Service | Key Methods | Example |
|---|---|---|---|---|
| — | — | — | — | — |

<!-- 
Template for new entries:
| `ServiceNameAdapter` | `backend/src/adapters/ServiceNameAdapter.{EXT}` | Stripe, S3, SendGrid | `charge, upload, send` | `await stripeAdapter.charge(amount, token)` |
-->

---

## Services / Business Logic

Business logic orchestration in `backend/src/services/` or `backend/src/business/`. Coordinates repositories and adapters.

| Service | Path | Purpose | Key Methods | Example |
|---|---|---|---|---|
| — | — | — | — | — |

<!-- 
Template for new entries:
| `DomainService` | `backend/src/services/DomainService.{EXT}` | <what it orchestrates> | `process, validate, execute` | `await paymentService.processCheckout(cart)` |
-->

---

## Domínio — `@vestigio/engine`

Funções puras, sem I/O (ADR-004). **Toda** regra de jogo nasce aqui, e é daqui que o servidor,
o playtest e o validador de módulos a consomem. Antes de escrever regra nova, procure nesta tabela.

### Geo — `packages/engine/src/geo.ts`

| Function | Purpose | Signature |
|---|---|---|
| `distanceMeters` | Distância de grande círculo (Haversine) | `(a: LatLng, b: LatLng) => number` |
| `bearingDegrees` | Rumo inicial em [0, 360) — base do posicionamento em AR | `(from: LatLng, to: LatLng) => number` |
| `isWithinGeofence` | Posição está no raio da âncora? (borda inclusiva) | `(position: LatLng, anchor: Anchor) => boolean` |
| `resolveAnchor` | Reposiciona a âncora para a origem da partida, preservando distâncias (REQ-19) | `(anchor, caseOrigin, sessionOrigin) => Anchor` |

### Grafo de pistas — `packages/engine/src/clue-graph.ts`

| Function | Purpose | Signature |
|---|---|---|
| `missingPrerequisites` | O que falta no caderno para liberar a pista | `(clue, collected) => readonly string[]` |
| `unlockedClueIds` | Pistas com pré-requisitos satisfeitos | `(caseDef, collected) => readonly string[]` |
| `reachableClueIds` | Ponto fixo: tudo que um detetive perfeito alcança | `(caseDef) => readonly string[]` |
| `validateClueGraph` | Integridade estrutural do caso (ciclo, órfã, raio, solução) | `(caseDef) => readonly GraphIssue[]` |
| `MIN_RADIUS_METERS` / `MAX_RADIUS_METERS` | Limites de raio, espelhando `.specs/config.md## Game Constants` | `number` |

### Estado da partida — `packages/engine/src/game-state.ts`

| Function | Purpose | Signature |
|---|---|---|
| `createGameState` | Estado inicial, opcionalmente relocado | `(caseDef, options?) => GameState` |
| `canCollect` | Veredito explicado de coleta (nunca booleano) | `(caseDef, state, clueId, position?) => CollectVerdict` |
| `collectClue` | Coleta idempotente; devolve estado novo ou o mesmo objeto | `(caseDef, state, clueId, position?) => CollectResult` |
| `effectiveAnchor` | Âncora já reposicionada para a origem da partida | `(caseDef, state, clue) => Anchor \| undefined` |
| `visibleClues` | O que o mapa mostra agora (REQ-01) | `(caseDef, state) => readonly ClueDefinition[]` |
| `unlockedCharacters` | Quem já pode ser interrogado | `(caseDef, state) => readonly CharacterRef[]` |
| `notebook` | Caderno: pista coletada + o que ela destravou | `(caseDef, state) => readonly NotebookEntry[]` |

### Acusação e playtest

| Function | Path | Purpose | Signature |
|---|---|---|---|
| `judgeAccusation` | `src/accusation.ts` | Julga a acusação única, exigindo sustentação | `(caseDef, state, culprit) => AccusationResult` |
| `playtestCase` | `src/playtest.ts` | Percorre o caso simulado e diz se ele fecha | `(caseDef, options?) => PlaytestReport` |

---

## Contrato de módulo — `@vestigio/module-schema`

O que valida o conteúdo criado por um jogador. **`loader.ts` é o único arquivo do pacote que toca
o disco**; todo o resto recebe strings e devolve `Diagnostic[]`, o que mantém a validação testável
sem fixtures.

| Function | Path | Purpose | Signature |
|---|---|---|---|
| `parseFrontmatter` | `src/frontmatter.ts` | Lê o bloco `---` de um Markdown; nunca lança | `(text: string) => Frontmatter` |
| `validateSkill` | `src/skill-validator.ts` | `SKILL.md` contra `.specs/config.md## Skill Format` | `(folder, content) => Diagnostic[]` |
| `scanForSecrets` | `src/secret-scan.ts` | Segredo literal em qualquer arquivo do bundle | `(file, content) => Diagnostic[]` |
| `lintLore` | `src/lore-lint.ts` | Lint de `lore/WIKI_SCHEMA.md## Lint` | `(pages: LorePage[]) => Diagnostic[]` |
| `isSpoiler` | `src/lore-lint.ts` | A página revela a solução? | `(page: LorePage) => boolean` |
| `validateCaseDocument` / `validateAgentDocument` | `src/schemas/index.ts` | Validação por JSON Schema (ajv) | `(document, file) => Diagnostic[]` |
| `toCaseDefinition` | `src/schemas/index.ts` | YAML `snake_case` do autor → tipos do motor | `(doc: CaseDocument) => CaseDefinition` |
| `loadModule` | `src/loader.ts` | Lê um bundle inteiro do disco | `(root: string) => LoadedModule` |
| `validateModule` | `src/validate.ts` | Carrega e valida; junta todos os diagnósticos | `(root: string) => Diagnostic[]` |
| `validateLoadedModule` | `src/validate.ts` | Idem, sobre um módulo já em memória | `(loaded: LoadedModule) => Diagnostic[]` |

Schemas em `src/schemas/definitions.ts` (`caseSchema`, `agentSchema`). CLIs em `src/cli/`
(`validate.ts`, `playtest.ts`), com a impressão compartilhada em `cli/report.ts`.

---

## Utilities / Helpers

Pure functions in `src/utils/` or `src/helpers/`. No side effects.

| Function | Path | Purpose | Signature | Example |
|---|---|---|---|---|
| — | — | — | — | — |

<!-- 
Template for new entries:
| `functionName` | `src/utils/functionName.{EXT}` | <what it returns> | `(arg: Type) => ReturnType` | `const value = functionName(arg)` |
-->

---

## Services / API Modules

Service layers in `src/services/` or `backend/src/services/`.

| Service | Path | Purpose | Key Methods | Example |
|---|---|---|---|---|
| — | — | — | — | — |

<!-- 
Template for new entries:
| `ServiceName` | `src/services/ServiceName.{EXT}` | <what it interacts with> | `method1(), method2()` | `const data = await ServiceName.method1()` |
-->

---

## Types / Interfaces

Shared type definitions in `src/types/` or `shared/types/`.

| Type | Path | Purpose | Fields | Used By |
|---|---|---|---|---|
| — | — | — | — | — |

<!-- 
Template for new entries:
| `TypeName` | `src/types/types.{EXT}` | <what it represents> | `field1: Type, field2: Type` | `ComponentName, ServiceName` |
-->

---

## Patterns

Recurring architectural patterns used across the project.

| Pattern | Description | When to Use | Example Location |
|---|---|---|---|
| Repository | Entity data access abstraction (CRUD) | Every database entity | `backend/src/db/repository/` |
| Adapter | External service integration wrapper | Every external API/service | `backend/src/adapters/` |
| Service | Business logic orchestration | When coordinating repositories + adapters | `backend/src/services/` |
| Thin Handler | Request parsing → service call → response formatting | Every API endpoint | `backend/src/handlers/` |
| Memoized Filter | Client-side list filtering via computed/memoized value | Any searchable list | `src/components/*List.{EXT}` |
| — | — | — | — |

---

## Agent Instructions

When implementing a feature:

1. **Read this catalog first** — do not create what already exists.
2. **After Green phase**: if you created a component, hook, utility, or type that other features will need, add it here using the template under each section.
3. **During Refactor**: if you extracted reusable code, add it here and remove any now-dead entries.
4. **On bugfix**: if the fix creates a reusable helper, add it here.

---

## References

- `.specs/memory/clean-code.md` — standards that govern how entries here are written
- `.specs/memory/conventions.md` — naming and file structure conventions
- `check-consistency.md` — validation that this catalog stays current
