import { parse as parseYaml } from "yaml";

export interface Frontmatter {
  /** Dados do bloco YAML, ou `null` quando não há bloco (ou ele é inválido). */
  readonly data: Record<string, unknown> | null;
  /** O conteúdo depois do bloco. Sem frontmatter, é o arquivo inteiro. */
  readonly body: string;
  /** Preenchido quando havia um bloco, mas o YAML não pôde ser lido. */
  readonly error?: string;
}

/**
 * Lê o bloco `---` do início de um arquivo Markdown.
 *
 * Nunca lança: um arquivo malformado é dado de entrada normal aqui — quem chama quer um
 * diagnóstico para mostrar ao autor, não uma exceção para tratar.
 */
export function parseFrontmatter(text: string): Frontmatter {
  const normalized = text.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return { data: null, body: normalized };

  const end = normalized.indexOf("\n---", 3);
  if (end === -1) return { data: null, body: normalized };

  const raw = normalized.slice(4, end);
  const body = normalized.slice(end + 4).replace(/^\n/, "");

  try {
    const data = parseYaml(raw) as unknown;
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      return { data: null, body, error: "o frontmatter não é um mapa YAML" };
    }
    return { data: data as Record<string, unknown>, body };
  } catch (cause) {
    return { data: null, body, error: cause instanceof Error ? cause.message : String(cause) };
  }
}
