# Spec: Cliente Flutter (`app/`)

| Field | Value |
|---|---|
| **ID** | CHG-005 |
| **Status** | approved |
| **Author** | Lucas de Oliveira Santos |
| **Created** | 2026-08-16 |
| **Approved** | 2026-08-16 |

## Context

Todo o jogo existe no servidor, mas ninguém pode jogá-lo: falta a parte que fica no bolso, mostra
o mapa, abre a câmera quando o jogador chega ao lugar e conversa com os personagens.

O app é **fino de propósito** (ADR-004): ele não decide nada de jogo. Decide o que mostrar. A
única lógica de domínio que ele reimplementa é a distância — para dizer "faltam 200 m" sem ida e
volta ao servidor a cada passo do GPS.

## Scope

- `GameApiClient` — HTTP contra a API do jogo
- Serviços puros em `app/lib/core/`: geo (Haversine + rumo), geofence, formatação de distância
- Telas: mapa, investigação em AR, caderno, chat, acusação
- Modo textual da investigação (NFR-07): a AR não pode ser o único caminho

### Out of Scope

- Autenticação (o MVP usa id de sessão)
- ARCore/ARKit (ADR-005)
- Offline completo, voz, criação de módulos pelo app

## Requirements

### Functional

- [x] REQ-01: mapa com a posição do jogador e as pistas desbloqueadas, com distância
- [x] REQ-02: investigar só habilita dentro do raio; o servidor revalida
- [x] REQ-04: o vestígio é desenhado no rumo real da âncora
- [x] REQ-05: caderno com as pistas coletadas
- [x] REQ-06: chat livre com os personagens desbloqueados
- [x] REQ-10: tela de acusação com o veredito explicado

### Non-Functional

- [x] NFR-07: a investigação tem modo textual equivalente ao da AR

### Technical

| Layer | File / Component | Change Description |
|---|---|---|
| Core | `app/lib/core/geo.dart` | Haversine, rumo, geofence — funções puras |
| Core | `app/lib/core/models.dart` | Modelos vindos da API |
| Core | `app/lib/core/game_api_client.dart` | HTTP |
| Core | `app/lib/core/ar_projection.dart` | Rumo + heading → posição na tela |
| UI | `app/lib/features/**` | Mapa, AR, caderno, chat, acusação |

## Design

### Por que o app reimplementa a distância

O servidor é a autoridade sobre coleta (REQ-02), mas perguntar a ele a cada leitura do GPS seria
uma requisição por segundo, gastando bateria e dados para produzir um número que o app já tem
como calcular. A regra: **o app calcula para mostrar; o servidor calcula para decidir.**

### A projeção em AR, sem ARCore

Dado o rumo da âncora (`bearing`) e para onde o aparelho aponta (`heading`), a diferença angular
diz onde o vestígio cai na tela:

```
desvio = normalizar(bearing - heading)   // -180…180
x = largura/2 + (desvio / (campoDeVisão/2)) * (largura/2)
```

Fora do campo de visão, o vestígio não é desenhado — vira uma seta na borda indicando para que
lado girar. É a diferença entre "a pista sumiu" e "vire à direita".

### Edge Cases

- Permissão de localização negada → tela explicando, com o modo textual disponível
- GPS sem sinal → mapa mostra a última posição conhecida e avisa
- Bússola ausente ou imprecisa → a tela de AR cai para o modo textual
- API fora do ar → mensagem clara, com repetição manual
- 409 do servidor → o veredito vira mensagem de jogo, nunca "erro"

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Aparelho sem bússola confiável | Med | Med | Modo textual como caminho equivalente (NFR-07) |
| Bateria com GPS contínuo | High | Med | `distanceFilter` no stream, e não amostragem por tempo |
| Divergência entre distância do app e do servidor | Low | Med | Mesma fórmula (Haversine, R=6.371 km), verificada por teste |

## Dependencies

- CHG-004 (API)

## Requirements Traceability

**Requirements:** [`requirements/001-vestigio-mvp/requirements.md`](../../requirements/001-vestigio-mvp/requirements.md)

| REQ ID | Requirement Summary | Priority | Acceptance Criteria |
|---|---|---|---|
| REQ-01 | Mapa com pistas e distância | Must | Marcadores e distância formatada |
| REQ-02 | Investigar só dentro do raio | Must | Botão desabilitado fora do raio |
| REQ-04 | Vestígio no rumo real | Must | Projeção testada contra rumos conhecidos |
| REQ-05 | Caderno | Must | Lista as pistas coletadas |
| REQ-06 | Chat | Must | Envia e mostra a resposta |
| REQ-10 | Acusação | Must | Veredito explicado na tela |

## Tests

> **TDD:** escritos ANTES da implementação. `flutter test`.

### Test Cases

| ID | Test | Type | Description |
|---|---|---|---|
| TEST-01 | `distanceMeters` bate com o motor TS | unit | Mesma fórmula dos dois lados |
| TEST-02 | `bearingDegrees` nos rumos cardeais | unit | REQ-04 |
| TEST-03 | `isWithinGeofence` dentro/borda/fora | unit | REQ-02 |
| TEST-04 | `formatDistance` em m e km | unit | REQ-01 |
| TEST-05 | `relativeBearing` normaliza para -180…180 | unit | REQ-04 |
| TEST-06 | `projectToScreen` centraliza o que está à frente | unit | REQ-04 |
| TEST-07 | `projectToScreen` joga para a direita o que está à direita | unit | REQ-04 |
| TEST-08 | `projectToScreen` devolve nulo fora do campo de visão | unit | REQ-04 |
| TEST-09 | `Clue.fromJson` lê a resposta da API | unit | Contrato |
| TEST-10 | `SessionView.fromJson` lê estado completo | unit | Contrato |
| TEST-11 | Cliente monta a URL de coleta | unit | Contrato |
| TEST-12 | Cliente traduz 409 em veredito de jogo, não erro | unit | Edge case |
| TEST-13 | Widget do caderno lista as pistas | widget | REQ-05 |
| TEST-14 | Caderno vazio mostra estado vazio | widget | REQ-05 |
| TEST-15 | Botão de investigar desabilita fora do raio | widget | REQ-02 |

### Test Files

| File | What It Covers |
|---|---|
| `app/test/geo_test.dart` | TEST-01..05 |
| `app/test/ar_projection_test.dart` | TEST-06..08 |
| `app/test/api_client_test.dart` | TEST-09..12 |
| `app/test/widgets_test.dart` | TEST-13..15 |

---

## Validation Checklist

- [x] Tests written BEFORE implementation (Red phase)
- [x] All tests passing (Green phase) — 52 testes Dart
- [x] `flutter analyze` limpo — nenhum aviso
- [x] Requirements met — REQ-01, 02, 04, 05, 06, 10 e NFR-07

## Notes

**Não é possível compilar um APK neste ambiente** (não há Android SDK), e isso está declarado:
a verificação aqui é `flutter analyze` + `flutter test`. Rodar em aparelho é `flutter run`, na
máquina do autor. Por isso o app foi mantido fino — o que dá para provar aqui é justamente onde
a lógica está.
