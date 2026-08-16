---
name: create-case
description: >-
  Cria um novo módulo de caso do Vestígio — case.yaml com pistas ancoradas por GPS, personagens,
  lore e solução — a partir de uma ideia do autor. Use quando o usuário disser "criar caso",
  "novo caso", "create case", "new case", "quero fazer um mistério" ou descrever um enigma que
  quer transformar em módulo jogável. Não use para editar um caso existente (edite o case.yaml
  direto) nem para criar só um personagem (use create-character-agent).
metadata:
  version: 1.0.0
---

# Criar um caso

## Purpose

Transformar uma ideia de mistério num módulo jogável e **válido**: pistas que exigem
deslocamento real, um grafo de dedução que fecha, e uma solução que só se alcança raciocinando.

## Prerequisites

Leia antes de escrever qualquer arquivo:

- `AGENTS.md` — a estrutura do repositório e as convenções de nomes
- `lore/WIKI_SCHEMA.md` — o schema da lore e a regra FAITHFULNESS
- `.specs/config.md## Game Constants` — raios de geofence e limites
- `modules/poco-de-jaco/` — o módulo piloto, que é o exemplo canônico a copiar

## Instructions

### Passo 1: descubra a pergunta do caso

Um caso não é "um crime": é **uma pergunta com uma resposta que se reconstrói**. Pergunte ao
autor, em linguagem natural:

1. Qual é a pergunta? ("Por que o cântaro ficou no poço?")
2. Qual é a resposta verdadeira?
3. Que vestígios ficaram no mundo?
4. Quem pode ser interrogado, e o que cada um esconde?

Se a resposta 2 não puder ser deduzida a partir de 3 e 4, o caso ainda não existe. Volte ao 1.

### Passo 2: escolha o tipo de canon

| Se o caso é | `canon` | O que isso obriga |
|---|---|---|
| Bíblico | `biblico` | Toda afirmação com a referência (livro capítulo:versículo) e `source` |
| Baseado em fato real | `historico` | Toda afirmação com a fonte em `raw/` |
| Invenção | `ficcional` | Livre — mas o que for escrito vira cânone e ninguém pode contradizer depois |

Em caso bíblico ou histórico: **não reescreva o que aconteceu**. Coloque o mistério numa lacuna
que o texto deixou em aberto. É o que o piloto faz com João 4:28.

### Passo 3: desenhe o grafo de pistas

Regras que fazem o caso funcionar:

- **3 a 6 pistas** no MVP. Menos que 3 não é investigação; mais que 6 cansa antes de fechar.
- **Uma pista inicial** sem `requires`, senão o jogador começa parado.
- **Encadeie por `requires`**, não por ordem no arquivo. O grafo é o roteiro.
- **Pelo menos uma pista sem âncora**, revelada por um personagem: é o que diferencia o jogo de
  uma caça ao tesouro.
- **Raio 25 m** por padrão (`.specs/config.md## Game Constants`). Só aumente em lugar aberto.

### Passo 4: escreva a lore antes dos personagens

A lore é o que os personagens sabem — se ela não existe, eles não têm o que dizer. Uma página por
assunto em `modules/<slug>/lore/wiki/{personagens,lugares,objetos,casos}/`, com o frontmatter
completo. Páginas curtas e específicas: o agente busca trechos, e trecho vago vira resposta vaga.

### Passo 5: esconda a verdade numa página spoiler

Escreva `lore/wiki/casos/a-verdade.md` com `spoiler: true`. Ela é lida pelo motor ao julgar a
acusação e **nunca** entra no contexto de um personagem. Não a linke de nenhuma outra página: ela
é órfã de propósito, e o lint sabe disso.

### Passo 6: escolha a sustentação da acusação

`solution.supporting_clues` são as pistas sem as quais acertar o culpado é palpite. Escolha as
que provam **o quê** e **por quê** — com poucos personagens, adivinhar o nome certo é fácil demais.

### Passo 7: valide e faça o playtest

```
npm run validate-module -- modules/<slug>
npm run playtest -- modules/<slug>
```

Só considere o caso pronto quando a validação sair **sem erro e sem aviso** e o playtest disser
"O caso fecha". Aviso de página órfã costuma significar lore que o personagem nunca vai alcançar.

### Passo 8: crie os agentes

Um por personagem interrogável, com a skill `create-character-agent`.

## Output

Um diretório `modules/<slug>/` com `case.yaml`, `lore/wiki/**`, e o relato ao autor de:

- a pergunta do caso e a resposta verdadeira
- o grafo de pistas, em ordem de descoberta
- a saída da validação e do playtest
- o que ainda falta (agentes, skills)

## Examples

### Exemplo 1: caso bíblico

> **Autor:** Quero um caso sobre o cego de nascença, João 9.
>
> **Passo 1** — Pergunta: por que os pais dele desconversaram quando foram interrogados?
> Resposta verdadeira: temiam ser expulsos da sinagoga (João 9:22).
> **Passo 3** — Pistas: o lodo nos olhos (âncora), o tanque de Siloé (âncora), a vizinhança em
> dúvida se era ele mesmo (âncora), e o medo dos pais — sem âncora, só sai deles em conversa.
> **Passo 5** — `a-verdade.md` com `spoiler: true` citando João 9:22.

### Exemplo 2: o autor traz um caso que não fecha

> **Autor:** O culpado é o irmão, e a pista é que ele estava nervoso.
>
> "Nervosismo não se deduz de um vestígio no mapa — é interpretação. Que **coisa** ficou no
> mundo por causa do que ele fez? Um objeto fora do lugar, uma marca, um horário que não bate?
> Sem isso o jogador não tem como chegar à conclusão, só como adivinhá-la."

## References

- `AGENTS.md`
- `lore/WIKI_SCHEMA.md`
- `.specs/memory/architecture.md## ADR-009` — por que o módulo é declarativo
- `modules/poco-de-jaco/` — o exemplo canônico
