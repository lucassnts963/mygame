# Architectural Decision Records

## ADR-001: Spec-Driven Development

- **Date:** 2026-08-16
- **Status:** Accepted

**Context:** Without structured planning, scope creep and inconsistent implementation are risks. Complex projects need traceable decisions.

**Decision:** All changes (features, migrations, bugfixes) must go through a spec document in `.specs/changes/` before implementation. Specs follow templates in `.specs/templates/`. Completed specs are archived.

**Consequences:**
- Slightly slower start for small changes
- Better traceability and documentation
- Architectural decisions captured here
- Entity mapping stays current in `shared/`

---

## ADR-002: Test-Driven Development

- **Date:** 2026-08-16
- **Status:** Accepted

**Context:** Without tests written first, implementations drift from requirements. Bugs are discovered late. Refactoring becomes risky without a safety net.

**Decision:** All code changes follow TDD: tests are written BEFORE implementation, using the spec's requirements as the source of truth for test cases. The TDD cycle (Red → Green → Refactor) is integrated into the spec workflow: Spec → Write Tests → Implement → Refactor → Validate → Archive.

**Consequences:**
- Slightly longer initial development time (offset by fewer regressions)
- Every spec must include a `## Tests` section defining test cases
- Bugfix specs must include a regression test that reproduces the bug first
- Code without tests is considered incomplete
- Refactoring is safer with comprehensive test coverage
- Agents following this project MUST write tests before implementation code

---

## ADR-003: Stack — Flutter + Node/TypeScript + Postgres

- **Date:** 2026-08-16
- **Status:** Accepted

**Context:** O jogo exige três coisas ao mesmo tempo: câmera e sensores (AR), GPS contínuo em
segundo plano e mapa interativo. Isso elimina a web como cliente principal — WebXR é limitada no
iOS e o acesso a sensores no navegador é irregular. O autor já trabalha com Flutter, Next.js e
Supabase.

**Decision:** Cliente em **Flutter** (Android/iOS com um código só, acesso nativo a câmera,
bússola e GPS). Backend próprio em **Node + TypeScript com Fastify**. Persistência em
**Postgres**, hospedável no Supabase. Nada de Edge Functions no MVP: o runtime de agentes precisa
de biblioteca livre e de testes rodando no mesmo ambiente do código.

**Consequences:**
- Um só cliente para as duas plataformas; nenhuma versão web no MVP
- TypeScript une backend e domínio, então a regra de jogo é testável sem emulador
- O app fica *fino* de propósito — a regra vive no servidor e no `packages/engine`
- Postgres permite trocar Supabase por qualquer host depois

---

## ADR-004: Domínio puro em `packages/engine`, isolado de I/O

- **Date:** 2026-08-16
- **Status:** Accepted

**Context:** Regra de jogo espalhada entre app e servidor duplica lógica e diverge. Pior: regra
acoplada a HTTP ou banco só se testa subindo infraestrutura, o que na prática significa não se
testar. E há um terceiro consumidor além do app e do servidor — o *playtest*, que precisa
percorrer um caso inteiro sem GPS, sem rede e sem jogador.

**Decision:** Todo o núcleo — grafo de pistas, estado da partida, geofence, julgamento da
acusação — vive em `packages/engine` como **funções puras**: sem I/O, sem `Date.now()`, sem
`Math.random()` implícitos. Tempo e aleatoriedade, quando necessários, são injetados. O servidor
e o playtest importam o mesmo motor.

**Consequences:**
- Cobertura alta é barata: o motor é testável com objetos literais
- Um caso pode ser provado solúvel antes de existir qualquer app
- Exige disciplina: a tentação de chamar o banco de dentro do motor tem que ser recusada
- O app reimplementa apenas a distância Haversine (para o feedback "quente/frio" offline); o
  servidor continua sendo a autoridade sobre coleta de pista

---

## ADR-005: AR geolocalizada por GPS + bússola, sem ARCore/ARKit no MVP

- **Date:** 2026-08-16
- **Status:** Accepted

**Context:** "Realidade aumentada" abrange coisas muito diferentes. Detecção de plano
(ARCore/ARKit) dá objetos ancorados de forma convincente, mas exige aparelho compatível, aumenta
muito o tamanho do app e — decisivo — **desconecta o jogo do mapa**: um objeto na mesa da sala
não exige que o jogador vá a lugar nenhum. O jogo aqui é sobre deslocamento.

**Decision:** No MVP, a pista é desenhada sobre a imagem da câmera posicionada por **bearing**
(rumo calculado entre a posição do jogador e a âncora) e **distância**, usando `geolocator` +
bússola. Sem detecção de plano, sem SLAM.

**Consequences:**
- Funciona em praticamente qualquer aparelho com câmera e bússola
- O vestígio "flutua" e não gruda numa superfície — aceitável para o gênero, que é sobre
  encontrar o lugar, não sobre manipular o objeto
- A imprecisão do GPS (5–10 m) é absorvida pelo raio de geofence, não pela renderização
- Detecção de plano fica como spec futura, sem bloquear nada

---

## ADR-006: Lore como LLM-Wiki com FAITHFULNESS

- **Date:** 2026-08-16
- **Status:** Accepted

**Context:** Personagens conversacionais movidos a LLM alucinam. Num jogo de mistério isso não é
um defeito cosmético: um NPC que inventa um álibi torna o caso **insolúvel** e o jogador é punido
por ter confiado na informação. Ao mesmo tempo, roteirizar diálogo em árvore mata exatamente a
liberdade que motiva usar IA.

**Decision:** O conhecimento de cada personagem é uma **wiki de lore** em arquivos Markdown,
seguindo a metodologia LLM-Wiki do vault `lucassnts963/knowledge`. A regra suprema
**FAITHFULNESS** é herdada: o personagem só afirma o que está fundamentado em uma página. O
acesso se dá pela ferramenta `consultar_lore` (RAG restrito à lore do módulo). Sem fundamento, o
personagem desconversa em personagem — nunca inventa. Páginas marcadas `spoiler: true` (a verdade
do caso) são lidas pelo motor e **jamais** entram no contexto do agente.

**Consequences:**
- O caso continua solúvel e justo, mesmo com conversa livre
- Conteúdo bíblico/histórico fica auditável: cada afirmação tem referência
- Manter a lore vira trabalho de verdade — é o custo de ter NPCs que não mentem
- O spoiler fora do contexto do agente neutraliza *prompt injection* pela conversa: o jogador não
  consegue extrair do NPC uma verdade que o NPC nunca recebeu

---

## ADR-007: Agentes-personagem via API OpenAI-compatible, com chave por personagem (BYOK)

- **Date:** 2026-08-16
- **Status:** Accepted

**Context:** Amarrar o jogo a um único fornecedor de LLM cria três problemas: o custo por conversa
recai inteiro sobre quem hospeda, o jogador não pode escolher a qualidade que quer pagar, e
módulos criados pela comunidade ficam inviáveis em escala. Por outro lado, cada SDK proprietário
tem formato próprio de mensagens e de *function calling*.

**Decision:** O runtime fala **um único protocolo: `POST /chat/completions` no formato da API da
OpenAI**, com *function calling*. Qualquer endpoint compatível serve — OpenAI, Groq, OpenRouter,
Together, Ollama, llama.cpp. Cada personagem declara seu provider (`baseUrl`, `model`, chave); a
resolução é em cascata **personagem → módulo → servidor**.

**Consequences:**
- O jogador pode rodar um caso inteiro com um modelo local, sem custo
- O autor do módulo escolhe o modelo que combina com o personagem
- O jogo não depende de nenhum fornecedor e sobrevive à troca de qualquer um deles
- Perde-se acesso a recursos proprietários fora do denominador comum (cache de prompt, formatos
  de raciocínio estendido) — aceitável, pois o loop do NPC é simples
- Exige gestão de segredos de terceiros no servidor (ver ADR-008)

---

## ADR-008: Chaves de provider cifradas em repouso e nunca expostas ao cliente

- **Date:** 2026-08-16
- **Status:** Accepted

**Context:** O ADR-007 faz o jogo custodiar chaves de API de terceiros. Uma chave vazada é
prejuízo financeiro direto para o jogador. O caminho mais curto — o app chamar o provider
diretamente com a chave do jogador — expõe a chave no aparelho e nos logs de rede.

**Decision:** A chave é enviada **uma vez** ao servidor, cifrada com **AES-256-GCM** e guardada
cifrada. Todo tráfego com o provider passa pelo servidor. Nenhuma resposta de API devolve a chave:
serializações expõem apenas os 4 últimos caracteres. A chave em claro só existe em memória, no
instante da chamada.

**Consequences:**
- O app nunca vê uma chave, então um aparelho comprometido não vaza credencial de provider
- O servidor vira alvo: a chave-mestra fica em variável de ambiente, fora do banco e do git
- Impossível "esquecer de mascarar" por acidente — o mascaramento é do tipo, não do endpoint
- Custo: uma chamada extra de rede por turno de conversa (app → servidor → provider)

---

## ADR-009: Módulo de usuário como bundle declarativo com skills no formato do kit

- **Date:** 2026-08-16
- **Status:** Accepted

**Context:** O objetivo é que o jogador crie seus próprios casos, personagens e agentes — "o
limite é a imaginação". A saída óbvia seria uma linguagem de script embarcada, mas script de
usuário num servidor multiusuário é superfície de ataque e um problema de sandbox sem fim.

**Decision:** Um módulo é um **bundle declarativo de arquivos**, sem código executável:

```
modules/<slug>/
├── case.yaml                    # cenas, pistas, âncoras GPS, solução
├── agents/<nome>.agent.yaml     # persona, provider, skills[], tools[]
├── skills/<nome>/SKILL.md       # MESMO formato de 6 seções do starter-kit
└── lore/wiki/**.md              # o que os personagens sabem
```

As skills do personagem usam **exatamente** o formato validado por `.specs/config.md## Skill
Format` — frontmatter + as 6 seções canônicas — e são carregadas sob demanda: só a `description`
entra no prompt, o corpo só quando a skill é acionada.

**Consequences:**
- A metodologia que constrói o projeto passa a ser a mecânica de criação de conteúdo do jogo:
  quem aprende a escrever uma skill do repo já sabe escrever uma skill de personagem
- Nenhum código de usuário roda no servidor — a superfície de ataque é a de um parser de YAML
- Validação é determinística (`npm run validate-module`), então erro de módulo aparece antes de
  virar bug em partida
- O preço é expressividade: comportamento não previsto pelo schema exige mudar o schema. Aceito —
  a alternativa era sandbox de execução remota
- MCP externo cabe no mesmo desenho (`mcp:` no `agent.yaml`) e fica para uma spec futura
