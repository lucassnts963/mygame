# Spec: Contrato do módulo (`packages/module-schema`)

| Field | Value |
|---|---|
| **ID** | CHG-002 |
| **Status** | approved |
| **Author** | Lucas de Oliveira Santos |
| **Created** | 2026-08-16 |
| **Approved** | 2026-08-16 |

## Context

O que separa o Vestígio de um jogo de mistério comum é o jogador poder criar o próprio caso — com
personagens, skills e lore. Isso só funciona se houver um **contrato**: um formato de arquivo que
o autor escreve à mão e que o jogo sabe recusar quando está errado.

Recusar cedo é o ponto. Sem validação, um `requires` com erro de digitação vira uma partida
travada no meio da rua; uma página de lore marcada como spoiler exposta ao agente vira o NPC
entregando a solução; e — pior — uma chave de API escrita literalmente no YAML vira credencial
vazada no momento em que o autor compartilha o módulo.

Esta spec define o contrato e o valida por comando, antes de qualquer partida.

## Scope

- Schema (JSON Schema + `ajv`) de `case.yaml` e de `<nome>.agent.yaml`
- Carregador: diretório de módulo → `CaseDefinition` (do `@vestigio/engine`) + agentes + skills + lore
- Validador de `SKILL.md` com as regras de `.specs/config.md## Skill Format`
- Lint de lore conforme `lore/WIKI_SCHEMA.md## Lint`
- Regra de segurança: nenhum segredo literal no bundle (ADR-008)
- CLIs `npm run validate-module` e `npm run playtest`

### Out of Scope

- Executar o agente — é CHG-003
- Servir módulos por HTTP, publicar, versionar — fora do MVP
- Busca semântica (embeddings) na lore; o MVP usa busca textual

## Requirements

### Functional

- [x] REQ-14: `validateModule` aponta o erro e **onde** ele está, por arquivo
- [x] REQ-15: `SKILL.md` de personagem valida frontmatter + as 6 seções canônicas
- [x] REQ-16: `npm run playtest -- <modulo>` carrega o módulo e roda `playtestCase`
- [x] REQ-20: lint de lore, com `spoiler-exposed` e `unsourced-canon` como erro

### Non-Functional

- [x] NFR-02: um `api_key` literal em qualquer arquivo do módulo é **erro de validação**
- [x] NFR-05: cobertura ≥ o limiar de `.specs/config.md## Defaults`

### Technical

| Layer | File / Component | Change Description |
|---|---|---|
| Contract | `packages/module-schema/src/schemas/definitions.ts` | JSON Schema de `case.yaml` e `agent.yaml` |
| Contract | `packages/module-schema/src/schemas/index.ts` | Compilação ajv + mapeamento YAML → tipos do motor |
| Domain | `packages/module-schema/src/frontmatter.ts` | Parser de frontmatter YAML |
| Domain | `packages/module-schema/src/skill-validator.ts` | Regras de `SKILL.md` |
| Domain | `packages/module-schema/src/lore-lint.ts` | Lint da lore |
| Domain | `packages/module-schema/src/secret-scan.ts` | Detecção de segredo literal |
| Domain | `packages/module-schema/src/validate.ts` | Orquestra tudo e junta os diagnósticos |
| Adapter | `packages/module-schema/src/loader.ts` | Único ponto de I/O: lê o diretório do módulo |
| CLI | `packages/module-schema/src/cli/{validate,playtest}.ts` | Cascas de linha de comando |

## Design

### Formato de `case.yaml`

Chaves em `snake_case` (é arquivo de autor, não de código) e ids em `kebab-case`:

```yaml
id: poco-de-jaco
title: O Cântaro Abandonado
origin: { lat: -1.5089, lng: -48.6247 }
clues:
  - id: pista-cantaro
    title: O cântaro abandonado
    requires: []
    anchor: { lat: -1.5089, lng: -48.6247, radius: 25 }
    unlocks_characters: [samaritana]
characters:
  - id: samaritana
    name: A mulher do poço
    requires: []
    agent: agents/samaritana.agent.yaml
solution:
  culprit: samaritana
  supporting_clues: [pista-cantaro, pista-confissao]
```

### Formato de `agent.yaml`

```yaml
id: samaritana
name: A mulher do poço
persona: |
  Você é uma mulher de Samaria, no calor do meio-dia...
provider:
  base_url: https://api.openai.com/v1
  model: gpt-4o-mini
  api_key_env: VESTIGIO_SAMARITANA_KEY
skills: [interrogar]
lore: [personagens/samaritana, lugares/poco-de-jaco]
reveals:
  - clue: pista-confissao
    requires_clues: [pista-pegadas]
```

`provider` inteiro é **opcional**: sem ele, a cascata cai para o módulo e depois para o servidor
(REQ-12). A chave nunca aparece aqui — só o **nome** da variável de ambiente que a carrega.

### Diagnóstico, não exceção

O validador devolve uma lista de `Diagnostic { severity, code, file, message }` em vez de lançar no
primeiro erro. Um autor com cinco problemas quer ver os cinco de uma vez, não descobrir um por
execução.

### Por que segredo literal é erro, e não aviso

Um módulo é feito para ser compartilhado. No instante em que o autor manda o diretório para
alguém, tudo que estiver dentro dele vazou. Aviso se ignora; erro não. Por isso `api_key`,
`apiKey`, `authorization` com valor literal, ou qualquer string com cara de chave (`sk-…`,
`Bearer …`) reprovam a validação — inclusive dentro da lore e das skills, não só no `agent.yaml`.

### Edge Cases

- Diretório sem `case.yaml` → erro claro, não stack trace
- YAML sintaticamente inválido → erro com o arquivo e a linha
- `agent:` apontando para arquivo inexistente → erro
- Personagem no `case.yaml` sem agente declarado → aviso (é NPC mudo, pode ser intencional)
- Página de lore listada em `agent.lore` que não existe → erro
- Página `spoiler: true` listada em `agent.lore` → erro (`spoiler-exposed`)
- Skill declarada em `agent.skills` sem `SKILL.md` correspondente → erro

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Validação frouxa deixa passar módulo que trava em partida | Med | High | O validador chama `validateClueGraph` e `playtestCase` do motor — a mesma regra da partida |
| Regex de segredo com falso positivo irritante | Med | Med | Padrões restritos a chaves nomeadas e prefixos conhecidos; teste cobre o falso positivo |
| Schema rígido demais trava a criatividade do autor | Med | Med | Campos desconhecidos são avisos, não erros; só o essencial é obrigatório |

## Dependencies

- `@vestigio/engine` (CHG-001) — validação estrutural e playtest

## Requirements Traceability

**Requirements:** [`requirements/001-vestigio-mvp/requirements.md`](../../requirements/001-vestigio-mvp/requirements.md)

| REQ ID | Requirement Summary | Priority | Acceptance Criteria |
|---|---|---|---|
| REQ-14 | Validação do bundle de módulo | Must | Módulo quebrado é reprovado com arquivo e mensagem |
| REQ-15 | Skills de personagem no formato do kit | Should | `SKILL.md` sem uma das 6 seções é reprovado |
| REQ-16 | Playtest carregando o módulo | Must | `playtest` roda sobre o módulo lido do disco |
| REQ-20 | Lint de lore | Must | Página spoiler exposta ao agente reprova |

## Tests

> **TDD:** escritos ANTES da implementação.

### Test Cases

| ID | Test | Type | Description |
|---|---|---|---|
| TEST-01 | `parseFrontmatter` lê YAML e corpo | unit | Base do lint e das skills |
| TEST-02 | `parseFrontmatter` sem frontmatter | unit | Devolve nulo, não lança |
| TEST-03 | `parseFrontmatter` com YAML inválido | unit | Erro descritivo |
| TEST-04 | `validateSkill` aprova skill bem formada | unit | REQ-15 |
| TEST-05 | `validateSkill` recusa seção faltante | unit | REQ-15 |
| TEST-06 | `validateSkill` recusa nome ≠ pasta | unit | REQ-15 |
| TEST-07 | `validateSkill` recusa descrição curta | unit | REQ-15 |
| TEST-08 | `scanForSecrets` acha `sk-…` e `api_key:` literal | unit | NFR-02 |
| TEST-09 | `scanForSecrets` aceita `api_key_env` | unit | NFR-02, falso positivo |
| TEST-10 | `lintLore` recusa página sem frontmatter | unit | REQ-20 |
| TEST-11 | `lintLore` recusa `canon: biblico` sem `source` | unit | REQ-20 |
| TEST-12 | `lintLore` recusa link `[[…]]` quebrado | unit | REQ-20 |
| TEST-13 | `lintLore` avisa página órfã | unit | REQ-20 |
| TEST-14 | `caseSchema` aceita caso válido | unit | REQ-14 |
| TEST-15 | `caseSchema` recusa id fora de kebab-case | unit | REQ-14 |
| TEST-16 | `caseSchema` recusa campo obrigatório ausente | unit | REQ-14 |
| TEST-17 | `agentSchema` recusa `api_key` literal no provider | unit | NFR-02 |
| TEST-18 | `toCaseDefinition` mapeia YAML → tipos do motor | unit | REQ-16 |
| TEST-19 | `loadModule` lê um módulo completo do disco | integration | REQ-14 |
| TEST-20 | `loadModule` erra claro sem `case.yaml` | integration | Edge case |
| TEST-21 | `validateModule` aprova o módulo de exemplo | integration | REQ-14 |
| TEST-22 | `validateModule` reprova spoiler exposto ao agente | integration | REQ-20 |
| TEST-23 | `validateModule` reprova skill declarada e ausente | integration | REQ-15 |
| TEST-24 | `validateModule` reprova caso insolúvel | integration | REQ-16 |
| TEST-25 | `validateModule` junta vários diagnósticos de uma vez | integration | Design |

### Test Files

| File | What It Covers |
|---|---|
| `packages/module-schema/test/frontmatter.test.ts` | TEST-01..03 |
| `packages/module-schema/test/skill-validator.test.ts` | TEST-04..07 |
| `packages/module-schema/test/secret-scan.test.ts` | TEST-08..09 |
| `packages/module-schema/test/lore-lint.test.ts` | TEST-10..13 |
| `packages/module-schema/test/schemas.test.ts` | TEST-14..18 |
| `packages/module-schema/test/validate.test.ts` | TEST-19..25 |

---

## Validation Checklist

- [x] Tests written BEFORE implementation (Red phase) — 6 arquivos falhando por módulo ausente
- [x] All tests passing (Green phase) — 145 testes no total do repositório
- [x] Code refactored without breaking tests (Refactor phase)
- [x] Coverage meets threshold (`.specs/config.md## Defaults`) — 100% statements, 95,7% branches
- [x] Requirements met — REQ-14, 15, 16, 20 e NFR-02
- [x] Edge cases tested
- [x] Code follows conventions

## Notes

`loader.ts` é o **único** arquivo deste pacote que toca o disco. Todo o resto recebe strings e
devolve diagnósticos, o que mantém a validação testável sem fixtures em disco — exceto os testes
de integração, que existem justamente para exercitar o carregamento real.
