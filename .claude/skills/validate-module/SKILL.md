---
name: validate-module
description: >-
  Valida um módulo de caso do Vestígio e explica cada diagnóstico ao autor, traduzindo o código do
  erro no que ele significa para a partida. Use quando o usuário disser "validar módulo",
  "validate module", "meu caso está certo?", "por que deu erro no módulo", ou depois de qualquer
  edição em case.yaml, agent.yaml, skills ou lore de um módulo.
metadata:
  version: 1.0.0
---

# Validar um módulo

## Purpose

Rodar o validador e transformar a saída em conversa útil: cada código de diagnóstico existe por
uma razão de jogo, e o autor merece saber qual é.

## Prerequisites

- `packages/module-schema/` — o validador
- `lore/WIKI_SCHEMA.md## Lint` — as categorias do lint de lore
- `.specs/config.md## Game Constants` — os limites de raio

## Instructions

### Passo 1: rode o validador

```
npm run validate-module -- modules/<slug>
```

### Passo 2: traduza cada diagnóstico

Não repita a mensagem: explique a **consequência na partida**.

| Código | O que significa para quem vai jogar |
|---|---|
| `secret-literal` | Uma chave de API está escrita no módulo. No instante em que você compartilhar o diretório, ela vazou. Troque por `api_key_env` com o nome da variável |
| `spoiler-exposed` | Um personagem alcança a página da solução. O jogador vai extrair o final conversando, e o caso acaba na primeira pergunta |
| `unsourced-canon` | Uma página `biblico`/`historico` afirma sem citar fonte. É o tipo de erro que o jogador percebe e que compromete o caso inteiro |
| `broken-link` | Um `[[link]]` aponta para página que não existe — o agente vai procurar e não achar |
| `unknown-lore-page` | O agente lista uma página inexistente; ele ficará mais ignorante do que você planejou |
| `unknown-skill` | O agente declara uma skill que não está no bundle |
| `skill-missing-section` | O `SKILL.md` não segue o formato de 6 seções — o agente não vai saber usá-la |
| `dangling-requirement` | Uma pista exige outra que não existe: beco sem saída no meio da rua |
| `unreachable` / `cycle` | Há pista que nenhum percurso alcança. Conteúdo que ninguém verá |
| `radius-out-of-range` | Raio pequeno demais (o GPS não chega) ou grande demais (a pista deixa de exigir caminhada) |
| `case-unsolvable` | O percurso simulado não fecha. **Este é o erro que arruinaria a partida inteira** |
| `character-without-agent` | *(aviso)* O personagem existe mas não pode ser interrogado. Pode ser intencional |
| `orphan` | *(aviso)* Nenhuma página aponta para esta. Costuma ser lore que o agente nunca vai alcançar |

### Passo 3: separe erro de aviso

**Erro** reprova o módulo. **Aviso** é escolha do autor — mas pergunte se foi mesmo escolha:
página órfã quase sempre é lore esquecida, não lore deliberada.

### Passo 4: proponha a correção, não só o diagnóstico

Para cada erro, ofereça a edição concreta. Depois rode de novo até sair limpo, e faça o playtest
(`playtest-case`) — validação prova que o módulo está bem formado; playtest prova que ele fecha.

## Output

- O comando executado e a saída
- Cada diagnóstico traduzido em consequência de jogo
- As correções propostas, e a saída limpa depois delas

## Examples

### Exemplo 1: spoiler exposto

> ```
> ERRO agents/samaritana.agent.yaml
>       [spoiler-exposed] 'casos/a-verdade' é uma página spoiler...
> ```
>
> "Sua personagem tem acesso à página que conta o final. Na primeira pergunta direta o jogador
> recebe a solução de bandeja e o caso termina antes de começar. Remova `casos/a-verdade` do
> `lore:` dela — o motor lê essa página ao julgar a acusação, nenhum personagem precisa dela."

### Exemplo 2: só um aviso

> ```
> aviso lore/wiki/lugares/mercado.md
>       [orphan] nenhuma outra página aponta para esta
> ```
>
> "Isto não reprova, mas: nenhuma outra página cita o mercado, então ele está solto na lore. Foi
> de propósito, ou faltou linkar de `casos/o-desaparecimento`?"

## References

- `lore/WIKI_SCHEMA.md## Lint`
- `.specs/memory/architecture.md## ADR-008` — por que segredo literal é erro, não aviso
- `.claude/skills/playtest-case/SKILL.md` — o passo seguinte
