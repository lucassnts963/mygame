# Requirements Specification — Casos da cidade e patrocínio local

| Field | Value |
|---|---|
| **ID** | REQ-010 |
| **Status** | draft |
| **Author** | Lucas de Oliveira Santos |
| **Created** | 2026-08-17 |
| **Stakeholders** | Lucas (autor/produto), jogador-detetive, comerciante de Barcarena, poder público municipal, morador ou família retratada num caso |

> **Por que `010` e não `002`.** O `check-consistency` pareia requisitos e specs **pelo mesmo
> número**, então `requirements/002-*` colidiria com `changes/002-module-schema` e faria o checker
> exigir que os `REQ` daquela spec existissem aqui. Requisitos e mudanças compartilham um único
> espaço de numeração; como as specs já vão até `009`, o próximo número livre é `010`.

> **Estágio: elicitação.** Isto registra uma ideia, não uma decisão. Nenhum comerciante foi
> consultado, nenhum modelo de negócio foi escolhido, nenhum número de Barcarena foi apurado em
> campo. A pesquisa que sustenta o documento está em
> [`pesquisa-mercado.md`](pesquisa-mercado.md). As perguntas em aberto da seção 15 são o trabalho
> real que falta — e são conversa, não pesquisa.

---

## 1. Problem Statement

### Current Situation

O Vestígio tem um caso jogável, bíblico, e nenhuma fonte de receita. Duas lacunas se cruzam:

- **Conteúdo:** o caso piloto se passa em João 4. É bonito e prova o motor, mas não dá razão para
  alguém de Barcarena andar pela própria cidade. A âncora fica onde o autor escolheu, sem relação
  com o lugar.
- **Receita:** o custo de token dos personagens-agentes é real e recorrente. Hoje quem paga é quem
  hospeda, e isso não escala nem por um mês de uso sério.

A ideia registrada aqui resolve as duas de uma vez: **mistérios da história de Barcarena, com
pistas em estabelecimentos da cidade que patrocinam a presença**.

### Why This Matters

- Um caso de história local dá ao morador uma razão que o caso bíblico não dá: **descobrir a
  própria cidade**. Barcarena tem matéria-prima — a Igreja de São João Batista do século XVII, a
  Cabanagem, a Vila do Conde, o porto.
- O comerciante ganha algo mensurável (fluxo de pé na porta) e o jogo ganha o que não tem
  (dinheiro para o token e para o conteúdo).
- Sem receita, o projeto depende do bolso do autor e morre quando o bolso cansar.

### Success Definition

| Metric | Current | Target |
|---|---|---|
| Casos de história local jogáveis | 0 | 1 (Barcarena) |
| Estabelecimentos com pista patrocinada | 0 | a definir com o modelo escolhido |
| Receita recorrente mensal | R$ 0 | cobre o custo de token do mês |
| Afirmações históricas com fonte citada | — | 100% |
| Estabelecimento real acusado como culpado | — | **0, sempre** |

---

## 2. Stakeholder Map

| Stakeholder | Interesse | Influência | Preocupação central |
|---|---|---|---|
| Lucas | Receita que sustente o projeto | High | Vender de porta em porta consome o tempo que deveria ir para o produto |
| Jogador-detetive | Um mistério bom, na cidade dele | High | Perceber que a pista está ali porque alguém pagou, e não porque a história pede |
| Comerciante | Gente entrando na loja | High | Pagar por fluxo que não vem; não ter como conferir o que foi entregue |
| Poder público (Turismo/Cultura) | Cidade valorizada, patrimônio visitado | Med | Associar a prefeitura a conteúdo histórico impreciso |
| Morador ou família retratada | Não ser difamado | **High** | Ter um antepassado — ou o próprio negócio — apontado como criminoso num jogo |

> O último stakeholder **não existia** nos requisitos 001. Casos bíblicos acusam personagens de
> dois mil anos atrás; casos de história local acusam gente cujos descendentes moram na rua de
> baixo. É a diferença que gera o `REQ-23`.

---

## 3. Methodology

Híbrida: **User Stories** para o recorte de produto, **Job Stories** para as situações do
comerciante, e **BDD** para as regras que virarão validação.

---

## 4. Requirements

### 4.1 User Stories

| ID | Story | Acceptance Criteria |
|---|---|---|
| US-20 | Como morador de Barcarena, quero um mistério sobre a história da minha cidade, para redescobrir lugares por onde passo sem olhar | 1. As pistas ficam em lugares reais de Barcarena 2. Cada afirmação histórica cita a fonte |
| US-21 | Como autor, quero que um estabelecimento patrocine uma pista, para o caso se pagar | 1. O patrocínio é declarado no módulo 2. Aparece ao jogador de forma honesta, não disfarçada |
| US-22 | Como comerciante, quero saber quantas pessoas o jogo trouxe até minha porta, para julgar se vale continuar | 1. Recebo uma contagem de visitas 2. Não recebo dado de nenhum jogador identificado |
| US-23 | Como jogador, quero que a pista esteja ali porque a história pede, e não porque alguém pagou | 1. Um patrocinador nunca é o culpado 2. O caso continua solúvel se o patrocínio acabar |
| US-24 | Como dono de um imóvel citado num caso, quero ter consentido antes de virar ponto de visitação | 1. Toda âncora em propriedade privada tem consentimento registrado |
| US-25 | Como descendente de alguém retratado, quero que o jogo não invente crime de gente real | 1. Culpado de caso histórico é ficcional ou já julgado pela história com fonte |

### 4.2 Job Stories

| ID | Story |
|---|---|
| JS-20 | Quando eu for procurar um comerciante, quero mostrar quantos jogadores já existem na cidade, para não estar vendendo promessa |
| JS-21 | Quando o patrocínio de uma pista vencer, quero que o caso continue jogável, para não quebrar a partida de quem está no meio |
| JS-22 | Quando alguém tentar falsificar a posição, quero que a visita não seja contada, para não cobrar o comerciante por fraude |

### 4.3 BDD Scenarios

```gherkin
Feature: Integridade do caso patrocinado

  Scenario: Patrocinador não pode ser o culpado
    Given a pista "pista-balcao" é patrocinada pela "Padaria Central"
    When o módulo declara "padaria-central" como culpado da solução
    Then a validação do módulo é REPROVADA com erro

  Scenario: O caso sobrevive ao fim do patrocínio
    Given uma pista patrocinada com vigência encerrada
    When um jogador abre o caso
    Then a pista continua existindo e coletável
    And a marca do patrocinador não aparece mais

  Scenario: Âncora em propriedade privada exige consentimento
    Given uma pista ancorada num endereço marcado como privado
    When o módulo não registra o consentimento do proprietário
    Then a validação do módulo é REPROVADA com erro

Feature: Contagem de visitas sem rastrear ninguém

  Scenario: O patrocinador recebe número, não pessoas
    Given três jogadores coletaram a pista patrocinada
    When o patrocinador consulta seu relatório
    Then ele vê a contagem de visitas
    And nenhuma resposta contém identificador de jogador nem coordenada

  Scenario: Posição falsificada não conta como visita
    Given uma coleta com sinais de localização falsificada
    When a visita é contabilizada
    Then ela não entra na contagem cobrável do patrocinador
```

---

## 5. Functional Requirements

Numeração continua de onde `requirements/001` parou (`REQ-20`).

| ID | Description | Source | Priority |
|---|---|---|---|
| REQ-21 | O sistema deve suportar casos com `canon: historico`, exigindo `source` em toda afirmação de fato | US-20 | Must |
| REQ-22 | Uma pista deve poder declarar um `sponsor`, com nome, vigência e registro de consentimento | US-21 | Must |
| REQ-23 | **Um `sponsor` nunca pode ser o `culprit` da solução** — erro de validação, não aviso | US-23, US-25 | Must |
| REQ-24 | O caso deve continuar jogável e solúvel quando um patrocínio expira; só a marca some | JS-21 | Must |
| REQ-25 | O sistema deve contar visitas **por pista, de forma agregada**, sem identificar jogador nem guardar coordenada | US-22 | Must |
| REQ-26 | Uma âncora em propriedade privada deve exigir consentimento registrado do proprietário | US-24 | Must |
| REQ-27 | O sistema deve detectar sinais de localização falsificada e excluir essas coletas da contagem cobrável | JS-22 | Should |
| REQ-28 | O patrocínio deve ser visível ao jogador como patrocínio, sem se disfarçar de conteúdo | US-21, US-23 | Must |
| REQ-29 | O sistema deve oferecer ao patrocinador um relatório com a contagem do período | US-22, JS-20 | Should |
| REQ-30 | O culpado de um caso histórico deve ser ficcional, ou pessoa real cujo ato já é documentado com fonte | US-25 | Must |

---

## 6. Non-Functional Requirements

| ID | Category | Description | Measurement |
|---|---|---|---|
| NFR-20 | Privacidade | A contagem de visitas **não pode** criar tabela de posição, trajeto ou histórico por jogador | O teste de `information_schema` do `CHG-007` continua passando |
| NFR-21 | Legal (LGPD) | Finalidade do uso de localização declarada, específica e informada; direito de exclusão atendido | Política de privacidade no app; base legal escolhida e registrada |
| NFR-22 | Legal (imagem) | Nenhum estabelecimento ou pessoa real é apresentado como autor de crime sem fonte histórica | `REQ-23` e `REQ-30` como regra de validador |
| NFR-23 | Integridade editorial | O patrocínio não decide quem é culpado nem altera a solução | `REQ-23`; revisão humana do caso |
| NFR-24 | Confiança comercial | A contagem entregue ao patrocinador precisa ser defensável | `REQ-27`; método de contagem documentado e explicado a ele |

---

## 7. Constraints

| ID | Constraint | Type |
|---|---|---|
| C-20 | Um desenvolvedor, tempo parcial, sem equipe comercial | Timeline |
| C-21 | Barcarena tem ~126 mil habitantes: a base de jogadores é finita e local | Market |
| C-22 | A LGPD trata localização como dado que exige finalidade específica e informada | Regulatory |
| C-23 | O schema atual **não tem** onde guardar posição, por decisão de projeto (`NFR-01`) | Technical |
| C-24 | Contagem de visita confiável exige defesa contra GPS falsificado, que é cara | Technical |

---

## 8. Assumptions

| ID | Assumption | Validar? | Risco se errada |
|---|---|---|---|
| A-20 | Comerciante de Barcarena paga por fluxo de pedestre | **Sim — conversar com 5** | O modelo inteiro cai |
| A-21 | Morador de Barcarena quer jogar sobre a própria cidade | **Sim — playtest** | Falta o público que sustenta o patrocínio |
| A-22 | Há fonte histórica suficiente e acessível sobre Barcarena | **Sim — arquivo, IPHAN, blogs locais** | O caso vira ficção com verniz histórico |
| A-23 | A Secretaria de Turismo/Cultura tem linha para apoiar isso | **Sim — protocolar** | Sobra só o caminho comerciante-a-comerciante |
| A-24 | Um caso é conteúdo suficiente para justificar patrocínio | Sim | Precisa de catálogo antes de vender qualquer cota |

---

## 9. Out of Scope

- Pagamento dentro do app (assinatura, compra de caso) — outra elicitação
- Painel web para o patrocinador se autoatender
- Repartição de receita com criadores de módulo (o modelo Questo) — registrado na pesquisa, não requisitado aqui
- Publicidade programática, banner ou qualquer anúncio que não seja a pista em si
- Venda de dado de jogador, em qualquer forma, para qualquer um

---

## 10. MoSCoW

| Priority | Requirements | Rationale |
|---|---|---|
| **Must** | REQ-21, 22, 23, 24, 25, 26, 28, 30 | Sem estes, ou o caso não é histórico, ou o patrocínio corrompe o mistério, ou há risco jurídico |
| **Should** | REQ-27, REQ-29 | Necessários quando a visita virar dinheiro; não antes |
| **Won't (now)** | Seção 9 | Um dev, tempo parcial |

---

## 12. Domain Glossary

| Termo | Definição |
|---|---|
| `patrocinador` (`sponsor`) | Estabelecimento que consente em hospedar uma pista e, conforme o modelo, paga por isso |
| `visita cobrável` | Coleta de pista patrocinada que passou nas verificações de autenticidade |
| `consentimento de âncora` | Registro de que o dono do lugar autorizou a pista ali |
| `caso histórico` | Caso com `canon: historico`: toda afirmação de fato carrega fonte |

---

## 13. Risks & Mitigations

| Risk | Prob. | Impacto | Mitigação |
|---|---|---|---|
| Estabelecimento real acusado de crime gera dano à imagem | Med | **Alto** | `REQ-23` e `REQ-30` como erro de validação, não recomendação |
| Ovo e galinha: comerciante não compra fluxo inexistente | **Alta** | Alto | Ver os três modelos na pesquisa; o institucional existe para furar este bloqueio |
| A contagem para o patrocinador corrói o `NFR-01` | Med | Alto | `REQ-25`: contador por pista, nunca por jogador |
| GPS falsificado vira fraude lucrativa | Med | Alto | `REQ-27`, e só quando houver dinheiro na visita |
| Jogador percebe o caso torcido para servir patrocinador | Med | Alto | `REQ-23`, `REQ-24`, `REQ-28`: patrocínio visível, nunca decisivo |
| Jogadores incomodando propriedade privada | Med | Alto | `REQ-26`; a Niantic pagou US$ 4 mi por não ter isso |
| Fonte histórica frágil vira ficção com verniz | Med | Med | `REQ-21`; a lore já exige `source` para `canon: historico` |
| Tempo de venda porta a porta consome o tempo de produto | **Alta** | Med | A-20 e A-23 antes de qualquer código |

---

## 14. Traceability Matrix

| REQ | Origem | Resumo | Prioridade | Spec |
|---|---|---|---|---|
| REQ-21 | US-20 | Caso `canon: historico` com fonte | Must | — |
| REQ-22 | US-21 | `sponsor` por pista | Must | — |
| REQ-23 | US-23, US-25 | Patrocinador nunca é culpado | Must | — |
| REQ-24 | JS-21 | Caso sobrevive ao fim do patrocínio | Must | — |
| REQ-25 | US-22 | Contagem agregada, sem rastrear | Must | — |
| REQ-26 | US-24 | Consentimento de âncora privada | Must | — |
| REQ-27 | JS-22 | Detecção de posição falsificada | Should | — |
| REQ-28 | US-21, US-23 | Patrocínio visível como patrocínio | Must | — |
| REQ-29 | US-22, JS-20 | Relatório do patrocinador | Should | — |
| REQ-30 | US-25 | Culpado histórico com fonte ou ficcional | Must | — |

Nenhuma spec ainda: a ideia não foi validada. Spec antes de validação seria construir sobre A-20.

---

## 15. Perguntas em aberto

Estas não se respondem pesquisando. São conversa, e são o próximo passo real:

- [ ] **Cinco comerciantes de Barcarena**: pagariam por fluxo de pedestre? Quanto? Como conferem hoje se uma ação de marketing funcionou?
- [ ] **Secretaria de Turismo/Cultura de Barcarena**: existe linha, edital ou interesse em patrimônio gamificado?
- [ ] **Fonte histórica**: o que existe de documentação acessível sobre a Cabanagem em Barcarena e sobre a Igreja de São João Batista? Há arquivo municipal? Historiador local?
- [ ] **IPHAN / patrimônio tombado**: colocar ponto de visitação em bem tombado exige alguma anuência?
- [ ] **O jogador local existe?** Quantos moradores topariam caminhar 2 km resolvendo um mistério da própria cidade?
- [ ] **Quem escreve os casos?** Se cada cidade precisa de um caso pesquisado, o gargalo é autoria — e aí a pergunta vira se o modelo de criadores da Questo não é a resposta.

---

## Validation Checklist

- [x] Stakeholders identificados — incluindo o que faltava (morador retratado)
- [x] Metodologia escolhida
- [x] Requisitos funcionais com origem
- [x] Não-funcionais com forma de medir
- [x] Restrições e premissas listadas
- [x] MoSCoW
- [x] Riscos com mitigação
- [x] Fora de escopo explícito
- [x] Matriz de rastreabilidade
- [ ] **Premissas validadas com gente de verdade** — é o que falta, e é o que importa
- [ ] Aprovado pelo stakeholder
