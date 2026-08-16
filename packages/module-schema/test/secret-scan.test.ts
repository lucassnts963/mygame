import { describe, expect, it } from "vitest";
import { scanForSecrets } from "../src/secret-scan.ts";

const codes = (ds: readonly { code: string }[]) => ds.map((d) => d.code);

describe("scanForSecrets", () => {
  it("TEST-08: acha uma chave no formato sk-…", () => {
    const ds = scanForSecrets("agents/samaritana.agent.yaml", "token: sk-abc123def456ghi789jkl012mno345");
    expect(codes(ds)).toContain("secret-literal");
    expect(ds[0]?.file).toBe("agents/samaritana.agent.yaml");
  });

  it("TEST-08: acha api_key com valor literal", () => {
    expect(codes(scanForSecrets("a.yaml", 'api_key: "minha-chave-secreta-do-provedor"'))).toContain(
      "secret-literal",
    );
  });

  it("TEST-08: acha apiKey em camelCase", () => {
    expect(codes(scanForSecrets("a.yaml", 'apiKey: "abc123xyz789"'))).toContain("secret-literal");
  });

  it("TEST-08: acha um header Authorization: Bearer", () => {
    expect(codes(scanForSecrets("a.yaml", "authorization: Bearer abc123def456ghi"))).toContain(
      "secret-literal",
    );
  });

  it("TEST-08: reporta a linha onde o segredo está", () => {
    const conteudo = ["id: samaritana", "provider:", '  api_key: "chave-literal-aqui"'].join("\n");
    expect(scanForSecrets("a.yaml", conteudo)[0]?.line).toBe(3);
  });

  it("TEST-09: aceita api_key_env, que guarda só o nome da variável", () => {
    expect(scanForSecrets("a.yaml", "api_key_env: VESTIGIO_SAMARITANA_KEY")).toEqual([]);
  });

  it("TEST-09: aceita api_key vazio ou nulo", () => {
    expect(scanForSecrets("a.yaml", "api_key:\napi_key: null")).toEqual([]);
  });

  it("TEST-09: aceita uma referência a variável de ambiente", () => {
    expect(scanForSecrets("a.yaml", "api_key: ${VESTIGIO_KEY}")).toEqual([]);
  });

  it("TEST-09: não confunde prosa da lore com segredo", () => {
    const lore = "Ela guardava a chave do portão sob a pedra, e ninguém sabia disso.";
    expect(scanForSecrets("lore/wiki/personagens/samaritana.md", lore)).toEqual([]);
  });

  it("TEST-09: ignora chave em comentário", () => {
    // Comentário não é configuração — e o autor costuma deixar um exemplo comentado.
    expect(scanForSecrets("a.yaml", "# api_key: sk-exemplo-do-que-nao-fazer")).toEqual([]);
  });

  it("TEST-08: um segredo por linha, sem duplicar diagnóstico", () => {
    const ds = scanForSecrets("a.yaml", "api_key: sk-abc123def456ghi789jkl");
    expect(ds).toHaveLength(1);
  });

  it("TEST-09: arquivo limpo não gera nada", () => {
    expect(scanForSecrets("a.yaml", "id: samaritana\nname: A mulher do poço")).toEqual([]);
  });
});
