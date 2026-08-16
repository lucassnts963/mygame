import { parseFrontmatter } from "./frontmatter.ts";
import type { Diagnostic } from "./types.ts";

/**
 * As 6 seções canônicas, na ordem, conforme `.specs/config.md## Skill Format`.
 *
 * São as mesmas regras que o `check-consistency.mjs` aplica às skills do repositório. Isso é
 * deliberado (ADR-009): quem aprende a escrever uma skill do projeto já sabe escrever uma skill
 * de personagem — a metodologia vira mecânica de criação de conteúdo.
 */
export const CANONICAL_SECTIONS = [
  "## Purpose",
  "## Prerequisites",
  "## Instructions",
  "## Output",
  "## Examples",
  "## References",
] as const;

/** `verbo-substantivo`, minúsculas e hifens. */
const NAME_PATTERN = /^[a-z]+(-[a-z]+)+$/;

/** Abaixo disto a descrição não serve de gatilho: o agente não consegue decidir quando usar. */
const MIN_DESCRIPTION_LENGTH = 40;

/** Valida um `SKILL.md` contra o formato do kit. `folder` é o nome da pasta que o contém. */
export function validateSkill(folder: string, content: string): readonly Diagnostic[] {
  const file = `skills/${folder}/SKILL.md`;
  const diagnostics: Diagnostic[] = [];
  const error = (code: string, message: string): void => {
    diagnostics.push({ severity: "error", code, file, message });
  };

  const { data } = parseFrontmatter(content);
  if (!data) {
    error("skill-missing-frontmatter", "faltando o bloco de frontmatter YAML no topo do arquivo");
    return diagnostics;
  }

  const name = typeof data["name"] === "string" ? data["name"] : null;
  const description = typeof data["description"] === "string" ? data["description"] : null;

  if (!name) {
    error("skill-missing-name", "o frontmatter precisa de 'name'");
  } else if (name !== folder) {
    error("skill-name-mismatch", `name '${name}' precisa ser igual ao nome da pasta '${folder}'`);
  } else if (!NAME_PATTERN.test(name)) {
    error("skill-name-format", `name '${name}' precisa ser verbo-substantivo (minúsculas e hifens)`);
  }

  if (!description) {
    error("skill-missing-description", "o frontmatter precisa de 'description'");
  } else if (description.length < MIN_DESCRIPTION_LENGTH) {
    error(
      "skill-description-too-short",
      "a 'description' é o que o agente lê para decidir se usa a skill — seja específico e inclua os gatilhos",
    );
  }

  let lastIndex = -1;
  let outOfOrder = false;
  for (const section of CANONICAL_SECTIONS) {
    const index = content.indexOf(section);
    if (index === -1) {
      error("skill-missing-section", `faltando a seção '${section}'`);
      continue;
    }
    if (index < lastIndex) outOfOrder = true;
    lastIndex = index;
  }
  if (outOfOrder) {
    error("skill-section-order", `as seções precisam aparecer nesta ordem: ${CANONICAL_SECTIONS.join(", ")}`);
  }

  return diagnostics;
}
