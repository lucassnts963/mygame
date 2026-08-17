# Spec: Módulo piloto "O Cântaro Abandonado"

| Field | Value |
|---|---|
| **ID** | CHG-006 |
| **Status** | implemented |
| **Author** | Lucas de Oliveira Santos |
| **Created** | 2026-08-16 |
| **Approved** | 2026-08-16 |

> **Spec escrita retroativamente.** O módulo foi implementado e commitado citando `CHG-006`, mas
> a spec não chegou a ser escrita — um id pendurado. Este documento registra o que foi feito e
> por quê, para o histórico ficar coerente. É exatamente o furo que o `check-consistency`
> existiria para pegar no archive; melhor fechá-lo agora do que carregá-lo.

## Context

Todas as peças do jogo existiam — motor, contrato de módulo, agentes, API — mas nenhuma delas
provava a tese. A tese é: **um caso jogável de verdade cabe em YAML e Markdown, sem uma linha de
código.** Sem um módulo real, o contrato de CHG-002 seria só um schema bonito.

Havia ainda uma semente pronta: `knowledge/wiki/caca-ao-tesouro-biblico.md`, de 2023, com 16
pistas bíblicas — entre elas o Poço de Jacó (João 4).

## Scope

- `modules/poco-de-jaco/` completo: `case.yaml`, 2 agentes, 1 skill, 6 páginas de lore
- Testes de regressão que impedem o módulo de apodrecer calado

### Out of Scope

- Coordenadas reais calibradas em campo — as âncoras são plausíveis, não medidas
- Um segundo caso

## Requirements

### Functional

- [x] REQ-17: um caso bíblico piloto, jogável de ponta a ponta

### Technical

| Layer | File / Component | Change Description |
|---|---|---|
| Content | `modules/poco-de-jaco/case.yaml` | 4 pistas, 2 personagens, solução |
| Content | `modules/poco-de-jaco/agents/*.agent.yaml` | Samaritana (provider próprio) e discípulo (herda) |
| Content | `modules/poco-de-jaco/skills/guardar-segredo/SKILL.md` | Comportamento de revelação |
| Content | `modules/poco-de-jaco/lore/wiki/**` | 6 páginas, 5 navegáveis + 1 spoiler |
| Test | `packages/module-schema/test/pilot-module.test.ts` | Regressão sobre o conteúdo |

## Design

### O mistério não reescreve a passagem

João 4 é o pano de fundo; o que se investiga é uma **lacuna que o próprio texto deixa**: por que
a mulher deixou o cântaro (João 4:28). Toda página é `canon: biblico` com a referência do
versículo, e o que o caso acrescenta é **postura** (a reticência dela ao ser interrogada), nunca
fato. É a diferença entre ambientar num texto sagrado e adulterá-lo.

### O desenho das quatro pistas

| Pista | Onde | Por que existe |
|---|---|---|
| `pista-cantaro` | Mapa | O vestígio central: quem enche um cântaro e o abandona cheio foi interrompido |
| `pista-hora-errada` | Mapa | O meio-dia diz que ela evitava companhia |
| `pista-pegadas` | Mapa | O sentido do movimento: ela correu **para** a cidade, não para longe |
| `pista-confissao` | **Sem âncora** | Só sai da boca dela, e só com as outras três no caderno |

A quarta é o que separa este jogo de uma caça ao tesouro: a última peça não está no chão.

### A sustentação exigida

`supporting_clues: [pista-cantaro, pista-confissao]`. Com dois personagens, acertar "foi ela" no
palpite tem 50% de chance. O caso cobra **o vestígio** e **a razão** — sem as duas, o veredito é
`unsupported`.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Conteúdo bíblico incorreto ofende o jogador | Med | High | `canon: biblico` com `source`; o lint reprova afirmação sem fonte |
| O módulo quebra em silêncio ao evoluir o schema | High | High | Testes de regressão sobre o conteúdo real, rodando na CI |
| As coordenadas não fazem sentido em campo | High | Med | `origin` configurável (REQ-19); calibração fica para playtest de rua |

## Dependencies

- CHG-001 (motor), CHG-002 (contrato), CHG-003 (agentes)

## Requirements Traceability

**Requirements:** [`requirements/001-vestigio-mvp/requirements.md`](../../requirements/001-vestigio-mvp/requirements.md)

| REQ ID | Requirement Summary | Priority | Acceptance Criteria |
|---|---|---|---|
| REQ-17 | Caso bíblico piloto jogável | Must | `validate-module` sem erro nem aviso e `playtest` em `solved` |

## Tests

| ID | Test | Type | Description |
|---|---|---|---|
| TEST-01 | O módulo valida sem erro | integration | REQ-17 |
| TEST-02 | O módulo valida sem nem aviso | integration | É o exemplo que autores vão copiar |
| TEST-03 | O playtest fecha em `solved` | integration | REQ-17 |
| TEST-04 | Três pistas têm âncora no mapa | integration | Exige deslocamento real |
| TEST-05 | A quarta pista não tem âncora | integration | Só sai em conversa |
| TEST-06 | A verdade é spoiler e nenhum agente a alcança | integration | ADR-006 |
| TEST-07 | Nenhum agente carrega chave literal | integration | ADR-008 |
| TEST-08 | A solução exige ≥2 pistas de sustentação | integration | REQ-10 |

### Test Files

| File | What It Covers |
|---|---|
| `packages/module-schema/test/pilot-module.test.ts` | TEST-01..08 |

---

## Validation Checklist

- [x] Tests written (regressão sobre o conteúdo)
- [x] All tests passing
- [x] `npm run validate-module` sem erro nem aviso
- [x] `npm run playtest` fecha o caso
- [x] Requirements met — REQ-17

## Notes

Escrita depois da implementação, e isso é uma exceção declarada, não o padrão: a metodologia
manda spec antes de código (Key Rule 1). O que aconteceu é que o conteúdo foi tratado como
subproduto das specs anteriores em vez de mudança própria. Conteúdo **é** mudança — tem risco,
tem requisito e apodrece.
