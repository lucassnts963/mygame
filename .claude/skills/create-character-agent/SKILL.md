---
name: create-character-agent
description: >-
  Cria um personagem-agente do Vestígio — o agent.yaml com persona, provider OpenAI-compatible,
  lore, skills e regras de revelação de pista. Use quando o usuário disser "criar personagem",
  "novo NPC", "create character", "criar agente do jogo", ou quiser que alguém de um caso possa
  ser interrogado. Não use para criar o caso inteiro (use create-case) nem para skills do
  repositório (use create-skill).
metadata:
  version: 1.0.0
---

# Criar um personagem-agente

## Purpose

Dar voz a alguém do caso: um agente que conversa livremente, responde ao que foi realmente
perguntado — e que **não inventa**, porque tudo que ele afirma passa pela lore.

## Prerequisites

- `lore/wiki/_regras/como-personagens-respondem.md` — o contrato que vale para todo NPC
- `lore/WIKI_SCHEMA.md` — FAITHFULNESS e o significado de `spoiler`
- A lore do módulo, já escrita (um personagem sem lore não tem o que dizer)
- `modules/poco-de-jaco/agents/samaritana.agent.yaml` — o exemplo canônico

## Instructions

### Passo 1: descubra o que ele sabe e o que ele esconde

São duas perguntas diferentes, e a segunda é a que faz o interrogatório valer:

- **Sabe:** que páginas de lore fundamentam as falas dele
- **Esconde:** o que ele só admite quando o detetive chega com provas
- **Não sabe:** onde ele deve dizer "não sei" em vez de supor — declare isso na persona

### Passo 2: escreva a persona em segunda pessoa

Escreva "você é", não "este personagem é". Inclua **onde ele está, quando, e em que estado
emocional** — é o que sustenta o tom ao longo da conversa. Descreva o comportamento sob pressão:
desconversa? irrita-se? devolve pergunta?

Não repita as regras gerais (não inventar, ser breve, ficar em personagem): o runtime já as
injeta em todo personagem. A persona é só o que é **deste** personagem.

### Passo 3: escolha o provider — ou não escolha

```yaml
provider:
  base_url: https://api.openai.com/v1   # ou Groq, OpenRouter, Ollama, llama.cpp…
  model: gpt-4o-mini
  api_key_env: VESTIGIO_<PERSONAGEM>_KEY
```

- **Omitir `provider` é o padrão saudável.** Sem ele, a cascata cai para o módulo e depois para o
  servidor (REQ-12), e o módulo roda na máquina de qualquer pessoa.
- Declare um só quando o personagem realmente pedir outro modelo — um antagonista que precisa
  sustentar contradição longa, por exemplo.
- **`api_key_env` guarda o NOME da variável, nunca a chave.** Uma chave literal no arquivo
  reprova a validação (ADR-008), e com razão: módulo é feito para ser compartilhado.

### Passo 4: liste a lore que ele alcança

```yaml
lore: [personagens/fulano, lugares/o-poco]
```

Liste **só o que este personagem tem como saber**. Um discípulo que não estava presente não deve
alcançar a página da conversa — a fronteira do que ele pode afirmar é a fronteira da lista.

**Nunca liste uma página `spoiler: true`.** A validação reprova com `spoiler-exposed`, e é essa
regra que impede o jogador de extrair a solução conversando.

### Passo 5: declare o que ele pode revelar

```yaml
reveals:
  - clue: pista-confissao
    requires_clues: [pista-pegadas]
```

O personagem só concede o que está aqui, e só quando `requires_clues` está no caderno. É o que
faz a ordem da investigação importar: ele abre quando o detetive mostra que já sabe.

Um personagem sem `reveals` não recebe a ferramenta `revelar_pista` — o que é o certo para uma
testemunha que só confirma fatos.

### Passo 6: dê uma skill, se ele tiver um comportamento com regra

Se o "quanto revelar" tem lógica própria, escreva `skills/<nome>/SKILL.md` no **mesmo formato de
6 seções** do repositório (`.specs/config.md## Skill Format`). Só a `description` entra no prompt;
o corpo é carregado quando o personagem aciona a skill.

### Passo 7: valide

```
npm run validate-module -- modules/<slug>
```

## Output

Um `modules/<slug>/agents/<id>.agent.yaml`, mais as páginas de lore que faltavam, e o relato de:

- o que o personagem sabe, esconde e não sabe
- qual provider ele usa (ou de quem herda)
- que pistas ele pode conceder, e sob que condição
- a saída da validação

## Examples

### Exemplo 1: a testemunha que viu sem ouvir

> **Autor:** Quero um discípulo que estava por perto.
>
> Ele **viu** a cena e **não ouviu** a conversa. Isso vira: lore só com o lugar e a chegada dele,
> `reveals: []`, e uma persona que manda admitir a ausência em vez de supor. A limitação dele é
> conteúdo — ensina ao jogador que testemunha não é onisciente.

### Exemplo 2: o autor quer colocar a chave no arquivo

> **Autor:** Posso pôr minha chave da OpenAI direto no agent.yaml?
>
> "Não — a validação reprova. E o motivo não é burocracia: no instante em que você mandar esse
> módulo para alguém, a chave foi junto. Use `api_key_env: VESTIGIO_SAMARITANA_KEY` e ponha a
> chave na variável de ambiente. Quem receber o módulo joga com o provider dele."

### Exemplo 3: personagem que precisa de um modelo melhor

> **Autor:** O antagonista tem que mentir de forma consistente por muitos turnos.
>
> Aí um `provider` próprio se justifica: `model` mais forte e `temperature` baixa. Os demais
> personagens continuam sem `provider`, herdando o do servidor — assim o custo só sobe onde faz
> diferença.

## References

- `lore/wiki/_regras/como-personagens-respondem.md`
- `.specs/memory/architecture.md## ADR-007` — provider OpenAI-compatible e BYOK
- `.specs/memory/architecture.md## ADR-008` — por que a chave nunca entra no módulo
- `modules/poco-de-jaco/agents/` — os dois exemplos canônicos
