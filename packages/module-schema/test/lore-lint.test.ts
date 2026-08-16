import { describe, expect, it } from "vitest";
import { lintLore } from "../src/lore-lint.ts";
import type { LorePage } from "../src/types.ts";

function page(path: string, frontmatter: Record<string, unknown>, body = "Corpo da página."): LorePage {
  const yaml = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? JSON.stringify(v) : v}`)
    .join("\n");
  return { path, content: `---\n${yaml}\n---\n\n${body}` };
}

const codes = (ds: readonly { code: string }[]) => ds.map((d) => d.code);

const validPage = (path: string, body?: string) =>
  page(path, { title: "T", category: "personagem", canon: "ficcional", spoiler: false }, body);

describe("lintLore", () => {
  it("TEST-10: aprova uma lore bem formada", () => {
    expect(lintLore([validPage("personagens/samaritana", "[[lugares/poco]]"), validPage("lugares/poco", "[[personagens/samaritana]]")])).toEqual([]);
  });

  it("TEST-10: recusa página sem frontmatter", () => {
    const ds = lintLore([{ path: "personagens/samaritana", content: "# Sem frontmatter" }]);
    expect(codes(ds)).toContain("missing-frontmatter");
  });

  it("TEST-10: recusa página com frontmatter ilegível, dizendo o porquê", () => {
    const ds = lintLore([
      { path: "personagens/samaritana", content: "---\ntitle: [nao fecha\n---\n\nCorpo." },
    ]);
    expect(codes(ds)).toContain("missing-frontmatter");
    expect(ds[0]?.message).toContain("ilegível");
  });

  it("TEST-10: uma página ilegível não impede o lint das demais", () => {
    const ds = lintLore([
      { path: "personagens/samaritana", content: "---\ntitle: [nao fecha\n---\n" },
      page("lugares/poco", { title: "T", category: "lugar", canon: "biblico" }),
    ]);
    expect(codes(ds)).toContain("missing-frontmatter");
    expect(codes(ds)).toContain("unsourced-canon");
  });

  it("TEST-10: recusa frontmatter sem os campos obrigatórios", () => {
    const ds = lintLore([page("personagens/samaritana", { title: "T" })]);
    expect(codes(ds)).toContain("missing-frontmatter");
    expect(ds[0]?.message).toMatch(/category|canon/);
  });

  it("TEST-11: recusa canon bíblico sem fonte", () => {
    const ds = lintLore([
      page("personagens/samaritana", { title: "T", category: "personagem", canon: "biblico" }),
    ]);
    expect(codes(ds)).toContain("unsourced-canon");
  });

  it("TEST-11: aceita canon bíblico com fonte", () => {
    const ds = lintLore([
      page("personagens/samaritana", {
        title: "T",
        category: "personagem",
        canon: "biblico",
        source: "raw/joao-4.md",
      }),
    ]);
    expect(ds).toEqual([]);
  });

  it("TEST-11: não exige fonte de página ficcional", () => {
    expect(lintLore([validPage("casos/inventado")])).toEqual([]);
  });

  it("TEST-12: recusa link interno quebrado", () => {
    const ds = lintLore([validPage("personagens/samaritana", "Ver [[lugares/nao-existe]].")]);
    expect(codes(ds)).toContain("broken-link");
    expect(ds[0]?.message).toContain("lugares/nao-existe");
  });

  it("TEST-12: aceita link com o prefixo lore/wiki/", () => {
    const ds = lintLore([
      validPage("personagens/samaritana", "Ver [[lore/wiki/lugares/poco]]."),
      validPage("lugares/poco"),
    ]);
    expect(codes(ds)).not.toContain("broken-link");
  });

  it("TEST-13: avisa página órfã, sem reprovar", () => {
    const ds = lintLore([validPage("personagens/samaritana"), validPage("lugares/poco")]);
    expect(codes(ds)).toContain("orphan");
    expect(ds.every((d) => d.severity === "warning")).toBe(true);
  });

  it("TEST-13: uma página só não é considerada órfã", () => {
    // Não há de onde linkar: cobrar link de entrada num módulo de uma página só seria ruído.
    expect(lintLore([validPage("personagens/samaritana")])).toEqual([]);
  });

  it("TEST-13: página spoiler nunca é acusada de órfã", () => {
    // Quem chega numa página spoiler é o motor, ao julgar a acusação — nunca a navegação.
    // Ela é não-linkada de propósito, e é exatamente assim que deve ser.
    const spoiler = page("casos/a-verdade", {
      title: "A verdade",
      category: "caso",
      canon: "ficcional",
      spoiler: true,
    });
    const ds = lintLore([validPage("personagens/samaritana"), spoiler]);
    expect(codes(ds)).not.toContain("orphan");
  });

  it("TEST-13: a página spoiler também não conta para o mínimo de páginas navegáveis", () => {
    const spoiler = page("casos/a-verdade", {
      title: "A verdade",
      category: "caso",
      canon: "ficcional",
      spoiler: true,
    });
    // Uma navegável + uma spoiler: continua sem de onde linkar, então nada a reportar.
    expect(lintLore([validPage("personagens/samaritana"), spoiler])).toEqual([]);
  });
});
