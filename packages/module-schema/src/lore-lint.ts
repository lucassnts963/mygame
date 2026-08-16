import { parseFrontmatter } from "./frontmatter.ts";
import type { Diagnostic, LorePage } from "./types.ts";

/** Campos que toda página precisa ter, conforme `lore/WIKI_SCHEMA.md## Frontmatter obrigatório`. */
const REQUIRED_FIELDS = ["title", "category", "canon"] as const;

/** Padrões de canon que exigem fonte: o que se apresenta como verdade precisa ser verificável. */
const SOURCED_CANON = new Set(["biblico", "historico"]);

/** Links internos no formato `[[caminho/da/pagina]]`. */
const LINK_PATTERN = /\[\[([^\]]+)\]\]/g;

const normalizeTarget = (target: string): string =>
  target.trim().replace(/^lore\/wiki\//, "").replace(/\.md$/, "");

/**
 * Health-check da lore, conforme `lore/WIKI_SCHEMA.md## Lint`.
 *
 * A divisão entre `error` e `warning` segue o mesmo princípio das duas camadas da metodologia:
 * o que é estrutural e decidível por script reprova; o que depende de julgamento (uma página
 * órfã pode ser intencional) apenas avisa.
 */
export function lintLore(pages: readonly LorePage[]): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const known = new Set(pages.map((p) => normalizeTarget(p.path)));
  const linked = new Set<string>();

  for (const page of pages) {
    const file = `lore/wiki/${page.path}.md`;
    const { data, body, error } = parseFrontmatter(page.content);

    if (!data) {
      diagnostics.push({
        severity: "error",
        code: "missing-frontmatter",
        file,
        message: error ? `frontmatter ilegível: ${error}` : "faltando o bloco de frontmatter YAML",
      });
      continue;
    }

    const missing = REQUIRED_FIELDS.filter((field) => data[field] === undefined);
    if (missing.length > 0) {
      diagnostics.push({
        severity: "error",
        code: "missing-frontmatter",
        file,
        message: `faltando no frontmatter: ${missing.join(", ")}`,
      });
    }

    const canon = data["canon"];
    if (typeof canon === "string" && SOURCED_CANON.has(canon) && !data["source"]) {
      diagnostics.push({
        severity: "error",
        code: "unsourced-canon",
        file,
        message: `canon '${canon}' exige 'source' — uma afirmação apresentada como verdadeira precisa ser verificável`,
      });
    }

    for (const match of body.matchAll(LINK_PATTERN)) {
      const target = normalizeTarget(match[1] ?? "");
      linked.add(target);
      if (!known.has(target)) {
        diagnostics.push({
          severity: "error",
          code: "broken-link",
          file,
          message: `o link [[${match[1]}]] aponta para '${target}', que não existe na lore`,
        });
      }
    }
  }

  // Página spoiler é *deliberadamente* não-linkada: quem chega nela é o motor, ao julgar a
  // acusação, e nunca a navegação. Cobrar link de entrada dela acusaria de órfã a página mais
  // bem colocada de todo módulo bem-formado.
  const navigable = pages.filter((page) => !isSpoiler(page));

  // Numa lore com uma página navegável só não há de onde linkar — cobrar seria ruído.
  if (navigable.length > 1) {
    for (const page of navigable) {
      const path = normalizeTarget(page.path);
      if (!linked.has(path)) {
        diagnostics.push({
          severity: "warning",
          code: "orphan",
          file: `lore/wiki/${page.path}.md`,
          message: "nenhuma outra página aponta para esta — ela pode estar inalcançável para o agente",
        });
      }
    }
  }

  return diagnostics;
}

/** A página é marcada como spoiler? Usado para mantê-la fora do contexto do agente. */
export function isSpoiler(page: LorePage): boolean {
  return parseFrontmatter(page.content).data?.["spoiler"] === true;
}
