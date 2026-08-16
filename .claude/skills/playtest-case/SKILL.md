---
name: playtest-case
description: >-
  Percorre um caso do Vestígio com GPS simulado e diz se ele fecha, antes de alguém sair de casa
  para jogar. Use quando o usuário disser "playtest", "testar caso", "meu caso fecha?", "simular
  partida", "test case", ou depois de mexer nas pistas, nos requires ou na solução de um módulo.
metadata:
  version: 1.0.0
---

# Fazer playtest de um caso

## Purpose

Responder, sem sair do lugar, à pergunta que de outro modo só apareceria no meio da rua: **este
caso fecha?**

## Prerequisites

- Um módulo que já passa em `validate-module`
- `packages/engine/src/playtest.ts` — o percurso simulado
- `.specs/memory/architecture.md## ADR-004` — por que o playtest usa o mesmo motor da partida

## Instructions

### Passo 1: rode o playtest

```
npm run playtest -- modules/<slug>
```

O detetive simulado se teletransporta até cada âncora e coleta tudo que estiver alcançável, em
laço, até não haver mais progresso. Depois acusa o culpado declarado.

### Passo 2: leia o percurso, não só o veredito

A ordem impressa é **a ordem em que um jogador real vai descobrir as coisas**. Pergunte ao autor:

- A revelação chega na hora certa, ou o final aparece cedo demais?
- Há uma pista que destrava três de uma vez? Isso vira um salto, não uma investigação.
- A última pista é a que fecha o raciocínio, ou é enfeite depois do clímax?

### Passo 3: interprete o desfecho

| Veredito | O que fazer |
|---|---|
| `solved` | O caso fecha. Passe ao passo 4 |
| `unsupported` | O percurso não alcança as pistas de `supporting_clues`. Ou o grafo está errado, ou a sustentação exige algo inalcançável |
| `wrong` | O `culprit` não bate com o personagem declarado na solução |
| Pistas inalcançáveis | Conteúdo que nenhum jogador verá. Corrija o `requires` ou remova a pista |

### Passo 4: confira o ritmo

O playtest prova que fecha; ele **não** prova que é bom. Verifique à mão:

- **Distâncias reais** entre as âncoras. Some-as: 4 pistas a 2 km uma da outra é uma caminhada de
  8 km, não uma partida.
- **Pelo menos uma pista sem âncora**, vinda de personagem — senão é caça ao tesouro, não
  investigação.
- **A sustentação exige dedução?** Com dois personagens, acertar o nome é 50%. As
  `supporting_clues` precisam provar o **quê** e o **porquê**.

### Passo 5: teste o caso relocado

Se o caso vai ser jogado fora da cidade de origem, confirme que continua coerente com outra
`origin` — o motor preserva as distâncias, mas não preserva o sentido do lugar. Um caso que
depende de "o poço fica na descida" não sobrevive à mudança.

## Output

- A saída do playtest
- O percurso comentado em termos de ritmo
- A soma das distâncias entre âncoras consecutivas
- O que precisa mudar, quando algo precisa

## Examples

### Exemplo 1: fecha, mas cedo demais

> ```
> Percurso do detetive:
>   1. O bilhete rasgado (no mapa)
>   2. A confissão (em conversa)
>   3. A janela quebrada (no mapa)
> Acusação simulada: solved
> ```
>
> "Fecha — mas a confissão vem em segundo lugar, e a janela quebrada chega depois de o jogador já
> saber tudo. Faça a confissão exigir a janela: `requires: [pista-janela]`. O clímax é a última
> coisa que se descobre, não a segunda."

### Exemplo 2: não fecha

> ```
> Pistas inalcançáveis: pista-carta
> Acusação simulada: unsupported
> ✗ O caso NÃO fecha.
> ```
>
> "`pista-carta` está na sustentação da solução, mas nada a destrava — o `requires` dela aponta
> para uma pista que você renomeou. Sem isso, o jogador andaria a cidade inteira sem nunca poder
> concluir o caso."

## References

- `.specs/memory/architecture.md## ADR-004` — o playtest usa exatamente o motor da partida
- `.claude/skills/validate-module/SKILL.md` — rode antes deste
- `packages/engine/src/playtest.ts`
