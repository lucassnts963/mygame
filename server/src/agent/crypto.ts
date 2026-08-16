import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Uma chave de API que **não sabe se imprimir**.
 *
 * `toString`, `toJSON` e o inspect do Node devolvem a máscara. O valor em claro só sai por
 * `.reveal()`, chamado num único lugar do código: a montagem do header da requisição.
 *
 * A diferença em relação a "lembrar de mascarar no endpoint" é grande: aqui vazar por descuido é
 * impossível. Um `console.log(config)` ou o `JSON.stringify` de um erro imprimem `sk-…3f9a`. O
 * risco deixa de depender de disciplina e passa a depender do tipo (ADR-008).
 */
export class SecretKey {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  /** O valor em claro. Chame só onde a chave precisa sair para o provider. */
  reveal(): string {
    return this.#value;
  }

  /** Uma pista suficiente para depurar, curta demais para servir de credencial. */
  get masked(): string {
    if (this.#value.length === 0) return "(sem chave)";
    // Uma chave curta não expõe nem os últimos caracteres: em segredo curto, sufixo é quase tudo.
    if (this.#value.length < 12) return "sk-…";
    return `sk-…${this.#value.slice(-4)}`;
  }

  toString(): string {
    return this.masked;
  }

  toJSON(): string {
    return this.masked;
  }

  /** `console.log` e `util.inspect` passam por aqui. */
  [Symbol.for("nodejs.util.inspect.custom")](): string {
    return this.masked;
  }
}

/** Gera uma chave-mestra nova, em hexadecimal. Use para popular a variável de ambiente. */
export function generateMasterKey(): string {
  return randomBytes(KEY_BYTES).toString("hex");
}

function toKeyBuffer(masterKey: string): Buffer {
  const key = Buffer.from(masterKey, "hex");
  if (key.length !== KEY_BYTES) {
    throw new Error(`a chave-mestra precisa ter ${KEY_BYTES} bytes (${KEY_BYTES * 2} caracteres hex)`);
  }
  return key;
}

/**
 * Cifra um segredo com AES-256-GCM. O resultado é `iv:tag:ciphertext` em base64.
 *
 * O IV é novo a cada chamada — sem isso, duas linhas iguais no banco denunciariam que dois
 * jogadores usam a mesma chave, mesmo sem ninguém decifrar nada.
 */
export function encryptSecret(plaintext: string, masterKey: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, toKeyBuffer(masterKey), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(":");
}

/** Decifra o que `encryptSecret` produziu. Lança se a chave estiver errada ou o texto adulterado. */
export function decryptSecret(encrypted: string, masterKey: string): string {
  const parts = encrypted.split(":");
  if (parts.length !== 3) throw new Error("texto cifrado em formato irreconhecível");

  const [ivPart, tagPart, dataPart] = parts as [string, string, string];
  const iv = Buffer.from(ivPart, "base64");
  const tag = Buffer.from(tagPart, "base64");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("texto cifrado em formato irreconhecível");
  }

  const decipher = createDecipheriv(ALGORITHM, toKeyBuffer(masterKey), iv);
  decipher.setAuthTag(tag);
  // `final()` lança quando a tag não confere — é o GCM provando que ninguém mexeu no texto.
  return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64")), decipher.final()]).toString("utf8");
}
