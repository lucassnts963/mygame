import { describe, expect, it } from "vitest";
import { SecretKey } from "../src/agent/crypto.ts";
import { createChatClient } from "../src/agent/openai-client.ts";
import type { ResolvedProvider } from "../src/agent/types.ts";
import { fakeOpenAI, failingOpenAI, garbageOpenAI } from "./fake-openai.ts";

const provider: ResolvedProvider = {
  baseUrl: "https://provedor.exemplo/v1",
  model: "modelo-teste",
  apiKey: new SecretKey("sk-chave-secreta-do-jogador-abcd"),
};

const askSomething = [{ role: "user" as const, content: "Quem deixou o cântaro?" }];

describe("createChatClient", () => {
  it("TEST-10: envia mensagens, modelo e ferramentas para /chat/completions", async () => {
    const fake = fakeOpenAI([{ content: "Não sei do que fala." }]);
    const client = createChatClient(provider, fake.fetch);

    const reply = await client.complete(askSomething, [
      { name: "consultar_lore", description: "Consulta a lore", parameters: { type: "object", properties: {} } },
    ]);

    expect(reply.content).toBe("Não sei do que fala.");
    expect(fake.requests[0]?.url).toBe("https://provedor.exemplo/v1/chat/completions");
    expect(fake.requests[0]?.body.model).toBe("modelo-teste");
    expect(fake.requests[0]?.body.messages).toEqual(askSomething);
    expect(fake.requests[0]?.body.tools?.[0]?.function.name).toBe("consultar_lore");
  });

  it("TEST-10: junta a barra da URL sem duplicar", async () => {
    const fake = fakeOpenAI([{ content: "ok" }]);
    await createChatClient({ ...provider, baseUrl: "https://provedor.exemplo/v1/" }, fake.fetch).complete(
      askSomething,
      [],
    );
    expect(fake.requests[0]?.url).toBe("https://provedor.exemplo/v1/chat/completions");
  });

  it("TEST-10: omite tools quando não há ferramenta", async () => {
    const fake = fakeOpenAI([{ content: "ok" }]);
    await createChatClient(provider, fake.fetch).complete(askSomething, []);
    expect(fake.requests[0]?.body.tools).toBeUndefined();
  });

  it("TEST-11: manda a chave no header Authorization", async () => {
    const fake = fakeOpenAI([{ content: "ok" }]);
    await createChatClient(provider, fake.fetch).complete(askSomething, []);
    expect(fake.requests[0]?.headers["Authorization"]).toBe("Bearer sk-chave-secreta-do-jogador-abcd");
  });

  it("TEST-11: omite o header quando o provider não tem chave (modelo local)", async () => {
    const fake = fakeOpenAI([{ content: "ok" }]);
    await createChatClient({ ...provider, apiKey: new SecretKey("") }, fake.fetch).complete(askSomething, []);
    expect(fake.requests[0]?.headers["Authorization"]).toBeUndefined();
  });

  it("TEST-10: repassa temperature e max_tokens quando definidos", async () => {
    const fake = fakeOpenAI([{ content: "ok" }]);
    const comLimites = { ...provider, temperature: 0.4, maxTokens: 150 };
    await createChatClient(comLimites, fake.fetch).complete(askSomething, []);

    const body = fake.requests[0]?.body as unknown as Record<string, unknown>;
    expect(body["temperature"]).toBe(0.4);
    expect(body["max_tokens"]).toBe(150);
  });

  it("TEST-10: devolve as tool_calls que o modelo pediu", async () => {
    const fake = fakeOpenAI([{ toolCalls: [{ name: "consultar_lore", arguments: { busca: "cântaro" } }] }]);
    const reply = await createChatClient(provider, fake.fetch).complete(askSomething, []);

    expect(reply.tool_calls?.[0]?.function.name).toBe("consultar_lore");
    expect(JSON.parse(reply.tool_calls?.[0]?.function.arguments ?? "{}")).toEqual({ busca: "cântaro" });
  });

  it("TEST-12: erro HTTP vira exceção com o status", async () => {
    const client = createChatClient(provider, failingOpenAI(500));
    await expect(client.complete(askSomething, [])).rejects.toThrow(/500/);
  });

  it("TEST-12: a mensagem de erro NUNCA contém a chave", async () => {
    const client = createChatClient(provider, failingOpenAI(401, { error: "unauthorized" }));
    await expect(client.complete(askSomething, [])).rejects.toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining("sk-chave-secreta-do-jogador-abcd"),
      }),
    );
  });

  it("TEST-12: resposta que não é JSON vira erro tratado", async () => {
    const client = createChatClient(provider, garbageOpenAI());
    await expect(client.complete(askSomething, [])).rejects.toThrow(/resposta/i);
  });

  it("TEST-12: resposta JSON sem choices vira erro tratado", async () => {
    const semChoices: typeof fetch = (async () =>
      new Response(JSON.stringify({ id: "x" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;

    const client = createChatClient(provider, semChoices as never);
    await expect(client.complete(askSomething, [])).rejects.toThrow(/resposta/i);
  });
});
