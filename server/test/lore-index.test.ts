import { describe, expect, it } from "vitest";
import { buildLoreIndex } from "../src/agent/lore-index.ts";
import type { LorePage } from "@vestigio/module-schema";

function page(path: string, title: string, body: string, spoiler = false): LorePage {
  return {
    path,
    content: [
      "---",
      `title: ${JSON.stringify(title)}`,
      "category: personagem",
      "canon: ficcional",
      `spoiler: ${spoiler}`,
      "---",
      "",
      body,
    ].join("\n"),
  };
}

const pages: LorePage[] = [
  page("personagens/samaritana", "A mulher do poço", "Ela veio buscar água ao meio-dia, sozinha."),
  page("lugares/poco-de-jaco", "O poço de Jacó", "Um poço fundo, cavado há gerações, na estrada de Sicar."),
  page("casos/a-verdade", "A verdade", "Foi ela quem abandonou o cântaro de propósito.", true),
];

describe("buildLoreIndex", () => {
  const index = buildLoreIndex(pages);

  it("TEST-13: acha por palavra do corpo", () => {
    const hits = index.search("cavado");
    expect(hits.map((h) => h.path)).toEqual(["lugares/poco-de-jaco"]);
    expect(hits[0]?.excerpt).toContain("cavado");
  });

  it("TEST-14: acha por palavra do título", () => {
    expect(index.search("mulher").map((h) => h.path)).toEqual(["personagens/samaritana"]);
  });

  it("TEST-13: ignora acentos e caixa na busca", () => {
    expect(index.search("MEIO-DIA").map((h) => h.path)).toEqual(["personagens/samaritana"]);
    expect(index.search("jaco").map((h) => h.path)).toContain("lugares/poco-de-jaco");
  });

  it("TEST-15: NUNCA indexa uma página spoiler", () => {
    // A verdade do caso não está no índice — não é filtrada na resposta, ela nunca entrou.
    // É por isso que nenhum jogo de palavras do jogador a extrai do NPC (ADR-006).
    expect(index.search("cântaro")).toEqual([]);
    expect(index.search("verdade")).toEqual([]);
    expect(index.search("propósito")).toEqual([]);
  });

  it("TEST-15: a página spoiler não aparece nem listando o índice inteiro", () => {
    expect(index.paths).not.toContain("casos/a-verdade");
    expect(index.paths).toHaveLength(2);
  });

  it("TEST-16: busca sem resultado devolve vazio", () => {
    expect(index.search("dragão")).toEqual([]);
  });

  it("TEST-16: busca vazia devolve vazio, em vez de tudo", () => {
    expect(index.search("   ")).toEqual([]);
  });

  it("TEST-13: ordena por relevância — mais ocorrências primeiro", () => {
    const denso = page("lugares/agua", "Água", "água água água em toda parte");
    const raro = page("lugares/estrada", "Estrada", "havia água no fim da estrada");
    const hits = buildLoreIndex([denso, raro]).search("água");
    expect(hits[0]?.path).toBe("lugares/agua");
  });

  it("TEST-13: limita a quantidade de trechos devolvidos", () => {
    const muitas = Array.from({ length: 20 }, (_, i) =>
      page(`lugares/p${i}`, `Lugar ${i}`, "havia água ali"),
    );
    expect(buildLoreIndex(muitas).search("água").length).toBeLessThanOrEqual(5);
  });

  it("TEST-16: índice vazio não quebra", () => {
    expect(buildLoreIndex([]).search("qualquer")).toEqual([]);
  });

  it("TEST-14: página sem title no frontmatter cai para o caminho", () => {
    const semTitulo: LorePage = {
      path: "lugares/sem-nome",
      content: "---\ncategory: lugar\ncanon: ficcional\n---\n\nUm lugar qualquer com uma nascente.",
    };
    const hits = buildLoreIndex([semTitulo]).search("nascente");
    expect(hits[0]?.title).toBe("lugares/sem-nome");
  });

  it("TEST-13: recorta o trecho em torno da ocorrência, não do começo da página", () => {
    const longa = page(
      "lugares/longa",
      "Longa",
      `${"palavra ".repeat(120)}AGULHA ${"outra ".repeat(120)}`,
    );
    const excerpt = buildLoreIndex([longa]).search("agulha")[0]?.excerpt ?? "";
    expect(excerpt.toLowerCase()).toContain("agulha");
    expect(excerpt.startsWith("…")).toBe(true);
  });

  it("TEST-13: acha quando o termo está só no título", () => {
    // O corpo não contém a palavra, então o recorte não tem onde se centrar — e mesmo assim
    // a página precisa aparecer, com um trecho útil.
    const hits = buildLoreIndex([page("lugares/sicar", "Sicar", "Uma cidade antiga.")]).search("sicar");
    expect(hits[0]?.path).toBe("lugares/sicar");
    expect(hits[0]?.excerpt).toContain("cidade antiga");
  });
});
