import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { loadModuleRegistry } from "../src/repositories/module-registry.ts";

const MODULES_DIR = fileURLToPath(new URL("../../modules", import.meta.url));

const created: string[] = [];
afterEach(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempRoot(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "vestigio-reg-"));
  created.push(root);
  for (const [relative, content] of Object.entries(files)) {
    const full = join(root, relative);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, "utf8");
  }
  return root;
}

const MINIMAL_CASE = `
id: caso-minimo
title: Caso mínimo
clues:
  - id: pista-a
    title: Pista A
    anchor: { lat: -1.5, lng: -48.6, radius: 25 }
characters:
  - id: alguem
    name: Alguém
solution:
  culprit: alguem
  supporting_clues: [pista-a]
`.trim();

describe("loadModuleRegistry", () => {
  const registry = loadModuleRegistry(MODULES_DIR);

  it("carrega o módulo piloto do disco", () => {
    const module = registry.get("poco-de-jaco");
    expect(module?.title).toBe("O Cântaro Abandonado");
    expect(module?.caseDefinition.clues).toHaveLength(4);
  });

  it("monta os agentes com persona, voz, skills e reveals", () => {
    const samaritana = registry.get("poco-de-jaco")?.agents.get("samaritana");

    expect(samaritana?.persona).toContain("mulher de Samaria");
    expect(samaritana?.voice).toContain("desconfiada");
    expect(samaritana?.skills.map((s) => s.name)).toEqual(["guardar-segredo"]);
    expect(samaritana?.reveals).toEqual([
      { clue: "pista-confissao", requiresClues: ["pista-pegadas"] },
    ]);
  });

  it("lê o provider declarado pelo personagem, sem a chave", () => {
    const provider = registry.get("poco-de-jaco")?.agentProviders.get("samaritana");

    expect(provider?.baseUrl).toBe("https://api.openai.com/v1");
    expect(provider?.model).toBe("gpt-4o-mini");
    expect(provider?.apiKeyEnv).toBe("VESTIGIO_SAMARITANA_KEY");
    expect(provider?.temperature).toBe(0.8);
    expect(provider?.maxTokens).toBe(200);
    // A chave em si nunca chega aqui — só o nome da variável (ADR-008).
    expect(JSON.stringify(provider)).not.toMatch(/sk-/);
  });

  it("um personagem sem provider não entra no mapa de providers", () => {
    const module = registry.get("poco-de-jaco");
    expect(module?.agents.has("discipulo")).toBe(true);
    expect(module?.agentProviders.has("discipulo")).toBe(false);
  });

  it("um personagem sem voz e sem skills não quebra o carregamento", () => {
    const discipulo = registry.get("poco-de-jaco")?.agents.get("discipulo");
    expect(discipulo?.voice).toBeTruthy();
    expect(discipulo?.reveals).toEqual([]);
  });

  it("lista os módulos disponíveis", () => {
    expect(registry.list().map((m) => m.id)).toContain("poco-de-jaco");
  });

  it("devolve undefined para módulo inexistente", () => {
    expect(registry.get("nao-existe")).toBeUndefined();
  });

  it("carrega um módulo mínimo, sem agentes, skills nem lore", () => {
    const minimal = loadModuleRegistry(tempRoot({ "caso-minimo/case.yaml": MINIMAL_CASE }));
    const module = minimal.get("caso-minimo");

    expect(module?.agents.size).toBe(0);
    expect(module?.caseDefinition.clues).toHaveLength(1);
  });

  it("ignora diretórios sem case.yaml", () => {
    const registry = loadModuleRegistry(
      tempRoot({ "caso-minimo/case.yaml": MINIMAL_CASE, "nao-e-modulo/LEIA-ME.md": "nada aqui" }),
    );
    expect(registry.list().map((m) => m.id)).toEqual(["caso-minimo"]);
  });

  it("ignora arquivos soltos na raiz de módulos", () => {
    const registry = loadModuleRegistry(
      tempRoot({ "caso-minimo/case.yaml": MINIMAL_CASE, "LEIA-ME.md": "nada" }),
    );
    expect(registry.list()).toHaveLength(1);
  });

  it("um diretório de módulos inexistente devolve registro vazio, não erro", () => {
    // O servidor precisa subir mesmo antes de existir qualquer módulo.
    expect(loadModuleRegistry("/caminho/que/nao/existe").list()).toEqual([]);
  });

  it("mantém a lore carregada para o runtime consultar", () => {
    const lore = registry.get("poco-de-jaco")?.loaded.lore ?? [];
    expect(lore.map((p) => p.path)).toContain("personagens/samaritana");
    expect(lore.map((p) => p.path)).toContain("casos/a-verdade");
  });
});
