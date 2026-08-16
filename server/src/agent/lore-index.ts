import { isSpoiler, parseFrontmatter, type LorePage } from "@vestigio/module-schema";

export interface LoreHit {
  readonly path: string;
  readonly title: string;
  readonly excerpt: string;
}

export interface LoreIndex {
  /** Caminhos das páginas indexadas — nunca inclui uma página spoiler. */
  readonly paths: readonly string[];
  search(query: string): readonly LoreHit[];
}

/** Quantos trechos devolver por busca: o bastante para fundamentar, pouco para não inchar o prompt. */
const MAX_HITS = 5;
const EXCERPT_CHARS = 280;

interface IndexedPage {
  readonly path: string;
  readonly title: string;
  readonly body: string;
  readonly haystack: string;
}

/** Remove acentos e caixa: o jogador escreve "jaco", a lore diz "Jacó". */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Constrói o índice de lore que o personagem consulta.
 *
 * **Páginas `spoiler: true` são descartadas aqui, na origem** — não filtradas na resposta. Isso é
 * a diferença entre "o agente não deve contar" e "o agente não tem como contar": a verdade do
 * caso nunca entra no índice, então nenhum jogo de palavras do jogador a extrai (ADR-006).
 */
export function buildLoreIndex(pages: readonly LorePage[]): LoreIndex {
  const indexed: IndexedPage[] = pages
    .filter((page) => !isSpoiler(page))
    .map((page) => {
      const { data, body } = parseFrontmatter(page.content);
      const title = typeof data?.["title"] === "string" ? data["title"] : page.path;
      return { path: page.path, title, body: body.trim(), haystack: normalize(`${title}\n${body}`) };
    });

  return {
    paths: indexed.map((p) => p.path),

    search(query) {
      const needle = normalize(query).trim();
      if (needle.length === 0) return [];

      return indexed
        .map((page) => ({ page, score: countOccurrences(page.haystack, needle) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_HITS)
        .map(({ page }) => ({
          path: page.path,
          title: page.title,
          excerpt: excerptAround(page.body, needle),
        }));
    },
  };
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return count;
    count += 1;
    from = at + needle.length;
  }
}

/** Trecho em torno da primeira ocorrência — o suficiente para o personagem se fundamentar. */
function excerptAround(body: string, needle: string): string {
  const at = normalize(body).indexOf(needle);
  if (at === -1) return body.slice(0, EXCERPT_CHARS);

  const start = Math.max(0, at - EXCERPT_CHARS / 2);
  const excerpt = body.slice(start, start + EXCERPT_CHARS).trim();
  return (start > 0 ? "…" : "") + excerpt + (start + EXCERPT_CHARS < body.length ? "…" : "");
}
