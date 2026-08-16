import { describe, expect, it } from "vitest";
import { validateSkill } from "../src/skill-validator.ts";

/** Skill bem formada, no formato de `.specs/config.md## Skill Format`. */
function wellFormedSkill(overrides: { name?: string; description?: string } = {}): string {
  const name = overrides.name ?? "interrogar-testemunha";
  const description =
    overrides.description ??
    "Conduz um interrogatório em personagem, sem afirmar nada fora da lore. Use quando o detetive fizer uma pergunta direta.";

  return [
    "---",
    `name: ${name}`,
    "description: >-",
    `  ${description}`,
    "---",
    "",
    "# Interrogar testemunha",
    "",
    "## Purpose",
    "Conduzir o interrogatório.",
    "",
    "## Prerequisites",
    "A lore do módulo.",
    "",
    "## Instructions",
    "### Passo 1",
    "Consulte a lore antes de afirmar qualquer coisa.",
    "",
    "## Output",
    "Uma fala em personagem.",
    "",
    "## Examples",
    "### Exemplo 1",
    "O detetive pergunta pelo cântaro.",
    "",
    "## References",
    "lore/WIKI_SCHEMA.md",
  ].join("\n");
}

const codes = (ds: readonly { code: string }[]) => ds.map((d) => d.code);

describe("validateSkill", () => {
  it("TEST-04: aprova uma skill bem formada", () => {
    expect(validateSkill("interrogar-testemunha", wellFormedSkill())).toEqual([]);
  });

  it("TEST-05: recusa quando falta uma das seções canônicas", () => {
    const semOutput = wellFormedSkill().replace("## Output\nUma fala em personagem.\n", "");
    const ds = validateSkill("interrogar-testemunha", semOutput);
    expect(codes(ds)).toContain("skill-missing-section");
    expect(ds[0]?.message).toContain("## Output");
  });

  it("TEST-05: recusa quando as seções estão fora de ordem", () => {
    const trocado = wellFormedSkill()
      .replace("## Purpose\nConduzir o interrogatório.", "## Prerequisites\nA lore do módulo.")
      .replace("## Prerequisites\nA lore do módulo.\n\n## Instructions", "## Purpose\nConduzir o interrogatório.\n\n## Instructions");
    expect(codes(validateSkill("interrogar-testemunha", trocado))).toContain("skill-section-order");
  });

  it("TEST-06: recusa nome diferente da pasta", () => {
    const ds = validateSkill("outra-pasta", wellFormedSkill());
    expect(codes(ds)).toContain("skill-name-mismatch");
  });

  it("TEST-06: recusa nome fora do padrão verbo-substantivo", () => {
    const ds = validateSkill("Interrogar", wellFormedSkill({ name: "Interrogar" }));
    expect(codes(ds)).toContain("skill-name-format");
  });

  it("TEST-07: recusa descrição curta demais para servir de gatilho", () => {
    const ds = validateSkill("interrogar-testemunha", wellFormedSkill({ description: "Interroga." }));
    expect(codes(ds)).toContain("skill-description-too-short");
  });

  it("TEST-04: recusa arquivo sem frontmatter", () => {
    expect(codes(validateSkill("interrogar-testemunha", "# Sem frontmatter"))).toContain(
      "skill-missing-frontmatter",
    );
  });

  it("TEST-04: recusa frontmatter sem name", () => {
    const semNome = wellFormedSkill().replace("name: interrogar-testemunha\n", "");
    expect(codes(validateSkill("interrogar-testemunha", semNome))).toContain("skill-missing-name");
  });

  it("TEST-07: recusa frontmatter sem description", () => {
    const semDescricao = wellFormedSkill().replace(
      /description: >-\n {2}.*\n/,
      "",
    );
    expect(codes(validateSkill("interrogar-testemunha", semDescricao))).toContain(
      "skill-missing-description",
    );
  });
});
