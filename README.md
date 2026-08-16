# Vestígio

Jogo de mistério em que você se desloca pelo **mapa real**, encontra pistas em **realidade
aumentada geolocalizada** e interroga **personagens vivos** — agentes de IA cujo conhecimento é
uma wiki de lore. Casos temáticos: bíblicos e baseados em fatos reais. E o jogador pode criar os
seus próprios.

> **O cântaro continua no poço.** Ao meio-dia, na hora em que ninguém vai buscar água, uma mulher
> deixou o seu cântaro e saiu correndo para a cidade. Descubra por quê.

## O que já funciona

| | |
|---|---|
| **Mapa e geofence** | Pistas aparecem quando desbloqueadas; só se coleta chegando ao lugar. O servidor revalida — o cliente nunca é fonte de verdade |
| **AR geolocalizada** | O vestígio é desenhado sobre a câmera pelo rumo real da âncora, sem ARCore. Fora do campo de visão, uma seta diz para que lado girar |
| **Personagens-agentes** | Conversa livre com NPCs que **não inventam**: toda afirmação passa pela lore |
| **Caderno e acusação** | Uma acusação por caso — e acertar sem reunir as provas não resolve nada |
| **Módulos do jogador** | Um caso é YAML + Markdown. Nenhuma linha de código |

## Começando

```bash
npm install
npm test                                   # 310 testes TypeScript
npm run validate-module -- modules/poco-de-jaco
npm run playtest -- modules/poco-de-jaco   # prova que o caso fecha, sem sair do lugar
npm run dev -w server                      # sobe a API

cd app && flutter run                      # o jogo, num aparelho
```

Para os personagens falarem, aponte o servidor a **qualquer endpoint compatível com a API da
OpenAI** — OpenAI, Groq, OpenRouter, Ollama, llama.cpp:

```bash
export VESTIGIO_BASE_URL=http://localhost:11434/v1   # Ollama, por exemplo
export VESTIGIO_MODEL=llama3
npm run dev -w server
```

Sem isso o jogo sobe do mesmo jeito: mapa, AR, caderno e acusação funcionam; só o interrogatório
responde 503.

## Como um caso é feito

```
modules/poco-de-jaco/
├── case.yaml                     # pistas, âncoras GPS, personagens, solução
├── agents/samaritana.agent.yaml  # persona, provider, lore, o que ela pode revelar
├── skills/guardar-segredo/SKILL.md
└── lore/wiki/**.md               # o que os personagens sabem — e só isso
```

Peça ao agente: **"criar caso"**, **"criar personagem"**, **"validar módulo"**, **"playtest"**.
As skills em `.claude/skills/` conduzem cada um desses caminhos.

### As três regras que sustentam o jogo

1. **FAITHFULNESS.** Um personagem só afirma o que a lore fundamenta. Sem fundamento, ele
   desconversa em personagem — nunca inventa. É o que mantém o caso solúvel e justo.
2. **A verdade fica fora do alcance.** A página da solução é marcada `spoiler: true` e **nunca**
   entra no contexto de um agente. Não é que ele não deva contar: é que ele não tem como.
3. **A chave nunca entra no módulo.** Só o nome da variável de ambiente. Um segredo literal em
   qualquer arquivo reprova a validação — módulo existe para ser compartilhado.

## Arquitetura

```
packages/engine/         domínio puro: grafo de pistas, estado, geofence — sem I/O
packages/module-schema/  contrato do módulo do jogador + validadores
server/                  API do jogo + runtime dos agentes (OpenAI-compatible, BYOK)
app/                     cliente Flutter
lore/                    o cânone compartilhado do mundo
modules/                 os casos
.specs/                  metodologia: requisitos → spec → TDD → archive, ADRs, memória
```

Detalhes em [`AGENTS.md`](AGENTS.md); as decisões e seus porquês em
[`.specs/memory/architecture.md`](.specs/memory/architecture.md).

## Sobre a metodologia

O projeto é construído com o [spec-driven + TDD starter-kit](https://github.com/lucassnts963/starter-kit)
e a lore segue a metodologia LLM-Wiki do vault `knowledge`. As duas se encontram numa ideia só:
**o mesmo formato de skill que constrói o projeto é o formato que o jogador usa para dar
comportamento a um personagem.** Quem aprende um, aprende o outro.

## Licença

MIT.
