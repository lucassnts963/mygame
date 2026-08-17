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

## 2026-08-17 — Persistência, o texto que não chegava, e pesquisa de monetização

- **Did:** `CHG-007` (Postgres, com prova de `kill -9`), `CHG-009` (câmera ao vivo + o texto das
  pistas chegando à tela), revisão de alinhamento dos requisitos 001 com veredito **`misaligned`**,
  spec retroativa `CHG-006`, `schema-target.md` preenchido, e o documento de requisitos 002
  (casos de história local com patrocínio) com anexo de pesquisa de mercado.

- **Learned:**
  1. **O conteúdo escrito do jogo nunca chegava ao jogador.** `case.yaml` tem `description` por
     pista, o schema aceitava, o loader lia — e `toCaseDefinition` descartava, porque
     `ClueDefinition` não tinha o campo. Toda a escrita dos casos estava no repositório e
     invisível. Lição geral: **um campo aceito pelo schema e não mapeado no domínio some sem
     erro nenhum.** Vale procurar outros.
  2. **`citext` não serve em schema-por-teste.** Extensão é instalada em um schema e fica
     invisível nos outros; o `IF NOT EXISTS` da segunda execução pula e o tipo some. Índice único
     em `lower(email)` dá a mesma garantia sem extensão — e funciona onde o app não é superusuário.
  3. **Teste que fixa fornecedor quebra a cada troca legítima.** Um assert com a URL da OpenAI
     quebrou quando o módulo mudou para DeepSeek. O teste estava errado, não a mudança: trocar de
     provider é a liberdade que o ADR-007 promete.
  4. **`&&` com `grep` engole exit code.** O gate de cobertura reprovou em 89,4% e a cadeia
     continuou como se estivesse tudo bem. Conferir código de saída explicitamente quando o
     comando é um gate.
  5. **Pesquisa de monetização — impedimento jurídico achado:** num caso de história local, um
     estabelecimento real apontado como culpado é risco de dano à imagem. Casos bíblicos acusam
     gente de dois mil anos atrás; casos da cidade acusam pessoas com descendentes vivos. Vira
     `REQ-23`/`REQ-30`: regra de validador, não recomendação.
  6. **Requisitos e specs compartilham um espaço de numeração.** Numerei o documento novo como
     `requirements/002-` e o `check-consistency` reprovou: ele pareia pelo número, então o 002
     colidiu com `changes/002-module-schema` e passou a exigir que os `REQ` daquela spec
     existissem no documento novo. Renumerado para `010`, que é o próximo livre depois das specs.
  7. **A Questo prova que "usuário cria módulos" é modelo de negócio**, não só recurso: 30 mil
     criadores com repartição de receita. A arquitetura de bundle declarativo já construída aqui
     serve a isso sem mudança.

- **Next:** o archive de `CHG-001..006` continua **bloqueado** — `REQ-13` (chave cifrada em
  repouso) só fecha com contas, adiadas por decisão de rumo. Na jogabilidade, o buraco mais
  visível é a **tela de fim de caso**: hoje a acusação dá veredito e a partida simplesmente para,
  sem epílogo nem revelação. Nos requisitos 002, o próximo passo não é código: é conversar com
  cinco comerciantes e com a Secretaria de Turismo (premissas A-20 e A-23).

- **Refs:** CHG-007, CHG-009, requisitos 010, `alignment-review.md` de 001, commits `020b059`,
  `6b59efc`, `d44330f`.

## 2026-08-17 — A tela de fim de caso, e o mesmo defeito pela segunda vez (CHG-011)

- **Did:** `CHG-011` inteiro — `caseOutcome()` puro no motor, `solution.reveal` atravessando
  módulo → domínio → API → app, `outcome` na visão da partida **só depois da acusação**, tela de
  desfecho em Flutter com manchete própria por veredito, modo leitura no mapa, e a página
  `casos/a-verdade` do piloto reescrita como prosa para o jogador. Prova manual de ponta a ponta
  contra a API de verdade: acusação certa e sustentada, acusação errada, e reabrir a partida.
  Ao final, a varredura prometida por campos de schema que o domínio não consome.

- **Learned:**
  1. **`reveal` era o mesmo defeito de `description`, com um agravante.** O epílogo do caso piloto
     estava escrito, versionado e **inalcançável** — `toCaseDefinition` descartava o campo. A
     primeira vez foi um achado; a segunda é um padrão. A varredura encontrou mais quatro campos
     (`clues[].lore`, `agent.tools`, `agent.lore`, `characters[].agent`), documentados na spec.
     Enquanto o schema for aberto por princípio (ADR-009), **"todo campo declarado tem consumidor"
     tem de virar teste** — varrer à mão a cada duas specs não escala.
  2. **`agent.lore` mente hoje.** O validador confere que a lista declarada não expõe spoiler, mas
     o runtime entrega a lore inteira do módulo ao índice. Não é vazamento (spoiler continua
     barrado na origem), é uma promessa de escopo não cumprida — e escopo por personagem é o que
     dá textura a um elenco. Fica no backlog com nome e endereço.
  3. **A disciplina do spoiler tem duas direções.** A mesma página que o agente nunca pode ver é
     a que o jogador precisa ler no fim. O corte não é "quem", é "quando": antes da acusação o
     texto não aparece em resposta nenhuma; depois, é o desfecho. O `TEST-11` varre o corpo de
     todas as respostas anteriores justamente porque essa inversão é fácil de errar.
  4. **Página de `reveal` é prosa, não documentação.** A do piloto começava explicando ao *autor*
     que a página era spoiler e citando ADR — texto que ia direto para a tela do jogador no
     momento de maior imersão. Nota de autoria agora vai em comentário HTML, e o servidor as
     remove **antes** de responder, sem confiar no renderizador do app.
  5. **O gate de cobertura reprovou de novo — e desta vez foi visto.** Branches em 89,66% com o
     `exit: 1` conferido explicitamente (lição 4 da sessão anterior, aplicada). Fechado com
     testes do que faltava de verdade: guarda de motivo não terminal no motor e os casos sem
     epílogo, que o módulo piloto não representa. Terminou em 90,9%, `exit: 0`.

- **Next:** o desfecho fecha o buraco de jogabilidade mais visível. O que sobra na linha "app de
  ponta a ponta": calibrar o raio de 25 m **na rua**, com o aparelho na mão — segue sendo a única
  constante do jogo escolhida por raciocínio e nunca validada em campo. Depois disso, contas e
  login (que desbloqueiam `REQ-13` e o archive de `CHG-001..006`).

- **Refs:** CHG-011, `packages/engine/src/outcome.ts`, `app/lib/features/outcome/`,
  `lore/WIKI_SCHEMA.md## Páginas de revelação`.
