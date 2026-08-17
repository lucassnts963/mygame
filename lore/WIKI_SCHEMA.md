# Lore Schema — LLM-Wiki do Vestígio

Este documento define como a lore do jogo é mantida. É uma adaptação direta da metodologia
LLM-Wiki usada no vault pessoal `lucassnts963/knowledge` (que por sua vez segue a LLM-Wiki de
Andrej Karpathy). A diferença: lá a wiki serve ao **humano**; aqui ela serve aos **personagens**.

> **A lore não é decoração — é o cérebro do NPC.** Quando um jogador interroga a Samaritana, o
> agente responde consultando estas páginas via a ferramenta `consultar_lore`. O que não está
> aqui, o personagem não sabe.

## Estrutura

```
lore/
├── WIKI_SCHEMA.md   → este arquivo
├── inbox/           → fontes NOVAS (não revisadas): pesquisa, passagens, recortes históricos
├── raw/             → fontes REVISADAS e IMUTÁVEIS (fora do git — ver .gitignore)
└── wiki/            → páginas mantidas pelo agente de lore
    ├── index.md      → catálogo de todas as páginas
    ├── log.md        → registro cronológico (append-only)
    ├── personagens/  → quem o jogador pode interrogar (e quem é só citado)
    ├── lugares/      → cenários, com ou sem âncora geográfica
    ├── casos/        → o caso em si: o que aconteceu, a verdade, o que cada um esconde
    ├── objetos/      → itens e pistas físicas
    ├── _regras/      → regras duráveis do mundo (o que é canônico entre casos)
    └── _estado/      → estado mutável do mundo (o que já foi revelado publicamente)
```

Cada **módulo** (`modules/<slug>/lore/`) tem sua própria lore, com a mesma estrutura. A lore da
raiz é o **cânone compartilhado**; a do módulo é o que aquele caso acrescenta. Um agente enxerga
`lore/wiki/_regras/` + a lore do seu módulo — nunca a lore de outro caso.

## FAITHFULNESS — Regra Suprema

> **Toda afirmação de um personagem DEVE estar fundamentada em uma página desta wiki.**
> Nunca invente datas, números, nomes, lugares, versículos ou eventos que não estejam na fonte.
> Se a lore não contém a resposta, o personagem **desconversa em personagem** — hesita, muda de
> assunto, diz que não sabe — mas **não inventa**.

Por que isso é mecânica de jogo, e não só higiene:

1. **O mistério precisa ser solúvel.** Se o NPC inventa uma pista, o grafo de dedução quebra e o
   jogador não tem como chegar à solução por raciocínio.
2. **O mistério precisa ser justo.** Se o NPC inventa um álibi, o jogador é punido por confiar.
3. **Conteúdo bíblico e histórico precisa ser correto.** Uma afirmação sobre João 4 sem base no
   texto é um erro que o jogador percebe — e que compromete o jogo inteiro.

A regra é imposta em três camadas: no *system prompt* do agente, na ferramenta `consultar_lore`
(que só devolve trechos reais) e na revisão humana das páginas.

## Frontmatter obrigatório

Toda página em `wiki/` começa com YAML:

```yaml
---
title: "Nome da página"
date: 2026-08-16
tags: [caso-poco-de-jaco, personagem]
category: personagem | lugar | caso | objeto | regra | estado
canon: biblico | historico | ficcional     # a que padrão de fidelidade esta página responde
source: "raw/joao-4.md"                    # obrigatório quando canon != ficcional
spoiler: false                             # true = página que revela a solução; nunca vai ao NPC
---
```

- **`canon: biblico`** — cada afirmação carrega a referência (`João 4:6`). Não parafraseie
  a ponto de mudar o sentido; não some fatos que o texto não traz.
- **`canon: historico`** — cada afirmação carrega a fonte em `raw/`.
- **`canon: ficcional`** — invenção deliberada do caso. É livre, mas uma vez escrita **vira
  cânone**: o NPC não pode contradizê-la depois.
- **`spoiler: true`** — a página é lida pelo motor (para julgar a acusação), nunca pelo agente.
  É assim que a verdade do caso fica fora do alcance de *prompt injection*.
- **`audience: player`** — marca que o **corpo** desta página é prosa para quem joga. Obrigatório
  na página apontada por `solution.reveal` (ver abaixo).

## Páginas de revelação (`solution.reveal`)

A página que o `case.yaml` aponta em `solution.reveal` é o **epílogo**: o texto que o jogador lê
quando o caso termina. Ela é `spoiler: true` como qualquer verdade de caso — o agente nunca a vê —
mas tem uma exigência a mais que as outras:

> **O corpo é prosa para o jogador, do primeiro caractere ao último.**

Nada de "esta página é spoiler", nada de referência a ADR, requisito ou motor. É o desfecho de um
mistério chegando a quem passou a tarde andando pela cidade para merecê-lo; explicar a mecânica do
jogo ali quebra a imersão no exato momento em que ela mais importa.

Notas para quem escreve o módulo vão em **comentário HTML** (`<!-- … -->`) no fim do arquivo: o app
renderiza Markdown, e comentário não é renderizado. É onde documentar por que a sustentação é
aquela, que fonte embasa o quê, e o que um futuro autor precisa saber.

O epílogo é entregue **somente depois da acusação**. Antes dela, o texto não aparece em nenhuma
resposta da API — é o mesmo cuidado do índice de lore, só que na outra direção.

## Convenções

- **Nomes de arquivo:** `categoria-slug-descritivo.md` → `personagens/samaritana.md`
- **Links internos:** `[[lore/wiki/personagens/samaritana]]`
- **Idioma:** português (Brasil)
- **Fontes em `raw/`:** IMUTÁVEIS, nunca editar; ficam fora do git
- **Uma página, um assunto.** Página inflada com filler é pior que nota curta — o RAG do agente
  devolve trechos, e trecho vago vira resposta vaga.

## Operações

### Ingest
Quando uma fonte vai de `inbox/` para `raw/`:

1. Ler a fonte completa
2. Criar/atualizar as páginas de `wiki/` afetadas
3. Atualizar `wiki/index.md`
4. Registrar em `wiki/log.md`: `## [YYYY-MM-DD] ingest | Título`

### Lint
Health-check da lore, rodado por `npm run validate-module`:

| Kind | Significado | Severidade |
|------|-------------|------------|
| `missing-frontmatter` | Página sem YAML ou sem `title`/`category`/`canon` | `error` |
| `unsourced-canon` | `canon: biblico`/`historico` sem `source` | `error` |
| `broken-link` | `[[...]]` aponta para página inexistente | `error` |
| `spoiler-exposed` | Página `spoiler: true` listada na lore de um agente | `error` |
| `orphan` | Página sem nenhum link de entrada | `warning` |
| `contradiction` | Duas páginas afirmam coisas conflitantes | `warning` |
| `gap` | Pista do `case.yaml` sem página de lore correspondente | `warning` |

Os `error` são determinísticos e barram a validação do módulo. Os `warning` — contradição
sobretudo — são julgamento de LLM, no mesmo espírito do modelo de duas camadas da metodologia
(`.specs/methodology.md`): script para o que é estrutural, LLM para o que é semântico.

## References

- `.specs/methodology.md` — a metodologia de duas camadas que este schema espelha
- `.specs/memory/architecture.md## ADR-002` — por que a lore é uma LLM-Wiki
- `lucassnts963/knowledge → WIKI_SCHEMA.md` — o schema original de onde este deriva
