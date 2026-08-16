# Working Log

> Append-only, chronological journal of what agents did and learned in this project. This is the
> `log.md` of Karpathy's LLM-Wiki: the running record that makes memory *compounding* rather than
> re-derived each session. Newest entries go at the **bottom** — never rewrite or delete history.

## What this is (and is not)

| This file (`log.md`) | Not this file |
|---|---|
| Chronological — "what happened, in order" | `CHANGELOG.md` — user-facing release notes, compiled from `archive/` |
| Working memory across sessions — pick up where you left off | `troubleshooting.md` — topical error/fix memory, searched by symptom |
| Append-only; entries are never edited after the fact | `architecture.md` — curated ADRs, edited in place |

The CHANGELOG answers *"what shipped"*. This log answers *"what was I doing, and why, last session"*.

## How to write an entry

Append one block per work session (or per meaningful milestone). Keep it short — a few lines, not a
transcript. Format:

```markdown
## YYYY-MM-DD — <short title>

- **Did:** what changed (specs touched, files, decisions made).
- **Learned:** anything non-obvious worth remembering (a gotcha → also record it in troubleshooting.md).
- **Next:** the immediate next step, so the next session starts without re-reading everything.
- **Refs:** spec ids (`CHG-`/`FIX-`/`MIG-`), `TRB-` ids, commits, PRs.
```

Rules:

1. **Append only.** Add at the bottom; do not edit or remove past entries — the history is the point.
2. **Date every entry** with an ISO `YYYY-MM-DD` prefix so it is sortable and greppable.
3. **One block per session/milestone**, not per file edit. Compile, don't dump.
4. **Cross-link, don't duplicate.** Point to specs, `TRB-` entries, and commits instead of restating them.

---

## Log

<!--
Template — copy, set today's date, append at the bottom:

## 2026-01-15 — Implemented CSV export (CHG-014)

- **Did:** Added export service + handler; spec CHG-014 archived; CHANGELOG regenerated.
- **Learned:** the report stream is lazy — must `await` the cursor before serializing or rows drop.
- **Next:** wire the export button into the reports toolbar (follow-up spec 015).
- **Refs:** CHG-014, commit 9f3a1c2, TRB-002 (lazy-cursor gotcha).
-->

## 2026-08-16 — Vestígio do zero: fundação, motor, módulos, agentes, API e app (CHG-001..006)

- **Did:** Repositório vazio → jogo jogável de ponta a ponta. `spec-kit init` (metodologia 1.2.0),
  ADR-001..009, requisitos 001 (REQ-01..20, NFR-01..08). Depois, em TDD: `packages/engine`
  (CHG-001), `packages/module-schema` (CHG-002), runtime de agentes (CHG-003), API Fastify
  (CHG-004), app Flutter (CHG-005) e o módulo piloto do Poço de Jacó (CHG-006). Somam 310 testes
  TypeScript e 52 Dart. Quatro skills novas de jogo: `create-case`, `create-character-agent`,
  `validate-module`, `playtest-case`. CI passou a rodar testes, cobertura, validação do módulo e
  `flutter analyze`/`test`, além dos gates da metodologia.

- **Learned:**
  1. **A cascata de providers tinha que pular, não falhar.** Ela falhava duro quando a variável de
     ambiente do nível escolhido não existia. Como um `agent.yaml` declara a chave do *autor* do
     módulo, isso tornaria todo módulo compartilhado injogável por qualquer outra pessoa — o
     oposto do que ADR-007 e ADR-009 se propõem. Só apareceu nos testes de integração da API;
     os testes unitários do runtime passavam felizes. Corrigido em CHG-004.
  2. **Faltava ao motor a operação "conceder".** `collectClue` exige posição para pista com
     âncora, mas o UC-01 Alt-02 diz que pista revelada por NPC dispensa posição. `grantClue`
     burla a geografia e **não** os pré-requisitos. Achado ao implementar CHG-003.
  3. **Página `spoiler` é sempre órfã, e isso é correto.** O lint de lore acusava órfã toda página
     de solução — ruído em cima da página mais bem colocada do módulo. Elas são excluídas da
     checagem de órfã, e também da contagem de páginas navegáveis.
  4. **Excluir spoiler na origem, não na resposta.** O índice de lore nunca indexa a solução, em
     vez de filtrá-la depois. A diferença é entre "o agente não deve contar" e "o agente não tem
     como contar" — e só a segunda resiste a *prompt injection* pela conversa.
  5. `erasableSyntaxOnly` do TS proíbe *parameter properties* (`constructor(readonly x)`), o que
     obriga a declarar campos de classe à mão. Vale a pena: é o que deixa `node --experimental-strip-types`
     rodar o código sem passo de build.

- **Next:** persistência real em Postgres (hoje as sessões são em memória e se perdem ao
  reiniciar); streaming SSE no chat; e um playtest de campo do caso piloto para calibrar o raio de
  25 m em rua aberta versus área com prédios.

- **Refs:** CHG-001..006, requisitos 001, ADR-001..009, commits `1a9ec7c`, `72f9480`, `324fc5f`,
  `922c1f9`, `5dde59a`, `415f616`, `e9fb86b`, `41a8988`.
