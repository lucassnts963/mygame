import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "../src/frontmatter.ts";

describe("parseFrontmatter", () => {
  it("TEST-01: separa o YAML do corpo", () => {
    const page = [
      "---",
      'title: "A mulher do poço"',
      "category: personagem",
      "canon: biblico",
      'source: "raw/joao-4.md"',
      "spoiler: false",
      "---",
      "",
      "# A mulher do poço",
      "",
      "Ela veio buscar água ao meio-dia.",
    ].join("\n");

    const parsed = parseFrontmatter(page);
    expect(parsed.data).toMatchObject({
      title: "A mulher do poço",
      category: "personagem",
      canon: "biblico",
      source: "raw/joao-4.md",
      spoiler: false,
    });
    expect(parsed.body).toContain("Ela veio buscar água ao meio-dia.");
    expect(parsed.body).not.toContain("category:");
  });

  it("TEST-01: tolera CRLF", () => {
    const page = "---\r\ntitle: Teste\r\n---\r\n\r\nCorpo.";
    expect(parseFrontmatter(page).data).toMatchObject({ title: "Teste" });
  });

  it("TEST-02: devolve data nula quando não há frontmatter", () => {
    const parsed = parseFrontmatter("# Só um título\n\nCorpo.");
    expect(parsed.data).toBeNull();
    expect(parsed.body).toContain("Só um título");
  });

  it("TEST-02: trata frontmatter aberto e não fechado como ausente", () => {
    expect(parseFrontmatter("---\ntitle: Teste\n\nsem fechamento").data).toBeNull();
  });

  it("TEST-03: reporta YAML inválido em vez de lançar", () => {
    const parsed = parseFrontmatter("---\ntitle: [nao fecha\n---\n\nCorpo.");
    expect(parsed.data).toBeNull();
    expect(parsed.error).toBeTruthy();
  });

  it("TEST-03: reporta frontmatter que é lista em vez de mapa", () => {
    const parsed = parseFrontmatter("---\n- um\n- dois\n---\n\nCorpo.");
    expect(parsed.data).toBeNull();
    expect(parsed.error).toContain("mapa");
  });

  it("TEST-03: reporta frontmatter vazio", () => {
    const parsed = parseFrontmatter("---\n\n---\n\nCorpo.");
    expect(parsed.data).toBeNull();
    expect(parsed.error).toContain("mapa");
  });
});
