import { describe, expect, it } from "vitest";
import { resolveProvider } from "../src/agent/provider-resolution.ts";
import type { ProviderConfig } from "../src/agent/types.ts";

const serverDefault: ProviderConfig = {
  baseUrl: "https://servidor.exemplo/v1",
  model: "modelo-do-servidor",
  apiKeyEnv: "VESTIGIO_SERVER_KEY",
};

const env = {
  VESTIGIO_SERVER_KEY: "sk-do-servidor",
  VESTIGIO_MODULO_KEY: "sk-do-modulo",
  VESTIGIO_SAMARITANA_KEY: "sk-da-samaritana",
};

describe("resolveProvider", () => {
  it("TEST-06: o provider do personagem vence o do módulo e o do servidor", () => {
    const resolved = resolveProvider({
      character: {
        baseUrl: "https://personagem.exemplo/v1",
        model: "modelo-do-personagem",
        apiKeyEnv: "VESTIGIO_SAMARITANA_KEY",
      },
      module: { baseUrl: "https://modulo.exemplo/v1", model: "m", apiKeyEnv: "VESTIGIO_MODULO_KEY" },
      server: serverDefault,
      env,
    });

    expect(resolved.baseUrl).toBe("https://personagem.exemplo/v1");
    expect(resolved.model).toBe("modelo-do-personagem");
    expect(resolved.apiKey.reveal()).toBe("sk-da-samaritana");
  });

  it("TEST-07: o provider do módulo vence o do servidor", () => {
    const resolved = resolveProvider({
      module: { baseUrl: "https://modulo.exemplo/v1", model: "modelo-do-modulo", apiKeyEnv: "VESTIGIO_MODULO_KEY" },
      server: serverDefault,
      env,
    });
    expect(resolved.model).toBe("modelo-do-modulo");
    expect(resolved.apiKey.reveal()).toBe("sk-do-modulo");
  });

  it("TEST-07: sem personagem nem módulo, usa o do servidor", () => {
    const resolved = resolveProvider({ server: serverDefault, env });
    expect(resolved.baseUrl).toBe("https://servidor.exemplo/v1");
    expect(resolved.apiKey.reveal()).toBe("sk-do-servidor");
  });

  it("TEST-06: a cascata é por nível inteiro, não campo a campo", () => {
    // Um personagem que declara provider assume o provider inteiro. Herdar o modelo de um nível
    // e a URL de outro produziria combinações que ninguém escreveu — e que quebram em produção.
    const resolved = resolveProvider({
      character: { baseUrl: "https://personagem.exemplo/v1", model: "m", apiKeyEnv: "VESTIGIO_SAMARITANA_KEY" },
      server: { ...serverDefault, temperature: 0.9 },
      env,
    });
    expect(resolved.temperature).toBeUndefined();
  });

  it("TEST-08: sem nenhum provider, erro claro antes de qualquer chamada", () => {
    expect(() => resolveProvider({ env })).toThrow(/nenhum provider/i);
  });

  it("TEST-09: variável de ambiente ausente é erro nomeando a variável", () => {
    expect(() =>
      resolveProvider({ server: { ...serverDefault, apiKeyEnv: "VESTIGIO_NAO_DEFINIDA" }, env }),
    ).toThrow(/VESTIGIO_NAO_DEFINIDA/);
  });

  it("TEST-09: variável definida como string vazia conta como ausente", () => {
    expect(() =>
      resolveProvider({ server: serverDefault, env: { VESTIGIO_SERVER_KEY: "" } }),
    ).toThrow(/VESTIGIO_SERVER_KEY/);
  });

  it("TEST-09: aceita provider sem chave — um modelo local não precisa de uma", () => {
    const resolved = resolveProvider({
      server: { baseUrl: "http://localhost:11434/v1", model: "llama3" },
      env: {},
    });
    expect(resolved.apiKey.reveal()).toBe("");
  });

  it("TEST-06: preserva temperature e maxTokens do nível escolhido", () => {
    const resolved = resolveProvider({
      character: {
        baseUrl: "https://p.exemplo/v1",
        model: "m",
        apiKeyEnv: "VESTIGIO_SAMARITANA_KEY",
        temperature: 0.7,
        maxTokens: 200,
      },
      env,
    });
    expect(resolved.temperature).toBe(0.7);
    expect(resolved.maxTokens).toBe(200);
  });
});
