# Spec: A pista chega ao jogador (câmera + conteúdo)

| Field | Value |
|---|---|
| **ID** | CHG-009 |
| **Status** | approved |
| **Author** | Lucas de Oliveira Santos |
| **Created** | 2026-08-17 |
| **Approved** | 2026-08-17 |

## Context

O jogo funciona de ponta a ponta — mapa, geofence, conversa, caderno, acusação — e mesmo assim
não é jogável, por duas razões que se somam.

**A primeira: o texto das pistas nunca chega à tela.** Cada pista do `case.yaml` tem uma
`description`, e ela *é* o conteúdo do jogo:

> "Um cântaro de barro, cheio, largado na borda do poço. Quem enche um cântaro e o abandona cheio
> não desistiu da água por acaso — foi interrompido por algo maior que a sede."

O schema aceita esse campo, o loader o lê — e `toCaseDefinition` o **descarta**, porque
`ClueDefinition` nunca teve onde guardá-lo. O jogador caminha até o lugar, investiga, e recebe um
título de quatro palavras. Toda a escrita do caso está no repositório e invisível.

**A segunda: a AR não é sobre a câmera.** `investigate_screen.dart` desenha o vestígio sobre um
retângulo preto. O cálculo de rumo está certo e testado; falta a imagem. É a lacuna `REQ-04` que
a revisão de alinhamento marcou como `Partial` num requisito `Must`.

As duas juntas explicam por que o jogo "funciona" e ainda assim não entrega a experiência: o
jogador chega ao lugar certo e não vê nem o mundo nem o texto.

## Scope

- `description` atravessando motor → módulo → API → app, até a tela
- A descrição no caderno, não só no momento da coleta
- Pré-visualização da câmera ao vivo na investigação (fecha `REQ-04`)
- A sinopse do caso na escolha e no início da partida
- A pista revelada em conversa mostrada por inteiro, não só um aviso

### Out of Scope

- Contas, login e uso da persistência pelo app — adiados a pedido
- Streaming SSE
- Imagens ou modelos 3D nas pistas: o vestígio continua sendo texto

## Requirements

### Functional

- [x] REQ-04: o vestígio é desenhado **sobre a imagem da câmera**, no rumo real da âncora
- [x] REQ-05: o caderno mostra o que cada pista dizia, não apenas o título
- [x] REQ-01: a lista de casos mostra a sinopse

### Non-Functional

- [x] NFR-07: sem permissão de câmera, o modo textual entrega **a mesma** informação
- [x] NFR-05: cobertura ≥ o limiar de `.specs/config.md## Defaults`

### Technical

| Layer | File / Component | Change Description |
|---|---|---|
| Domain | `packages/engine/src/types.ts` | `description?` em `ClueDefinition` e `NotebookEntry` |
| Domain | `packages/engine/src/game-state.ts` | `notebook()` repassa a descrição |
| Contract | `packages/module-schema/src/schemas/index.ts` | `toCaseDefinition` mapeia `description` |
| Service | `server/src/services/game-service.ts` | `view()` inclui `description`; `listModules` já traz `synopsis` |
| UI | `app/lib/core/models.dart` | `description` em `Clue` e `NotebookEntry` |
| UI | `app/lib/features/ar/investigate_screen.dart` | `CameraPreview` + o texto da pista |
| UI | `app/lib/features/notebook/notebook_view.dart` | A descrição por entrada |
| UI | `app/lib/features/chat/chat_screen.dart` | A pista revelada aparece por inteiro |

## Design

### Por que o campo some hoje

`ClueDocument` (o YAML) tem `description`. `ClueDefinition` (o motor) não tem. A conversão entre
os dois é honesta com o que existe — ela só não podia inventar um campo. O motor **precisa** do
texto porque é ele quem monta o caderno; deixar a descrição fora dele obrigaria a API a reabrir o
módulo para buscá-la, criando duas fontes para o mesmo dado.

O texto é dado de domínio, não de apresentação: é o que o detetive descobriu.

### O que aparece, e onde

| Momento | O que o jogador vê |
|---|---|
| Escolhendo o caso | Título + **sinopse** |
| No mapa | Título + distância |
| Investigando (AR) | Câmera ao vivo + marcador no rumo + **a descrição** |
| Investigando (texto) | Rumo em graus e ponto cardeal + **a descrição** |
| No caderno | Título + **a descrição** + o que aquilo destravou |
| Pista revelada em conversa | Título + **a descrição**, num cartão |

A descrição aparece **antes** de anotar, não depois: é lendo o vestígio que o jogador decide que
aquilo importa. Guardar o texto para depois da coleta inverteria a ordem natural — anotar viraria
um clique burocrático em vez de uma decisão.

### A câmera

`CameraController` com a câmera traseira, resolução média (o fundo é cenário, não conteúdo), e
**degradação declarada**: se a permissão for negada ou não houver câmera, a tela cai no modo
textual em vez de mostrar preto. Sem permissão, `NFR-07` deixa de ser acessibilidade e passa a
ser a única forma de jogar — então os dois caminhos entregam o mesmo texto.

A câmera é liberada no `dispose`. Uma câmera esquecida aberta é o tipo de vazamento que só
aparece como bateria drenando, sem erro nenhum.

### Edge Cases

- Sem câmera no aparelho → modo textual, com aviso do porquê
- Permissão negada → modo textual, com aviso do porquê
- Pista sem `description` → a tela mostra só o título, sem espaço vazio
- App em segundo plano com a câmera aberta → controller pausado e retomado

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Câmera não inicializa em algum aparelho | Med | Med | Falha cai no modo textual; nunca em tela preta |
| Descrição longa demais estourar a tela da AR | Med | Low | Cartão com rolagem e altura máxima |
| Não dá para testar a câmera neste ambiente | High | Med | A lógica de decisão (`shouldUseTextMode`) é uma função pura, testada; o widget de câmera fica fino |

## Dependencies

- CHG-001, CHG-002, CHG-004, CHG-005

## Requirements Traceability

**Requirements:** [`requirements/001-vestigio-mvp/requirements.md`](../../requirements/001-vestigio-mvp/requirements.md)

| REQ ID | Requirement Summary | Priority | Acceptance Criteria |
|---|---|---|---|
| REQ-01 | Mapa e escolha de caso | Must | A sinopse aparece na lista de casos |
| REQ-04 | Vestígio sobre a câmera | Must | `CameraPreview` no fundo, marcador no rumo calculado |
| REQ-05 | Caderno | Must | Cada entrada mostra a descrição da pista |

## Tests

> **TDD:** escritos ANTES da implementação.

### Test Cases

| ID | Test | Type | Description |
|---|---|---|---|
| TEST-01 | `notebook()` devolve a descrição da pista | unit (TS) | REQ-05 |
| TEST-02 | `notebook()` aceita pista sem descrição | unit (TS) | Edge case |
| TEST-03 | `toCaseDefinition` mapeia `description` | unit (TS) | O campo deixa de sumir |
| TEST-04 | `toCaseDefinition` omite quando não há | unit (TS) | Não inventa string vazia |
| TEST-05 | `GET /sessions/:id` traz a descrição das pistas visíveis | integration (TS) | REQ-05 |
| TEST-06 | O caderno da API traz a descrição | integration (TS) | REQ-05 |
| TEST-07 | O caso piloto tem descrição em todas as pistas | integration (TS) | Regressão de conteúdo |
| TEST-08 | `Clue.fromJson` lê `description` | unit (Dart) | Contrato |
| TEST-09 | `NotebookEntry.fromJson` lê `description` | unit (Dart) | Contrato |
| TEST-10 | `shouldUseTextMode` sem bússola | unit (Dart) | NFR-07 |
| TEST-11 | `shouldUseTextMode` sem câmera | unit (Dart) | NFR-07 |
| TEST-12 | `shouldUseTextMode` com escolha do jogador | unit (Dart) | NFR-07 |
| TEST-13 | O caderno mostra a descrição | widget (Dart) | REQ-05 |
| TEST-14 | O caderno sem descrição não deixa espaço vazio | widget (Dart) | Edge case |
| TEST-15 | O cartão da pista revelada mostra título e descrição | widget (Dart) | REQ-05 |
| TEST-16 | A lista de casos mostra a sinopse | widget (Dart) | REQ-01 |

### Test Files

| File | What It Covers |
|---|---|
| `packages/engine/test/game-state.test.ts` | TEST-01..02 |
| `packages/module-schema/test/schemas.test.ts` | TEST-03..04 |
| `packages/module-schema/test/pilot-module.test.ts` | TEST-07 |
| `server/test/game-api.test.ts` | TEST-05..06 |
| `app/test/api_client_test.dart` | TEST-08..09 |
| `app/test/investigate_mode_test.dart` | TEST-10..12 |
| `app/test/widgets_test.dart` | TEST-13..16 |

---

## Validation Checklist

- [x] Tests written BEFORE implementation (Red phase)
- [x] All tests passing (Green phase) — 357 TS + 72 Dart
- [x] Coverage meets threshold (`.specs/config.md## Defaults`) — 97,5% statements, 90,3% branches
- [x] `flutter analyze` limpo
- [x] Requirements met — REQ-01, REQ-04, REQ-05 e NFR-07

## Notes

Fecha `REQ-04`, um dos dois `Must` que deixaram a revisão de alinhamento em `misaligned`. O outro
(`REQ-13`, chave cifrada em repouso) depende de contas, adiadas a pedido — então o archive das
specs 001–006 continua bloqueado, e isso fica registrado em vez de contornado.
