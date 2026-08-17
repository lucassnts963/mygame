# Alignment Review — CHG-001

- **Reviewed-spec:** CHG-001
- **Reviewed-requirements:** ../../requirements/001-vestigio-mvp/requirements.md
- **Date:** 2026-08-17
- **Verdict:** misaligned

> **Escopo desta revisão.** O documento `requirements/001-vestigio-mvp` é a fonte de **seis**
> specs (`CHG-001..006`), não de uma. A metodologia pareia requisitos e spec pelo número, então o
> artefato vive em `001-case-engine` — mas o julgamento abaixo é sobre a **entrega inteira**, spec
> por spec. Revisar só o motor deixaria 14 dos 20 requisitos sem juiz, que é precisamente o
> rubber-stamping que este gate existe para impedir.

## Per-Requirement Verdicts

| REQ ID | Verdict | Evidence (spec section · quote) | Gap / Action |
|---|---|---|---|
| REQ-01 | Covered | CHG-004 `## Scope` · "`GET /sessions/:id` — estado: pistas visíveis"; CHG-005 · mapa com marcadores e distância formatada | — |
| REQ-02 | Covered | CHG-004 `## Design` · "O `POST /clues/:id/collect` … chama `canCollect` do motor"; teste "o servidor revalida — o cliente não é fonte de verdade" | — |
| REQ-03 | Covered | CHG-001 `## Scope` · "Grafo de pistas: quais estão desbloqueadas, quais faltam" | — |
| REQ-04 | **Partial** | CHG-005 `## Design` · a projeção por rumo está correta e testada (TEST-06..08) | **A imagem da câmera não é desenhada.** `investigate_screen.dart` usa um retângulo neutro no lugar do `CameraPreview`; o pacote `camera` está declarado e não usado. O requisito diz "sobre a câmera". → `CHG-009` |
| REQ-05 | Covered | CHG-001 `## Design` · `notebook()`; CHG-005 · `NotebookView` com estado vazio | — |
| REQ-06 | **Partial (aceito)** | CHG-003 `## Scope` · "Laço de conversa"; CHG-004 · `POST /characters/:id/chat` | Sem streaming: a fala volta inteira. Corte deliberado, agora registrado em requirements `## 9` |
| REQ-07 | Covered | CHG-003 `## Design` · "páginas `spoiler: true` são removidas no *índice*, não na resposta" | — |
| REQ-08 | Covered | CHG-003 `## Scope` · ferramenta `verificar_caderno` | — |
| REQ-09 | Covered | CHG-003 · `revelar_pista`; e o achado `grantClue` (conceder ≠ coletar) | — |
| REQ-10 | Covered | CHG-001 `## Design` · "Culpado certo, sustentação incompleta — o palpite não vale" | — |
| REQ-11 | Covered | CHG-003 `## Design` · "O runtime fala **só** `POST {base_url}/chat/completions`" | — |
| REQ-12 | Covered | CHG-003 · cascata; e o achado de CHG-004: o nível sem chave é **pulado**, não fatal | — |
| REQ-13 | **Partial** | CHG-003 `## Design` · `SecretKey` mascara em `toString`/`toJSON`/inspect (TEST-04) | **Nada está cifrado em repouso.** `encryptSecret` existe e é testado, mas nenhuma chave é armazenada — a cascata só lê variáveis de ambiente. Metade de um `Must`. → `CHG-008` |
| REQ-14 | Covered | CHG-002 `## Scope` · "Carregador… validador… lint"; diagnósticos com arquivo e linha | — |
| REQ-15 | Covered | CHG-002 · validador de `SKILL.md`; CHG-003 `## Design` · "No system prompt entra só o catálogo" | — |
| REQ-16 | Covered | CHG-001 `## Scope` · `playtestCase`; CLI em CHG-002 | — |
| REQ-17 | Covered | CHG-006 · módulo piloto valida sem erro nem aviso e fecha em `solved` | — |
| REQ-18 | Covered | CHG-003 · `MAX_TURNS_PER_CONVERSATION`, espelhando `config.md## Game Constants` | — |
| REQ-19 | **Partial (aceito)** | CHG-001 `## Design` · `resolveAnchor` translada pelo espaço métrico; CHG-004 aceita `origin` | O app não oferece a escolha ao jogador. `Should`; aceito e registrado em requirements `## 9` |
| REQ-20 | Covered | CHG-002 `## Scope` · lint de lore; `spoiler-exposed` como erro | — |

**Contagem:** 16 `Covered` · 4 `Partial` (2 aceitos, 2 com prazo) · 0 `Missing` · 0 `Contradicted`.

## Scope Drift

Comportamento entregue sem requisito que o peça. Nenhum é indevido, mas ficam registrados:

- **`grantClue` no motor** (CHG-003) — conceder pista sem verificar posição. Não estava em nenhum
  `REQ`, mas o `UC-01 Alt-02` o exigia implicitamente ("sem exigência de posição"). Deriva
  legítima: o caso de uso estava lá, o requisito numerado é que não cobria.
- **Varredura de segredo literal no bundle** (CHG-002, `secret-literal`) — nasceu do `NFR-02`,
  não de um `REQ` funcional. Vale mantê-la: é o que impede um módulo compartilhado de vazar a
  chave do autor.
- **`503` distinguindo "o jogo está de pé, a IA não está"** (CHG-004) — decisão de operação sem
  requisito correspondente. Boa deriva: mantém mapa, caderno e acusação vivos sem provider.
- **Quatro skills de autoria** (`create-case`, `create-character-agent`, `validate-module`,
  `playtest-case`) — servem à visão do produto ("o usuário cria seus próprios agentes"), que os
  requisitos 001 tocam só de lado em `REQ-14`/`REQ-15`. Merecem requisitos próprios quando a
  criação por usuário virar entrega.

## Summary

A entrega 1 cobre 16 dos 20 requisitos e não contradiz nenhum. O veredito é **`misaligned`** por
duas lacunas em requisitos `Must`, e não por formalidade:

1. **REQ-13** — "cifrar a chave em repouso" não acontece em lugar nenhum. Ter a cifra escrita e
   testada não é o mesmo que usá-la; hoje nenhuma chave de jogador existe para ser protegida.
2. **REQ-04** — o vestígio é posicionado corretamente, mas não sobre a câmera. A parte difícil
   (o rumo) está feita; falta a fácil, e sem ela o requisito não está cumprido.

Os outros dois `Partial` (REQ-06 streaming, REQ-19 origem na UI) são cortes deliberados, agora
registrados em `requirements ## 9`, e por isso não pesam no veredito.

**Ação:** `CHG-008` fecha REQ-13 e `CHG-009` fecha REQ-04, ambos na entrega 2. Esta revisão deve
ser reexecutada depois, e só então `CHG-001..006` podem ser arquivados — que é exatamente o que o
gate de archive existe para forçar.
