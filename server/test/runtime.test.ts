import { collectClue, createGameState } from "@vestigio/engine";
import { describe, expect, it } from "vitest";
import { SecretKey } from "../src/agent/crypto.ts";
import { createChatClient } from "../src/agent/openai-client.ts";
import { runAgentTurn } from "../src/agent/runtime.ts";
import type { Conversation, ResolvedProvider } from "../src/agent/types.ts";
import { fakeOpenAI } from "./fake-openai.ts";
import { BARCARENA, LORE, agentSpec, caseDefinition } from "./fixtures.ts";

const def = caseDefinition();
const provider: ResolvedProvider = {
  baseUrl: "https://provedor.exemplo/v1",
  model: "modelo-teste",
  apiKey: new SecretKey("sk-teste"),
};

function stateWith(collected: readonly string[]) {
  let state = createGameState(def);
  for (const id of collected) {
    const clue = def.clues.find((c) => c.id === id);
    state = collectClue(def, state, id, clue?.anchor?.position).state;
  }
  return state;
}

function emptyConversation(): Conversation {
  return { messages: [], turns: 0 };
}

/** Monta um turno com o servidor falso roteirizado. */
function turn(
  script: Parameters<typeof fakeOpenAI>[0],
  options: {
    collected?: readonly string[];
    conversation?: Conversation;
    playerMessage?: string;
  } = {},
) {
  const fake = fakeOpenAI(script);
  const promise = runAgentTurn({
    client: createChatClient(provider, fake.fetch),
    caseDefinition: def,
    agent: agentSpec(),
    lore: LORE,
    state: stateWith(options.collected ?? ["pista-cantaro"]),
    conversation: options.conversation ?? emptyConversation(),
    playerMessage: options.playerMessage ?? "Quem deixou o cântaro aqui?",
  });
  return { fake, promise };
}

describe("runAgentTurn", () => {
  it("TEST-27: devolve a fala do personagem", async () => {
    const { promise } = turn([{ content: "Não sei de que cântaro você fala." }]);
    const result = await promise;
    expect(result.reply).toBe("Não sei de que cântaro você fala.");
  });

  it("TEST-27: manda o system prompt como primeira mensagem", async () => {
    const { fake, promise } = turn([{ content: "..." }]);
    await promise;

    const first = fake.requests[0]?.body.messages[0];
    expect(first?.role).toBe("system");
    expect(String(first?.content)).toContain("Você é uma mulher de Samaria");
  });

  it("TEST-27: manda a pergunta do jogador como mensagem de usuário", async () => {
    const { fake, promise } = turn([{ content: "..." }], { playerMessage: "Você estava lá?" });
    await promise;

    const messages = fake.requests[0]?.body.messages ?? [];
    expect(messages[messages.length - 1]).toMatchObject({ role: "user", content: "Você estava lá?" });
  });

  it("TEST-28: executa a ferramenta pedida e continua a conversa", async () => {
    const { fake, promise } = turn([
      { toolCalls: [{ name: "consultar_lore", arguments: { busca: "poço" } }] },
      { content: "O poço é fundo, cavado há gerações." },
    ]);
    const result = await promise;

    expect(result.reply).toBe("O poço é fundo, cavado há gerações.");
    // Segunda chamada carrega o resultado da ferramenta.
    const second = fake.requests[1]?.body.messages ?? [];
    expect(second.some((m) => m.role === "tool")).toBe(true);
  });

  it("TEST-28: encadeia várias ferramentas no mesmo turno", async () => {
    const { fake, promise } = turn([
      { toolCalls: [{ name: "verificar_caderno", arguments: {} }] },
      { toolCalls: [{ name: "consultar_lore", arguments: { busca: "água" } }] },
      { content: "Vejo que você já achou o cântaro." },
    ]);
    const result = await promise;

    expect(result.reply).toContain("cântaro");
    expect(fake.requests).toHaveLength(3);
  });

  it("TEST-29: propaga para o estado a pista que o personagem revelou", async () => {
    const { promise } = turn(
      [
        { toolCalls: [{ name: "revelar_pista", arguments: { pista: "pista-confissao" } }] },
        { content: "Está bem. Fui eu quem deixou." },
      ],
      { collected: ["pista-cantaro", "pista-pegadas"] },
    );
    const result = await promise;

    expect(result.state.collectedClues).toContain("pista-confissao");
    expect(result.revealedClues).toEqual(["pista-confissao"]);
  });

  it("TEST-29: não altera o estado quando nenhuma pista é revelada", async () => {
    const { promise } = turn([{ content: "Não tenho nada a dizer." }]);
    const result = await promise;

    expect(result.state.collectedClues).toEqual(["pista-cantaro"]);
    expect(result.revealedClues).toEqual([]);
  });

  it("TEST-30: para no teto de chamadas de ferramenta em um turno", async () => {
    // Modelo que só pede ferramenta, para sempre: o teto é o que impede o laço infinito.
    const { fake, promise } = turn([{ toolCalls: [{ name: "verificar_caderno", arguments: {} }] }]);
    const result = await promise;

    expect(fake.requests.length).toBeLessThanOrEqual(9);
    expect(result.reply).toBeTruthy();
  });

  it("TEST-31: recusa passar do teto de turnos da conversa", async () => {
    const esgotada: Conversation = { messages: [], turns: 30 };
    const { promise } = turn([{ content: "..." }], { conversation: esgotada });

    await expect(promise).rejects.toThrow(/turnos/i);
  });

  it("TEST-32: mantém o histórico entre turnos", async () => {
    const primeiro = await turn([{ content: "Talvez eu tenha visto algo." }]).promise;

    const { fake, promise } = turn([{ content: "Já disse o que sabia." }], {
      conversation: primeiro.conversation,
      playerMessage: "O que você viu?",
    });
    await promise;

    const messages = fake.requests[0]?.body.messages ?? [];
    expect(messages.some((m) => m.role === "assistant" && m.content === "Talvez eu tenha visto algo.")).toBe(true);
    expect(messages.filter((m) => m.role === "system")).toHaveLength(1);
  });

  it("TEST-32: conta os turnos consumidos", async () => {
    const primeiro = await turn([{ content: "a" }]).promise;
    expect(primeiro.conversation.turns).toBe(1);

    const segundo = await turn([{ content: "b" }], { conversation: primeiro.conversation }).promise;
    expect(segundo.conversation.turns).toBe(2);
  });

  it("TEST-27: uma resposta sem conteúdo não vira 'null' na tela do jogador", async () => {
    const { promise } = turn([{}]);
    const result = await promise;
    expect(result.reply).not.toContain("null");
    expect(result.reply.length).toBeGreaterThan(0);
  });

  it("TEST-28: o estado usado pelas ferramentas parte do caderno atual", async () => {
    const { promise } = turn(
      [{ toolCalls: [{ name: "verificar_caderno", arguments: {} }] }, { content: "Você já sabe." }],
      { collected: ["pista-cantaro", "pista-pegadas"] },
    );
    const result = await promise;
    expect(result.state.collectedClues).toEqual(["pista-cantaro", "pista-pegadas"]);
  });

  it("TEST-28: argumentos de ferramenta em JSON inválido não derrubam o turno", async () => {
    // Modelos pequenos erram o JSON com alguma frequência; perder o turno por isso seria
    // pior para o jogador do que tratar como "sem argumentos".
    const fake = fakeOpenAI([
      { toolCalls: [{ name: "verificar_caderno", arguments: {} }] },
      { content: "Entendi." },
    ]);
    // Corrompe o JSON dos argumentos na saída do servidor falso.
    const corrompido: typeof fake.fetch = async (url, init) => {
      const response = await fake.fetch(url, init);
      const body = (await response.json()) as Record<string, unknown>;
      const choices = body["choices"] as { message: { tool_calls?: { function: { arguments: string } }[] } }[];
      const call = choices[0]?.message.tool_calls?.[0];
      if (call) call.function.arguments = "{isto não é json";
      return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
    };

    const result = await runAgentTurn({
      client: createChatClient(provider, corrompido),
      caseDefinition: def,
      agent: agentSpec(),
      lore: LORE,
      state: stateWith(["pista-cantaro"]),
      conversation: emptyConversation(),
      playerMessage: "E então?",
    });
    expect(result.reply).toBe("Entendi.");
  });

  it("TEST-30: nenhuma mensagem enviada contém o texto da página spoiler", async () => {
    const { fake, promise } = turn([
      { toolCalls: [{ name: "consultar_lore", arguments: { busca: "cântaro propósito verdade" } }] },
      { content: "Não sei." },
    ]);
    await promise;

    const todoOTrafego = JSON.stringify(fake.requests);
    expect(todoOTrafego).not.toContain("abandonou o cântaro de propósito");
    expect(todoOTrafego).not.toContain("casos/a-verdade");
  });
});

describe("runAgentTurn — geofence de conversa", () => {
  it("TEST-27: recusa conversar com personagem ainda bloqueado", async () => {
    const fake = fakeOpenAI([{ content: "..." }]);
    const promise = runAgentTurn({
      client: createChatClient(provider, fake.fetch),
      caseDefinition: def,
      agent: agentSpec(),
      lore: LORE,
      state: createGameState(def), // sem pista-cantaro, a samaritana não está desbloqueada
      conversation: emptyConversation(),
      playerMessage: "Olá?",
    });

    await expect(promise).rejects.toThrow(/bloquead|não desbloque/i);
    expect(fake.requests).toHaveLength(0);
  });

  it("TEST-27: conversa quando o personagem está desbloqueado", async () => {
    const fake = fakeOpenAI([{ content: "Diga." }]);
    const result = await runAgentTurn({
      client: createChatClient(provider, fake.fetch),
      caseDefinition: def,
      agent: agentSpec(),
      lore: LORE,
      state: collectClue(def, createGameState(def), "pista-cantaro", BARCARENA).state,
      conversation: emptyConversation(),
      playerMessage: "Olá?",
    });
    expect(result.reply).toBe("Diga.");
  });
});
