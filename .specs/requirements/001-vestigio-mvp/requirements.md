# Requirements Specification — Vestígio MVP

| Field | Value |
|---|---|
| **ID** | REQ-001 |
| **Status** | approved |
| **Author** | Lucas de Oliveira Santos |
| **Created** | 2026-08-16 |
| **Stakeholders** | Lucas (autor/produto), jogador-detetive, autor de módulo |

---

## 1. Problem Statement

### Current Situation

Jogos de mistério são consumidos sentado. O mistério acontece na tela, o jogador clica em
hotspots e escolhe falas de uma lista. Duas consequências: o **lugar** não importa (a história
poderia se passar em qualquer canto) e o **personagem** esbarra na borda do roteiro em poucos
cliques — o jogador percebe rapidamente que está falando com uma árvore de diálogo.

Do outro lado, jogos geolocalizados (caça ao tesouro, city games) usam o lugar de verdade mas o
conteúdo é raso: uma pista é um texto fixo numa coordenada. Não há investigação, há checklist.

Não existe hoje um jogo que junte as duas coisas **e** deixe o jogador criar seus próprios casos,
personagens e agentes.

### Why This Matters

- Sem deslocamento real, o jogo perde o que só ele pode oferecer: a cidade como tabuleiro.
- Sem personagens que respondem de verdade, o interrogatório — o coração do gênero — vira menu.
- Sem criação por usuário, o conteúdo acaba: um caso se resolve uma vez só.
- Casos bíblicos e históricos exigem correção factual. Um NPC que inventa uma passagem não é só
  um bug — é conteúdo errado sobre um texto que o jogador conhece e respeita.

### Success Definition

| Metric | Current | Target |
|---|---|---|
| Caso jogável de ponta a ponta (mapa → AR → interrogatório → acusação) | 0 | 1 |
| Pistas alcançáveis só por deslocamento real | 0 | 100% das pistas do caso piloto |
| Afirmações factuais do NPC fundamentadas na lore | — | 100% (auditável por `consultar_lore`) |
| Módulo criável sem escrever código | não | sim (só YAML + Markdown) |
| Fornecedores de LLM suportados | 0 | qualquer endpoint OpenAI-compatible |
| Cobertura de testes do código TS | 0% | ≥ 90% (`.specs/config.md## Defaults`) |

---

## 2. Stakeholder Map

| Stakeholder | Role | Interest | Influence | Key Concern |
|---|---|---|---|---|
| Lucas | Autor / produto / dev | Um jogo que junte mapa, AR e agentes, e que ele consiga evoluir sozinho | High | Não afundar em escopo; custo de LLM sob controle |
| Jogador-detetive | Usuário final | Um mistério justo e solúvel, que valha sair de casa | High | Ser enganado por informação inventada; GPS impreciso frustrar |
| Autor de módulo | Criador de conteúdo | Criar caso e personagem sem programar | Med | Descobrir que o módulo quebrou só durante a partida |
| Comunidade de fé (casos bíblicos) | Público do conteúdo | Fidelidade ao texto | Med | Afirmação sem base no versículo |

---

## 3. Methodology

Abordagem **híbrida**: User Stories para o recorte de produto, Use Case para o fluxo central
(investigar uma pista), BDD para as regras que viram teste diretamente.

---

## 4. Requirements

### 4.1 User Stories

| ID | Story | Acceptance Criteria |
|---|---|---|
| US-01 | Como detetive, quero ver no mapa onde há pistas para saber aonde ir | 1. Só pistas desbloqueadas aparecem 2. Minha posição aparece 3. A distância até cada pista é visível |
| US-02 | Como detetive, quero que a pista só apareça quando eu chegar ao lugar, para o deslocamento ter sentido | 1. Fora do raio, a investigação é recusada 2. Dentro do raio, a câmera abre |
| US-03 | Como detetive, quero ver o vestígio ancorado no lugar pela câmera, para sentir que ele está ali | 1. O vestígio aparece na direção real da âncora 2. Girando o aparelho, ele permanece no rumo |
| US-04 | Como detetive, quero interrogar personagens em conversa livre, para investigar do meu jeito | 1. Escrevo qualquer pergunta 2. A resposta chega em streaming 3. O personagem se mantém em personagem |
| US-05 | Como detetive, quero que o personagem nunca invente fatos, para o caso ser solúvel | 1. Toda afirmação factual tem base na lore 2. Sem base, o personagem desconversa |
| US-06 | Como detetive, quero um caderno com o que já descobri, para raciocinar | 1. Lista as pistas coletadas 2. Mostra o que cada uma destravou |
| US-07 | Como detetive, quero acusar ao final e saber se acertei e por quê | 1. Uma acusação por caso 2. O veredito explica quais pistas sustentavam a conclusão |
| US-08 | Como autor de módulo, quero criar um caso sem programar | 1. Só YAML e Markdown 2. Um comando valida o módulo antes de jogar |
| US-09 | Como autor de módulo, quero definir a personalidade e o modelo de cada personagem | 1. Persona em arquivo 2. `baseUrl`/`model`/chave por personagem |
| US-10 | Como jogador, quero usar minha própria chave de API, para controlar o custo e a qualidade | 1. Configuro a chave uma vez 2. A chave nunca me é devolvida nem sai do servidor |
| US-11 | Como autor, quero provar que meu caso é solúvel sem sair de casa | 1. Um comando percorre o caso com GPS simulado 2. Ele acusa beco sem saída |
| US-12 | Como jogador em qualquer cidade, quero jogar um caso escrito para outro lugar | 1. As âncoras do módulo são relativas a uma origem configurável |

### 4.2 Use Cases

**UC-01: Investigar uma pista**

| Field | Value |
|---|---|
| **Actor** | Detetive (jogador) |
| **Pre-condition** | Partida aberta; a pista está desbloqueada e ainda não coletada |
| **Post-condition** | A pista está no caderno e as pistas que ela destrava ficam visíveis |
| **Trigger** | O jogador entra no raio de geofence da âncora |

**Main Flow:**
1. O app detecta que a posição está dentro do raio da âncora
2. O app oferece "Investigar"
3. O jogador abre a câmera; o vestígio é desenhado no rumo da âncora
4. O jogador confirma a coleta
5. O servidor **revalida** a posição contra a âncora e os pré-requisitos
6. O servidor grava a coleta e devolve o caderno atualizado
7. O mapa passa a mostrar as pistas recém-desbloqueadas

**Alternative Flows:**
- **Alt-01:** A pista destrava um personagem → o personagem aparece na lista de interrogáveis
- **Alt-02:** A pista é revelada por um NPC em conversa (`revelar_pista`) → passos 5–7 iguais,
  sem exigência de posição

**Exception Flows:**
- **Exc-01:** Posição fora do raio na revalidação → recusa com a distância que falta
- **Exc-02:** Pré-requisito não atendido → recusa nomeando o que falta descobrir antes
- **Exc-03:** Pista já coletada → operação idempotente, caderno devolvido sem duplicar

### 4.3 Job Stories

| ID | Story |
|---|---|
| JS-01 | Quando eu perguntar algo que a lore não responde, quero que o personagem hesite em personagem, para eu não ser enganado |
| JS-02 | Quando o GPS oscilar perto da âncora, quero que o jogo não me expulse da pista, para não perder o vestígio por erro de aparelho |
| JS-03 | Quando eu criar um módulo com erro, quero saber antes de jogar, para não descobrir na rua |

### 4.4 BDD Scenarios

```gherkin
Feature: Coleta de pista por geofence

  Scenario: Dentro do raio, com pré-requisitos atendidos
    Given a pista "pista-cantaro" tem âncora em (-1.4558, -48.5044) e raio de 25 m
    And o detetive já coletou os pré-requisitos dela
    When ele tenta coletar a 12 m da âncora
    Then a pista entra no caderno
    And as pistas que dependem dela ficam desbloqueadas

  Scenario: Fora do raio
    Given a mesma pista
    When o detetive tenta coletar a 240 m da âncora
    Then a coleta é recusada
    And o motivo informa a distância que falta

  Scenario: Pré-requisito não atendido
    Given a pista "pista-testemunho" exige "pista-cantaro"
    And o detetive não coletou "pista-cantaro"
    When ele tenta coletar "pista-testemunho" dentro do raio
    Then a coleta é recusada nomeando o pré-requisito que falta

  Scenario: Coleta repetida é idempotente
    Given o detetive já coletou "pista-cantaro"
    When ele coleta "pista-cantaro" de novo
    Then o caderno continua com uma única ocorrência

Feature: Fidelidade do personagem

  Scenario: Pergunta sem base na lore
    Given a lore do módulo não diz nada sobre o irmão da personagem
    When o detetive pergunta o nome do irmão dela
    Then a resposta não afirma nenhum nome
    And o personagem desconversa mantendo o papel

  Scenario: A verdade do caso está fora do alcance do agente
    Given a página da solução está marcada com "spoiler: true"
    When o detetive pede ao personagem que revele o culpado
    Then o contexto do agente não contém essa página

Feature: Acusação

  Scenario: Acusação correta e sustentada
    Given o detetive coletou todas as pistas de sustentação da solução
    When ele acusa o culpado correto
    Then o veredito é "resolvido"
    And lista as pistas que sustentavam a conclusão

  Scenario: Palpite certo sem sustentação
    Given o detetive não coletou as pistas de sustentação
    When ele acusa o culpado correto
    Then o veredito é "sem sustentação"
    And o caso não é dado por resolvido

  Scenario: Uma acusação por caso
    Given o detetive já acusou
    When ele tenta acusar de novo
    Then a tentativa é recusada
```

---

## 5. Functional Requirements

| ID | Description | Source | Priority (MoSCoW) |
|---|---|---|---|
| REQ-01 | O sistema deve mostrar no mapa a posição do jogador e as pistas desbloqueadas e não coletadas, com a distância até cada uma | US-01 | Must |
| REQ-02 | O sistema deve permitir coletar uma pista somente quando a posição estiver dentro do raio da âncora, **revalidando no servidor** | US-02, UC-01 | Must |
| REQ-03 | O sistema deve bloquear pistas cujos pré-requisitos (`requires`) não tenham sido coletados, e desbloqueá-las quando forem | UC-01 | Must |
| REQ-04 | O sistema deve desenhar o vestígio sobre a câmera na direção real da âncora, calculada por rumo e distância | US-03 | Must |
| REQ-05 | O sistema deve manter um caderno com as pistas coletadas e o que cada uma destravou | US-06 | Must |
| REQ-06 | O sistema deve permitir conversa livre em texto com os personagens desbloqueados, com resposta em streaming | US-04 | Must |
| REQ-07 | O personagem deve fundamentar toda afirmação factual em uma página de lore, via ferramenta `consultar_lore`, e recusar-se a afirmar o que não tem fundamento | US-05, JS-01 | Must |
| REQ-08 | O personagem deve poder consultar o caderno do detetive (`verificar_caderno`) para decidir o quanto revelar | US-04 | Should |
| REQ-09 | O personagem deve poder conceder uma pista em conversa (`revelar_pista`) quando as condições declaradas no módulo forem atendidas | UC-01 Alt-02 | Should |
| REQ-10 | O sistema deve aceitar **uma** acusação por caso e julgá-la contra a solução declarada, exigindo que as pistas de sustentação tenham sido coletadas | US-07 | Must |
| REQ-11 | O sistema deve conversar com qualquer provider compatível com a API da OpenAI, configurável por personagem (`baseUrl`, `model`, chave) | US-09, US-10 | Must |
| REQ-12 | O sistema deve resolver o provider em cascata personagem → módulo → servidor | US-09 | Must |
| REQ-13 | O sistema deve cifrar a chave do provider em repouso e nunca devolvê-la ao cliente, expondo no máximo os 4 últimos caracteres | US-10 | Must |
| REQ-14 | O sistema deve validar um bundle de módulo (caso, agentes, skills, lore) por comando, apontando o erro e onde ele está | US-08, JS-03 | Must |
| REQ-15 | As skills de personagem devem usar o formato de `.specs/config.md## Skill Format` e ser carregadas sob demanda (só a `description` no prompt até serem acionadas) | US-09 | Should |
| REQ-16 | O sistema deve oferecer um playtest que percorre o caso com posições simuladas e detecta pista inalcançável ou caso insolúvel | US-11 | Must |
| REQ-17 | O sistema deve entregar um caso bíblico piloto jogável de ponta a ponta | US-01..US-07 | Must |
| REQ-18 | O sistema deve limitar os turnos de uma conversa conforme `.specs/config.md## Game Constants` | JS-01 | Should |
| REQ-19 | As âncoras de um módulo devem ser relativas a uma origem configurável, para o caso ser jogável em qualquer cidade | US-12 | Should |
| REQ-20 | O validador deve rodar o lint de lore de `lore/WIKI_SCHEMA.md## Lint`, tratando `spoiler-exposed` como erro | US-08, US-05 | Must |

---

## 6. Non-Functional Requirements

| ID | Category | Description | Measurement |
|---|---|---|---|
| NFR-01 | Privacidade | A localização do jogador é usada para validar coleta e descartada; não se guarda trajeto | Nenhuma tabela armazena posição fora do evento de coleta |
| NFR-02 | Segurança | Chave de provider cifrada com AES-256-GCM; chave-mestra fora do banco e do git | Nenhuma resposta de API contém a chave; teste prova o mascaramento |
| NFR-03 | Custo | Uma conversa não pode custar sem teto | Turnos limitados; prompt do NPC pede respostas curtas |
| NFR-04 | Testabilidade | Nenhum teste chama LLM real nem a rede | Suíte roda offline; provider falso em memória |
| NFR-05 | Qualidade | Cobertura ≥ o limiar de `.specs/config.md## Defaults` | `npm run test:coverage` |
| NFR-06 | Robustez | Oscilação de GPS não deve tirar o jogador de uma pista já alcançada | Raio ≥ 10 m; coleta idempotente |
| NFR-07 | Acessibilidade | A AR não pode ser o único caminho: a pista deve poder ser lida em texto | Tela de investigação tem modo textual equivalente |
| NFR-08 | Portabilidade | Trocar de provider de LLM não exige mudar código de jogo | Só `baseUrl`/`model` mudam no YAML |

---

## 7. Constraints

| ID | Constraint | Type | Impact |
|---|---|---|---|
| C-01 | GPS de celular erra 5–10 m em céu aberto e mais entre prédios | Technical | O raio mínimo não pode ser pequeno; a precisão fina fica impossível |
| C-02 | AR sem ARCore/ARKit no MVP (ADR-005) | Technical | Vestígio flutua, não gruda em superfície |
| C-03 | Nenhum código de usuário executa no servidor (ADR-009) | Technical | Comportamento novo exige mudar o schema, não escrever script |
| C-04 | Um desenvolvedor, tempo parcial | Timeline | Escopo do MVP tem que caber num caso só |
| C-05 | Ambiente de CI não tem GPS, câmera nem LLM | Technical | Toda verificação depende de simulação e provider falso |

---

## 8. Assumptions

| ID | Assumption | Validation Needed? | Risk if Wrong |
|---|---|---|---|
| A-01 | O jogador aceita se deslocar de verdade para jogar | Sim — playtest de campo | O jogo vira um app de leitura; o mapa perde a função |
| A-02 | Um raio de 25 m absorve o erro típico de GPS sem tornar a pista trivial | Sim — playtest de campo | Frustração (raio curto) ou pista sem esforço (raio longo) |
| A-03 | Modelos de porte médio conseguem manter personagem e respeitar as ferramentas | Sim — teste com modelo local e com modelo hospedado | Personagens quebram o papel ou ignoram a lore |
| A-04 | Autores de módulo aceitam escrever YAML e Markdown | Não no MVP | Precisará de um editor visual antes do previsto |
| A-05 | A lore em Markdown basta como base de conhecimento sem banco vetorial | Sim — medir a qualidade da busca no caso piloto | RAG raso; o NPC não acha o que sabe |

---

## 9. Out of Scope

Explicitamente **fora** do MVP (não é "não vai existir" — é "não agora"):

- Multiplayer, cooperação ou competição entre detetives
- Marketplace / loja de módulos, avaliação e moderação de conteúdo da comunidade
- Servidores MCP externos declarados pelo módulo (o desenho já cabe em `agent.yaml`)
- Detecção de plano (ARCore/ARKit), oclusão, objetos 3D elaborados
- Voz: TTS para os personagens e STT para o detetive
- Editor visual de módulos
- Modo offline completo

### Cortes registrados depois da primeira entrega (2026-08-17)

A revisão de alinhamento da entrega 1 expôs decisões que foram tomadas nas specs mas nunca
voltaram para cá. Registrar é o ponto: um corte que só existe na cabeça de quem cortou reaparece
como "requisito não atendido" seis meses depois.

- **REQ-06 — streaming da resposta do personagem.** A conversa funciona; a fala chega inteira em
  vez de aparecer palavra a palavra. SSE foi cortado em `CHG-004` por não haver, na época, app
  para consumi-lo. **Aceito como parcial**; entra quando a presença do personagem for o gargalo.
- **REQ-19 — exposição da origem configurável na interface.** O mecanismo está entregue e testado
  no motor e na API (dá para abrir partida em qualquer cidade via `POST /sessions`), mas o app
  ainda não oferece a escolha ao jogador. **Aceito como parcial** por ser `Should`.

E dois que **não** são cortes, e sim dívida com prazo — ambos fechados na entrega 2:

- **REQ-13 — chave cifrada em repouso.** A cifra AES-256-GCM e o mascaramento existem e são
  testados, mas nada guarda a chave de ninguém, porque não havia conta de jogador. Fecha em
  `CHG-008`.
- **REQ-04 — vestígio sobre a câmera.** O cálculo de rumo está correto e testado, mas o fundo da
  tela de AR é um retângulo neutro em vez da imagem da câmera. Fecha em `CHG-009`.

> A persistência em Postgres saiu desta lista: era "fora de escopo" no MVP e passou a ser a
> entrega 2 (`CHG-007`).

---

## 10. MoSCoW Prioritization

| Priority | Requirements | Rationale |
|---|---|---|
| **Must have** | REQ-01, REQ-02, REQ-03, REQ-04, REQ-05, REQ-06, REQ-07, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-16, REQ-17, REQ-20 | Sem qualquer um destes não existe "um caso jogável, justo e criável" |
| **Should have** | REQ-08, REQ-09, REQ-15, REQ-18, REQ-19 | Elevam muito a experiência e a criação, mas o caso fecha sem eles |
| **Could have** | — | — |
| **Won't have (now)** | Seção 9 | Escopo de um dev, tempo parcial |

---

## 11. Dependencies

| Dependency | Type | Status | Impact if Unavailable |
|---|---|---|---|
| Endpoint OpenAI-compatible (qualquer) | Third-party | Available | Sem NPCs vivos; o resto do jogo funciona |
| OpenStreetMap (tiles) | Third-party | Available | Mapa sem fundo; pistas ainda navegáveis por distância/rumo |
| Metodologia `starter-kit` 1.2.0 | Internal | Available | Perde-se o gate de consistência e os templates |
| Metodologia LLM-Wiki do vault `knowledge` | Internal | Available | Perde-se o schema de lore que sustenta a FAITHFULNESS |

---

## 12. Domain Glossary

| Term | Definition | Context |
|---|---|---|
| `caso` | Um mistério completo: pistas, personagens, solução | Unidade de conteúdo |
| `módulo` | O bundle de arquivos que descreve um caso | `modules/<slug>/` |
| `pista` | Vestígio coletável, com âncora e pré-requisitos | `case.yaml` |
| `âncora` | Coordenada + raio onde a pista existe no mundo | `case.yaml` |
| `geofence` | Verificação de que a posição está dentro do raio | `packages/engine` |
| `caderno` | Conjunto de pistas coletadas na partida | Estado da partida |
| `acusação` | A dedução final do detetive, julgada uma única vez | `packages/engine` |
| `sustentação` | As pistas que precisam estar no caderno para a acusação valer | `case.yaml` |
| `lore` | Wiki que constitui o conhecimento dos personagens | `lore/`, `modules/*/lore/` |
| `FAITHFULNESS` | Regra de que o NPC só afirma o que a lore fundamenta | `lore/WIKI_SCHEMA.md` |
| `spoiler` | Página com a verdade do caso, invisível ao agente | Frontmatter da lore |
| `provider` | Endpoint OpenAI-compatible que serve um personagem | `agent.yaml` |
| `BYOK` | *Bring Your Own Key* — o jogador usa a própria chave | ADR-007 |

---

## 13. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| O NPC inventa uma pista e o caso fica insolúvel | High | High | FAITHFULNESS em três camadas: prompt, `consultar_lore` restrito, spoiler fora do contexto (REQ-07, REQ-20) |
| Erro de GPS frustra o jogador na pista | High | Med | Raio configurável ≥ 10 m, coleta idempotente, feedback de distância (NFR-06, REQ-01) |
| Custo de token dispara com conversa livre | Med | High | BYOK, teto de turnos, respostas curtas (REQ-11, REQ-18) |
| Conteúdo bíblico incorreto ofende o público | Med | High | `canon: biblico` exige `source`; lint barra afirmação sem fonte (REQ-20) |
| Chave de API do jogador vaza | Low | High | Cifra em repouso, tráfego só pelo servidor, mascaramento no tipo (REQ-13, NFR-02) |
| Escopo cresce e nada fecha | High | High | Seção 9 explícita; um caso piloto só; specs pequenas e sequenciais |
| Módulo do usuário quebra em partida | Med | Med | Validação e playtest determinísticos antes de jogar (REQ-14, REQ-16) |
| Jogador extrai a solução conversando com o NPC | Med | High | A página da solução nunca entra no contexto do agente (REQ-07, REQ-20) |

---

## 14. Traceability Matrix

| REQ ID | Source | Requirement Summary | Priority | Implementation Spec | Test ID |
|---|---|---|---|---|---|
| REQ-01 | US-01 | Mapa com posição e pistas desbloqueadas | Must | changes/005-flutter-client/ | — |
| REQ-02 | US-02, UC-01 | Coleta só dentro do raio, revalidada no servidor | Must | changes/001-case-engine/, changes/004-game-api/ | — |
| REQ-03 | UC-01 | Grafo de pré-requisitos entre pistas | Must | changes/001-case-engine/ | — |
| REQ-04 | US-03 | Vestígio na câmera por rumo e distância | Must | changes/005-flutter-client/ | — |
| REQ-05 | US-06 | Caderno do detetive | Must | changes/001-case-engine/, changes/005-flutter-client/ | — |
| REQ-06 | US-04 | Conversa livre com streaming | Must | changes/003-agent-runtime/, changes/004-game-api/ | — |
| REQ-07 | US-05, JS-01 | FAITHFULNESS via `consultar_lore` | Must | changes/003-agent-runtime/ | — |
| REQ-08 | US-04 | `verificar_caderno` | Should | changes/003-agent-runtime/ | — |
| REQ-09 | UC-01 Alt-02 | `revelar_pista` | Should | changes/003-agent-runtime/ | — |
| REQ-10 | US-07 | Acusação única, julgada com sustentação | Must | changes/001-case-engine/ | — |
| REQ-11 | US-09, US-10 | Provider OpenAI-compatible por personagem | Must | changes/003-agent-runtime/ | — |
| REQ-12 | US-09 | Cascata personagem → módulo → servidor | Must | changes/003-agent-runtime/ | — |
| REQ-13 | US-10 | Chave cifrada e mascarada | Must | changes/003-agent-runtime/ | — |
| REQ-14 | US-08, JS-03 | Validação do bundle de módulo | Must | changes/002-module-schema/ | — |
| REQ-15 | US-09 | Skills de personagem no formato do kit | Should | changes/002-module-schema/, changes/003-agent-runtime/ | — |
| REQ-16 | US-11 | Playtest com posições simuladas | Must | changes/001-case-engine/ | — |
| REQ-17 | US-01..07 | Caso bíblico piloto jogável | Must | changes/006-caso-poco-de-jaco/ | — |
| REQ-18 | JS-01 | Teto de turnos por conversa | Should | changes/003-agent-runtime/ | — |
| REQ-19 | US-12 | Âncoras relativas a origem configurável | Should | changes/001-case-engine/ | — |
| REQ-20 | US-08, US-05 | Lint de lore com `spoiler-exposed` como erro | Must | changes/002-module-schema/ | — |

---

## 15. Appendix

### Research & References

- `lucassnts963/knowledge → wiki/caca-ao-tesouro-biblico.md` — 16 pistas bíblicas de 2023,
  origem do caso piloto (o Poço de Jacó, João 4)
- `lucassnts963/knowledge → WIKI_SCHEMA.md` — a metodologia LLM-Wiki de onde vem a FAITHFULNESS
- `lucassnts963/starter-kit → METHODOLOGY.md` — o modelo de consistência em duas camadas
  (script para o estrutural, LLM para o semântico) que este projeto espelha na lore

### Open Questions

- [ ] O raio de 25 m se confirma em campo, ou precisa variar por tipo de lugar (rua aberta × praça)?
- [ ] Modelos pequenos e locais (7–8B) seguram o papel e as ferramentas, ou o piso é mais alto?
- [ ] Markdown + busca textual bastam como RAG, ou o caso piloto já pede embeddings?
- [ ] Como um autor publica um módulo para outros jogadores sem um marketplace?

---

## Validation Checklist

- [x] All stakeholders identified
- [x] Methodology chosen and section(s) filled
- [x] Functional requirements documented with sources
- [x] Non-functional requirements defined with measurements
- [x] Constraints and assumptions listed
- [x] MoSCoW prioritization complete
- [x] Dependencies identified
- [x] Risks assessed with mitigations
- [x] Out of scope explicitly defined
- [x] Traceability matrix populated
- [x] Stakeholders reviewed and approved
