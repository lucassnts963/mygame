import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import { SecretKey, decryptSecret, encryptSecret, generateMasterKey } from "../src/agent/crypto.ts";

const MASTER = generateMasterKey();

describe("encryptSecret / decryptSecret", () => {
  it("TEST-01: faz a volta completa", () => {
    const plain = "sk-chave-de-provedor-do-jogador-123";
    expect(decryptSecret(encryptSecret(plain, MASTER), MASTER)).toBe(plain);
  });

  it("TEST-01: preserva acentos e caracteres não-ASCII", () => {
    const plain = "chave-com-acentuação-é-ç-ü";
    expect(decryptSecret(encryptSecret(plain, MASTER), MASTER)).toBe(plain);
  });

  it("TEST-02: usa IV novo a cada cifra", () => {
    const plain = "sk-mesma-chave";
    // Duas cifras do mesmo texto precisam ser diferentes, ou um observador do banco descobre
    // quais jogadores usam a mesma chave só comparando as colunas.
    expect(encryptSecret(plain, MASTER)).not.toBe(encryptSecret(plain, MASTER));
  });

  it("TEST-03: rejeita texto cifrado adulterado", () => {
    const encrypted = encryptSecret("sk-chave", MASTER);
    const tampered = encrypted.slice(0, -2) + (encrypted.endsWith("aa") ? "bb" : "aa");
    expect(() => decryptSecret(tampered, MASTER)).toThrow();
  });

  it("TEST-03: rejeita a chave-mestra errada", () => {
    const encrypted = encryptSecret("sk-chave", MASTER);
    expect(() => decryptSecret(encrypted, generateMasterKey())).toThrow();
  });

  it("TEST-03: rejeita formato irreconhecível", () => {
    expect(() => decryptSecret("isto-não-é-um-texto-cifrado", MASTER)).toThrow();
  });

  it("TEST-03: rejeita as três partes com tamanhos errados", () => {
    // Formato certo, conteúdo errado: sem checar os tamanhos, o createDecipheriv falharia
    // com uma mensagem de baixo nível que não diz nada a quem está depurando.
    expect(() => decryptSecret("YWJj:ZGVm:Z2hp", MASTER)).toThrow(/irreconhecível/);
  });

  it("TEST-01: cifra e decifra a string vazia", () => {
    expect(decryptSecret(encryptSecret("", MASTER), MASTER)).toBe("");
  });

  it("TEST-01: generateMasterKey produz uma chave utilizável", () => {
    const key = generateMasterKey();
    expect(key).toHaveLength(64);
    expect(decryptSecret(encryptSecret("sk-x", key), key)).toBe("sk-x");
  });

  it("TEST-01: recusa chave-mestra de tamanho errado", () => {
    expect(() => encryptSecret("sk-chave", "curta-demais")).toThrow(/32/);
  });
});

describe("SecretKey", () => {
  const key = new SecretKey("sk-abcdefghijklmnop3f9a");

  it("TEST-04: mascara em toString", () => {
    expect(String(key)).toBe("sk-…3f9a");
    expect(String(key)).not.toContain("abcdefgh");
  });

  it("TEST-04: mascara em JSON.stringify, mesmo dentro de um objeto", () => {
    const serialized = JSON.stringify({ provider: { model: "gpt-4o-mini", apiKey: key } });
    expect(serialized).toContain("sk-…3f9a");
    expect(serialized).not.toContain("abcdefghijklmnop");
  });

  it("TEST-04: mascara em interpolação de template", () => {
    expect(`chave=${key}`).not.toContain("abcdefgh");
  });

  it("TEST-04: mascara no inspect do Node — é o que console.log usa", () => {
    expect(inspect({ key })).not.toContain("abcdefghijklmnop");
  });

  it("TEST-04: mascara uma chave curta sem revelar o miolo", () => {
    expect(String(new SecretKey("abc"))).not.toContain("abc");
  });

  it("TEST-05: reveal() devolve o valor em claro", () => {
    expect(key.reveal()).toBe("sk-abcdefghijklmnop3f9a");
  });
});
