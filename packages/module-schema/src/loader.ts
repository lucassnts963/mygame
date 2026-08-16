import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { parse as parseYaml } from "yaml";
import type { LoadedAgent, LoadedModule, LorePage } from "./types.ts";

/**
 * **Este é o único arquivo do pacote que toca o disco.** Todo o resto recebe strings e devolve
 * diagnósticos, o que mantém a validação testável sem fixtures em disco.
 */

/** Lista recursivamente os arquivos de um diretório, com caminhos relativos e barra normalizada. */
function walk(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(relative(base, full).split(sep).join("/"));
  }
  return out;
}

function readYaml(root: string, relativePath: string): unknown {
  const raw = readFileSync(join(root, relativePath), "utf8");
  try {
    return parseYaml(raw) as unknown;
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`${relativePath}: YAML inválido — ${detail}`);
  }
}

/**
 * Lê um diretório de módulo inteiro para a memória.
 *
 * Lança apenas nas duas falhas que impedem qualquer análise posterior: não existir `case.yaml`,
 * e o YAML não ser legível. Tudo o mais vira diagnóstico em `validateModule` — um autor com
 * cinco problemas precisa ver os cinco.
 */
export function loadModule(root: string): LoadedModule {
  const caseFile = "case.yaml";
  if (!existsSync(join(root, caseFile))) {
    throw new Error(`módulo inválido: ${caseFile} não encontrado em '${root}'`);
  }

  const agents: LoadedAgent[] = [];
  for (const path of walk(join(root, "agents"))) {
    if (!path.endsWith(".yaml") && !path.endsWith(".yml")) continue;
    const relativePath = `agents/${path}`;
    const document = readYaml(root, relativePath);
    const id =
      document && typeof document === "object" && typeof (document as { id?: unknown }).id === "string"
        ? (document as { id: string }).id
        : path.replace(/\.(agent\.)?ya?ml$/, "");
    agents.push({
      id,
      file: relativePath,
      document,
      content: readFileSync(join(root, relativePath), "utf8"),
    });
  }

  const skills = walk(join(root, "skills"))
    .filter((path) => path.endsWith("SKILL.md"))
    .map((path) => ({
      name: path.split("/")[0] ?? path,
      file: `skills/${path}`,
      content: readFileSync(join(root, "skills", path), "utf8"),
    }));

  const lore: LorePage[] = walk(join(root, "lore", "wiki"))
    .filter((path) => path.endsWith(".md"))
    .map((path) => ({
      path: path.replace(/\.md$/, ""),
      content: readFileSync(join(root, "lore", "wiki", path), "utf8"),
    }));

  const files = walk(root)
    .filter((path) => /\.(ya?ml|md|json|txt)$/.test(path))
    .map((path) => ({ path, content: readFileSync(join(root, path), "utf8") }));

  return {
    root,
    caseFile,
    caseDocument: readYaml(root, caseFile),
    agents,
    skills,
    lore,
    files,
  };
}
